#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 작품 수집 (내셔널갤러리 오브 아트, 워싱턴 DC) ·
   scripts/collect-works-nga.mjs
   ------------------------------------------------------------------
   쓰는 법
     node scripts/collect-works-nga.mjs --peek
     node scripts/collect-works-nga.mjs --limit 5000 --dry
     node scripts/collect-works-nga.mjs --limit 200000

   ★★ 2026-09-29 · 하버드 열쇠가 끝내 안 와서, 열쇠가 <b>아예 필요 없는</b>
     자료원을 찾았습니다. 내셔널갤러리(NGA·워싱턴)는 소장품 전체
     (13만여 점)를 <b>깃허브에 CSV 로 통째로</b> 공개해 둡니다
     (github.com/NationalGalleryOfArt/opendata) · CC0.
     api.data.gov 같은 열쇠 신청도, 시간당 호출수 제한도 없습니다 —
     한 번 내려받아 우리 쪽에서 거르고 잇기만 하면 됩니다.

   ★ 도판이 있고 openaccess=1(=CC0, 자유로이 써도 됨)인 것만 담습니다.
     openaccess=0 인 것은 이미지가 있어도 <b>담지 않습니다</b> — 저작권이
     걸려 있을 수 있어서입니다(메트·스미소니언과 같은 원칙).

   ★ 이 자료원은 <b>미술관 소장품 전부</b>이므로(회화·판화·드로잉·조각·
     사진·장식미술…) NMAI 때처럼 갈래를 걸러내지 않습니다. 쿠퍼휴잇과
     같은 결 — 미술관 자체가 이미 미술 전문 기관입니다.

   ★ 도판은 api.nga.gov 의 IIIF 주소를 그대로 링크합니다(원본을 우리
     저장소에 담지 않음 · 스미소니언과 같은 방식).

   ★ 외부 패키지 없이 node 만으로 돕니다 — scripts/lib/csv.mjs 의
     손으로 짠 CSV 읽개를 씁니다(제대로 된 따옴표·줄바꿈 처리).
   ══════════════════════════════════════════════════════════════════ */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { readCSV } from './lib/csv.mjs';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? (argv[i + 1] || d) : d; };
const START = Number(arg('start', 0));
const LIMIT = Number(arg('limit', 200000));
const DRY   = argv.includes('--dry');
const PEEK  = argv.includes('--peek');

if (!PEEK && (!SB_URL || !SB_KEY)) {
  console.error('★ SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

const REPO = 'https://github.com/NationalGalleryOfArt/opendata.git';
const WORK = process.env.RUNNER_TEMP || '/tmp';
const CLONE_DIR = path.join(WORK, 'nga-opendata');

/* ── 데이터 받아 두기 ──
   ★ 이미 받아 있으면(재실행) 다시 받지 않습니다 — 300MB 짜리라
     아낄 수 있으면 아낍니다. */
function ensureData() {
  const objCsv = path.join(CLONE_DIR, 'data', 'objects.csv');
  if (fs.existsSync(objCsv)) {
    console.log('  (이미 받아 둔 것을 씁니다: ' + CLONE_DIR + ')');
    return;
  }
  console.log('▶ 내셔널갤러리 오픈데이터 내려받는 중 (git clone --depth 1)…');
  fs.rmSync(CLONE_DIR, { recursive: true, force: true });
  execSync('git clone --depth 1 ' + REPO + ' "' + CLONE_DIR + '"', { stdio: 'inherit' });
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

function build(o, img, byName) {
  const title = String(o.title || '').trim();
  if (!title) return null;

  const artist = String(o.attribution || '').trim() || null;
  const imgUrl   = img ? img.iiifurl + '/full/!1400,1400/0/default.jpg' : null;
  const imgSmall = img ? img.iiifthumburl : null;

  const w = {
    nga_id:      Number(o.objectid),
    title,
    title_en:    title,
    year_text:   o.displaydate || null,
    year_from:   Number.isFinite(Number(o.beginyear)) && o.beginyear !== '' ? Number(o.beginyear) : null,
    year_to:     Number.isFinite(Number(o.endyear)) && o.endyear !== '' ? Number(o.endyear) : null,
    medium:      o.medium || null,
    dimensions:  o.dimensions || null,
    genre:       o.classification || null,
    artist_name: artist,
    image_url:   imgUrl,
    image_small: imgSmall,
    image_credit: img ? 'National Gallery of Art, Washington (CC0)' : null,
    rights:      img ? 'public' : 'linked',
    holder:      'National Gallery of Art, Washington',
    holder_dept: o.departmentabbr || null,
    accession:   o.accessionnum || null,
    credit_line: o.creditline || null,
    link_source: 'https://www.nga.gov/collection/art-object-page.' + o.objectid + '.html',
    wikidata_id: o.wikidataid || null,
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
  if (w.quality < 4) return null;             /* 도판도 이름도 없으면 뺍니다 */
  return w;
}

/* ★★ merge-duplicates 를 columns= 없이 쓰면 묶음 안 행마다 있는 칸이
     달라 빈 칸이 null 로 덮어써집니다(스미소니언 COLS 와 같은 까닭) */
const COLS = [
  'nga_id', 'title', 'title_en', 'year_text', 'year_from', 'year_to',
  'medium', 'dimensions', 'genre', 'artist_name', 'image_url', 'image_small',
  'image_credit', 'rights', 'holder', 'holder_dept', 'accession',
  'credit_line', 'link_source', 'wikidata_id', 'artist_id', 'link_status',
  'quality', 'hidden'
];

async function upsert(rows) {
  if (!rows.length) return { ok: 0, msg: '' };
  const r = await fetch(SB_URL + '/rest/v1/artworks?on_conflict=nga_id'
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

(async () => {
  ensureData();

  console.log('  objects.csv 읽는 중…');
  const obj = readCSV(fs, path.join(CLONE_DIR, 'data', 'objects.csv'));
  console.log('  published_images.csv 읽는 중…');
  const img = readCSV(fs, path.join(CLONE_DIR, 'data', 'published_images.csv'));

  /* ── 작품마다 열린-접근 도판 하나씩 고르기 ──
     ★ 앞면(primary) 을 앞세우고, 같으면 sequence 가 낮은 쪽(첫 도판) */
  const imgByObj = new Map();
  for (const r of img.rows) {
    if (r[img.idx.openaccess] !== '1') continue;
    const oid = r[img.idx.depictstmsobjectid];
    if (!oid) continue;
    const rec = {
      iiifurl:      r[img.idx.iiifurl],
      iiifthumburl: r[img.idx.iiifthumburl],
      seq:          Number(r[img.idx.sequence]) || 0,
      primary:      r[img.idx.viewtype] === 'primary'
    };
    const cur = imgByObj.get(oid);
    if (!cur) { imgByObj.set(oid, rec); continue; }
    if (rec.primary && !cur.primary) { imgByObj.set(oid, rec); continue; }
    if (rec.primary === cur.primary && rec.seq < cur.seq) imgByObj.set(oid, rec);
  }
  console.log(`  열린-접근 도판이 있는 작품 ${imgByObj.size}점`);

  if (PEEK) {
    const row = obj.rows.find((r) => imgByObj.has(r[obj.idx.objectid]));
    if (!row) { console.log('★ 도판 있는 작품을 못 찾았습니다.'); return; }
    const o = Object.fromEntries(obj.idx ? Object.keys(obj.idx).map((k) => [k, row[obj.idx[k]]]) : []);
    const w = build(o, imgByObj.get(o.objectid), new Map());
    console.log('\n▶ 우리 표로 바꾼 모습\n');
    if (!w) { console.log('  (충실도가 모자라 담지 않습니다)'); return; }
    for (const [k, v] of Object.entries(w))
      console.log('  ' + String(k).padEnd(14) + (v == null ? '(없음)' : String(v).slice(0, 90)));
    return;
  }

  console.log(`▶ 작품 수집 (내셔널갤러리) · start=${START} · limit=${LIMIT}${DRY ? ' · 담지 않고 세어만 봅니다' : ''}`);

  console.log('  우리 작가DB 를 받는 중…');
  let byName = new Map();
  try { byName = await loadArtists(); } catch (e) { console.log('  (작가DB 를 못 받아 잇기는 건너뜁니다)'); }
  console.log(`  이름 ${byName.size}개를 담아 두었습니다`);

  /* ★ objectid 순서로 고정 — 재실행 때 --start 로 이어받을 수 있게 */
  const withImage = obj.rows.filter((r) => imgByObj.has(r[obj.idx.objectid]));
  withImage.sort((a, b) => Number(a[obj.idx.objectid]) - Number(b[obj.idx.objectid]));
  console.log(`  도판 있는 작품(전체) ${withImage.length}점 중 ${START}부터`);

  const slice = withImage.slice(START, START + LIMIT);

  let got = 0, kept = 0, thin = 0, put = 0, auto = 0, ambig = 0;
  const errs = [];
  const PACK = 300;

  for (let i = 0; i < slice.length; i += PACK) {
    const part = slice.slice(i, i + PACK);
    const out = [];
    for (const row of part) {
      got++;
      const o = {};
      for (const k of Object.keys(obj.idx)) o[k] = row[obj.idx[k]];
      const w = build(o, imgByObj.get(o.objectid), byName);
      if (!w) { thin++; continue; }
      kept++;
      if (w.link_status === 'auto') auto++;
      if (w.link_status === 'ambig') ambig++;
      out.push(w);
    }
    if (!DRY && out.length) {
      const res = await upsert(out);
      if (res.msg) errs.push(res.msg); else put += res.ok;
    }
    console.log(`  ${got}/${slice.length} · 담을 것 ${kept}${DRY ? '' : ` · 담음 ${put}`}`);
  }

  console.log('──────────────────────────────');
  console.log(`  받은 작품        ${got}`);
  console.log(`  담을 만한 작품   ${kept}`);
  console.log(`  얇아서 뺀 작품   ${thin}`);
  console.log(`  작가와 이어짐    ${auto} · 후보 여럿 ${ambig}`);
  if (!DRY) console.log(`  실제로 담음      ${put}`);
  if (START + slice.length >= withImage.length) console.log('  ■ 끝까지 다 받았습니다.');
  else console.log(`  다음 start=${START + slice.length}`);
  if (errs.length) {
    console.log(`  ★ 문제 ${errs.length}건`);
    errs.slice(0, 5).forEach((m) => console.log('     · ' + m));
  }
})();
