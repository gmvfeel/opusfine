/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 대문 전시 · assets/home-exh.js
   ------------------------------------------------------------------
   ★★ 2026-08-24 · 대문의 전시 구역이 <b>손으로 적은 견본</b>이었습니다.
       「색면과 여백 · 국립현대미술관 서울」 — 없는 전시
       「겸재의 눈, 진경의 탄생 D-4」  — 없는 전시
     전시DB 878건이 붙었는데 대문은 히어로에만 스쳐 지나갔습니다.

   ▶ 이제 <b>DB 에서 받아</b> 채웁니다.
       · 지금 열리는 전시 — 끝나는 날이 <b>먼</b> 것부터
                            (한동안 볼 수 있는 것을 앞에)
       · 곧 끝나는 전시   — 끝나는 날이 <b>가까운</b> 것부터
                            (서둘러야 하는 것을 앞에)
     같은 표를 보되 <b>차례가 반대</b>입니다. 그래야 두 자리가
     서로 다른 것을 보여 줍니다.

   ★ 같은 전시가 두 자리에 겹치지 않게 <b>이미 쓴 것은 뺍니다.</b>

   ★ 지금 열리는 것이 없으면 <b>구역째 감춥니다.</b>
     빈 껍데기나 옛 견본이 남는 것보다 낫습니다.

   ★ 포스터는 art-demo.js 가 작품 도판으로 채우던 자리(data-art="ex")를
     <b>전시 포스터로</b> 바꿔 씁니다. 전시 자리에는 전시 그림이 맞습니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.OF || !OF.SB_URL) return;

  var head = { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };
  var today = new Date().toISOString().slice(0, 10);
  var SEL = 'id,title,venue,start_date,end_date,poster_url';

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
  /* 「08.02 — 11.16」 */
  function when(a, b) {
    var f = function (d) { return String(d || '').slice(5).replace('-', '.'); };
    if (!a && !b) return '';
    return f(a) + ' — ' + f(b);
  }
  function daysLeft(end) {
    if (!end) return null;
    var d = Math.round((new Date(end + 'T00:00:00') - new Date(today + 'T00:00:00')) / 864e5);
    return isFinite(d) ? d : null;
  }
  /* ★ 제목에 이미 낫표가 든 것이 많습니다 — 덧씌우지 않습니다 */
  function title(t) {
    return /[《》]/.test(t) ? esc(t) : '《' + esc(t) + '》';
  }

  /* ── 지금 열리는 전시 ── */
  function paintNow(rows) {
    var box = document.querySelector('#ex .grid-ex');
    if (!box) return;
    if (!rows.length) {
      var sec = document.getElementById('ex');
      if (sec) sec.style.display = 'none';
      return;
    }
    /* ★ 벽돌 쌓기(column-count:3)라 <b>열의 배수</b>로 둡니다.
         배수가 아니면 뒤쪽 열이 빕니다 — 인계문서 규칙. */
    var n = rows.length >= 6 ? 6 : (rows.length >= 3 ? 3 : rows.length);

    box.innerHTML = rows.slice(0, n).map(function (e) {
      var pic = e.poster_url
        ? '<img src="' + esc(e.poster_url) + '" alt="' + esc(e.title) +
          '" referrerpolicy="no-referrer" loading="lazy">'
        : '<span style="display:block;height:220px"></span>';
      return '<a class="ex" href="/db/exhibition-view.html?id=' + e.id + '">'
        + '<div class="th">' + pic + '</div>'
        + '<div class="when">' + esc(when(e.start_date, e.end_date)) + '</div>'
        + '<div class="t">' + title(e.title) + '</div>'
        + (e.venue ? '<div class="v">' + esc(e.venue) + '</div>' : '')
        + '</a>';
    }).join('');

    var more = document.querySelector('#ex .sec-more');
    if (more) more.href = '/db/exhibition.html?when=live';
  }

  /* ── 곧 끝나는 전시 ── */
  function paintSoon(rows) {
    var ul = document.querySelector('#ex .lst ul');
    if (!ul) return;
    if (!rows.length) {
      /* 목록만 감춥니다 — 옆의 다른 자리는 그대로 둡니다 */
      var box = ul.closest('.lst');
      var hd = box && box.previousElementSibling;
      if (box) box.style.display = 'none';
      if (hd && hd.classList.contains('sec-hd')) hd.style.display = 'none';
      return;
    }
    ul.innerHTML = rows.slice(0, 5).map(function (e) {
      var d = daysLeft(e.end_date);
      return '<li><a href="/db/exhibition-view.html?id=' + e.id + '"'
        + ' style="display:flex;gap:12px;align-items:center;width:100%">'
        + '<span class="t">' + title(e.title) + '</span>'
        + '<span class="dday">' + (d === 0 ? '오늘' : 'D-' + d) + '</span>'
        + '</a></li>';
    }).join('');
  }

  /* ── 받기 ── */
  var base = OF.SB_URL + '/rest/v1/exhibitions?select=' + SEL
           + '&hidden=not.is.true&start_date=lte.' + today + '&end_date=gte.' + today;

  Promise.all([
    /* 한동안 볼 수 있는 것 — 포스터가 있는 것만 (대문은 그림이 반입니다) */
    get(base + '&poster_url=not.is.null&order=end_date.desc&limit=12')
      .catch(function () { return []; }),
    /* 서둘러야 하는 것 — 포스터가 없어도 됩니다(글자 목록이므로) */
    get(base + '&order=end_date.asc&limit=12').catch(function () { return []; })
  ]).then(function (r) {
    var now = r[0] || [], soon = r[1] || [];

    /* ★ 같은 전시가 두 자리에 겹치지 않게 합니다.
         「곧 끝나는」 쪽을 먼저 고르고, 그것을 뺀 나머지로 위를 채웁니다 —
         서둘러야 하는 것이 더 알릴 값이 있습니다. */
    var pickSoon = soon.slice(0, 5);
    var used = {};
    pickSoon.forEach(function (e) { used[e.id] = 1; });
    var pickNow = now.filter(function (e) { return !used[e.id]; });

    /* 지금 열리는 것이 적어 다 겹치면, 겹침을 허락합니다 —
       빈 자리를 남기는 것보다 낫습니다. */
    if (pickNow.length < 3) pickNow = now;

    paintNow(pickNow);
    paintSoon(pickSoon);
  }).catch(function () {
    var sec = document.getElementById('ex');
    if (sec) sec.style.display = 'none';
  });
})();
