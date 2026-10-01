/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 리쿠르트 공용 — assets/recruit.js · 2026-10-01
   ------------------------------------------------------------------
   오퍼스클램 assets/recruit.js 를 그대로 참고해 포팅했습니다. 담긴 것도
   같습니다 — 직종분류·지역·급여·학력·우대조건과, 목록·상세·등록 세
   화면이 함께 쓰는 도우미(보는 사람 판정 포함)입니다.

   바뀐 것
    · 직종분류 — 음악(오케스트라·합창단 등) 대신 미술 분야
      (미술관·박물관/갤러리·화랑/작가스튜디오/미술교육/미술시장·경매/
       디자인·출판/미술행정·단체)
    · 접속 — window.__ocSb 를 새로 만들지 않고 OF.sb() 싱글턴을 씁니다
      (멀티 GoTrueClient 경고를 피하려는 것 — cm-auth.js 와 같은 까닭)
    · 회원 표 — members 대신 community_members, 칸 이름도 다릅니다
    · 역할 — HIRING(공고등록·인재열람) org·school / SEEKER(인재등록) artist /
      INDIVIDUAL(공고지원) artist·general — 서버 쪽 of_is_hiring()·
      of_is_seeker()·of_is_individual() 과 짝입니다. 회원 종류 목록은
      이 세 줄에만 적습니다 — 다른 데 다시 적지 마십시오.

   지역·급여밴드·근무요일·근무시간 등은 미술 쪽도 다르지 않아 그대로
   가져왔습니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── 직종 분류 ──────────────────────────────────────────── */
  var JOBS = {
    '미술관·박물관': ['학예연구', '에듀케이터', '보존·복원', '전시기획', '행정·운영', '도슨트'],
    '갤러리·화랑':   ['큐레이터', '디렉터', '세일즈·아트딜러', '행정·운영'],
    '작가 스튜디오': ['스튜디오 어시스턴트', '작품 제작 테크니션', '아카이브 관리'],
    '미술교육':      ['입시미술 강사', '아동·청소년 미술 강사', '대학 강사', '실기 지도'],
    '미술시장·경매': ['경매 진행', '작품 감정', '물류·배송', '고객 응대'],
    '디자인·출판':   ['북 디자인', '도록·카탈로그 편집', '그래픽 디자인'],
    '미술행정·단체': ['레지던시 운영', '협회·재단 행정', '프로젝트 매니저'],
  };

  /* ── 지역 ───────────────────────────────────────────────── */
  var REGIONS = {
    '서울': ['강남구','강동구','강북구','강서구','관악구','광진구','구로구','금천구',
             '노원구','도봉구','동대문구','동작구','마포구','서대문구','서초구','성동구',
             '성북구','송파구','양천구','영등포구','용산구','은평구','종로구','중구','중랑구'],
    '부산': ['강서구','금정구','기장군','남구','동구','동래구','부산진구','북구',
             '사상구','사하구','서구','수영구','연제구','영도구','중구','해운대구'],
    '대구': ['남구','달서구','달성군','동구','북구','서구','수성구','중구','군위군'],
    '인천': ['강화군','계양구','미추홀구','남동구','동구','부평구','서구','연수구','옹진군','중구'],
    '광주': ['광산구','남구','동구','북구','서구'],
    '대전': ['대덕구','동구','서구','유성구','중구'],
    '울산': ['남구','동구','북구','중구','울주군'],
    '세종': ['세종시'],
    '경기': ['가평군','고양시','과천시','광명시','광주시','구리시','군포시','김포시',
             '남양주시','동두천시','부천시','성남시','수원시','시흥시','안산시','안성시',
             '안양시','양주시','양평군','여주시','연천군','오산시','용인시','의왕시',
             '의정부시','이천시','파주시','평택시','포천시','하남시','화성시'],
    '강원': ['강릉시','고성군','동해시','삼척시','속초시','양구군','양양군','영월군',
             '원주시','인제군','정선군','철원군','춘천시','태백시','평창군','홍천군',
             '화천군','횡성군'],
    '충북': ['괴산군','단양군','보은군','영동군','옥천군','음성군','제천시','진천군',
             '청주시','충주시','증평군'],
    '충남': ['계룡시','공주시','금산군','논산시','당진시','보령시','부여군','서산시',
             '서천군','아산시','예산군','천안시','청양군','태안군','홍성군'],
    '전북': ['고창군','군산시','김제시','남원시','무주군','부안군','순창군','완주군',
             '익산시','임실군','장수군','전주시','정읍시','진안군'],
    '전남': ['강진군','고흥군','곡성군','광양시','구례군','나주시','담양군','목포시',
             '무안군','보성군','순천시','신안군','여수시','영광군','영암군','완도군',
             '장성군','장흥군','진도군','함평군','해남군','화순군'],
    '경북': ['경산시','경주시','고령군','구미시','김천시','문경시','봉화군','상주시',
             '성주군','안동시','영덕군','영양군','영주시','영천시','예천군','울릉군',
             '울진군','의성군','청도군','청송군','칠곡군','포항시'],
    '경남': ['거제시','거창군','고성군','김해시','남해군','밀양시','사천시','산청군',
             '양산시','의령군','진주시','창녕군','창원시','통영시','하동군','함안군',
             '함양군','합천군'],
    '제주': ['제주시','서귀포시'],
    '해외': ['미국','독일','오스트리아','프랑스','이탈리아','영국','러시아','일본',
             '중국','그 밖'],
  };

  var EMP_SEARCH = ['무관', '정규직', '계약직', '프리랜서', '개인레슨'];
  var EMP_TYPES  = ['정규직', '계약직', '프리랜서', '개인레슨', '아르바이트', '인턴', '병역특례'];
  var PAY_TYPES = ['협의', '연봉', '월급', '주급', '일급', '시급', '건당'];
  var PAY_BANDS = [
    { label: '급여별',          min: null, max: null },
    { label: '2000만원 미만',   min: 0,    max: 2000 },
    { label: '2000~2400만원',   min: 2000, max: 2400 },
    { label: '2400~2800만원',   min: 2400, max: 2800 },
    { label: '2800~3400만원',   min: 2800, max: 3400 },
    { label: '3400~3800만원',   min: 3400, max: 3800 },
    { label: '3800만원 이상',   min: 3800, max: null },
    { label: '회사내규·협의',   min: null, max: null },
  ];
  var EDU = ['학력무관', '고졸 이상', '전문대졸 이상', '대졸 이상', '석사 이상', '박사 이상'];
  var PREFER = [
    '국가유공자', '보훈대상', '고용촉진장려금대상', '장애인',
    '영어가능자', '일본어가능자', '중국어가능자', '독일어가능자',
    '프랑스어가능자', '스페인어가능자', '러시아어가능자',
    '국내외 공모전·비엔날레 입상자', '해외연수자', '프레젠테이션능력우수자',
    '포토샵·일러스트레이터 활용자', '해외근무가능자', '병역특례',
    '엑셀고급능력보유자', '학점우수자',
  ];
  var WORK_DAYS = ['협의', '월~금', '월~토', '주 2일', '주 3일', '주 4일',
                   '주말(토·일)', '토요일', '일요일', '요일협의', '교대근무'];
  var HOURS = (function () {
    var out = ['협의'];
    for (var h = 6; h <= 23; h++) {
      out.push((h < 10 ? '0' : '') + h + ':00');
      out.push((h < 10 ? '0' : '') + h + ':30');
    }
    return out;
  })();
  var GENDERS      = ['무관', '남성', '여성'];
  var NOW_STATUS   = ['구직중 (구직희망)', '재직중 (이직희망)'];
  var AUDITION     = ['없음 / 서류전형', '있음'];
  var APPLY_METHOD = ['이메일', '직접방문', '전화', '팩스', '당사홈페이지'];
  var SORTS = [
    { value: 'created_at.desc',        label: '최신순' },
    { value: 'apply_to.asc.nullslast', label: '마감순' },
    { value: 'view_count.desc',        label: '조회순' },
  ];

  /* ============================================================
     도우미 — 셀렉트를 채우고 서로 이어 줍니다
     ============================================================ */
  function opt(v, t) {
    var o = document.createElement('option');
    o.value = v; o.textContent = (t == null ? v : t);
    return o;
  }
  function fill(el, items, placeholder) {
    if (!el) return;
    el.innerHTML = '';
    if (placeholder) el.appendChild(opt('', placeholder));
    (items || []).forEach(function (x) {
      if (x && typeof x === 'object') el.appendChild(opt(x.value, x.label));
      else el.appendChild(opt(x));
    });
  }
  function fillJobCat1(el, placeholder) { fill(el, Object.keys(JOBS), placeholder || '1차분야선택'); }
  function fillJobCat2(el, cat1, placeholder) { fill(el, JOBS[cat1] || [], placeholder || '2차분야선택'); }
  function fillRegion1(el, placeholder) { fill(el, Object.keys(REGIONS), placeholder || '1차지역선택'); }
  function fillRegion2(el, r1, placeholder) { fill(el, REGIONS[r1] || [], placeholder || '2차지역선택'); }

  function bindPair(sel1, sel2, kind, placeholder1, placeholder2) {
    var a = typeof sel1 === 'string' ? document.querySelector(sel1) : sel1;
    var b = typeof sel2 === 'string' ? document.querySelector(sel2) : sel2;
    if (!a || !b) return;
    var isJob = (kind !== 'region');
    (isJob ? fillJobCat1 : fillRegion1)(a, placeholder1);
    (isJob ? fillJobCat2 : fillRegion2)(b, '', placeholder2);
    a.addEventListener('change', function () {
      (isJob ? fillJobCat2 : fillRegion2)(b, a.value, placeholder2);
    });
  }

  function fillChecks(el, items, name) {
    if (!el) return;
    el.innerHTML = '';
    (items || []).forEach(function (x, i) {
      var id = name + '-' + i;
      var wrap = document.createElement('label');
      wrap.className = 'rc-check';
      wrap.setAttribute('for', id);
      var cb = document.createElement('input');
      cb.type = 'checkbox'; cb.id = id; cb.name = name; cb.value = x;
      var sp = document.createElement('span');
      sp.textContent = x;
      wrap.appendChild(cb); wrap.appendChild(sp);
      el.appendChild(wrap);
    });
  }
  function checked(scope, name) {
    var root = (typeof scope === 'string' ? document.querySelector(scope) : scope) || document;
    return [].slice.call(root.querySelectorAll('input[name="' + name + '"]:checked'))
             .map(function (x) { return x.value; });
  }
  function fillRadios(el, items, name, checkedValue) {
    if (!el) return;
    el.innerHTML = '';
    (items || []).forEach(function (x, i) {
      var id = name + '-r' + i;
      var wrap = document.createElement('label');
      wrap.className = 'rc-check';
      wrap.setAttribute('for', id);
      var rb = document.createElement('input');
      rb.type = 'radio'; rb.id = id; rb.name = name; rb.value = x;
      if (x === checkedValue || (!checkedValue && i === 0)) rb.checked = true;
      var sp = document.createElement('span');
      sp.textContent = x;
      wrap.appendChild(rb); wrap.appendChild(sp);
      el.appendChild(wrap);
    });
  }

  /* ── 보여 줄 때 쓰는 도우미 ───────────────────────────────*/
  function jobLabel(cat1, cat2, etc) {
    var a = [];
    if (cat1) a.push(cat1);
    if (cat2) a.push(cat2);
    var s = a.join(' › ');
    if (etc) s = s ? s + ' (' + etc + ')' : etc;
    return s;
  }
  function regionLabel(r1, r2) { return [r1, r2].filter(Boolean).join(' › '); }
  function payLabel(type, amount, daily) {
    if (!type && !amount) return '';
    var s = '';
    if (type && type !== '협의') s = type;
    if (amount) s = s ? s + ' ' + amount : amount;
    if (!s) s = '협의';
    if (daily) s += ' · 당일지급';
    return s;
  }
  function applyLines(from, to, always, untilHired) {
    if (always) return { top: '상시모집', bottom: '' };
    if (untilHired) return { top: '채용시까지', bottom: '' };
    var d = function (v) { return String(v || '').slice(0, 10).replace(/-/g, '.'); };
    var a = d(from), b = d(to);
    if (a && b) {
      if (b.slice(0, 4) !== a.slice(0, 4)) return { top: a.slice(2), bottom: '~ ' + b.slice(2) };
      return { top: a, bottom: '~ ' + b.slice(5) };
    }
    if (b) return { top: '마감', bottom: b };
    if (a) return { top: a, bottom: '~ 계속' };
    return { top: '상시모집', bottom: '' };
  }
  function applyLabel(from, to, always, untilHired) {
    if (always) return '상시모집';
    if (untilHired) return '채용시까지';
    var d = function (v) { return String(v || '').slice(0, 10).replace(/-/g, '.'); };
    var a = d(from), b = d(to);
    if (a && b) return a + ' ~ ' + b;
    if (b) return '~ ' + b;
    if (a) return a + ' ~';
    return '상시모집';
  }

  function toDate(v) {
    if (!v) return null;
    var s = String(v);
    s = s.replace(/(\.\d{3})\d+/, '$1');
    var d = new Date(s);
    if (isNaN(d.getTime())) d = new Date(s.replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d;
  }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function stampShort(v) {
    var d = toDate(v); if (!d) return '';
    return p2(d.getFullYear() % 100) + '.' + p2(d.getMonth() + 1) + '.' + p2(d.getDate());
  }
  function stampDate(v) {
    var d = toDate(v); if (!d) return '';
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  }
  function stampFull(v) {
    var d = toDate(v); if (!d) return '';
    return stampDate(v) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  function isToday(v) {
    var d = toDate(v); if (!d) return false;
    var n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }
  function daysLeft(to) {
    if (!to) return null;
    var end = new Date(String(to).slice(0, 10) + 'T23:59:59');
    if (isNaN(end)) return null;
    return Math.ceil((end - new Date()) / 86400000);
  }

  /* ============================================================
     보는 사람 확인

     ★ 회원 종류 목록은 이 세 줄에만 적습니다 — 서버 쪽
       of_is_hiring()·of_is_seeker()·of_is_individual() 과 짝입니다.
     ============================================================ */
  var HIRING     = ['org', 'school'];
  var SEEKER     = ['artist'];
  var INDIVIDUAL = ['artist', 'general'];

  function roleOf(m) {
    m = m || {};
    var type  = m.member_type || '';
    var st    = m.status || '';
    var admin = !!m.is_admin;
    var ok    = admin || st === 'approved';
    function can(list) { return admin || (list.indexOf(type) >= 0 && ok); }
    return {
      type: type, status: st, admin: admin, approved: ok,
      hiring:     can(HIRING),
      seeker:     can(SEEKER),
      individual: can(INDIVIDUAL),
      hiringType:     admin || HIRING.indexOf(type) >= 0,
      seekerType:     admin || SEEKER.indexOf(type) >= 0,
      individualType: admin || INDIVIDUAL.indexOf(type) >= 0,
      waiting:  !admin && st === 'pending',
      refused:  !admin && st === 'rejected',
      quit:     !admin && st === 'withdrawn'
    };
  }

  function gateMsg(role, need) {
    var WHO = {
      hiring:     '<b>미술관계자 · 단체 · 기관</b> 또는 <b>미술학교</b>',
      seeker:     '<b>작가</b>',
      individual: '<b>작가</b> 또는 <b>일반</b>'
    };
    var LIST = { hiring: HIRING, seeker: SEEKER, individual: INDIVIDUAL };
    var list = LIST[need] || [];
    var typeOk = list.indexOf(role.type) >= 0;

    if (!typeOk) {
      return { why: 'type', msg: WHO[need] + ' 회원에게 열려 있습니다.', note: role.type ? '지금 회원 종류 — ' + role.type : '' };
    }
    if (role.waiting) {
      return { why: 'waiting', msg: '<b>자격 심사 중</b>입니다. 관리자 승인이 끝나면 바로 이용하실 수 있습니다.', note: '회원 종류는 맞습니다 — ' + role.type + ' · 승인 대기' };
    }
    if (role.refused) {
      return { why: 'refused', msg: '가입 자격 심사에서 <b>반려</b>된 계정입니다. 문의해 주시면 다시 살펴보겠습니다.', note: role.type + ' · 반려' };
    }
    if (role.quit) {
      return { why: 'quit', msg: '탈퇴 처리된 계정입니다.', note: '' };
    }
    return { why: 'unknown', msg: WHO[need] + ' 회원에게 열려 있습니다.', note: '회원 종류는 맞습니다. 서버 권한 설정 문제일 수 있으니 관리자에게 알려 주십시오.' };
  }

  /* 지금 보는 사람 — OF.sb() 싱글턴으로 물어보고 기억해 둡니다.
     ★ 여기서 새 클라이언트를 만들지 않습니다 — cm-auth.js 와 같은
       window.__ofSb 를 함께 씁니다(멀티 GoTrueClient 경고 예방). */
  var _viewer = null, _viewerPromise = null;

  function viewer() {
    if (_viewer) return Promise.resolve(_viewer);
    if (_viewerPromise) return _viewerPromise;

    _viewerPromise = (async function () {
      var out = { user: null, token: '', type: '', status: '', admin: false,
                  role: roleOf(null), canSeeTalents: false };
      if (!window.OF || !OF.sb) { _viewer = out; return out; }
      try {
        var c = await OF.sb();
        if (!c) { _viewer = out; return out; }
        var r = await c.auth.getSession();
        var ss = r.data && r.data.session;
        if (!ss || !ss.user) { _viewer = out; return out; }
        out.user = ss.user;
        out.token = ss.access_token || '';
        var mr = await c.from('community_members').select('*').eq('id', ss.user.id).maybeSingle();
        var m = mr.data || {};
        out.type = m.member_type || '';
        out.admin = !!m.is_admin;
        out.status = m.status || '';
        out.role = roleOf(m);
        out.canSeeTalents = out.role.hiring;
      } catch (e) { /* 못 물어봐도 손님으로 둡니다 */ }
      _viewer = out;
      return out;
    })();

    return _viewerPromise;
  }

  function resetViewer() { _viewer = null; _viewerPromise = null; }

  async function headers(extra) {
    var v = await viewer();
    var t = v.token || (window.OF ? OF.SB_KEY : '');
    var key = window.OF ? OF.SB_KEY : '';
    return Object.assign({ apikey: key, Authorization: 'Bearer ' + t }, extra || {});
  }

  window.OFRecruit = {
    JOBS: JOBS, REGIONS: REGIONS,
    EMP_SEARCH: EMP_SEARCH, EMP_TYPES: EMP_TYPES,
    PAY_TYPES: PAY_TYPES, PAY_BANDS: PAY_BANDS,
    EDU: EDU, PREFER: PREFER,
    WORK_DAYS: WORK_DAYS, HOURS: HOURS,
    GENDERS: GENDERS, NOW_STATUS: NOW_STATUS,
    AUDITION: AUDITION, APPLY_METHOD: APPLY_METHOD, SORTS: SORTS,
    fill: fill, opt: opt,
    fillJobCat1: fillJobCat1, fillJobCat2: fillJobCat2,
    fillRegion1: fillRegion1, fillRegion2: fillRegion2,
    bindPair: bindPair,
    fillChecks: fillChecks, fillRadios: fillRadios, checked: checked,
    HIRING: HIRING, SEEKER: SEEKER, INDIVIDUAL: INDIVIDUAL,
    roleOf: roleOf, gateMsg: gateMsg,
    viewer: viewer, resetViewer: resetViewer, headers: headers,
    jobLabel: jobLabel, regionLabel: regionLabel,
    payLabel: payLabel, applyLabel: applyLabel, applyLines: applyLines,
    daysLeft: daysLeft,
    toDate: toDate, stampShort: stampShort, stampDate: stampDate,
    stampFull: stampFull, isToday: isToday,
  };
})();
