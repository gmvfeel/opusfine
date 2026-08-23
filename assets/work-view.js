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
    /* ★★ 2026-08-23 · <b>한자 제목</b>을 곁들입니다.
         공유마당·클리블랜드가 title_han 을 줍니다 —
         「금동아미타여래삼존좌상 金銅阿彌陀如來三尊坐像」
         한국 미술에서 한자 제목은 <b>곁다리가 아니라 본이름</b>인
         경우가 많습니다. 담아 놓고 안 보이면 없는 것과 같습니다. */
    var nm = $('pv-name');
    if (nm) nm.innerHTML = '《' + esc(w.title) + '》'
      + (w.title_han && w.title_han !== w.title
         ? ' <i style="font-style:normal;font-size:.62em;color:var(--ink-3);'
           + 'font-weight:400">' + esc(w.title_han) + '</i>'
         : '');

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
    var src = OF.img(w.image_url || w.image_small);
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
      /* ★★★ <b>출처 표시</b> — 이것은 예의가 아니라 <b>의무</b>입니다.
           CC BY·CC BY-SA·공공누리 제1유형은 모두 출처를 밝혀야
           쓸 수 있습니다. 담아 두고 화면에 안 내면 <b>지키지 않은
           것</b>이 됩니다.
         ★ 도판 바로 아래에 답니다 — 그 도판에 딸린 말이므로. */
      if (w.image_credit) {
        var cr = document.createElement('div');
        cr.className = 'artcap';
        cr.style.marginTop = '8px';
        cr.textContent = '도판 출처 · ' + w.image_credit;
        pl.parentNode.insertBefore(cr, pl.nextSibling);
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

  /* ── 전시 이력 ──
     ★★ 2026-08-23 · 클리블랜드가 <b>날짜까지 나뉜</b> 전시 이력을
       줍니다. 담아 두고 화면에 안 내고 있었습니다.
         「Korean Art in Early Chosön, 1400-1600 (2009-03-17)」
     ★ 아직 전시DB 가 없으므로 <b>글 그대로</b> 보여 줍니다.
       전시DB 가 생기면 이 글을 쪼개 이어 붙입니다. */
  function exhibitions(w) {
    var sec = $('sec-exh');
    if (!sec) return;
    var t = String(w.exhibition_history || '').trim();
    if (!t) { hide('sec-exh'); return; }

    var lines = t.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (!lines.length) { hide('sec-exh'); return; }

    var sub = sec.querySelector('.sec-sub');
    if (sub) sub.innerHTML = '<b style="color:var(--accent)">' + lines.length + '</b>회';
    var more = sec.querySelector('.sec-more');
    if (more) more.remove();          /* 전시DB 가 없으니 갈 곳이 없습니다 */

    var box = sec.querySelector('.exh');
    if (!box) return;
    box.innerHTML = lines.map(function (L) {
      /* 「제목 (2009-03-17)」 꼴에서 해를 떼어 냅니다 */
      var m = /^(.*?)\s*[(（]\s*((?:1[89]|20)\d\d)[-.\/]?\d*[-.\/]?\d*\s*[)）]\s*$/.exec(L);
      var yr = m ? m[2] : '';
      var ti = m ? m[1].trim() : L;
      return '<div class="exh-r" style="cursor:default">'
        + '<span class="exh-y">' + esc(yr) + '</span>'
        + '<span><span class="exh-t"><em>' + esc(ti) + '</em></span></span>'
        + '<span></span></div>';
    }).join('');
    sec.style.display = '';
  }

  /* ── 소장 내력 ──
     ★ 「누가 갖고 있다가 누구에게 갔는가」는 작품의 이력 그 자체입니다.
       미술 아카이브에서 값진 자료라 받아 두었는데 안 보이고 있었습니다. */
  function provenance(w) {
    var sec = $('sec-hold');
    if (!sec) return;
    var t = String(w.provenance || '').trim();
    if (!t) { hide('sec-hold'); return; }
    var hd = sec.querySelector('.dhd .dt');
    if (hd) hd.textContent = '소장 내력';
    var en = sec.querySelector('.dhd .dt-en');
    if (en) en.textContent = 'Provenance';
    var sub = sec.querySelector('.sec-sub'); if (sub) sub.remove();
    var mo = sec.querySelector('.sec-more'); if (mo) mo.remove();

    var body = sec.querySelector('.exh') || sec.querySelector('div:last-child');
    if (!body) return;
    body.innerHTML = t.split(/\r?\n/).map(function (x) { return x.trim(); })
      .filter(Boolean)
      .map(function (L) {
        return '<div style="font-size:13px;line-height:1.9;padding:7px 0;'
             + 'border-bottom:1px solid var(--rule-2)">' + esc(L) + '</div>';
      }).join('')
      + (w.credit_line
         ? '<div class="artcap" style="margin-top:12px">' + esc(w.credit_line) + '</div>'
         : '');
    sec.style.display = '';
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
      var s = OF.img(r.image_small || r.image_url);
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
      exhibitions(rows[0]);
      provenance(rows[0]);
      await more(rows[0]);
    } catch (e) { notFound('자료를 불러오지 못했습니다 · ' + e.message); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
