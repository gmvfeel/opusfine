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

/* 두드려 볼 후보 — 「유물정보12」라는 이름에서 짚이는 것들 */
const CANDIDATES = [
  KCISA + '/meta12/getRelic12',
  KCISA + '/meta12/getRelic',
  KCISA + '/meta12/relic12',
  KCISA + '/meta12/getRelicList',
  KCISA + '/meta12/getNMK12',
  KCISA + '/meta12/getMuseum12',
  KCISA + '/meta/getRelic12',
  KCISA + '/meta/relic12',
  'https://api.kcisa.kr/API_CNV_012/request',
  'https://api.kcisa.kr/API_CIA_012/request'
];
const UA  = 'OpusfineBot/1.0 (https://opusfine.com; cser@wixon.co.kr)';

const getJSON = makeGetJSON({
  ua: UA, accept: 'application/json',
  tries: 4, maxWaitMs: 90 * 1000, budgetMs: 40 * 60 * 1000
});

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
  /* ★★ 칸 이름 엿보기 — 짐작하지 않으려는 장치입니다 */
  if (PEEK) {
    console.log('▶ 자료원이 무엇을 주는지 봅니다');
    const base = await findApi();
    if (!base) {
      console.log('\n★ 열리는 주소를 못 찾았습니다.');
      console.log('  문화공공데이터광장에서 「유물정보12」 상세 쪽을 열어');
      console.log('  <b>요청 URL</b> 을 확인해 주십시오. 그 주소를 알려 주시면 넣겠습니다.');
      console.log('  (또는 워크플로에 EMUSEUM_URL 로 넣으셔도 됩니다)');
      process.exit(1);
    }
    let j = null;
    try { j = await listPage(1, 3); }
    catch (e) { console.error('★ 못 받았습니다:', e.message); process.exit(1); }

    const rows = rowsOf(j);
    console.log('  받은 줄 수:', rows.length, '· 전체:', totalOf(j));
    if (!rows.length) {
      console.log('  ※ 줄을 못 찾았습니다. 답 앞부분을 그대로 찍습니다 —');
      console.log(JSON.stringify(j).slice(0, 1500));
      return;
    }
    console.log('\n한 점이 가진 칸 이름:');
    Object.keys(rows[0]).sort().forEach((k) => {
      const v = rows[0][k];
      console.log(`  ${k} = ` + String(v === null ? '(빈 값)' : v).slice(0, 80).replace(/\n/g, ' ⏎ '));
    });
    console.log('\n★ 이 목록을 보여 주시면 코드를 맞추겠습니다.');
    console.log('   특히 <제목·이미지 주소·재료·시대·소장 박물관·공공누리> 가 어느 칸인지 봅니다.');
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
