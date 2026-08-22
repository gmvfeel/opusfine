#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 작품 수집 (메트로폴리탄) · scripts/collect-works-met.mjs
   ------------------------------------------------------------------
   쓰는 법
     node scripts/collect-works-met.mjs --q "Korea" --limit 300
     node scripts/collect-works-met.mjs --dept 6 --limit 500
     node scripts/collect-works-met.mjs --q "Korea" --dry

   ★★ 저작권을 먼저 봅니다
     메트 API 는 isPublicDomain 을 알려 줍니다. <b>참일 때만</b> 도판을
     담고 rights=public 으로 적습니다. 아니면 도판을 <b>싣지 않고</b>
     rights=linked 로 두어 소장처로만 잇습니다.
     모르면 unknown — 화면에 안 나옵니다. 모를 때 안 싣는 쪽이 안전합니다.

   ★★ 작가와 잇기는 <b>이름이 꼭 같고 우리 DB 에 하나뿐일 때만</b> 합니다.
     오퍼스클램 콩쿠르 아카이브에서 검증된 방식입니다.
       하나뿐  → auto 로 잇습니다
       여럿    → ambig 로 표시만, 사람이 판단
       없음    → none, 이름만 적어 둡니다
     이름만 같다고 이으면 동명이인이 뒤섞입니다.

   ★ 도판은 <b>메트 원본 주소</b>를 그대로 링크합니다. 우리 저장소에
     담지 않습니다 — 내보내는 양이 순식간에 차고 저작권도 걸립니다.

   ★ 받는 대로 즉시 담습니다. 모아서 한 번에 담으면 중간에 끊겼을 때
     통째로 날아갑니다.
   ══════════════════════════════════════════════════════════════════ */

import { makeGetJSON, isStop, stopReason } from './lib/http.mjs';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('★ SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

const API = 'https://collectionapi.metmuseum.org/public/collection/v1';
const UA  = 'OpusfineBot/1.0 (https://opusfine.com; cser@wixon.co.kr)';

const getJSON = makeGetJSON({
  ua: UA, accept: 'application/json',
  tries: 5, maxWaitMs: 120 * 1000, budgetMs: 40 * 60 * 1000
});

/* ── 명령줄 ───────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? (argv[i + 1] || d) : d; };
const Q     = arg('q', 'Korea');
const DEPT  = arg('dept', '');
const LIMIT = Number(arg('limit', 300));
const DRY   = argv.includes('--dry');

/* ── 우리 작가DB 를 미리 받아 둡니다 ──
   ★ 작품마다 물어보면 수백 번을 묻게 됩니다. 한 번에 받아
     이름으로 찾을 수 있게 담아 둡니다.
   ★ 같은 이름이 여럿이면 <b>잇지 않습니다.</b> 그것이 ambig 입니다. */
async function loadArtists() {
  const byName = new Map();   /* 소문자 이름 → [id, …] */
  let from = 0;
  for (;;) {
    const r = await fetch(
      SB_URL + '/rest/v1/artists?select=id,name_ko,name_en&limit=1000&offset=' + from,
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    if (!r.ok) break;
    const rows = await r.json();
    /* ★ 0줄일 때 끝냅니다. 「요청보다 적으니 끝」이 아닙니다 —
         응답은 한 번에 1000줄까지만 오기 때문입니다. */
    if (!rows.length) break;
    for (const a of rows) {
      for (const nm of [a.name_ko, a.name_en]) {
        if (!nm) continue;
        const k = String(nm).trim().toLowerCase();
        if (!k) continue;
        if (!byName.has(k)) byName.set(k, []);
        byName.get(k).push(a.id);
      }
    }
    from += rows.length;
    if (rows.length < 1000) break;
  }
  return byName;
}

/* ── 충실도 ── */
function quality(w) {
  let n = 0;
  if (w.image_url)   n += 4;
  if (w.year_text)   n += 2;
  if (w.medium)      n += 2;
  if (w.dimensions)  n += 1;
  if (w.artist_name) n += 2;
  if (w.artist_id)   n += 2;
  if (w.holder)      n += 1;
  if (w.link_source) n += 1;
  if (w.genre)       n += 1;
  return n;
}

/* ── 한 점 만들기 ── */
function build(o, byName) {
  if (!o || !o.objectID) return null;
  const title = (o.title || '').trim();
  if (!title) return null;                   /* 이름 없는 것은 담지 않습니다 */

  const pub = o.isPublicDomain === true;
  const img = pub ? (o.primaryImage || o.primaryImageSmall || null) : null;

  const w = {
    met_id:      o.objectID,
    title,
    title_en:    title,
    year_text:   o.objectDate || null,
    year_from:   Number.isFinite(o.objectBeginDate) ? o.objectBeginDate : null,
    year_to:     Number.isFinite(o.objectEndDate)   ? o.objectEndDate   : null,
    medium:      o.medium || null,
    dimensions:  o.dimensions || null,
    genre:       o.classification || null,
    artist_name: (o.artistDisplayName || '').trim() || null,
    image_url:   img,
    image_small: pub ? (o.primaryImageSmall || null) : null,
    image_credit: pub ? 'The Metropolitan Museum of Art (CC0)' : null,
    /* ★ 퍼블릭 도메인이 아니면 도판을 싣지 않고 소장처로만 잇습니다 */
    rights:      pub ? 'public' : 'linked',
    holder:      'The Metropolitan Museum of Art',
    holder_dept: o.department || null,
    accession:   o.accessionNumber || null,
    link_source: o.objectURL || null,
    artist_id:   null,
    link_status: 'none',
    hidden:      false
  };

  /* ── 작가 잇기 — 이름이 꼭 같고 하나뿐일 때만 ── */
  if (w.artist_name) {
    const hit = byName.get(w.artist_name.toLowerCase());
    if (hit && hit.length === 1) { w.artist_id = hit[0]; w.link_status = 'auto'; }
    else if (hit && hit.length > 1) { w.link_status = 'ambig'; }
  }

  w.quality = quality(w);
  /* ★ 충실도 컷오프 — 도판도 이름도 없는 것은 담지 않습니다 */
  if (w.quality < 4) return null;
  return w;
}

async function upsert(rows) {
  if (!rows.length) return { ok: 0, msg: '' };
  const r = await fetch(SB_URL + '/rest/v1/artworks?on_conflict=met_id', {
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

/* ── 돌리기 ───────────────────────────────────────────────────── */
(async () => {
  console.log(`▶ 작품 수집 (메트) · q="${Q}"${DEPT ? ' · dept=' + DEPT : ''} · limit=${LIMIT}${DRY ? ' · 담지 않고 세어만 봅니다' : ''}`);

  console.log('  우리 작가DB 를 받는 중…');
  let byName = new Map();
  try { byName = await loadArtists(); } catch (e) { console.log('  (작가DB 를 못 받아 잇기는 건너뜁니다)'); }
  console.log(`  이름 ${byName.size}개를 담아 두었습니다`);

  let url = API + '/search?q=' + encodeURIComponent(Q) + '&hasImages=true';
  if (DEPT) url += '&departmentId=' + encodeURIComponent(DEPT);

  let ids = [];
  try {
    const s = await getJSON(url);
    ids = (s && s.objectIDs || []).slice(0, LIMIT);
  } catch (e) {
    console.error('★ 목록을 못 받았습니다:', isStop(e) ? stopReason(e) : e.message);
    process.exit(1);
  }
  console.log(`  걸린 작품 ${ids.length}점`);
  if (!ids.length) return;

  let got = 0, kept = 0, thin = 0, put = 0;
  let pub = 0, linked = 0, auto = 0, ambig = 0;
  const errs = [];
  const PACK = 40;

  for (let i = 0; i < ids.length; i += PACK) {
    const part = ids.slice(i, i + PACK);
    const rows = [];

    /* ★ 한 점씩 물어야 합니다 — 메트에는 여러 점을 한 번에 주는 길이
         없습니다. 대신 <b>한꺼번에 보내고</b> 기다립니다. */
    let objs = [];
    try {
      objs = await Promise.all(part.map((id) =>
        getJSON(API + '/objects/' + id).catch((e) => { if (isStop(e)) throw e; return null; })));
    } catch (e) {
      if (isStop(e)) { console.log('  ■ 멈춥니다 — ' + stopReason(e)); break; }
      errs.push(e.message); continue;
    }

    for (const o of objs) {
      if (!o) continue;
      got++;
      const w = build(o, byName);
      if (!w) { thin++; continue; }
      kept++;
      if (w.rights === 'public') pub++; else linked++;
      if (w.link_status === 'auto') auto++;
      if (w.link_status === 'ambig') ambig++;
      rows.push(w);
    }

    if (!DRY && rows.length) {
      const res = await upsert(rows);
      if (res.msg) errs.push(res.msg); else put += res.ok;
    }
    console.log(`  ${Math.min(i + PACK, ids.length)}/${ids.length} · 받음 ${got} · 담을 것 ${kept}${DRY ? '' : ` · 담음 ${put}`}`);
  }

  console.log('──────────────────────────────');
  console.log(`  받은 작품        ${got}`);
  console.log(`  담을 만한 작품   ${kept}`);
  console.log(`  얇아서 뺀 작품   ${thin}`);
  console.log(`  도판 실을 수 있음 ${pub} · 저작권 있어 링크만 ${linked}`);
  console.log(`  작가와 이어짐    ${auto} · 후보 여럿(사람이 볼 것) ${ambig}`);
  if (!DRY) console.log(`  실제로 담음      ${put}`);
  if (errs.length) {
    console.log(`  ★ 문제 ${errs.length}건`);
    errs.slice(0, 5).forEach((m) => console.log('     · ' + m));
  }
})();
