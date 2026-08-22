/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 작가 목록 · assets/artist-list.js
   ------------------------------------------------------------------
   artists 표에서 읽어 도판 격자를 그립니다.

   ★★ 오퍼스클램에서 값을 치르고 배운 것

     ① <b>hidden 은 `is.false` 로 거르면 안 됩니다.</b> 빈 값인 줄이
        통째로 빠집니다. `not.is.true` 를 씁니다.

     ② 응답은 한 번에 <b>200줄까지</b>만 옵니다. 「받은 줄이 요청보다
        적으면 끝」으로 판단하면 안 됩니다 — 0줄일 때 끝냅니다.
        전체 수는 count 로 따로 묻습니다.

     ③ 화면에 견본이 박혀 있습니다. 자료가 오면 <b>통째로 갈아 끼웁니다.</b>
        일부만 고치면 견본이 살아남아 엉뚱한 값이 남습니다.

   ★ 도판이 없는 작가도 감추지 않습니다. 「아직 없습니다」로 그대로
     보여 줍니다 — 그것도 자료이고, 회원이 채워 주실 자리입니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var PER = 24;
  var grid, cntBox, moreBtn;
  var page = 0, total = 0, busy = false;
  var q = '', fField = '', fEra = '';

  /* ── 잣대 ──
     ★ 표에 담긴 <b>그 글자</b>로 거릅니다. 위키데이터가 준 직업 이름을
       그대로 쓰고 있으므로, 화면의 말과 표의 말이 맞아야 합니다. */
  var FIELD = {
    '회화':      ['화가', '데생화가'],
    '조각':      ['조각가'],
    '사진':      ['사진가'],
    '판화':      ['판화가'],
    '삽화':      ['삽화가'],
    '공예·도자':  ['도예가', '공예가'],
    '설치·영상':  ['설치 미술가', '비디오 아티스트', '행위 예술가',
                 'video installation artist', 'multimedia artist']
  };
  var ERA = {
    '조선 이전': [null, 1391],
    '조선':      [1392, 1909],
    '근대':      [1910, 1944],
    '현대':      [1945, null]
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function query(from, to) {
    var p = [];
    p.push('select=id,name_ko,name_en,name_han,art_name,field,genre,birth_year,death_year,life,nationality,image_url,is_oc,quality,rep_work');
    p.push('hidden=not.is.true');
    p.push('order=quality.desc,sort_no.desc,id.desc');

    if (q) {
      var t = q.replace(/[,()*]/g, ' ').trim();
      if (t) p.push('or=(name_ko.ilike.*' + t + '*,name_en.ilike.*' + t + '*,name_han.ilike.*' + t + '*)');
    }
    if (fField && FIELD[fField]) {
      p.push('or=(' + FIELD[fField].map(function (w) { return 'field.ilike.*' + w + '*'; }).join(',') + ')');
    }
    if (fEra && ERA[fEra]) {
      var r = ERA[fEra];
      p.push('birth_year=not.is.null');
      if (r[0] != null) p.push('birth_year=gte.' + r[0]);
      if (r[1] != null) p.push('birth_year=lte.' + r[1]);
    }
    return OF.SB_URL + '/rest/v1/artists?' + p.join('&')
         + '&limit=' + (to - from + 1) + '&offset=' + from;
  }

  function head(withCount) {
    var h = { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };
    if (withCount) h.Prefer = 'count=exact';
    return h;
  }

  async function fetchPage(n) {
    var from = n * PER;
    var res = await fetch(query(from, from + PER - 1), { headers: head(n === 0) });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 160));
    if (n === 0) {
      var m = /\/(\d+)$/.exec(res.headers.get('content-range') || '');
      if (m) total = Number(m[1]);
    }
    return await res.json();
  }

  function card(a) {
    var han = a.name_han ? ' <i>' + esc(a.name_han) + '</i>' : '';
    var yr  = a.life || (a.birth_year ? a.birth_year + ' –' : '');
    var nat = a.nationality ? ' · ' + esc(String(a.nationality).split(',')[0].trim()) : '';
    var fd  = [a.field, a.genre].filter(Boolean).join(' · ');
    var mk  = a.is_oc ? '<span class="mk"><span class="oc-badge">OC</span></span>' : '';

    var plate = a.image_url
      ? '<span class="plate">' +
          '<img src="' + esc(a.image_url) + '" alt="' + esc(a.name_ko) + '" loading="lazy">' +
          (a.rep_work
            ? '<span class="onwork"><span class="w">' +
              esc(String(a.rep_work).split(',')[0].trim()) +
              '</span><span class="m">대표작</span></span>' : '') +
        '</span>'
      : '<span class="plate"><span class="no">그림이<br>아직 없습니다</span></span>';

    return '<a class="card' + (a.image_url ? '' : ' thin') + '" href="/db/artist-view.html?id=' + a.id + '">' +
      plate +
      '<span class="who">' +
        '<span class="nm">' + esc(a.name_ko) + han + '</span>' +
        '<span class="yr">' + esc(yr) + nat + '</span>' +
        (fd ? '<span class="fd">' + esc(fd) + '</span>' : '') + mk +
      '</span></a>';
  }

  function skeleton(n) {
    var out = '';
    for (var i = 0; i < n; i++) {
      out += '<div class="card"><span class="plate loading" style="display:block;height:250px"></span>' +
             '<span class="who"><span class="nm" style="color:transparent">···</span></span></div>';
    }
    return out;
  }

  async function load(reset) {
    if (busy) return;
    busy = true;
    if (reset) { page = 0; grid.innerHTML = skeleton(8); }
    if (moreBtn) moreBtn.disabled = true;

    try {
      var rows = await fetchPage(page);
      if (page === 0) grid.innerHTML = '';
      grid.insertAdjacentHTML('beforeend', rows.map(card).join(''));

      var shown = Math.min((page + 1) * PER, total);
      var left  = Math.max(0, total - shown);
      if (!rows.length || left <= 0) {
        if (moreBtn) moreBtn.parentNode.style.display = 'none';
      } else if (moreBtn) {
        moreBtn.parentNode.style.display = '';
        moreBtn.textContent = '더 보기 · ' + left.toLocaleString() + '명 남음';
        moreBtn.disabled = false;
      }
      if (cntBox && page === 0) {
        cntBox.innerHTML = '<b>' + total.toLocaleString() + '</b>명'
          + (q || fField || fEra ? ' · 추린 것' : '');
      }
      if (!rows.length && page === 0) {
        grid.innerHTML = '<div class="demo-note" style="grid-column:1/-1">' +
          '해당하는 작가가 없습니다.</div>';
      }
      page++;
    } catch (e) {
      grid.innerHTML = '<div class="demo-note" style="grid-column:1/-1">' +
        '자료를 불러오지 못했습니다 · ' + esc(e.message) + '</div>';
      if (moreBtn) moreBtn.parentNode.style.display = 'none';
    }
    busy = false;
  }

  function chips(box, pick) {
    box.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        box.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        var v = b.textContent.trim();
        pick(v === '전체' ? '' : v);
        load(true);
      });
    });
  }

  function boot() {
    grid    = document.getElementById('grid');
    cntBox  = document.getElementById('cnt');
    moreBtn = document.querySelector('.more button');
    if (!grid) return;

    var groups = document.querySelectorAll('.filters .fgrp');
    if (groups[0]) chips(groups[0], function (v) { fField = v; });
    if (groups[1]) chips(groups[1], function (v) { fEra   = v; });

    var input = document.querySelector('.srch input');
    if (input) {
      var t = null;
      input.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { q = input.value.trim(); load(true); }, 320);
      });
    }
    if (moreBtn) moreBtn.addEventListener('click', function () { load(false); });

    load(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
