/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 대문 「이달의 미술학교」 · assets/home-school.js
   ------------------------------------------------------------------
   ★★ 2026-10-01 · 이 자리가 <b>손으로 적은 견본</b>이었습니다.
       「홍익대학교 미술대학 · 동문 작가 1,842명 · 소장 자료 96건」
     — 전부 없는 숫자였고 링크(href="#")도 죽어 있었습니다. 전시 자리는
     이미 home-exh.js 가 실데이터로 채우는데, 이 학교 카드만 그 작업이
     안 된 채 남아 있었습니다 (파트너 지적).

   ▶ 이제 <b>DB 에서 받아</b> 채웁니다.
       · 「동문 작가 수」는 entity_links(연결 다리) 표에서 실제로 이은
         줄 수를 셉니다 — 지어낸 숫자가 아닙니다.
       · 「소장 자료 N건」은 상응하는 자료가 없어 <b>뺐습니다.</b> 없는
         숫자를 다른 말로 지어내는 대신, 있는 것만 보입니다.
       · 로고가 있으면 그림을, 없으면(또는 그림이 깨지면) 이름 첫 글자를
         이니셜로 보입니다.

   ★ 동문 연결이 하나도 없는 학교는 후보에서 뺍니다 — 통계 줄이
     비어 보이지 않게.
   ★ 「접속할 때마다 바뀌는 것」(파트너 요청, home-exh.js 와 같은 결) —
     후보 중 무작위로 하나를 고릅니다.
   ★ 후보가 하나도 없으면 <b>구역째 감춥니다.</b>
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.OF || !OF.SB_URL) return;

  var head = { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function get(u) {
    return fetch(u, { headers: head }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function hide() {
    /* ★ 카드만이 아니라 바로 위 「이달의 미술학교」 제목줄까지 같이
         감춥니다 — 제목만 남고 빈 자리가 보이면 더 어색합니다. */
    var box = document.getElementById('home-school-wrap');
    if (box) box.style.display = 'none';
  }

  function render(s, alumniN) {
    var box = document.getElementById('home-school');
    if (!box) return;

    var depts = String(s.depts || '').split('·').map(function (x) { return x.trim(); }).filter(Boolean);
    var smLine = depts.length
      ? depts.slice(0, 4).join(' · ')
      : [s.category, s.location].filter(Boolean).join(' · ');

    var ssParts = [];
    if (depts.length) ssParts.push('학과 <b style="color:var(--accent)">' + depts.length + '</b>개');
    ssParts.push('동문 작가 <b style="color:var(--accent)">' + alumniN.toLocaleString() + '</b>명');

    var initial = esc(String(s.name_ko || s.name_en || '').trim().charAt(0) || '·');
    var em = s.logo_url
      ? '<img src="' + esc(s.logo_url) + '" alt="" referrerpolicy="no-referrer" loading="lazy"'
        + ' onerror="OF.imgFallback(this,\'\',\'' + initial + '\')">'
      : initial;

    box.innerHTML = '<a class="schl" href="/db/school-view.html?id=' + s.id + '">'
      + '<div class="em">' + em + '</div>'
      + '<div>'
      + '<div class="sn">' + esc(s.name_ko || s.name_en) + '</div>'
      + '<div class="sm">' + esc(smLine) + '</div>'
      + '<div class="ss">' + ssParts.join(' · ') + '</div>'
      + '</div>'
      + '</a>';

    var wrap = document.getElementById('home-school-wrap');
    if (wrap) wrap.style.display = '';
  }

  /* ── 동문이 하나라도 이어진 학교 후보를 찾습니다 ──
     entity_links 는 ★ 2026-10-01 학교 동문 작업(99건)으로 생긴 표입니다.
     건수가 적어(현재 99건) 통째로 받아 화면에서 센 뒤 무작위로 고릅니다. */
  get(OF.SB_URL + '/rest/v1/entity_links?select=to_id&to_type=eq.school&limit=2000')
    .then(function (rows) {
      if (!rows || !rows.length) { hide(); return; }

      var count = {};
      rows.forEach(function (r) { count[r.to_id] = (count[r.to_id] || 0) + 1; });
      var ids = Object.keys(count);
      var tryIds = ids.slice();

      /* ★ 고른 학교가 숨김(hidden) 상태일 수 있어, 받아 보고 비어 있으면
           다른 후보로 다시 고릅니다(최대 전체 후보 수만큼). */
      function attempt() {
        if (!tryIds.length) { hide(); return; }
        var id = pick(tryIds);
        tryIds = tryIds.filter(function (x) { return x !== id; });

        get(OF.SB_URL + '/rest/v1/schools?select=id,name_ko,name_en,category,location,depts,logo_url'
          + '&id=eq.' + id + '&hidden=not.is.true&limit=1')
          .then(function (sr) {
            if (!sr || !sr.length) { attempt(); return; }
            render(sr[0], count[id]);
          })
          .catch(attempt);
      }
      attempt();
    })
    .catch(hide);
})();
