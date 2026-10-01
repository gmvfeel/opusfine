/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 용어사전 목록 · assets/glossary-list.js · 2026-10-01
   ------------------------------------------------------------------
   paper-list.js 의 주제 추리개(DB 에서 세어 만들기)와 school-list.js 의
   쪽매김 얼개를 섞었습니다. 지키는 것은 같습니다 —
     · hidden 은 not.is.true 로 거릅니다
     · 한 번에 받는 건 PER 개뿐 · 0줄일 때만 끝으로 봅니다
     · 받아오지 못하면 견본을 두지 않고 실패했다고 적습니다

   ★ 뜻풀이가 평균 392자로 짧아, 전시공간처럼 따로 상세 화면을 두지
     않고 목록 카드에 <b>뜻풀이 전문</b>을 그대로 보여 줍니다.
   ★ 분류(category) 추리개는 DB 에서 세어 만듭니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.OF || !OF.SB_URL) return;

  var PER = 24;
  var grid, cntBox, moreBox, moreBtn, catBox;
  var page = 0, total = 0, busy = false;
  var q = '', cat = '';

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
  async function get(u) {
    var r = await fetch(u, { headers: head() });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  }

  function query() {
    var p = [];
    p.push('select=term_ko,term_en,category,definition_ko');
    p.push('hidden=not.is.true');
    if (cat) p.push('category=eq.' + encodeURIComponent(cat));
    if (q) {
      var w = '*' + q.replace(/[*(),]/g, '') + '*';
      p.push('or=(term_ko.ilike.' + w + ',term_en.ilike.' + w + ',definition_ko.ilike.' + w + ')');
    }
    p.push('order=term_ko.asc');
    return OF.SB_URL + '/rest/v1/glossary?' + p.join('&');
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

  function card(g) {
    var h = '<div class="sl-item">';
    h += '<span class="sl-nm">' + esc(g.term_ko || '(이름 없음)')
      + (g.term_en ? '<span class="sl-en">' + esc(g.term_en) + '</span>' : '') + '</span>';
    if (g.definition_ko) h += '<span class="sl-def">' + esc(g.definition_ko) + '</span>';
    if (g.category) h += '<span class="sl-cat">' + esc(g.category) + '</span>';
    h += '</div>';
    return h;
  }

  function skeleton(n) {
    var h = '';
    for (var i = 0; i < n; i++) {
      h += '<div class="sl-skel"><span style="width:30%"></span>'
         + '<span style="width:92%"></span><span style="width:70%"></span></div>';
    }
    return h;
  }

  function note(msg) {
    return '<div class="demo-note">' + msg + '</div>';
  }

  async function load(reset) {
    if (busy) return;
    busy = true;
    if (reset) { page = 0; grid.innerHTML = skeleton(5); }

    try {
      var rows = await fetchPage(page);
      if (page === 0) grid.innerHTML = '';

      if (!rows.length && page === 0) {
        grid.innerHTML = note('찾으시는 용어가 없습니다. 다른 말로 찾아 보십시오.');
        moreBox.hidden = true;
        cntBox.innerHTML = '0개';
        busy = false;
        return;
      }

      grid.insertAdjacentHTML('beforeend', rows.map(card).join(''));
      page++;

      if (total != null) {
        cntBox.innerHTML = '<b>' + total.toLocaleString() + '</b>개' + ((q || cat) ? ' (추린 것)' : '');
      }
      moreBox.hidden = rows.length === 0 || (total && page * PER >= total);

    } catch (e) {
      grid.innerHTML = note('자료를 불러오지 못했습니다 — ' + esc(String(e.message).slice(0, 160)));
      moreBox.hidden = true;
      cntBox.textContent = '';
    }
    busy = false;
  }

  async function buildCats() {
    if (!catBox) return;
    var rows = [];
    try {
      rows = await get(OF.SB_URL + '/rest/v1/glossary'
        + '?select=category&hidden=not.is.true&category=not.is.null&limit=2000');
    } catch (e) { return; }
    var cnt = {};
    rows.forEach(function (r) {
      var v = String(r.category || '').trim();
      if (v) cnt[v] = (cnt[v] || 0) + 1;
    });
    Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })
      .slice(0, 10)
      .forEach(function (v) {
        var b = document.createElement('button');
        b.className = 'sl-chip';
        b.dataset.c = v;
        b.textContent = v;
        b.title = v + ' · ' + cnt[v] + '건';
        catBox.appendChild(b);
      });
  }

  function boot() {
    grid    = document.getElementById('slGrid');
    cntBox  = document.getElementById('slCnt');
    moreBox = document.getElementById('slMore');
    catBox  = document.getElementById('slFCat');
    if (!grid) return;
    moreBtn = moreBox ? moreBox.querySelector('button') : null;

    if (catBox) catBox.addEventListener('click', function (e) {
      var b = e.target.closest('.sl-chip'); if (!b) return;
      Array.prototype.forEach.call(catBox.querySelectorAll('.sl-chip'),
        function (x) { x.classList.toggle('on', x === b); });
      cat = b.dataset.c || '';
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

    buildCats();
    load(true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();
})();
