/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 대문 「새로 들어온 작품」 · assets/home-work.js
   ------------------------------------------------------------------
   ★★ 2026-09-29 · 이 자리가 <b>손으로 그린 견본 넷</b>이었습니다.
     「김환기 추정 · 《색면 습작》」— 없는 작품입니다. 유명 작가 이름에
     실재하지 않는 그림을 붙여 둔 셈이라, home-exh.js 가 전시 견본을
     걷어낸 것과 같은 까닭으로 여기도 걷어냅니다.

   ▶ CMA·AIC·공유마당·스미소니언 등에서 실제 CC0 작품이 수만 건
     들어온 지금, DB 에서 <b>최근에 쌓인 것</b>을 그대로 보여 줍니다.

   ★ image_url 이 있는 것만 뽑습니다 — 대문은 그림이 반입니다.
   ★ 들어올 때마다 섞습니다(home-exh.js·hero.js 와 같은 결).
   ★ 하나도 못 받으면 구역째 감춥니다 — 옛 견본이 남는 것보다 낫습니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.OF || !OF.SB_URL) return;

  var head = { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };
  var SEL = 'id,title,title_en,artist_name,image_url,image_small,holder';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function title(t) {
    t = String(t || '').trim();
    if (!t) return '';
    return /[《》]/.test(t) ? esc(t) : '《' + esc(t) + '》';
  }
  function get(u) {
    return fetch(u, { headers: head }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var k = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[k]; a[k] = t;
    }
    return a;
  }

  function paint(rows) {
    var box = document.querySelector('.mini');
    if (!box) return;
    if (!rows.length) {
      var sec = box.closest('section');
      if (sec) sec.style.display = 'none';
      return;
    }
    box.innerHTML = rows.slice(0, 4).map(function (w) {
      var pic = OF.img(w.image_small || w.image_url);
      var who = w.artist_name ? esc(w.artist_name) : (w.holder ? esc(w.holder) : '작자 미상');
      return '<a class="mw" href="/db/work-view.html?id=' + w.id + '">'
        + '<div class="th"><img src="' + esc(pic) + '" alt="' + esc(w.title || '') + '" referrerpolicy="no-referrer" loading="lazy"></div>'
        + '<div class="a">' + who + '</div>'
        + '<div class="w">' + title(w.title_en && !w.title ? w.title_en : w.title) + '</div>'
        + '</a>';
    }).join('');
  }

  /* ★ 최근 700건 안에서 무작위 4점 — PostgREST 에 무작위 정렬이 없어
       화면에서 섞습니다. 700이면 오늘 들어온 것들만으로도 넉넉합니다. */
  get(OF.SB_URL + '/rest/v1/artworks?select=' + SEL
    + '&hidden=not.is.true&image_url=not.is.null'
    + '&order=created_at.desc&limit=700')
    .then(function (rows) { paint(shuffle(rows || [])); })
    .catch(function () {
      var box = document.querySelector('.mini');
      var sec = box && box.closest('section');
      if (sec) sec.style.display = 'none';
    });
})();
