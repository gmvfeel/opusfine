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

   ══════════════════════════════════════════════════════════════════
   2026-09-13 고침 · 한국 학교 101곳이 들어오면서 셋을 고쳤습니다
   ------------------------------------------------------------------
   ★★ ① 차례 — <b>담아 놓고도 화면에 한 곳도 안 나왔습니다.</b>

      order 가 `quality.desc, sort_no.desc, id.asc` 였습니다.
      새로 담은 101곳은 quality·sort_no 가 0 이고 id 가 251부터라
      <b>맨 뒤로 밀립니다.</b> 첫 쪽에 한 곳도 안 보였습니다.

      ▶ 인계문서 7-6 그대로 —「차례를 잘못 잡으면 자료가 없는 줄 압니다」
      ▶ <b>오퍼스클램은 「최신순」이 기본</b>입니다(차례 고르개 첫 칸).
        그래서 저쪽은 새로 담은 것이 앞에 옵니다. 같이 갑니다.
      ▶ id.asc → <b>id.desc</b>

   ★ ② 지역 — <b>오퍼스클램은 「국내 · 국외」가 맨 앞</b>입니다.
      아시아·유럽·아메리카만 있으면 한국 학교를 찾으려고
      「아시아」를 눌러도 일본·중국에 묻힙니다. 실제로 그랬습니다.
      ▶ 국내 · 국외를 앞에 둡니다.

   ★ ③ 갈래 — 오퍼스클램에 <b>구분 고르개가 있습니다</b>
      (예술중학교 · 예술고등학교 · 음악대학 · 음악원 …).
      미술대학 67 · 예술고 27 · 예술중 7 이 한 목록에 섞였으니
      같은 고르개가 필요합니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var PER = 30;
  var grid, cntBox, moreBox, moreBtn;
  var page = 0, total = 0, busy = false;
  var q = '', fReg = '', fHas = '', fCat = '';

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

  /* ── 국내 · 국외 ────────────────────────────────────────────
     ★ 오퍼스클램 학교DB 의 나라 고르개가 「국내 · 국외 / 국내 / 국외 /
       대한민국 / 독일 / …」 차례입니다. <b>국내·국외가 맨 앞</b>입니다.
     ★ 이 둘은 나라 목록이 아니라 <b>질의에서 바로 거릅니다.</b>
       kr   → location.ilike.대한민국*
       intl → location=not.ilike.대한민국*
     ★ 소재지가 「대한민국 · 서울」 꼴이라 앞머리로 맞으면 됩니다.     */
  var KR_PREFIX = '대한민국';


  /* ── 다국어 도우미 ───────────────────────────────────────────
     ★ 화면 글을 사전에 태웁니다. i18n.js 가 아직 안 실렸으면
       원문을 그대로 돌려주므로 한국어 화면은 그대로 돕니다.
     ★ N() 은 <b>숫자가 낀 글</b>용입니다. 「250곳」처럼 숫자와 낱말이
       붙은 것은 사전 열쇠로 쓸 수 없습니다 — 숫자가 바뀌면 열쇠가
       달라지니까요. 그래서 「{n}곳」을 열쇠로 두고 값만 끼웁니다.
       (오퍼스클램이 2026-08-15 에 같은 일을 겪고 정한 방식입니다) */
  function T(s) { return (window.OFI18N && window.OFI18N.t) ? window.OFI18N.t(s) : s; }
  function N(tpl) {
    var args = [].slice.call(arguments);
    if (window.OFI18N && window.OFI18N.n) return window.OFI18N.n.apply(null, args);
    var vals = args.slice(1);
    return String(tpl).replace(/\{(n|\d+)\}/g, function (m, k) {
      var v = (k === 'n') ? vals[0] : vals[Number(k)];
      if (v === undefined || v === null) return m;
      if (typeof v !== 'number') return String(v);
      if (v >= 1000 && v < 3000 && v === Math.floor(v)) return String(v);
      return v.toLocaleString();
    });
  }

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
    if (fReg === 'kr') {
      p.push('location=ilike.' + KR_PREFIX + '*');
    } else if (fReg === 'intl') {
      /* ★★ `location=not.ilike.대한민국*` 만 쓰면 <b>소재지가 빈 4곳이
         사라집니다.</b> SQL 에서 NULL 은 어느 쪽 비교에도 참이 아닙니다.
         국내 101 + 국외 246 = 347 로 <b>네 곳이 증발했습니다.</b>
         ▶ is.null 을 or 로 함께 물어 살립니다.                         */
      p.push('or=(location.not.ilike.' + KR_PREFIX + '*,location.is.null)');
    } else if (REGION[fReg]) {
      p.push('or=(' + REGION[fReg].map(function (n) {
        return 'location.ilike.' + n + '*';
      }).join(',') + ')');
    }

    /* 갈래 — 미술대학 · 예술고등학교 · 예술중학교 … */
    if (fCat) p.push('category=eq.' + encodeURIComponent(fCat));

    /* ★★ 최신순이 기본입니다 — <b>quality 를 첫 열쇠에서 뺐습니다.</b>

       전에는 `quality.desc, sort_no.desc, id.asc` 였습니다.
       id 를 desc 로 뒤집어도 <b>소용이 없었습니다</b> — quality 가 앞에
       있으니까요. 기존 250곳은 quality 가 1~13 인데 새로 담은 101곳은
       0 이라, 한국 학교가 351곳 가운데 <b>뒤쪽 101칸</b>에 그대로
       머물렀습니다.

       ▶ 오퍼스클램 학교DB 는 quality 로 줄 세우지 않습니다.
         차례 고르개의 첫 칸이 「최신순」입니다. 같이 갑니다.
       ▶ sort_no 는 남깁니다 — 사람이 손으로 끌어올리는 자리입니다.
       ★ quality 는 버리지 않았습니다. 나중에 차례 고르개를 만들 때
         「자료 충실순」으로 살리면 됩니다.                              */
    p.push('order=sort_no.desc,id.desc');
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
    /* ★ 갈래를 앞에 둡니다. 오퍼스클램 학교 목록이 「학교명 · 구분 ·
       소재지」 차례이고, 미술대학·예술고·예술중이 한 목록에 섞이므로
       무엇인지 바로 보여야 합니다. */
    if (s.category) meta.push(esc(s.category));
    if (s.location) meta.push(esc(s.location));
    /* ★ 숫자가 낀 글은 사전으로 못 바꿉니다. OFI18N.n() 으로 넘깁니다.
       사전에는 "{n} 설립": "Founded {n}" 을 둡니다. */
    if (s.founded)  meta.push(N('{n} 설립', esc(s.founded)));

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
        cntBox.innerHTML = N('{n}곳', 0);
        busy = false;
        return;
      }

      grid.insertAdjacentHTML('beforeend', rows.map(card).join(''));
      page++;

      if (total) {
        cntBox.innerHTML = N('<b>{n}</b>곳', total)
          + (fReg || fHas || fCat || q ? ' ' + T('(추린 것)') : '');
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
    chips(document.getElementById('slFCat'), 'data-c', function (v) { fCat = v; });

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
