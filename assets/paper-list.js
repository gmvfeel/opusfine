/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 학술 논문 목록 · assets/paper-list.js · 2026-10-01
   ------------------------------------------------------------------
   exhibition-list.js 의 「지역 추리개를 DB 에서 받아 만든다」는 생각과
   venue-list.js 의 쪽매김 얼개를 섞었습니다. 지키는 것은 같습니다 —
     · hidden 은 not.is.true 로 거릅니다 (is.false 아닙니다)
     · 한 번에 받는 건 PER 개뿐 · 0줄일 때만 끝으로 봅니다
     · 받아오지 못하면 견본을 두지 않고 실패했다고 적습니다

   ★ 주제(topic) 추리개는 DB 에서 세어 만듭니다 — 손으로 적으면
     나중에 다른 subfield 가 더해질 때 어긋납니다.
   ★ 차례는 두 가지 — 많이 인용된순(cited_by_count.desc) ·
     최신순(year.desc.nullslast). 학술 자료는 「중요도」와 「새 것」
     둘 다 뜻이 있어 작가·작품처럼 한 가지로 못박지 않았습니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.OF || !OF.SB_URL) return;

  var PER = 30;
  var grid, cntBox, moreBox, moreBtn, topicBox;
  var page = 0, total = 0, busy = false;
  var q = '', topic = '', sort = 'cited';

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
    p.push('select=id,title,authors,year,venue,topic,doi,url,is_oa,cited_by_count');
    p.push('hidden=not.is.true');
    if (topic) p.push('topic=eq.' + encodeURIComponent(topic));
    if (q) {
      var w = '*' + q.replace(/[*(),]/g, '') + '*';
      p.push('or=(title.ilike.' + w + ',authors.ilike.' + w + ')');
    }
    p.push(sort === 'year'
      ? 'order=year.desc.nullslast,cited_by_count.desc'
      : 'order=cited_by_count.desc,year.desc.nullslast');
    return OF.SB_URL + '/rest/v1/papers?' + p.join('&');
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

  function card(p) {
    var title = /[《》]/.test(p.title) ? esc(p.title) : esc(p.title || '(제목 없음)');
    var href = '/db/paper-view.html?id=' + encodeURIComponent(p.id);
    var meta = [];
    if (p.year) meta.push(p.year);
    if (p.venue) meta.push(esc(p.venue));
    if (p.topic) meta.push(esc(p.topic));
    meta.push('인용 ' + (p.cited_by_count || 0).toLocaleString());
    if (p.is_oa) meta.push('<span class="oa">오픈액세스</span>');

    var h = '<a class="sl-item" href="' + href + '">';
    h += '<span class="sl-nm">' + title + '</span>';
    if (p.authors) h += '<span class="sl-au">' + esc(p.authors) + '</span>';
    h += '<span class="sl-meta">' + meta.join('<i>·</i>') + '</span>';
    h += '</a>';
    return h;
  }

  function skeleton(n) {
    var h = '';
    for (var i = 0; i < n; i++) {
      h += '<div class="sl-skel"><span style="width:58%"></span>'
         + '<span style="width:38%"></span></div>';
    }
    return h;
  }

  function note(msg) {
    return '<div class="demo-note">' + msg + '</div>';
  }

  async function load(reset) {
    if (busy) return;
    busy = true;
    if (reset) { page = 0; grid.innerHTML = skeleton(6); }

    try {
      var rows = await fetchPage(page);
      if (page === 0) grid.innerHTML = '';

      if (!rows.length && page === 0) {
        grid.innerHTML = note('찾으시는 논문이 없습니다. 다른 말이나 주제로 찾아 보십시오.');
        moreBox.hidden = true;
        cntBox.innerHTML = '0건';
        busy = false;
        return;
      }

      grid.insertAdjacentHTML('beforeend', rows.map(card).join(''));
      page++;

      if (total != null) {
        cntBox.innerHTML = '<b>' + total.toLocaleString() + '</b>건' + ((q || topic) ? ' (추린 것)' : '');
      }
      moreBox.hidden = rows.length === 0 || (total && page * PER >= total);

    } catch (e) {
      grid.innerHTML = note('자료를 불러오지 못했습니다 — ' + esc(String(e.message).slice(0, 160)));
      moreBox.hidden = true;
      cntBox.textContent = '';
    }
    busy = false;
  }

  /* ── 주제 추리개 — DB 에서 세어 만듭니다 ── */
  async function buildTopics() {
    if (!topicBox) return;
    var rows = [];
    try {
      rows = await get(OF.SB_URL + '/rest/v1/papers'
        + '?select=topic&hidden=not.is.true&topic=not.is.null&limit=4000');
    } catch (e) { return; }
    var cnt = {};
    rows.forEach(function (r) {
      var v = String(r.topic || '').trim();
      if (v) cnt[v] = (cnt[v] || 0) + 1;
    });
    Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })
      .slice(0, 10)
      .forEach(function (v) {
        var b = document.createElement('button');
        b.className = 'sl-chip';
        b.dataset.t = v;
        b.textContent = v;
        b.title = v + ' · ' + cnt[v] + '건';
        topicBox.appendChild(b);
      });
  }

  function boot() {
    grid    = document.getElementById('slGrid');
    cntBox  = document.getElementById('slCnt');
    moreBox = document.getElementById('slMore');
    topicBox = document.getElementById('slFTopic');
    if (!grid) return;
    moreBtn = moreBox ? moreBox.querySelector('button') : null;

    var sortBox = document.getElementById('slFSort');
    if (sortBox) sortBox.addEventListener('click', function (e) {
      var b = e.target.closest('.sl-chip'); if (!b) return;
      Array.prototype.forEach.call(sortBox.querySelectorAll('.sl-chip'),
        function (x) { x.classList.toggle('on', x === b); });
      sort = b.dataset.s || 'cited';
      load(true);
    });
    if (topicBox) topicBox.addEventListener('click', function (e) {
      var b = e.target.closest('.sl-chip'); if (!b) return;
      Array.prototype.forEach.call(topicBox.querySelectorAll('.sl-chip'),
        function (x) { x.classList.toggle('on', x === b); });
      topic = b.dataset.t || '';
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

    buildTopics();
    load(true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();
})();
