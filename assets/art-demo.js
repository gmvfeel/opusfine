/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 대문 도판 · assets/art-demo.js
   ------------------------------------------------------------------
   대문 곳곳의 도판 자리를 <b>우리 DB</b>에서 채웁니다.
       · 작품 자리  → artworks 표
       · 작가 얼굴  → artists 표의 image_url (위키데이터 P18 · 커먼즈)

   ★★ 2026-08-23 · <b>작가 얼굴도 채웁니다</b> (파트너 지적).
     대문의 「오늘 새로 쌓인 작가」 열두 자리가 <b>줄곧 무늬</b>였습니다.
     까닭은 두 가지였습니다.
       ① 그 자리는 index.html 에 <b>이름까지 손으로 적힌 견본</b>이었습니다
          (정선·김홍도·신윤복…). DB 를 보지 않았습니다.
       ② 앞선 판에서 얼굴 자리를 아예 건너뛰게 했습니다 — 우리 DB 에
          초상이 없는 줄 알았기 때문입니다.
     ▶ 확인해 보니 <b>수집기가 이미 넣고 있었습니다.</b> 위키데이터
       P18(대표 이미지)을 받아 artists.image_url 에 담고 있습니다.
       받아 놓고 화면이 안 읽고 있었을 뿐입니다.

   ★ 이름과 생몰년도 DB 에서 받습니다. 손으로 적힌 견본을 남겨 두면
     <b>얼굴은 진짜, 이름은 가짜</b>가 되어 더 나쁩니다.

   ★ 초상이 없는 작가는 <b>고르지 않습니다</b> — 산수화를 얼굴 자리에
     넣지 않습니다. 채울 수 있는 만큼만 카드를 남기고 나머지는
     <b>지웁니다.</b> 빈 무늬가 줄줄이 남는 것보다 낫습니다.

   ★ 카드 수는 <b>열의 배수</b>로 맞춥니다. 격자가 벽돌 쌓기(column-count
     6·4·3)라 배수가 아니면 뒤쪽 열이 빕니다.

   ★★ 2026-08-23 · 자료원을 메트 API → <b>우리 DB</b>로 갈아 끼웠습니다.
     메트를 브라우저에서 직접 부르던 것이 오지 않고 있었고, 견본 그림이
     6초 뒤 되살아나 가려져 있었습니다.

   ★ 못 받은 자리는 <b>사선 무늬</b>로 남습니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var slots = Array.prototype.slice.call(document.querySelectorAll('[data-art]'));
  if (!slots.length) return;

  /* ph = 사선 무늬 · loading = 무늬 위 빛줄기
     ★ 둘을 나눈 까닭 — 빛줄기는 몇 초 뒤 멈춰야 하지만, 무늬는
       도판이 <b>실제로 닿을 때까지</b> 남아야 합니다. */
  slots.forEach(function (el) { el.classList.add('ph', 'loading'); });

  function calm(list) {
    (list || slots).forEach(function (el) { el.classList.remove('loading'); });
  }

  /* ── 다국어 도우미 ───────────────────────────────────────────
     ★ T() 는 화면 글을 사전에 태웁니다.
     ★ N() 은 <b>숫자가 낀 글</b>용입니다 — 「작품 13,799점」처럼
       숫자와 낱말이 붙은 것은 사전 열쇠로 쓸 수 없습니다.
       숫자가 바뀌면 열쇠가 달라지기 때문입니다.
       그래서 「작품 {n}점」을 열쇠로 두고 값만 끼웁니다.
     ★ i18n.js 가 아직 안 실렸으면 원문을 그대로 돌려주므로
       한국어 화면은 그대로 돕니다. */
  function T(s) { return (window.OFI18N && window.OFI18N.t) ? window.OFI18N.t(s) : s; }
  function N(tpl) {
    var args = [].slice.call(arguments);
    if (window.OFI18N && window.OFI18N.n) return window.OFI18N.n.apply(null, args);
    var vals = args.slice(1);
    return String(tpl).replace(/\{(n|\d+)\}/g, function (m, k) {
      var v = (k === 'n') ? vals[0] : vals[Number(k)];
      if (v === undefined || v === null) return m;
      if (typeof v !== 'number') return String(v);
      if (v >= 1000 && v < 3000 && v === Math.floor(v)) return String(v);
      return v.toLocaleString();
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var k = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[k]; a[k] = t;
    }
    return a;
  }

  var faces = slots.filter(function (el) { return el.getAttribute('data-art') === 'ar'; });
  var fill  = slots.filter(function (el) { return el.getAttribute('data-art') !== 'ar'; });

  if (!window.OF || !OF.SB_URL) { calm(); return; }

  var head = { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };
  function get(url) {
    return fetch(url, { headers: head })
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });
  }

  /* ── 그림 한 장 넣기 ──
     ★ 주소가 살아 있는지는 <b>불러 봐야</b> 압니다. 죽었으면 다음
       후보로 넘어갑니다 — 세 번까지만. 끝없이 매달리면 자리 하나
       때문에 브라우저가 붙잡힙니다. */
  function put(el, queue, tries, done) {
    if (!queue.length || tries <= 0) { el.classList.remove('loading'); return; }
    var row = queue.shift();
    var src = OF.img(row.image_small || row.image_url);
    if (!src) { put(el, queue, tries - 1, done); return; }

    var img = new Image();
    img.alt = row._alt || '';
    img.referrerPolicy = 'no-referrer';
    img.onload = function () {
      var svg = el.querySelector('svg');
      if (svg) svg.replaceWith(img); else el.appendChild(img);
      el.classList.remove('ph', 'loading');
      if (done) done(el, row);
    };
    img.onerror = function () { put(el, queue, tries - 1, done); };
    img.src = src;
  }

  /* ══ ① 작품 자리 ══════════════════════════════════════════════ */
  function works() {
    if (!fill.length) return;
    /* ★ hidden=not.is.true — 「=false」로 하면 <b>빈 값인 줄이 통째로
         빠집니다.</b> 오퍼스클램에서 여러 번 겪은 일입니다. */
    /* ★★ 2026-09-12 · <b>한쪽으로 쏠리는 것</b>을 고쳤습니다.
         전에는 quality 내림차순으로 60건만 받았습니다. 그러면
         <b>가장 충실한 60건</b>만 오는데, 그것이 늘 한 자료원에 몰립니다.
           · 아침 — 공유마당·클리블랜드 동양 부서라 <b>동양 일색</b>
           · 클리블랜드 회화를 담은 뒤 — 작가·재료·크기·설명이 다 있어
             quality 최고점을 받아 <b>서양 일색</b>
         자료가 바뀌면 <b>쏠리는 쪽만 바뀔 뿐</b> 늘 한쪽입니다.
       ▶ <b>자료원을 나눠</b> 고르게 받아 섞습니다.
         소장처(holder)가 자료원을 가장 잘 가릅니다 —
         공유마당·클리블랜드·메트·커먼즈가 서로 다릅니다. */
    var BASE = OF.SB_URL + '/rest/v1/artworks'
      + '?select=id,title,year_text,medium,holder,artist_name,image_url,image_small'
      + '&hidden=not.is.true&rights=eq.public&image_small=not.is.null';

    /* 자료원마다 넉넉히 받습니다. 없는 곳은 빈 채로 지나갑니다. */
    var 갈래 = [
      '&holder=like.*Cleveland*&holder_dept=in.(%22European%20Painting%20and%20Sculpture%22,%22Modern%20European%20Painting%20and%20Sculpture%22,%22American%20Painting%20and%20Sculpture%22,Drawings,Photography,%22Greek%20and%20Roman%20Art%22,%22Medieval%20Art%22,%22Art%20of%20the%20Americas%22)',
      '&holder=like.*Cleveland*&holder_dept=in.(%22Japanese%20Art%22,%22Chinese%20Art%22,%22Korean%20Art%22,%22Indian%20and%20Southeast%20Asian%20Art%22,%22Islamic%20Art%22)',
      '&gongu_sn=not.is.null',
      '&met_id=not.is.null',
      '&commons_file=not.is.null'
    ];
    /* ★ fill 은 대문에서 <b>13자리</b>입니다
         (광고 견본 5 · 히어로 1 · 미니 4 · wk 3).
         갈래마다 이 정도면 건너뛰며 나눠도 넉넉합니다. */
    var 몫 = Math.max(24, fill.length * 2);

    return Promise.all(갈래.map(function (q) {
      return get(BASE + q + '&order=quality.desc,id.asc&limit=' + 몫)
             .catch(function () { return []; });
    })).then(function (묶음) {
      /* ★ 자료원마다 <b>먼저 섞은 뒤</b> 번갈아 뽑습니다.
           그냥 이어 붙이면 앞 자료원이 앞자리를 다 차지합니다. */
      묶음.forEach(function (b) { shuffle(b); });
      var rows = [], 남음 = true, k = 0;
      while (남음) {
        남음 = false;
        for (var i = 0; i < 묶음.length; i++) {
          if (묶음[i][k]) { rows.push(묶음[i][k]); 남음 = true; }
        }
        k++;
      }
      if (!rows.length) { calm(fill); return; }
      rows.forEach(function (w) {
        w._alt = (w.artist_name ? w.artist_name + ', ' : '') + (w.title || '작품');
      });
      /* ★★ 2026-09-12 · 여기가 <b>쏠림의 진짜 원인</b>이었습니다.
           자료원을 번갈아 뽑아 rows 를
             [서양, 동양, 공유마당, 메트, 커먼즈, 서양, 동양, …]
           로 잘 섞어 놓고도, 아래에서 <b>연속한 덩어리</b>로 잘라
           나눠 주고 있었습니다 —
             자리0 → rows[0..23]   자리1 → rows[24..47] …
           한 자리는 받은 덩어리의 <b>첫 장만</b> 씁니다(나머지는 죽은
           주소일 때 넘어갈 예비). 그래서 자리0 은 늘 rows[0],
           곧 <b>첫 갈래(서양)</b>가 됩니다.
         ▶ <b>건너뛰며</b> 나눠 줍니다. 자리 i 는 i, i+5, i+10 …
           그러면 첫 장이 자리마다 다른 자료원이 됩니다.
         ★ 예비를 여럿 주는 쓸모는 그대로 살립니다. */
      var 자리수 = fill.length;
      fill.forEach(function (el, i) {
        var 몫 = [];
        for (var k = i; k < rows.length && 몫.length < 6; k += 자리수) 몫.push(rows[k]);
        put(el, 몫, 3, workCaption);
      });
    });
  }

  /* 시그니처 차례 — 작가 / 《작품명》, 연도 / 재료 / 소장처 */
  function workCaption(el, w) {
    var kind = el.getAttribute('data-art'), box = el.parentNode;
    var who = w.artist_name || '작자 미상';

    if (kind === 'hero') {
      var cap = box.querySelector('.cap');
      if (cap) {
        var q = function (s) { return cap.querySelector(s); };
        if (q('.cap-artist')) q('.cap-artist').textContent = who;
        if (q('.cap-work'))   q('.cap-work').innerHTML =
          '<em>《' + esc(w.title || '') + '》</em>'
          + (w.year_text ? ', ' + esc(w.year_text) : '');
        if (q('.cap-meta'))   q('.cap-meta').textContent = w.medium || '';
        if (q('.cap-hold'))   q('.cap-hold').textContent = w.holder || '';
      }
      var why = box.querySelector('.why');
      if (why) why.textContent =
        '날마다 쌓이는 자료 가운데 한 점을 골라 소개합니다. 저작권이 풀린 도판만 싣습니다.';
    }

    if (kind === 'mini') {
      var a = box.querySelector('.a'), t = box.querySelector('.w');
      if (a) a.textContent = who;
      if (t) t.textContent = '《' + (w.title || '') + '》';
      if (box.tagName === 'A' && w.id) box.href = '/db/work-view.html?id=' + w.id;
    }

    /* ★★ 2026-08-24 · <b>전시 카드(ex) 처리를 걷어 냈습니다.</b>
         전시DB 878건이 붙어, 대문 전시 자리는 이제
         <b>assets/home-exh.js</b> 가 진짜 전시로 채웁니다.
         그전에는 「전시 정보는 견본이고 도판만 우리 것」이라
         한 줄로 밝히며 작품 도판을 걸어 두었습니다.
       ★ 견본을 지우면서 data-art="ex" 자리도 함께 사라졌으므로
         이 코드는 이제 걸릴 일이 없습니다. */
  }

  /* ══ ② 작가 얼굴 자리 ═════════════════════════════════════════ */
  function artists() {
    if (!faces.length) return;
    /* ★ image_url=not.is.null — <b>초상이 있는 작가만</b> 부릅니다.
         없는 사람을 받아 와 봐야 얼굴 자리를 채우지 못합니다.
       ★ order=id.desc — 제목이 「오늘 새로 쌓인 작가」이므로
         <b>늦게 들어온 순</b>으로 봅니다. 제목과 내용이 달라선 안 됩니다.
       ★ 죽은 주소가 섞이므로 자리 수의 네 배쯤 넉넉히 부릅니다. */
    var url = OF.SB_URL + '/rest/v1/artists'
      + '?select=id,name_ko,name_han,life,birth_year,death_year,image_url'
      + '&hidden=not.is.true&image_url=not.is.null'
      + '&order=id.desc&limit=' + Math.max(48, faces.length * 4);

    return get(url).then(function (rows) {
      if (!rows.length) { calm(faces); return; }
      rows.forEach(function (a) { a._alt = (a.name_ko || '') + ' 도판'; });
      rows.sort(function (x, y) { return faceScore(y) - faceScore(x); });

      /* ★ 카드 수를 <b>열의 배수</b>로 맞춥니다 (격자가 6·4·3열).
           12 는 셋 모두의 배수이고, 모자라면 6 으로 내립니다.
           배수가 아니면 넓은 화면에서 뒤쪽 열이 빕니다. */
      var n = Math.min(rows.length, faces.length);
      if (n < faces.length) n = n >= 6 ? 6 : n;

      /* 못 채울 카드는 <b>지웁니다</b> — 빈 무늬를 줄줄이 남기지 않습니다 */
      faces.slice(n).forEach(function (el) {
        var card = el.closest ? el.closest('.ar') : el.parentNode;
        if (card && card.parentNode) card.parentNode.removeChild(card);
      });

      var use = faces.slice(0, n);
      var per = Math.max(2, Math.floor(rows.length / Math.max(1, use.length)));
      use.forEach(function (el, i) {
        put(el, rows.slice(i * per, i * per + per), 3, artistCard);
      });

      credit();
      freshCount();
    });
  }

  /* ── 얼굴다움 점수 ──
     ★★ 2026-08-23 · 이암 자리에 <b>모견도(母犬圖)</b>가 떴습니다
       (파트너 확인). 잘못이 아니라 <b>위키데이터의 성질</b>입니다 —
       P18 은 「초상」이 아니라 「대표 이미지」라서, 초상이 없는 옛
       화가는 <b>자기 작품</b>이 대신 들어옵니다.

     ★ 처음에는 카드마다 「작품」이라 <b>적어 주려</b> 했습니다.
       그런데 초상인지 작품인지 <b>확실히 가릴 방법이 없습니다.</b>
       강세황의 진짜 초상에 「작품」이라 잘못 붙는 쪽이, 아무 말도
       안 하는 쪽보다 나쁩니다. → <b>적지 않습니다.</b>

     ▶ 대신 <b>차례만 바꿉니다.</b> 얼굴로 보이는 것을 앞에 세우면
       열두 자리는 얼굴로 차고, 작품은 뒤로 밀려 안 나옵니다.
       틀려도 <b>순서가 흔들릴 뿐</b> 거짓말이 되지 않습니다.

     ★ 파일 이름으로 봅니다. 커먼즈 주소에 이름이 그대로 들어 있어
       따로 물어볼 것이 없습니다. */
  function faceScore(a) {
    var u = String(a.image_url || '');
    var m = /Special:FilePath\/([^?]+)/.exec(u);
    var f = m ? decodeURIComponent(m[1]).replace(/_/g, ' ') : u;
    var lo = f.toLowerCase();
    var sc = 0;

    /* 대놓고 초상이라 적힌 것 */
    if (/portrait|초상|자화상|肖像|眞影|진영|影幀|영정/i.test(f)) sc += 4;
    /* 사람 사진 */
    if (/photo|photograph|사진/i.test(lo)) sc += 2;
    /* 파일 이름이 <b>작가 이름 그대로</b> — 인물 사진일 때가 많습니다 */
    var base = f.replace(/\.[a-z0-9]+$/i, '').trim();
    if (a.name_ko && base.indexOf(a.name_ko) === 0) sc += 2;
    if (a.name_en && base.toLowerCase().indexOf(String(a.name_en).toLowerCase()) === 0) sc += 2;
    /* 그림 제목으로 보이는 것 — 뒤로 미룹니다 */
    if (/圖|도\b|畵|畫|그림|painting|paysage|landscape|scroll|screen|album|folio/i.test(f)) sc -= 3;

    return sc;
  }

  /* ★ 얼굴만 갈아 끼우고 이름을 그대로 두면 <b>얼굴은 진짜, 이름은
       가짜</b>가 됩니다. 이름·생몰년·링크를 함께 바꿉니다. */
  function artistCard(el, a) {
    var card = el.closest ? el.closest('.ar') : el.parentNode;
    if (!card) return;
    if (a.id) card.href = '/db/artist-view.html?id=' + a.id;

    var nm = card.querySelector('.nm'), yr = card.querySelector('.yr');
    if (nm) {
      nm.innerHTML = esc(a.name_ko || '')
        + (a.name_han ? ' <i style="font-weight:400;color:var(--ink-3)">'
                        + esc(a.name_han) + '</i>' : '');
    }
    if (yr) {
      yr.textContent = a.life
        || (a.birth_year ? a.birth_year + ' – ' + (a.death_year || '') : '');
    }
  }

  /* ★ 커먼즈 도판은 <b>출처를 밝혀야</b> 하는 것이 섞여 있습니다
       (CC BY-SA 등). 카드마다 붙이면 어수선하므로 격자 아래
       <b>한 줄로</b> 답니다.
     ★ 「초상 도판」이라 못박지 않습니다 — 초상이 없는 옛 화가는
       <b>대표작</b>이 실립니다. 한 줄에 그것까지 밝힙니다. */
  function credit() {
    var grid = document.querySelector('.grid-ar');
    if (!grid || grid.dataset.credited) return;
    grid.dataset.credited = '1';
    var n = document.createElement('div');
    n.className = 'artcap';
    n.style.marginTop = '2px';
    n.textContent = '작가 도판 · 위키미디어 커먼즈 — 초상이 없는 경우 대표작이 실립니다';
    grid.parentNode.insertBefore(n, grid.nextSibling);
  }

  /* ★ 「어제보다 +128명」은 <b>손으로 적힌 견본</b>이었습니다.
       진짜 수를 셀 수 있으면 넣고, 셀 수 없으면 <b>지웁니다.</b>
       거짓 숫자를 남겨 두느니 없는 편이 낫습니다.
     ★ created_at 칸이 있는지 모릅니다. 있으면 세지고, 없으면 요청이
       실패합니다 — 실패를 신호로 삼아 조용히 지웁니다. */
  function freshCount() {
    var box = document.querySelector('.sec-sub');
    if (!box || !/어제보다/.test(box.textContent)) return;
    var d = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    fetch(OF.SB_URL + '/rest/v1/artists?select=id&hidden=not.is.true'
          + '&created_at=gte.' + d + '&limit=1',
          { method: 'HEAD',
            headers: { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY,
                       Prefer: 'count=exact' } })
      .then(function (r) {
        var m = r.ok && /\/(\d+)$/.exec(r.headers.get('content-range') || '');
        /* ★ 숫자가 낀 글은 사전 열쇠가 될 수 없습니다. {n} 을 열쇠로 둡니다. */
        if (m) box.innerHTML = N('어제보다 <b style="color:var(--accent)">+{n}명</b>',
                                 Number(m[1]));
        else if (box.parentNode) box.parentNode.removeChild(box);
      })
      .catch(function () { if (box.parentNode) box.parentNode.removeChild(box); });
  }

  /* ══ 실행 ═════════════════════════════════════════════════════ */
  works();
  artists();

  /* 8초 뒤 <b>빛줄기만</b> 멈춥니다. 무늬는 그대로 둡니다. */
  setTimeout(function () { calm(); }, 8000);
})();
