/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 현대미술(최근 전시 참여 작가) 목록 · assets/contemporary-list.js
   ------------------------------------------------------------------
   venue-list.js/paper-list.js 를 본떴습니다. 지키는 것은 같습니다 —
     · hidden 은 not.is.true 로 거릅니다
     · 한 번에 받는 건 PER 개뿐 · 0줄일 때만 끝으로 봅니다
     · 받아오지 못하면 견본을 두지 않고 실패했다고 적습니다

   ★ contemporary_artists 표는 exhibition_artists(2015년 이후 · 한국
     미술 전시)를 이름으로 묶어 만든 집계표입니다 — venues/institutions
     와 같은 「자유 글자칸에서 뽑아 만든 표」 방식입니다.
   ★ artist_id 가 있으면 작가 상세(/db/artist-view.html)로, 없으면
     가장 최근 전시(/db/exhibition-view.html)로 잇습니다 — 어느 쪽이든
     눌러서 갈 곳이 있게 합니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.OF || !OF.SB_URL) return;

  var PER = 30;
  var grid, cntBox, moreBox, moreBtn;
  var page = 0, total = 0, busy = false;
  var q = '', sort = 'active', minExh = 0;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function head(withCount) {
    var h = { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };
    if (withCount) h.Prefer = 'count=exact';
    return h;
  }

  function query() {
    var p = [];
    p.push('select=artist_name,artist_id,exh_count,latest_exh_id,latest_title,latest_venue,latest_date');
    p.push('hidden=not.is.true');
    if (minExh > 0) p.push('exh_count=gte.' + minExh);
    if (q) {
      var w = '*' + q.replace(/[*(),]/g, '') + '*';
      p.push('artist_name=ilike.' + w);
    }
    p.push(sort === 'recent'
      ? 'order=latest_date.desc.nullslast,exh_count.desc'
      : 'order=exh_count.desc,latest_date.desc.nullslast');
    return OF.SB_URL + '/rest/v1/contemporary_artists?' + p.join('&');
  }

  async function fetchPage(n) {
    var from = n * PER, to = from + PER - 1;
    var res = await fetch(query(), {
      headers: Object.assign(head(n === 0), { Range: from + '-' + to, 'Range-Unit': 'items' })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
    if (n === 0) {
      var cr = res.headers.get('content-range') || '';
      var m = cr.match(/\/(\d+)$/);
      if (m) total = Number(m[1]);
    }
    return await res.json();
  }

  function title(t) {
    if (!t) return '';
    return /[《》]/.test(t) ? esc(t) : '《' + esc(t) + '》';
  }

  function card(a) {
    var href = a.artist_id
      ? '/db/artist-view.html?id=' + encodeURIComponent(a.artist_id)
      : (a.latest_exh_id ? '/db/exhibition-view.html?id=' + encodeURIComponent(a.latest_exh_id) : '#');
    var meta = [];
    meta.push('최근 전시 참여 ' + (a.exh_count || 0) + '회');
    if (a.latest_date) meta.push(String(a.latest_date).replace(/-/g, '.'));

    var h = '<a class="sl-item" href="' + href + '">';
    h += '<span class="sl-nm">' + esc(a.artist_name) + '</span>';
    h += '<span class="sl-meta">' + meta.join('<i>·</i>') + '</span>';
    if (a.latest_title) {
      h += '<span class="sl-ex">' + title(a.latest_title)
        + (a.latest_venue ? ' · ' + esc(a.latest_venue) : '') + '</span>';
    }
    h += '</a>';
    return h;
  }

  function skeleton(n) {
    var h = '';
    for (var i = 0; i < n; i++) {
      h += '<div class="sl-skel"><span style="width:40%"></span>'
         + '<span style="width:58%"></span></div>';
    }
    return h;
  }

  function note(msg) {
    return '<div class="demo-note" style="grid-column:1/-1">' + msg + '</div>';
  }

  async function load(reset) {
    if (busy) return;
    busy = true;
    if (reset) { page = 0; grid.innerHTML = skeleton(6); }

    try {
      var rows = await fetchPage(page);
      if (page === 0) grid.innerHTML = '';

      if (!rows.length && page === 0) {
        grid.innerHTML = note('찾으시는 작가가 없습니다. 다른 이름으로 찾아 보십시오.');
        moreBox.hidden = true;
        cntBox.innerHTML = '0명';
        busy = false;
        return;
      }

      grid.insertAdjacentHTML('beforeend', rows.map(card).join(''));
      page++;

      if (total != null) {
        cntBox.innerHTML = '<b>' + total.toLocaleString() + '</b>명' + ((q || minExh) ? ' (추린 것)' : '');
      }
      moreBox.hidden = rows.length === 0 || (total && page * PER >= total);

    } catch (e) {
      grid.innerHTML = note('자료를 불러오지 못했습니다 — ' + esc(String(e.message).slice(0, 160)));
      moreBox.hidden = true;
      cntBox.textContent = '';
    }
    busy = false;
  }

  function boot() {
    grid    = document.getElementById('slGrid');
    cntBox  = document.getElementById('slCnt');
    moreBox = document.getElementById('slMore');
    if (!grid) return;
    moreBtn = moreBox ? moreBox.querySelector('button') : null;

    var sortBox = document.getElementById('slFSort');
    if (sortBox) sortBox.addEventListener('click', function (e) {
      var b = e.target.closest('.sl-chip'); if (!b) return;
      Array.prototype.forEach.call(sortBox.querySelectorAll('.sl-chip'),
        function (x) { x.classList.toggle('on', x === b); });
      sort = b.dataset.s || 'active';
      load(true);
    });
    var minBox = document.getElementById('slFMin');
    if (minBox) minBox.addEventListener('click', function (e) {
      var b = e.target.closest('.sl-chip'); if (!b) return;
      Array.prototype.forEach.call(minBox.querySelectorAll('.sl-chip'),
        function (x) { x.classList.toggle('on', x === b); });
      minExh = Number(b.dataset.m || 0);
      load(true);
    });

    var box = document.getElementById('slQ');
    if (box) {
      var t;
      box.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { q = box.value.trim(); load(true); }, 280);
      });
    }
    if (moreBtn) moreBtn.addEventListener('click', function () { load(false); });

    load(true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();
})();
