/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 미술단체 목록 · assets/group-list.js · 2026-10-01
   ------------------------------------------------------------------
   glossary-list.js 의 "분류를 DB 에서 세어 만들기" 틀을 그대로 씁니다.
     · hidden 은 not.is.true 로 거릅니다
     · 한 번에 받는 건 PER 개뿐 · 0줄일 때만 끝으로 봅니다
     · 받아오지 못하면 견본을 두지 않고 실패했다고 적습니다

   ★ region(활동지역) 칸은 "서울,경기" 처럼 여러 값이 콤마로 섞여
     있습니다. 추리개는 그 글자 그대로를 포함하는지(ilike)로 거릅니다
     — 쪼개 세면 콤마 안쪽 순서가 뒤섞여 추리개 이름과 실제 단체 수가
     어긋날 수 있어, "값 전체에 그 지역 이름이 들어가는지"로 통일합니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.OF || !OF.SB_URL) return;

  var PER = 24;
  var grid, cntBox, moreBox, moreBtn, regionBox;
  var page = 0, total = 0, busy = false;
  var q = '', region = '';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function head(withCount) {
    var h = { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };
    if (withCount) h.Prefer = 'count=exact';
    return h;
  }
  async function get(u) {
    var r = await fetch(u, { headers: head() });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  }

  function query() {
    var p = [];
    p.push('select=name,founded_year,address,website,activity_fields,region,business_fields');
    p.push('hidden=not.is.true');
    if (region) p.push('region=ilike.*' + encodeURIComponent(region) + '*');
    if (q) {
      var w = '*' + q.replace(/[*(),]/g, '') + '*';
      p.push('or=(name.ilike.' + w + ',address.ilike.' + w + ')');
    }
    p.push('order=name.asc');
    return OF.SB_URL + '/rest/v1/groups?' + p.join('&');
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

  function tags(csv) {
    if (!csv) return '';
    return csv.split(',').map(function (t) { return t.trim(); }).filter(Boolean)
      .map(function (t) { return '<span class="sl-tag">' + esc(t) + '</span>'; }).join('');
  }

  function card(g) {
    var h = '<div class="sl-item">';
    h += '<span class="sl-nm">' + esc(g.name || '(이름 없음)')
      + (g.founded_year ? '<span class="sl-yr">' + g.founded_year + '년 설립</span>' : '') + '</span>';
    var meta = [g.region, g.address].filter(Boolean);
    if (meta.length) h += '<span class="sl-meta">' + meta.map(esc).join(' <i>·</i> ') + '</span>';
    h += '<div class="sl-tags">' + tags(g.activity_fields) + tags(g.business_fields) + '</div>';
    if (g.website) {
      h += '<a class="sl-go" href="' + esc(g.website) + '" target="_blank" rel="noopener noreferrer">웹사이트 →</a>';
    }
    h += '</div>';
    return h;
  }

  function skeleton(n) {
    var h = '';
    for (var i = 0; i < n; i++) {
      h += '<div class="sl-skel"><span style="width:30%"></span>'
         + '<span style="width:60%"></span><span style="width:40%"></span></div>';
    }
    return h;
  }

  function note(msg) {
    return '<div class="demo-note">' + msg + '</div>';
  }

  async function load(reset) {
    if (busy) return;
    busy = true;
    if (reset) { page = 0; grid.innerHTML = skeleton(5); }

    try {
      var rows = await fetchPage(page);
      if (page === 0) grid.innerHTML = '';

      if (!rows.length && page === 0) {
        grid.innerHTML = note('찾으시는 단체가 없습니다. 다른 말로 찾아 보십시오.');
        moreBox.hidden = true;
        cntBox.innerHTML = '0개';
        busy = false;
        return;
      }

      grid.insertAdjacentHTML('beforeend', rows.map(card).join(''));
      page++;

      if (total != null) {
        cntBox.innerHTML = '<b>' + total.toLocaleString() + '</b>개' + ((q || region) ? ' (추린 것)' : '');
      }
      moreBox.hidden = rows.length === 0 || (total && page * PER >= total);

    } catch (e) {
      grid.innerHTML = note('자료를 불러오지 못했습니다 — ' + esc(String(e.message).slice(0, 160)));
      moreBox.hidden = true;
      cntBox.textContent = '';
    }
    busy = false;
  }

  /* 흔한 광역 지역 이름만 추려 추리개로 둡니다(값 자체가 "서울,경기"
     처럼 섞여 있어 쪼개 세지 않고, 미리 정한 이름의 등장 횟수만 셉니다). */
  var REGIONS = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산',
    '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

  async function buildRegions() {
    if (!regionBox) return;
    var rows = [];
    try {
      rows = await get(OF.SB_URL + '/rest/v1/groups'
        + '?select=region&hidden=not.is.true&region=not.is.null&limit=1000');
    } catch (e) { return; }
    var cnt = {};
    rows.forEach(function (r) {
      REGIONS.forEach(function (name) {
        if (String(r.region || '').indexOf(name) >= 0) cnt[name] = (cnt[name] || 0) + 1;
      });
    });
    Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })
      .slice(0, 10)
      .forEach(function (v) {
        var b = document.createElement('button');
        b.className = 'sl-chip';
        b.dataset.r = v;
        b.textContent = v;
        b.title = v + ' · ' + cnt[v] + '건';
        regionBox.appendChild(b);
      });
  }

  function boot() {
    grid      = document.getElementById('slGrid');
    cntBox    = document.getElementById('slCnt');
    moreBox   = document.getElementById('slMore');
    regionBox = document.getElementById('slFRegion');
    if (!grid) return;
    moreBtn = moreBox ? moreBox.querySelector('button') : null;

    if (regionBox) regionBox.addEventListener('click', function (e) {
      var b = e.target.closest('.sl-chip'); if (!b) return;
      Array.prototype.forEach.call(regionBox.querySelectorAll('.sl-chip'),
        function (x) { x.classList.toggle('on', x === b); });
      region = b.dataset.r || '';
      load(true);
    });

    var box = document.getElementById('slQ');
    if (box) {
      var t;
      box.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { q = box.value.trim(); load(true); }, 280);
      });
    }
    if (moreBtn) moreBtn.addEventListener('click', function () { load(false); });

    buildRegions();
    load(true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();
})();
