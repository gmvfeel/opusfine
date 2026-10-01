/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 기관·재단 목록 · assets/institution-list.js · 2026-10-01
   ------------------------------------------------------------------
   school-list.js 를 본떴습니다. 지키는 것은 같습니다 —
     · hidden 은 not.is.true 로 거릅니다 (is.false 아닙니다)
     · 한 번에 받는 건 PER 개뿐 · 0줄일 때만 끝으로 봅니다
     · 받아오지 못하면 견본을 두지 않고 실패했다고 적습니다

   ★ institutions 는 아직 이름과 전시 건수(exh_count)뿐입니다. 소재지·로고가
     없으니 region/category 추리개는 두지 않았습니다 — 없는 자료로
     추리개를 만들면 전부 「전체」 한 칸만 뜨는 거짓 UI가 됩니다.
   ★ 차례는 전시가 많이 열린 곳부터(exh_count.desc) — 이름 목록보다
     「무엇이 중요한 자리인지」가 먼저 보여야 합니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var PER = 30;
  var grid, cntBox, moreBox, moreBtn;
  var page = 0, total = 0, busy = false;
  var q = '';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function query() {
    var p = [];
    p.push('select=id,name_ko,name_en,location,exh_count');
    p.push('hidden=not.is.true');
    if (q) {
      var w = '*' + q.replace(/[*(),]/g, '') + '*';
      p.push('or=(name_ko.ilike.' + w + ',name_en.ilike.' + w + ')');
    }
    p.push('order=exh_count.desc,id.desc');
    return OF.SB_URL + '/rest/v1/institutions?' + p.join('&');
  }

  function head(withCount) {
    var h = { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };
    if (withCount) h.Prefer = 'count=exact';
    return h;
  }

  async function fetchPage(n) {
    var from = n * PER, to = from + PER - 1;
    var res = await fetch(query(), {
      headers: Object.assign(head(n === 0), { Range: from + '-' + to, 'Range-Unit': 'items' })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
    if (n === 0) {
      var cr = res.headers.get('content-range') || '';
      var m = cr.match(/\/(\d+)$/);
      if (m) total = Number(m[1]);
    }
    return await res.json();
  }

  function card(v) {
    var name = v.name_ko || v.name_en || '(이름 없음)';
    var initial = esc(name.trim().charAt(0) || '·');
    var href = '/db/institution-view.html?id=' + encodeURIComponent(v.id);

    var meta = [];
    if (v.location) meta.push(esc(v.location));
    meta.push((v.exh_count || 0).toLocaleString() + '건의 전시');

    var h = '<a class="sl-item" href="' + href + '">';
    h += '<span class="sl-head">';
    h += '<span class="sl-logo">' + initial + '</span>';
    h += '<span class="sl-body">';
    h += '<span class="sl-nm">' + esc(name) + '</span>';
    if (meta.length) h += '<span class="sl-meta">' + meta.join('<i>·</i>') + '</span>';
    h += '</span></span></a>';
    return h;
  }

  function skeleton(n) {
    var h = '';
    for (var i = 0; i < n; i++) {
      h += '<div class="sl-skel"><span style="width:52%"></span>'
         + '<span style="width:34%"></span></div>';
    }
    return h;
  }

  function note(msg) {
    return '<div class="demo-note" style="grid-column:1/-1">' + msg + '</div>';
  }

  async function load(reset) {
    if (busy) return;
    busy = true;
    if (reset) { page = 0; grid.innerHTML = skeleton(6); }

    try {
      var rows = await fetchPage(page);
      if (page === 0) grid.innerHTML = '';

      if (!rows.length && page === 0) {
        grid.innerHTML = note('찾으시는 기관·재단이 없습니다. 다른 말로 찾아 보십시오.');
        moreBox.hidden = true;
        cntBox.innerHTML = '0곳';
        busy = false;
        return;
      }

      grid.insertAdjacentHTML('beforeend', rows.map(card).join(''));
      page++;

      if (total) {
        cntBox.innerHTML = '<b>' + total.toLocaleString() + '</b>곳' + (q ? ' (추린 것)' : '');
      }
      moreBox.hidden = rows.length === 0 || (total && page * PER >= total);

    } catch (e) {
      grid.innerHTML = note('자료를 불러오지 못했습니다 — ' + esc(String(e.message).slice(0, 160)));
      moreBox.hidden = true;
      cntBox.textContent = '';
    }
    busy = false;
  }

  function boot() {
    grid    = document.getElementById('slGrid');
    cntBox  = document.getElementById('slCnt');
    moreBox = document.getElementById('slMore');
    if (!grid) return;
    moreBtn = moreBox ? moreBox.querySelector('button') : null;

    var box = document.getElementById('slQ');
    if (box) {
      var t;
      box.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { q = box.value.trim(); load(true); }, 280);
      });
    }
    if (moreBtn) moreBtn.addEventListener('click', function () { load(false); });

    load(true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();
})();
