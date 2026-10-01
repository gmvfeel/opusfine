/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 리쿠르트 등록 엔진 — assets/recruit-write.js · 2026-10-01
   ------------------------------------------------------------------
   오퍼스클램 assets/recruit-write.js 를 참고해 포팅했습니다. 채용등록·
   인재등록 두 화면이 이 한 엔진을 설정만 달리해서 씁니다.

   담은 것
    · 분류·지역·급여 등 셀렉트 채우기 (recruit.js 의 자료를 씁니다)
    · 단체DB(전시공간) / 학교DB 찾아 잇기 — 찾아 고르면 id 가 함께 담깁니다
    · 사진 올리기 — 캔버스로 긴 쪽 800px JPEG 로 줄여 recruit-photos 에 올립니다
    · 임시저장(초안) — recruit_drafts 에 upsert, 불러오면 묻고 채웁니다
    · 작성 도우미 — 꼭 채울 것 진행률, 내가 등록한 글 목록
    · 미리보기 — assets/recruit-view.js 의 jobHtml/talentHtml 를 그대로 씁니다
      (상세 화면과 같은 코드라 미리보기와 실제가 어긋나지 않습니다)
    · 게시하기 / 고치기 — recruit_jobs · recruit_talents 에 insert/update

   쓰는 법
     OFRecruitWrite.initJob({ listPage:'/recruit/job.html', viewPage:'/recruit/job-view.html' });
     OFRecruitWrite.initTalent({ listPage:'/recruit/talent.html', viewPage:'/recruit/talent-view.html' });
   ══════════════════════════════════════════════════════════════════ */
window.OFRecruitWrite = (function () {
  'use strict';
  var R, V, cfg, me = null, editId = null, draftId = null, schools = [], auditionItems = [], photoUrl = '';

  function el(s) { return document.querySelector(s); }
  function val(s) { var e = el(s); return e ? e.value : ''; }
  function setVal(s, v) { var e = el(s); if (e) e.value = (v == null ? '' : v); }
  function chk(s) { var e = el(s); return !!(e && e.checked); }
  function setChk(s, v) { var e = el(s); if (e) e.checked = !!v; }

  async function sbReady() { await OF.sb(); return window.__ofSb; }

  function msg(text, cls) {
    var m = el('#rwMsg');
    if (!m) return;
    if (!text) { m.hidden = true; return; }
    m.hidden = false; m.textContent = text; m.className = 'rw-msg' + (cls ? ' rw-' + cls : '');
    m.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ============================================================
     보는 사람 자격 — 채용등록은 hiring, 인재등록은 seeker 만
     ============================================================ */
  async function gateOrDie() {
    var v = await R.viewer();
    var need = cfg.kind === 'job' ? 'hiring' : 'seeker';
    if (!v.user) {
      location.href = '/account/login.html?next=' + encodeURIComponent(location.pathname + location.search);
      return false;
    }
    if (!v.role[need]) {
      var g = R.gateMsg(v.role, need);
      var form = el('#rwForm');
      if (form) form.innerHTML = '<div class="rv-empty">' + g.msg + (g.note ? '<br><span class="rv-dim">' + g.note + '</span>' : '') + '</div>';
      var aside = el('#rwAside'); if (aside) aside.hidden = true;
      return false;
    }
    me = v.user;
    return true;
  }

  /* ============================================================
     셀렉트·체크 채우기
     ============================================================ */
  function fillCommon() {
    R.bindPair('#rwCat1', '#rwCat2', 'job');
    R.bindPair('#rwR1', '#rwR2', 'region');
    R.fill(el('#rwPayType'), R.PAY_TYPES, null);
  }

  function fillJob() {
    fillCommon();
    R.fill(el('#rwDays'), R.WORK_DAYS, null);
    R.fillChecks(el('#rwEmp'), R.EMP_TYPES, 'rw-emp');
    R.fill(el('#rwStart'), R.HOURS, null);
    R.fill(el('#rwEnd'), R.HOURS, null);
    R.fillRadios(el('#rwGenderBox'), R.GENDERS, 'rw-gender');
    R.fill(el('#rwEdu'), R.EDU, null);
    R.fillChecks(el('#rwPrefer'), R.PREFER, 'rw-prefer');
    R.fillRadios(el('#rwAud'), R.AUDITION, 'rw-aud');
    R.fillChecks(el('#rwMethods'), R.APPLY_METHOD, 'rw-methods');

    var ageAny = el('#rwAgeAny'), eduAny = el('#rwEduAny');
    function syncAge() { ['#rwAgeMin', '#rwAgeMax'].forEach(function (s) { var e = el(s); if (e) e.disabled = ageAny.checked; }); }
    function syncEdu() { var e = el('#rwEdu'); if (e) e.disabled = eduAny.checked; }
    if (ageAny) { ageAny.addEventListener('change', syncAge); syncAge(); }
    if (eduAny) { eduAny.addEventListener('change', syncEdu); syncEdu(); }

    var always = el('#rwAlways'), until = el('#rwUntilHired');
    function syncApply() {
      var off = (always && always.checked) || (until && until.checked);
      ['#rwApplyFrom', '#rwApplyTo'].forEach(function (s) { var e = el(s); if (e) e.disabled = off; });
    }
    if (always) always.addEventListener('change', function () { if (always.checked && until) until.checked = false; syncApply(); });
    if (until) until.addEventListener('change', function () { if (until.checked && always) always.checked = false; syncApply(); });
    syncApply();

    var site = el('#rwAcceptSite');
    function syncSite() { var h = el('#rwSiteHint'); if (h) h.style.opacity = site.checked ? '.6' : '1'; }
    if (site) { site.addEventListener('change', syncSite); syncSite(); }

    bindAuditionItems();
    bindOrgFind();
  }

  function fillTalent() {
    fillCommon();
    R.fillChecks(el('#rwEmp'), R.EMP_TYPES, 'rw-emp');
    R.fillRadios(el('#rwStatus'), R.NOW_STATUS, 'rw-status');
    R.fillRadios(el('#rwGenderBox'), ['남성', '여성'], 'rw-gender');
    R.fillRadios(el('#rwVet'), ['해당없음', '보훈대상'], 'rw-vet');
    R.fillRadios(el('#rwDis'), ['해당없음', '장애'], 'rw-dis');
    R.fill(el('#rwDisGrade'), ['1급', '2급', '3급', '4급', '5급', '6급'], '등급선택');
    R.fillRadios(el('#rwMil'), ['해당없음', '군필', '면제', '미필'], 'rw-mil');
    var years = []; for (var y = new Date().getFullYear(); y >= 1950; y--) years.push(String(y));
    R.fill(el('#rwBy'), years, '년');
    R.fill(el('#rwBm'), Array.from({ length: 12 }, function (_, i) { return String(i + 1); }), '월');
    R.fill(el('#rwBd'), Array.from({ length: 31 }, function (_, i) { return String(i + 1); }), '일');
    R.fill(el('#rwMilFrom'), years, '년');
    R.fill(el('#rwMilTo'), years, '년');

    var telSame = el('#rwTelSame');
    if (telSame) telSame.addEventListener('change', function () { if (telSame.checked) setVal('#rwTel', val('#rwPhone')); });

    bindSchoolRows();
    bindPhoto();
  }

  /* ============================================================
     오디션/과제물 — 여러 줄 입력, 추가/삭제
     ============================================================ */
  function drawAuditionItems() {
    var box = el('#rwAudList');
    if (!box) return;
    box.innerHTML = auditionItems.map(function (v, i) {
      return '<span class="rw-inline"><textarea rows="1" data-i="' + i + '" placeholder="곡명 · 과제물 하나">' + (v || '').replace(/</g, '&lt;') + '</textarea>'
        + '<button type="button" class="rw-school-del" data-del="' + i + '">삭제</button></span>';
    }).join('');
  }
  function bindAuditionItems() {
    drawAuditionItems();
    var addBtn = el('#rwAudAdd');
    if (addBtn) addBtn.addEventListener('click', function () { auditionItems.push(''); drawAuditionItems(); });
    var box = el('#rwAudList');
    if (box) {
      box.addEventListener('input', function (e) { var i = e.target.getAttribute('data-i'); if (i != null) auditionItems[i] = e.target.value; });
      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-del]'); if (!b) return;
        auditionItems.splice(Number(b.getAttribute('data-del')), 1); drawAuditionItems();
      });
    }
  }

  /* ============================================================
     단체DB(전시공간) 찾아 잇기 — job 전용
     ============================================================ */
  function bindOrgFind() {
    var btn = el('#rwOrgFind'), box = el('#rwOrgRes'), nameInp = el('#rwOrgName');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      var kw = (nameInp.value || '').trim();
      if (!kw) { box.hidden = true; return; }
      var c = await sbReady();
      try {
        var r = await c.from('venues').select('id,name_ko,category,location').ilike('name_ko', '%' + kw + '%').limit(10);
        var rows = r.data || [];
        box.hidden = false;
        box.innerHTML = rows.length
          ? rows.map(function (v) {
              return '<button type="button" data-id="' + v.id + '" data-name="' + (v.name_ko || '').replace(/"/g, '&quot;') + '" data-cat="' + (v.category || '').replace(/"/g, '&quot;') + '">'
                + (v.name_ko || '') + ' <span class="rv-dim">' + (v.location || '') + '</span></button>';
            }).join('')
          : '<p class="rw-hint" style="padding:10px">찾는 전시공간이 없습니다. 이름만 적어도 등록됩니다.</p>';
      } catch (e) { box.hidden = true; }
    });
    if (box) box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-id]'); if (!b) return;
      setVal('#rwOrgId', b.getAttribute('data-id'));
      setVal('#rwOrgName', b.getAttribute('data-name'));
      setVal('#rwOrgField', b.getAttribute('data-cat'));
      el('#rwOrgLinked').hidden = false;
      box.hidden = true;
    });
    if (nameInp) nameInp.addEventListener('input', function () { setVal('#rwOrgId', ''); var l = el('#rwOrgLinked'); if (l) l.hidden = true; });

    var pull = el('#rwOrgPull');
    if (pull) pull.addEventListener('click', async function () {
      var c = await sbReady();
      var r = await c.from('community_members').select('*').eq('id', me.id).maybeSingle();
      var m = r.data || {};
      if (!val('#rwOrgName')) setVal('#rwOrgName', m.username || '');
      if (!val('#rwOrgAddr1')) setVal('#rwOrgAddr1', m.address || '');
      msg('회원정보에서 불러왔습니다. 이미 적어 두신 칸은 바꾸지 않았습니다.', 'ok');
    });
  }

  /* ============================================================
     학교DB 찾아 잇기 / 학력행 — talent 전용
     ============================================================ */
  function schoolRowHtml(s, i) {
    s = s || {};
    return '<div class="rw-school-row" data-i="' + i + '">'
      + '<input type="text" class="sc-name" value="' + (s.name || '').replace(/"/g, '&quot;') + '" placeholder="학교명 (찾기를 누르면 이어집니다)">'
      + '<input type="text" class="sc-degree" value="' + (s.degree || '').replace(/"/g, '&quot;') + '" placeholder="학위(학사 등)">'
      + '<input type="text" class="sc-major" value="' + (s.major || '').replace(/"/g, '&quot;') + '" placeholder="전공">'
      + '<input type="text" class="sc-from" value="' + (s.from || '').replace(/"/g, '&quot;') + '" placeholder="재학 시작(년)">'
      + '<input type="text" class="sc-to" value="' + (s.to || '').replace(/"/g, '&quot;') + '" placeholder="종료(년)">'
      + '<button type="button" class="rw-find rw-add--sm" data-find="' + i + '">학교DB에서 찾기</button>'
      + '<button type="button" class="rw-school-del" data-delrow="' + i + '">삭제</button>'
      + '<div class="sc-results" data-res="' + i + '" hidden></div>'
      + (s.id ? '<span class="sc-linked">DB 연결됨</span>' : '')
      + '</div>';
  }
  function drawSchools() {
    var box = el('#rwSchools');
    if (!box) return;
    box.innerHTML = schools.map(schoolRowHtml).join('') || '<p class="rv-none">아직 등록한 학교가 없습니다.</p>';
  }
  function readSchoolRowsFromDom() {
    [].forEach.call(document.querySelectorAll('.rw-school-row'), function (row) {
      var i = Number(row.getAttribute('data-i'));
      if (!schools[i]) return;
      schools[i].name = row.querySelector('.sc-name').value.trim();
      schools[i].degree = row.querySelector('.sc-degree').value.trim();
      schools[i].major = row.querySelector('.sc-major').value.trim();
      schools[i].from = row.querySelector('.sc-from').value.trim();
      schools[i].to = row.querySelector('.sc-to').value.trim();
    });
  }
  function bindSchoolRows() {
    drawSchools();
    var addBtn = el('#rwAddSchool');
    if (addBtn) addBtn.addEventListener('click', function () { readSchoolRowsFromDom(); schools.push({}); drawSchools(); });
    var box = el('#rwSchools');
    if (!box) return;
    box.addEventListener('click', async function (e) {
      var del = e.target.closest('[data-delrow]');
      if (del) { readSchoolRowsFromDom(); schools.splice(Number(del.getAttribute('data-delrow')), 1); drawSchools(); return; }
      var find = e.target.closest('[data-find]');
      if (find) {
        var i = Number(find.getAttribute('data-find'));
        readSchoolRowsFromDom();
        var kw = (schools[i].name || '').trim();
        var res = box.querySelector('[data-res="' + i + '"]');
        if (!kw || !res) return;
        var c = await sbReady();
        try {
          var r = await c.from('schools').select('id,name_ko,category,location').ilike('name_ko', '%' + kw + '%').limit(10);
          var rows = r.data || [];
          res.hidden = false;
          res.innerHTML = rows.length
            ? rows.map(function (s) { return '<button type="button" data-row="' + i + '" data-id="' + s.id + '" data-name="' + (s.name_ko || '').replace(/"/g, '&quot;') + '">' + (s.name_ko || '') + ' <span class="rv-dim">' + (s.location || '') + '</span></button>'; }).join('')
            : '<p class="rw-hint" style="padding:10px">찾는 학교가 없습니다. 이름만 적어도 됩니다.</p>';
        } catch (err) { res.hidden = true; }
        return;
      }
      var pick = e.target.closest('[data-row]');
      if (pick) {
        readSchoolRowsFromDom();
        var ri = Number(pick.getAttribute('data-row'));
        schools[ri].id = Number(pick.getAttribute('data-id'));
        schools[ri].name = pick.getAttribute('data-name');
        drawSchools();
      }
    });
  }

  /* ============================================================
     사진 올리기 — 캔버스로 긴 쪽 800px JPEG 로 줄여 올립니다
     ============================================================ */
  function resizeToJpeg(file, maxEdge) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var w = img.width, h = img.height;
        var scale = Math.min(1, maxEdge / Math.max(w, h));
        var cw = Math.round(w * scale), ch = Math.round(h * scale);
        var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
        cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
        URL.revokeObjectURL(url);
        cv.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error('resize failed')); }, 'image/jpeg', 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('load failed')); };
      img.src = url;
    });
  }

  function bindPhoto() {
    var inp = el('#rwPhoto'), box = el('#rwPhotoBox'), state = el('#rwPhotoState');
    if (!inp) return;
    inp.addEventListener('change', async function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type || '')) { alert('이미지 파일만 올리실 수 있습니다.'); inp.value = ''; return; }
      state.hidden = false; state.textContent = '올리는 중…';
      try {
        var blob = await resizeToJpeg(f, 800);
        var c = await sbReady();
        var path = me.id + '/photo_' + Date.now() + '.jpg';
        var up = await c.storage.from('recruit-photos').upload(path, blob, { upsert: false, contentType: 'image/jpeg' });
        if (up.error) throw up.error;
        photoUrl = c.storage.from('recruit-photos').getPublicUrl(path).data.publicUrl;
        setVal('#rwPhotoUrl', photoUrl);
        box.style.backgroundImage = 'url(' + photoUrl + ')';
        box.style.backgroundSize = 'cover'; box.style.backgroundPosition = 'center';
        state.textContent = '올렸습니다.';
      } catch (e) {
        state.textContent = '사진을 올리지 못했습니다 — ' + String((e && e.message) || e);
      }
    });
  }

  /* ============================================================
     내 정보 불러오기 — talent 전용
     ============================================================ */
  function bindPull() {
    var btn = el('#rwPull');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      var c = await sbReady();
      var r = await c.from('community_members').select('*').eq('id', me.id).maybeSingle();
      var m = r.data || {};
      if (!val('#rwName')) setVal('#rwName', m.name || '');
      if (!val('#rwPhone')) setVal('#rwPhone', m.phone || '');
      if (!val('#rwEmail')) setVal('#rwEmail', m.email || '');
      if (!val('#rwAddr1')) setVal('#rwAddr1', m.address || '');
      if (m.birth && !val('#rwBy')) {
        var d = String(m.birth).slice(0, 10).split('-');
        setVal('#rwBy', String(Number(d[0]))); setVal('#rwBm', String(Number(d[1]))); setVal('#rwBd', String(Number(d[2])));
      }
      msg('회원정보에서 불러왔습니다. 이미 적어 두신 칸은 바꾸지 않았습니다.', 'ok');
    });
  }

  /* ============================================================
     폼 ↔ 자료
     ============================================================ */
  function collectJob() {
    readAuditionOk();
    return {
      title: val('#rwTitle').trim(),
      org_db: val('#rwOrgId') ? 'venue' : null,
      org_id: val('#rwOrgId') ? Number(val('#rwOrgId')) : null,
      org_name: val('#rwOrgName').trim(),
      org_field: val('#rwOrgField').trim() || null,
      org_home: val('#rwOrgHome').trim() || null,
      org_zip: val('#rwOrgZip').trim() || null,
      org_addr1: val('#rwOrgAddr1').trim() || null,
      org_addr2: val('#rwOrgAddr2').trim() || null,
      cat1: val('#rwCat1') || null,
      cat2: val('#rwCat2') || null,
      job_etc: val('#rwJobEtc').trim() || null,
      region1: val('#rwR1') || null,
      region2: val('#rwR2') || null,
      duty: val('#rwDuty').trim() || null,
      headcount: val('#rwHeadcount').trim() || null,
      work_days: val('#rwDays') || null,
      emp_types: R.checked('#rwEmp', 'rw-emp'),
      work_start: val('#rwStart') || null,
      work_end: val('#rwEnd') || null,
      pay_type: val('#rwPayType') || null,
      pay_amount: val('#rwPayAmount').trim() || null,
      pay_daily: chk('#rwPayDaily'),
      audition: (document.querySelector('input[name="rw-aud"]:checked') || {}).value || null,
      audition_items: auditionItems.filter(function (v) { return (v || '').trim(); }),
      gender: (document.querySelector('input[name="rw-gender"]:checked') || {}).value || '무관',
      age_any: chk('#rwAgeAny'),
      age_min: val('#rwAgeMin') ? Number(val('#rwAgeMin')) : null,
      age_max: val('#rwAgeMax') ? Number(val('#rwAgeMax')) : null,
      edu_any: chk('#rwEduAny'),
      edu: chk('#rwEduAny') ? null : (val('#rwEdu') || null),
      prefer: R.checked('#rwPrefer', 'rw-prefer'),
      body: val('#rwBody').trim() || null,
      keywords: val('#rwKeywords').trim() || null,
      apply_from: chk('#rwAlways') || chk('#rwUntilHired') ? null : (val('#rwApplyFrom') || null),
      apply_to: chk('#rwAlways') || chk('#rwUntilHired') ? null : (val('#rwApplyTo') || null),
      apply_always: chk('#rwAlways'),
      apply_until_hired: chk('#rwUntilHired'),
      accept_site: chk('#rwAcceptSite'),
      apply_methods: R.checked('#rwMethods', 'rw-methods'),
      contact_name: val('#rwCName').trim() || null,
      contact_email: val('#rwCEmail').trim() || null,
      contact_phone: val('#rwCPhone').trim() || null,
      contact_fax: val('#rwCFax').trim() || null,
    };
  }
  function readAuditionOk() { /* 디바운스 없이 즉시 읽어 옵니다 — textarea input 으로 이미 동기화됨 */ }

  function collectTalent() {
    readSchoolRowsFromDom();
    return {
      title: val('#rwTitle').trim(),
      cat1: val('#rwCat1') || null,
      cat2: val('#rwCat2') || null,
      job_etc: val('#rwJobEtc').trim() || null,
      pay_type: val('#rwPayType') || null,
      pay_amount: val('#rwPayAmount').trim() || null,
      pay_daily: chk('#rwPayDaily'),
      region1: val('#rwR1') || null,
      region2: val('#rwR2') || null,
      emp_types: R.checked('#rwEmp', 'rw-emp'),
      now_status: (document.querySelector('input[name="rw-status"]:checked') || {}).value || null,
      name: val('#rwName').trim(),
      gender: (document.querySelector('input[name="rw-gender"]:checked') || {}).value || null,
      photo_url: photoUrl || val('#rwPhotoUrl') || null,
      birth_year: val('#rwBy') ? Number(val('#rwBy')) : null,
      birth_month: val('#rwBm') ? Number(val('#rwBm')) : null,
      birth_day: val('#rwBd') ? Number(val('#rwBd')) : null,
      phone: val('#rwPhone').trim(),
      tel: val('#rwTel').trim() || null,
      email: val('#rwEmail').trim() || null,
      zipcode: val('#rwZip').trim() || null,
      addr1: val('#rwAddr1').trim() || null,
      addr2: val('#rwAddr2').trim() || null,
      veteran: (document.querySelector('input[name="rw-vet"]:checked') || {}).value || null,
      disability: (document.querySelector('input[name="rw-dis"]:checked') || {}).value || null,
      disability_grade: val('#rwDisGrade') || null,
      military: (document.querySelector('input[name="rw-mil"]:checked') || {}).value || null,
      military_from: val('#rwMilFrom') || null,
      military_to: val('#rwMilTo') || null,
      schools: schools.filter(function (s) { return s && (s.name || '').trim(); }),
      career: val('#rwCareer').trim() || null,
      body: val('#rwBody').trim() || null,
      is_open: chk('#rwOpen'),
    };
  }

  function fillFormJob(o) {
    setVal('#rwTitle', o.title); setVal('#rwOrgId', o.org_id); setVal('#rwOrgName', o.org_name);
    setVal('#rwOrgField', o.org_field); setVal('#rwOrgHome', o.org_home); setVal('#rwOrgZip', o.org_zip);
    setVal('#rwOrgAddr1', o.org_addr1); setVal('#rwOrgAddr2', o.org_addr2);
    if (o.org_id) { var l = el('#rwOrgLinked'); if (l) l.hidden = false; }
    setVal('#rwCat1', o.cat1); el('#rwCat1') && el('#rwCat1').dispatchEvent(new Event('change')); setVal('#rwCat2', o.cat2);
    setVal('#rwJobEtc', o.job_etc);
    setVal('#rwR1', o.region1); el('#rwR1') && el('#rwR1').dispatchEvent(new Event('change')); setVal('#rwR2', o.region2);
    setVal('#rwDuty', o.duty); setVal('#rwHeadcount', o.headcount); setVal('#rwDays', o.work_days);
    (o.emp_types || []).forEach(function (v) { var i = el('input[name="rw-emp"][value="' + v + '"]'); if (i) i.checked = true; });
    setVal('#rwStart', o.work_start); setVal('#rwEnd', o.work_end);
    setVal('#rwPayType', o.pay_type); setVal('#rwPayAmount', o.pay_amount); setChk('#rwPayDaily', o.pay_daily);
    var aud = el('input[name="rw-aud"][value="' + (o.audition || '') + '"]'); if (aud) aud.checked = true;
    auditionItems = (o.audition_items || []).slice(); drawAuditionItems();
    var g = el('input[name="rw-gender"][value="' + (o.gender || '') + '"]'); if (g) g.checked = true;
    setChk('#rwAgeAny', o.age_any); setVal('#rwAgeMin', o.age_min); setVal('#rwAgeMax', o.age_max);
    setChk('#rwEduAny', o.edu_any); setVal('#rwEdu', o.edu);
    (o.prefer || []).forEach(function (v) { var i = el('input[name="rw-prefer"][value="' + v + '"]'); if (i) i.checked = true; });
    setVal('#rwBody', o.body); setVal('#rwKeywords', o.keywords);
    setVal('#rwApplyFrom', o.apply_from); setVal('#rwApplyTo', o.apply_to);
    setChk('#rwAlways', o.apply_always); setChk('#rwUntilHired', o.apply_until_hired); setChk('#rwAcceptSite', o.accept_site !== false);
    (o.apply_methods || []).forEach(function (v) { var i = el('input[name="rw-methods"][value="' + v + '"]'); if (i) i.checked = true; });
    setVal('#rwCName', o.contact_name); setVal('#rwCEmail', o.contact_email); setVal('#rwCPhone', o.contact_phone); setVal('#rwCFax', o.contact_fax);
  }
  function fillFormTalent(o) {
    setVal('#rwTitle', o.title);
    setVal('#rwCat1', o.cat1); el('#rwCat1') && el('#rwCat1').dispatchEvent(new Event('change')); setVal('#rwCat2', o.cat2);
    setVal('#rwJobEtc', o.job_etc);
    setVal('#rwPayType', o.pay_type); setVal('#rwPayAmount', o.pay_amount); setChk('#rwPayDaily', o.pay_daily);
    setVal('#rwR1', o.region1); el('#rwR1') && el('#rwR1').dispatchEvent(new Event('change')); setVal('#rwR2', o.region2);
    (o.emp_types || []).forEach(function (v) { var i = el('input[name="rw-emp"][value="' + v + '"]'); if (i) i.checked = true; });
    var st = el('input[name="rw-status"][value="' + (o.now_status || '') + '"]'); if (st) st.checked = true;
    setVal('#rwName', o.name);
    var g = el('input[name="rw-gender"][value="' + (o.gender || '') + '"]'); if (g) g.checked = true;
    if (o.photo_url) { photoUrl = o.photo_url; setVal('#rwPhotoUrl', o.photo_url); var box = el('#rwPhotoBox'); if (box) { box.style.backgroundImage = 'url(' + o.photo_url + ')'; box.style.backgroundSize = 'cover'; box.style.backgroundPosition = 'center'; } }
    setVal('#rwBy', o.birth_year); setVal('#rwBm', o.birth_month); setVal('#rwBd', o.birth_day);
    setVal('#rwPhone', o.phone); setVal('#rwTel', o.tel); setVal('#rwEmail', o.email);
    setVal('#rwZip', o.zipcode); setVal('#rwAddr1', o.addr1); setVal('#rwAddr2', o.addr2);
    var vet = el('input[name="rw-vet"][value="' + (o.veteran || '') + '"]'); if (vet) vet.checked = true;
    var dis = el('input[name="rw-dis"][value="' + (o.disability || '') + '"]'); if (dis) dis.checked = true;
    setVal('#rwDisGrade', o.disability_grade);
    var mil = el('input[name="rw-mil"][value="' + (o.military || '') + '"]'); if (mil) mil.checked = true;
    setVal('#rwMilFrom', o.military_from); setVal('#rwMilTo', o.military_to);
    schools = (o.schools || []).slice(); drawSchools();
    setVal('#rwCareer', o.career); setVal('#rwBody', o.body);
    setChk('#rwOpen', o.is_open !== false);
  }

  /* ============================================================
     임시저장(초안)
     ============================================================ */
  async function loadDraft() {
    var c = await sbReady();
    try {
      var r = await c.from('recruit_drafts').select('*').eq('member_id', me.id).eq('kind', cfg.kind).maybeSingle();
      return r.data || null;
    } catch (e) { return null; }
  }
  async function saveDraft(silent) {
    var c = await sbReady();
    var payload = cfg.kind === 'job' ? collectJob() : collectTalent();
    try {
      var r = await c.from('recruit_drafts').upsert([{ member_id: me.id, kind: cfg.kind, payload: payload, updated_at: new Date().toISOString() }], { onConflict: 'member_id,kind' }).select().maybeSingle();
      if (r.error) throw r.error;
      var at = el('#rwDraftAt');
      if (at) { at.hidden = false; at.textContent = '임시저장됨 · ' + R.stampFull(new Date().toISOString()); }
      if (!silent) msg('임시저장했습니다.', 'ok');
    } catch (e) {
      if (!silent) msg('임시저장하지 못했습니다 — ' + String((e && e.message) || e), 'err');
    }
  }
  function offerDraft(d) {
    var bar = el('#rwDraftBar');
    if (!bar || !d || !d.payload) return;
    bar.hidden = false;
    bar.innerHTML = '<span>적으시던 내용이 있습니다 (' + R.stampFull(d.updated_at) + ')</span>'
      + '<span><button type="button" id="rwDraftUse">불러오기</button><button type="button" id="rwDraftDrop">지우기</button></span>';
    el('#rwDraftUse').addEventListener('click', function () {
      (cfg.kind === 'job' ? fillFormJob : fillFormTalent)(d.payload || {});
      bar.hidden = true; updateProgress();
    });
    el('#rwDraftDrop').addEventListener('click', async function () {
      var c = await sbReady();
      try { await c.from('recruit_drafts').delete().eq('member_id', me.id).eq('kind', cfg.kind); } catch (e) {}
      bar.hidden = true;
    });
  }

  /* ============================================================
     작성 도우미 — 진행률 / 내가 등록한 글
     ============================================================ */
  var REQ_JOB = [
    ['#rwTitle', '채용제목'], ['#rwOrgName', '단체명'], ['#rwCat1', '모집직종'], ['#rwR1', '근무지역'],
    ['#rwCName', '담당자명'], ['#rwAgree', '동의'],
  ];
  var REQ_TALENT = [
    ['#rwTitle', '제목'], ['#rwCat1', '희망분야'], ['#rwR1', '근무지역'], ['#rwName', '이름'],
    ['#rwPhone', '휴대폰'], ['#rwAgree', '동의'],
  ];
  function reqList() { return cfg.kind === 'job' ? REQ_JOB : REQ_TALENT; }
  function isFilled(sel) {
    var e = el(sel);
    if (!e) return false;
    if (e.type === 'checkbox') return e.checked;
    return !!(e.value || '').trim();
  }
  function updateProgress() {
    var list = reqList();
    var done = list.filter(function (r) { return isFilled(r[0]); }).length;
    var bar = el('#rwProgBar'), txt = el('#rwProgTxt'), ul = el('#rwCheck');
    if (bar) bar.style.width = Math.round((done / list.length) * 100) + '%';
    if (txt) txt.textContent = '꼭 채울 것 ' + done + ' / ' + list.length;
    if (ul) ul.innerHTML = list.map(function (r) {
      return '<li class="' + (isFilled(r[0]) ? 'ok' : '') + '" data-go="' + r[0] + '">' + r[1] + '</li>';
    }).join('');
  }
  function bindProgress() {
    var form = el('#rwForm');
    if (form) form.addEventListener('input', updateProgress);
    if (form) form.addEventListener('change', updateProgress);
    var ul = el('#rwCheck');
    if (ul) ul.addEventListener('click', function (e) {
      var li = e.target.closest('[data-go]'); if (!li) return;
      var t = el(li.getAttribute('data-go'));
      if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.focus && t.focus(); }
    });
    updateProgress();
  }

  async function loadMine() {
    var c = await sbReady();
    var table = cfg.kind === 'job' ? 'recruit_jobs' : 'recruit_talents';
    try {
      var r = await c.from(table).select('id,title,created_at').eq('member_id', me.id).order('created_at', { ascending: false }).limit(10);
      var rows = r.data || [];
      var box = el('#rwMineBox'), list = el('#rwMine');
      if (!box || !list) return;
      if (!rows.length) return;
      box.hidden = false;
      list.innerHTML = rows.map(function (o) {
        return '<a href="?edit=' + o.id + '">' + (o.title || '(제목 없음)') + '<span class="rv-dim"> · ' + R.stampShort(o.created_at) + '</span></a>';
      }).join('');
    } catch (e) {}
  }

  /* ============================================================
     불러와 고치기
     ============================================================ */
  async function loadEdit(id) {
    var c = await sbReady();
    var table = cfg.kind === 'job' ? 'recruit_jobs' : 'recruit_talents';
    var r = await c.from(table).select('*').eq('id', id).maybeSingle();
    if (!r.data) { msg('그 글을 찾을 수 없습니다.', 'err'); return; }
    editId = id;
    (cfg.kind === 'job' ? fillFormJob : fillFormTalent)(r.data);
    var head = el('#rwHead'); if (head) head.textContent = (cfg.kind === 'job' ? '채용정보수정' : '인재정보수정');
    updateProgress();
  }

  /* ============================================================
     미리보기 / 게시
     ============================================================ */
  function bindPreview() {
    [el('#rwPreview'), el('#rwPreview2')].forEach(function (b) { if (b) b.addEventListener('click', openPreview); });
    var x = el('#rwPvClose'), dim = el('#rwPvDim'), edit = el('#rwPvEdit'), pub = el('#rwPublish'), prt = el('#rwPvPrint');
    if (x) x.addEventListener('click', closePreview);
    if (dim) dim.addEventListener('click', closePreview);
    if (edit) edit.addEventListener('click', closePreview);
    if (pub) pub.addEventListener('click', publish);
    if (prt) prt.addEventListener('click', function () { window.print(); });
  }
  function openPreview() {
    if (!V) V = window.OFRecruitView;
    var o = cfg.kind === 'job' ? collectJob() : collectTalent();
    var body = el('#rwPvBody');
    if (body) body.innerHTML = cfg.kind === 'job' ? V.previewJob(o) : V.previewTalent(o);
    var pv = el('#rwPv'); if (pv) pv.hidden = false;
  }
  function closePreview() { var pv = el('#rwPv'); if (pv) pv.hidden = true; }

  function validateRequired() {
    var missing = reqList().filter(function (r) { return !isFilled(r[0]); }).map(function (r) { return r[1]; });
    return missing;
  }

  async function publish() {
    var missing = validateRequired();
    if (missing.length) { closePreview(); msg('아직 빈 칸이 있습니다 — ' + missing.join(' · '), 'err'); updateProgress(); return; }
    var c = await sbReady();
    var table = cfg.kind === 'job' ? 'recruit_jobs' : 'recruit_talents';
    var row = cfg.kind === 'job' ? collectJob() : collectTalent();
    var btn = el('#rwPublish');
    if (btn) { btn.disabled = true; btn.textContent = '게시하는 중…'; }
    try {
      var r;
      if (editId) r = await c.from(table).update(row).eq('id', editId).select().maybeSingle();
      else r = await c.from(table).insert([Object.assign({ member_id: me.id }, row)]).select().maybeSingle();
      if (r.error) throw r.error;
      try { await c.from('recruit_drafts').delete().eq('member_id', me.id).eq('kind', cfg.kind); } catch (e) {}
      location.href = cfg.viewPage + '?id=' + encodeURIComponent(r.data.id);
    } catch (e) {
      closePreview();
      msg('게시하지 못했습니다 — ' + String((e && e.message) || e), 'err');
      if (btn) { btn.disabled = false; btn.textContent = '게시하기'; }
    }
  }

  function bindDraftButtons() {
    [el('#rwDraft'), el('#rwDraft2')].forEach(function (b) { if (b) b.addEventListener('click', function () { saveDraft(false); }); });
  }

  /* ============================================================
     붙어 따라오는 작성 도우미 자리 (목록 찾는 칸과 같은 방식)
     ============================================================ */
  var GAP = 24;
  function measureAside() {
    var box = el('.rw-aside');
    if (!box) return;
    var top = 120;
    var h = Math.round(box.getBoundingClientRect().height);
    var room = window.innerHeight - top - GAP;
    var t = (h <= room) ? top : (window.innerHeight - h - GAP);
    document.documentElement.style.setProperty('--rw-aside-top', Math.round(t) + 'px');
  }

  async function initCommon(options, fillFn) {
    cfg = Object.assign({ pageSize: 15 }, options || {});
    R = window.OFRecruit;
    if (!R) { console.error('assets/recruit.js 를 먼저 불러야 합니다.'); return; }
    if (!(await gateOrDie())) return;

    fillFn();
    bindPull();
    bindPreview();
    bindDraftButtons();
    bindProgress();
    loadMine();

    var editParam = new URLSearchParams(location.search).get('edit');
    if (editParam) {
      await loadEdit(editParam);
    } else {
      var d = await loadDraft();
      offerDraft(d);
    }

    setTimeout(measureAside, 300);
    window.addEventListener('resize', measureAside);
  }

  function initJob(options) { return initCommon(options, function () { Object.assign(cfg, { kind: 'job', table: 'recruit_jobs' }); fillJob(); }); }
  function initTalent(options) { return initCommon(options, function () { Object.assign(cfg, { kind: 'talent', table: 'recruit_talents' }); fillTalent(); }); }

  return { initJob: initJob, initTalent: initTalent };
})();
