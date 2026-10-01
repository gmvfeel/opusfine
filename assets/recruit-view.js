/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 리쿠르트 상세 엔진 — assets/recruit-view.js · 2026-10-01
   ------------------------------------------------------------------
   오퍼스클램 assets/recruit-view.js 를 그대로 참고해 포팅했습니다.
   채용/인재 상세를 그리고, 조회수를 올리고, 오른쪽 목록을 누르면
   왼쪽만 바꿔 그리고, 인재의 연락처는 가림막 뒤에 두었다가
   recruit_talent_contact() 로만 엽니다. 지원하기 창(지원 모달)도
   이 파일이 엽니다.

   바뀐 것 (오퍼스클램 대비)
    · 단체 DB 고리 — 오퍼스클램은 음악단체/공연장/음악학교/관련기관재단
      네 DB였지만, 오퍼스파인은 전시공간(db/venue) 한 DB만 있어
      org_db 값은 'venue' 또는 null(자유기재) 뿐입니다.
    · 칸 이름 — job_cat1/job_cat2 대신 cat1/cat2, org_addr 대신
      org_addr1+org_addr2, audition_piece 대신 audition_items(배열).
    · 학력(schools) — {id,name,degree,major,from,to} 로 담습니다
      (국가 칸은 뺐습니다 — 오퍼스파인 학교DB는 국내 중심입니다).
    · 접속 — OF.sb() 싱글턴을 씁니다 (recruit.js·recruit-list.js 와 같음).
    · 오른쪽 목록 — <tr> 표가 아니라 .rc-row(카드형 줄)라 markCurrent 가
      거기 맞춰 .rc-row-on 을 토글합니다.
    · 지원서 — recruit_applications 에 talent_id·name·phone·email·
      file_url·file_name 칸을 더해, 오퍼스클램의 인재정보 붙이기·
      연락처 수정·파일첨부를 그대로 받습니다. 파일은 recruit-files
      저장통(5MB·이미지+PDF)에 올립니다.

   쓰는 법
     OFRecruitView.init({ kind:'job', table:'recruit_jobs',
       listPage:'/recruit/job.html', writePage:'/recruit/job-write.html' })
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var R, cfg = null, cur = null;

  function sb() { return window.__ofSb || null; }
  async function sbReady() { await OF.sb(); return sb(); }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function el(s) { return document.querySelector(s); }
  function nl(v) { return esc(v).replace(/\r?\n/g, '<br>'); }
  function has(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    return String(v).trim() !== '';
  }
  function row(label, valueHtml) {
    if (!has(valueHtml)) return '';
    return '<tr><th>' + esc(label) + '</th><td>' + valueHtml + '</td></tr>';
  }
  function rowAlways(label, valueHtml, cls) {
    var v = has(valueHtml) ? valueHtml : '<span class="rv-none">미등록</span>';
    return '<tr><th>' + esc(label) + '</th>'
      + '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</td></tr>';
  }
  function arrCell(a) { return (a && a.length) ? a.map(esc).join(' · ') : ''; }

  /* ── 단체 DB 고리 — 오퍼스파인은 전시공간DB 하나뿐입니다 ───── */
  var ORG_DBS = {
    venue: { label: '전시공간DB', list: '/db/venue.html', view: '/db/venue-view.html' },
  };
  var SCHOOL_VIEW = '/db/school-view.html';
  var SCHOOL_LIST = '/db/school.html';
  var LOGIN_PAGE = '/account/login.html';

  function listHref() {
    var base = (cfg && cfg.listPage) || '/recruit/job.html';
    var id = new URLSearchParams(location.search).get('id');
    if (!id) return base;
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'focus=' + encodeURIComponent(id);
  }
  function link(params, text) {
    var qs = Object.keys(params)
      .filter(function (k) { return has(params[k]); })
      .map(function (k) { return k + '=' + encodeURIComponent(params[k]); })
      .join('&');
    if (!qs) return esc(text);
    return '<a class="rv-lk" href="' + cfg.listPage + '?' + qs + '">' + esc(text) + '</a>';
  }

  function jobCell(o) {
    if (!has(o.cat1)) return has(o.job_etc) ? esc(o.job_etc) : '';
    var h = link({ cat1: o.cat1 }, o.cat1);
    if (has(o.cat2)) h += ' <span class="rv-arrow">›</span> ' + link({ cat1: o.cat1, cat2: o.cat2 }, o.cat2);
    if (has(o.job_etc)) h += ' <span class="rv-dim">(' + esc(o.job_etc) + ')</span>';
    return h;
  }
  function regionCell(o) {
    if (!has(o.region1)) return '';
    var h = link({ r1: o.region1 }, o.region1);
    if (has(o.region2)) h += ' <span class="rv-arrow">›</span> ' + link({ r1: o.region1, r2: o.region2 }, o.region2);
    return h;
  }
  function workCell(o) {
    var out = [];
    if (has(o.work_days)) out.push('<span class="rv-k">근무요일</span> ' + esc(o.work_days));
    var t = '';
    if (has(o.work_start) && has(o.work_end)) t = o.work_start + ' - ' + o.work_end;
    else if (has(o.work_start)) t = o.work_start + ' -';
    else if (has(o.work_end)) t = '- ' + o.work_end;
    if (t) out.push('<span class="rv-k">근무시간</span> ' + esc(t));
    return out.join('<br>');
  }
  function qualCell(o) {
    var out = [];
    var edu = o.edu_any ? '학력무관' : o.edu;
    if (has(edu)) out.push('<span class="rv-k">학력</span> ' + esc(edu));
    if (has(o.gender)) out.push('<span class="rv-k">성별</span> ' + esc(o.gender));
    var age = o.age_any ? '무관'
      : (has(o.age_min) && has(o.age_max)) ? (o.age_min + '세 ~ ' + o.age_max + '세')
      : has(o.age_min) ? (o.age_min + '세 이상')
      : has(o.age_max) ? (o.age_max + '세 이하') : '';
    if (has(age)) out.push('<span class="rv-k">나이</span> ' + esc(age));
    return out.join('<br>');
  }
  function payCell(o) { var s = R.payLabel(o.pay_type, o.pay_amount, o.pay_daily); return has(s) ? esc(s) : ''; }
  function homeCell(o) {
    if (!has(o.org_home)) return '';
    var u = String(o.org_home).trim();
    var href = /^https?:\/\//i.test(u) ? u : 'http://' + u;
    return '<a class="rv-lk" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(u) + '</a>';
  }
  function orgAddrCell(o) {
    var a = [o.org_addr1, o.org_addr2].filter(Boolean).join(' ');
    return has(a) ? esc(a) : '';
  }

  /* ============================================================
     채용 상세
     ============================================================ */
  function jobHtml(o, opt) { return drawJob(o, Object.assign({ html: true }, opt || {})); }
  function previewJob(o) {
    if (!R) R = window.OFRecruit;
    if (!cfg) cfg = { kind: 'job', listPage: '/recruit/job.html' };
    return drawJob(o || {}, { html: true, preview: true });
  }

  function drawJob(o, opt) {
    opt = opt || {};
    var box = opt.html ? null : el('#rvDoc');
    if (!opt.html && !box) return;

    var dday = R.daysLeft(o.apply_to);
    var ddayTag = (dday != null && dday >= 0 && dday <= 7) ? ' <b class="rc-dday">D-' + dday + '</b>' : '';
    var closed = (dday != null && dday < 0 && !o.apply_always && !o.apply_until_hired);

    var db = ORG_DBS[o.org_db] || null;
    var orgHead;
    if (db && has(o.org_id)) {
      orgHead = '<div class="rv-orgfoot"><a class="rv-orglink" href="' + db.view + '?id=' + encodeURIComponent(o.org_id) + '">'
        + '단체/공간정보 상세보기<span class="rv-orgdb">' + esc(db.label) + '</span>'
        + '<span aria-hidden="true">→</span></a></div>';
    } else if (db) {
      orgHead = '<div class="rv-orgfoot"><a class="rv-orglink" href="' + db.list + '?kw=' + encodeURIComponent(o.org_name || '') + '">'
        + db.label + '에서 찾아보기<span aria-hidden="true">→</span></a></div>';
    } else {
      orgHead = '';
    }

    var head = '<div class="rv-orgbox"><table class="rv-tbl rv-tbl--org"><tbody>'
      +   rowAlways('단체 / 기관명', esc(o.org_name || ''), 'rv-orgname')
      +   rowAlways('분야', esc(o.org_field || ''))
      +   rowAlways('웹사이트', homeCell(o))
      +   rowAlways('주소', orgAddrCell(o))
      + '</tbody></table></div>' + orgHead;

    var sec1 = ''
      + (has(o.duty) ? '<section class="rv-sec"><h2>담당업무</h2><div class="rv-body">' + nl(o.duty) + '</div></section>' : '')
      + '<section class="rv-sec"><h2>모집요강 및 응시자격</h2><table class="rv-tbl"><tbody>'
      +     row('모집분야', jobCell(o))
      +     row('고용형태', arrCell(o.emp_types))
      +     row('모집인원', has(o.headcount) ? esc(o.headcount) + ' 명' : '')
      +     row('근무형태', workCell(o))
      +     row('자격요건', qualCell(o))
      +     row('오디션여부', esc(o.audition || ''))
      +     row('오디션/과제물', nl((o.audition_items || []).join('\n')))
      +     row('우대조건', arrCell(o.prefer))
      + '</tbody></table></section>'
      + '<section class="rv-sec"><h2>근무환경</h2><table class="rv-tbl"><tbody>'
      +     row('급여', payCell(o))
      +     row('근무지역', regionCell(o))
      + '</tbody></table></section>'
      + (has(o.body) ? '<section class="rv-sec"><h2>상세내용</h2><div class="rv-body rv-body--long">' + nl(o.body) + '</div></section>' : '');

    var sec2 = '<section class="rv-sec"><table class="rv-tbl"><tbody>'
      +     row('접수기간', esc(R.applyLabel(o.apply_from, o.apply_to, o.apply_always, o.apply_until_hired)) + ddayTag + (closed ? ' <b class="rv-closed">마감</b>' : ''))
      +     row('접수방법', arrCell(o.apply_methods))
      + '</tbody></table></section>'
      + '<section class="rv-sec"><h2>담당자 및 문의처</h2><table class="rv-tbl"><tbody>'
      +     row('담당자명', esc(o.contact_name || ''))
      +     row('이메일', has(o.contact_email) ? '<a class="rv-lk" href="mailto:' + esc(o.contact_email) + '">' + esc(o.contact_email) + '</a>' : '')
      +     row('전화번호', esc(o.contact_phone || ''))
      +     row('FAX', esc(o.contact_fax || ''))
      + '</tbody></table></section>';

    var siteApply = (o.accept_site !== false);
    var applyBtn;
    if (closed) {
      applyBtn = '<span class="rv-btn rv-btn--off" title="접수가 끝난 공고입니다.">접수 마감</span>';
    } else if (siteApply) {
      applyBtn = '<button type="button" class="rv-btn rv-btn--go" id="rvApply">지원하기</button>';
    } else if (has(o.contact_email)) {
      applyBtn = '<a class="rv-btn rv-btn--go" href="mailto:' + esc(o.contact_email)
        + '?subject=' + encodeURIComponent('[오퍼스파인 리쿠르트] ' + (o.title || '') + ' 지원') + '">이메일로 지원하기</a>';
    } else {
      applyBtn = '<span class="rv-btn rv-btn--off" title="이 공고는 오퍼스파인 안에서 지원을 받지 않습니다. 접수방법을 확인해 주십시오.">접수방법 확인</span>';
    }

    var out = ''
      + '<h1 class="rv-title">' + esc(o.title || '(제목을 아직 적지 않았습니다)') + '</h1>'
      + head
      + '<h2 class="rv-group">채용상세정보</h2>' + sec1
      + '<h2 class="rv-group">접수기간 / 방법</h2>' + sec2;

    if (!opt.preview) {
      out += '<div class="rv-btns">' + applyBtn + '<a class="rv-btn rv-btn--list" href="' + listHref() + '">목록</a></div>'
        + '<div class="rv-note"><p>등록된 내용은 채용 주체가 직접 올린 것입니다. 채용 조건과 일정은 바뀔 수 있으니 '
        + '지원 전에 문의처로 다시 확인해 주십시오.</p></div>';
    }

    if (opt.html) return out;
    box.innerHTML = out;
    markCurrent(o.id);
    document.title = (o.title || '채용정보') + ' · 리쿠르트 · OPUSFINE';
  }

  /* ============================================================
     인재 상세
     ============================================================ */
  function wishBlock(o) {
    return '<section class="rv-sec"><h2>구직사항</h2><table class="rv-tbl"><tbody>'
      +   row('희망분야', jobCell(o))
      +   row('희망급여', payCell(o))
      +   row('근무지역', regionCell(o))
      +   row('근무형태', arrCell(o.emp_types))
      +   row('현재상태', esc(o.now_status || ''))
      + '</tbody></table></section>';
  }

  function schoolsBlock(o) {
    var list = o.schools;
    if (typeof list === 'string') { try { list = JSON.parse(list); } catch (e) { list = null; } }
    if (!Array.isArray(list)) list = [];

    var rows = list.map(function (s) {
      s = s || {};
      var nameHtml = esc(s.name || '');
      if (has(s.name)) {
        var href = has(s.id) ? (SCHOOL_VIEW + '?id=' + encodeURIComponent(s.id)) : (SCHOOL_LIST + '?kw=' + encodeURIComponent(s.name));
        nameHtml = '<a class="rv-lk" href="' + href + '">' + esc(s.name) + '</a>';
      }
      var span = (has(s.from) || has(s.to)) ? (esc(s.from || '') + ' - ' + esc(s.to || '')) : '';
      return '<tr><td class="sc-name">' + (nameHtml || '-') + '</td>'
        + '<td>' + (has(s.degree) ? esc(s.degree) : '-') + '</td>'
        + '<td>' + (has(s.major) ? esc(s.major) : '-') + '</td>'
        + '<td class="sc-when">' + (span || '-') + '</td></tr>';
    }).join('');

    var schoolTbl = rows
      ? '<table class="rv-tbl rv-schools"><thead><tr><th>학교명</th><th>학위</th><th>전공</th><th>재학기간</th></tr></thead><tbody>' + rows + '</tbody></table>'
      : '<p class="rv-none">등록된 학력이 없습니다.</p>';

    return '<section class="rv-sec"><h2>학력사항 / 경력사항</h2>' + schoolTbl
      + (has(o.career) ? '<div class="rv-body rv-career">' + nl(o.career) + '</div>' : '')
      + '</section>';
  }

  function etcBlock(o) {
    var dis = o.disability;
    if (has(dis) && has(o.disability_grade)) dis = dis + ' (' + o.disability_grade + ')';
    var mil = o.military;
    if (has(mil) && (has(o.military_from) || has(o.military_to))) mil = mil + ' (' + (o.military_from || '') + ' - ' + (o.military_to || '') + ')';
    var body = row('보훈대상여부', esc(o.veteran || '')) + row('장애여부', esc(dis || '')) + row('병역사항', esc(mil || ''));
    if (!body) return '';
    return '<section class="rv-sec"><h2>기타정보</h2><table class="rv-tbl"><tbody>' + body + '</tbody></table></section>';
  }

  function maskBlock(v) {
    var msg, btn;
    if (!v.user) {
      msg = '이 인재의 연락처와 이름은 회원만 확인할 수 있습니다.';
      btn = '<a class="rv-btn rv-btn--go rv-btn--sm" href="' + LOGIN_PAGE + '?next=' + encodeURIComponent(location.pathname + location.search) + '">로그인하고 열람하기</a>';
    } else if (!v.canSeeTalents) {
      var g = R.gateMsg(v.role || R.roleOf(null), 'hiring');
      msg = (g.why === 'type' ? '연락처 열람은 ' : '') + g.msg;
      btn = '';
    } else {
      msg = '채용을 위해 이 인재의 이름과 연락처를 확인하실 수 있습니다.';
      btn = '<button type="button" class="rv-btn rv-btn--go rv-btn--sm" id="rvReveal">연락처 열람</button>';
    }
    return '<div class="rv-mask" id="rvMask">'
      + '<div class="rv-mask-back" aria-hidden="true"><div class="rv-mask-photo"></div>'
      +   '<div class="rv-mask-lines"><span></span><span></span><span></span><span></span></div></div>'
      + '<div class="rv-mask-over"><p>' + msg + '</p>' + btn + '</div></div>';
  }

  var CONTACT_LABELS = { name: '이름', birth: '출생', phone: '휴대폰', tel: '전화번호', email: '이메일' };

  async function reveal(id) {
    var box = el('#rvMask');
    var c = await sbReady();
    if (!box || !c) return;
    box.classList.add('is-loading');
    try {
      var r = await c.rpc('recruit_talent_contact', { p_id: Number(id) });
      if (r.error) throw r.error;
      var d = r.data;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) {} }
      if (!d || !d.ok) throw new Error((d && d.why) || 'empty');

      var rows = '';
      Object.keys(CONTACT_LABELS).forEach(function (k) {
        if (!has(d[k])) return;
        var v = (k === 'email') ? '<a class="rv-lk" href="mailto:' + esc(d[k]) + '">' + esc(d[k]) + '</a>'
          : (k === 'phone' || k === 'tel') ? '<a class="rv-lk" href="tel:' + esc(String(d[k]).replace(/[^0-9+]/g, '')) + '">' + esc(d[k]) + '</a>'
          : esc(d[k]);
        rows += row(CONTACT_LABELS[k], v);
      });
      var addr = [d.zipcode, d.addr1, d.addr2].filter(Boolean).join(' ');
      if (has(addr)) rows += row('주소', esc(addr));
      if (!rows) throw new Error('empty');

      var photo = has(d.photo_url) ? '<div class="rv-contact-photo"><img src="' + esc(d.photo_url) + '" alt=""></div>' : '';
      box.classList.remove('is-loading');
      box.outerHTML = '<div class="rv-contact">' + photo
        + '<div class="rv-contact-body"><h3>연락처</h3><table class="rv-tbl"><tbody>' + rows + '</tbody></table>'
        + '<p class="rv-contact-note">채용 목적 외로 쓰거나 다른 곳에 옮기는 것은 개인정보보호법으로 금지되어 있습니다.</p>'
        + '</div></div>';
    } catch (e) {
      box.classList.remove('is-loading');
      var over = box.querySelector('.rv-mask-over');
      if (over) over.innerHTML = '<p>연락처를 열지 못했습니다. 권한이 없거나 잠시 문제가 생겼을 수 있습니다.</p>';
    }
  }

  function talentHtml(o, opt) {
    opt = opt || {};
    var g = String(o.gender || '').replace('남성', '남').replace('여성', '여');
    var who = opt.preview ? maskName(o.name) : (o.name_masked || '');
    var age = o.age || (o.birth_year ? (new Date().getFullYear() - Number(o.birth_year) + 1) : '');
    return ''
      + '<h1 class="rv-title">' + esc(o.title || '(제목을 아직 적지 않았습니다)') + '</h1>'
      + '<div class="rv-who">' + esc(who) + '<span>' + esc(g) + (age ? ' / ' + esc(age) + '세' : '') + '</span></div>'
      + (opt.preview ? previewMaskNote(o) : maskBlock(opt.viewer || { user: null }))
      + '<h2 class="rv-group">인재상세정보</h2>'
      + wishBlock(o) + schoolsBlock(o) + etcBlock(o)
      + (has(o.body) ? '<section class="rv-sec"><h2>자기소개서</h2><div class="rv-body rv-body--long">' + nl(o.body) + '</div></section>' : '');
  }

  function maskName(name) {
    var n = String(name || '').trim();
    if (!n) return '';
    if (n.length <= 1) return n;
    return n.charAt(0) + Array(n.length).join('*');
  }

  function previewMaskNote(o) {
    var photo = has(o && o.photo_url) ? '<div class="rv-note-photo"><img src="' + esc(o.photo_url) + '" alt="올리신 사진"></div>' : '';
    return '<div class="rv-mask rv-mask--note"><div class="rv-note-in">' + photo
      + '<div class="rv-note-txt"><p>이름 · 연락처' + (photo ? ' · 사진' : '')
      + ' 은 <b>채용하는 단체·학교 회원이 열람할 때만</b> 보입니다. 다른 분들에게는 이 자리가 가려집니다.</p>'
      + (photo ? '' : '<p class="rv-note-add">사진을 올리시면 뽑는 쪽이 훨씬 잘 봅니다.</p>')
      + '</div></div></div>';
  }

  async function drawTalent(o) {
    var box = el('#rvDoc');
    if (!box) return;
    var v = await R.viewer();
    box.innerHTML = talentHtml(o, { viewer: v })
      + '<div class="rv-btns"><a class="rv-btn rv-btn--list" href="' + listHref() + '">목록</a></div>'
      + '<div class="rv-note"><p>등록된 내용은 본인이 직접 올린 것입니다. 이름과 연락처는 '
      + '채용을 위해 열람한 회원에게만 보이며, 열람 기록이 남습니다.</p></div>';
    var b = el('#rvReveal');
    if (b) b.addEventListener('click', function () { reveal(o.id); });
    markCurrent(o.id);
    document.title = (o.title || '인재정보') + ' · 리쿠르트 · OPUSFINE';
  }

  function previewTalent(o) {
    if (!R) R = window.OFRecruit;
    if (!cfg) cfg = { kind: 'talent', listPage: '/recruit/talent.html' };
    return talentHtml(o || {}, { preview: true });
  }

  function draw(o) { cur = o; if (cfg.kind === 'talent') return drawTalent(o); return drawJob(o); }

  function markCurrent(id) {
    [].forEach.call(document.querySelectorAll('#rcList .rc-row'), function (a) {
      a.classList.toggle('rc-row-on', a.getAttribute('href').indexOf('id=' + id) >= 0);
    });
  }

  async function notFoundHtml() {
    return '<div class="rv-empty">그 정보를 찾을 수 없습니다 — 삭제되었거나, 보실 수 있는 권한이 없을 수 있습니다.<br>'
      + '<a class="rv-lk" href="' + listHref() + '">목록으로 돌아가기</a></div>';
  }

  async function bump(id) {
    var c = await sbReady();
    if (!c || !cfg.hitFn) return;
    try { await c.rpc(cfg.hitFn, { p_id: Number(id) }); } catch (e) { /* 조회수는 못 올려도 읽는 일을 방해하지 않습니다 */ }
  }

  async function load(id, push) {
    var box = el('#rvDoc');
    if (box) box.innerHTML = '<div class="rv-loading">불러오는 중…</div>';
    try {
      var c = await sbReady();
      var table = cfg.kind === 'talent' ? 'recruit_talents_public' : cfg.table;
      var r = await (c ? c.from(table).select('*').eq('id', id).maybeSingle()
        : fetch(OF.SB_URL + '/rest/v1/' + table + '?select=*&id=eq.' + encodeURIComponent(id) + '&limit=1', { headers: await R.headers() }).then(function (res) { return res.json().then(function (rows) { return { data: rows && rows[0] }; }); }));
      var o = r.data;
      if (!o) { if (box) box.innerHTML = await notFoundHtml(); return; }
      draw(o);
      if (push) history.pushState({ id: id }, '', location.pathname + '?id=' + encodeURIComponent(id));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      bump(id);
      if (cfg.kind === 'job') bindApply();
    } catch (e) {
      if (box) box.innerHTML = '<div class="rv-empty">불러오지 못했습니다.</div>';
    }
  }

  /* ============================================================
     지원하기 — 오퍼스클램의 지원 모달을 그대로 가져왔습니다.
     인재정보 붙이기 · 연락처 고쳐쓰기 · 파일첨부 · 개인정보 동의.
     ============================================================ */
  var applyState = { job: null, me: null, talents: [], fileUrl: null, fileName: null, busy: false };

  async function myTalents() {
    var c = await sbReady();
    if (!c || !applyState.me) return [];
    try {
      var r = await c.from('recruit_talents').select('id,title,cat1,is_open').eq('member_id', applyState.me.id).order('created_at', { ascending: false });
      return r.data || [];
    } catch (e) { return []; }
  }

  function raSay(msg, cls) {
    var m = el('#raMsg');
    if (m) { m.textContent = msg || ''; m.className = 'ra-msg' + (cls ? ' ra-' + cls : ''); }
  }

  function closeApply() {
    var wrap = el('#raWrap');
    if (wrap) wrap.remove();
  }

  async function bindApply() {
    var btn = el('#rvApply');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      var v = await R.viewer();
      if (!v.user) { location.href = LOGIN_PAGE + '?next=' + encodeURIComponent(location.pathname + location.search); return; }
      if (!v.role.individual) {
        var g = R.gateMsg(v.role, 'individual');
        alert((g.why === 'type' ? '지원은 ' : '') + g.msg.replace(/<[^>]+>/g, ''));
        return;
      }
      var chk = await c_myApp(cur.id);
      if (chk && chk.applied) { alert('이미 지원하신 공고입니다 (' + (chk.status || '') + '). 마이페이지에서 확인해 주십시오.'); return; }
      var appCnt = await c_appCount(cur.id);
      if (appCnt && appCnt.ok) { /* 본인 공고 — 지원 대신 알림만 주고 열지 않습니다 */
        alert('본인이 올린 공고에는 지원할 수 없습니다. 지금까지 ' + (appCnt.total || 0) + '건, 읽지 않은 지원 ' + (appCnt.unread || 0) + '건이 있습니다.');
        return;
      }
      openApply(v.user);
    });
  }

  async function c_myApp(jobId) {
    var c = await sbReady();
    if (!c) return null;
    try { var r = await c.rpc('recruit_my_application', { p_job: Number(jobId) }); return r.data; } catch (e) { return null; }
  }
  async function c_appCount(jobId) {
    var c = await sbReady();
    if (!c) return null;
    try { var r = await c.rpc('recruit_job_app_count', { p_job: Number(jobId) }); return r.data; } catch (e) { return null; }
  }

  async function openApply(user) {
    applyState.job = cur; applyState.me = user; applyState.fileUrl = null; applyState.fileName = null; applyState.busy = false;

    var host = document.createElement('div');
    host.id = 'raWrap'; host.className = 'ra-wrap';
    host.innerHTML = '<div class="ra-dim"></div><div class="ra-win">'
      + '<div class="ra-head"><b>지원서 작성</b><button type="button" class="ra-x" id="raX">×</button></div>'
      + '<div class="ra-body" id="raBody"><div class="rv-loading">불러오는 중…</div></div>'
      + '<div class="ra-foot"><span class="ra-msg" id="raMsg"></span>'
      +   '<button type="button" class="rv-btn rv-btn--list" id="raCancel">취소</button>'
      +   '<button type="button" class="rv-btn rv-btn--go" id="raSend">지원서 보내기</button>'
      + '</div></div>';
    document.body.appendChild(host);
    el('#raX').addEventListener('click', closeApply);
    el('#raCancel').addEventListener('click', closeApply);
    host.querySelector('.ra-dim').addEventListener('click', closeApply);
    el('#raSend').addEventListener('click', submitApply);

    var c = await sbReady();
    var o = applyState.job;
    var m = {};
    try { var r = await c.from('community_members').select('*').eq('id', user.id).maybeSingle(); m = r.data || {}; } catch (e) {}
    applyState.talents = await myTalents();

    var org = (o.org_name || '').trim();
    var nm = (m.name || '').trim();
    var ph = (m.phone || '').trim();
    var em = (m.email || user.email || '').trim();

    var body = el('#raBody');
    body.innerHTML = ''
      + '<div class="ra-to"><span class="ra-to-l">지원하는 곳</span><b>' + esc(org || '(단체명 없음)') + '</b>'
      +   '<span class="ra-to-t">' + esc(o.title || '') + '</span></div>'
      + '<div class="ra-f"><label>내 인재정보 붙이기</label>'
      +   (applyState.talents.length
        ? '<select id="raTalent"><option value="">붙이지 않음</option>'
          + applyState.talents.map(function (t) {
              return '<option value="' + t.id + '">' + esc(t.title || '(제목 없음)') + (t.cat1 ? ' — ' + esc(t.cat1) : '') + (t.is_open === false ? ' (목록에 안 보이게 해 둔 것)' : '') + '</option>';
            }).join('') + '</select>'
          + '<p class="ra-hint">붙이시면 단체가 학력·경력·자기소개를 함께 봅니다. 훨씬 도움이 됩니다.</p>'
        : '<p class="ra-hint">등록해 둔 인재정보가 없습니다. <a href="/recruit/talent-write.html">인재정보를 먼저 올리시면</a> 지원할 때 함께 보낼 수 있습니다. 없이도 지원은 됩니다.</p>')
      + '</div>'
      + '<div class="rw-grid"><div class="ra-f"><label>이름 <em>*</em></label>'
      +   '<input type="text" id="raName" maxlength="40" value="' + esc(nm) + '" placeholder="실명"></div>'
      +   '<div class="ra-f"><label>연락처 <em>*</em></label>'
      +   '<input type="text" id="raPhone" maxlength="30" value="' + esc(ph) + '" placeholder="010-0000-0000"></div></div>'
      + '<div class="ra-f"><label>이메일 <em>*</em></label>'
      +   '<input type="email" id="raEmail" maxlength="120" value="' + esc(em) + '" placeholder="받을 수 있는 이메일"></div>'
      + '<div class="ra-f"><label>하고 싶은 말</label>'
      +   '<textarea id="raMemo" rows="5" maxlength="1500" placeholder="지원하는 까닭, 작업 경험, 가능한 일정 같은 것을 적어 주십시오."></textarea></div>'
      + '<div class="ra-f"><label>파일 붙이기</label><div class="ra-file">'
      +   '<button type="button" class="rw-find" id="raFileBtn">파일 선택</button>'
      +   '<span id="raFileName">선택한 파일 없음</span>'
      +   '<button type="button" class="rw-school-del" id="raFileDel" hidden>지우기</button></div>'
      +   '<input type="file" id="raFile" style="display:none">'
      +   '<p class="ra-hint">이력서·포트폴리오 등 하나를 올리실 수 있습니다 (PDF 또는 이미지, 5MB까지).</p></div>'
      + '<div class="rw-agree"><label class="ra-check">'
      +   '<input type="checkbox" id="raAgree">'
      +   '<span>아래 정보가 <b>' + esc(org || '이 단체') + '</b> 에 전달되는 것에 동의합니다. <em>*</em></span></label>'
      +   '<p>이름 · 연락처 · 이메일, 붙이신 인재정보와 파일, 하고 싶은 말, 지원한 시각이 전달됩니다. '
      +   '전달된 정보는 채용 목적으로만 쓰여야 하며, 지원은 마이페이지에서 취소하실 수 있습니다.</p></div>';

    bindApplyFile();
  }

  function bindApplyFile() {
    var btn = el('#raFileBtn'), inp = el('#raFile'), nameEl = el('#raFileName'), delBtn = el('#raFileDel');
    if (!btn || !inp) return;
    applyState.fileUrl = null; applyState.fileName = null;
    btn.addEventListener('click', function () { inp.click(); });
    delBtn.addEventListener('click', function () {
      applyState.fileUrl = null; applyState.fileName = null;
      inp.value = ''; nameEl.textContent = '선택한 파일 없음'; delBtn.hidden = true;
    });
    inp.addEventListener('change', async function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      var c = await sbReady();
      if (!c || !applyState.me) return;
      nameEl.textContent = '올리는 중… ' + f.name;

      if (f.size > 5 * 1024 * 1024) {
        nameEl.textContent = '선택한 파일 없음';
        alert('파일이 너무 큽니다 (' + (f.size / 1024 / 1024).toFixed(1) + 'MB · 5MB까지).');
        inp.value = ''; return;
      }
      if (!/^image\/(jpeg|png|webp|gif)$|^application\/pdf$/.test(String(f.type || ''))) {
        nameEl.textContent = '선택한 파일 없음';
        alert('이 종류의 파일은 받지 않습니다 (' + (f.type || '알 수 없음') + ').\nPDF 또는 이미지(JPG·PNG)로 올려 주십시오.');
        inp.value = ''; return;
      }
      var mm = String(f.name || '').match(/\.([A-Za-z0-9]{1,8})$/);
      var ext = mm ? mm[1].toLowerCase() : ({ 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[String(f.type || '')] || 'bin');
      var path = applyState.me.id + '/app_' + Date.now() + '.' + ext;
      try {
        var up = await c.storage.from('recruit-files').upload(path, f, { upsert: false, contentType: f.type || undefined });
        if (up.error) throw up.error;
        applyState.fileUrl = c.storage.from('recruit-files').getPublicUrl(path).data.publicUrl;
        applyState.fileName = f.name || ('첨부.' + ext);
        nameEl.textContent = applyState.fileName;
        delBtn.hidden = false;
        raSay('');
      } catch (e) {
        var msg = String((e && e.message) || e);
        nameEl.textContent = '선택한 파일 없음';
        raSay('파일을 올리지 못했습니다 — ' + esc(msg), 'warn');
      }
    });
  }

  async function submitApply() {
    if (applyState.busy) return;
    var o = applyState.job;
    var c = await sbReady();
    if (!o || !c) return;

    var nm = (el('#raName') || {}).value || '';
    var ph = (el('#raPhone') || {}).value || '';
    var em = (el('#raEmail') || {}).value || '';
    var memo = (el('#raMemo') || {}).value || '';
    var tid = (el('#raTalent') || {}).value || '';
    var ok = (el('#raAgree') || {}).checked;

    if (!String(nm).trim()) { raSay('이름을 적어 주십시오.', 'warn'); return; }
    if (!String(ph).trim()) { raSay('연락처를 적어 주십시오.', 'warn'); return; }
    if (!String(em).trim()) { raSay('이메일을 적어 주십시오.', 'warn'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(em).trim())) { raSay('이메일 모양이 맞지 않습니다.', 'warn'); return; }
    if (!ok) { raSay('개인정보 전달에 동의해 주셔야 지원할 수 있습니다.', 'warn'); return; }

    applyState.busy = true;
    var send = el('#raSend');
    if (send) { send.disabled = true; send.textContent = '보내는 중…'; }
    raSay('');

    try {
      var row2 = {
        job_id: Number(o.id), applicant_id: applyState.me.id,
        talent_id: tid ? Number(tid) : null,
        name: String(nm).trim(), phone: String(ph).trim(), email: String(em).trim(),
        message: String(memo).trim() || null,
        file_url: applyState.fileUrl, file_name: applyState.fileName,
      };
      var r = await c.from('recruit_applications').insert([row2]);
      if (r.error) throw r.error;

      var body = el('#raBody');
      body.innerHTML = '<div class="ra-done"><p><b>지원서를 보냈습니다.</b></p>'
        + '<p>' + esc((o.org_name || '단체').trim()) + ' 에 전달되었습니다. 진행 상태는 <b>마이페이지</b>에서 보실 수 있습니다.</p>'
        + '<a class="rv-btn rv-btn--go" href="/account/mypage.html">마이페이지에서 보기</a></div>';
      if (send) send.hidden = true;
      var cn = el('#raCancel'); if (cn) cn.textContent = '닫기';
      var ab = el('#rvApply'); if (ab) { ab.textContent = '지원함'; ab.disabled = true; ab.classList.add('rv-btn--off'); }
    } catch (e) {
      var msg = String((e && e.message) || e);
      if (/duplicate key|recruit_applications_job_id_applicant_id_key/i.test(msg)) msg = '이미 지원하신 공고입니다. 마이페이지에서 확인해 주십시오.';
      else if (/row-level|policy/i.test(msg)) msg = '이 공고는 지금 지원을 받지 않습니다.';
      raSay('보내지 못했습니다 — ' + esc(msg), 'warn');
      if (send) { send.disabled = false; send.textContent = '지원서 보내기'; }
    }
    applyState.busy = false;
  }

  /* ── 오른쪽 목록 ─────────────────────────────────────────── */
  function bindList() {
    var list = el('#rcList');
    if (!list) return;
    list.addEventListener('click', function (e) {
      var a = e.target.closest('a[href*="id="]');
      if (!a) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      var m = a.getAttribute('href').match(/[?&]id=(\d+)/);
      if (!m) return;
      e.preventDefault();
      load(m[1], true);
    });
    window.addEventListener('popstate', function () {
      var id = new URLSearchParams(location.search).get('id');
      if (id) load(id, false);
    });
  }

  function init(options) {
    cfg = Object.assign({ kind: 'job' }, options || {});
    R = window.OFRecruit;
    if (!R) { console.error('assets/recruit.js 를 먼저 불러야 합니다.'); return; }
    var id = new URLSearchParams(location.search).get('id');
    if (!id) {
      var box = el('#rvDoc');
      if (box) box.innerHTML = '<div class="rv-empty">어느 정보를 보시려는지 알 수 없습니다.<br><a class="rv-lk" href="' + listHref() + '">목록으로 돌아가기</a></div>';
      return;
    }
    bindList();
    load(id, false);
  }

  window.OFRecruitView = { init: init, markCurrent: markCurrent, previewTalent: previewTalent, previewJob: previewJob, jobHtml: jobHtml };
})();
