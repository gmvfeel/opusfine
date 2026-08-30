/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 대문 히어로 · assets/hero.js
   ------------------------------------------------------------------
   ★★ 2026-08-23 · <b>손으로 적은 견본 넷을 걷어 냅니다.</b>
     대문 얼굴에 이런 것이 적혀 있었습니다.
       「색면과 여백 · 국립현대미술관 서울 · 2026.08.02 — 11.16」  없는 전시
       「작품 184,206 · 작가 31,470 · 전시 기록 12,885」          없는 숫자
     실제는 작품 13,798 · 작가 745 · 전시 0 입니다.
     <b>대문에 거짓이 있으면 나머지를 다 의심하게 됩니다.</b>

   ▶ 이제 <b>DB 에서 받아</b> 채웁니다.
     · 앞 석 장 — 작품이 많은 작가. 이름·생몰·글·작품 수 모두 진짜입니다.
     · 끝 한 장 — 아카이브 소개. 숫자를 <b>그때그때 세어</b> 씁니다.

   ★★★ 2026-08-24 · <b>제자리로 돌아왔습니다.</b>
     이 자리는 원래 「전시」 자리입니다 (파트너 확인 · 2026-08-23).
     오퍼스클램이 공연을 소개하듯, 여기서는 <b>실제 전시회를 무작위로
     소개하고 그 전시로 이어 주는</b> 것이 본래 역할입니다.

     전시DB 가 없어 작가 소개로 임시 대체했다가, 서울시립미술관
     전시 <b>878건</b>을 담고 되돌렸습니다.
       · 지금 열리는 전시 16건 · 878건 전부 포스터가 있습니다
       · 공공누리 제1유형 — 출처를 밝히고 씁니다

   ★ <b>지금 열리는 것을 앞세웁니다.</b> 대문에 걸 것은 지난 전시가
     아니라 오늘 가서 볼 수 있는 전시입니다.
   ★ 무작위로 고릅니다 — 올 때마다 다른 전시를 만납니다.
   ★ 전시가 없으면 <b>작가 소개로 물러섭니다</b>(아래 artistSlide).
     대문이 비는 것보다 낫습니다.

   ★ 받아 오지 못하면 히어로를 <b>통째로 감춥니다.</b>
     빈 껍데기나 옛 견본이 남는 것보다 낫습니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var box  = document.getElementById('hslide');
  var dots = document.getElementById('dots');
  var eb = document.getElementById('h-eb'), ti = document.getElementById('h-t');
  var su = document.getElementById('h-s'), me = document.getElementById('h-m');
  var hero = document.querySelector('.hero');
  if (!box || !hero || !window.OF || !OF.SB_URL) return;

  var head = { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };
  function get(u) {
    return fetch(u, { headers: head }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  /* 몇 건인지 세기 — 줄을 받지 않고 머리만 봅니다 */
  function count(q) {
    return fetch(OF.SB_URL + '/rest/v1/' + q,
      { headers: { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY,
                   Prefer: 'count=exact', Range: '0-0' } })
      .then(function (r) {
        var m = /\/(\d+)$/.exec(r.headers.get('content-range') || '');
        return m ? Number(m[1]) : 0;
      }).catch(function () { return 0; });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var num = function (n) { return Number(n || 0).toLocaleString(); };

  /* ── 전시 고르기 ────────────────────────────────────────────
     ★ 지금 열리는 것 → 곧 열릴 것 → 최근에 끝난 것 차례로 봅니다.
       셋을 합쳐 <b>넉 장</b>을 무작위로 뽑습니다.
     ★ 포스터가 없는 것은 뽑지 않습니다 — 히어로는 그림이 반입니다. */
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var k = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[k]; a[k] = t;
    }
    return a;
  }

  function pickExhibitions() {
    var today = new Date().toISOString().slice(0, 10);
    var sel = 'id,title,subtitle,venue,start_date,end_date,artists,genre,'
            + 'summary,poster_url,poster_credit,link_source';
    var base = OF.SB_URL + '/rest/v1/exhibitions?select=' + sel
             + '&hidden=not.is.true&poster_url=not.is.null';

    /* 지금 열리는 것 */
    var now = get(base + '&start_date=lte.' + today + '&end_date=gte.' + today
                       + '&order=quality.desc&limit=30').catch(function () { return []; });
    /* 곧 열릴 것 */
    var soon = get(base + '&start_date=gt.' + today
                        + '&order=start_date.asc&limit=10').catch(function () { return []; });
    /* 최근에 끝난 것 — 위가 모자랄 때만 씁니다 */
    var past = get(base + '&end_date=lt.' + today
                        + '&order=end_date.desc&limit=20').catch(function () { return []; });

    return Promise.all([now, soon, past]).then(function (r) {
      var live = shuffle(r[0].slice());
      var next = r[1] || [];
      var back = r[2] || [];
      /* ★ 지금 열리는 것을 앞에. 모자라면 곧 열릴 것, 그다음 지난 것 */
      var all = live.concat(next, back);
      var seen = {}, out = [];
      for (var i = 0; i < all.length && out.length < 4; i++) {
        var e = all[i];
        if (!e || seen[e.id]) continue;
        seen[e.id] = 1;
        e._live = (e.start_date || '') <= today && today <= (e.end_date || '');
        e._soon = (e.start_date || '') > today;
        out.push(e);
      }
      return out;
    });
  }

  /* 「2026.08.27 — 2027.02.14」 */
  function period(a, b) {
    var f = function (d) { return String(d || '').replace(/-/g, '.'); };
    if (!a && !b) return null;
    return f(a) + ' — ' + f(b).slice(5);
  }

  function exhibitionSlide(e) {
    var line = e.summary || '';
    if (line.length > 130) line = line.slice(0, 128).replace(/[,·\s]+$/, '') + '…';
    return {
      /* ★ 지금 하는지 곧 하는지 <b>한눈에</b> 보이게 합니다 */
      eb: (e._live ? '지금 열리는 전시' : (e._soon ? '곧 열리는 전시' : '지난 전시'))
        + (e.venue ? ' · ' + e.venue : ''),
      /* ★★ 2026-08-24 · 낫표가 겹쳤습니다.
             「2026년 한국 근대 거장전 《유영국》」 → 《…《유영국》》
           제목 안에 <b>이미 낫표가 있는 것</b>이 많습니다. 그런 것에는
           덧씌우지 않습니다. 수집기에서 겉낫표만 벗겼고, 가운데
           낫표는 그것이 <b>온전한 제목</b>이라 그대로 두었기 때문입니다. */
      t: (/[《》]/.test(e.title) ? esc(e.title) : '《' + esc(e.title) + '》')
       + (e.subtitle ? '<br><b>' + esc(e.subtitle) + '</b>' : ''),
      s: line,
      m: [
        period(e.start_date, e.end_date),
        e.artists ? esc(String(e.artists).split(',').slice(0, 3).join(', ')) : null,
        e.genre ? esc(String(e.genre).slice(0, 30)) : null
      ].filter(Boolean),
      /* ★ 2026-08-24 · 전시 상세 화면이 <b>생겼습니다.</b>
           우리 화면으로 받고, 더 깊은 것은 거기서 주최 기관으로 잇습니다.
           (그 전에는 주최 기관으로 곧장 보냈습니다) */
      href: '/db/exhibition-view.html?id=' + e.id,
      cta: '전시 자세히',
      tTxt: e.title,
      venue: e.venue || '',
      /* 히어로 그림 — 포스터 */
      img: e.poster_url,
      credit: e.poster_credit,
      link: e.link_source
    };
  }

  /* ── 물러설 자리 · 작품 많은 작가 ──
     ★★ 전시를 못 받았을 때만 씁니다. 대문이 비는 것보다 낫습니다.
       (2026-08-23 ~ 24 · 전시DB 가 없던 동안 이것이 히어로였습니다)
     ★ PostgREST 로는 「작가별 작품 수」를 한 번에 못 셉니다(group by 없음).
       그래서 충실도 높은 작가 몇을 받아 각각 세어 봅니다.
     ★ 작품이 <b>스무 점 넘는 사람</b>만 세웁니다 — 대문에 세울 얼굴이니
       한두 점 있는 사람을 올릴 수는 없습니다. */
  function pickArtists() {
    var url = OF.SB_URL + '/rest/v1/artists'
      + '?select=id,name_ko,name_han,life,birth_year,death_year,field,bio,image_url'
      + '&hidden=not.is.true&image_url=not.is.null&bio=not.is.null'
      + '&order=quality.desc,id.asc&limit=12';
    return get(url).then(function (rows) {
      return Promise.all(rows.map(function (a) {
        return count('artworks?select=id&hidden=not.is.true&artist_id=eq.' + a.id)
          .then(function (n) { a._n = n; return a; });
      }));
    }).then(function (rows) {
      return rows.filter(function (a) { return a._n >= 20; })
                 .sort(function (x, y) { return y._n - x._n; })
                 .slice(0, 3);
    }).catch(function () { return []; });
  }

  function artistSlide(a) {
    var life = a.life || (a.birth_year ? a.birth_year + ' – ' + (a.death_year || '') : '');
    var bio = String(a.bio || '').replace(/\s+/g, ' ').trim();
    if (bio.length > 130) bio = bio.slice(0, 128).replace(/[,·\s]+$/, '') + '…';
    return {
      eb: '아카이브 · 작가',
      t: esc(a.name_ko || '')
        + (a.name_han ? ' <b>' + esc(a.name_han) + '</b>' : ''),
      s: bio || (a.field ? a.field + '. 오퍼스파인이 모은 작품을 한자리에서 봅니다.' : ''),
      m: [
        '작품 <b>' + num(a._n) + '점</b>',
        life ? esc(life) : null,
        a.field ? esc(a.field) : null
      ].filter(Boolean),
      href: '/db/artist-view.html?id=' + a.id,
      cta: '작품 보기'
    };
  }

  /* ── 끝 한 장 · 아카이브 소개 ──
     ★ 숫자를 <b>그때그때 셉니다.</b> 적어 두면 이내 거짓이 됩니다. */
  function homeSlide() {
    return Promise.all([
      count('artworks?select=id&hidden=not.is.true'),
      count('artworks?select=id&hidden=not.is.true&image_small=not.is.null'),
      count('artists?select=id&hidden=not.is.true'),
      count('artworks?select=id&hidden=not.is.true&artist_id=not.is.null'),
      count('exhibitions?select=id&hidden=not.is.true')
    ]).then(function (n) {
      return {
        eb: 'OPUSFINE',
        t: '작품과 사람을<br><b>제대로 기록하는 곳</b>',
        s: '흩어져 있던 미술 자료를 한자리에 모읍니다. '
         + '저작권이 풀린 도판만 싣고, 출처를 밝힙니다.',
        m: ['작품 <b>' + num(n[0]) + '</b>',
            '도판 <b>' + num(n[1]) + '</b>',
            '작가 <b>' + num(n[2]) + '</b>',
            '전시 <b>' + num(n[4]) + '</b>'],
        href: '/db/work.html',
        cta: '아카이브 둘러보기'
      };
    });
  }

  /* ── 그리기 ── */
  var SLIDES = [], si = 0, stop = false, timer = null;
  var slow = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function buildDots() {
    if (!dots) return;
    dots.innerHTML = '';
    SLIDES.forEach(function (_, i) {
      var d = document.createElement('i');
      d.tabIndex = 0; d.setAttribute('role', 'tab');
      d.setAttribute('aria-label', (i + 1) + '번');
      if (i === 0) d.classList.add('on');
      d.addEventListener('click', function () { go(i); });
      d.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(i); }
      });
      dots.appendChild(d);
    });
  }

  function paint(n) {
    var d = SLIDES[n];
    box.style.opacity = '0';
    setTimeout(function () {
      if (eb) eb.textContent = d.eb;
      if (ti) ti.innerHTML = d.t;
      if (su) su.textContent = d.s;
      if (me) me.innerHTML = d.m.map(function (x) { return '<span>' + x + '</span>'; })
                                .join('<i>·</i>');
      /* 단추도 그 장에 맞춥니다 — 「전시 자세히」가 전시 없는 곳으로
         가면 안 됩니다 */
      var b1 = hero.querySelector('.hero-cta .btn');
      if (b1 && d.href) { b1.href = d.href; b1.textContent = d.cta || '자세히'; }

      /* ★★ 포스터 — 히어로 오른쪽 그림 자리(.plate)에 겁니다.
           그 자리는 art-demo.js 가 <b>작품 도판</b>으로 채우고 있는데,
           전시가 있으면 <b>전시 포스터가 앞섭니다</b>. 히어로는
           전시 자리이므로 그림도 전시의 것이어야 합니다.
         ★ 서울시립미술관 서버는 Content-Type 을 안 보냅니다.
           브라우저는 내용을 보고 알아서 그리므로 그냥 겁니다. */
      var plate = document.querySelector('.hero .plate');
      if (plate && d.img) {
        plate.classList.remove('ph', 'loading');
        plate.innerHTML = '<img src="' + esc(d.img) + '" alt="' + esc(d.eb) +
          '" referrerpolicy="no-referrer" loading="eager">';
        var cap = document.querySelector('.hero .cap');
        if (cap) {
          var q = function (x) { return cap.querySelector(x); };
          if (q('.cap-artist')) q('.cap-artist').textContent = d.venue || '';
          if (q('.cap-work'))   q('.cap-work').innerHTML = '<em>' + d.tTxt + '</em>';
          if (q('.cap-meta'))   q('.cap-meta').textContent = d.m[0] || '';
          /* ★ 출처 표시 — 공공누리 제1유형은 <b>밝혀야</b> 씁니다 */
          if (q('.cap-hold'))   q('.cap-hold').textContent = d.credit || '';
        }
        var why = document.querySelector('.hero .why');
        if (why) why.textContent = d.link
          ? '전시 정보는 주최 기관에서 받은 것입니다.' : '';
      }
      box.style.opacity = '1';
    }, slow ? 0 : 280);
    if (dots) Array.prototype.forEach.call(dots.children, function (el, i) {
      el.classList.toggle('on', i === n);
    });
  }
  function go(n) { si = (n + SLIDES.length) % SLIDES.length; paint(si); }

  Promise.all([pickExhibitions(), pickArtists(), homeSlide()]).then(function (r) {
    var exh = (r[0] || []).map(exhibitionSlide);
    /* ★★ 전시가 있으면 <b>전시만</b> 세웁니다 + 끝에 아카이브 소개 한 장.
         전시가 없으면 작가로 물러섭니다. */
    SLIDES = exh.length ? exh.concat([r[2]])
                        : (r[1] || []).map(artistSlide).concat([r[2]]);
    /* ★ 아무것도 못 받으면 <b>통째로 감춥니다.</b> 옛 견본이 남는 것보다
         낫습니다 — 그것이 오늘 하루 화면을 거짓말시킨 방식입니다. */
    if (!SLIDES.length) { hero.style.display = 'none'; return; }

    box.style.transition = 'opacity .28s ease';
    buildDots();
    paint(0);

    if (!slow && SLIDES.length > 1) {
      timer = setInterval(function () { if (!stop) go(si + 1); }, 7200);
    }
    hero.addEventListener('mouseenter', function () { stop = true; });
    hero.addEventListener('mouseleave', function () { stop = false; });
    hero.addEventListener('focusin',   function () { stop = true; });
    hero.addEventListener('focusout',  function () { stop = false; });
  }).catch(function () { hero.style.display = 'none'; });
})();
