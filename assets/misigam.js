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

   ══════════════════════════════════════════════════════════════════
   ★★ 2026-09-14 · 미시감 화면을 직접 뜯어 <b>재본</b> 것들 (misg.co.kr)

     미시감도 Supabase 를 씁니다 — <b>inhfubtnnlpkivjtikty</b>.supabase.co
     (오퍼스파인 jmankqdbvyrnyhxjmqsa 와 <b>다른 프로젝트</b>입니다).

     미시감 자신이 이렇게 부릅니다(네트워크 기록에서 그대로 옮김) —
       /rest/v1/artworks
         ?select=*,images:artwork_images(id,role,r2_key,sort_order),
                 artwork_keywords(keyword)
         &artist_id=eq.{uuid}
         &status=in.(published,on_sale,sold)
         &order=published_at.desc

     ▶ 표 이름  artworks · 이미지는 <b>별도 표</b> artwork_images
     ▶ 상태 칸  status — published · on_sale · sold
     ▶ 차례 칸  published_at
     ▶ 확인된 칸 id(uuid) · title · code · artist_id · status · published_at
     ▶ 이미지   r2_key 는 <b>절대 주소가 아닙니다.</b> 앞에 호스트를 붙입니다 —
                https://img.misg.co.kr/ + r2_key
                실제 꼴 : artworks/{작품uuid}/main-0-{숫자}.webp
                role='main' 인 것이 대표 그림입니다.
     ▶ 작품 주소 https://misg.co.kr/artworks/{id}

     ★ <b>아직 모르는 것 둘</b> — 개발자께 여쭈어야 합니다(docs/미시감_연동_요청서.md)
       · <b>가격</b> 칸 이름 (price 인지 sale_price 인지 · 숫자인지 글자인지)
       · <b>작가 이름</b> — artworks 에 artist_id(uuid) 만 있습니다.
         어느 표를 참조하는지(profiles? artists?), 이름 칸이 무엇인지.
       아래 F 에 자리를 비워 두었습니다. 알게 되면 그 줄만 고치십시오.

     ★ 2026-09-14 기준 <b>소장 가능 원화가 9점</b>뿐이고 「[시험] 여백의 온도」
       같은 시험 자료가 섞여 있습니다. <b>스무 점쯤 쌓인 뒤에</b> 켜십시오.
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
  /* ── 미시감 연결 나사 ────────────────────────────────────────────
     ★ 고칠 것은 <b>여기 넷</b>뿐입니다. 아래 fetchWorks 본문은 손대지 마십시오. */
  var MS = {
    url: 'https://inhfubtnnlpkivjtikty.supabase.co/rest/v1',   /* 재봄 · 2026-09-14 */
    key: '',            /* ← 읽기 전용 anon 키. <b>비어 있으면 구역이 안 뜹니다.</b> */
    img: 'https://img.misg.co.kr/',                            /* 재봄 · r2_key 앞에 붙임 */
    site: 'https://misg.co.kr/artworks/'                       /* 재봄 · 작품 주소 */
  };
  /* 칸 이름 — 확인된 것은 그대로, 모르는 것은 <b>여러 이름을 차례로</b> 봅니다.
     맞는 이름을 아시게 되면 그 줄만 남기고 나머지는 지우십시오. */
  var F = {
    price:  ['price', 'sale_price', 'amount', 'price_krw'],    /* ← 아직 모름 */
    artist: ['artist_name', 'artist', 'nickname', 'name']      /* ← 아직 모름 */
  };

  function pick(o, names) {
    for (var i = 0; i < names.length; i++) {
      var v = o[names[i]];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return null;
  }

  async function fetchWorks() {
    if (!MS.key) return [];      /* 열쇠가 없으면 조용히 물러섭니다 */

    /* ★ status 는 <b>on_sale 만</b> 겁니다 — 미시감 자신은 published·sold 도
         함께 받지만, 대문에 「지금 살 수 있는 작품」이라 적어 두었으므로
         팔린 것을 걸면 거짓말이 됩니다. */
    var u = MS.url + '/artworks'
          + '?select=*,images:artwork_images(role,r2_key,sort_order)'
          + '&status=eq.on_sale'
          + '&order=published_at.desc'
          + '&limit=' + N;

    var r = await fetch(u, { headers: { apikey: MS.key,
                                        Authorization: 'Bearer ' + MS.key } });
    if (!r.ok) return [];
    var rows = await r.json();
    if (!Array.isArray(rows)) return [];

    return rows.map(function (w) {
      /* 대표 그림 — role 이 main 인 것, 없으면 sort_order 가 가장 앞선 것 */
      var imgs = (w.images || []).slice().sort(function (a, b) {
        return (a.sort_order || 0) - (b.sort_order || 0);
      });
      var main = imgs.filter(function (x) { return x.role === 'main'; })[0] || imgs[0];

      return {
        title:  w.title || '무제',
        artist: pick(w, F.artist) || '',
        price:  pick(w, F.price),
        image:  main && main.r2_key ? MS.img + main.r2_key : null,
        href:   MS.site + w.id
      };
    });
  }

  /* ── 견본 보기 ──────────────────────────────────────────────────
     ★ 주소 뒤에 <b>?misigam=demo</b> 를 붙였을 때만 뜹니다.
         https://opusfine.vercel.app/?misigam=demo

       평소 주소로는 <b>절대 뜨지 않습니다</b> — 손님에게 가짜가 보이면 안 됩니다.
       오늘 리쿠르트 구역에서 겪은 일입니다(견본이 평소 화면에 섞여 있으면
       대문 전체를 못 믿게 됩니다). 주소로 가려 두면 안전합니다.

     ★ 무엇을 보시는 것인가 — <b>모양과 자리</b>입니다.
       칸 크기 · 몇 점이 한 줄에 들어가는지 · 가격이 어떻게 보이는지 ·
       제목이 긴 것이 잘리는지 · 좁은 화면에서 어떻게 접히는지.

     ★ 이미지는 오퍼스파인 작품 DB 에서 빌려 씁니다(새로 만들지 않았습니다).
       작가 이름·작품 이름·가격은 <b>지어낸 것</b>입니다 — 실제 미시감 자료가 아닙니다.

     ▶ 실제 자료가 오면 이 블록(demoWorks 와 아래 isDemo 줄)을 <b>지우십시오.</b> */
  async function demoWorks() {
    /* ★ 작가 이름과 제목이 <b>둘 다 있는</b> 것만 씁니다.
         처음엔 order=id.desc 로 뽑았더니 같은 제목이 세 번 나오고
         작가 이름이 전부 비어 볼썽사나웠습니다 — 모양 판정이 안 됩니다.
       ★ 볼 때마다 다른 작품이 뜨도록 <b>아무 데서나</b> 집습니다. */
    var skip = Math.floor(Math.random() * 20000);
    var u = OF.SB_URL + '/rest/v1/artworks'
          + '?select=id,title,artist_name,image_url'
          + '&hidden=not.is.true&image_url=not.is.null'
          + '&artist_id=not.is.null'
          + '&title=neq.&artist_name=neq.'
          + '&order=id.asc&offset=' + skip + '&limit=' + N;
    var r = await fetch(u, { headers: { apikey: OF.SB_KEY,
                                        Authorization: 'Bearer ' + OF.SB_KEY } });
    if (!r.ok) return [];
    var rows = await r.json();
    var price = [180000, 350000, 90000, 1200000, 450000, 260000, 75000, 620000];
    return rows.map(function (w, i) {
      return {
        title:  w.title || '무제',
        artist: w.artist_name || '작가 미상',
        price:  price[i % price.length],
        image:  w.image_url,
        href:   '#',
        demo:   true
      };
    });
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
    return '<a class="ms-w' + (w.demo ? ' ms-demo' : '') + '"'
         + ' href="' + esc(w.href || '#') + '"'
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

    /* ★★ 2026-09-14 · 견본을 <b>평소 주소에서도</b> 보입니다(파트너 판정).
         아직 정식으로 문을 연 상태가 아니라, 자리와 모양을 먼저 굳히는 편이 낫습니다.
         ▶ 실제 미시감 자료가 오면 아래 한 줄을 false 로 바꾸거나
           demoWorks 블록째 지우십시오. 그러면 fetchWorks() 만 씁니다.
         ▶ <b>문을 열기 전에 반드시 끄십시오.</b> 손님에게 지어낸 가격이 보입니다. */
    var isDemo = true;

    var works = [];
    try {
      works = isDemo ? await demoWorks() : await fetchWorks();
    } catch (e) { works = []; }

    /* ★ 비어 있으면 구역을 통째로 숨깁니다 — 빈 칸을 남기지 않습니다.
         미시감이 죽어도 오퍼스파인 대문은 멀쩡합니다. */
    if (!works.length) {
      var sec = document.getElementById('misigam');
      if (sec) sec.style.display = 'none';
      return;
    }

    var sec3 = document.getElementById('misigam');
    if (sec3) sec3.style.display = '';        /* 대문은 기본이 숨김입니다 */

    box.innerHTML = works.slice(0, N).map(card).join('');

    if (isDemo) {
      var sec2 = document.getElementById('misigam');
      if (sec2) {
        sec2.classList.add('is-demo');
        var sub = sec2.querySelector('.sec-sub');
        if (sub) sub.textContent = '견본 · 실제 미시감 자료가 아닙니다';
        var note = sec2.querySelector('.ms-note');
        if (note) note.innerHTML = '<b>견본 화면입니다.</b> 그림은 오퍼스파인 작품 DB 에서 '
          + '빌려 온 것이고, 작가 이름과 가격은 지어낸 것입니다. '
          + '미시감 연동이 끝나면 실제 판매작으로 바뀝니다.';
      }
    }
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', render);
  else render();
})();
