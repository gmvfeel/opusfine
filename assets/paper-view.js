/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 학술 논문 상세 · assets/paper-view.js · 2026-10-01
   ------------------------------------------------------------------
   venue-view.js 를 본떴습니다 — 다만 「열린 전시」 같은 잇는 목록이
   없습니다. 논문 그 자체는 바깥(DOI)에 있으므로, 여기서는 가진 정보를
   보여 주고 원문은 바깥으로 잇습니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.OF || !OF.SB_URL) return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function head() {
    return { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };
  }

  function render(p) {
    var main = document.getElementById('svMain');
    var bc = document.getElementById('svBc');
    var title = p.title || '(제목 없음)';
    if (bc) bc.textContent = title;

    var sub = [];
    if (p.year) sub.push(p.year);
    sub.push('인용 ' + (p.cited_by_count || 0).toLocaleString());
    if (p.is_oa) sub.push('<span class="oa">오픈액세스</span>');

    var facts = '<div class="sv-facts"><div class="sv-fk">자료</div>';
    if (p.venue) facts += '<div class="sv-frow"><span class="k">학술지</span><span class="v">' + esc(p.venue) + '</span></div>';
    if (p.topic) facts += '<div class="sv-frow"><span class="k">주제</span><span class="v">' + esc(p.topic) + '</span></div>';
    if (p.country) facts += '<div class="sv-frow"><span class="k">저자 소속국</span><span class="v">' + esc(p.country) + '</span></div>';
    facts += '</div>';

    var go = (p.url || p.doi)
      ? '<a class="sv-go" href="' + esc(p.url || p.doi) + '" target="_blank" rel="noopener noreferrer">원문 보기 ↗</a>'
      : '<div class="sv-none">원문 링크가 아직 없습니다.</div>';

    main.innerHTML =
      '<div class="sv-hd">'
      + '<div class="sv-label">Paper</div>'
      + '<h1 class="sv-nm">' + esc(title) + '</h1>'
      + (p.authors ? '<div class="sv-au">' + esc(p.authors) + '</div>' : '')
      + '<div class="sv-sub">' + sub.join('<i>·</i>') + '</div>'
      + '</div>'
      + facts
      + go;
  }

  async function boot() {
    var p = new URLSearchParams(location.search);
    var id = p.get('id');
    var main = document.getElementById('svMain');
    if (!id) {
      main.innerHTML = '<div class="sv-hd"><div class="sv-none">논문 번호가 없습니다.</div></div>';
      return;
    }
    try {
      var r = await fetch(OF.SB_URL + '/rest/v1/papers?select=*&id=eq.'
        + encodeURIComponent(id) + '&hidden=not.is.true', { headers: head() });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var rows = await r.json();
      if (!rows.length) {
        main.innerHTML = '<div class="sv-hd"><div class="sv-none">그 논문을 찾지 못했습니다.</div></div>';
        return;
      }
      var paper = rows[0];
      document.title = (paper.title || '학술') + ' — OPUSFINE';
      render(paper);
    } catch (e) {
      main.innerHTML = '<div class="sv-hd"><div class="sv-none">불러오지 못했습니다 — '
        + esc(String(e.message).slice(0, 160)) + '</div></div>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();
})();
