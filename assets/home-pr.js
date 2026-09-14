/* ════════════════════════════════════════════════════════════════════
   작가 소개 · 2026-09-14

   커뮤니티 구역 안 「작가 소개」 넉 장을 채웁니다.

   ★★ 이 자리의 <b>본래 주인은 작가회원</b>입니다(파트너 확인).
     기성작가만이 아니라 오퍼스파인에 <b>작가로 등록한 회원</b>을 함께
     무작위로 보이는 자리입니다 — 오퍼스클램과 같은 방식.
     그런데 <b>회원 구조가 아직 없습니다</b>(members 표 없음).
   ▶ 회원 표가 생기면 아래 fetchMembers 만 채우십시오.
     회원이 앞서고, 모자란 만큼 아카이브가 채웁니다. 나머지는 그대로 둡니다.

   ★ 걷어낸 것 — 견본 넷(이수현·박도연·정하람·윤가온). DB 에 없는 사람들이었습니다.

   ★★ 문구도 바꿨습니다(index.html). 「이번 주에 인사를 건넨 작가들」은
     <b>회원이 직접 쓴 말</b>을 뜻하는데, 지금 DB 소개문은 위키데이터가 붙인
     설명문입니다 — 「네덜란드의 삽화가 (1927-2017)」. 그대로 두면
     작고한 분이 「이번 주에 인사를 건넸다」가 됩니다.

   ★ 고른 조건 — 초상 + 분야가 <b>둘 다</b> 있는 작가.
     소개문(bio)은 <b>걸지 않습니다.</b> 재보니 소개문이 있는 작가가 2,647명인데
     거의 다 「미국의 만화가」 같은 한 줄이라 화면에 쓸모가 없습니다.
     대신 <b>분야·국적</b>을 보입니다. 조건을 만족하는 작가 — 재보기 바랍니다.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var N = 4;
  var BOX = 'pr-row';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 분야 — 위키데이터가 열 개씩 주기도 합니다. 앞 둘만 씁니다.
     ★ 「화가, 데생화가, 시각 예술가, 그래픽 예술가, 조각가, 사진가, 예술가, …」
       를 그대로 찍으면 카드가 터집니다(실제로 딕 브루너는 열세 개였습니다). */
  function field2(f) {
    if (!f) return '';
    return String(f).split(',').map(function (x) { return x.trim(); })
                    .filter(Boolean).slice(0, 2).join(' · ');
  }

  /* 나라 — 「일본, 일본 제국」처럼 여럿인 것이 있어 앞 하나만 */
  function nat1(n) {
    if (!n) return '';
    return String(n).split(',')[0].trim();
  }

  function card(a) {
    var meta = [field2(a.field), nat1(a.nationality)].filter(Boolean).join(' · ');
    var life = a.life || (a.birth_year
      ? a.birth_year + ' – ' + (a.death_year || '') : '');

    return '<a class="pr" href="/db/artist-view.html?id=' + encodeURIComponent(a.id) + '">'
         + '<span class="pf"><img src="' + esc(a.image_url) + '" alt=""'
         + ' loading="lazy" referrerpolicy="no-referrer"></span>'
         + '<span><span class="pn">' + esc(a.name_ko || a.name_en) + '</span>'
         + '<span class="pm">' + esc(meta) + '</span>'
         + '<span class="pw">' + esc(life) + '</span></span>'
         + '</a>';
  }

  /* ── 회원 작가 — 회원 구조가 생기면 여기를 채우십시오 ──────────────
     돌려줄 모양은 아래 아카이브 쪽과 같습니다 —
       { id, name_ko, name_en, field, nationality, image_url, life }
     회원이 넷이면 아카이브는 부르지 않습니다. */
  async function fetchMembers() {
    return [];
  }

  /* ── 아카이브 작가 ─────────────────────────────────────────────── */
  async function fetchArtists(need) {
    if (need <= 0) return [];

    /* ★ 볼 때마다 다른 작가가 뜨도록 <b>아무 데서나</b> 집습니다.
         PostgREST 에는 무작위 정렬이 없어 offset 으로 대신합니다.
         조건에 맞는 작가는 <b>14,365명</b>입니다(2026-09-14 실측).

       ★★ offset 한 자리에서 넷을 잇달아 받으면 <b>비슷한 사람만 뭉칩니다</b> —
         처음에 order=quality.desc,id.asc 로 넷을 받았더니
         「1962년생 만화가」 넷이 나왔습니다(스베인 뉘우스·그레이엄 놀런·
         에릭 라슨·스티브 딜런). 나란히 담긴 사람들이라 그렇습니다.
         ▶ 그래서 <b>한 번에 넉넉히 받아 섞은 뒤</b> 넷을 고릅니다.
           차례도 id 로 두어 특정 무리가 앞서지 않게 합니다. */
    var skip = Math.floor(Math.random() * 13000);

    var u = OF.SB_URL + '/rest/v1/artists'
          + '?select=id,name_ko,name_en,field,nationality,image_url,life,birth_year,death_year'
          + '&hidden=not.is.true&kind=eq.person'
          + '&image_url=not.is.null'
          + '&field=not.is.null'
          + '&order=id.asc'
          + '&offset=' + skip + '&limit=40';

    try {
      var r = await fetch(u, { headers: { apikey: OF.SB_KEY,
                                          Authorization: 'Bearer ' + OF.SB_KEY } });
      if (!r.ok) return [];
      var rows = await r.json();
      if (!Array.isArray(rows) || !rows.length) return [];

      for (var i = rows.length - 1; i > 0; i--) {      /* 섞기 */
        var k = Math.floor(Math.random() * (i + 1));
        var t = rows[i]; rows[i] = rows[k]; rows[k] = t;
      }
      return rows.slice(0, need);
    } catch (e) { return []; }
  }

  async function render() {
    var box = document.getElementById(BOX);
    if (!box || !window.OF || !OF.SB_URL) return;

    var list = [];
    try { list = await fetchMembers(); } catch (e) { list = []; }
    if (list.length < N) {
      var more = await fetchArtists(N - list.length);
      list = list.concat(more);
    }

    /* 아무것도 못 받으면 제목까지 함께 숨깁니다 — 빈 칸을 남기지 않습니다 */
    if (!list.length) {
      box.style.display = 'none';
      var hd = document.getElementById('pr-hd');
      if (hd) hd.style.display = 'none';
      return;
    }

    box.innerHTML = list.slice(0, N).map(card).join('');
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', render);
  else render();
})();
