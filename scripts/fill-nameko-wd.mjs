// ============================================================
// OPUSFINE · 위키번호로 한글 이름 받아오기 (v1)
//   scripts/fill-nameko-wd.mjs
//
//  ── 어디서 왔나 ────────────────────────────────────────────
//   오퍼스클램 scripts/collect-nameko-wd.mjs 를 미술로 옮긴 것입니다.
//   저쪽에서 값을 치르고 배운 것을 그대로 물려받았습니다.
//
//  ── 무엇을 고치나 ──────────────────────────────────────────
//   artists 표에서 <b>name_ko 에 한글이 하나도 없는 줄</b>을 찾아
//   위키데이터에서 한글 이름을 받아 채웁니다.
//
//     Cho Sok        → 조속
//     Ch'oe Kyong    → 최경
//     Gim Jong-Tae   → 김종태
//
//   까닭 — collect-artists.mjs 가 <b>name_ko: ko || en</b> 으로
//   담습니다. 위키데이터에 한국어 라벨이 없으면 영문이 한글칸에
//   들어앉습니다. 그래서 로마자 이름이 목록에 보입니다.
//
//  ── 어떻게 받나 ────────────────────────────────────────────
//   ★ <b>이름으로 찾지 않습니다.</b> 위키번호로 바로 받으므로
//     엉뚱한 이름이 붙을 수 없습니다.
//
//     GET /w/api.php?action=wbgetentities&ids=Q1|Q2|…
//                    &props=labels|sitelinks
//
//   ★ <b>라벨만 보면 거의 안 나옵니다.</b> (오퍼스클램 2026-08-31 기록:
//     1,146곳 가운데 2건) 위키데이터의 ko 라벨은 아무도 안 넣어
//     두면 비어 있습니다.
//   ▶ 그래서 <b>한국어 위키백과 문서 제목</b>도 함께 받습니다.
//     라벨이 먼저, 없으면 문서 제목입니다.
//
//   ★ 세로줄(|)은 위키데이터가 정한 구분자라 <b>인코딩하면 안 됩니다.</b>
//     인코딩하면 못 알아듣습니다.
//
//  ── 함께 받는 것 ───────────────────────────────────────────
//   ★ 오퍼스클램은 일본어 이름(name_ja)을 곁들였는데 오퍼스파인
//     artists 표에는 그 칸이 없습니다. 대신 <b>한자(name_han)</b>가
//     있으므로 그쪽을 채웁니다. 조선 작가에게는 한자가 더 값집니다.
//   ★ name_han 이 <b>이미 찬 것은 건드리지 않습니다.</b>
//     「미로(米老)부옹」의 한자가 米老 가 아니라 涪翁 이었던 일이
//     있었습니다. 덮으면 잃습니다.
//
//  ── 조심한 것 ──────────────────────────────────────────────
//   ★ <b>한글이 없는 라벨은 버립니다.</b> ko 라벨이 영문 그대로인
//     경우가 있습니다.
//   ★ <b>같은 이름이 이미 다른 줄에 있으면 넣지 않고 알립니다.</b>
//     조속이 작품DB 에 「노수서작도」로 이미 들어와 있을 수 있습니다.
//     중복이면 이름만 바꿀 게 아니라 <b>합쳐야</b> 합니다 —
//     그 판단은 파트너 몫이라 여기서는 목록만 뽑습니다.
//   ★ 응답이 200줄보다 적게 와도 끝이 아닙니다. <b>0줄일 때만</b>
//     끝냅니다.
//   ★ hidden=is.false 를 쓰지 않습니다. <b>not.is.true</b> 입니다.
//
//  ── 환경변수 ────────────────────────────────────────────────
//   SUPABASE_URL, SUPABASE_SERVICE_KEY
//   NK_DRY    1 이면 <b>담지 않고</b> 무엇이 들어올지만 봅니다
//   NK_LIMIT  몇 건까지 (기본 500)
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('환경변수 필요: SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const DRY   = process.env.NK_DRY === '1';
const LIMIT = Math.max(1, Number(process.env.NK_LIMIT) || 500);
const TABLE = 'artists';
const UA    = 'OpusfineBot/1.0 (https://opusfine.vercel.app; cser@wixon.co.kr)';
const WD    = 'https://www.wikidata.org/w/api.php';

const H = {
  apikey: SERVICE_KEY,
  Authorization: 'Bearer ' + SERVICE_KEY,
  'Content-Type': 'application/json',
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* 한글이 들어 있나 — 한 글자라도 있으면 손대지 않습니다 */
const hasKo  = (s) => /[가-힣]/.test(String(s || ''));
/* 한자가 들어 있나 */
const hasHan = (s) => /[\u4e00-\u9fff]/.test(String(s || ''));

const nz = (v) => {
  const s = String(v == null ? '' : v).trim();
  return s === '' ? null : s;
};

/* ── 바깥 부르기 · 429 를 넉넉히 기다립니다 ────────────────── */
async function getJSON(url) {
  for (let i = 0; i < 6; i++) {
    let res;
    try {
      res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    } catch (e) {
      console.log('    (연결 실패 · 다시 시도) ' + e.message);
      await sleep(5000 * (i + 1));
      continue;
    }
    if (res.status === 429) {
      const ra = Number(res.headers.get('Retry-After') || 0);
      const wait = Math.min(ra ? ra * 1000 : 8000 * (i + 1), 90000);
      console.log('    (429 · ' + Math.round(wait / 1000) + '초 쉽니다)');
      await sleep(wait);
      continue;
    }
    if (!res.ok) { console.log('    (HTTP ' + res.status + ')'); await sleep(4000); continue; }
    return await res.json();
  }
  throw new Error('여섯 번 시도했으나 못 받았습니다');
}

/* ── Supabase ─────────────────────────────────────────────── */
async function sbGetAll(path, max) {
  const out = [];
  let from = 0;
  for (;;) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { ...H, Range: `${from}-${from + 199}`, 'Range-Unit': 'items' },
    });
    if (!res.ok) throw new Error(`읽기 실패: ${res.status} ${await res.text()}`);
    const rows = await res.json();
    if (!rows.length) break;          /* ★ 0줄일 때만 끝냅니다 */
    out.push(...rows);
    from += rows.length;
    if (max && out.length >= max) break;
  }
  return max ? out.slice(0, max) : out;
}

async function sbPatch(id, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`고치기 실패: ${res.status} ${await res.text()}`);
}

async function main() {
  console.log('═══ 위키번호로 한글 이름 받아오기 · artists ═══');
  console.log(`  최대 ${LIMIT}건` + (DRY ? ' · <b>시늉만 · 담지 않습니다</b>' : ''));
  console.log('  ★ 이름으로 찾지 않습니다. 위키번호로 받습니다.');
  console.log('');

  /* ── 대상 — 위키번호가 있고 name_ko 에 한글이 없는 줄 ────── */
  const all = await sbGetAll(
    `${TABLE}?select=id,name_ko,name_en,name_han,wikidata_id,birth_year,hidden`
    + `&wikidata_id=not.is.null&order=id.asc`, 60000
  );
  const rows = all.filter(r => !hasKo(r.name_ko)).slice(0, LIMIT);

  console.log(`  위키번호 있는 작가 ${all.length}명`);
  console.log(`  그중 한글 이름이 없는 작가 ${all.filter(r => !hasKo(r.name_ko)).length}명`);
  console.log(`  이번에 볼 것 ${rows.length}명`);

  /* 이미 쓰이는 한글 이름 — 겹치지 않게 (감춘 것도 셉니다) */
  const used = new Map();
  for (const r of await sbGetAll(
    `${TABLE}?select=id,name_ko,birth_year,hidden&name_ko=not.is.null&order=id.asc`, 60000
  )) {
    const nm = String(r.name_ko).trim();
    if (hasKo(nm) && !used.has(nm)) used.set(nm, r);
  }
  console.log(`  이미 쓰이는 한글 이름 ${used.size}개`);
  console.log('');

  if (!rows.length) { console.log('할 일이 없습니다.'); return; }

  let got = 0, none = 0, dup = 0, fail = 0, han = 0;
  let fromLabel = 0, fromSite = 0;
  const shown = [], dups = [], nones = [];

  /* ★ 20개씩 — 라벨과 문서제목을 함께 받으므로 한 항목이 무겁습니다 */
  for (let i = 0; i < rows.length; i += 20) {
    const part = rows.slice(i, i + 20);
    const ids  = part.map(r => r.wikidata_id).join('|');   /* ★ 세로줄 인코딩 금지 */

    let data;
    try {
      data = await getJSON(
        `${WD}?action=wbgetentities&ids=${ids}`
        + `&props=labels|sitelinks&format=json&origin=*`
      );
    } catch (e) {
      fail += part.length;
      console.log(`  ★ ${part.length}건을 못 받았습니다 — ${String(e.message).slice(0, 80)}`);
      await sleep(1500);
      continue;
    }

    const ents = (data && data.entities) || {};

    for (const row of part) {
      const e      = ents[row.wikidata_id];
      const labels = (e && e.labels)    || {};
      const sites  = (e && e.sitelinks) || {};

      /* 라벨을 먼저, 없으면 한국어 위키백과 문서 제목 */
      let ko = nz(labels.ko && labels.ko.value);
      let via = '라벨';
      if (!ko) {
        const kot = nz(sites.kowiki && sites.kowiki.title);
        if (kot) { ko = kot.replace(/\s*\([^)]*\)\s*$/, '').trim(); via = '위키백과'; }
      }

      /* 한자 — 중국어 라벨이나 문서 제목에서 */
      let hanName = nz(labels['zh-hant'] && labels['zh-hant'].value)
                 || nz(labels.zh && labels.zh.value);
      if (!hanName) {
        const zht = nz(sites.zhwiki && sites.zhwiki.title);
        if (zht) hanName = zht.replace(/\s*\([^)]*\)\s*$/, '').trim();
      }

      if (!ko || !hasKo(ko)) {
        none++;
        if (nones.length < 30) {
          nones.push(`     · ${row.name_ko || row.name_en}  (${row.wikidata_id}`
            + (row.birth_year ? ` · ${row.birth_year}` : '') + ')');
        }
        continue;
      }
      if (via === '라벨') fromLabel++; else fromSite++;

      /* ★ 같은 한글 이름이 이미 있으면 담지 않고 목록에 올립니다 */
      if (used.has(ko)) {
        dup++;
        const other = used.get(ko);
        dups.push(`     ⊘ ${row.name_ko || row.name_en} (id ${row.id}) → ${ko}`
          + `  ·  이미 id ${other.id} 가 씁니다`
          + (other.birth_year ? ` (${other.birth_year}년생)` : '')
          + (other.hidden ? ' [감춤]' : ''));
        continue;
      }

      const patch = { name_ko: ko };

      /* 영문칸이 비어 있으면 지금 로마자 이름을 그쪽으로 옮깁니다 */
      if (!row.name_en && row.name_ko) patch.name_en = row.name_ko;

      /* ★ 한자는 <b>비어 있을 때만</b> 넣습니다 */
      if (hanName && hasHan(hanName) && !hasHan(row.name_han)) {
        patch.name_han = hanName;
        han++;
      }

      if (!DRY) {
        try { await sbPatch(row.id, patch); }
        catch (err) {
          fail++;
          console.log(`  ★ ${row.name_ko} 담기 실패 — ${String(err.message).slice(0, 90)}`);
          continue;
        }
      }

      used.set(ko, { id: row.id, birth_year: row.birth_year, hidden: row.hidden });
      got++;
      if (shown.length < 80) {
        shown.push(`     · ${String(row.name_ko || row.name_en).padEnd(26)} → ${String(ko).padEnd(10)}`
          + ` [${via}]` + (patch.name_han ? ` 한자 ${patch.name_han}` : ''));
      }
    }

    await sleep(1500);          /* 위키데이터에 폐가 되지 않게 */
  }

  console.log('');
  if (shown.length) {
    console.log('  ── 채워질 이름 ──────────────────────────────');
    shown.forEach(s => console.log(s));
    if (got > shown.length) console.log(`     … 그 밖에 ${got - shown.length}건`);
  }
  if (dups.length) {
    console.log('');
    console.log('  ── ★ 중복 · 파트너께서 보셔야 합니다 ────────');
    console.log('     같은 한글 이름이 이미 있습니다. 이름만 바꿀 게 아니라');
    console.log('     <b>합쳐야</b> 할 수 있습니다. 담지 않았습니다.');
    dups.forEach(s => console.log(s));
  }
  if (nones.length) {
    console.log('');
    console.log('  ── 한글 이름을 못 찾은 것 ───────────────────');
    console.log('     위키데이터에 한국어 라벨도 위키백과 문서도 없습니다.');
    console.log('     손으로 넣어야 하는 것들입니다.');
    nones.forEach(s => console.log(s));
    if (none > nones.length) console.log(`     … 그 밖에 ${none - nones.length}건`);
  }

  console.log('');
  console.log('═══ 마침 ═══');
  console.log(`  한글 이름 넣음    ${got}건`);
  console.log(`    ↳ 라벨에서 ${fromLabel}건 · 위키백과 문서 제목에서 ${fromSite}건`);
  console.log(`  한글 이름 없음    ${none}건`);
  console.log(`  중복이라 건너뜀   ${dup}건  ← 위 목록을 보십시오`);
  if (han)  console.log(`  한자도 넣음       ${han}건`);
  if (fail) console.log(`  실패             ${fail}건`);
  if (DRY) {
    console.log('');
    console.log('═══ 시늉만 했습니다 — 아무것도 담지 않았습니다 ═══');
  }
}

main().catch(e => { console.error('■ 실패:', e); process.exit(1); });
