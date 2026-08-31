// ============================================================
// OPUSFINE · 미술대학 씨앗 담기
//   scripts/seed-schools.mjs
//
//  ── 어디서 온 자료인가 ──────────────────────────────────────
//   오퍼스클램에서 음악학교를 넓게 받다가 <딸려 온> 미술대학
//   250곳입니다. 새로 두드린 자료원이 아니라 이미 손에 있던
//   것이라 키도 이용허락도 걸릴 것이 없습니다.
//
//   data/schools-seed.csv 를 읽어 담습니다.
//
//  ── 자료 실태 (돌리기 전에 세어 본 것) ──────────────────────
//     이름·영문·구분·위키번호  250 (100%)
//     소재지 246 · 소개문 221 · 설립연도 218 · 위키링크 228
//     홈페이지 199 · 로고 131 · <b>동문 115</b>
//     학과·설립구분·일본어이름  0  ← 아예 비어 있습니다
//     위키번호 중복  0
//
//  ── 칸 옮기기 ───────────────────────────────────────────────
//     이름   → name_ko        영문   → name_en
//     구분   → category       소재지 → location
//     설립연도 → founded       위키번호 → wikidata_id
//     홈페이지 → link_home     위키링크 → link_wiki
//     로고   → logo_url + image_url      (양쪽 다)
//     소개문  → description + bio         (양쪽 다)
//     동문   → alumni
//     학과·설립구분·일본어이름 → 비어 있어 담지 않습니다
//
//  ── 조심한 것 ──────────────────────────────────────────────
//   ★ CSV 에 <b>'null' 이라는 글자</b>가 들어 있습니다. 빈 값으로
//     봅니다. 그대로 담으면 화면에 null 이 보입니다.
//   ★ <b>한글 이름이 250곳 가운데 14곳뿐</b>입니다. name_ko 가
//     비면 안 되므로 영문을 넣습니다 — artists 에서 로마자
//     이름이 생긴 것과 같은 사정입니다. <b>어느 것이 그런지
//     로그에 찍습니다.</b> 나중에 한글 이름 채우기로 고칩니다.
//   ★ 위키번호가 <b>이미 있으면 담지 않고 빈칸만 채웁니다.</b>
//     겹침 막기가 부분 인덱스라 on_conflict 를 못 붙입니다.
//   ★ 알맹이가 너무 없는 곳은 <b>감춰서</b> 담습니다.
//     「이름만 있는 항목을 늘리지 않는다」는 오퍼스클램 원칙입니다.
//     지우는 것이 아니라 감추는 것이라 되돌리기 쉽습니다.
//
//  ── 환경변수 ────────────────────────────────────────────────
//   SUPABASE_URL, SUPABASE_SERVICE_KEY
//   SEED_DRY  1 이면 <b>담지 않고</b> 무엇이 들어갈지만 봅니다
// ============================================================

import { readFileSync } from 'node:fs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('환경변수 필요: SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const DRY  = process.env.SEED_DRY === '1';
const FILE = 'data/schools-seed.csv';

const H = {
  apikey: SERVICE_KEY,
  Authorization: 'Bearer ' + SERVICE_KEY,
  'Content-Type': 'application/json',
};

/* ── 'null' 글자도 빈 값으로 ─────────────────────────────── */
const nz = (v) => {
  const s = String(v == null ? '' : v).trim();
  if (s === '' || s === 'null' || s === 'NULL') return null;
  return s;
};
const hasKo = (s) => /[가-힣]/.test(String(s || ''));

/* ── CSV 읽기 · 따옴표와 줄바꿈을 제대로 다룹니다 ──────────
   ★ 소개문에 줄바꿈이 들어 있습니다. 줄 단위로 자르면
     자료가 깨집니다. 한 글자씩 훑어 따옴표 안팎을 가립니다. */
function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else q = false;
      } else cell += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (c === '\r') { /* 건너뜁니다 */ }
      else cell += c;
    }
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/* ── 충실도 ──────────────────────────────────────────────── */
function quality(r) {
  let n = 0;
  if (r.name_en)     n += 1;
  if (hasKo(r.name_ko)) n += 2;      /* 한글 이름이 있으면 값집니다 */
  if (r.location)    n += 1;
  if (r.founded)     n += 1;
  if (r.description) n += 2;
  if (r.alumni)      n += 3;         /* ★ 동문이 이 표의 값어치 */
  if (r.logo_url)    n += 1;
  if (r.link_home)   n += 1;
  if (r.link_wiki)   n += 1;
  return n;
}

/* ── Supabase ────────────────────────────────────────────── */
async function sbGetAll(path) {
  const out = [];
  let from = 0;
  for (;;) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { ...H, Range: `${from}-${from + 199}`, 'Range-Unit': 'items' },
    });
    if (!res.ok) throw new Error(`읽기 실패: ${res.status} ${await res.text()}`);
    const rows = await res.json();
    if (!rows.length) break;         /* ★ 0줄일 때만 끝냅니다 */
    out.push(...rows);
    from += rows.length;
  }
  return out;
}

async function sbInsert(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/schools`, {
    method: 'POST',
    headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`담기 실패: ${res.status} ${await res.text()}`);
}

async function sbPatch(id, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/schools?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`고치기 실패: ${res.status} ${await res.text()}`);
}

const FILL_COLS = ['name_en', 'category', 'location', 'founded', 'alumni',
                   'logo_url', 'image_url', 'link_home', 'link_wiki',
                   'description', 'bio'];

async function main() {
  console.log('═══ 미술대학 씨앗 담기 ═══');
  console.log(DRY ? '  <b>시늉만 · 담지 않습니다</b>' : '  담습니다');
  console.log('');

  /* ── 읽기 ─────────────────────────────────────────────── */
  let text;
  try { text = readFileSync(FILE, 'utf8'); }
  catch (e) {
    console.error(`■ ${FILE} 을 못 읽었습니다 — ${e.message}`);
    console.error('  저장소에 data/schools-seed.csv 가 있는지 보십시오.');
    process.exit(1);
  }

  const table = parseCSV(text).filter(r => r.length > 3);
  const head  = table[0].map(s => s.trim());
  const body  = table.slice(1);
  console.log(`  CSV ${body.length}줄 · 칸 ${head.length}개`);
  console.log(`  칸 이름: ${head.join(' · ')}`);

  const at = (row, name) => {
    const i = head.indexOf(name);
    return i < 0 ? null : nz(row[i]);
  };

  /* ── 옮기기 ───────────────────────────────────────────── */
  const made = [];
  for (const row of body) {
    const nameKo = at(row, '이름');
    const nameEn = at(row, '영문');
    if (!nameKo && !nameEn) continue;               /* 이름조차 없으면 버립니다 */

    const logo = at(row, '로고');
    const desc = at(row, '소개문');

    const r = {
      name_ko:     nameKo || nameEn,               /* ★ 한글이 없으면 영문 */
      name_en:     nameEn || null,
      category:    at(row, '구분'),
      location:    at(row, '소재지'),
      founded:     at(row, '설립연도'),
      wikidata_id: at(row, '위키번호'),
      link_home:   at(row, '홈페이지'),
      link_wiki:   at(row, '위키링크'),
      logo_url:    logo,
      image_url:   logo,                            /* 양쪽 다 */
      image_credit: logo ? 'Wikimedia Commons' : null,
      description: desc,
      bio:         desc,                            /* 양쪽 다 */
      alumni:      at(row, '동문'),
      source:      'opusclam-seed',
      hidden:      false,
    };
    r.quality = quality(r);

    /* ★ 알맹이가 너무 없으면 감춰서 담습니다 (지우지 않습니다) */
    if (r.quality < 3) r.hidden = true;

    made.push(r);
  }

  console.log(`  옮긴 것 ${made.length}곳`);

  /* ── 살펴보기 ─────────────────────────────────────────── */
  const noKo   = made.filter(r => !hasKo(r.name_ko));
  const withAl = made.filter(r => r.alumni);
  const hid    = made.filter(r => r.hidden);

  console.log('');
  console.log('  ── 실태 ────────────────────────────────────');
  console.log(`  한글 이름 있는 곳       ${made.length - noKo.length}곳`);
  console.log(`  한글 이름 없는 곳       ${noKo.length}곳  ← 나중에 채웁니다`);
  console.log(`  동문이 붙은 곳          ${withAl.length}곳`);
  console.log(`  감춰서 담을 곳          ${hid.length}곳  (알맹이가 너무 적음)`);

  if (hid.length) {
    console.log('');
    console.log('  ── 감출 곳 ─────────────────────────────────');
    hid.slice(0, 25).forEach(r =>
      console.log(`     · ${String(r.name_ko).slice(0, 44).padEnd(46)} 충실도 ${r.quality}`));
    if (hid.length > 25) console.log(`     … 그 밖에 ${hid.length - 25}곳`);
  }

  console.log('');
  console.log('  ── 충실도 높은 곳 열 군데 ──────────────────');
  [...made].sort((a, b) => b.quality - a.quality).slice(0, 10).forEach(r => {
    console.log(`     ${String(r.quality).padStart(2)}점  ${String(r.name_ko).slice(0, 40).padEnd(42)}`
      + (r.location || ''));
    if (r.alumni) console.log(`           동문: ${String(r.alumni).slice(0, 70)}`);
  });

  /* ── 이미 있는 것 ─────────────────────────────────────── */
  const exist = await sbGetAll('schools?select=id,wikidata_id,name_ko&order=id.asc');
  const byWid = new Map(exist.filter(r => r.wikidata_id).map(r => [r.wikidata_id, r]));
  const names = new Set(exist.map(r => String(r.name_ko).trim()));
  console.log('');
  console.log(`  표에 이미 있는 줄 ${exist.length}개`);

  const toIns = [];
  let filled = 0, same = 0, dupName = 0;
  for (const r of made) {
    const cur = r.wikidata_id ? byWid.get(r.wikidata_id) : null;
    if (cur) {
      /* 이미 있으면 <빈칸만> 채웁니다 */
      const patch = {};
      for (const k of FILL_COLS) if (r[k]) patch[k] = r[k];
      if (Object.keys(patch).length) { if (!DRY) await sbPatch(cur.id, patch); filled++; }
      else same++;
      continue;
    }
    if (names.has(String(r.name_ko).trim())) { dupName++; continue; }
    names.add(String(r.name_ko).trim());
    toIns.push(r);
  }

  /* ── 담기 ─────────────────────────────────────────────── */
  if (!DRY) {
    for (let i = 0; i < toIns.length; i += 50) {
      await sbInsert(toIns.slice(i, i + 50));
      console.log(`  … ${Math.min(i + 50, toIns.length)}/${toIns.length}`);
    }
  }

  console.log('');
  console.log('═══ 마침 ═══');
  console.log(`  새로 담을 것      ${toIns.length}곳`);
  console.log(`  빈칸만 채운 것    ${filled}곳`);
  console.log(`  그대로 둔 것      ${same}곳`);
  console.log(`  이름이 겹쳐 건너뜀 ${dupName}곳`);
  if (DRY) {
    console.log('');
    console.log('═══ 시늉만 했습니다 — 아무것도 담지 않았습니다 ═══');
  }
}

main().catch(e => { console.error('■ 실패:', e); process.exit(1); });
