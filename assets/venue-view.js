/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 전시공간 상세 · assets/venue-view.js · 2026-10-01
   ------------------------------------------------------------------
   school-view.js 를 본떴습니다. 다른 점 —
     · 「동문」 대신 <b>그곳에서 열린 전시 목록</b>을 보여 줍니다
       (exhibitions.venue_id 로 바로 잇습니다 — entity_links 를
       거치지 않습니다. 전시↔전시공간은 1:1 글자 관계라 바로 FK 로
       이은 것이 school↔artist 의 다대다 관계와 다른 점입니다).
     · hidden 은 not.is.true · 견본을 두지 않고 실패하면 실패했다고 적습니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function head() {
    return { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };
  }
  async function get(url) {
    var res = await fetch(url, { headers: head(), cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 160));
    return await res.json();
  }
  function title(t) {
    return /[《》]/.test(t) ? esc(t) : '《' + esc(t) + '》';
  }
  function when(a, b) {
    var f = function (d) { return String(d || '').slice(0, 10); };
    if (!a && !b) return '';
    return f(a) + ' — ' + f(b);
  }

  async function loadExhibitions(venueId) {
    try {
      var rows = await get(OF.SB_URL + '/rest/v1/exhibitions'
        + '?select=id,title,organizer,start_date,end_date,poster_url'
        + '&venue_id=eq.' + encodeURIComponent(venueId)
        + '&hidden=not.is.true&order=end_date.desc.nullslast&limit=100');
      return Array.isArray(rows) ? rows : [];
    } catch (e) {
      return null;    /* 못 읽었습니다 */
    }
  }

  function render(v, exhs) {
    var name = v.name_ko || v.name_en || '(이름 없음)';
    var initial = esc(name.trim().charAt(0) || '·');

    var h = '';
    h += '<div class="sv-hd">';
    h += '<div class="sv-logo">' + initial + '</div>';
    h += '<div class="sv-hb">';
    h += '<h1 class="sv-nm">' + esc(name) + '</h1>';
    var sub = [];
    if (v.location) sub.push(esc(v.location));
    sub.push((v.exh_count || 0).toLocaleString() + '건의 전시');
    h += '<div class="sv-sub">' + sub.join('<i>·</i>') + '</div>';
    h += '</div></div>';

    h += '<div class="sv-cols">';
    h += '<div class="sv-main"><div class="sv-sk">Exhibitions · 열린 전시</div>';

    if (exhs === null) {
      h += '<div class="sv-none">전시 목록을 불러오지 못했습니다.</div>';
    } else if (!exhs.length) {
      h += '<div class="sv-none">이어진 전시 자료가 아직 없습니다.</div>';
    } else {
      h += '<div class="vw-list">';
      h += exhs.map(function (e) {
        var pic = e.poster_url
          ? '<img src="' + esc(e.poster_url) + '" alt="" loading="lazy"'
            + ' onerror="this.parentNode.remove()">'
          : '';
        return '<a class="vw-row" href="/db/exhibition-view.html?id=' + e.id + '">'
          + (pic ? '<span class="vw-th">' + pic + '</span>' : '')
          + '<span class="vw-b">'
          + '<span class="vw-t">' + title(e.title) + '</span>'
          + '<span class="vw-w">' + esc(when(e.start_date, e.end_date))
          + (e.organizer ? ' · ' + esc(e.organizer) : '') + '</span>'
          + '</span></a>';
      }).join('');
      h += '</div>';
      if (exhs.length >= 100) {
        h += '<div class="sv-none" style="margin-top:14px">가장 최근 100건만 보입니다.</div>';
      }
    }
    h += '</div>';

    h += '<div class="sv-side"><div class="sv-sidein"><div class="sv-facts">';
    h += '<div class="sv-fk">Information</div>';
    var facts = [];
    if (v.location) facts.push(['소재지', esc(v.location)]);
    facts.push(['담긴 전시', (v.exh_count || 0).toLocaleString() + '건']);
    h += facts.map(function (f) {
      return '<div class="sv-frow"><span class="k">' + f[0] + '</span>'
           + '<span class="v">' + f[1] + '</span></div>';
    }).join('');
    h += '</div></div></div>';
    h += '</div>';

    h += '<div class="sv-sec" style="border:0"><p class="demo-note">'
      + '이 자리는 전시 자료의 장소 글자칸에서 뽑아 모은 것입니다 · '
      + '소재지·소개문·사진은 아직 없습니다</p></div>';

    return h;
  }

  async function boot() {
    var box = document.getElementById('svMain');
    var bc  = document.getElementById('svBc');
    if (!box) return;

    var id = new URLSearchParams(location.search).get('id');
    if (!id) {
      box.innerHTML = '<div class="sv-sec" style="border:0">'
        + '<div class="demo-note">주소에 전시공간 번호가 없습니다. '
        + '<a href="/db/venue.html">목록</a>에서 골라 주십시오.</div></div>';
      if (bc) bc.textContent = '—';
      return;
    }

    try {
      var rows = await get(OF.SB_URL + '/rest/v1/venues?select=*'
        + '&id=eq.' + encodeURIComponent(id) + '&hidden=not.is.true&limit=1');
      if (!rows.length) {
        box.innerHTML = '<div class="sv-sec" style="border:0">'
          + '<div class="demo-note">그 전시공간을 찾지 못했습니다. '
          + '<a href="/db/venue.html">목록으로</a></div></div>';
        if (bc) bc.textContent = '—';
        return;
      }
      var v = rows[0];
      var name = v.name_ko || v.name_en || '(이름 없음)';
      document.title = name + ' — OPUSFINE';
      if (bc) bc.textContent = name;

      var exhs = await loadExhibitions(v.id);
      box.innerHTML = render(v, exhs);

    } catch (e) {
      box.innerHTML = '<div class="sv-sec" style="border:0"><div class="demo-note">'
        + '자료를 불러오지 못했습니다 — ' + esc(String(e.message).slice(0, 200))
        + '</div></div>';
      if (bc) bc.textContent = '—';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();
})();
