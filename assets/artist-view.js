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

    /* 그림 — 지금은 초상입니다 */
    var pl = $('pv-plate');
    var cap = $('pv-cap');
    if (a.image_url && pl) {
      pl.innerHTML = '<img src="' + esc(a.image_url) + '" alt="' + esc(a.name_ko) + '">';
      if (cap) {
        cap.querySelector('.cap-artist').textContent = a.name_ko;
        cap.querySelector('.cap-work').innerHTML = '<em>초상</em>';
        cap.querySelector('.cap-meta').textContent = a.image_credit || '';
        cap.querySelector('.cap-hold').textContent =
          '작품 도판은 작품DB 가 붙으면 이 자리에 놓입니다';
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
        ? '<img src="' + esc(r.image_url) + '" alt="' + esc(r.name_ko) + '" loading="lazy">'
        : '<span style="display:block;height:150px;background:repeating-linear-gradient(135deg,#FDFCFA,#FDFCFA 9px,#F4F3EF 9px,#F4F3EF 18px)"></span>';
      var yr = r.life || (r.birth_year ? r.birth_year + '–' : '');
      return '<a href="/db/artist-view.html?id=' + r.id + '">' +
             '<span class="f">' + pic + '</span>' +
             '<span class="n">' + esc(r.name_ko) + '</span>' +
             '<span class="y">' + esc(yr) + '</span></a>';
    }).join('');
  }

  /* ── 아직 표가 없는 구역 ──
     ★ 견본을 남겨 두면 거짓이 됩니다. 통째로 감춥니다.
       작품·전시·소장처·학술 표가 생기면 하나씩 되살립니다. */
  function hideEmpty() {
    ['sec-works', 'sec-exh', 'sec-hold', 'sec-rel', 'sec-paper'].forEach(hide);
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
      await paintMore(a);
    } catch (e) {
      notFound('자료를 불러오지 못했습니다 · ' + e.message);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
