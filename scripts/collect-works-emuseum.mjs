#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 국내 유물 수집 · scripts/collect-works-emuseum.mjs
   ------------------------------------------------------------------
   국립중앙박물관 e뮤지엄(전국 354개 박물관, 250만 건)에서 받습니다.

   쓰는 법
     node scripts/collect-works-emuseum.mjs --peek            (칸 이름부터 봅니다)
     node scripts/collect-works-emuseum.mjs --q 회화 --limit 300
     node scripts/collect-works-emuseum.mjs --q 도자 --dry

   ★★ <b>칸 이름을 짐작하지 않습니다.</b>
     --peek 을 붙이면 자료원이 실제로 주는 칸 이름과 값을 찍어 봅니다.
     보고 나서 코드를 맞춥니다. 오늘 두 번 겪었습니다 —
     짐작해 넣으면 조용히 빈 값이 되거나 엉뚱한 것이 딸려 옵니다.

   ★ 하루 1,000건 한도입니다(개발계정). 넘기지 않게 스스로 셉니다.
     넘으면 <b>멈추고 다음 회차에 이어</b> 받습니다.

   ★ 저작권 — 공공누리 표시가 오는지 --peek 으로 먼저 봅니다.
     확실하지 않으면 rights='unknown' 으로 두어 <b>화면에 안 나오게</b>
     합니다. 모를 때 안 싣는 쪽이 안전합니다.

   ★ 도판은 원본 주소를 링크합니다. 우리 저장소에 담지 않습니다.
   ══════════════════════════════════════════════════════════════════ */

import { makeGetJSON, isStop, stopReason } from './lib/http.mjs';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const GO_KEY = process.env.DATA_GO_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('★ SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}
if (!GO_KEY) {
  console.error('★ DATA_GO_KEY 가 없습니다. 공공데이터포털 인증키를 Secrets 에 넣으십시오.');
  process.exit(1);
}

/* ★★ 2026-08-22 · <b>주소를 짐작했다가 틀렸습니다.</b>
     apis.data.go.kr/B551027/… 로 적었는데 「해당 오픈API 가 없거나
     폐기됨」이 왔습니다. 파트너가 신청하신 곳은 공공데이터포털이
     아니라 <b>문화공공데이터광장</b>(한국문화정보원)이었습니다.
     주소 규칙이 다릅니다.

   ▶ 이번에는 짐작하지 않고 <b>스스로 찾게</b> 합니다.
     문화공공데이터광장 주소는 이런 모양입니다 —
       https://api.kcisa.kr/openapi/service/rest/meta□□/○○○
     후보를 차례로 두드려 보고 <b>답이 오는 것</b>을 씁니다.
   ★ 찾으면 기록에 적어 둡니다. 다음부터는 그것만 쓰면 됩니다. */
const KCISA = 'https://api.kcisa.kr/openapi/service/rest';
let API = process.env.EMUSEUM_URL || null;   /* 찾은 주소를 담습니다 */

/* ★★ 2026-08-23 · <b>두 주소를 눈으로 확인했습니다</b> (파트너 확인).
     짚이는 이름을 열 개 늘어놓던 것을 걷어 냅니다 — 인계문서에
     「후보 주소 열 개가 아예 닿지 못함」으로 적힌 그 목록입니다.

   ① 문화공공데이터광장 화면에 적힌 것
        https://api.kcisa.kr/openapi/service/rest/meta/MPKreli
      ★ 다만 출력 항목 19개에 <b>도판 주소가 없습니다.</b>
        샘플도 「씨흔굿·쟁기·종다래끼」— 민속 생활도구입니다.
        미술 자료로는 맞지 않아 보이지만, <b>확인하고</b> 버립니다.

   ② e뮤지엄 자체 API (아침에 찾은 것)
        http://www.emuseum.go.kr/openapi/relic/list
      ★ 이쪽은 <b>imgUri</b> 를 준다고 되어 있습니다. 우리가 찾는 것은
        이쪽일 가능성이 큽니다.

   ★ 어느 것이 <b>도판을 주는지</b> 실제로 보고 고릅니다.
     짐작으로 하나 골라 수집기를 쓰면 시카고 꼴이 납니다. */
const CANDIDATES = [
  'https://www.emuseum.go.kr/openapi/relic/list',
  'http://www.emuseum.go.kr/openapi/relic/list',
  'https://api.kcisa.kr/openapi/service/rest/meta/MPKreli',
  KCISA + '/meta/MPKreli'
];

/* 낱건 상세 · 코드표 — 목록이 열리면 이어서 두드려 봅니다 */
const DETAIL = [
  'https://www.emuseum.go.kr/openapi/relic/detail',
  'http://www.emuseum.go.kr/openapi/relic/detail'
];
const UA  = 'OpusfineBot/1.0 (https://opusfine.com; cser@wixon.co.kr)';

const getJSON = makeGetJSON({
  ua: UA, accept: 'application/json',
  tries: 4, maxWaitMs: 90 * 1000, budgetMs: 40 * 60 * 1000
});

/* ★★ 국내 공공 API 는 <b>XML 로 답하는 일이 흔합니다.</b> getJSON 은
     그럴 때 터집니다. 엿보기에서는 <b>날것 그대로</b> 받아
     무엇이 왔는지 눈으로 봅니다 — JSON 이든 XML 이든 오류쪽지든. */
async function getRaw(u) {
  const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'application/json, application/xml;q=.9, */*;q=.8' } });
  const t = await r.text();
  return { status: r.status, type: r.headers.get('content-type') || '', body: t };
}

/* XML 에서 칸 이름을 뽑습니다 — 파서를 들이지 않고 이름만 셉니다 */
function xmlTags(t) {
  const c = new Map();
  for (const m of String(t).matchAll(/<([A-Za-z_][\w:.-]*)\s*[^>\/]*>(?!\s*<)/g)) {
    const k = m[1];
    if (/^(\?xml|response|header|body|items|item|root)$/i.test(k)) continue;
    c.set(k, (c.get(k) || 0) + 1);
  }
  return [...c.entries()].sort((a, b) => b[1] - a[1]);
}

/* 도판 주소로 보이는 칸 */
const IMGISH = /img|image|thumb|photo|사진|url|uri|link|file/i;

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? (argv[i + 1] || d) : d; };
const Q     = arg('q', '');
const LIMIT = Number(arg('limit', 300));
const DRY   = argv.includes('--dry');
const PEEK  = argv.includes('--peek');

/* ── 하루 한도 ──
   ★ 1,000건을 넘기면 자료원이 막습니다. 스스로 세어 그 앞에서 멈춥니다. */
const DAY_CAP = 950;          /* 950 에서 멈춥니다 — 여유를 둡니다 */
let calls = 0;
function spend() {
  calls++;
  if (calls > DAY_CAP) {
    const e = new Error('오늘 몫(' + DAY_CAP + '건)을 다 썼습니다. 다음 회차에 이어 받습니다.');
    e.__dayCap = true;
    throw e;
  }
}

function pick(o, names) {
  for (const n of names) {
    const v = o[n];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

function urlOf(base, pageNo, rows) {
  let u = base + '?serviceKey=' + encodeURIComponent(GO_KEY)
        + '&numOfRows=' + rows + '&pageNo=' + pageNo;
  if (Q) u += '&keyword=' + encodeURIComponent(Q);
  return u;
}

/* ── 열리는 주소를 찾습니다 ──
   ★ 답이 <b>줄을 담고 있어야</b> 맞는 주소입니다. 200 이 와도
     「서비스 없음」이라고 적힌 답이 오는 일이 있습니다. */
async function findApi() {
  if (API) return API;
  console.log('  열리는 주소를 찾는 중…');
  for (const base of CANDIDATES) {
    let j = null;
    try { j = await getJSON(urlOf(base, 1, 3), 1); }
    catch (e) {
      const m = String(e.message || '');
      console.log('    · ' + base.replace(KCISA, '…') + ' → ' + m.slice(0, 60));
      continue;
    }
    const txt = JSON.stringify(j || {});
    if (/NO_OPENAPI_SERVICE|SERVICE_KEY_IS_NOT_REGISTERED|폐기|없거나/.test(txt)) {
      console.log('    · ' + base.replace(KCISA, '…') + ' → 서비스 없음');
      continue;
    }
    const rows = rowsOf(j);
    if (rows.length) {
      console.log('    ✔ 찾았습니다 — ' + base);
      API = base;
      return API;
    }
    console.log('    · ' + base.replace(KCISA, '…') + ' → 답은 오는데 줄이 없음');
  }
  return null;
}

/* 목록 한 쪽 */
async function listPage(pageNo, rows) {
  spend();
  return await getJSON(urlOf(API, pageNo, rows));
}

/* ── 답 안에서 <b>줄 목록</b>을 찾아냅니다 ──
   ★ 공공데이터포털은 서비스마다 답 모양이 다릅니다
     (response.body.items.item · body.items · items · list …).
     하나로 못박지 않고 <b>배열이 들어 있는 곳</b>을 찾습니다. */
function rowsOf(j) {
  if (!j) return [];
  const cand = [
    j?.response?.body?.items?.item,
    j?.response?.body?.items,
    j?.body?.items?.item,
    j?.body?.items,
    j?.items?.item,
    j?.items,
    j?.list,
    j?.data
  ];
  for (const c of cand) {
    if (Array.isArray(c)) return c;
    if (c && typeof c === 'object') return [c];   /* 한 줄만 올 때 */
  }
  return [];
}
function totalOf(j) {
  return num(j?.response?.body?.totalCount) ?? num(j?.body?.totalCount)
       ?? num(j?.totalCount) ?? null;
}

async function loadArtists() {
  const byName = new Map();
  let from = 0;
  for (;;) {
    const r = await fetch(
      SB_URL + '/rest/v1/artists?select=id,name_ko,name_en&limit=1000&offset=' + from,
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    if (!r.ok) break;
    const rows = await r.json();
    if (!rows.length) break;
    for (const a of rows)
      for (const nm of [a.name_ko, a.name_en]) {
        if (!nm) continue;
        const k = String(nm).trim().toLowerCase();
        if (!k) continue;
        if (!byName.has(k)) byName.set(k, []);
        byName.get(k).push(a.id);
      }
    from += rows.length;
    if (rows.length < 1000) break;
  }
  return byName;
}

function quality(w) {
  let n = 0;
  if (w.image_url)   n += 4;
  if (w.year_text)   n += 2;
  if (w.medium)      n += 2;
  if (w.dimensions)  n += 1;
  if (w.artist_name) n += 2;
  if (w.artist_id)   n += 2;
  if (w.holder)      n += 1;
  if (w.genre)       n += 1;
  return n;
}

/* ── 한 점 만들기 ──
   ★ 칸 이름은 --peek 으로 <b>확인한 뒤</b> 여기 적습니다.
     아래는 흔히 쓰이는 이름을 여럿 늘어놓아, 어느 하나가 맞으면
     걸리게 해 두었습니다. 확인 뒤 정확한 것만 남길 것입니다. */
function build(o, byName) {
  const title = String(pick(o, ['relicNm', 'nameKr', 'name', 'title', 'artNm']) || '').trim();
  if (!title) return null;

  const img = pick(o, ['imgUri', 'imageUrl', 'imgUrl', 'thumbUri', 'imgThumUriM', 'imgThumUriL']);

  const w = {
    title,
    title_han:   pick(o, ['relicNmCn', 'nameCn', 'nameHanja']),
    title_en:    pick(o, ['relicNmEn', 'nameEn']),
    year_text:   pick(o, ['nationalityName', 'eraName', 'ageName', 'indexWord', 'ntcNm']),
    medium:      pick(o, ['materialName', 'mtrlNm', 'material']),
    dimensions:  pick(o, ['sizeInfo', 'sizeNm', 'size']),
    genre:       pick(o, ['classNm', 'className', 'category', 'divisionName']),
    artist_name: pick(o, ['authorNm', 'artistNm', 'author']),
    image_url:   img,
    image_small: pick(o, ['imgThumUriM', 'thumbUri', 'imgThumUriS']) || img,
    image_credit: null,
    /* ★ 저작권을 아직 모릅니다. --peek 으로 공공누리 표시를 확인한 뒤
         정합니다. 그때까지 unknown — 화면에 안 나옵니다. */
    rights:      'unknown',
    holder:      pick(o, ['museumName', 'museumNm', 'holder', 'ownerNm']),
    accession:   pick(o, ['relicNo', 'no', 'id']),
    link_source: pick(o, ['detailUrl', 'url']),
    artist_id:   null,
    link_status: 'none',
    hidden:      false
  };

  if (w.artist_name) {
    const hit = byName.get(String(w.artist_name).trim().toLowerCase());
    if (hit && hit.length === 1) { w.artist_id = hit[0]; w.link_status = 'auto'; }
    else if (hit && hit.length > 1) { w.link_status = 'ambig'; }
  }
  w.quality = quality(w);
  return w;
}

/* ── 돌리기 ───────────────────────────────────────────────────── */
(async () => {
  /* ══ 엿보기 ═════════════════════════════════════════════════════
     ★★ 2026-08-23 · <b>여러 주소를 다 두드려 보고</b> 무엇이 오는지
       날것 그대로 보여 줍니다. 앞 판은 「열리는 주소를 찾으면 멈추는」
       구조였는데, 그러면 <b>첫 번째로 열린 것</b>에 갇힙니다.
       열리기만 하고 <b>도판을 안 주는</b> 주소가 있습니다 —
       오늘 화면에서 본 MPKreli 가 그렇습니다(출력 19칸에 그림 없음).
     ▶ 다 두드려 보고, <b>도판 칸이 있는 것</b>을 고릅니다.
     ★ JSON 이든 XML 이든 오류쪽지든 <b>있는 그대로</b> 찍습니다.
       파싱에 실패했다고 넘어가면 왜 안 되는지 영영 모릅니다. */
  if (PEEK) {
    console.log('▶ 국내 유물 자료원을 두드려 봅니다 — 담지 않습니다\n');
    const found = [];

    for (const base of CANDIDATES) {
      const u = urlOf(base, 1, 3);
      console.log('── ' + base);
      let r = null;
      try { r = await getRaw(u); }
      catch (e) { console.log('   ✕ 닿지 못함 — ' + String(e.message).slice(0, 90) + '\n'); continue; }

      console.log(`   HTTP ${r.status} · ${r.type.split(';')[0]} · ${r.body.length}바이트`);

      /* 오류쪽지인가 */
      const err = /SERVICE_KEY_IS_NOT_REGISTERED|NO_OPENAPI_SERVICE|SERVICE ?ERROR|등록되지|없거나|폐기|LIMITED_NUMBER|권한|인증/i.exec(r.body);
      if (err) console.log('   ※ 쪽지에 「' + err[0] + '」 가 보입니다');

      /* 칸 이름 뽑기 */
      let keys = [];
      let sample = null;
      if (/json/i.test(r.type) || /^\s*[{[]/.test(r.body)) {
        try {
          const j = JSON.parse(r.body);
          const rows = rowsOf(j);
          if (rows.length) { keys = Object.keys(rows[0]); sample = rows[0]; }
          else console.log('   ※ JSON 이나 줄이 없습니다 — ' + r.body.slice(0, 200).replace(/\s+/g, ' '));
        } catch (e) { console.log('   ※ JSON 이 아닙니다'); }
      }
      if (!keys.length) {
        const tags = xmlTags(r.body);
        if (tags.length) {
          keys = tags.map((x) => x[0]);
          console.log('   XML 칸 ' + keys.length + '가지');
        }
      }

      if (!keys.length) {
        console.log('   앞 300자 — ' + r.body.slice(0, 300).replace(/\s+/g, ' ') + '\n');
        continue;
      }

      const imgs = keys.filter((k) => IMGISH.test(k));
      console.log('   칸: ' + keys.slice(0, 40).join(', '));
      console.log(imgs.length
        ? '   ★ 도판으로 보이는 칸: ' + imgs.join(', ')
        : '   ✕ 도판으로 보이는 칸이 <없습니다>');

      if (sample) {
        console.log('   한 점의 값 —');
        for (const k of Object.keys(sample).slice(0, 30)) {
          const v = sample[k];
          console.log('     ' + k.padEnd(22)
            + String(v === null || v === '' ? '(빈 값)' : v).slice(0, 70).replace(/\s+/g, ' '));
        }
      }
      if (imgs.length) found.push(base);
      console.log('');
    }

    /* 낱건 상세도 두드려 봅니다 — 목록에 없는 도판이 여기 있을 수 있습니다 */
    console.log('── 낱건 상세');
    for (const d of DETAIL) {
      const u = d + '?serviceKey=' + encodeURIComponent(GO_KEY)
              + '&id=PS0100100101101235600000';
      let r = null;
      try { r = await getRaw(u); }
      catch (e) { console.log('   ✕ ' + d + ' — ' + String(e.message).slice(0, 70)); continue; }
      console.log(`   ${d} → HTTP ${r.status} · ${r.body.length}바이트`);
      const tags = xmlTags(r.body).map((x) => x[0]);
      const imgs = tags.filter((k) => IMGISH.test(k));
      if (tags.length) console.log('     칸: ' + tags.slice(0, 40).join(', '));
      if (imgs.length) console.log('     ★ 도판 칸: ' + imgs.join(', '));
      if (!tags.length) console.log('     앞 260자 — ' + r.body.slice(0, 260).replace(/\s+/g, ' '));
    }

    console.log('\n──────────────────────────────');
    console.log(found.length
      ? '★ 도판 칸이 있는 주소: ' + found.join(' · ')
      : '★ 도판 칸이 있는 주소를 못 찾았습니다.');
    console.log('  이 결과를 보내 주시면 수집기를 맞추겠습니다. 지금은 담지 않았습니다.');
    return;
  }

  console.log(`▶ 국내 유물 수집 · ${Q ? 'q="' + Q + '"' : '전체'} · limit=${LIMIT}${DRY ? ' · 세어만 봅니다' : ''}`);
  console.log('  ※ 저작권 표시를 아직 확인하지 않아 rights=unknown 으로 담습니다 — 화면에는 안 나옵니다.');
  console.log('    --peek 결과를 보고 정한 뒤 되살립니다.');

  const base = await findApi();
  if (!base) { console.error('★ 열리는 주소를 못 찾았습니다. --peek 을 먼저 돌려 보십시오.'); process.exit(1); }

  let byName = new Map();
  try { byName = await loadArtists(); } catch (e) {}
  console.log(`  작가 이름 ${byName.size}개를 담아 두었습니다`);

  let got = 0, kept = 0, put = 0;
  const errs = [];
  const PAGE = 100;

  try {
    for (let p = 1; got < LIMIT; p++) {
      const j = await listPage(p, PAGE);
      const rows = rowsOf(j);
      if (!rows.length) break;              /* ★ 0줄일 때 끝냅니다 */

      const out = [];
      for (const o of rows) {
        got++;
        const w = build(o, byName);
        if (!w) continue;
        kept++; out.push(w);
      }
      if (!DRY && out.length) {
        /* accession 으로 겹침을 가릅니다 — e뮤지엄 번호가 그것입니다 */
        const r = await fetch(SB_URL + '/rest/v1/artworks', {
          method: 'POST',
          headers: {
            apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
          },
          body: JSON.stringify(out)
        });
        if (!r.ok) errs.push(r.status + ' ' + (await r.text()).slice(0, 250));
        else put += out.length;
      }
      console.log(`  ${got} · 담을 것 ${kept}${DRY ? '' : ` · 담음 ${put}`}`);
      const total = totalOf(j);
      if (total && p * PAGE >= total) break;
    }
  } catch (e) {
    if (e.__dayCap) console.log('  ■ ' + e.message);
    else if (isStop(e)) console.log('  ■ 멈춥니다 — ' + stopReason(e));
    else errs.push(e.message);
  }

  console.log('──────────────────────────────');
  console.log(`  받은 유물   ${got}`);
  console.log(`  담을 만한 것 ${kept}`);
  if (!DRY) console.log(`  실제로 담음 ${put}`);
  console.log(`  자료원 호출 ${calls}회 (하루 몫 ${DAY_CAP})`);
  if (errs.length) {
    console.log(`  ★ 문제 ${errs.length}건`);
    errs.slice(0, 5).forEach((m) => console.log('     · ' + m));
  }
})();
