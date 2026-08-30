/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 전시 상세 · assets/exhibition-view.js
   ------------------------------------------------------------------
   ★★ 2026-08-24 · 히어로의 「전시 자세히」가 <b>우리 화면이 아니라</b>
     주최 기관으로 곧장 나갔습니다. 전시 상세가 없었기 때문입니다.
     이제 우리 화면으로 받고, 더 깊은 것은 주최 기관으로 잇습니다.

   ★★★ <b>관람 안내는 우리가 말하지 않습니다.</b>
     시간·요금은 바뀌는 자료입니다. 우리 것이 낡으면 사람을 헛걸음
     시킵니다. 값이 있으면 보이되 <b>「주최 기관에서 확인」</b>을 함께
     답니다. 없으면 <b>아예 안 씁니다</b> — 빈 칸에 「미정」이라 적으면
     그것도 정보인 척하게 됩니다.

   ★ 없는 칸은 <b>구역째 감춥니다.</b> 어제 작가·작품 화면에서
     견본이 그대로 거짓이 되는 일을 겪었습니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.OF || !OF.SB_URL) return;

  var $ = function (id) { return document.getElementById(id); };
  var head = { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };
  var today = new Date().toISOString().slice(0, 10);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  async function get(u) {
    var r = await fetch(u, { headers: head });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  }
  function show(id, on) { var e = $(id); if (e) e.hidden = !on; }

  /* ── 조사 고르기 ──
     ★★ 2026-08-24 · 「미술아카이브<b>이</b> 공개한」이 나왔습니다.
       받침이 없는 말에 「이」를 붙인 것입니다.
     ★ 마지막 글자의 <b>받침</b>을 보고 고릅니다. 한글은 코드가
       규칙적이라 (글자 - 가) % 28 이 0 이면 받침이 없습니다.
     ★ 한글이 아니면(영문·숫자) 괄호로 둘 다 적습니다 —
       「Parr(이)가」. 억지로 하나를 고르면 틀립니다. */
  function josa(word, withJong, without) {
    var w = String(word || '').trim();
    if (!w) return without;
    var c = w.charCodeAt(w.length - 1);
    if (c >= 0xAC00 && c <= 0xD7A3)
      return ((c - 0xAC00) % 28) ? withJong : without;
    /* 숫자는 읽는 소리로 봅니다 — 1·3·6·7·8·0 은 받침이 있습니다 */
    if (c >= 0x30 && c <= 0x39)
      return ('136780'.indexOf(w[w.length - 1]) >= 0) ? withJong : without;
    return without + '(' + withJong + ')';
  }

  function period(a, b) {
    if (!a && !b) return '';
    var f = function (d) { return String(d || '').replace(/-/g, '.'); };
    if (!a) return '~ ' + f(b);
    if (!b) return f(a) + ' ~';
    return f(a) + ' — ' + (String(a).slice(0, 4) === String(b).slice(0, 4)
                           ? f(b).slice(5) : f(b));
  }
  function daysLeft(end) {
    if (!end) return null;
    var d = Math.round((new Date(end + 'T00:00:00') - new Date(today + 'T00:00:00')) / 864e5);
    return isFinite(d) ? d : null;
  }
  function flagOf(e) {
    var live = (e.start_date || '') <= today && today <= (e.end_date || '');
    if (live) {
      var d = daysLeft(e.end_date);
      if (d != null && d <= 14) return { cls: 'dday', txt: d === 0 ? '오늘 끝납니다' : 'D-' + d };
      return { cls: 'live', txt: '지금 열리는 전시' };
    }
    if ((e.start_date || '') > today) {
      var s = daysLeft(e.start_date);
      return { cls: 'soon', txt: (s != null && s <= 60) ? s + '일 뒤 시작' : '곧 열리는 전시' };
    }
    return { cls: 'past', txt: '지난 전시' };
  }

  /* ── 사실 칸 ──
     ★ <b>값이 있는 것만</b> 넣습니다. 「미정」이라 적지 않습니다 —
       빈 칸을 채우려 적은 말도 정보인 척하게 됩니다. */
  function facts(e) {
    var box = $('facts');
    if (!box) return;
    var rows = [];
    var add = function (k, v) {
      if (v == null || String(v).trim() === '') return;
      rows.push('<div class="xv-fact"><span class="xv-k">' + esc(k) + '</span>'
              + '<span class="xv-v">' + v + '</span></div>');
    };
    add('기간', esc(period(e.start_date, e.end_date)));
    add('장소', esc(e.venue) + (e.venue_dept ? ' · ' + esc(e.venue_dept) : ''));
    add('참여작가', esc(e.artists));
    add('갈래', esc(e.genre));
    if (e.work_count) add('출품작', '<b>' + Number(e.work_count).toLocaleString() + '</b>점');
    add('주최·후원', esc(e.organizer));
    /* ★ 관람 안내 — 바뀌는 자료라 <b>확인하라</b>고 함께 답니다 */
    if (String(e.open_time || '').trim())
      add('관람시간', esc(e.open_time)
        + '<i style="font-style:normal;font-size:11px;color:var(--ink-3)"> · 주최 기관 확인</i>');
    if (String(e.charge || '').trim())
      add('관람료', esc(e.charge)
        + '<i style="font-style:normal;font-size:11px;color:var(--ink-3)"> · 주최 기관 확인</i>');
    box.innerHTML = rows.join('');
  }

  function paint(e) {
    document.title = e.title + ' — OPUSFINE';

    /* 빵부스러기에 장소를 넣어 목록으로 돌아갈 길을 냅니다 */
    var bc = $('bc');
    if (bc && e.venue) {
      bc.insertAdjacentHTML('beforeend',
        ' / <a href="/db/exhibition.html?venue=' + encodeURIComponent(e.venue) + '">'
        + esc(e.venue) + '</a>');
    }

    var f = flagOf(e);
    var fl = $('flag');
    /* ★ 여기는 <b>문자열</b>이라 이름 바꾸기에서 빠졌습니다. 우리 것으로 못박습니다. */
    if (fl) { fl.className = 'xv-flag xv-' + f.cls; fl.textContent = f.txt; }

    /* ★ 제목에 이미 낫표가 든 것이 많습니다 — 덧씌우지 않습니다 */
    var tt = $('tt');
    if (tt) tt.innerHTML = /[《》]/.test(e.title) ? esc(e.title) : '《' + esc(e.title) + '》';

    if (e.subtitle) { $('sub').textContent = e.subtitle; show('sub', true); }

    /* 짧은 소개는 위에, 원문은 아래 구역에 */
    if (e.summary) { $('lead').textContent = e.summary; show('lead', true); }

    /* 포스터 */
    var po = $('po');
    if (po) {
      po.innerHTML = e.poster_url
        ? '<img src="' + esc(e.poster_url) + '" alt="' + esc(e.title) +
          '" referrerpolicy="no-referrer">'
        : '<span class="xv-none">포스터가 아직 없습니다</span>';
    }
    /* ★★ 출처 표시 — 공공누리 제1유형은 <b>밝혀야</b> 씁니다.
         담아 두고 화면에 안 내면 지키지 않은 것이 됩니다. */
    var pc = $('pcap');
    if (pc && e.poster_credit) pc.textContent = '포스터 · ' + e.poster_credit;

    facts(e);

    /* 단추 */
    var acts = $('acts');
    if (acts) {
      var b = [];
      if (e.link_source)
        b.push('<a href="' + esc(e.link_source) + '" target="_blank" rel="noopener">'
             + '주최 기관에서 보기 →</a>');
      b.push('<a class="xv-ghost" href="/db/exhibition.html">전시 목록</a>');
      if (e.artists)
        b.push('<a class="xv-ghost" href="/db/artist.html?q='
             + encodeURIComponent(String(e.artists).split(',')[0].trim()) + '">'
             + '참여작가 찾기</a>');
      acts.innerHTML = b.join('');
    }

    /* ★★ 2026-08-24 · 여기서 <b>두 가지</b>가 어긋났습니다.
       ① 이름 바꾸기가 <b>DB 칸 이름까지</b> 건드렸습니다 —
          e.body 가 e.xv-body 가 되어 늘 빈 값이었습니다.
          클래스 이름과 DB 칸 이름이 <b>둘 다 body</b> 였던 탓입니다.
          ▶ 앞으로 클래스는 접두사를 붙이되, <b>점 뒤에 오는 것</b>은
            건드리지 않습니다.
       ② 「요약과 같으면 감춘다」로는 못 걸렀습니다. 요약은 원문의
          <b>앞부분을 잘라 만든 것</b>이라 같을 수가 없습니다.
          ▶ 원문이 요약보다 <b>뚜렷하게 길 때만</b> 보입니다. */
    var body = String(e.body || '').trim();
    var sm = String(e.summary || '').trim();
    if (body && body.length > sm.length + 40) {
      /* ★★ 2026-08-24 · 두 칸으로 나누면서 <b>문단을 만들어</b> 넣습니다.
           textContent 로 넣으면 글이 한 덩이라 문단이 칸 사이에서
           아무 데서나 끊깁니다. 빈 줄로 갈라 <p> 로 세웁니다. */
      $('body').innerHTML = body.split(/\n\s*\n/)
        .map(function (x) { return x.trim(); })
        .filter(Boolean)
        .map(function (x) { return '<p>' + esc(x).replace(/\n/g, '<br>') + '</p>'; })
        .join('');
      var bn = $('bodynote');
      var who = e.venue || '주최 기관';
      if (bn) bn.innerHTML = '이 글은 <b>' + esc(who) + '</b>'
        + josa(who, '이', '가') + ' 공개한 것을 그대로 옮긴 것입니다 · '
        + (e.poster_credit ? esc(e.poster_credit) : '공공누리 제1유형');
      show('sec-body', true);
    }
  }

  /* ── 같은 곳의 다른 전시 ──
     ★ 같은 장소가 모자라면 <b>지금 열리는 전시</b>로 채웁니다.
       빈 구역을 남기지 않되, 무엇으로 채웠는지 제목에 밝힙니다. */
  async function more(e) {
    var grid = $('moreGrid');
    if (!grid) return;
    var sel = 'id,title,venue,start_date,end_date,poster_url';
    var rows = [];
    var by = '같은 곳의 다른 전시';

    if (e.venue) {
      try {
        rows = await get(OF.SB_URL + '/rest/v1/exhibitions?select=' + sel
          + '&hidden=not.is.true&venue=eq.' + encodeURIComponent(e.venue)
          + '&id=neq.' + e.id + '&order=end_date.desc&limit=8');
      } catch (err) { }
    }
    if (rows.length < 4) {
      by = '지금 열리는 다른 전시';
      try {
        var add = await get(OF.SB_URL + '/rest/v1/exhibitions?select=' + sel
          + '&hidden=not.is.true&start_date=lte.' + today + '&end_date=gte.' + today
          + '&id=neq.' + e.id + '&order=end_date.asc&limit=8');
        var seen = {};
        rows.forEach(function (r) { seen[r.id] = 1; });
        add.forEach(function (r) { if (!seen[r.id]) { seen[r.id] = 1; rows.push(r); } });
      } catch (err) { }
    }
    if (!rows.length) { show('sec-more', false); return; }

    var t = $('moreTitle');
    if (t) t.textContent = by;

    grid.innerHTML = rows.slice(0, 8).map(function (r) {
      var pic = r.poster_url
        ? '<img src="' + esc(r.poster_url) + '" alt="' + esc(r.title) +
          '" referrerpolicy="no-referrer" loading="lazy">'
        : '<span class="xv-none"></span>';
      var ti = /[《》]/.test(r.title) ? esc(r.title) : '《' + esc(r.title) + '》';
      return '<a class="xv-mx" href="/db/exhibition-view.html?id=' + r.id + '">'
        + '<span class="xv-f">' + pic + '</span>'
        + '<span class="xv-n">' + ti + '</span>'
        + '<span class="xv-d">' + esc(period(r.start_date, r.end_date)) + '</span></a>';
    }).join('');
    show('sec-more', true);
  }

  async function boot() {
    var id = new URLSearchParams(location.search).get('id');
    /* ★ 숫자만 받습니다 — 주소에 적힌 것을 그대로 질의에 넣지 않습니다 */
    if (!id || !/^\d+$/.test(id)) { show('empty', true); return; }

    var rows = [];
    try {
      rows = await get(OF.SB_URL + '/rest/v1/exhibitions'
        + '?select=*&hidden=not.is.true&id=eq.' + id + '&limit=1');
    } catch (e) { }
    if (!rows.length) { show('empty', true); return; }

    show('main', true);
    paint(rows[0]);
    await more(rows[0]);
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
