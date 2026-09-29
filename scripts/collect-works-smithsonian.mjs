#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 작품 수집 (스미소니언) · scripts/collect-works-smithsonian.mjs
   ------------------------------------------------------------------
   쓰는 법
     node scripts/collect-works-smithsonian.mjs --peek
     node scripts/collect-works-smithsonian.mjs --unit SAAM --limit 2000
     node scripts/collect-works-smithsonian.mjs --unit SAAM --dry

   ★ 2026-09-29 · 파트너가 api.data.gov 열쇠를 즉시 받아 붙임.
     확인된 자료원 — Smithsonian American Art Museum(SAAM) 13,006건,
     전부 online_media_type:Images 필터 통과 · rights 는 건마다 다름
     (CC0 인 것만 도판을 싣습니다).

   ★★ <b>칸 이름을 짐작하지 않습니다.</b> --peek 로 실제 응답을 먼저 봅니다.
     스미소니언 JSON 은 겹겹이 싸여 있습니다(content.freetext… ·
     content.indexedStructured… · content.descriptiveNonRepeating…) —
     기관·건마다 있는 칸이 다를 수 있어 모든 접근을 방어적으로(?.) 합니다.

   ★ --unit 으로 소장기관을 고릅니다. 기본은 SAAM(미국 미술관)입니다.

   ★ 2026-09-29 · /terms/unit_code 로 전체 코드 목록을 받아 하나씩
     --peek 으로 확인한 뒤, 도판(online_media_type:Images)이 실제로
     걸리는 미술 계열 유닛 다섯을 더 넣었습니다. <b>FSG 는 짐작이었고
     0건이라 틀렸습니다</b> — 프리어|새클러는 2019년에 국립아시아미술관
     (National Museum of Asian Art)으로 이름이 바뀌었고 코드는 NMAA 입니다.
       NMAA   국립아시아미술관(구 프리어|새클러) · 4,718건 · CC0 확인
       NPG    국립초상화미술관 · 15,218건
       CHNDM  쿠퍼휴잇 디자인박물관 · 54,626건
       HMSG   허시혼미술관(현대미술) · 449건
       NMAfA  국립아프리카미술관 · 113건

   ★ 저작권 — metadata_usage.access 가 <b>CC0 일 때만</b> 도판을 담고
     rights=public 으로 적습니다. 아니면 도판 없이 rights=linked.

   ★ 도판은 ids.si.edu deliveryService 주소를 그대로 링크합니다.
     우리 저장소에 담지 않습니다.
   ══════════════════════════════════════════════════════════════════ */

import { makeGetJSON, isStop, stopReason } from './lib/http.mjs';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const SI_KEY = process.env.SMITHSONIAN_KEY;

const API = 'https://api.si.edu/openaccess/api/v1.0/search';
const UA  = 'OpusfineBot/1.0 (https://opusfine.com; cser@wixon.co.kr)';

/* ★ /terms/unit_code 목록에서 하나씩 --peek 으로 실제 확인한 코드만
     넣습니다. 짐작한 코드(FSG 등)는 넣지 않습니다. */
const UNIT_NAME = {
  SAAM:  'Smithsonian American Art Museum',
  NMAA:  'National Museum of Asian Art (Freer|Sackler)',
  NPG:   'National Portrait Gallery',
  CHNDM: 'Cooper Hewitt, Smithsonian Design Museum',
  HMSG:  'Hirshhorn Museum and Sculpture Garden',
  NMAfA: 'National Museum of African Art',
  NMAI:  'National Museum of the American Indian',
  NMAAHC: 'National Museum of African American History and Culture'
};

/* ★ 2026-09-29 · NMAI · NMAAHC 는 미술관이 아니라 민속·역사박물관이라
     도판 있는 것만 각각 142,930건 · 19,864건이나, 대부분 의상·문서·
     생활유물입니다. 파트너 판단으로 <b>회화·판화·조각만</b> object_type
     칸으로 걸러 담습니다 — --type 으로 하나씩 지정합니다.
     확인된 낱말(단수/복수가 기관마다 다르게 맞습니다):
       NMAI    Painting(2504) · Prints(1200) · Sculpture(256)
       NMAAHC  Paintings(179) · Prints(243)  · Sculpture(47)
   */

const getJSON = makeGetJSON({
  ua: UA, accept: 'application/json',
  tries: 5, maxWaitMs: 120 * 1000, budgetMs: 40 * 60 * 1000
});

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? (argv[i + 1] || d) : d; };
const UNIT  = arg('unit', 'SAAM');
const TYPE  = arg('type', null);   /* ★ object_type 낱말로 거르기 (NMAI·NMAAHC 용) */
const LIMIT = Number(arg('limit', 2000));
const DRY   = argv.includes('--dry');
const PEEK  = argv.includes('--peek');

if (!SI_KEY) {
  console.error('★ SMITHSONIAN_KEY 가 없습니다 (api.data.gov 에서 받은 열쇠).');
  process.exit(1);
}
if (!PEEK && (!SB_URL || !SB_KEY)) {
  console.error('★ SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

/* ── 우리 작가DB ── */
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

/* ── 겹겹이 싸인 칸에서 값 꺼내기 ── */
function freetextName(o) {
  const arr = o?.content?.freetext?.name;
  if (!Array.isArray(arr) || !arr.length) return null;
  const hit = arr.find((x) => /artist|maker|painter/i.test(x?.label || '')) || arr[0];
  let raw = String(hit?.content || '').trim();
  if (!raw) return null;
  /* 「Name, born CITY 1884-died CITY 1950」→ 이름만 남깁니다 */
  raw = raw.replace(/,?\s*born\b.*$/i, '').trim();
  return raw || null;
}
function physField(o, label) {
  const arr = o?.content?.freetext?.physicalDescription;
  if (!Array.isArray(arr)) return null;
  const hit = arr.find((x) => new RegExp('^' + label + '$', 'i').test(x?.label || ''));
  const v = hit ? String(hit.content || '').trim() : '';
  return v || null;
}
function imageUrl(o) {
  const media = o?.content?.descriptiveNonRepeating?.online_media?.media;
  if (!Array.isArray(media) || !media.length) return null;
  const m = media.find((x) => x?.type === 'Images') || media[0];
  const idsId = m?.idsId || m?.content || null;
  return idsId ? 'https://ids.si.edu/ids/deliveryService?id=' + idsId : null;
}

function quality(w) {
  let n = 0;
  if (w.image_url)   n += 4;
  if (w.year_text)   n += 2;
  if (w.medium)      n += 2;
  if (w.dimensions)  n += 1;
  if (w.artist_name) n += 2;
  if (w.artist_id)   n += 2;
  if (w.holder_dept) n += 1;
  if (w.link_source) n += 1;
  if (w.genre)       n += 1;
  return n;
}

function build(o, byName) {
  const id = o?.id;
  const title = String(o?.title || '').trim();
  if (!id || !title) return null;

  const access = o?.content?.descriptiveNonRepeating?.metadata_usage?.access || null;
  const cc0 = access === 'CC0';
  const img = imageUrl(o);
  const name = freetextName(o);
  const unitCode = o?.content?.descriptiveNonRepeating?.unit_code || UNIT;

  const w = {
    si_id:       id,
    title,
    title_en:    title,
    year_text:   (o?.content?.indexedStructured?.date || [])[0] || null,
    medium:      physField(o, 'Medium') || physField(o, 'Type'),
    dimensions:  physField(o, 'Dimensions'),
    genre:       (o?.content?.indexedStructured?.object_type || [])[0] || null,
    artist_name: name,
    image_url:   cc0 ? img : null,
    image_small: cc0 ? img : null,
    image_credit: cc0 ? `Smithsonian ${unitCode} (CC0)` : null,
    rights:      cc0 ? 'public' : 'linked',
    holder:      UNIT_NAME[unitCode] || ('Smithsonian ' + unitCode),
    holder_dept: unitCode,
    accession:   null,
    link_source: o?.content?.descriptiveNonRepeating?.record_link || null,
    artist_id:   null,
    link_status: 'none',
    hidden:      false
  };

  if (w.artist_name) {
    const hit = byName.get(w.artist_name.toLowerCase());
    if (hit && hit.length === 1) { w.artist_id = hit[0]; w.link_status = 'auto'; }
    else if (hit && hit.length > 1) { w.link_status = 'ambig'; }
  }

  w.quality = quality(w);
  if (w.quality < 4) return null;
  return w;
}

/* ★★ 덮어도 되는 칸을 바깥에서 못박습니다 — api/collect.js 의
     COLS 주석과 같은 까닭입니다. columns= 없이 merge-duplicates 를
     쓰면, 묶음 안의 행마다 있는 칸이 다를 때 저쪽이 빈 칸을
     null 로 덮어쓸 수 있습니다. */
const COLS = [
  'si_id', 'title', 'title_en', 'year_text', 'medium', 'dimensions',
  'genre', 'artist_name', 'image_url', 'image_small', 'image_credit',
  'rights', 'holder', 'holder_dept', 'accession', 'link_source',
  'artist_id', 'link_status', 'quality', 'hidden'
];

async function upsert(rows) {
  if (!rows.length) return { ok: 0, msg: '' };
  const r = await fetch(SB_URL + '/rest/v1/artworks?on_conflict=si_id'
    + '&columns=' + encodeURIComponent(COLS.join(',')), {
    method: 'POST',
    headers: {
      apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(rows)
  });
  if (!r.ok) return { ok: 0, msg: r.status + ' ' + (await r.text()).slice(0, 300) };
  return { ok: rows.length, msg: '' };
}

/* ── 한 쪽 받기 ── */
function pageUrl(unit, start, rows, type) {
  let q = 'unit_code:' + unit + ' AND online_media_type:Images';
  if (type) q += ' AND object_type:"' + type + '"';
  return API + '?q=' + encodeURIComponent(q)
    + '&start=' + start + '&rows=' + rows + '&api_key=' + SI_KEY;
}

(async () => {
  if (PEEK) {
    const url = pageUrl(UNIT, 0, 1, TYPE);
    console.log('디버그 요청주소:', url.replace(SI_KEY, '(열쇠생략)'));
    console.log('디버그 UNIT=[' + UNIT + '] TYPE=[' + TYPE + ']');
    const j = await getJSON(url);
    const row = (j?.response?.rows || [])[0];
    console.log('전체건수:', j?.response?.rowCount ?? '(모름)');
    if (!row) { console.log('★ 아무것도 못 받았습니다.'); return; }
    console.log('\n▶ 우리 표로 바꾼 모습\n');
    const w = build(row, new Map());
    if (!w) { console.log('  (충실도가 모자라 담지 않습니다)'); return; }
    for (const [k, v] of Object.entries(w))
      console.log('  ' + String(k).padEnd(14) + (v == null ? '(없음)' : String(v).slice(0, 90)));
    return;
  }

  console.log(`▶ 작품 수집 (스미소니언 ${UNIT}${TYPE ? ' · ' + TYPE + '만' : ''}) · limit=${LIMIT}${DRY ? ' · 담지 않고 세어만 봅니다' : ''}`);

  console.log('  우리 작가DB 를 받는 중…');
  let byName = new Map();
  try { byName = await loadArtists(); } catch (e) { console.log('  (작가DB 를 못 받아 잇기는 건너뜁니다)'); }
  console.log(`  이름 ${byName.size}개를 담아 두었습니다`);

  let got = 0, kept = 0, thin = 0, put = 0, pub = 0, linked = 0, auto = 0, ambig = 0;
  const errs = [];
  const PAGE = 100;

  try {
    for (let start = 0; got < LIMIT; start += PAGE) {
      const take = Math.min(PAGE, LIMIT - got);
      const j = await getJSON(pageUrl(UNIT, start, take, TYPE));
      const rows = j?.response?.rows || [];
      if (!rows.length) break;                 /* ★ 0줄일 때 끝냅니다 */

      const out = [];
      for (const o of rows) {
        got++;
        const w = build(o, byName);
        if (!w) { thin++; continue; }
        kept++;
        if (w.rights === 'public') pub++; else linked++;
        if (w.link_status === 'auto') auto++;
        if (w.link_status === 'ambig') ambig++;
        out.push(w);
      }
      if (!DRY && out.length) {
        const res = await upsert(out);
        if (res.msg) errs.push(res.msg); else put += res.ok;
      }
      console.log(`  ${got}/${LIMIT} · 담을 것 ${kept}${DRY ? '' : ` · 담음 ${put}`}`);
      if (j?.response?.rowCount != null && start + take >= j.response.rowCount) break;
    }
  } catch (e) {
    if (isStop(e)) console.log('  ■ 멈춥니다 — ' + stopReason(e));
    else errs.push(e.message);
  }

  console.log('──────────────────────────────');
  console.log(`  받은 작품        ${got}`);
  console.log(`  담을 만한 작품   ${kept}`);
  console.log(`  얇아서 뺀 작품   ${thin}`);
  console.log(`  도판 실을 수 있음 ${pub} · 저작권 있어 링크만 ${linked}`);
  console.log(`  작가와 이어짐    ${auto} · 후보 여럿 ${ambig}`);
  if (!DRY) console.log(`  실제로 담음      ${put}`);
  if (errs.length) {
    console.log(`  ★ 문제 ${errs.length}건`);
    errs.slice(0, 5).forEach((m) => console.log('     · ' + m));
  }
})();
