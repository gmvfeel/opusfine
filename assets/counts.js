/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 쌓인 자료 세기 · assets/counts.js
   ------------------------------------------------------------------
   ★ 대문의 「무엇이 쌓여 있나」 숫자를 <b>DB 에서 직접</b> 읽습니다.
     화면에 적어 두면 자료가 늘 때마다 사람이 고쳐야 하고, 그러다
     실제와 어긋납니다.

   ★ <b>세는 것만 묻습니다.</b> head=true + Prefer: count=exact 를 쓰면
     자료를 한 줄도 받지 않고 수만 옵니다 — 빠르고 가볍습니다.

   ★ hidden 은 not.is.true 로 거릅니다. is.false 로 하면 빈 값인 줄이
     통째로 빠집니다 (오퍼스클램 함정).

   ★ 표가 아직 없는 갈래는 그대로 둡니다. 없는 표를 물으면 오류가
     오는데, 그걸 화면에 내보이지 않습니다 — 「준비 중」이 남습니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* 화면의 표 이름 → 실제 표 이름. 표가 생기는 대로 여기에 적습니다 */
  var TABLE = {
    artists:     'artists',
    artworks:    'artworks',
    exhibitions: 'exhibitions',
    /* ★ 2026-10-01 · 미술학교 상세·목록 화면이 다 돌아가는데 대문
         카드만 「준비 중」으로 남아 있던 것을 파트너가 지적 — schools
         표를 더해 다른 셋과 같은 방식으로 세게 합니다. */
    schools:     'schools'
    /* venues: 'venues', … */
  };

  /* ★★ 2026-09-29 · statement timeout 의 진짜 원인은 RLS 조건과
       hidden=not.is.true 가 뜻은 같은데 글자가 달라 Postgres 가
       중복으로 어림잡아 절반으로 착각, 색인 대신 전체 훑기를 고른
       것이었습니다(work-list.js 에 자세히 적어 둠). count=estimated
       로 바꿔 봤자 <똑같이 잘못된 절반 숫자>가 나와 되돌렸습니다.
     ▶ DB 쪽에 RLS 조건과 글자 그대로 겹치는 색인(artworks_anon_rls_idx)
       을 두어 고쳤습니다 — count=exact 그대로 두어도 이제 빠릅니다
       (실측 0.2~2초). */
  async function countOf(t) {
    var url = OF.SB_URL + '/rest/v1/' + t + '?select=id&hidden=not.is.true&limit=1';
    var r = await fetch(url, {
      method: 'HEAD',
      headers: {
        apikey: OF.SB_KEY,
        Authorization: 'Bearer ' + OF.SB_KEY,
        Prefer: 'count=exact'
      }
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var m = /\/(\d+)$/.exec(r.headers.get('content-range') || '');
    return m ? Number(m[1]) : null;
  }

  async function run() {
    var slots = document.querySelectorAll('[data-count]');
    if (!slots.length) return;

    for (var i = 0; i < slots.length; i++) {
      var el   = slots[i];
      var key  = el.getAttribute('data-count');
      var tbl  = TABLE[key];
      if (!tbl) continue;                 /* 아직 없는 갈래는 그대로 */

      try {
        var n = await countOf(tbl);
        if (n == null) continue;
        var unit = el.querySelector('i');
        el.textContent = n.toLocaleString();
        if (unit) el.appendChild(unit);
      } catch (e) { /* 못 세면 그대로 둡니다 */ }
    }

    /* 히어로 마지막 장의 숫자 */
    try {
      var n2 = await countOf('artists');
      var h = document.getElementById('hero-artists');
      if (h && n2 != null) h.textContent = n2.toLocaleString();
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
