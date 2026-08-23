#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 작품 수집 (커먼즈) · scripts/collect-works-commons.mjs
   ------------------------------------------------------------------
   쓰는 법
     node scripts/collect-works-commons.mjs --peek
     node scripts/collect-works-commons.mjs --limit 200 --dry
     node scripts/collect-works-commons.mjs

   ★★ 왜 이것이 필요한가 (2026-08-23 · 확인하고 알았습니다)
     클리블랜드 6,158점을 담고 나서 잇기를 재 보니 이랬습니다.
       · 작가와 이어진 작품        3점
       · 이름은 있으나 못 이음  2,610점  ← 전부 일본·중국 작가
       · 작자 미상             4,041점
       · 위키데이터 번호로 이어짐    0점  ← 그것은 <b>작품의 번호</b>였습니다
     제가 「위키데이터 번호로 맞추면 정확하다」고 했는데 <b>틀렸습니다.</b>

     ▶ 진짜 문제는 잇는 <b>방법</b>이 아니라 이을 <b>자료</b>였습니다.
       우리 작가DB 592명은 한국 사람인데, 담긴 작품은 일본·중국 것입니다.
       정선을 눌러 들어가도 작품이 하나도 없습니다.

   ▶ 그래서 <b>거꾸로 갑니다.</b> 작품을 받아 놓고 작가를 찾는 것이
     아니라, <b>우리 작가에게서 출발해 그 사람의 작품</b>을 받습니다.
     위키데이터가 「이 그림은 정선이 그렸다(P170)」를 알고 있습니다.
     그러니 <b>잇기 문제가 애초에 생기지 않습니다</b> — 받는 순간
     이미 이어져 있습니다.

   ★ 두 갈래로 찾습니다
       P170 (creator)      — 「이 작품을 그린 이」  · 이쪽이 본류
       P800 (notable work) — 「이 사람의 대표작」    · 빠진 것을 줍습니다
     둘 다 <b>도판(P18)이 있는 것만</b> 받습니다. 없으면 화면에 못 씁니다.

   ★ 커먼즈 도판은 우리 저장소에 담지 않고 원본을 링크합니다.
     출처(위키미디어 커먼즈)를 image_credit 에 적습니다 — 라이선스가
     출처 표시를 요구하는 것이 섞여 있습니다.

   ★ 위키미디어는 <b>연락처가 담긴 User-Agent</b> 를 요구합니다.
     없으면 막힙니다. 아래 UA 를 지웁니다면 곧 차단됩니다.

   ★ --peek — 담지 않고 <b>얼마나 있는지</b>만 세어 봅니다.
     인계문서 교훈 ① — 「자료원을 고를 때 도판이 실제로 화면에 뜨는지
     먼저 확인할 것」. 커먼즈 도판은 이미 작가 초상으로 뜨는 것을
     확인했으므로, 여기서는 <b>수</b>를 봅니다.
   ══════════════════════════════════════════════════════════════════ */

import { makeGetJSON, isStop, stopReason } from './lib/http.mjs';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

const SPARQL = 'https://query.wikidata.org/sparql';
const UA = 'OpusfineBot/1.0 (https://opusfine.com; cser@wixon.co.kr)';

const getJSON = makeGetJSON({
  ua: UA, accept: 'application/sparql-results+json',
  tries: 5, maxWaitMs: 120 * 1000, budgetMs: 40 * 60 * 1000
});

/* ── 명령줄 ───────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? (argv[i + 1] || d) : d; };
const PEEK  = argv.includes('--peek');
const CATPEEK = argv.includes('--catpeek');
const DRY   = argv.includes('--dry');
const LIMIT = Number(arg('limit', 5000));

/* ★ 한 번에 물어볼 작가 수. 너무 많으면 질의가 길어져 시간이 초과됩니다.
     오퍼스클램에서 60 이 안전한 수였습니다. */
const PACK = 60;

if (!SB_URL || !SB_KEY) {
  console.error('★ SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

/* ── 우리 작가 가운데 위키데이터 번호가 있는 사람 ──────────────
   ★ 번호가 없으면 물어볼 길이 없습니다. 그런 사람은 건너뜁니다. */
async function loadArtists() {
  const out = [];
  let from = 0;
  for (;;) {
    const r = await fetch(
      SB_URL + '/rest/v1/artists?select=id,name_ko,name_en,wikidata_id'
      + '&hidden=not.is.true&wikidata_id=not.is.null'
      + '&order=quality.desc,id.asc&limit=1000&offset=' + from,
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    if (!r.ok) throw new Error('작가DB ' + r.status);
    const rows = await r.json();
    /* ★ 0줄일 때 끝냅니다 — 응답은 한 번에 1000줄까지만 옵니다. */
    if (!rows.length) break;
    out.push(...rows);
    from += rows.length;
  }
  return out;
}

/* ── 이미 담긴 작품의 번호 ──
   ★★ 클리블랜드 작품도 wikidata_id 를 갖고 있습니다(5,825점).
     같은 그림이 양쪽에 있을 수 있습니다. 그대로 덮어쓰면
     <b>클리블랜드 쪽이 더 두툼한데 커먼즈 쪽으로 얇아집니다</b> —
     소장처·크기·소장내력이 날아갑니다.
   ▶ 이미 있는 번호는 <b>건너뜁니다.</b> 커먼즈는 <b>없는 것만 더합니다.</b>
     덮어쓰지 않으므로 잃는 것이 없고, 다시 돌려도 탈이 없습니다. */
async function loadExisting() {
  const have = new Set();
  let from = 0;
  for (;;) {
    const r = await fetch(
      SB_URL + '/rest/v1/artworks?select=wikidata_id&wikidata_id=not.is.null'
      + '&limit=1000&offset=' + from,
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    if (!r.ok) break;
    const rows = await r.json();
    if (!rows.length) break;
    for (const x of rows) if (x.wikidata_id) have.add(x.wikidata_id);
    from += rows.length;
  }
  return have;
}

async function ask(q) {
  const d = await getJSON(SPARQL + '?format=json&query=' + encodeURIComponent(q));
  return (d && d.results && d.results.bindings) || [];
}

/* ── 질의 ──
   ★ VALUES 로 작가 여럿을 한 번에 묻습니다. 한 사람씩 물으면
     592번을 묻게 되고, 위키미디어가 곱게 보지 않습니다.
   ★ OPTIONAL 을 많이 걸면 느려집니다. 꼭 쓸 것만 겁니다.
   ★ 라벨은 SERVICE 를 쓰지 않고 rdfs:label 로 직접 받습니다 —
     SERVICE 는 질의가 커지면 자주 시간이 초과됩니다. */
function query(qids, prop) {
  const vals = qids.map((q) => 'wd:' + q).join(' ');
  /* ★★ 2026-08-23 · P800 을 <b>거꾸로 물었습니다</b>. 제 잘못입니다.
       P170 은 「작품 → 그린 이」  ?work wdt:P170 ?artist
       P800 은 「작가 → 대표작」  ?artist wdt:P800 ?work   ← 방향이 반대
     앞 판에서 P800 이 0줄이었던 까닭입니다. 방향만 맞추면 됩니다. */
  const triple = prop === 'P800'
    ? '?artist wdt:P800 ?work .'
    : '?work wdt:' + prop + ' ?artist .';
  return `
SELECT ?work ?artist ?img ?ko ?en ?date ?matLabel ?colLabel ?inv WHERE {
  VALUES ?artist { ${vals} }
  ${triple}
  ?work wdt:P18 ?img .
  OPTIONAL { ?work rdfs:label ?ko  FILTER(lang(?ko) = "ko") }
  OPTIONAL { ?work rdfs:label ?en  FILTER(lang(?en) = "en") }
  OPTIONAL { ?work wdt:P571 ?date }
  OPTIONAL { ?work wdt:P186 ?mat . ?mat rdfs:label ?matLabel FILTER(lang(?matLabel) = "ko") }
  OPTIONAL { ?work wdt:P195 ?col . ?col rdfs:label ?colLabel FILTER(lang(?colLabel) = "ko") }
  OPTIONAL { ?work wdt:P217 ?inv }
}`;
}

/* ── 값 다듬기 ────────────────────────────────────────────────── */
const qid = (uri) => (String(uri || '').match(/Q\d+$/) || [null])[0];

function yearOf(iso) {
  if (!iso) return null;
  const m = /^([+-])(\d{4})/.exec(String(iso));
  if (!m) return null;
  const y = Number(m[2]);
  return m[1] === '-' ? -y : y;
}

/* 커먼즈 파일 주소 → 볼 수 있는 주소
   ★ P18 은 이미 http://commons.wikimedia.org/wiki/Special:FilePath/… 로
     옵니다. 폭만 붙여 800px 로 줄입니다 — 원본은 수십 MB 짜리가 있습니다. */
function image(uri, w) {
  if (!uri) return null;
  const u = String(uri).replace(/^http:/, 'https:');
  return u + (u.includes('?') ? '&' : '?') + 'width=' + w;
}

/* ── 충실도 ── */
function quality(w) {
  let n = 0;
  if (w.image_url)   n += 4;
  if (w.year_text)   n += 2;
  if (w.medium)      n += 2;
  if (w.artist_name) n += 2;
  if (w.artist_id)   n += 2;
  if (w.holder)      n += 1;
  if (w.link_source) n += 1;
  if (w.title_han)   n += 1;
  return n;
}

/* ── 한 점 만들기 ──
   ★ artist_id 를 <b>이미 알고 있습니다.</b> 이 작품을 찾은 까닭이
     「그 작가가 그렸다」이기 때문입니다. link_status 는 auto 입니다 —
     이름을 맞춰 본 것이 아니라 <b>위키데이터가 그렇다고 한 것</b>입니다. */
function build(b, byQid) {
  const wq = qid(b.work && b.work.value);
  const aq = qid(b.artist && b.artist.value);
  if (!wq || !aq) return null;

  const a = byQid.get(aq);
  if (!a) return null;

  const ko = b.ko && b.ko.value;
  const en = b.en && b.en.value;
  const title = (ko || en || '').trim();
  /* ★ 이름 없는 것은 담지 않습니다. 「Q12345」가 목록에 뜨면 안 됩니다. */
  if (!title) return null;

  const y = yearOf(b.date && b.date.value);
  const img = b.img && b.img.value;

  const w = {
    wikidata_id: wq,
    title,
    title_en:    en || null,
    title_han:   null,
    year_text:   y != null ? String(y) : null,
    year_from:   y,
    year_to:     y,
    medium:      (b.matLabel && b.matLabel.value) || null,
    dimensions:  null,
    genre:       null,
    artist_name: a.name_ko || a.name_en || null,
    artist_id:   a.id,
    /* ★ 위키데이터가 「이 사람이 그렸다」고 한 것입니다.
         이름을 맞춰 본 것이 아니므로 동명이인 걱정이 없습니다. */
    link_status: 'auto',
    image_url:   image(img, 1200),
    image_small: image(img, 800),
    image_credit: 'Wikimedia Commons',
    /* ★ 커먼즈는 자유로이 쓸 수 있는 것만 담습니다. 다만 출처를
         밝혀야 하는 것이 섞여 있어 image_credit 을 반드시 적습니다. */
    rights:      'public',
    holder:      (b.colLabel && b.colLabel.value) || null,
    holder_dept: null,
    accession:   (b.inv && b.inv.value) || null,
    link_source: 'https://www.wikidata.org/wiki/' + wq,
    hidden:      false
  };
  w.quality = quality(w);
  if (w.quality < 4) return null;
  return w;
}

async function upsert(rows) {
  if (!rows.length) return { ok: 0, msg: '' };
  const r = await fetch(SB_URL + '/rest/v1/artworks?on_conflict=wikidata_id', {
    method: 'POST',
    headers: {
      apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      /* ★ merge 가 아니라 <b>ignore</b> 입니다. 이미 있는 것은
         덮어쓰지 않고 지나갑니다 — 위 loadExisting 주석 참조. */
    Prefer: 'resolution=ignore-duplicates,return=minimal'
    },
    body: JSON.stringify(rows)
  });
  if (!r.ok) {
    const t = (await r.text()).slice(0, 300);
    /* ★ 42P10 — artworks.wikidata_id 에 고유 인덱스가 없습니다.
         sql/link-11-B-apply.sql 을 먼저 돌려야 합니다. */
    if (t.includes('42P10')) {
      return { ok: 0, msg: '★ artworks.wikidata_id 에 고유 인덱스가 없습니다. '
                         + 'sql/link-11-B-apply.sql 을 먼저 돌리십시오. (' + t + ')' };
    }
    return { ok: 0, msg: r.status + ' ' + t };
  }
  return { ok: rows.length, msg: '' };
}

/* ══ 커먼즈 분류 엿보기 ═══════════════════════════════════════════
   ★★ 왜 이것이 필요한가
     위키데이터에는 <b>항목</b>이 있어야 찾아집니다. 정선의 그림이
     수백 점 전하는데 위키데이터 항목은 서너 개뿐입니다.
     그래서 P170 을 아무리 잘 물어도 45점밖에 안 나왔습니다.

     그런데 <b>커먼즈에는 파일이 잔뜩 있습니다.</b> 항목이 없어도
     파일은 있습니다. Category:Jeong Seon 안에 정선 그림이
     수십 장씩 들어 있습니다.

   ★ 다만 분류에는 <b>아무거나 다 들어옵니다</b> — 그림뿐 아니라
     무덤 사진, 기념우표, 전시 포스터, 책 표지, 서명 조각까지.
     거르는 규칙이 있어야 하는데, 그 규칙은 <b>실물을 보고</b>
     짜야 합니다. 짐작으로 낱말을 박으면 오늘 김관호를 잘못 감춘
     일이 되풀이됩니다.

   ▶ 그래서 이 모드는 <b>거르지 않고 있는 그대로</b> 보여 줍니다.
     보고 나서 규칙을 씁니다.
   ══════════════════════════════════════════════════════════════ */
const COMMONS = 'https://commons.wikimedia.org/w/api.php';

/* 작가마다 커먼즈 분류 이름 (위키데이터 P373) */
async function commonsCats(qids) {
  const out = new Map();
  for (let i = 0; i < qids.length; i += PACK) {
    const vals = qids.slice(i, i + PACK).map((q) => 'wd:' + q).join(' ');
    const q = `SELECT ?artist ?cat WHERE { VALUES ?artist { ${vals} } ?artist wdt:P373 ?cat . }`;
    let rows = [];
    try { rows = await ask(q); } catch (e) { continue; }
    for (const b of rows) {
      const a = qid(b.artist && b.artist.value);
      const c = b.cat && b.cat.value;
      if (a && c) out.set(a, c);
    }
  }
  return out;
}

/* 분류에 파일이 몇 개인가 — categoryinfo 로 한 번에 50개씩 셉니다 */
async function catCounts(cats) {
  const out = new Map();
  for (let i = 0; i < cats.length; i += 50) {
    const part = cats.slice(i, i + 50);
    const url = COMMONS + '?action=query&format=json&formatversion=2&prop=categoryinfo'
              + '&titles=' + encodeURIComponent(part.map((c) => 'Category:' + c).join('|'));
    let j = null;
    try { j = await getJSON(url); } catch (e) { continue; }
    for (const p of (j && j.query && j.query.pages) || []) {
      const nm = String(p.title || '').replace(/^Category:/, '');
      out.set(nm, (p.categoryinfo && p.categoryinfo.files) || 0);
    }
  }
  return out;
}

/* 분류 안의 파일 목록 — 있는 그대로 */
async function catFiles(cat, n) {
  const url = COMMONS + '?action=query&format=json&formatversion=2'
            + '&generator=categorymembers&gcmtype=file&gcmlimit=' + n
            + '&gcmtitle=' + encodeURIComponent('Category:' + cat)
            + '&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=800';
  let j = null;
  try { j = await getJSON(url); } catch (e) { return []; }
  return ((j && j.query && j.query.pages) || []).map((p) => {
    const ii = (p.imageinfo || [])[0] || {};
    const ex = ii.extmetadata || {};
    const g = (k) => (ex[k] && String(ex[k].value || '').replace(/<[^>]*>/g, '').trim()) || '';
    return {
      title: String(p.title || '').replace(/^File:/, ''),
      mime:  ii.mime || '',
      w: ii.width || 0, h: ii.height || 0,
      license: g('LicenseShortName'),
      object:  g('ObjectName'),
      date:    g('DateTimeOriginal').slice(0, 40),
      desc:    g('ImageDescription').slice(0, 60)
    };
  });
}

async function catPeek(artists) {
  console.log('\n══ 커먼즈 분류 엿보기 — 거르지 않고 있는 그대로 ══\n');

  const cats = await commonsCats(artists.map((a) => a.wikidata_id));
  console.log(`  커먼즈 분류가 있는 작가 ${cats.size}명 / ${artists.length}명\n`);
  if (!cats.size) return;

  const names = [...cats.values()];
  const counts = await catCounts(names);

  const rows = artists
    .filter((a) => cats.has(a.wikidata_id))
    .map((a) => ({ ko: a.name_ko || a.name_en, cat: cats.get(a.wikidata_id),
                   n: counts.get(cats.get(a.wikidata_id)) || 0 }))
    .sort((x, y) => y.n - x.n);

  const total = rows.reduce((s, r) => s + r.n, 0);
  console.log(`  분류 안 파일 모두 ${total}개 (거르기 전)\n`);
  console.log('  파일 많은 작가 서른');
  for (const r of rows.slice(0, 30)) {
    console.log(`    ${String(r.ko).padEnd(14)} ${String(r.n).padStart(5)}개   Category:${r.cat}`);
  }

  /* ★ 세 사람만 <b>실제 파일 이름</b>을 봅니다. 여기서 무엇을
       걸러야 할지가 드러납니다. */
  const pick = rows.filter((r) => r.n > 0).slice(0, 3);
  for (const r of pick) {
    console.log(`\n  ── ${r.ko} · Category:${r.cat} · ${r.n}개 가운데 스물 ──`);
    const fs = await catFiles(r.cat, 20);
    for (const f of fs) {
      console.log(`    ${f.title}`);
      console.log(`      ${f.mime} ${f.w}x${f.h} · ${f.license}`
                + (f.object ? ` · 이름:${f.object}` : '')
                + (f.date ? ` · 연도:${f.date}` : ''));
      if (f.desc) console.log(`      설명: ${f.desc}`);
    }
  }
  console.log('\n  ★ 위 목록을 보고 거르는 규칙을 짭니다. 지금은 담지 않습니다.');
}

/* ══ 돌리기 ══════════════════════════════════════════════════════ */
(async () => {
  console.log('▶ 작품 수집 (커먼즈 · 우리 작가에게서 출발)'
    + (PEEK ? ' · 엿보기 — 담지 않습니다' : (DRY ? ' · 담지 않고 세어만 봅니다' : '')));

  const artists = await loadArtists();
  console.log(`  위키데이터 번호가 있는 작가 ${artists.length}명\n`);
  if (!artists.length) {
    console.log('  ★ 번호가 있는 작가가 없습니다. 작가 수집을 먼저 돌리십시오.');
    return;
  }

  if (CATPEEK) { await catPeek(artists); return; }

  const have = await loadExisting();
  console.log(`  이미 담긴 작품 번호 ${have.size}개 (이것들은 건너뜁니다)\n`);

  const byQid = new Map(artists.map((a) => [a.wikidata_id, a]));
  const qids  = artists.map((a) => a.wikidata_id);

  const seen = new Map();      /* 작품번호 → 담을 것 (P170 과 P800 이 겹칩니다) */
  const perArtist = new Map(); /* 작가별 몇 점인가 — 엿보기에서 보여 줍니다 */
  let asked = 0, rawP170 = 0, rawP800 = 0, thin = 0, dup = 0;

  for (const prop of ['P170', 'P800']) {
    for (let i = 0; i < qids.length; i += PACK) {
      const part = qids.slice(i, i + PACK);
      let rows = [];
      try { rows = await ask(query(part, prop)); asked++; }
      catch (e) {
        if (isStop(e)) { console.log('  ■ 멈춥니다 — ' + stopReason(e)); break; }
        console.log(`  (${prop} ${i}~ 건너뜀 — ${e.message})`);
        continue;
      }

      if (prop === 'P170') rawP170 += rows.length; else rawP800 += rows.length;

      for (const b of rows) {
        const w = build(b, byQid);
        if (!w) { thin++; continue; }
        /* ★ 이미 담긴 것(클리블랜드 등)은 건너뜁니다 — 덮어쓰지 않습니다. */
        if (have.has(w.wikidata_id)) { dup++; continue; }
        /* ★ 같은 작품이 P170 과 P800 양쪽에 걸립니다. 먼저 온 것을 둡니다. */
        if (seen.has(w.wikidata_id)) continue;
        seen.set(w.wikidata_id, w);
        perArtist.set(w.artist_name, (perArtist.get(w.artist_name) || 0) + 1);
      }
      console.log(`  ${prop} · 작가 ${Math.min(i + PACK, qids.length)}/${qids.length}`
                + ` · 지금까지 ${seen.size}점`);
    }
  }

  const all = [...seen.values()];
  console.log('\n──────────────────────────────');
  console.log(`  물어본 횟수        ${asked}`);
  console.log(`  P170(그린 이)로    ${rawP170}줄`);
  console.log(`  P800(대표작)으로   ${rawP800}줄`);
  console.log(`  얇아서 뺀 것       ${thin}`);
  console.log(`  이미 있어 건너뜀   ${dup}`);
  console.log(`  담을 만한 작품     ${all.length}점 (작가와 <b>모두 이어짐</b>)`);
  console.log(`  작품이 있는 작가   ${perArtist.size}명`);

  const top = [...perArtist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  if (top.length) {
    console.log('\n  작품 많은 작가');
    for (const [n, c] of top) console.log(`    ${String(n).padEnd(16)} ${String(c).padStart(4)}점`);
  }

  if (PEEK) {
    console.log('\n  보기 열 점');
    for (const w of all.slice(0, 10)) {
      console.log(`    ${String(w.artist_name).padEnd(12)} 《${w.title}》`
                + ` ${w.year_text || ''} ${w.holder || ''}`);
      console.log(`      ${w.image_small}`);
    }
    console.log('\n  (엿보기라 담지 않았습니다)');
    return;
  }

  if (DRY) { console.log('\n  (세어만 봤습니다)'); return; }

  let put = 0;
  const errs = [];
  const CHUNK = 200;
  for (let i = 0; i < all.length && put < LIMIT; i += CHUNK) {
    const res = await upsert(all.slice(i, i + CHUNK));
    if (res.msg) errs.push(res.msg); else put += res.ok;
    console.log(`  담는 중 ${put}/${all.length}`);
  }
  console.log(`\n  실제로 담음        ${put}`);
  if (errs.length) {
    console.log(`  ★ 문제 ${errs.length}건`);
    errs.slice(0, 5).forEach((m) => console.log('     · ' + m));
  }
})();
