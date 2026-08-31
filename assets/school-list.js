/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 미술대학 목록 · assets/school-list.js
   ------------------------------------------------------------------
   schools 표에서 읽어 카드를 그립니다.

   ★★ 오퍼스클램·오퍼스파인에서 값을 치르고 배운 것

     ① <b>hidden 은 `is.false` 로 거르면 안 됩니다.</b> 빈 값인 줄이
        통째로 빠집니다. `not.is.true` 를 씁니다.

     ② 응답은 한 번에 <b>200줄까지</b>만 옵니다. 「받은 줄이 요청보다
        적으면 끝」으로 판단하면 안 됩니다 — <b>0줄일 때</b> 끝냅니다.
        전체 수는 count 로 따로 묻습니다.

     ③ 화면에 견본을 두지 않습니다. 자료가 실패하면 <b>실패했다고</b>
        적습니다. 견본이 남아 있으면 다음 사람이 그것을 자료로 믿습니다.
        (작품 상세 #more-ar 에 작가 견본 6개가 여태 숨어 있었습니다)

     ④ 정규식 둘을 `||` 로 잇지 않습니다. 앞엣것만 남습니다.

   ★ 자료가 얇은 학교도 감추지 않습니다. 그대로 보여 줍니다.
   ★ 한글 이름이 없어 영문이 보이는 곳도 감추지 않습니다 —
     그것이 지금 자료의 실태이고, 감추면 고칠 생각을 못 합니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var PER = 30;
  var grid, cntBox, moreBox, moreBtn;
  var page = 0, total = 0, busy = false;
  var q = '', fReg = '', fHas = '';

  /* ── 지역 · 소재지 글자로 가립니다 ─────────────────────────
     ★ 소재지가 '핀란드 · 헬싱키' 꼴입니다. 앞쪽이 나라입니다.
     ★ 나라 이름을 낱개로 적으면 놓칩니다 — 실체가 250곳뿐이라
       실제로 들어 있는 나라를 세어 넣었습니다.
       (미국 105 · 이탈리아 21 · 영국 20 · 독일 11 · 프랑스 9 …) */
  var REGION = {
    asia:    ['일본', '중화인민공화국', '중국', '인도', '대한민국', '한국', '타이완',
              '이스라엘', '터키', '튀르키예', '싱가포르', '타이', '베트남', '인도네시아',
              '필리핀', '말레이시아', '파키스탄', '방글라데시', '이란', '레바논'],
    europe:  ['이탈리아', '영국', '독일', '프랑스', '벨기에', '오스트리아', '네덜란드',
              '덴마크', '스웨덴', '노르웨이', '핀란드', '스페인', '포르투갈', '스위스',
              '러시아', '폴란드', '체코', '헝가리', '그리스', '아일랜드', '루마니아',
              '불가리아', '크로아티아', '세르비아', '슬로베니아', '슬로바키아', '우크라이나',
              '에스토니아', '라트비아', '리투아니아', '아이슬란드', '몰타', '키프로스'],
    america: ['미국', '캐나다', '멕시코', '브라질', '아르헨티나', '칠레', '콜롬비아',
              '페루', '쿠바', '우루과이', '베네수엘라', '에콰도르']
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var hasKo = function (s) { return /[가-힣]/.test(String(s || '')); };

  /* ── 질의 ─────────────────────────────────────────────────── */
  function query(from, to) {
    var p = [];
    p.push('select=id,slug,name_ko,name_en,category,location,founded,'
         + 'alumni,logo_url,image_url,description,bio,link_home,link_wiki,'
         + 'wikidata_id,quality');
    p.push('hidden=not.is.true');            /* ★ is.false 아닙니다 */

    if (q) {
      /* 이름 두 칸을 함께 봅니다 — or 로 묶습니다 */
      var w = '*' + q.replace(/[*(),]/g, '') + '*';
      p.push('or=(name_ko.ilike.' + w + ',name_en.ilike.' + w + ')');
    }
    if (fHas === 'alumni') p.push('alumni=not.is.null');
    if (fHas === 'bio')    p.push('description=not.is.null');

    /* 지역은 소재지 글자로 거릅니다.
       ★ 아시아·유럽·아메리카는 나라 목록으로, '그 밖'은 세 목록에
         들지 않는 것이므로 <b>여기서 거르지 않고</b> 받아서 가립니다.
         PostgREST 로 '어느 목록에도 없음'을 적기가 지저분해집니다. */
    if (REGION[fReg]) {
      p.push('or=(' + REGION[fReg].map(function (n) {
        return 'location.ilike.' + n + '*';
      }).join(',') + ')');
    }

    p.push('order=quality.desc,sort_no.desc,id.asc');
    return OF.SB_URL + '/rest/v1/schools?' + p.join('&');
  }

  function head(withCount) {
    var h = { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };
    if (withCount) h.Prefer = 'count=exact';
    return h;
  }

  async function fetchPage(n) {
    var from = n * PER, to = from + PER - 1;
    var res = await fetch(query(from, to), {
      headers: Object.assign(head(n === 0), {
        Range: from + '-' + to, 'Range-Unit': 'items'
      })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
    if (n === 0) {
      var cr = res.headers.get('content-range') || '';
      var m = cr.match(/\/(\d+)$/);
      if (m) total = Number(m[1]);
    }
    return await res.json();
  }

  /* ── 카드 한 장 ───────────────────────────────────────────── */
  function card(s) {
    var name = s.name_ko || s.name_en || '(이름 없음)';
    var roman = !hasKo(name);
    var logo = s.logo_url || s.image_url;
    var href = '/db/school-view.html?id=' + encodeURIComponent(s.id);

    var meta = [];
    if (s.location) meta.push(esc(s.location));
    if (s.founded)  meta.push(esc(s.founded) + ' 설립');

    var h = '<a class="sl-item" href="' + href + '">';
    h += '<span class="sl-head">';
    h += logo
      ? '<span class="sl-logo"><img src="' + esc(logo) + '" alt="" loading="lazy"'
        + ' onerror="this.parentNode.classList.add(&quot;none&quot;);this.remove()"></span>'
      : '<span class="sl-logo none"></span>';
    h += '<span class="sl-body">';
    h += '<span class="sl-nm' + (roman ? ' roman' : '') + '">' + esc(name) + '</span>';
    /* 한글 이름이 있을 때만 영문을 아래에 곁들입니다 (같은 글자 두 번 안 보이게) */
    if (!roman && s.name_en && s.name_en !== name) {
      h += '<span class="sl-en">' + esc(s.name_en) + '</span>';
    }
    if (meta.length) h += '<span class="sl-meta">' + meta.join('<i>·</i>') + '</span>';
    h += '</span></span>';

    if (s.alumni) {
      h += '<span class="sl-al"><span class="sl-alk">Alumni</span>'
         + esc(s.alumni) + '</span>';
    }
    h += '</a>';
    return h;
  }

  function skeleton(n) {
    var h = '';
    for (var i = 0; i < n; i++) {
      h += '<div class="sl-skel"><span style="width:52%"></span>'
         + '<span style="width:34%"></span><span style="width:72%"></span></div>';
    }
    return h;
  }

  function note(msg) {
    return '<div class="demo-note" style="grid-column:1/-1">' + msg + '</div>';
  }

  /* ── 불러오기 ─────────────────────────────────────────────── */
  async function load(reset) {
    if (busy) return;
    busy = true;
    if (reset) { page = 0; grid.innerHTML = skeleton(6); }

    try {
      var rows = await fetchPage(page);
      if (page === 0) grid.innerHTML = '';

      /* '그 밖' 은 세 목록에 없는 것 — 받아서 가립니다 */
      if (fReg === 'etc') {
        var known = REGION.asia.concat(REGION.europe, REGION.america);
        rows = rows.filter(function (s) {
          var loc = String(s.location || '');
          return !known.some(function (n) { return loc.indexOf(n) === 0; });
        });
      }

      if (!rows.length && page === 0) {
        grid.innerHTML = note('찾으시는 학교가 없습니다. 다른 말로 찾아 보십시오.');
        moreBox.hidden = true;
        cntBox.innerHTML = '0곳';
        busy = false;
        return;
      }

      grid.insertAdjacentHTML('beforeend', rows.map(card).join(''));
      page++;

      if (total) {
        cntBox.innerHTML = '<b>' + total.toLocaleString() + '</b>곳'
          + (fReg || fHas || q ? ' (추린 것)' : '');
      }
      /* ★ 0줄일 때 끝냅니다. 요청보다 적게 왔다고 끝내지 않습니다. */
      moreBox.hidden = rows.length === 0 || (total && page * PER >= total);

    } catch (e) {
      /* ★ 실패하면 견본을 두지 않고 실패했다고 적습니다 */
      grid.innerHTML = note('자료를 불러오지 못했습니다 — ' + esc(String(e.message).slice(0, 160)));
      moreBox.hidden = true;
      cntBox.textContent = '';
    }
    busy = false;
  }

  /* ── 추리개 단추 ──────────────────────────────────────────── */
  function chips(box, attr, pick) {
    if (!box) return;
    box.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        box.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        pick(b.getAttribute(attr) || '');
        load(true);
      });
    });
  }

  function boot() {
    grid    = document.getElementById('slGrid');
    cntBox  = document.getElementById('slCnt');
    moreBox = document.getElementById('slMore');
    if (!grid) return;
    moreBtn = moreBox ? moreBox.querySelector('button') : null;

    chips(document.getElementById('slFReg'), 'data-r', function (v) { fReg = v; });
    chips(document.getElementById('slFHas'), 'data-h', function (v) { fHas = v; });

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
