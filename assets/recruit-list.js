/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 리쿠르트 목록 엔진 · assets/recruit-list.js · 2026-10-01
   ------------------------------------------------------------------
   오퍼스클램 assets/recruit-list.js 를 참고해 포팅했습니다. 채용·인재
   목록이 같은 엔진을 설정만 달리해서 씁니다 — 직종 2단 분류, 지역,
   근무형태, 급여대, 검색, 정렬, 쪽넘김을 모두 담습니다.
   표 대신 오퍼스파인의 카드형 줄(.rc-row)로 그립니다.

   쓰는 법
     OFRecruitList.init({ kind:'job', table:'recruit_jobs',
       viewPage:'/recruit/job-view.html', writePage:'/recruit/job-write.html' })
   ══════════════════════════════════════════════════════════════════ */
window.OFRecruitList = (function () {
  'use strict';
  var R, cfg, cur = 1, total = 0, PER = 15;
  var q = { jobs: [], r1: '', r2: '', emps: [], days: '', gender: '', kw: '', sort: 'created_at.desc' };

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(s) { return document.querySelector(s); }

  async function fetchRows(from, size) {
    var p = ['select=*'];
    if (cfg.kind === 'job') p.push('hidden=eq.false');
    if (q.jobs.length) {
      var terms = q.jobs.map(function (v) {
        var a = v.split('|');
        return a[1] ? 'and(cat1.eq.' + encodeURIComponent(a[0]) + ',cat2.eq.' + encodeURIComponent(a[1]) + ')'
                    : 'cat1.eq.' + encodeURIComponent(a[0]);
      });
      p.push('or=(' + terms.join(',') + ')');
    }
    if (q.r1) p.push('region1=eq.' + encodeURIComponent(q.r1));
    if (q.r2) p.push('region2=eq.' + encodeURIComponent(q.r2));
    if (q.emps.length) p.push('emp_types=ov.%7B' + q.emps.map(encodeURIComponent).join(',') + '%7D');
    if (q.days) p.push('work_days=eq.' + encodeURIComponent(q.days));
    if (q.gender) p.push('gender=eq.' + encodeURIComponent(q.gender));
    if (q.kw) {
      var k = encodeURIComponent('%' + q.kw + '%');
      var cols = (cfg.kind === 'job') ? ['title', 'org_name', 'duty', 'body', 'keywords'] : ['title', 'career', 'body'];
      p.push('or=(' + cols.map(function (c) { return c + '.ilike.' + k; }).join(',') + ')');
    }
    p.push('order=' + (cfg.kind === 'job' ? 'is_pinned.desc,' : '') + (q.sort || 'created_at.desc'));
    p.push('limit=' + size);
    p.push('offset=' + from);

    var h = await R.headers({ Prefer: 'count=exact' });
    var res = await fetch(OF.SB_URL + '/rest/v1/' + cfg.table + '?' + p.join('&'), { headers: h });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var cr = res.headers.get('content-range') || '';
    var m = cr.match(/\/(\d+)$/);
    if (m) total = Number(m[1]);
    return await res.json();
  }

  function drawJobTree() {
    var box = el('#rcCats');
    if (!box) return;
    var h = '';
    Object.keys(R.JOBS).forEach(function (c1, ri) {
      var mine = R.JOBS[c1].map(function (c2) { return c1 + '|' + c2; });
      var allOn = mine.every(function (v) { return q.jobs.indexOf(v) >= 0; });
      h += '<div class="rc-jobrow">'
        + '<button type="button" class="rc-job1' + (allOn ? ' on' : '') + '" data-all="' + esc(c1) + '">' + esc(c1) + '</button>'
        + '<div class="rc-job2">';
      R.JOBS[c1].forEach(function (c2, i) {
        var v = c1 + '|' + c2, on = q.jobs.indexOf(v) >= 0, id = 'rcjob-' + ri + '-' + i;
        h += '<label class="rc-jobck" for="' + id + '"><input type="checkbox" id="' + id + '" value="' + esc(v) + '"' + (on ? ' checked' : '') + '><span>' + esc(c2) + '</span></label>';
      });
      h += '</div></div>';
    });
    box.innerHTML = h;
  }

  function bindJobTree() {
    var box = el('#rcCats');
    if (!box) return;
    box.addEventListener('change', function (e) {
      var cb = e.target; if (cb.type !== 'checkbox') return;
      var at = q.jobs.indexOf(cb.value);
      if (cb.checked && at < 0) q.jobs.push(cb.value);
      if (!cb.checked && at >= 0) q.jobs.splice(at, 1);
      drawJobTree(); go(1);
    });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-all]'); if (!b) return;
      var c1 = b.getAttribute('data-all');
      var mine = R.JOBS[c1].map(function (c2) { return c1 + '|' + c2; });
      var allOn = mine.every(function (v) { return q.jobs.indexOf(v) >= 0; });
      if (allOn) q.jobs = q.jobs.filter(function (v) { return mine.indexOf(v) < 0; });
      else mine.forEach(function (v) { if (q.jobs.indexOf(v) < 0) q.jobs.push(v); });
      drawJobTree(); go(1);
    });
  }

  function drawFinderFields() {
    R.bindPair('#rcR1', '#rcR2', 'region');
    R.fill(el('#rcDays'), R.WORK_DAYS, '근무요일');
    R.fillChecks(el('#rcEmp'), R.EMP_SEARCH.filter(function (t) { return t !== '무관'; }), 'rc-emp');
    if (cfg.kind === 'talent') {
      R.fillRadios(el('#rcGender'), ['', '남성', '여성'].map(function (g) { return g || '전체'; }), 'rc-gender');
      var box = el('#rcGender');
      if (box) [].forEach.call(box.querySelectorAll('input'), function (r, i) { r.value = ['', '남성', '여성'][i]; if (i === 0) r.checked = true; });
    }
    var go2 = el('#rcGo'), reset = el('#rcReset');
    if (go2) go2.addEventListener('click', function () {
      q.r1 = (el('#rcR1') || {}).value || '';
      q.r2 = (el('#rcR2') || {}).value || '';
      q.days = (el('#rcDays') || {}).value || '';
      q.emps = R.checked('#rcEmp', 'rc-emp');
      var g = document.querySelector('input[name="rc-gender"]:checked');
      q.gender = g ? g.value : '';
      go(1);
    });
    if (reset) reset.addEventListener('click', function () {
      q = { jobs: [], r1: '', r2: '', emps: [], days: '', gender: '', kw: q.kw, sort: q.sort };
      ['#rcR1', '#rcR2', '#rcDays'].forEach(function (s) { var x = el(s); if (x) x.value = ''; });
      [].forEach.call(document.querySelectorAll('input[name="rc-emp"]'), function (x) { x.checked = false; });
      var g0 = document.querySelector('input[name="rc-gender"][value=""]'); if (g0) g0.checked = true;
      drawJobTree(); go(1);
    });
  }

  function drawToolbar() {
    var sort = el('#rcSort');
    if (sort) {
      var sorts = R.SORTS.filter(function (s) { return cfg.kind === 'job' || s.value.indexOf('apply_') < 0; });
      R.fill(sort, sorts, null);
      sort.value = q.sort;
      sort.addEventListener('change', function () { q.sort = sort.value; go(1); });
    }
    var kw = el('#rcKw'), btn = el('#rcSearchBtn');
    function doSearch() { q.kw = (kw ? kw.value : '').trim(); go(1); }
    if (btn) btn.addEventListener('click', doSearch);
    if (kw) kw.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });
  }

  function mountWriteGate() {
    var el2 = el('#rcWritegate');
    if (!el2) return;
    R.viewer().then(function (v) {
      var need = cfg.kind === 'job' ? 'hiring' : 'seeker';
      if (!v.user) {
        el2.innerHTML = '<a class="btn sm" href="/account/login.html?next=' + encodeURIComponent(location.pathname) + '">로그인 후 글쓰기</a>';
        return;
      }
      if (v.role && v.role[need]) {
        el2.innerHTML = '<a class="btn sm" href="' + cfg.writePage + '">' + (cfg.kind === 'job' ? '채용정보 등록' : '인재정보 등록') + '</a>';
        return;
      }
      var g = R.gateMsg(v.role, need);
      el2.innerHTML = '<span class="rw-hint" style="margin:0">' + g.msg + '</span>';
    });
  }

  function row(o, no) {
    var vp = cfg.viewPage + '?id=' + encodeURIComponent(o.id);
    if (cfg.kind === 'job') {
      var lines = R.applyLines(o.apply_from, o.apply_to, o.apply_always, o.apply_until_hired);
      var left = R.daysLeft(o.apply_to);
      var dday = (left != null && left >= 0 && left <= 7) ? '<span class="rc-dday">D-' + left + '</span>' : '';
      var bits = (o.emp_types || []).slice(0, 2).concat([R.regionLabel(o.region1, o.region2), R.payLabel(o.pay_type, o.pay_amount, o.pay_daily)]).filter(Boolean);
      return '<a class="rc-row' + (o.is_pinned ? ' pin' : '') + '" href="' + vp + '">'
        + '<span class="rc-row-no">' + no + '</span>'
        + '<span class="rc-row-main">'
        +   '<span class="rc-row-head">' + (o.is_pinned ? '<span class="rc-tag pin">고정</span>' : '') + '<span class="rc-row-org">' + esc(o.org_name || '') + '</span></span>'
        +   '<span class="rc-row-title">' + esc(o.title || '') + '</span>'
        +   (bits.length ? '<span class="rc-row-sub">' + bits.map(esc).join(' · ') + '</span>' : '')
        + '</span>'
        + '<span class="rc-row-when">' + esc(lines.top) + (lines.bottom ? '<br>' + esc(lines.bottom) : '') + dday + '</span>'
        + '<span class="rc-row-hit">조회 ' + (o.view_count || 0) + '</span>'
        + '</a>';
    }
    var g = String(o.gender || '').replace('남성', '남').replace('여성', '여');
    var who = (o.name_masked || '') + ' [' + (g || '-') + (o.age ? ' / ' + o.age + '세' : '') + ']';
    var bits2 = [R.jobLabel(o.cat1, o.cat2, o.job_etc), R.regionLabel(o.region1, o.region2), (o.now_status || '').split(' (')[0]].filter(Boolean);
    return '<a class="rc-row" href="' + vp + '">'
      + '<span class="rc-row-no">' + no + '</span>'
      + '<span class="rc-row-main">'
      +   '<span class="rc-row-head"><span class="rc-row-org">' + esc(who) + '</span></span>'
      +   '<span class="rc-row-title">' + esc(o.title || '') + '</span>'
      +   (bits2.length ? '<span class="rc-row-sub">' + bits2.map(esc).join(' · ') + '</span>' : '')
      + '</span>'
      + '<span class="rc-row-when">' + R.stampShort(o.created_at) + '</span>'
      + '<span class="rc-row-hit">조회 ' + (o.view_count || 0) + '</span>'
      + '</a>';
  }

  function drawPager() {
    var box = el('#rcPager');
    if (!box) return;
    var pages = Math.max(1, Math.ceil(total / PER));
    if (pages <= 1) { box.innerHTML = ''; return; }
    var from = Math.max(1, cur - 2), to = Math.min(pages, from + 4);
    from = Math.max(1, to - 4);
    var h = '<button type="button" data-p="' + Math.max(1, cur - 1) + '"' + (cur === 1 ? ' disabled' : '') + '>‹</button>';
    for (var p = from; p <= to; p++) h += '<button type="button" class="' + (p === cur ? 'on' : '') + '" data-p="' + p + '">' + p + '</button>';
    h += '<button type="button" data-p="' + Math.min(pages, cur + 1) + '"' + (cur === pages ? ' disabled' : '') + '>›</button>';
    box.innerHTML = h;
  }

  async function gateTalent() {
    if (cfg.kind !== 'talent') return true;
    var list = el('#rcList');
    var v = await R.viewer();
    if (v.canSeeTalents) return true;
    var msg, act;
    if (!v.user) {
      msg = '인재정보는 회원만 볼 수 있습니다.';
      act = '<a class="rc-row" style="display:inline-flex;padding:8px 16px" href="/account/login.html?next=' + encodeURIComponent(location.pathname) + '">로그인하기 →</a>';
    } else {
      var g = R.gateMsg(v.role || R.roleOf(null), 'hiring');
      msg = (g.why === 'type' ? '인재정보 열람은 ' : '') + g.msg + (g.why === 'type' ? '<br>작가·일반 회원께는 <b>본인이 등록한 인재정보</b>만 보입니다.' : '');
    }
    if (list) list.innerHTML = '<div class="rc-gate"><p>' + msg + '</p>' + (act || '') + '</div>';
    var cnt = el('#rcCnt'); if (cnt) cnt.innerHTML = '채용 회원 전용';
    var pager = el('#rcPager'); if (pager) pager.innerHTML = '';
    return false;
  }

  async function go(page) {
    cur = page || 1;
    var list = el('#rcList');
    if (!list) return;
    list.innerHTML = '<div class="rc-empty">불러오는 중…</div>';
    if (!(await gateTalent())) return;

    var rows;
    try { rows = await fetchRows((cur - 1) * PER, PER); }
    catch (e) { list.innerHTML = '<div class="rc-empty">자료를 불러오지 못했습니다.</div>'; return; }

    var cnt = el('#rcCnt');
    if (cnt) cnt.innerHTML = '전체 <b>' + total.toLocaleString() + '</b>건';

    if (!rows || !rows.length) {
      list.innerHTML = '<div class="rc-empty">' + (q.jobs.length || q.kw || q.r1 ? '조건에 맞는 정보가 없습니다.' : (cfg.kind === 'job' ? '등록된 채용정보가 아직 없습니다.' : '등록된 인재정보가 아직 없습니다.')) + '</div>';
      drawPager();
      return;
    }
    var base = total - (cur - 1) * PER;
    list.innerHTML = rows.map(function (o, i) { return row(o, base - i); }).join('');
    drawPager();
  }

  function seedFromUrl() {
    var p = new URLSearchParams(location.search);
    var c1 = p.get('cat1'), c2 = p.get('cat2');
    if (c1 && R.JOBS[c1]) q.jobs = (c2 && R.JOBS[c1].indexOf(c2) >= 0) ? [c1 + '|' + c2] : R.JOBS[c1].map(function (x) { return c1 + '|' + x; });
    var r1 = p.get('r1'), r2 = p.get('r2');
    if (r1 && R.REGIONS[r1]) { q.r1 = r1; if (r2 && (R.REGIONS[r1] || []).indexOf(r2) >= 0) q.r2 = r2; }
    var kw = p.get('kw'); if (kw) q.kw = kw;
  }
  function reflectUrl() {
    var r1 = el('#rcR1'), kw = el('#rcKw');
    if (r1 && q.r1) { r1.value = q.r1; r1.dispatchEvent(new Event('change')); var r2 = el('#rcR2'); if (r2 && q.r2) r2.value = q.r2; }
    if (kw && q.kw) kw.value = q.kw;
  }

  function init(options) {
    cfg = Object.assign({ kind: 'job', pageSize: 15 }, options || {});
    PER = cfg.pageSize;
    R = window.OFRecruit;
    if (!R) { console.error('assets/recruit.js 를 먼저 불러야 합니다.'); return; }
    seedFromUrl();
    drawJobTree(); bindJobTree();
    drawFinderFields(); drawToolbar(); mountWriteGate();
    reflectUrl();
    var pager = el('#rcPager');
    if (pager) pager.addEventListener('click', function (e) {
      var b = e.target.closest('[data-p]'); if (!b || b.disabled) return;
      go(Number(b.getAttribute('data-p')));
      var top = el('#rcList'); if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    go(1);
  }

  return { init: init };
})();
