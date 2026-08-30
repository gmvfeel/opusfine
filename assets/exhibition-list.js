/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 전시 목록 · assets/exhibition-list.js
   ------------------------------------------------------------------
   ★★ 2026-08-24 · 서울시립미술관 전시 878건을 담고 만들었습니다.
     그동안 머리 메뉴의 「전시」가 눌러도 갈 데가 없었습니다.

   ★ <b>지금 열리는 것</b>이 기본입니다. 전시는 때가 있는 자료라
     지난 것을 먼저 보이면 소용이 없습니다.
   ★ 끝나는 날이 <b>2주 안</b>이면 D-일을 답니다 — 「가서 볼 수 있는
     곳」이라는 것을 알리는 자리입니다.
   ★ 장소 추리개는 <b>DB 에서 받아</b> 만듭니다. 손으로 적으면
     분관이 늘 때마다 어긋납니다.
   ★ 손으로 적은 견본을 두지 않습니다 — 어제 작가·작품 화면에서
     견본이 그대로 거짓이 되는 일을 겪었습니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.OF || !OF.SB_URL) return;

  var $ = function (id) { return document.getElementById(id); };
  var head = { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };
  var SEL = 'id,title,subtitle,venue,start_date,end_date,artists,genre,'
          + 'summary,poster_url,link_source,quality';
  var PAGE = 24;

  var today = new Date().toISOString().slice(0, 10);
  var state = { when: 'live', venue: '', q: '', from: 0, done: false };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var num = function (n) { return Number(n || 0).toLocaleString(); };

  async function get(u) {
    var r = await fetch(u, { headers: head });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  }
  async function count(cond) {
    try {
      var r = await fetch(OF.SB_URL + '/rest/v1/exhibitions?select=id&hidden=not.is.true'
        + (cond || '') + '&limit=1',
        { headers: { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY,
                     Prefer: 'count=exact', Range: '0-0' } });
      var m = /\/(\d+)$/.exec(r.headers.get('content-range') || '');
      return m ? Number(m[1]) : 0;
    } catch (e) { return 0; }
  }

  /* ── 질의 만들기 ──
     ★ 「때」에 따라 조건과 <b>차례</b>가 달라집니다.
         지금 열림 — 끝나는 날이 <b>가까운 것</b>부터 (곧 끝나니까)
         곧 열림   — 시작하는 날이 가까운 것부터
         지난 전시 — 끝난 날이 <b>가까운 것</b>부터 (최근 것부터) */
  function query() {
    var p = [SEL ? 'select=' + SEL : '', 'hidden=not.is.true'];
    if (state.when === 'live') {
      p.push('start_date=lte.' + today, 'end_date=gte.' + today, 'order=end_date.asc');
    } else if (state.when === 'soon') {
      p.push('start_date=gt.' + today, 'order=start_date.asc');
    } else if (state.when === 'past') {
      p.push('end_date=lt.' + today, 'order=end_date.desc');
    } else {
      p.push('order=end_date.desc');
    }
    if (state.venue) p.push('venue=eq.' + encodeURIComponent(state.venue));
    if (state.q) {
      /* ★ 제목과 참여작가를 함께 봅니다 — 「유영국」으로 찾으면
           그 사람 전시가 나와야 합니다. */
      var k = encodeURIComponent('*' + state.q + '*');
      p.push('or=(title.ilike.' + k + ',artists.ilike.' + k + ',subtitle.ilike.' + k + ')');
    }
    p.push('limit=' + PAGE, 'offset=' + state.from);
    return OF.SB_URL + '/rest/v1/exhibitions?' + p.filter(Boolean).join('&');
  }

  /* 「2026.08.27 — 2027.02.14」 · 같은 해면 뒤는 월일만 */
  function period(a, b) {
    if (!a && !b) return '';
    var f = function (d) { return String(d || '').replace(/-/g, '.'); };
    if (!a) return '~ ' + f(b);
    if (!b) return f(a) + ' ~';
    return f(a) + ' — ' + (String(a).slice(0, 4) === String(b).slice(0, 4)
                           ? f(b).slice(5) : f(b));
  }

  /* 며칠 남았나 */
  function daysLeft(end) {
    if (!end) return null;
    var d = Math.round((new Date(end + 'T00:00:00') - new Date(today + 'T00:00:00')) / 864e5);
    return isFinite(d) ? d : null;
  }

  function flagOf(e) {
    var live = (e.start_date || '') <= today && today <= (e.end_date || '');
    var soon = (e.start_date || '') > today;
    if (live) {
      var d = daysLeft(e.end_date);
      /* ★ 2주 안에 끝나면 D-일 — 서두를 까닭을 알립니다 */
      if (d != null && d <= 14) return { cls: 'dday', txt: d === 0 ? '오늘 끝' : 'D-' + d };
      return { cls: 'live', txt: '지금 열림' };
    }
    if (soon) {
      var s = daysLeft(e.start_date);
      return { cls: 'soon', txt: (s != null && s <= 30) ? s + '일 뒤' : '곧 열림' };
    }
    return { cls: 'past', txt: '지난 전시' };
  }

  function card(e) {
    var f = flagOf(e);
    var pic = e.poster_url
      ? '<img src="' + esc(e.poster_url) + '" alt="' + esc(e.title) +
        '" referrerpolicy="no-referrer" loading="lazy">'
      : '<span class="none">포스터가 아직 없습니다</span>';
    /* ★ 제목에 이미 낫표가 든 것이 많습니다 — 덧씌우지 않습니다 */
    var t = /[《》]/.test(e.title) ? esc(e.title) : '《' + esc(e.title) + '》';
    return '<a class="ex" href="/db/exhibition-view.html?id=' + e.id + '">'
      + '<span class="po"><span class="flag ' + f.cls + '">' + f.txt + '</span>' + pic + '</span>'
      + '<span class="tx">'
      +   '<span class="tt">' + t
      +     (e.subtitle ? ' <i style="font-style:normal;font-size:12.5px;color:var(--ink-3)">'
                          + esc(e.subtitle) + '</i>' : '') + '</span>'
      +   '<span class="dt">' + esc(period(e.start_date, e.end_date)) + '</span>'
      +   (e.venue ? '<span class="vn">' + esc(e.venue) + '</span>' : '')
      +   (e.artists ? '<span class="ar">' +
          esc(String(e.artists).split(',').slice(0, 4).join(', ')) + '</span>' : '')
      + '</span></a>';
  }

  /* ── 장소 추리개 — DB 에서 받아 만듭니다 ── */
  async function buildVenues() {
    var box = $('fVenue');
    if (!box) return;
    var rows = [];
    try {
      rows = await get(OF.SB_URL + '/rest/v1/exhibitions'
        + '?select=venue&hidden=not.is.true&venue=not.is.null&limit=1000');
    } catch (e) { return; }
    var cnt = {};
    rows.forEach(function (r) {
      var v = String(r.venue || '').trim();
      if (v) cnt[v] = (cnt[v] || 0) + 1;
    });
    /* ★ 많은 곳 여섯만. 「기타」처럼 뜻 없는 것은 뒤로 갑니다 */
    Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })
      .filter(function (v) { return v !== '기타'; })
      .slice(0, 6)
      .forEach(function (v) {
        var b = document.createElement('button');
        b.className = 'chip';
        b.dataset.v = v;
        b.textContent = v.replace(/^서울시립\s*/, '').replace(/미술관$/, '') || v;
        b.title = v;
        box.appendChild(b);
      });
  }

  /* ── 그리기 ── */
  var grid, moreBtn, busy = false;

  async function load(reset) {
    if (busy) return;
    busy = true;
    if (reset) { state.from = 0; state.done = false; grid.innerHTML = ''; }
    if (moreBtn) { moreBtn.disabled = true; moreBtn.textContent = '불러오는 중…'; }

    var rows = [];
    try { rows = await get(query()); }
    catch (e) {
      grid.innerHTML = '<div class="empty">전시를 불러오지 못했습니다.<br>'
        + '잠시 뒤 다시 열어 주세요.</div>';
      busy = false;
      if (moreBtn) moreBtn.hidden = true;
      return;
    }

    if (!rows.length && state.from === 0) {
      grid.innerHTML = '<div class="empty">'
        + (state.q ? '「' + esc(state.q) + '」에 맞는 전시가 없습니다.'
                   : '해당하는 전시가 없습니다.')
        + '<br>위 추리개를 바꿔 보세요.</div>';
    } else {
      grid.insertAdjacentHTML('beforeend', rows.map(card).join(''));
    }

    state.from += rows.length;
    state.done = rows.length < PAGE;
    if (moreBtn) {
      moreBtn.hidden = state.done;
      moreBtn.disabled = false;
      moreBtn.textContent = '더 보기';
    }
    busy = false;
  }

  async function paintCount() {
    var box = $('cnt');
    if (!box) return;
    var n = await Promise.all([
      count(''),
      count('&start_date=lte.' + today + '&end_date=gte.' + today),
      count('&start_date=gt.' + today)
    ]);
    box.innerHTML = '모두 <b>' + num(n[0]) + '</b>건 · '
      + '지금 열리는 전시 <b>' + num(n[1]) + '</b>건'
      + (n[2] ? ' · 곧 열리는 전시 <b>' + num(n[2]) + '</b>건' : '');
  }

  function bind() {
    var when = $('fWhen'), venue = $('fVenue'), q = $('q');
    if (when) when.addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      Array.prototype.forEach.call(when.querySelectorAll('.chip'),
        function (x) { x.classList.toggle('on', x === b); });
      state.when = b.dataset.w || 'all';
      load(true);
    });
    if (venue) venue.addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      Array.prototype.forEach.call(venue.querySelectorAll('.chip'),
        function (x) { x.classList.toggle('on', x === b); });
      state.venue = b.dataset.v || '';
      load(true);
    });
    if (q) {
      var t = null;
      q.addEventListener('input', function () {
        clearTimeout(t);
        /* ★ 글자마다 묻지 않습니다 — 손을 멈춘 뒤에 한 번 */
        t = setTimeout(function () { state.q = q.value.trim(); load(true); }, 320);
      });
    }
    if (moreBtn) moreBtn.addEventListener('click', function () { load(false); });
  }

  function boot() {
    grid = $('grid'); moreBtn = $('more');
    if (!grid) return;
    /* 주소에 ?venue= 나 ?q= 가 있으면 받습니다 */
    var p = new URLSearchParams(location.search);
    if (p.get('when')) state.when = p.get('when');
    if (p.get('venue')) state.venue = p.get('venue');
    if (p.get('q')) { state.q = p.get('q'); if ($('q')) $('q').value = state.q; }

    bind();
    buildVenues();
    paintCount();
    load(true).then(function () {
      /* ★ 지금 열리는 것이 없으면 <b>지난 전시로</b> 물러섭니다.
           빈 화면을 보이는 것보다 낫습니다. */
      if (state.when === 'live' && state.from === 0) {
        var b = document.querySelector('#fWhen .chip[data-w="past"]');
        if (b) b.click();
      }
    });
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
