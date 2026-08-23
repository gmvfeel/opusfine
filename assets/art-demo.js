/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 대문 도판 · assets/art-demo.js
   ------------------------------------------------------------------
   대문 곳곳의 도판 자리를 <b>우리 작품DB</b>에서 채웁니다.

   ★★ 2026-08-23 · <b>자료원을 갈아 끼웠습니다</b> (파트너 지적).
     그동안 이 파일은 메트로폴리탄 공개 API 를 <b>브라우저에서 직접</b>
     불렀습니다. 그런데 그 부름이 오지 않고 있었습니다 — 견본 그림이
     6초 뒤 되살아나 <b>가려져 있었을 뿐</b>입니다.
     자리표시를 사선 무늬로 바꾸자 비로소 드러났습니다.

   ▶ 이제 <b>우리 DB(Supabase)</b>에서 읽습니다.
       · 빠릅니다 — 검색 세 번 + 조회 수십 번이 <b>한 번</b>으로 줄었습니다
       · 바깥 API 가 멈춰도 대문은 멀쩡합니다
       · 화면에 뜨는 것이 <b>정말로 우리가 가진 것</b>입니다.
         메트에서 그때그때 빌려 온 남의 것이 아닙니다
       · 인계문서의 「art-demo.js 지우기(작품DB 가 붙었으므로)」가
         바로 이 일입니다

   ★ 이름은 그대로 둡니다 — index.html 이 이 이름으로 부르고 있어,
     바꾸면 그쪽도 함께 고쳐야 합니다. 갈래를 정리할 때 같이 바꿉니다.

   ★ 작가 얼굴 자리(data-art="ar")는 <b>채우지 않습니다.</b>
     우리 DB 에 초상이 없습니다. 산수화를 정선의 얼굴 자리에 넣으면
     안 됩니다 — 그건 틀린 정보입니다. 위키데이터·커먼즈에서
     <b>그 작가의 진짜 초상</b>을 받아 오기 전까지는 자리표시로 둡니다.

   ★ 못 받은 자리는 <b>사선 무늬</b>로 남습니다. 빈 네모도 아니고
     가짜 그림도 아닌, 「여기 그림이 올 자리」라고 말하는 무늬입니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var slots = Array.prototype.slice.call(document.querySelectorAll('[data-art]'));
  if (!slots.length) return;

  /* ph = 사선 무늬 · loading = 무늬 위 빛줄기
     ★ 둘을 나눈 까닭 — 빛줄기는 몇 초 뒤 멈춰야 하지만, 무늬는
       도판이 <b>실제로 닿을 때까지</b> 남아야 합니다. */
  slots.forEach(function (el) { el.classList.add('ph', 'loading'); });

  function calm(list) {
    (list || slots).forEach(function (el) { el.classList.remove('loading'); });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  /* 얼굴 자리는 채우지 않습니다 — 위 머리말 참조 */
  var faces = slots.filter(function (el) { return el.getAttribute('data-art') === 'ar'; });
  var fill  = slots.filter(function (el) { return el.getAttribute('data-art') !== 'ar'; });
  calm(faces);

  if (!window.OF || !OF.SB_URL || !fill.length) { calm(); return; }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var k = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[k]; a[k] = t;
    }
    return a;
  }

  /* ── 캡션 ──
     시그니처 차례입니다 — 작가 / 《작품명》, 연도 / 재료 / 소장처 */
  function caption(el, w) {
    var kind = el.getAttribute('data-art'), box = el.parentNode;
    var who = w.artist_name || '작자 미상';

    if (kind === 'hero') {
      var cap = box.querySelector('.cap');
      if (cap) {
        var q = function (s) { return cap.querySelector(s); };
        if (q('.cap-artist')) q('.cap-artist').textContent = who;
        if (q('.cap-work'))   q('.cap-work').innerHTML =
          '<em>《' + esc(w.title || '') + '》</em>'
          + (w.year_text ? ', ' + esc(w.year_text) : '');
        if (q('.cap-meta'))   q('.cap-meta').textContent = w.medium || '';
        if (q('.cap-hold'))   q('.cap-hold').textContent = w.holder || '';
      }
      var why = box.querySelector('.why');
      if (why) why.textContent =
        '날마다 쌓이는 자료 가운데 한 점을 골라 소개합니다. 저작권이 풀린 도판만 싣습니다.';
    }

    if (kind === 'mini') {
      var a = box.querySelector('.a'), t = box.querySelector('.w');
      if (a) a.textContent = who;
      if (t) t.textContent = '《' + (w.title || '') + '》';
      /* 눌러서 그 작품으로 갈 수 있게 합니다 */
      if (box.tagName === 'A' && w.id) box.href = '/db/work-view.html?id=' + w.id;
    }

    /* 전시 카드는 <b>전시 정보가 견본</b>이고 도판만 우리 것입니다.
       그 사실을 한 줄로 밝힙니다 — 감추면 잘못 읽힙니다. */
    if (kind === 'ex') {
      var v = box.querySelector('.v');
      if (v && !v.dataset.kept) {
        v.dataset.kept = '1';
        var n = document.createElement('div');
        n.className = 'artcap';
        n.textContent = '도판 ' + (w.artist_name ? w.artist_name + ', ' : '')
                      + '《' + (w.title || '') + '》'
                      + (w.holder ? ' · ' + w.holder : '');
        v.parentNode.appendChild(n);
      }
    }
  }

  /* ── 한 자리 채우기 ──
     ★ 그림 주소가 살아 있는지는 <b>불러 봐야</b> 압니다. 죽은 주소면
       다음 작품으로 넘어갑니다 — 세 번까지만 해 봅니다. 끝없이
       매달리면 자리 하나 때문에 브라우저가 붙잡힙니다. */
  function place(el, queue, tries) {
    if (!queue.length || tries <= 0) { el.classList.remove('loading'); return; }
    var w = queue.shift();
    var src = OF.img(w.image_small || w.image_url);
    if (!src) { place(el, queue, tries - 1); return; }

    var img = new Image();
    img.alt = (w.artist_name ? w.artist_name + ', ' : '') + (w.title || '작품');
    img.referrerPolicy = 'no-referrer';
    img.onload = function () {
      var svg = el.querySelector('svg');
      if (svg) svg.replaceWith(img); else el.appendChild(img);
      el.classList.remove('ph', 'loading');   /* 도판이 닿았으니 무늬를 뗍니다 */
      caption(el, w);
    };
    img.onerror = function () { place(el, queue, tries - 1); };
    img.src = src;
  }

  /* ── DB 에서 한 번에 받아 옵니다 ──
     ★ hidden=not.is.true — 「=false」로 하면 <b>빈 값인 줄이 통째로
       빠집니다.</b> 오퍼스클램에서 여러 번 겪은 일입니다.
     ★ rights=eq.public — 저작권이 풀린 것만 싣습니다.
     ★ 자리 수보다 <b>넉넉히</b> 부릅니다. 주소가 죽은 것이 섞이므로
       여유가 있어야 자리가 비지 않습니다. */
  var url = OF.SB_URL + '/rest/v1/artworks'
    + '?select=id,title,year_text,medium,holder,artist_name,image_url,image_small'
    + '&hidden=not.is.true&rights=eq.public&image_small=not.is.null'
    + '&order=quality.desc,id.asc&limit=' + Math.max(60, fill.length * 6);

  fetch(url, { headers: { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY } })
    .then(function (r) { return r.ok ? r.json() : []; })
    .catch(function () { return []; })
    .then(function (rows) {
      if (!rows || !rows.length) { calm(); return; }
      shuffle(rows);

      /* 자리마다 <b>제 몫의 줄</b>을 나눠 줍니다. 같은 그림이 대문에
         두 번 나오지 않게 하려는 것입니다. */
      var per = Math.max(3, Math.floor(rows.length / fill.length));
      fill.forEach(function (el, i) {
        place(el, rows.slice(i * per, i * per + per), 3);
      });

      /* 8초 뒤 <b>빛줄기만</b> 멈춥니다. 무늬는 그대로 둡니다. */
      setTimeout(function () { calm(); }, 8000);
    });
})();
