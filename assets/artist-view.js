/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 작가 상세 · assets/artist-view.js
   ------------------------------------------------------------------
   주소의 ?id= 로 artists 표에서 한 사람을 읽어 화면을 채웁니다.

   ★★ 오늘(2026-08-22) 오퍼스클램에서 값을 치르고 배운 것

     ① <b>화면에 그려진 것을 읽지 말고 DB 에서 직접 읽습니다.</b>
        상세 화면 HTML 에는 자료가 오기 전까지 <b>보기용 견본</b>이
        박혀 있습니다. 그것을 진짜 값으로 알고 읽거나 다른 자리로
        옮기면, 자료가 와서 덮인 뒤에도 견본이 살아남습니다.

     ② <b>자료가 없는 구역은 감춥니다.</b> 견본을 남겨 두면 거짓이 되고,
        빈 채로 두면 화면이 허전합니다. 작품·전시·소장처·학술은
        아직 표가 없으므로 통째로 감춥니다.

     ③ hidden 은 `not.is.true` 로 거릅니다. `is.false` 로 하면
        빈 값인 줄이 통째로 빠집니다.

   ★ 지금 큰 그림 자리에 놓이는 것은 <b>작가 초상</b>입니다.
     대표작 도판이 아닙니다 — 작품DB 가 생기면 대표작으로 바꿉니다.
     그때까지는 캡션에 「초상」이라고 정직하게 적습니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function hide(id) { var e = $(id); if (e) e.style.display = 'none'; }

  /* ── 조사 고르기 ──
     ★ 「작품·전시<b>은</b>」이 나왔습니다. 받침 없는 말에 「은」을
       붙인 것입니다. 마지막 글자의 <b>받침</b>을 보고 고릅니다.
     ★ 한글이 아니면 괄호로 둘 다 적습니다 — 억지로 고르면 틀립니다. */
  function josa(word, withJong, without) {
    var w = String(word || '').trim();
    if (!w) return without;
    var c = w.charCodeAt(w.length - 1);
    if (c >= 0xAC00 && c <= 0xD7A3)
      return ((c - 0xAC00) % 28) ? withJong : without;
    if (c >= 0x30 && c <= 0x39)
      return ('136780'.indexOf(w[w.length - 1]) >= 0) ? withJong : without;
    return without + '(' + withJong + ')';
  }
  function show(id) { var e = $(id); if (e) e.style.display = ''; }

  var head = { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };

  async function get(url) {
    var r = await fetch(url, { headers: head });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160));
    return await r.json();
  }

  /* ── 없는 사람 ── */
  function notFound(msg) {
    var n = $('pv-name');
    if (n) n.textContent = '찾지 못했습니다';
    var e = $('pv-en');
    if (e) e.textContent = msg || '주소가 잘못되었거나 감춰진 작가입니다.';
    ['pv-cap', 'pv-marks', 'pv-facts', 'sec-bio', 'sec-works', 'sec-exh',
     'sec-hold', 'sec-rel', 'sec-paper', 'sec-more', 'sec-ad'].forEach(hide);
    var p = $('pv-plate'); if (p) p.style.display = 'none';
    var d = $('demo-note'); if (d) d.style.display = 'none';
  }

  /* ── 머리 ── */
  function paintHead(a) {
    document.title = a.name_ko + ' — 작가 · OPUSFINE';

    var bc = $('bc');
    if (bc) bc.innerHTML = '<a href="/">홈</a> / <a href="/db/artist.html">아카이브</a> / '
                         + '<a href="/db/artist.html">작가</a> / ' + esc(a.name_ko);

    var nm = $('pv-name');
    if (nm) nm.innerHTML = esc(a.name_ko)
      + (a.name_han ? ' <span class="han">' + esc(a.name_han) + '</span>' : '');

    var en = $('pv-en');
    if (en) {
      var bits = [];
      if (a.name_en) bits.push(esc(a.name_en));
      if (a.life) bits.push(esc(a.life));
      else if (a.birth_year) bits.push(a.birth_year + ' –');
      if (a.nationality) bits.push(esc(String(a.nationality).split(',')[0].trim()));
      en.textContent = bits.join(' · ');
    }

    /* 표 — 있는 것만 답니다. 빈 칸을 늘어놓으면 자료가 없어 보입니다 */
    var mk = $('pv-marks');
    if (mk) {
      var m = '';
      if (a.is_oc) m += '<span class="oc-badge">OC</span>';
      mk.innerHTML = m;
      if (!m) mk.style.display = 'none';
    }

    var fx = $('pv-facts');
    if (fx) {
      var rows = [];
      var add = function (k, v) { if (v) rows.push('<div><dt>' + k + '</dt><dd>' + v + '</dd></div>'); };
      add('분야',      a.field ? esc(a.field) : null);
      add('갈래',      a.genre ? esc(a.genre) : null);
      add('재료·매체', a.medium ? esc(a.medium) : null);
      add('사조',      a.era_name ? esc(a.era_name) : null);
      add('생몰',      a.life ? esc(a.life) : (a.birth_year ? a.birth_year + ' –' : null));
      add('국적',      a.nationality ? esc(a.nationality) : null);
      add('호',        a.art_name ? esc(a.art_name) : null);
      add('대표작',    a.rep_work ? esc(a.rep_work) : null);
      if (a.link_wiki)
        rows.push('<div><dt>바깥 자료</dt><dd><a href="' + esc(a.link_wiki) +
                  '" target="_blank" rel="noopener" style="color:var(--accent)">위키백과 →</a></dd></div>');
      if (a.ulan_id)
        rows.push('<div><dt>게티 ULAN</dt><dd>' + esc(a.ulan_id) + '</dd></div>');
      fx.innerHTML = rows.join('');
      if (!rows.length) fx.style.display = 'none';
    }

    /* 그림 — 작가 도판(초상 또는 대표작)
       ★★ 2026-08-23 · 「작품 도판은 작품DB 가 붙으면 이 자리에 놓입니다」를
         지웁니다. <b>작품DB 가 붙었습니다.</b> 아래 paintWorks 가
         그 작가의 작품을 실제로 불러옵니다. */
    var pl = $('pv-plate');
    var cap = $('pv-cap');
    if (a.image_url && pl) {
      pl.innerHTML = '<img src="' + esc(a.image_url) + '" alt="' + esc(a.name_ko) + '" referrerpolicy="no-referrer">';
      if (cap) {
        cap.querySelector('.cap-artist').textContent = a.name_ko;
        /* ★ 「초상」이라 못박지 않습니다 — 위키데이터 P18 은
             초상이 없으면 <b>대표작</b>을 줍니다(이암 《모견도》). */
        cap.querySelector('.cap-work').innerHTML = '<em>작가 도판</em>';
        cap.querySelector('.cap-meta').textContent = a.image_credit || '';
        cap.querySelector('.cap-hold').textContent = '초상이 없으면 대표작이 실립니다';
      }
    } else {
      if (pl) pl.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:300px;' +
        'background:repeating-linear-gradient(135deg,#FDFCFA,#FDFCFA 9px,#F4F3EF 9px,#F4F3EF 18px);' +
        'color:var(--ink-3);font-size:12.5px;text-align:center;line-height:1.9">' +
        '그림이<br>아직 없습니다</div>';
      if (cap) cap.style.display = 'none';
    }
  }

  /* ── 생애 ── */
  function paintBio(a) {
    var box = $('bio');
    if (!box) return;
    var t = a.bio || a.bio_en;
    if (!t) { hide('sec-bio'); return; }
    box.innerHTML = esc(t)
      + (a.link_wiki
         ? '<span class="src">글 출처 · 위키데이터 · <a href="' + esc(a.link_wiki) +
           '" target="_blank" rel="noopener" style="color:var(--accent)">위키백과에서 더 보기</a></span>'
         : '<span class="src">글 출처 · 위키데이터</span>');
  }

  /* ── 같은 시대 작가 ──
     ★ 태어난 해가 25년 안쪽인 사람을 고릅니다. 생몰이 없는 작가는
       고를 잣대가 없으므로 이 구역을 감춥니다. */
  async function paintMore(a) {
    if (!a.birth_year) { hide('sec-more'); return; }
    var lo = a.birth_year - 25, hi = a.birth_year + 25;
    var url = OF.SB_URL + '/rest/v1/artists'
      + '?select=id,name_ko,name_han,birth_year,death_year,life,image_url'
      + '&hidden=not.is.true&birth_year=gte.' + lo + '&birth_year=lte.' + hi
      + '&id=neq.' + a.id
      + '&order=quality.desc,id.desc&limit=6';
    var rows = [];
    try { rows = await get(url); } catch (e) { }
    if (!rows.length) { hide('sec-more'); return; }

    var box = $('more-ar');
    box.innerHTML = rows.map(function (r) {
      var pic = r.image_url
        ? '<img src="' + esc(r.image_url) + '" alt="' + esc(r.name_ko) + '" referrerpolicy="no-referrer" loading="lazy">'
        : '<span style="display:block;height:150px;background:repeating-linear-gradient(135deg,#FDFCFA,#FDFCFA 9px,#F4F3EF 9px,#F4F3EF 18px)"></span>';
      var yr = r.life || (r.birth_year ? r.birth_year + '–' : '');
      return '<a href="/db/artist-view.html?id=' + r.id + '">' +
             '<span class="f">' + pic + '</span>' +
             '<span class="n">' + esc(r.name_ko) + '</span>' +
             '<span class="y">' + esc(yr) + '</span></a>';
    }).join('');
  }

  /* ── 작품 ──
     ★★ 2026-08-23 · <b>작품DB 를 붙입니다.</b>
       커먼즈·위키데이터에서 그 작가의 작품 330여 점을 거두어
       artist_id 로 이어 두었습니다. 화면이 그것을 읽지 않아
       「아직 붙지 않았습니다」가 떠 있었습니다.
     ★ 손으로 적힌 견본 여덟 점(인왕제색도·금강전도…)을 <b>지웁니다.</b>
       김홍도 화면에 정선 작품이 떠 있었습니다 — 견본을 남겨 두면
       그대로 거짓이 됩니다.
     ★ 도판 있는 것을 앞에 세웁니다. 없는 것은 뒤로 갑니다 —
       빈 자리가 앞에 오면 목록이 비어 보입니다. */
  async function paintWorks(a) {
    var sec = $('sec-works');
    if (!sec) return;

    var base = OF.SB_URL + '/rest/v1/artworks?artist_id=eq.' + a.id
             + '&hidden=not.is.true';
    var rows = [];
    try {
      rows = await get(base
        + '&select=id,title,title_han,year_text,medium,holder,image_small,image_url,rights'
        + '&order=quality.desc,id.asc&limit=24');
    } catch (e) { }

    if (!rows.length) { hide('sec-works'); return 0; }
    /* ★ 처음에 hideEmpty 가 감춰 둡니다. 작품이 있을 때만 되살립니다. */
    show('sec-works');

    /* 모두 몇 점인가 · 도판이 있는 것은 몇 점인가 */
    var total = rows.length, withPic = 0;
    try {
      var r1 = await fetch(base + '&select=id&limit=1',
        { headers: headCount() });
      var m1 = /\/(\d+)$/.exec(r1.headers.get('content-range') || '');
      if (m1) total = Number(m1[1]);
      var r2 = await fetch(base + '&image_small=not.is.null&select=id&limit=1',
        { headers: headCount() });
      var m2 = /\/(\d+)$/.exec(r2.headers.get('content-range') || '');
      if (m2) withPic = Number(m2[1]);
    } catch (e) { withPic = rows.filter(function (w) { return w.image_small; }).length; }

    var sub = sec.querySelector('.sec-sub');
    if (sub) {
      sub.innerHTML = total + '점'
        + (withPic ? ' 가운데 도판이 있는 <b style="color:var(--accent)">' + withPic + '</b>점' : '');
    }
    var more = sec.querySelector('.sec-more');
    if (more) more.href = '/db/work.html?artist=' + a.id;

    var box = sec.querySelector('.wks');
    if (!box) return;

    /* 도판 있는 것 먼저 */
    rows.sort(function (x, y) {
      return (y.image_small ? 1 : 0) - (x.image_small ? 1 : 0);
    });

    box.innerHTML = rows.map(function (w) {
      var src = w.image_small || w.image_url;
      var pic = src
        ? '<img src="' + esc(src) + '" alt="' + esc(w.title || '') +
          '" referrerpolicy="no-referrer" loading="lazy">'
        : '<span style="display:block;height:220px;background:' +
          'repeating-linear-gradient(135deg,#FDFCFA,#FDFCFA 9px,#F4F3EF 9px,#F4F3EF 18px)"></span>';
      /* 시그니처 차례 — 《작품명》, 연도 / 재료 / 소장처 */
      var meta = [w.year_text, w.medium].filter(Boolean).join(' · ');
      return '<a class="wkc" href="/db/work-view.html?id=' + w.id + '">' +
             '<span class="p">' + pic + '</span>' +
             '<span class="t">《' + esc(w.title || '') + '》' +
               (w.title_han ? ' <i style="font-style:normal;color:var(--ink-3);font-size:12px">' +
                 esc(w.title_han) + '</i>' : '') + '</span>' +
             (meta ? '<span class="m">' + esc(meta) + '</span>' : '') +
             (w.holder ? '<span class="h">' + esc(w.holder) + '</span>' : '') +
             '</a>';
    }).join('');
    return total;
  }

  function headCount() {
    return { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY,
             Prefer: 'count=exact', Range: '0-0' };
  }

  /* ── 전시 이력 ──────────────────────────────────────────────
     ★★ 2026-08-24 · <b>전시DB 가 붙었습니다.</b>
       서울시립미술관 878건 가운데 494건에 작가가 이어졌고,
       작가 820명이 전시를 갖게 되었습니다.
       그동안 이 자리에는 <b>손으로 적은 정선 전시 여섯</b>이
       누구를 열어도 그대로 떠 있었습니다.

     ★ 잇는 표(exhibition_artists)를 거쳐 받습니다. 전시 하나에
       작가가 여럿, 작가 하나가 전시 여럿이라 <b>여럿 대 여럿</b>입니다.
     ★ PostgREST 의 <b>겹쳐 받기</b>로 한 번에 가져옵니다 —
       exhibition_artists?select=exhibitions(...)
       두 번 물으면 느리고, 전시가 많은 작가는 더 그렇습니다.

     ★ <b>최근 것부터</b> 봅니다. 전시 이력은 연표라 최근이 위입니다.
     ★ 「개인전 / 단체전」은 <b>참여작가 수</b>로 가릅니다 —
       그 전시에 이어진 이름이 하나뿐이면 개인전입니다.
       자료원이 알려 주지 않으므로 우리가 세는 수밖에 없습니다. */
  async function paintExh(a) {
    var sec = $('sec-exh');
    if (!sec) return 0;

    var rows = [];
    try {
      rows = await get(OF.SB_URL + '/rest/v1/exhibition_artists'
        + '?select=exhibition_id,exhibitions(id,title,venue,start_date,end_date,poster_url)'
        + '&artist_id=eq.' + a.id + '&limit=200');
    } catch (e) { }

    /* 전시가 지워졌거나 감춰졌으면 겹쳐 받기가 빈 값을 줍니다 */
    var ex = rows.map(function (r) { return r.exhibitions; }).filter(Boolean);
    if (!ex.length) { hide('sec-exh'); return 0; }

    /* 최근 것부터 */
    ex.sort(function (x, y) {
      return String(y.start_date || '').localeCompare(String(x.start_date || ''));
    });

    /* ★ 개인전인지 세려면 <b>그 전시의 참여작가 수</b>가 필요합니다.
         전시마다 따로 물으면 수십 번이 되므로 <b>한 번에</b> 묻습니다. */
    var solo = {};
    try {
      var ids = ex.map(function (e) { return e.id; }).join(',');
      var mates = await get(OF.SB_URL + '/rest/v1/exhibition_artists'
        + '?select=exhibition_id&exhibition_id=in.(' + ids + ')&limit=2000');
      var cnt = {};
      mates.forEach(function (m) {
        cnt[m.exhibition_id] = (cnt[m.exhibition_id] || 0) + 1;
      });
      ex.forEach(function (e) { solo[e.id] = cnt[e.id] === 1; });
    } catch (e) { }

    var nSolo = ex.filter(function (e) { return solo[e.id]; }).length;
    var sub = sec.querySelector('.sec-sub');
    if (sub) {
      sub.innerHTML = (nSolo ? '개인전 <b style="color:var(--accent)">' + nSolo + '</b> · ' : '')
        + '전시 <b style="color:var(--accent)">' + ex.length + '</b>';
    }
    var more = sec.querySelector('.sec-more');
    if (more) more.href = '/db/exhibition.html?q=' + encodeURIComponent(a.name_ko || '');

    var box = sec.querySelector('.exh');
    if (!box) return 0;
    box.innerHTML = ex.slice(0, 20).map(function (e) {
      var yr = String(e.start_date || e.end_date || '').slice(0, 4);
      /* ★ 제목에 이미 낫표가 든 것이 많습니다 — 덧씌우지 않습니다 */
      var t = /[《》]/.test(e.title) ? esc(e.title) : '《' + esc(e.title) + '》';
      var kind = solo[e.id] ? 'solo' : 'group';
      return '<a class="exh-r" href="/db/exhibition-view.html?id=' + e.id + '">'
        + '<span class="exh-y">' + esc(yr) + '</span>'
        + '<span><span class="exh-t"><em>' + t + '</em></span>'
        +   (e.venue ? '<span class="exh-v">' + esc(e.venue) + '</span>' : '') + '</span>'
        + '<span class="exh-k ' + kind + '">' + (solo[e.id] ? '개인전' : '단체전') + '</span></a>';
    }).join('');
    show('sec-exh');
    return ex.length;
  }

  /* ── 아직 표가 없는 구역 ──
     ★ 견본을 남겨 두면 거짓이 됩니다. 통째로 감춥니다.
       표가 생기면 하나씩 되살립니다.
     ★ sec-works 는 <b>되살렸습니다</b> — 작품DB 가 붙었습니다. */
  /* ★ sec-works · sec-exh 는 <b>되살렸습니다</b> — 표가 붙었습니다.
       처음엔 감춰 두고, 자료가 있을 때만 되살립니다. */
  function hideEmpty() {
    ['sec-works', 'sec-exh', 'sec-hold', 'sec-rel', 'sec-paper'].forEach(hide);
  }

  /* ★ 「작품·전시·소장처·학술 자료는 아직 붙지 않았습니다」
       — 작품은 붙었으므로 문구를 고칩니다. 거짓을 남기지 않습니다. */
  /* ★★ 2026-08-24 · <b>전시가 붙었는지</b>도 밝힙니다.
       이 줄이 낡으면 그것도 거짓이 됩니다 — 어제 「전시 자료는
       아직 붙지 않았습니다」가 붙은 뒤에도 그대로 떠 있었습니다.
     ★ 무엇이 <b>아직 없는지</b>도 적습니다. 있는 것만 말하면
       화면이 다 갖춘 것처럼 보입니다. */
  function fixNote(hasWorks, hasExh) {
    var n = $('demo-note');
    if (!n) return;
    var got = [];
    if (hasWorks) got.push('작품');
    if (hasExh)   got.push('전시');
    var none = [];
    if (!hasWorks) none.push('작품');
    if (!hasExh)   none.push('전시');
    none.push('소장처', '학술 자료');

    n.innerHTML = '작가 정보는 <b>위키데이터</b>에서 받은 것입니다 · '
      + '그림은 위키미디어 커먼즈 원본을 링크합니다'
      + (got.length
         ? ' · ' + got.join('·') + josa(got[got.length - 1], '은', '는')
           + ' <b>공개 자료에서 거둔 것</b>이라 전하는 것의 일부입니다' : '')
      + ' · ' + none.join('·') + josa(none[none.length - 1], '은', '는')
      + ' <b>아직 붙지 않았습니다</b>';
  }

  async function boot() {
    var id = new URLSearchParams(location.search).get('id');
    if (!id || !/^\d+$/.test(id)) { notFound('작가 번호가 없습니다.'); return; }

    hideEmpty();
    try {
      var rows = await get(OF.SB_URL + '/rest/v1/artists?select=*&id=eq.' + id + '&hidden=not.is.true&limit=1');
      if (!rows.length) { notFound(); return; }
      var a = rows[0];
      paintHead(a);
      paintBio(a);
      var n = await paintWorks(a);
      var nx = await paintExh(a);
      fixNote(!!n, !!nx);
      await paintMore(a);
    } catch (e) {
      notFound('자료를 불러오지 못했습니다 · ' + e.message);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
