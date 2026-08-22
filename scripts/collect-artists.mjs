#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 작가 수집 · scripts/collect-artists.mjs
   ------------------------------------------------------------------
   위키데이터에서 미술가를 받아 artists 표에 쌓습니다.

   쓰는 법
     node scripts/collect-artists.mjs --mode kr    --limit 500
     node scripts/collect-artists.mjs --mode world --limit 300
     node scripts/collect-artists.mjs --mode kr --dry      (담지 않고 세어만 봅니다)

   ★★ 오퍼스클램에서 값을 치르고 배운 것들을 그대로 지킵니다

     ① SPARQL 로는 <b>번호(QID) 목록만</b> 받습니다.
        상세까지 SPARQL 로 받으면 답이 커져 429 와 중간 끊김이 잦습니다.
        상세는 wbgetentities 로 50개씩 나눠 받습니다.

     ② <b>받는 대로 즉시 담습니다.</b> 다 모아서 한 번에 담으면
        중간에 끊겼을 때 그때까지 받은 것이 통째로 날아갑니다.

     ③ 끊긴 답도 살립니다 (lib/json.mjs). 위키데이터는 답이 중간에
        잘려 오는 일이 있는데, 그때 받은 데까지는 쓸 수 있습니다.

     ④ 429 는 lib/http.mjs 가 다룹니다. 자료원이 「오래 뒤에 오라」고
        하면 <b>기다리지 않고 멈춥니다</b> — 다음 회차에 이어 받습니다.

     ⑤ <b>값을 지어 넣지 않습니다.</b> 모르는 것은 비워 둡니다.
        빈 칸은 나중에 채우면 되지만 틀린 값은 찾기 어렵습니다.

   ★ 직업·국적 번호(QID)를 <b>짐작해 박아 넣지 않았습니다.</b>
     아래 목록은 제가 확실히 아는 것만 적었고, 첫 회차 기록을 보고
     넓혀 갑니다. 몇 명이 걸리는지 로그에 남깁니다.
   ══════════════════════════════════════════════════════════════════ */

import { makeGetJSON, isStop, stopReason } from './lib/http.mjs';

/* ── 설정 ─────────────────────────────────────────────────────── */
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('★ SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

const SPARQL = 'https://query.wikidata.org/sparql';
const WBAPI  = 'https://www.wikidata.org/w/api.php';
const UA = 'OpusfineBot/1.0 (https://opusfine.com; cser@wixon.co.kr)';

/* ★ 위키데이터는 429 를 자주 냅니다. 오퍼스클램에서 쓰던 값을
     그대로 씁니다 — 오래 기다렸다 여러 번 다시 묻습니다.
   ★ getJSON 은 <b>객체</b>를 돌려줍니다(lib/json.mjs 의 readJson).
     답이 중간에 끊겨도 받은 데까지 살려 줍니다. */
const getJSON = makeGetJSON({
  ua: UA,
  accept: 'application/sparql-results+json',
  tries: 6,
  maxWaitMs: 200 * 1000,
  budgetMs: 40 * 60 * 1000,
  backoff: [5000, 20000, 45000, 90000, 150000, 200000]
});

/* 상세는 보통 JSON 으로 받습니다 */
const getAPI = makeGetJSON({
  ua: UA,
  accept: 'application/json',
  tries: 5,
  maxWaitMs: 120 * 1000,
  budgetMs: 40 * 60 * 1000
});

/* ── 미술가 직업 ──
   ★★ 2026-08-22 · 첫 회차에서 <b>영화판이 통째로 딸려 왔습니다</b>
     (파트너 확인 — 영화감독 881명, 포르노 영화감독 523명, 각본가 361명).
     까닭이 둘이었습니다.

     ① wdt:P279* 로 <b>하위 갈래를 폈습니다.</b> 「~의 하위」를 끝까지
        따라가면 미술에서 출발해도 영상·연예 쪽으로 이어집니다.
        폭넓게 건지려던 것이 그물을 통째로 찢었습니다.
     ② Q1925963 을 「graphic artist」로 알고 넣었는데, 그 갈래가
        영상 쪽과 이어져 있었습니다. <b>확신이 없으면 넣지 말았어야</b>
        했습니다.

   ▶ 하위 갈래를 펴지 않습니다. 적어 둔 직업 <b>그것만</b> 잡습니다.
     하위까지 훑지 못해 놓치는 사람이 생기지만, 엉뚱한 사람 1,500명이
     섞이는 것보다 낫습니다. 부족하면 직업을 하나씩 <b>확인하고</b>
     보태면 됩니다.
   ★ 만화가는 넣지 않습니다 — 순수미술 포털입니다 (파트너 결정). */
const JOBS = [
  'wd:Q1028181',  // painter 화가
  'wd:Q1281618',  // sculptor 조각가
  'wd:Q33231',    // photographer 사진가
  'wd:Q644687',   // illustrator 삽화가
  'wd:Q329439'    // engraver 판화가
];

/* 한국 ─ 국적으로 잡습니다.
   ★ 조선시대 인물은 국적이 안 적혀 있는 일이 많습니다. 그래서
     <b>한국어 이름이 있는 미술가</b>도 함께 받습니다(mode=kr2). */
const KR = 'wd:Q884';   // 대한민국

function qJobs() { return JOBS.join(' '); }

const QUERY = {
  /* 국적이 한국인 미술가 */
  kr: (lim) => `
SELECT DISTINCT ?item WHERE {
  VALUES ?job { ${qJobs()} }
  ?item wdt:P106 ?job .
  ?item wdt:P27 ${KR} .
} LIMIT ${lim}`,

  /* 한국어 이름이 붙은 미술가
     ★★ 2026-08-22 · <b>쓰지 않기로 했습니다.</b> 6,751명에서 답이 끊겼고
       실제로는 1만이 넘습니다. 반 고흐·피카소까지 다 걸려서
       한국 미술가만 가려낼 수가 없습니다. 자리는 남겨 둡니다. */
  kr2: (lim) => `
SELECT DISTINCT ?item WHERE {
  VALUES ?job { ${qJobs()} }
  ?item wdt:P106 ?job .
  ?item rdfs:label ?ko . FILTER(LANG(?ko) = "ko")
} LIMIT ${lim}`,

  /* ★ 한국어 위키백과에 <b>문서가 있는</b> 미술가
       국적이 안 적힌 조선시대 인물을 건지려는 것입니다.
       「한국어 이름이 있다」보다 훨씬 좁습니다 — 문서를 쓰려면
       누군가 그 사람에 대해 쓸 거리가 있어야 하기 때문입니다.
     ★ 반 고흐도 걸립니다. 받고 나서 가려야 합니다. */
  kr3: (lim) => `
SELECT DISTINCT ?item WHERE {
  VALUES ?job { ${qJobs()} }
  ?item wdt:P106 ?job .
  ?sitelink schema:about ?item ;
            schema:isPartOf <https://ko.wikipedia.org/> .
} LIMIT ${lim}`,

  /* 세계 ─ 작품이 많이 딸린 순 (사람들이 많이 찾는 작가부터) */
  world: (lim) => `
SELECT ?item (COUNT(?w) AS ?n) WHERE {
  VALUES ?job { ${qJobs()} }
  ?item wdt:P106 ?job .
  ?w wdt:P170 ?item .
}
GROUP BY ?item
ORDER BY DESC(?n)
LIMIT ${lim}`
};

/* ── 조선의 번호를 스스로 찾습니다 ────────────────────────────
   ★ QID 를 <b>짐작해 박아 넣지 않습니다.</b> 위키데이터에 물어봅니다.
     「조선」으로 검색해 나온 후보 가운데 <b>미술가가 실제로 국적으로
     쓰고 있는</b> 번호를 고릅니다 — 그것이 우리가 찾는 번호입니다.
   ★ 못 찾으면 조용히 빈 손으로 돌아옵니다. 짐작한 번호로 엉뚱한
     사람을 긁어 오는 것보다 낫습니다. */
async function findJoseon() {
  const url = WBAPI + '?action=wbsearchentities&format=json&language=ko&limit=12'
            + '&search=' + encodeURIComponent('조선');
  let hits = [];
  try {
    const j = await getAPI(url);
    hits = (j && j.search || []).map((x) => x.id).filter(Boolean);
  } catch (e) { return []; }

  const good = [];
  for (const q of hits) {
    /* 이 번호를 국적으로 쓰는 미술가가 몇이나 되는지 세어 봅니다 */
    const probe = `
SELECT (COUNT(DISTINCT ?item) AS ?n) WHERE {
  VALUES ?job { ${qJobs()} }
  ?item wdt:P106 ?job .
  ?item wdt:P27 wd:${q} .
}`;
    try {
      const rows = await askSparql(probe);
      const n = Number(rows[0]?.n?.value || 0);
      if (n >= 5) { good.push({ q, n }); console.log(`    · wd:${q} → 미술가 ${n}명`); }
    } catch (e) { if (isStop(e)) throw e; }
  }
  good.sort((a, b) => b.n - a.n);
  return good.map((x) => x.q);
}

/* ── 명령줄 ───────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? (argv[i + 1] || def) : def;
}
const MODE  = arg('mode', 'kr');
const LIMIT = Number(arg('limit', 400));
const DRY   = argv.includes('--dry');

if (MODE !== 'joseon' && !QUERY[MODE]) {
  console.error('★ mode 는 kr · kr2 · kr3 · joseon · world 가운데 하나입니다.');
  process.exit(1);
}

/* ── 위키데이터 ───────────────────────────────────────────────── */
async function askSparql(q) {
  const d = await getJSON(SPARQL + '?format=json&query=' + encodeURIComponent(q));
  return (d && d.results && d.results.bindings) || [];
}

async function entities(ids) {
  const url = WBAPI + '?action=wbgetentities&format=json&languages=ko|en|ja|zh'
            + '&props=labels|descriptions|claims|sitelinks'
            + '&ids=' + ids.join('|');
  const j = await getAPI(url);
  return (j && j.entities) || {};
}

/* ── 값 꺼내기 ────────────────────────────────────────────────── */
const val = (e, p) => e?.claims?.[p]?.[0]?.mainsnak?.datavalue?.value;
const all = (e, p) => (e?.claims?.[p] || [])
  .map((c) => c?.mainsnak?.datavalue?.value).filter(Boolean);

function yearOf(v) {
  if (!v?.time) return null;
  const m = /^([+-])(\d{4})/.exec(v.time);
  if (!m) return null;
  const y = Number(m[2]);
  return m[1] === '-' ? -y : y;
}
function label(e, lang) { return e?.labels?.[lang]?.value || null; }
function desc(e, lang)  { return e?.descriptions?.[lang]?.value || null; }

/* 커먼즈 파일 이름 → 볼 수 있는 주소
   ★ 우리 저장소에 담지 않습니다. 원본을 링크합니다. */
function commons(file) {
  if (!file) return null;
  return 'https://commons.wikimedia.org/wiki/Special:FilePath/'
       + encodeURIComponent(String(file).replace(/ /g, '_')) + '?width=800';
}

/* 번호(QID)를 사람이 읽을 이름으로 — 두 번 묻지 않게 담아 둡니다 */
const NAMES = new Map();
async function nameOf(qids) {
  const need = [...new Set(qids)].filter((q) => q && !NAMES.has(q));
  for (let i = 0; i < need.length; i += 50) {
    const part = need.slice(i, i + 50);
    let ents = {};
    try { ents = await entities(part); } catch (e) { if (isStop(e)) throw e; }
    for (const q of part) {
      const e = ents[q];
      NAMES.set(q, e ? (label(e, 'ko') || label(e, 'en') || null) : null);
    }
  }
  return (q) => NAMES.get(q) || null;
}

/* ── 충실도 ──
   ★ 자료가 얼마나 채워졌는지 셉니다. 목록 차례에 씁니다.
     이름만 있는 항목이 앞에 오면 안 됩니다. */
function quality(r) {
  let n = 0;
  if (r.name_en)     n += 1;
  if (r.name_han)    n += 1;
  if (r.birth_year)  n += 2;
  if (r.death_year)  n += 1;
  if (r.field)       n += 2;
  if (r.genre)       n += 1;
  if (r.nationality) n += 1;
  if (r.bio)         n += 2;
  if (r.image_url)   n += 3;
  if (r.link_wiki)   n += 1;
  if (r.era_name)    n += 1;
  if (r.rep_work)    n += 2;
  if (r.ulan_id)     n += 1;
  return n;
}

/* ── 한 사람 만들기 ───────────────────────────────────────────── */
async function build(qid, e, look) {
  const ko = label(e, 'ko');
  const en = label(e, 'en');
  if (!ko && !en) return null;               /* 이름조차 없으면 담지 않습니다 */

  const b = yearOf(val(e, 'P569'));
  const d = yearOf(val(e, 'P570'));

  const jobQ   = all(e, 'P106').map((v) => v.id);
  const genreQ = all(e, 'P136').map((v) => v.id);
  const movQ   = all(e, 'P135').map((v) => v.id);
  const natQ   = all(e, 'P27').map((v) => v.id);
  const medQ   = all(e, 'P186').map((v) => v.id);
  const workQ  = all(e, 'P800').map((v) => v.id);

  const nm = look;
  const pick = (qs, max) => qs.map(nm).filter(Boolean).slice(0, max).join(', ') || null;

  /* 한자 이름 — 「원래 언어로 쓴 이름」에 들어 있는 일이 많습니다 */
  const native = val(e, 'P1559');
  const han = (native && /[\u4E00-\u9FFF]/.test(native.text || '')) ? native.text
            : (label(e, 'zh') && /[\u4E00-\u9FFF]/.test(label(e, 'zh')) ? label(e, 'zh') : null);

  const koWiki = e?.sitelinks?.kowiki?.title;
  const enWiki = e?.sitelinks?.enwiki?.title;
  const wiki = koWiki
    ? 'https://ko.wikipedia.org/wiki/' + encodeURIComponent(koWiki.replace(/ /g, '_'))
    : (enWiki ? 'https://en.wikipedia.org/wiki/' + encodeURIComponent(enWiki.replace(/ /g, '_')) : null);

  const r = {
    wikidata_id: qid,
    name_ko:     ko || en,
    name_en:     en || null,
    name_han:    han,
    field:       pick(jobQ, 3),
    genre:       pick(genreQ, 3),
    medium:      pick(medQ, 3),
    era_name:    pick(movQ, 2),
    birth_year:  b,
    death_year:  d,
    life:        (b || d) ? `${b ?? '?'} – ${d ?? '?'}` : null,
    nationality: pick(natQ, 2),
    bio:         desc(e, 'ko') || null,
    bio_en:      desc(e, 'en') || null,
    image_url:   commons(val(e, 'P18')),
    image_credit: val(e, 'P18') ? 'Wikimedia Commons' : null,
    rep_work:    pick(workQ, 2),
    link_wiki:   wiki,
    ulan_id:     val(e, 'P245') || null,
    hidden:      false
  };
  r.quality = quality(r);

  /* ★ 충실도 컷오프 — 이름만 있는 항목은 담지 않습니다.
       개수보다 채워진 것이 중요합니다. 담아 두면 목록이 빈 줄로 찹니다. */
  if (r.quality < 3) return null;
  return r;
}

/* ── 담기 ─────────────────────────────────────────────────────── */
async function upsert(rows) {
  if (!rows.length) return { ok: 0, msg: '' };
  const r = await fetch(SB_URL + '/rest/v1/artists?on_conflict=wikidata_id', {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: 'Bearer ' + SB_KEY,
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
  console.log(`▶ 작가 수집 · mode=${MODE} · limit=${LIMIT}${DRY ? ' · 담지 않고 세어만 봅니다' : ''}`);

  let ids = [];
  try {
    let q;
    if (MODE === 'joseon') {
      console.log('  「조선」의 번호를 찾는 중…');
      const qs = await findJoseon();
      if (!qs.length) {
        console.log('  ※ 미술가가 국적으로 쓰는 「조선」 번호를 못 찾았습니다.');
        console.log('    kr3 (한국어 위키백과에 문서가 있는 미술가) 를 써 보십시오.');
        return;
      }
      console.log('  쓸 번호: ' + qs.map((x) => 'wd:' + x).join(' '));
      q = `
SELECT DISTINCT ?item WHERE {
  VALUES ?job { ${qJobs()} }
  VALUES ?nat { ${qs.map((x) => 'wd:' + x).join(' ')} }
  ?item wdt:P106 ?job .
  ?item wdt:P27 ?nat .
} LIMIT ${LIMIT}`;
    } else {
      q = QUERY[MODE](LIMIT);
    }
    const rows = await askSparql(q);
    ids = rows.map((b) => (b.item?.value || '').split('/').pop()).filter((x) => /^Q\d+$/.test(x));
  } catch (e) {
    console.error('★ 목록을 못 받았습니다:', isStop(e) ? stopReason(e) : e.message);
    process.exit(1);
  }
  console.log(`  걸린 사람 ${ids.length}명`);
  if (!ids.length) {
    console.log('  ※ 0명입니다. 조건이 너무 좁을 수 있습니다 — JOBS·국적을 넓혀 보십시오.');
    return;
  }

  let got = 0, kept = 0, thin = 0, put = 0;
  const errs = [];

  for (let i = 0; i < ids.length; i += 50) {
    const part = ids.slice(i, i + 50);
    let ents = {};
    try {
      ents = await entities(part);
    } catch (e) {
      if (isStop(e)) { console.log('  ■ 멈춥니다 — ' + stopReason(e)); break; }
      errs.push(e.message); continue;
    }

    /* 이 묶음에 나온 번호들의 이름을 한꺼번에 받아 둡니다 */
    const qids = [];
    for (const q of part) {
      const e = ents[q]; if (!e) continue;
      for (const p of ['P106', 'P136', 'P135', 'P27', 'P186', 'P800'])
        (e.claims?.[p] || []).forEach((c) => {
          const v = c?.mainsnak?.datavalue?.value; if (v?.id) qids.push(v.id);
        });
    }
    let look;
    try { look = await nameOf(qids); }
    catch (e) { if (isStop(e)) { console.log('  ■ 멈춥니다 — ' + stopReason(e)); break; } look = () => null; }

    const rows = [];
    for (const q of part) {
      const e = ents[q]; if (!e) continue;
      got++;
      const row = await build(q, e, look);
      if (!row) { thin++; continue; }
      kept++; rows.push(row);
    }

    /* ★ 받는 대로 즉시 담습니다 */
    if (!DRY && rows.length) {
      const res = await upsert(rows);
      if (res.msg) errs.push(res.msg); else put += res.ok;
    }
    console.log(`  ${Math.min(i + 50, ids.length)}/${ids.length} · 받음 ${got} · 담을 것 ${kept} · 얇아서 뺌 ${thin}${DRY ? '' : ` · 담음 ${put}`}`);
  }

  console.log('──────────────────────────────');
  console.log(`  받은 사람       ${got}`);
  console.log(`  담을 만한 사람  ${kept}`);
  console.log(`  얇아서 뺀 사람  ${thin}`);
  if (!DRY) console.log(`  실제로 담음     ${put}`);
  if (errs.length) {
    console.log(`  ★ 문제 ${errs.length}건`);
    errs.slice(0, 5).forEach((m) => console.log('     · ' + m));
  }
})();
