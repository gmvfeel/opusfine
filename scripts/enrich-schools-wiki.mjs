#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 미술학교 소개문 채우기 (위키백과) ·
   scripts/enrich-schools-wiki.mjs
   ------------------------------------------------------------------
   쓰는 법
     node scripts/enrich-schools-wiki.mjs --peek
     node scripts/enrich-schools-wiki.mjs --limit 20 --dry
     node scripts/enrich-schools-wiki.mjs --limit 400

   ★★ 2026-10-01 · 「미술대학 → 미술학교」로 메뉴 이름을 바꾼 자리에서
     파트너가 지적 — 기본 정보(이름·소재지·링크)만 있고 소개문 같은
     구체적인 정보가 없습니다. DB 를 보니 —
       한국 101곳(source=kr-art-schools-2026-09) — 소개문 <b>0곳</b>
       해외 250곳(source=opusclam-seed)          — 소개문 221곳(29곳 빔)
     한국 쪽이 통째로 비어 있었던 것이 실제 몸통입니다.

   ★ 한국 101곳은 <b>학과·학부 단위</b>로 담겨 있습니다
     ("가천대학교 미술・디자인학부"). 위키백과에는 학과 단위 글이
     없고 <b>대학교 전체</b> 글만 있으므로, 학과 뒷말을 잘라 대학
     이름만으로 찾습니다 — 학과 자체가 아니라 그 대학의 소개가
     담기는 것이라, bio 앞에 그 사실을 한 줄 밝혀 둡니다.

   ★ <b>빈칸만 채웁니다</b> — seed-schools.mjs 와 같은 원칙입니다.
     이미 있는 값은 절대 덮어쓰지 않습니다.

   ★ 이 스크립트는 위키백과(ko/en.wikipedia.org)에 닿아야 하므로
     샌드박스가 아니라 <b>GitHub Actions</b>에서 돕니다(collect-works.yml
     의 nga 처럼 바깥 인터넷이 막히지 않은 자리).

   환경변수
     SUPABASE_URL, SUPABASE_SERVICE_KEY
   ══════════════════════════════════════════════════════════════════ */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? (argv[i + 1] || d) : d; };
const LIMIT = Number(arg('limit', 400));
const DRY   = argv.includes('--dry');
const PEEK  = argv.includes('--peek');

if (!SB_URL || !SB_KEY) {
  console.error('★ SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

const UA = 'OpusFineArtArchiveBot/1.0 (https://opusfine.vercel.app; 비영리 미술 아카이브 · 학교 소개문 채우기)';
const H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };

/* ── 대학교 본이름만 뽑기 ──
   ★ "가천대학교 미술・디자인학부" → "가천대학교"
   ★ "건국대학교(글로컬) 조형예술학과" → "건국대학교" ( ( 앞에서 끊음 )
   ★ 못 뽑으면(이름이 대학교/대학으로 안 끝나는 짧은 갈래거나 외국 학교면)
     null — 그러면 원래 이름 그대로 씁니다. */
function baseUniv(nameKo) {
  const m = String(nameKo || '').match(/^([^\s(（]+?(?:대학교|대학))/);
  return m ? m[1] : null;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* ── 위키백과 요약 ── */
async function wikiSummary(lang, title) {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  let r;
  try {
    r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  } catch (e) { return null; }
  if (!r.ok) return null;
  let j;
  try { j = await r.json(); } catch (e) { return null; }
  if (!j || j.type === 'disambiguation' || !j.extract) return null;
  return j;
}

/* ── 소개문에서 설립연도 어림 (있으면만) ── */
function guessFounded(text) {
  if (!text) return null;
  const m = text.match(/(1[5-9]\d{2}|20[0-2]\d)\s*년\s*(?:에\s*)?(?:설립|개교|창립|출범)/)
         || text.match(/(?:founded|established)(?:\s+in)?\s+(1[5-9]\d{2}|20[0-2]\d)/i);
  return m ? m[1] : null;
}

async function sbGet(path) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, { headers: H });
  if (!r.ok) throw new Error('읽기 실패 ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}
async function sbPatch(id, body) {
  const r = await fetch(SB_URL + '/rest/v1/schools?id=eq.' + id, {
    method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('고치기 실패 ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

/* ── 한 곳을 채워 봅니다 ── */
async function enrichOne(row) {
  const isKr = row.source === 'kr-art-schools-2026-09'
    || /대한민국/.test(row.location || '') || row.nat_code === 'kr';
  const lang = isKr ? 'ko' : 'en';

  const cands = [];
  if (isKr) {
    const base = baseUniv(row.name_ko);
    if (base && base !== row.name_ko) cands.push({ title: base, isDept: true });
    cands.push({ title: row.name_ko, isDept: false });
  } else {
    if (row.name_en) cands.push({ title: row.name_en, isDept: false });
    cands.push({ title: row.name_ko, isDept: false });
  }

  for (const c of cands) {
    const j = await wikiSummary(lang, c.title);
    await sleep(120);
    if (!j) continue;

    const patch = {};
    if (!row.bio) {
      /* ★ 학과 단위 항목이면 「이 소개는 학과가 속한 대학 전체 글입니다」
           라고 앞에 밝힙니다 — 학과 자체의 소개인 것처럼 보이면 안 됩니다. */
      const prefix = c.isDept ? `※ 이 학과가 속한 ${c.title}의 소개입니다.\n\n` : '';
      patch.bio = (prefix + j.extract).slice(0, 1200);
    }
    if (!row.description) patch.description = (j.description || j.extract || '').slice(0, 300);
    if (!row.link_wiki && j.content_urls?.desktop?.page) patch.link_wiki = j.content_urls.desktop.page;
    if (!row.wikidata_id && j.wikibase_item) patch.wikidata_id = j.wikibase_item;
    if (!row.founded) {
      const y = guessFounded(j.extract);
      if (y) patch.founded = y;
    }
    if (!row.image_url && j.originalimage?.source) {
      patch.image_url = j.originalimage.source;
      patch.image_credit = '위키백과';
    }

    if (!Object.keys(patch).length) continue;
    return { ok: true, title: c.title, isDept: c.isDept, patch };
  }
  return { ok: false };
}

(async () => {
  console.log(`▶ 미술학교 소개문 채우기 · limit=${LIMIT}${DRY ? ' · 담지 않고 세어만 봅니다' : ''}${PEEK ? ' · peek' : ''}`);

  const rows = await sbGet(
    'schools?select=id,name_ko,name_en,source,location,nat_code,bio,description,link_wiki,wikidata_id,founded,image_url'
    + '&hidden=not.is.true&or=(bio.is.null,bio.eq.)&order=id.asc&limit=' + LIMIT
  );
  console.log(`  소개문 빈 곳 ${rows.length}곳(이번 자리 한도 안)`);

  if (PEEK) {
    const r = rows[0];
    if (!r) { console.log('  (채울 곳이 없습니다)'); return; }
    const res = await enrichOne(r);
    console.log('\n▶ 한 곳만 살펴봅니다\n');
    console.log('  이름:', r.name_ko);
    console.log('  결과:', JSON.stringify(res, null, 2).slice(0, 1500));
    return;
  }

  let filled = 0, missed = 0;
  const missList = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const res = await enrichOne(r);
    if (res.ok) {
      filled++;
      if (!DRY) await sbPatch(r.id, res.patch);
      console.log(`  ${i + 1}/${rows.length} · 채움 · ${r.name_ko}${res.isDept ? ` (→ ${res.title})` : ''}`);
    } else {
      missed++;
      missList.push(r.name_ko);
      console.log(`  ${i + 1}/${rows.length} · 못 찾음 · ${r.name_ko}`);
    }
  }

  console.log('──────────────────────────────');
  console.log(`  받은 곳     ${rows.length}`);
  console.log(`  채운 곳     ${filled}`);
  console.log(`  못 찾은 곳  ${missed}`);
  if (DRY) console.log('  (--dry 라 실제로 담지 않았습니다)');
  if (missList.length) {
    console.log('  ★ 못 찾은 곳 (앞 20개)');
    missList.slice(0, 20).forEach((n) => console.log('     · ' + n));
  }
})().catch((e) => { console.error('■ 실패:', e); process.exit(1); });
