/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 전시 수집 통로 · api/collect.js
   ------------------------------------------------------------------
   ★ 왜 이 파일이 있나
     브라우저에서 exhibitions 에 <b>쓸 길이 없습니다.</b>
     조회 정책만 있고, is_admin() 은 members 표가 아직 없어
     늘 false 를 돌려줍니다. 기존 879건은 GitHub Actions 가
     service key 로 넣은 것이었는데, Actions 를 쓰지 않기로
     했으므로(파트너 결정 · 2026-09-11) 길을 새로 냅니다.

     ▶ 오퍼스클램의 제대로 된 얼개는 <b>members 표 + is_admin() 정책</b>
       입니다 (persons·venues·orgs·schools 모두 ALL:is_admin()).
       오퍼스파인도 언젠가 그렇게 갖춰야 합니다.
       이 파일은 그때까지의 <b>수집 전용 통로</b>입니다.

   ★★ 열쇠를 화면에 두지 않습니다
     SUPABASE_SERVICE_KEY 는 RLS 를 통째로 넘어가는 열쇠입니다.
     <b>절대 화면 코드에 넣지 않습니다.</b> 서버 환경변수에서만 꺼냅니다.
     그리고 아무나 못 부르게 COLLECT_TOKEN 자물쇠를 겁니다.

   ── Vercel 환경변수 ────────────────────────────────────────────
     SUPABASE_URL           https://jmankqdbvyrnyhxjmqsa.supabase.co
     SUPABASE_SERVICE_KEY   Supabase → Settings → API Keys → service_role
     COLLECT_TOKEN          아무 긴 문자열 (자물쇠)
     CULTURE_KEY            (이미 있음 · 문화포털)
     DATA_GO_KR_KEY         (이미 있음 · 공공데이터포털)

   ── 쓰는 법 ────────────────────────────────────────────────────
     /api/collect?token=…&src=kcisa145&mode=preview&from=1&to=3
     /api/collect?token=…&src=kcisa145&mode=apply&from=1&to=97
     /api/collect?token=…&src=cultureinfo&mode=apply&from=1&to=31
     /api/collect?token=…&src=kcisa145&mode=undo

       mode=preview  담지 않고 <b>무엇이 담길지만</b> 돌려줍니다
       mode=apply    실제로 담습니다 (겹치면 덮어씀)
       mode=undo     그 source 로 담은 것을 <b>통째로 지웁니다</b>

   ★ 한 번에 몇 쪽까지
     Vercel Function 은 오래 못 붙듭니다. 한 번에 <b>10쪽 안쪽</b>으로
     끊어 부르십시오. 화면(tools/collect.html)이 알아서 끊어 부릅니다.
   ══════════════════════════════════════════════════════════════════ */

/* ── 자료원 ─────────────────────────────────────────────────── */
const SRC = {
  /* 12개 기관 전시정보 · 9,605건 · 문화포털 열쇠 */
  kcisa145: {
    base: 'https://api.kcisa.kr',
    path: '/openapi/API_CCA_145/request',
    env: 'CULTURE_KEY',
    keyName: 'serviceKey',
    rows: 100,                 /* 한 쪽에 100줄 */
    pageParam: 'pageNo',
    extra: {}
  },
  /* 한눈에보는문화정보 · 전시만 304건 · 공공데이터포털 열쇠
     ★ 한 번에 10줄이 상한입니다. numOfRows=100 을 줘도 10 만 옵니다.
     ★ 쪽 인자는 <b>대문자 PageNo</b> 라야 먹습니다 (소문자는 1쪽만). */
  cultureinfo: {
    base: 'https://apis.data.go.kr',
    path: '/B553457/cultureinfo/realm2',
    env: 'DATA_GO_KR_KEY',
    keyName: 'serviceKey',
    rows: 10,
    pageParam: 'PageNo',
    extra: { realmCode: 'D000' }
  }
};

const TIMEOUT_MS = 20000;
const MAX_PAGES  = 12;          /* 한 번에 부를 수 있는 쪽 수 */

/* ══════════════════════════════════════════════════════════════════
   아주 작은 XML 읽개
   ------------------------------------------------------------------
   ★ Node 에는 브라우저의 DOMParser 가 없습니다. 자료가 단순한
     <item><TITLE>…</TITLE></item> 꼴이라 이만큼이면 됩니다.
   ══════════════════════════════════════════════════════════════════ */
/* ★★ 2026-09-12 · 이 함수가 모자라 화면에 「이성륙&middot;최가효」가 찍혔습니다.
     까닭 둘 —
     ① 자료원이 <b>두 겹으로 쌉니다</b> (&amp;lt; 꼴).
        한 번만 풀면 &lt; 가 남습니다. ▶ <b>세 번 되풀이</b>합니다.
     ② &middot; &rsquo; &times; 같은 <b>이름 있는 기호</b>가 많습니다.
        &lt; &gt; &amp; 넷만 풀면 나머지가 글자로 남습니다.
     ★ &amp; 는 <b>맨 마지막</b>에 풀어야 두 겹이 벗겨집니다. */
const ENT = {
  '&lt;':'<', '&gt;':'>', '&quot;':'"', '&apos;':"'",
  '&nbsp;':' ', '&shy;':'',
  '&middot;':'·', '&bull;':'•', '&times;':'×', '&divide;':'÷',
  '&lsquo;':'\u2018', '&rsquo;':'\u2019', '&ldquo;':'\u201C', '&rdquo;':'\u201D',
  '&ndash;':'\u2013', '&mdash;':'\u2014', '&hellip;':'…', '&deg;':'°',
  '&ouml;':'ö', '&uuml;':'ü', '&auml;':'ä', '&eacute;':'é'
};
function unescapeXml (s) {
  let o = String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  for (let i = 0; i < 3; i++) {
    o = o.replace(/&#(\d{1,7});/g, function (_, n) {
      const c = parseInt(n, 10);
      return (c > 0 && c < 0x110000) ? String.fromCodePoint(c) : _;
    });
    o = o.replace(/&[a-zA-Z]+;/g, function (m) {
      return Object.prototype.hasOwnProperty.call(ENT, m) ? ENT[m] : m;
    });
    o = o.replace(/&amp;/g, '&');   /* ★ 맨 마지막 */
  }
  return o;
}

/* 한 덩이 안에서 <태그>값</태그> 를 뽑습니다 */
function pick (chunk, tag) {
  const m = chunk.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
  return m ? unescapeXml(m[1]).trim() : '';
}

/* 전체에서 <item>…</item> 또는 <perforList>…</perforList> 덩이를 다 끊어냅니다 */
function chunks (xml) {
  const out = [];
  const re = /<(item|perforList)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[2]);
  return out;
}

/* ══════════════════════════════════════════════════════════════════
   날짜 뽑개
   ------------------------------------------------------------------
   ★★★ 2026-09-12 · 날짜는 EVENT_PERIOD 가 아니라 <b>PERIOD</b> 에
     있습니다. EVENT_PERIOD 는 <b>관람시간</b> 칸입니다 —
       (화-일) 10:00 - 18:00 ※ 매주 월요일 휴관
     인계문서가 두 달 동안 이 둘을 바꿔 보고 있었습니다.
   ★ 구분자가 <b>두 가지</b>입니다 — 「~」 와 「 - 」.
     하나만 보면 절반을 놓칩니다.
   ══════════════════════════════════════════════════════════════════ */
function twoDates (raw) {
  const s = String(raw || '').replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return [null, null];

  let m;
  /* 2026-08-06~2026-11-08  ·  2025-07-04 - 2025-10-19 */
  m = s.match(/(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})\s*[~\-–—]\s*(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})/);
  if (m) return [ymd(m[1], m[2], m[3]), ymd(m[4], m[5], m[6])];

  /* 20260806~20261108 */
  m = s.match(/(\d{4})(\d{2})(\d{2})\s*[~\-–—]\s*(\d{4})(\d{2})(\d{2})/);
  if (m) return [ymd(m[1], m[2], m[3]), ymd(m[4], m[5], m[6])];

  return [null, null];
}
function ymd (y, m, d) {
  const mm = String(m).padStart(2, '0'), dd = String(d).padStart(2, '0');
  const s = y + '-' + mm + '-' + dd;
  return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s) ? s : null;
}
/* 한눈에보는은 20260806 꼴로 옵니다 */
function oneDate (raw) {
  const d = String(raw || '').replace(/[^0-9]/g, '');
  return d.length === 8 ? ymd(d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)) : null;
}

/* ══════════════════════════════════════════════════════════════════
   갈래 판정 — art / museum / other
   ------------------------------------------------------------------
   ★★ 2026-09-12 정찰에서 배운 것 —
     장소 이름으로 기계가 가른 「판정 못함」 79건을 눈으로 다 봤더니
     <b>거의 전부가 진짜 미술 전시</b>였습니다
     (이우환 공간 · 김창열 화가의 집 · 성북구립미술관 · 예화랑 …).
     ▶ 그래서 <b>기본값이 art 입니다.</b> 뚜렷이 아닌 것만 내립니다.
     ▶ 「판정 못하면 버린다」로 두면 알짜를 버립니다.

   ★ 담되 감추지 않습니다. hidden 은 그대로 false 로 둡니다.
     대문에서 art 만 걸면 되고, 판정을 나중에 고쳐도
     자료를 다시 안 받아도 됩니다.
   ══════════════════════════════════════════════════════════════════ */
const 박물기관 = /박물관|기념관|역사관|한글박물관|박물관문화재단/;
const 그밖기관 = /영상자료원|도서관|체육|선수촌/;
const 그밖제목 = /영화|게임|교재|페스타|북적|도서관/;
const 미술낌새 = /미술|갤러리|갤러리|아트|展|전展|개인전|비엔날레|아트페어|서예|공예|회화|조각|사진전|디자인|작가|창작스튜디오|레지던|예술의전당|예술종합학교|문화전당/;

function judgeKind (title, venue, org) {
  const t = String(title || ''), v = String(venue || ''), o = String(org || '');
  const all = t + ' ' + v + ' ' + o;

  /* ① 뚜렷이 미술이면 바로 art — 박물관에서 여는 미술 전시가 있습니다
        (국립중앙박물관 「모던 아트의 탄생」 같은 것) */
  if (미술낌새.test(all)) return 'art';

  /* ② 뚜렷이 그 밖이면 other */
  if (그밖기관.test(o) || 그밖기관.test(v) || 그밖제목.test(t)) return 'other';

  /* ③ 박물관·기념관이면 museum */
  if (박물기관.test(o) || 박물기관.test(v)) return 'museum';

  /* ④ 나머지는 art — 정찰에서 판정 못한 것 대부분이 미술이었습니다 */
  return 'art';
}

/* 지역 — 한눈에보는만 줍니다 */
function normRegion (a) {
  const s = String(a || '').trim();
  return s || null;
}

/* ══════════════════════════════════════════════════════════════════
   한 줄 만들기
   ══════════════════════════════════════════════════════════════════ */
function rowFromKcisa (c) {
  const title = pick(c, 'TITLE');
  const localId = pick(c, 'LOCAL_ID');
  if (!title || !localId) return null;

  /* ★ GENRE 가 채워진 것만 담습니다 (파트너 결정 · ㉠안 「가」)
       표본 1,075건에서 GENRE 있는 546건은 <b>PERIOD 가 100%</b> 있었고,
       국립중앙박물관의 유물 단품(굽다리 항아리 …)은 전부 GENRE 가
       비어 있어 이 칼 하나로 저절로 걸러집니다. */
  const status = pick(c, 'GENRE');
  if (!status) return null;

  const [s, e] = twoDates(pick(c, 'PERIOD'));
  const org = pick(c, 'CNTC_INSTT_NM');
  const venue = pick(c, 'EVENT_SITE');

  /* ★★ 2026-09-12 · <b>AUTHOR 만</b>이 참여작가입니다.
       처음에 AUTHOR+ACTOR+CONTRIBUTOR 셋을 합쳐 넣었더니
       artists 칸이 <b>주최기관으로 채워졌습니다</b> —
       「국립현대미술관 / 한국근대미술사학회」·「동아일보사」·「문화공보부」.
       셋을 따로 재어 보니 (표본 235건) —
         AUTHOR      108건 · <b>105건이 사람 이름</b>
                     「김경, 문신, 박고석, 유영국, 이규상, 천경자, 한묵」
                     「곽덕준, 권진규, 김환기, 박수근, 이중섭, 구사마 야요이」
         ACTOR         0건 · <b>아예 안 옵니다.</b> 괜히 붙였습니다
         CONTRIBUTOR 217건 · 전부 <b>주최·협찬 기관</b>
                     「국립현대미술관 / (협찬) 노루페인트, 무림페이퍼」
     ▶ 칸 이름이 비슷하다고 묶지 않습니다. <b>하나씩 열어 봅니다.</b>
     ★ CONTRIBUTOR 는 담지 않습니다. 주최기관을 둘 자리가 아직 없고,
       필요해지면 다시 받으면 됩니다(5분). 없는 칸을 미리 만들지 않습니다. */
  const artists = pick(c, 'AUTHOR') || null;

  return {
    source: 'kcisa145',
    source_id: localId,
    title: title,
    venue: venue || null,
    organizer: org || null,
    start_date: s,
    end_date: e,
    artists: artists,
    open_time: pick(c, 'EVENT_PERIOD') || null,   /* ★ 관람시간은 여기가 제자리 */
    charge: pick(c, 'CHARGE') || null,
    body: pick(c, 'DESCRIPTION') || null,
    poster_url: pick(c, 'IMAGE_OBJECT') || null,
    poster_credit: org || null,
    link_source: pick(c, 'URL') || null,
    kind: judgeKind(title, venue, org),
    region: null,
    rights: 'public-institution'
  };
}

function rowFromCulture (c) {
  const title = pick(c, 'title');
  const seq = pick(c, 'seq');
  if (!title || !seq) return null;

  const place = pick(c, 'place');

  /* ★★ 2026-09-12 · <b>thumbnail 칸이 있습니다.</b>
       인계문서 5장 표에 「포스터 : 없음」이라 적혀 있어 그대로 믿었는데,
       실제로 두드려 보니 <b>304건 전부(100%)</b> 있었습니다.
       ▶ 규칙 7-3 그대로입니다 — <b>적힌 말이 아니라 잰 값</b>을 봅니다.
       ▶ 목록(realm2)에 이미 있습니다. 상세(detail2)까지 갈 것도 없었습니다.
     ★ 주소가 http 로 옵니다. 우리 사이트는 https 라 <b>섞이면 막힙니다</b>.
       https 로 바꿔 담습니다 (저쪽도 https 로 잘 열립니다 · 500×800). */
  let poster = pick(c, 'thumbnail');
  if (poster) poster = poster.replace(/^http:\/\//i, 'https://');

  /* ★ serviceName 을 믿지 마십시오. 「공연」으로 표시된 11건이
       전부 미술 전시였습니다 (이응노·유영국·반 고흐 …).
       그래서 거르지 않고 <b>304건 전부</b> 담습니다. */
  return {
    source: 'cultureinfo',
    source_id: seq,
    title: title,
    venue: place || null,
    venue_dept: pick(c, 'sigungu') || null,   /* ★ 시군구까지 옵니다 */
    organizer: null,
    start_date: oneDate(pick(c, 'startDate')),
    end_date: oneDate(pick(c, 'endDate')),
    artists: null,
    open_time: null,
    charge: null,
    body: null,
    poster_url: poster || null,
    poster_credit: '한국문화정보원',
    link_source: null,
    genre: pick(c, 'realmName') || null,
    kind: judgeKind(title, place, ''),
    region: normRegion(pick(c, 'area')),
    rights: 'public-institution'
  };
}

/* ══════════════════════════════════════════════════════════════════
   Supabase 로 보내기 — service key 는 <b>여기 서버 안에서만</b>
   ══════════════════════════════════════════════════════════════════ */
async function upsert (rows) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL 또는 SUPABASE_SERVICE_KEY 가 서버에 없습니다');

  const r = await fetch(url.replace(/\/+$/, '') + '/rest/v1/exhibitions?on_conflict=source,source_id', {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(rows)
  });
  if (!r.ok) throw new Error('담기 실패 ' + r.status + ' · ' + (await r.text()).slice(0, 300));
  return rows.length;
}

async function removeBySource (src) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL 또는 SUPABASE_SERVICE_KEY 가 서버에 없습니다');

  const r = await fetch(url.replace(/\/+$/, '') + '/rest/v1/exhibitions?source=eq.' + encodeURIComponent(src), {
    method: 'DELETE',
    headers: {
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Prefer': 'return=minimal'
    }
  });
  if (!r.ok) throw new Error('지우기 실패 ' + r.status + ' · ' + (await r.text()).slice(0, 300));
}

/* ══════════════════════════════════════════════════════════════════ */
export default async function handler (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const q = req.query || {};

  /* ── 자물쇠 ─────────────────────────────────────────────── */
  const want = process.env.COLLECT_TOKEN;
  if (!want) { res.status(500).json({ 오류: '서버에 COLLECT_TOKEN 이 없습니다' }); return; }
  if (String(q.token || '') !== want) { res.status(401).json({ 오류: '자물쇠가 안 맞습니다' }); return; }

  const srcName = String(q.src || '');
  const spec = SRC[srcName];
  if (!spec) { res.status(400).json({ 오류: '모르는 자료원', 있는것: Object.keys(SRC) }); return; }

  const mode = String(q.mode || 'preview');

  /* ── C-undo ─────────────────────────────────────────────── */
  if (mode === 'undo') {
    try { await removeBySource(srcName); res.status(200).json({ ok: true, 한일: '지움', 자료원: srcName }); }
    catch (e) { res.status(500).json({ ok: false, 오류: String(e.message || e) }); }
    return;
  }

  const from = Math.max(1, parseInt(q.from, 10) || 1);
  const to   = Math.max(from, parseInt(q.to, 10) || from);
  if (to - from + 1 > MAX_PAGES) {
    res.status(400).json({ 오류: '한 번에 ' + MAX_PAGES + '쪽까지만 됩니다', 달라신것: (to - from + 1) });
    return;
  }

  const apiKey = process.env[spec.env];
  if (!apiKey) { res.status(500).json({ 오류: '서버에 열쇠가 없습니다', 필요한것: spec.env }); return; }

  /* ── 받아서 줄로 바꾸기 ───────────────────────────────── */
  const rows = [];
  const 쪽별 = [];
  let total = null, 버린것 = 0;

  for (let p = from; p <= to; p++) {
    const params = new URLSearchParams(spec.extra);
    params.set(spec.keyName, apiKey);
    params.set('numOfRows', String(spec.rows));
    params.set(spec.pageParam, String(p));

    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    let xml = '';
    try {
      const up = await fetch(spec.base + spec.path + '?' + params.toString(), {
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'OpusfineBot/1.0 (https://opusfine.vercel.app; cser@wixon.co.kr)',
          'Accept': '*/*'
        }
      });
      xml = await up.text();
    } catch (e) {
      쪽별.push({ 쪽: p, 오류: String(e.message || e).slice(0, 80) });
      clearTimeout(timer);
      continue;
    }
    clearTimeout(timer);

    if (total === null) {
      const t = xml.match(/<totalCount>(\d+)<\/totalCount>/i);
      if (t) total = parseInt(t[1], 10);
    }

    const cs = chunks(xml);
    let 담김 = 0;
    cs.forEach(function (c) {
      const row = (srcName === 'kcisa145') ? rowFromKcisa(c) : rowFromCulture(c);
      if (row) { rows.push(row); 담김++; } else { 버린것++; }
    });
    쪽별.push({ 쪽: p, 온것: cs.length, 쓸것: 담김 });
  }

  /* 같은 묶음 안에서 source_id 가 겹치면 뒤엣것만 남깁니다
     — PostgREST 는 한 번의 upsert 안에 같은 열쇠가 둘이면 성냅니다 */
  const seen = new Set(), uniq = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    if (seen.has(rows[i].source_id)) continue;
    seen.add(rows[i].source_id); uniq.push(rows[i]);
  }
  uniq.reverse();

  /* 날짜·갈래 헤아리기 */
  const 오늘 = new Date().toISOString().slice(0, 10);
  let 날짜있음 = 0, 지금열림 = 0, 포스터 = 0;
  const 갈래 = { art: 0, museum: 0, other: 0 };
  uniq.forEach(function (r) {
    if (r.start_date && r.end_date) {
      날짜있음++;
      if (r.start_date <= 오늘 && 오늘 <= r.end_date) 지금열림++;
    }
    if (r.poster_url) 포스터++;
    갈래[r.kind] = (갈래[r.kind] || 0) + 1;
  });

  const 요약 = {
    자료원: srcName, 모드: mode, 쪽: from + '~' + to,
    전체건수: total,
    받은줄: rows.length, 담을줄: uniq.length, 거른줄: 버린것,
    날짜있음: 날짜있음, 지금열림: 지금열림, 포스터: 포스터,
    갈래: 갈래, 쪽별: 쪽별
  };

  /* ── A-preview ──────────────────────────────────────────── */
  if (mode !== 'apply') {
    요약.맛보기 = uniq.slice(0, 8).map(function (r) {
      return [r.kind, r.start_date || '(날짜없음)', r.organizer || r.venue || '', r.title].join(' · ');
    });
    res.status(200).json(요약);
    return;
  }

  /* ── B-apply ────────────────────────────────────────────── */
  try {
    if (uniq.length) {
      /* 200줄씩 끊어 보냅니다 — 한 번에 너무 크면 저쪽이 거부합니다 */
      for (let i = 0; i < uniq.length; i += 200) await upsert(uniq.slice(i, i + 200));
    }
    요약.한일 = '담음';
    res.status(200).json(요약);
  } catch (e) {
    res.status(500).json({ ok: false, 오류: String(e.message || e), 요약: 요약 });
  }
}
