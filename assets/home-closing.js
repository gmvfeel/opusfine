/* ════════════════════════════════════════════════════════════════════
   끝나가는 전시 · 2026-09-14

   리쿠르트 구역에서 「인재」 칸을 접고 그 자리에 세웁니다.

   ★ 왜 이것인가
     리쿠르트 구역이 세로로 절반 비어 있었습니다. 그런데 그 구역은 채용도 인재도
     <b>전부 견본</b>입니다 — 자료원이 아직 없습니다. 견본이 오래 걸려 있으면
     대문 전체를 못 믿게 됩니다. 위쪽(전시·작품·작가)은 다 실제 자료인데 말입니다.
     ▶ 그래서 <b>실제 자료가 있는 것</b>만 넣습니다.

   ★ 왜 하필 「끝나가는 전시」인가
     아카이브가 해 줄 수 있는 말 중에 「이 전시는 이번 주에 끝납니다」만큼
     쓸모 있는 것이 드뭅니다. 지금 열린 전시를 보여 주는 자리는 이미 위에 있지만,
     <b>언제까지</b>인지를 앞세우는 자리는 없었습니다.

   ★ 자료 (2026-09-14 실측)
     이번 주 마감 35건 · 보름 안 마감 69건 · 그 69건 <b>전부 포스터가 있습니다</b>.
     넉넉합니다.

   ★ 지난 전시는 걸지 않습니다. 오늘 가서 볼 수 있는 것만 겁니다.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var N = 6;
  var BOX = 'closing-list';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 남은 날 — 오늘 끝나는 것은 「오늘까지」.
     ★ 날짜 셈은 <b>글자로</b> 합니다. new Date 로 하면 시간대 때문에
       하루가 밀립니다(히어로에서 이미 겪은 일 · hero.js 주석). */
  function dday(endStr, todayStr) {
    if (!endStr) return '';
    var a = Date.UTC(+endStr.slice(0, 4), +endStr.slice(5, 7) - 1, +endStr.slice(8, 10));
    var b = Date.UTC(+todayStr.slice(0, 4), +todayStr.slice(5, 7) - 1, +todayStr.slice(8, 10));
    var d = Math.round((a - b) / 86400000);
    if (d <= 0) return '오늘까지';
    if (d === 1) return '내일까지';
    return 'D-' + d;
  }

  function row(e, today) {
    var left = dday(e.end_date, today);
    /* 사흘 안쪽이면 눈에 띄게 — 공모 구역의 .dday 와 같은 결입니다 */
    var a = Date.UTC(+e.end_date.slice(0, 4), +e.end_date.slice(5, 7) - 1, +e.end_date.slice(8, 10));
    var b = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
    var soon = Math.round((a - b) / 86400000) <= 3;

    var where = e.venue || e.organizer || '';
    /* ★ .lst li 는 <li> 바로 안에 span 을 두는 구조입니다(공모 구역과 같음) —
         .k(왼쪽 딱지) · .t(제목) · .dday(오른쪽). <a> 로 감싸면 흐트러집니다.
         제목만 링크로 둡니다. */
    /* ★ .k 는 폭 62px 고정에 대문자 변환이라 장소 이름에 안 맞습니다
         (「국립현대미술관」이 잘립니다). 장소는 제목 아래 작은 줄로 둡니다. */
    return '<li>'
         + '<span class="t cl-t">'
         + '<a href="/db/exhibition-view.html?id=' + encodeURIComponent(e.id) + '">'
         + esc(e.title || '제목 없음') + '</a>'
         + (where ? '<span class="cl-v">' + esc(where) + '</span>' : '')
         + '</span>'
         + '<span class="dday' + (soon ? ' now' : '') + '">' + esc(left) + '</span>'
         + '</li>';
  }

  async function render() {
    var box = document.getElementById(BOX);
    if (!box || !window.OF || !OF.SB_URL) return;

    var today = new Date().toISOString().slice(0, 10);
    /* 보름 안에 끝나는 것 중 마감이 가까운 차례.
       ★ kind_final='art' — 박물관·역사 전시가 걸리지 않게 합니다(히어로와 같은 규칙). */
    var u = OF.SB_URL + '/rest/v1/exhibitions'
          + '?select=id,title,venue,organizer,end_date'
          + '&hidden=not.is.true&kind_final=eq.art'
          + '&start_date=lte.' + today
          + '&end_date=gte.' + today
          + '&end_date=lte.' + new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
          + '&order=end_date.asc&limit=' + N;

    try {
      var r = await fetch(u, { headers: { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var rows = await r.json();
      if (!rows.length) {         /* 없으면 구역을 숨깁니다 — 빈 칸을 남기지 않습니다 */
        var g = document.getElementById('closing');
        if (g) g.style.display = 'none';
        return;
      }
      box.innerHTML = '<ul>' + rows.map(function (e) { return row(e, today); }).join('') + '</ul>';
    } catch (e) {
      var g2 = document.getElementById('closing');
      if (g2) g2.style.display = 'none';
    }
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', render);
  else render();
})();
