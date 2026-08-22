/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 작품 상세 · assets/work-view.js
   ------------------------------------------------------------------
   ★ 도판 하나가 화면의 주인공입니다. 미술 상세의 정수입니다.
   ★ 저작권이 살아 있는 작품은 <b>도판을 싣지 않고</b> 소장처로 잇습니다.
   ★ 화면에 박힌 견본을 읽지 않고 <b>DB 에서 직접</b> 읽습니다.
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
  async function get(u) {
    var r = await fetch(u, { headers: head });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160));
    return await r.json();
  }

  function notFound(msg) {
    var n = $('pv-name'); if (n) n.textContent = '찾지 못했습니다';
    var e = $('pv-en');   if (e) e.textContent = msg || '주소가 잘못되었거나 감춰진 작품입니다.';
    ['pv-cap','pv-marks','pv-facts','sec-bio','sec-works','sec-exh',
     'sec-hold','sec-rel','sec-paper','sec-more','sec-ad'].forEach(hide);
    var p = $('pv-plate'); if (p) p.style.display = 'none';
    var d = $('demo-note'); if (d) d.style.display = 'none';
  }

  function paint(w) {
    document.title = w.title + ' · OPUSFINE';

    var bc = $('bc');
    if (bc) bc.innerHTML = '<a href="/">홈</a> / <a href="/db/artist.html">아카이브</a> / '
                         + '<a href="/db/work.html">작품</a> / ' + esc(w.title);

    /* 제목이 주인공입니다 */
    var nm = $('pv-name');
    if (nm) nm.innerHTML = '《' + esc(w.title) + '》';

    var en = $('pv-en');
    if (en) {
      var bits = [];
      if (w.artist_name) bits.push(esc(w.artist_name));
      if (w.year_text)   bits.push(esc(w.year_text));
      en.textContent = bits.join(' · ');
    }

    var mk = $('pv-marks');
    if (mk) {
      var m = '';
      if (w.rights === 'public')
        m += '<span class="vf-badge">저작권 없이 공개된 작품</span>';
      else
        m += '<span class="oc-badge" style="background:#8C3A2E">저작권 있음</span>';
      mk.innerHTML = m;
    }

    var fx = $('pv-facts');
    if (fx) {
      var rows = [], add = function (k, v) {
        if (v) rows.push('<div><dt>' + k + '</dt><dd>' + v + '</dd></div>');
      };
      add('작가',   w.artist_id
        ? '<a href="/db/artist-view.html?id=' + w.artist_id + '" style="color:var(--accent)">' +
          esc(w.artist_name) + ' →</a>'
        : (w.artist_name ? esc(w.artist_name) : null));
      add('연도',   w.year_text ? esc(w.year_text) : null);
      add('재료',   w.medium ? esc(w.medium) : null);
      add('크기',   w.dimensions ? esc(w.dimensions) : null);
      add('갈래',   w.genre ? esc(w.genre) : null);
      add('소장처', [w.holder, w.holder_dept].filter(Boolean).map(esc).join(' · ') || null);
      add('소장번호', w.accession ? esc(w.accession) : null);
      if (w.link_source)
        rows.push('<div><dt>바깥 자료</dt><dd><a href="' + esc(w.link_source) +
                  '" target="_blank" rel="noopener" style="color:var(--accent)">소장처에서 보기 →</a></dd></div>');
      fx.innerHTML = rows.join('');
    }

    /* 도판 */
    var pl = $('pv-plate'), cap = $('pv-cap');
    var src = w.image_url || w.image_small;
    if (w.rights === 'public' && src && pl) {
      pl.innerHTML = '<img src="' + esc(src) + '" alt="' + esc(w.title) + '" referrerpolicy="no-referrer">';
      if (cap) {
        cap.querySelector('.cap-artist').textContent = w.artist_name || '작자 미상';
        cap.querySelector('.cap-work').innerHTML =
          '<em>《' + esc(w.title) + '》</em>' + (w.year_text ? ', ' + esc(w.year_text) : '');
        cap.querySelector('.cap-meta').textContent =
          [w.medium, w.dimensions].filter(Boolean).join(' · ');
        cap.querySelector('.cap-hold').textContent = w.holder || '';
      }
    } else {
      if (pl) pl.innerHTML =
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'height:360px;background:repeating-linear-gradient(135deg,#FDFCFA,#FDFCFA 9px,#F4F3EF 9px,#F4F3EF 18px);' +
        'color:var(--ink-3);font-size:13px;text-align:center;line-height:2;padding:0 26px">' +
        '이 작품은 저작권이 살아 있어<br>도판을 싣지 않습니다' +
        (w.link_source
          ? '<a href="' + esc(w.link_source) + '" target="_blank" rel="noopener" ' +
            'style="color:var(--accent);font-weight:600;margin-top:10px">소장처에서 보기 →</a>'
          : '') + '</div>';
      if (cap) cap.style.display = 'none';
    }
  }

  /* 같은 작가의 다른 작품 */
  async function more(w) {
    if (!w.artist_id && !w.artist_name) { hide('sec-more'); return; }
    var url = OF.SB_URL + '/rest/v1/artworks'
      + '?select=id,title,year_text,image_small,image_url,rights'
      + '&hidden=not.is.true&rights=eq.public&id=neq.' + w.id
      + (w.artist_id ? '&artist_id=eq.' + w.artist_id
                     : '&artist_name=eq.' + encodeURIComponent(w.artist_name))
      + '&order=quality.desc&limit=6';
    var rows = [];
    try { rows = await get(url); } catch (e) {}
    if (!rows.length) { hide('sec-more'); return; }

    $('more-ar').innerHTML = rows.map(function (r) {
      var s = r.image_small || r.image_url;
      return '<a href="/db/work-view.html?id=' + r.id + '">' +
        '<span class="f">' + (s ? '<img src="' + esc(s) + '" alt="' + esc(r.title) + '" referrerpolicy="no-referrer" loading="lazy">' : '') + '</span>' +
        '<span class="n">《' + esc(r.title) + '》</span>' +
        '<span class="y">' + esc(r.year_text || '') + '</span></a>';
    }).join('');
  }

  async function boot() {
    var id = new URLSearchParams(location.search).get('id');
    if (!id || !/^\d+$/.test(id)) { notFound('작품 번호가 없습니다.'); return; }
    /* 아직 표가 없는 구역은 감춥니다 */
    ['sec-bio','sec-works','sec-exh','sec-hold','sec-rel','sec-paper'].forEach(hide);
    try {
      var rows = await get(OF.SB_URL + '/rest/v1/artworks?select=*&id=eq.' + id + '&hidden=not.is.true&limit=1');
      if (!rows.length) { notFound(); return; }
      paint(rows[0]);
      await more(rows[0]);
    } catch (e) { notFound('자료를 불러오지 못했습니다 · ' + e.message); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
