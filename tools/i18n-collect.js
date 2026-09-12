/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 다국어 사전 낱말 긁기 · tools/i18n-collect.js
   ------------------------------------------------------------------
   화면을 돌며 <b>번역해야 할 한국어</b>를 모아 사전 뼈대를 만듭니다.

   ── 왜 손으로 안 적나 ──────────────────────────────────────────
   오퍼스클램 i18n 은 <b>한국어 원문 자체를 열쇠</b>로 씁니다.
   화면에 data-i18n 을 붙이지 않으므로, 사전에 담을 낱말을
   <b>실제로 그려진 화면에서</b> 긁어내야 합니다.
   손으로 적으면 반드시 빠뜨리고, 화면 글을 고칠 때마다 어긋납니다.

   ── DB 값을 가려냅니다 ─────────────────────────────────────────
   전시 제목 · 미술관 이름 · 작가 이름은 번역 대상이 아닙니다.
   ① DB 를 먼저 읽어 실제 값 목록을 만들고
   ② 화면에서 긁은 조각이 그 목록에 있으면 버립니다
   ③ 숫자로 시작 · 60자 넘음 · 《》 들어감 · D-일 표시도 버립니다

   ★ 버린 것도 함께 보여 줍니다. 잘못 버린 것이 없는지 보셔야 합니다.

   ── 쓰는 법 ────────────────────────────────────────────────────
     1) 오퍼스파인 화면을 열고 브라우저 콘솔(F12)에 이 파일을 붙입니다
     2) await OFCOLLECT.scan()
     3) 다른 화면으로 옮겨 다시 붙이고 scan()  ← 모은 것은 이어집니다
     4) 다 돌았으면 OFCOLLECT.save()  → 파일로 내려받습니다

   ★ 돌 화면 (열한 장)
     /                          /db/artist.html        /db/artist-view.html?id=12
     /db/work.html              /db/work-view.html?id=100
     /db/exhibition.html        /db/exhibition-view.html?id=1
     /db/school.html            /db/school-view.html?id=2

   ── 사전 만들기 ────────────────────────────────────────────────
   save() 가 내려주는 of-i18n-keys.json 을 번역기에 넣어
   assets/i18n/en.json · ja.json … 을 만듭니다.

   ★ 번역 전에 <b>눈으로 한 번</b> 보십시오. 자동 번역이 잘 틀리는 자리 —
     · 「작가」 → writer 가 아니라 <b>artist</b>
     · 「작품」 → work 인지 artwork 인지
     · 「전시공간」·「기관·재단」 같은 우리 메뉴 이름
     · 「오늘의 소장품」·「새로 들어온 작품」 같은 오퍼스파인 고유 표현

   ★ 숫자가 낀 글은 <b>사전에 넣지 말고</b> 화면 코드를 고쳐
     OFI18N.n('전체 {n}건', 1206) 꼴로 바꾸십시오.
     사전에는 "전체 {n}건": "{n} total" 을 둡니다.
     (오퍼스클램이 2026-08-15 에 같은 일을 겪고 정한 방식입니다)

   ★ 견본 구역(공모·지원 · 광고 · 커뮤니티 · 미술시장 · 리쿠르트 ·
     입시 · 이달의 미술학교)의 낱말은 <b>나중에 바뀝니다.</b>
     지금 번역하면 두 번 일이니, 실제 자료가 붙은 뒤에 다시 긁으십시오.
     save() 가 「견본으로 보이는 것」을 따로 갈라 줍니다.
   ══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var HIT  = new Map();
  var DROP = new Map();
  var DB   = new Set();

  /* 견본 구역에서만 나오는 낱말 — 나중에 바뀔 것들 */
  var DEMO = [
    '대한민국미술대전', '창작스튜디오', '도예가', '청년예술가', '호경당',
    '흙과 손', '낙찰', '에듀케이터', '레지스트라', '아트핸들러',
    '수강생', '겨울학기', '물레', '한지에', '유화·수채', '조각가 발굴',
    '접수 마감', '입주 1', '입주 6', '동문 작가', '소장 자료',
    '홍익대학교', '서울 아트페어', '베네치아', '창작준비금'
  ];

  function esc(s) { return String(s == null ? '' : s); }

  /* ── DB 실제 값 모으기 ───────────────────────────────────── */
  async function loadDB() {
    var h = { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };

    async function grab(path, cols) {
      var from = 0;
      for (;;) {
        var res;
        try {
          res = await fetch(OF.SB_URL + '/rest/v1/' + path, {
            headers: Object.assign({}, h, {
              Range: from + '-' + (from + 199), 'Range-Unit': 'items'
            })
          });
        } catch (e) { return; }
        if (!res.ok) return;
        var rows = await res.json();
        if (!Array.isArray(rows) || !rows.length) return;
        rows.forEach(function (r) {
          cols.forEach(function (c) {
            var v = esc(r[c]).trim();
            if (v) DB.add(v);
          });
        });
        from += rows.length;
        if (from >= 4000) return;          /* 너무 많이 받지 않습니다 */
      }
    }

    await grab('exhibitions?select=title,venue,artists,genre,host,city,fee&hidden=not.is.true&order=id.asc',
               ['title', 'venue', 'artists', 'genre', 'host', 'city', 'fee']);
    await grab('artists?select=name_ko,name_en,nationality,field,genre,era_name,medium&hidden=not.is.true&order=id.asc',
               ['name_ko', 'name_en', 'nationality', 'field', 'genre', 'era_name', 'medium']);
    await grab('artworks?select=title,artist_name,holder,medium,year_text,genre,rights,dimensions&hidden=not.is.true&order=id.asc',
               ['title', 'artist_name', 'holder', 'medium', 'year_text', 'genre', 'rights', 'dimensions']);
    await grab('schools?select=name_ko,name_en,location,category,alumni,founded&hidden=not.is.true&order=id.asc',
               ['name_ko', 'name_en', 'location', 'category', 'alumni', 'founded']);

    return DB.size;
  }

  /* ── 버릴 것인가 ─────────────────────────────────────────── */
  function why(s) {
    if (!/[가-힣]/.test(s))       return '한글 없음';
    if (s.length > 60)            return '60자 넘음(본문)';
    if (/^\d/.test(s))            return '숫자로 시작(날짜·건수)';
    if (/[《》]/.test(s))          return '《》 들어감(작품·전시 제목)';
    if (/^D-\d/.test(s))          return 'D-일 표시';
    if (DB.has(s))                return 'DB 값';
    if (s.length >= 6) {
      for (var v of DB) {
        if (v.length > s.length && v.indexOf(s) >= 0) return 'DB 값의 일부';
      }
    }
    return null;
  }

  /* ── 화면 긁기 ───────────────────────────────────────────── */
  async function scan() {
    if (!DB.size) {
      console.log('DB 값을 먼저 받습니다…');
      var n = await loadDB();
      console.log('  DB 값 ' + n + '개');
    }

    /* 앞서 모은 것 이어받기 — 화면을 옮겨도 이어집니다 */
    try {
      var prev = JSON.parse(window.name || '{}');
      if (prev.hit)  prev.hit.forEach(function (e) { if (!HIT.has(e[0]))  HIT.set(e[0], e[1]); });
      if (prev.drop) prev.drop.forEach(function (e) { if (!DROP.has(e[0])) DROP.set(e[0], e[1]); });
    } catch (e) {}

    var skip = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1 };
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node, added = 0;

    while ((node = w.nextNode())) {
      if (skip[node.parentNode.tagName]) continue;
      var s = (node.nodeValue || '').trim().replace(/\s+/g, ' ');
      if (!s) continue;
      var r = why(s);
      if (r) { if (!DROP.has(s)) DROP.set(s, r); }
      else   { if (!HIT.has(s)) { HIT.set(s, location.pathname); added++; } }
    }

    /* 화면에 글로 안 보이는 것도 — 자리표시·툴팁·대체글 */
    var ATTRS = ['placeholder', 'title', 'alt', 'aria-label', 'data-empty', 'data-label'];
    document.querySelectorAll('[' + ATTRS.join('],[') + ']').forEach(function (el) {
      ATTRS.forEach(function (a) {
        var v = (el.getAttribute(a) || '').trim();
        if (!v) return;
        var r = why(v);
        if (r) { if (!DROP.has(v)) DROP.set(v, r); }
        else   { if (!HIT.has(v)) { HIT.set(v, location.pathname + ' [' + a + ']'); added++; } }
      });
    });

    /* 화면을 옮겨도 이어지게 담아 둡니다 */
    window.name = JSON.stringify({ hit: [...HIT.entries()], drop: [...DROP.entries()] });

    console.log('── ' + location.pathname + ' ──');
    console.log('  이 화면에서 새로 ' + added + '개 · 누적 ' + HIT.size + '개');
    console.log('  버린 것 누적 ' + DROP.size + '개');
    return { 화면: location.pathname, 새로: added, 누적: HIT.size, 버림: DROP.size };
  }

  /* ── 파일로 내려받기 ─────────────────────────────────────── */
  function save() {
    var keys = [...HIT.keys()];

    var demo = keys.filter(function (k) {
      return DEMO.some(function (w) { return k.indexOf(w) >= 0; });
    });
    var numbered = keys.filter(function (k) {
      return demo.indexOf(k) < 0 && /\d/.test(k);
    });
    var ready = keys.filter(function (k) {
      return demo.indexOf(k) < 0 && numbered.indexOf(k) < 0;
    });

    /* 사전 뼈대 — 값은 비워 둡니다 */
    var dict = {};
    ready.sort(function (a, b) { return a.length - b.length; })
         .forEach(function (k) { dict[k] = ''; });

    var byReason = {};
    DROP.forEach(function (r, s) { (byReason[r] = byReason[r] || []).push(s); });

    var out = {
      만든때: new Date().toISOString(),
      모두: keys.length,
      번역대상: ready.length,
      나중에: {
        견본구역: demo.length,
        숫자가낀글: numbered.length
      },
      사전뼈대: dict,
      견본구역_나중에: demo,
      숫자가낀글_화면코드를고치세요: numbered,
      버린것: byReason,
      어느화면에서: Object.fromEntries(HIT)
    };

    var blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'of-i18n-keys.json';
    document.body.appendChild(a); a.click(); a.remove();

    console.log('═══ of-i18n-keys.json 을 내려받습니다 ═══');
    console.log('  번역 대상        ' + ready.length + '개  ← 사전에 넣을 것');
    console.log('  견본 구역        ' + demo.length + '개  ← 자료가 붙은 뒤에 다시');
    console.log('  숫자가 낀 글     ' + numbered.length + '개  ← 화면 코드를 OFI18N.n() 으로');
    console.log('  버린 것          ' + DROP.size + '개  ← 파일에서 확인하십시오');
    return out;
  }

  function reset() {
    HIT.clear(); DROP.clear(); window.name = '';
    console.log('비웠습니다');
  }

  window.OFCOLLECT = { scan: scan, save: save, reset: reset, hit: HIT, drop: DROP };
  console.log('준비됐습니다.');
  console.log('  await OFCOLLECT.scan()   ← 이 화면 긁기');
  console.log('  OFCOLLECT.save()         ← 다 돌았으면 파일로');
})();
