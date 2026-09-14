/* ════════════════════════════════════════════════════════════════════
   미시감 판매작 구역 · 2026-09-14

   대문 히어로 바로 아래, 「오늘의 소장품」 위에 섭니다.
   미시감(misigam)은 신진·아마추어 작가의 작품을 파는 자매 플랫폼입니다.

   ★ 왜 이 자리인가
     오퍼스파인이 오늘 작가 3만 3천 명을 담았지만 거의 다 위키데이터에서 온
     기성·작고 작가입니다. <b>지금 살아서 그리고 있는 사람</b>이 대문에 설 자리가
     없었습니다. 미시감이 그 자리입니다.
     리쿠르트 아래(맨 밑)도 살폈지만 광고 바로 위라 아무도 안 봅니다 — 파트너 지적.

   ★ 아카이브와 커머스를 섞는 일이라 경계를 분명히 합니다
     · 구역을 따로 세웁니다 (소장품과 같은 칸에 두지 않습니다)
     · <b>가격을 반드시 보입니다</b> — 가격이 보이면 성격이 한눈에 갈립니다
     · 작품마다 「미시감」 출처를 답니다 (작가 화면의 자료원 표시와 같은 결)
     · 미시감이 죽거나 정책이 바뀌면 이 파일 하나만 빼면 구역이 사라집니다

   ══════════════════════════════════════════════════════════════════
   ★★★ 지금은 <b>견본</b>입니다 — 자료 통로가 아직 없습니다

     미시감은 <b>오퍼스파인과 다른 Supabase</b>를 씁니다(파트너 확인 · 2026-09-14).
     다른 개발자가 만드는 중이라 주소·열쇠·칸 이름을 아직 받지 못했습니다.

     ▶ 받으시면 <b>fetchWorks() 하나만</b> 갈아 끼우십시오. 나머지는 그대로 둡니다.
       아래 fetchWorks() 안에 붙일 자리를 적어 두었습니다.
     ▶ 무엇을 받아야 하는지는 docs/미시감_연동_요청서.md 에 있습니다.

     ★ 열쇠를 화면에 박으면 <b>누구나 봅니다</b>. 반드시 읽기 전용이어야 하고
       RLS 로 「판매 중인 작품」만 열려 있어야 합니다. 요청서 2장을 보십시오.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var N = 8;                 /* 대문에 거는 점수 */
  var BOX = 'misigam-row';   /* 격자 자리 */

  /* ── 자료 ────────────────────────────────────────────────────────
     ★ 여기만 갈아 끼우면 됩니다.

     받으실 것은 아래 일곱 칸입니다(이름이 다르면 이 안에서 맞춰 주십시오) —
       title · artist · price · image · href · status · created_at

     Supabase 라면 이런 모양이 됩니다 —

       var MS_URL = 'https://xxxx.supabase.co/rest/v1';
       var MS_KEY = '읽기 전용 anon 키';
       async function fetchWorks() {
         var u = MS_URL + '/works?select=id,title,artist,price,image,href'
               + '&status=eq.on_sale&order=created_at.desc&limit=' + N;
         var r = await fetch(u, { headers: { apikey: MS_KEY,
                                             Authorization: 'Bearer ' + MS_KEY } });
         if (!r.ok) return [];
         return (await r.json()).map(function (w) {
           return { title: w.title, artist: w.artist, price: w.price,
                    image: w.image, href: w.href };
         });
       }

     ★ 받아 오지 못하면 <b>빈 배열</b>을 주십시오. 구역이 통째로 안 뜹니다 —
       대문에 깨진 자리가 남는 것보다 낫습니다(아래 render 첫 줄). */
  async function fetchWorks() {
    return [];   /* ← 연동 전까지 비어 있습니다. 구역이 뜨지 않습니다. */
  }

  /* ── 그리기 ──────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 가격 — 숫자로 오면 원 단위로 찍고, 글자로 오면 그대로 둡니다.
     ★ 「가격 문의」처럼 숫자가 아닌 것도 옵니다. 함부로 0원으로 만들지 마십시오. */
  function won(p) {
    if (p == null || p === '') return '';
    if (typeof p === 'number') return p.toLocaleString('ko-KR') + '원';
    var n = String(p).replace(/[^\d]/g, '');
    return n ? Number(n).toLocaleString('ko-KR') + '원' : String(p);
  }

  function card(w) {
    var img = w.image
      ? '<span class="ms-th"><img src="' + esc(w.image) + '" alt="" loading="lazy"></span>'
      : '<span class="ms-th ms-th-none"></span>';
    return '<a class="ms-w" href="' + esc(w.href || '#') + '"'
         + ' target="_blank" rel="noopener noreferrer">'
         + img
         + '<span class="ms-t">' + esc(w.title || '무제') + '</span>'
         + '<span class="ms-a">' + esc(w.artist || '') + '</span>'
         + '<span class="ms-p">' + esc(won(w.price)) + '</span>'
         + '</a>';
  }

  async function render() {
    var box = document.getElementById(BOX);
    if (!box) return;

    var works = [];
    try { works = await fetchWorks(); } catch (e) { works = []; }

    /* ★ 비어 있으면 구역을 통째로 숨깁니다 — 빈 칸을 남기지 않습니다.
         미시감이 죽어도 오퍼스파인 대문은 멀쩡합니다. */
    if (!works.length) {
      var sec = document.getElementById('misigam');
      if (sec) sec.style.display = 'none';
      return;
    }

    box.innerHTML = works.slice(0, N).map(card).join('');
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', render);
  else render();
})();
