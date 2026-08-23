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

   ★★★ 이 자리는 <b>원래 「전시」 자리입니다</b> (파트너 확인 · 2026-08-23).
     오퍼스클램이 공연을 소개하듯, 여기서는 <b>실제 전시회를 무작위로
     소개하고 그 전시로 이어 주는</b> 것이 본래 역할입니다.
     「전시 자세히」 단추도 그래서 있었습니다.

   ▶ 지금은 전시DB 가 없어 <b>작가 소개로 임시 대체</b>한 것입니다.
     전시DB 가 생기면 <b>되돌려야 합니다</b> —
       · SLIDES 를 exhibitions 표에서 받아 채우고
       · 단추를 「전시 자세히」로 되돌리고
       · 아래 artistSlide 는 지우거나 뒤로 물립니다
     ★ 작가 소개가 나쁜 것이 아니라, <b>자리의 뜻이 다릅니다.</b>
       전시인 척하지 않으려다 자리의 성격까지 바꾼 것이었습니다.

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

  /* ── 앞 석 장 · 작품 많은 작가 ──
     ★ PostgREST 로는 「작가별 작품 수」를 한 번에 못 셉니다(group by 없음).
       그래서 <b>충실도 높은 작가 몇을 받아 각각 세어</b> 봅니다.
       열 번쯤 세는 것이라 대문이 느려지지 않습니다.
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
      count('artworks?select=id&hidden=not.is.true&artist_id=not.is.null')
    ]).then(function (n) {
      return {
        eb: 'OPUSFINE',
        t: '작품과 사람을<br><b>제대로 기록하는 곳</b>',
        s: '흩어져 있던 미술 자료를 한자리에 모읍니다. '
         + '저작권이 풀린 도판만 싣고, 출처를 밝힙니다.',
        m: ['작품 <b>' + num(n[0]) + '</b>',
            '도판 <b>' + num(n[1]) + '</b>',
            '작가 <b>' + num(n[2]) + '</b>',
            '작가와 이어진 작품 <b>' + num(n[3]) + '</b>'],
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
      box.style.opacity = '1';
    }, slow ? 0 : 280);
    if (dots) Array.prototype.forEach.call(dots.children, function (el, i) {
      el.classList.toggle('on', i === n);
    });
  }
  function go(n) { si = (n + SLIDES.length) % SLIDES.length; paint(si); }

  Promise.all([pickArtists(), homeSlide()]).then(function (r) {
    var arts = r[0].map(artistSlide);
    SLIDES = arts.concat([r[1]]);
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
