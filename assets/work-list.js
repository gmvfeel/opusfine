/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 작품 목록 · assets/work-list.js
   ------------------------------------------------------------------
   artworks 표에서 읽어 도판 격자를 그립니다.

   ★★ 저작권을 지킵니다
     rights='public' 인 것만 <b>도판을 보여 줍니다.</b>
     'linked' 는 도판 없이 <b>소장처로 가는 길</b>만 보여 줍니다.
     'unknown' 은 자물쇠(RLS)에서 이미 걸러져 여기 오지 않습니다.

   ★ 도판은 미술관 원본 주소입니다. 우리 저장소에 담지 않습니다.

   ★ hidden 은 not.is.true 로 거릅니다 — is.false 로 하면 빈 값인
     줄이 통째로 빠집니다 (오퍼스클램 함정).
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var PER = 24;
  var grid, cntBox, moreBtn;
  var page = 0, total = 0, busy = false;
  var q = '', fGenre = '', fEra = '';

  /* 갈래 — 메트가 적어 준 classification 을 우리 말로 묶습니다 */
  var GENRE = {
    '회화': ['Paintings', 'Painting'],
    '도자': ['Ceramics', 'Porcelain'],
    '판화': ['Prints', 'Woodblock'],
    '조각': ['Sculpture'],
    '서예': ['Calligraphy'],
    '공예': ['Metalwork', 'Lacquer', 'Textiles', 'Jade', 'Wood']
  };
  var ERA = {
    '~15세기':   [null, 1500],
    '16–18세기': [1501, 1800],
    '19세기':    [1801, 1900],
    '20세기~':   [1901, null]
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function query(from, to) {
    var p = [];
    p.push('select=id,title,year_text,medium,dimensions,genre,artist_name,artist_id,image_url,image_small,rights,holder,holder_dept,link_source,quality');
    p.push('hidden=not.is.true');
    p.push('order=quality.desc,sort_no.desc,id.desc');

    if (q) {
      var t = q.replace(/[,()*]/g, ' ').trim();
      if (t) p.push('or=(title.ilike.*' + t + '*,artist_name.ilike.*' + t + '*,medium.ilike.*' + t + '*)');
    }
    if (fGenre && GENRE[fGenre]) {
      p.push('or=(' + GENRE[fGenre].map(function (w) { return 'genre.ilike.*' + w + '*'; }).join(',') + ')');
    }
    if (fEra && ERA[fEra]) {
      var r = ERA[fEra];
      p.push('year_from=not.is.null');
      if (r[0] != null) p.push('year_from=gte.' + r[0]);
      if (r[1] != null) p.push('year_from=lte.' + r[1]);
    }
    return OF.SB_URL + '/rest/v1/artworks?' + p.join('&')
         + '&limit=' + (to - from + 1) + '&offset=' + from;
  }

  function head(withCount) {
    var h = { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };
    if (withCount) h.Prefer = 'count=exact';
    return h;
  }

  async function fetchPage(n) {
    var from = n * PER;
    var res = await fetch(query(from, from + PER - 1), { headers: head(n === 0) });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 160));
    if (n === 0) {
      var m = /\/(\d+)$/.exec(res.headers.get('content-range') || '');
      if (m) total = Number(m[1]);
    }
    return await res.json();
  }

  /* ── 카드 한 장 ──
     ★ 캡션은 미술계 표기법 그대로입니다 —
         작가 이름 / 《작품명》, 연도 / 재료 / 소장처 */
  function card(w) {
    var src   = w.image_small || w.image_url;
    var who   = w.artist_name || '작자 미상';
    var when  = w.year_text ? ', ' + esc(w.year_text) : '';
    var mat   = [w.medium, w.dimensions].filter(Boolean).join(' · ');
    var where = [w.holder, w.holder_dept].filter(Boolean).join(' · ');
    var to    = '/db/work-view.html?id=' + w.id;

    var plate;
    if (w.rights === 'public' && src) {
      plate =
        '<span class="plate">' +
          '<img src="' + esc(src) + '" alt="' + esc(w.title) + '" referrerpolicy="no-referrer" loading="lazy">' +
          '<span class="onwork">' +
            '<span class="w">《' + esc(w.title) + '》' + when + '</span>' +
            (mat ? '<span class="m">' + esc(mat) + '</span>' : '') +
          '</span>' +
        '</span>';
    } else {
      /* ★ 저작권이 살아 있는 작품 — 도판을 싣지 않습니다 */
      plate =
        '<span class="plate"><span class="no rights">' +
          '저작권이 있는 작품입니다<br>' +
          '<b>소장처에서 보실 수 있습니다</b>' +
        '</span></span>';
    }

    return '<a class="card' + (w.rights === 'public' && src ? '' : ' thin') + '" href="' + to + '">' +
      plate +
      '<span class="who">' +
        '<span class="nm">' + esc(who) + '</span>' +
        '<span class="wt">《' + esc(w.title) + '》' + when + '</span>' +
        (mat ? '<span class="fd">' + esc(mat) + '</span>' : '') +
        (where ? '<span class="hd2">' + esc(where) + '</span>' : '') +
      '</span></a>';
  }

  /* ★★ 2026-08-22 · 시카고 도판이 <b>다 깨졌습니다</b> (파트너 확인).
       시카고는 Cloudflare 뒤에 있어, 다른 사이트에서 그림을 부르면
       봇 검사 화면이 오고 그림이 오지 않습니다.
     ▶ 먼저 <b>어디서 부르는지 알리지 않게</b>(referrerpolicy) 해 두었습니다.
     ▶ 그래도 안 오면 <b>빈 네모를 남기지 않고</b> 소장처로 가는 길을
       보여 줍니다. 깨진 그림 아이콘이 늘어선 것보다 낫습니다. */
  function guardImages(root) {
    root.querySelectorAll('img').forEach(function (im) {
      im.addEventListener('error', function () {
        var plate = im.closest('.plate');
        if (!plate) { im.remove(); return; }
        var a = im.closest('.card');
        var href = a ? a.getAttribute('href') : '#';
        plate.classList.add('noimg');
        plate.innerHTML = '<span class="no">도판을 불러오지 못했습니다<br>' +
                          '<b>눌러서 자세히 보기</b></span>';
      }, { once: true });
    });
  }

  function skeleton(n) {
    var out = '';
    for (var i = 0; i < n; i++)
      out += '<div class="card"><span class="plate loading" style="display:block;height:250px"></span>' +
             '<span class="who"><span class="nm" style="color:transparent">···</span></span></div>';
    return out;
  }

  async function load(reset) {
    if (busy) return;
    busy = true;
    if (reset) { page = 0; grid.innerHTML = skeleton(8); }
    if (moreBtn) moreBtn.disabled = true;

    try {
      var rows = await fetchPage(page);
      if (page === 0) grid.innerHTML = '';
      grid.insertAdjacentHTML('beforeend', rows.map(card).join(''));
      guardImages(grid);

      var shown = Math.min((page + 1) * PER, total);
      var left  = Math.max(0, total - shown);
      if (!rows.length || left <= 0) {
        if (moreBtn) moreBtn.parentNode.style.display = 'none';
      } else if (moreBtn) {
        moreBtn.parentNode.style.display = '';
        moreBtn.textContent = '더 보기 · ' + left.toLocaleString() + '점 남음';
        moreBtn.disabled = false;
      }
      if (cntBox && page === 0)
        cntBox.innerHTML = '<b>' + total.toLocaleString() + '</b>점'
          + (q || fGenre || fEra ? ' · 추린 것' : '');
      if (!rows.length && page === 0)
        grid.innerHTML = '<div class="demo-note" style="grid-column:1/-1">해당하는 작품이 없습니다.</div>';
      page++;
    } catch (e) {
      grid.innerHTML = '<div class="demo-note" style="grid-column:1/-1">' +
        '자료를 불러오지 못했습니다 · ' + esc(e.message) + '</div>';
      if (moreBtn) moreBtn.parentNode.style.display = 'none';
    }
    busy = false;
  }

  function chips(box, pick) {
    box.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        box.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        var v = b.textContent.trim();
        pick(v === '전체' ? '' : v);
        load(true);
      });
    });
  }

  function boot() {
    grid    = document.getElementById('grid');
    cntBox  = document.getElementById('cnt');
    moreBtn = document.querySelector('.more button');
    if (!grid) return;

    var g = document.querySelectorAll('.filters .fgrp');
    if (g[0]) chips(g[0], function (v) { fGenre = v; });
    if (g[1]) chips(g[1], function (v) { fEra   = v; });

    var input = document.querySelector('.srch input');
    if (input) {
      var t = null;
      input.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { q = input.value.trim(); load(true); }, 320);
      });
    }
    if (moreBtn) moreBtn.addEventListener('click', function () { load(false); });
    load(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
