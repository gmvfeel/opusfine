#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 빠진 작가 채우기 · scripts/collect-artists-missing.mjs
   ------------------------------------------------------------------
   쓰는 법
     node scripts/collect-artists-missing.mjs --peek
     node scripts/collect-artists-missing.mjs --dry
     node scripts/collect-artists-missing.mjs

   ★★ 왜 필요한가 (2026-08-23 · 확인함)
     작품 9,757점에 작가 이름이 붙어 있는데, 그 가운데 <b>5,988점</b>이
     「작가 이름은 있으나 <b>우리 DB 에 그 사람이 없어서</b>」 못 이었습니다.
       김규진 305 · 김준근 249 · 이인성 184 · 오세창 175 · 한락연 163 …
     한국 근대 서화가들이 통째로 빠져 있습니다.

   ★★ 2026-08-24 · <b>전시</b>도 봅니다. 전시 878건의 참여작가 가운데
     4,911개가 작가DB 에 없습니다 — 이번엔 <b>한국 현대</b>입니다.
       이우성 13 · 양아치 12 · 강홍구 11 · 주명덕 11 · 임흥순 9 · 유근택 8
     작가DB 가 조선·근대에 치우쳐 현대가 비어 있었습니다.

   ▶ <b>거꾸로 갑니다.</b> 위키데이터에서 작가를 긁어 오는 것이 아니라,
     <b>우리 작품이 부르는 이름</b>을 모아 그 사람을 찾아 채웁니다.
     채우는 즉시 그 사람의 작품이 이어집니다 — 헛일이 없습니다.

   ★★ <b>한국 사람만</b> 채웁니다 (파트너 결정)
     빠진 목록에 Utagawa Hiroshige 241 · 요한 크리스티안 달 236 처럼
     일본·서양 작가가 섞여 있습니다. 지금 넣으면 작가DB 592명에
     바깥 사람이 쏟아집니다. 나중에 필요하면 그때 넣습니다.

   ★ 위키데이터에 없는 사람은 <b>이름만이라도</b> 만듭니다.
     김준근(기산)처럼 이름난 화가인데 항목이 없는 경우가 있습니다.
     비워 두면 작품 249점이 영영 안 이어집니다.
     그런 줄은 quality 를 낮게 두어 목록 뒤로 갑니다.

   ★ 위키미디어는 <b>연락처가 담긴 User-Agent</b> 를 요구합니다.
   ══════════════════════════════════════════════════════════════════ */

import { makeGetJSON, isStop, stopReason } from './lib/http.mjs';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const SPARQL = 'https://query.wikidata.org/sparql';
const WBAPI  = 'https://www.wikidata.org/w/api.php';
const UA = 'OpusfineBot/1.0 (https://opusfine.com; cser@wixon.co.kr)';

const getJSON = makeGetJSON({
  ua: UA, accept: 'application/json',
  tries: 5, maxWaitMs: 120 * 1000, budgetMs: 40 * 60 * 1000
});

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? (argv[i + 1] || d) : d; };
const PEEK = argv.includes('--peek');
const DRY  = argv.includes('--dry');
const MIN  = Number(arg('min', 2));      /* 작품 몇 점 이상인 사람만 */
const LIMIT = Number(arg('limit', 400));

if (!SB_URL || !SB_KEY) {
  console.error('★ SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

/* ── 한국 사람인가 ──
   ★ 이름만 보고 가립니다. 로마자면 바깥 사람입니다 —
     Utagawa Hiroshige · Seifū Yohei · Katsushika Hokusai.
   ★ 한글이어도 <b>음역된 서양 이름</b>이 있습니다 —
     「요한 크리스티안 달」·「테오도르 제리코」·「귀스타브 도레」.
     성이 한 글자가 아니고 <b>빈칸이 들어간 긴 이름</b>이 특징입니다. */
function isKoreanName(nm) {
  const s = String(nm || '').trim();
  if (!s) return false;
  if (!/^[가-힣][가-힣\s·]*$/.test(s)) return false;      /* 한글만 */
  if (s.replace(/\s/g, '').length > 5) return false;      /* 5자 넘으면 음역 이름 */
  if (/\s/.test(s) && s.replace(/\s/g, '').length > 4) return false;
  /* 「요한 크리스티안 달」은 빈칸 둘 — 한국 이름에는 거의 없습니다 */
  if ((s.match(/\s/g) || []).length >= 2) return false;
  return true;
}

/* ── 우리 자료가 부르는 이름 모으기 ──
   ★★ 2026-08-24 · <b>전시</b>도 봅니다.
     그동안 작품만 보았습니다. 그런데 전시 878건에 참여작가가
     적혀 있고, 그 가운데 <b>4,911개가 작가DB 에 없습니다.</b>
       이우성 13 · 양아치 12 · 강홍구 11 · 주명덕 11 · 임흥순 9 …
     우리 작가DB 745명이 <b>조선·근대에 치우쳐</b> 있어 한국 현대가
     통째로 비어 있습니다. 전시 쪽이 그 자리를 채워 줍니다.

   ★ 전시는 exhibition_artists 표를 봅니다. 이름을 이미 갈라 담아
     두었으므로 여기서 또 가를 일이 없습니다. */
async function wanted() {
  const cnt = new Map();

  const add = function (raw) {
    const nm = String(raw || '')
      .replace(/\s*[(（][^)）]*[)）]\s*/g, '')
      .replace(/\s*외\s*\d*\s*(인|명|팀)?\s*$/, '')
      .trim();
    if (!nm) return;
    cnt.set(nm, (cnt.get(nm) || 0) + 1);
  };

  const sweep = async function (path, pick) {
    let from = 0;
    for (;;) {
      const r = await fetch(SB_URL + path + '&limit=1000&offset=' + from,
        { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
      if (!r.ok) break;
      const rows = await r.json();
      if (!rows.length) break;                     /* ★ 0줄일 때 끝냅니다 */
      for (const x of rows) add(pick(x));
      from += rows.length;
    }
  };

  /* ① 작품이 부르는 이름 */
  await sweep('/rest/v1/artworks?select=artist_name'
    + '&hidden=not.is.true&artist_id=is.null&artist_name=not.is.null',
    function (x) { return x.artist_name; });

  /* ② 전시가 부르는 이름 — 아직 안 이어진 것만 */
  try {
    await sweep('/rest/v1/exhibition_artists?select=artist_name'
      + '&artist_id=is.null',
      function (x) { return x.artist_name; });
  } catch (e) {
    /* ★ 표가 아직 없어도 <b>작품 쪽은 그대로 돕니다.</b>
         한쪽이 없다고 전체가 멈추면 안 됩니다. */
    console.log('  (전시 표를 못 읽어 작품 쪽만 봅니다)');
  }

  return cnt;
}

/* ── 이미 DB 에 있는 이름 ── */
async function have() {
  const s = new Set();
  let from = 0;
  for (;;) {
    const r = await fetch(SB_URL + '/rest/v1/artists?select=name_ko,name_en,art_name'
      + '&limit=1000&offset=' + from,
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    if (!r.ok) break;
    const rows = await r.json();
    if (!rows.length) break;
    for (const a of rows) for (const nm of [a.name_ko, a.name_en, a.art_name])
      if (nm) s.add(String(nm).trim());
    from += rows.length;
  }
  return s;
}

/* ── 위키데이터에서 찾기 ──
   ★ 한국어 이름표가 꼭 같고, <b>사람</b>인 것만 봅니다.
     이름만 물으면 동명의 절·산·책이 딸려 옵니다. */
async function ask(q) {
  const d = await getJSON(SPARQL + '?format=json&query=' + encodeURIComponent(q));
  return (d && d.results && d.results.bindings) || [];
}
function query(names) {
  const vals = names.map((n) => '"' + n.replace(/"/g, '') + '"@ko').join(' ');
  return `
SELECT ?p ?nm ?ko ?han ?en ?b ?d ?jobLabel ?natLabel ?img WHERE {
  VALUES ?nm { ${vals} }
  ?p rdfs:label ?nm .
  ?p wdt:P31 wd:Q5 .
  OPTIONAL { ?p rdfs:label ?ko  FILTER(lang(?ko)  = "ko") }
  OPTIONAL { ?p rdfs:label ?en  FILTER(lang(?en)  = "en") }
  OPTIONAL { ?p rdfs:label ?han FILTER(lang(?han) = "zh") }
  OPTIONAL { ?p wdt:P569 ?b }
  OPTIONAL { ?p wdt:P570 ?d }
  OPTIONAL { ?p wdt:P106 ?job . ?job rdfs:label ?jobLabel FILTER(lang(?jobLabel) = "ko") }
  OPTIONAL { ?p wdt:P27  ?nat . ?nat rdfs:label ?natLabel FILTER(lang(?natLabel) = "ko") }
  OPTIONAL { ?p wdt:P18  ?img }
}`;
}

const qid = (u) => (String(u || '').match(/Q\d+$/) || [null])[0];
function yearOf(iso) {
  const m = /^([+-])(\d{4})/.exec(String(iso || ''));
  if (!m) return null;
  const y = Number(m[2]);
  return m[1] === '-' ? -y : y;
}
function image(uri) {
  if (!uri) return null;
  return String(uri).replace(/^http:/, 'https:') + '?width=800';
}

function quality(a) {
  let n = 0;
  if (a.wikidata_id) n += 3;
  if (a.image_url)   n += 3;
  if (a.birth_year)  n += 2;
  if (a.death_year)  n += 1;
  if (a.field)       n += 2;
  if (a.name_han)    n += 1;
  if (a.nationality) n += 1;
  return n;
}

async function upsert(rows) {
  if (!rows.length) return { ok: 0, msg: '' };
  const r = await fetch(SB_URL + '/rest/v1/artists?on_conflict=wikidata_id', {
    method: 'POST',
    headers: {
      apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(rows)
  });
  if (!r.ok) return { ok: 0, msg: r.status + ' ' + (await r.text()).slice(0, 250) };
  return { ok: rows.length, msg: '' };
}

/* ★ 위키데이터에 없는 사람은 이름만 만듭니다 — 열쇠가 없으므로
     따로 넣습니다. 이미 있는지 먼저 보고 넣습니다. */
async function insertBare(rows) {
  if (!rows.length) return { ok: 0, msg: '' };
  const r = await fetch(SB_URL + '/rest/v1/artists', {
    method: 'POST',
    headers: {
      apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(rows)
  });
  if (!r.ok) return { ok: 0, msg: r.status + ' ' + (await r.text()).slice(0, 250) };
  return { ok: rows.length, msg: '' };
}

/* ══ 돌리기 ══════════════════════════════════════════════════════ */
(async () => {
  console.log('▶ 빠진 작가 채우기'
    + (PEEK ? ' · 엿보기 — 담지 않습니다' : (DRY ? ' · 세어만 봅니다' : ''))
    + ` · ${MIN}점 이상`);

  const want = await wanted();
  const has = await have();
  console.log(`  작품이 부르는 이름 ${want.size}가지 · 작가DB 에 이미 있는 이름 ${has.size}가지`);

  /* 빠진 사람 — 한국 사람만 · 작품 많은 순 */
  const missing = [...want.entries()]
    .filter(([nm, n]) => n >= MIN && !has.has(nm))
    .sort((a, b) => b[1] - a[1]);

  const kr = missing.filter(([nm]) => isKoreanName(nm));
  const out = missing.filter(([nm]) => !isKoreanName(nm));

  console.log(`  빠진 이름 ${missing.length}가지`
            + ` · 한국 ${kr.length} · 바깥 ${out.length}\n`);

  if (PEEK) {
    console.log('── 채울 한국 작가 (작품 많은 순 40)');
    for (const [nm, n] of kr.slice(0, 40))
      console.log(`   ${String(n).padStart(4)}점  ${nm}`);
    console.log('\n── 안 채울 바깥 작가 (20)');
    for (const [nm, n] of out.slice(0, 20))
      console.log(`   ${String(n).padStart(4)}점  ${nm}`);
    const sumKr = kr.reduce((s, x) => s + x[1], 0);
    console.log(`\n★ 한국 작가 ${kr.length}명을 채우면 작품 ${sumKr}점이 이어집니다.`);
    console.log('  지금은 담지 않았습니다.');
    return;
  }

  /* ── 위키데이터에 물어봅니다 ── */
  const names = kr.slice(0, LIMIT).map(([nm]) => nm);
  const found = new Map();
  const PACK = 40;
  for (let i = 0; i < names.length; i += PACK) {
    const part = names.slice(i, i + PACK);
    let rows = [];
    try { rows = await ask(query(part)); }
    catch (e) {
      if (isStop(e)) { console.log('  ■ 멈춥니다 — ' + stopReason(e)); break; }
      console.log(`  (${i}~ 건너뜀 — ${String(e.message).slice(0, 60)})`);
      continue;
    }
    for (const b of rows) {
      const nm = b.nm && b.nm.value;
      const q = qid(b.p && b.p.value);
      if (!nm || !q) continue;
      if (!found.has(nm)) found.set(nm, new Map());
      const m = found.get(nm);
      if (!m.has(q)) m.set(q, b);
    }
    console.log(`  물어본 이름 ${Math.min(i + PACK, names.length)}/${names.length}`
              + ` · 찾은 이름 ${found.size}`);
  }

  /* ── 담을 것 만들기 ── */
  const withQ = [], bare = [];
  let ambig = 0;
  for (const [nm, n] of kr.slice(0, LIMIT)) {
    const m = found.get(nm);
    /* ★ 위키데이터에 <b>여럿</b>이면 동명이인입니다. 짐작으로 고르지
         않고 이름만 만들어 둡니다 — 사람이 나중에 채웁니다. */
    if (!m || m.size !== 1) {
      if (m && m.size > 1) ambig++;
      bare.push({
        name_ko: nm, hidden: false, quality: 1,
        field: null, bio: null
      });
      continue;
    }
    const b = [...m.values()][0];
    const a = {
      wikidata_id: qid(b.p.value),
      name_ko: nm,
      name_en: (b.en && b.en.value) || null,
      name_han: (b.han && b.han.value) || null,
      birth_year: yearOf(b.b && b.b.value),
      death_year: yearOf(b.d && b.d.value),
      field: (b.jobLabel && b.jobLabel.value) || null,
      nationality: (b.natLabel && b.natLabel.value) || null,
      image_url: image(b.img && b.img.value),
      image_credit: (b.img && b.img.value) ? 'Wikimedia Commons' : null,
      link_wiki: 'https://www.wikidata.org/wiki/' + qid(b.p.value),
      hidden: false
    };
    a.life = (a.birth_year || a.death_year)
      ? `${a.birth_year || '?'} – ${a.death_year || '?'}` : null;
    a.quality = quality(a);
    withQ.push(a);
  }

  console.log(`\n  위키데이터에서 찾음 ${withQ.length}명`
            + ` · 못 찾아 이름만 ${bare.length}명 (그 가운데 동명이인 ${ambig}명)`);

  if (DRY) {
    console.log('\n  보기 열 명');
    for (const a of withQ.slice(0, 10))
      console.log(`    ${String(a.name_ko).padEnd(10)} ${a.life || ''}`
                + ` ${a.field || ''} ${a.wikidata_id}`);
    console.log('  (세어만 봤습니다)');
    return;
  }

  let put = 0;
  const errs = [];
  for (let i = 0; i < withQ.length; i += 100) {
    const res = await upsert(withQ.slice(i, i + 100));
    if (res.msg) errs.push(res.msg); else put += res.ok;
  }
  let bareN = 0;
  for (let i = 0; i < bare.length; i += 100) {
    const res = await insertBare(bare.slice(i, i + 100));
    if (res.msg) errs.push(res.msg); else bareN += res.ok;
  }

  console.log('──────────────────────────────');
  console.log(`  위키데이터로 담음   ${put}명`);
  console.log(`  이름만 담음        ${bareN}명`);
  if (errs.length) {
    console.log(`  ★ 문제 ${errs.length}건`);
    errs.slice(0, 3).forEach((m) => console.log('     · ' + m));
  }
  /* ★★ 2026-08-24 · 채운 것으로 <b>끝이 아닙니다.</b>
       작가를 담아도 작품·전시가 저절로 붙지는 않습니다.
       이어 붙이는 SQL 을 <b>둘 다</b> 돌려야 합니다. */
  console.log('\n★ 이어 붙이려면 SQL 을 <b>둘 다</b> 돌리십시오 —');
  console.log('    sql/artist-16-B-apply.sql   작품 ↔ 작가');
  console.log('    sql/exh-26-B-apply.sql      전시 ↔ 작가');
})();
