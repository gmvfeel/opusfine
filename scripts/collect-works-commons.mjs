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
const CAT     = argv.includes('--cat');
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
      SB_URL + '/rest/v1/artists?select=id,name_ko,name_en,wikidata_id,birth_year,death_year'
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

/* ── 그림다움 점수 ────────────────────────────────────────────
   ★★ 2026-08-23 · 분류 실물을 보고 짰습니다 (짐작이 아닙니다).
     정선 20개는 전부 그림이었고, 김홍도는 안산 풍경 사진 2장이,
     나혜석은 스물 가운데 <b>열넷</b>이 인물 사진·잡지 광고·편지였습니다.

   ★ 낱말 하나로 자르지 않습니다. <b>여러 신호를 더합니다.</b>
     낱말 하나로 자르면 그 낱말이 없는 그림이 통째로 빠집니다 —
     오늘 김관호를 그렇게 잘못 감췄습니다.

   ★ 4점 이상만 담습니다. <b>어중간한 것은 안 담는 쪽</b>을 고릅니다.
     빠뜨린 그림은 나중에 더하면 되지만, 잘못 담긴 사진은
     「정선의 작품」이라는 거짓말로 화면에 남습니다.

   ★ 점수는 --catpeek 에서 <b>파일마다 보입니다.</b>
     「이건 그림인데 왜 빠졌지」를 파트너가 눈으로 볼 수 있어야 합니다. */

/* 그림이라고 말해 주는 낱말 */
const SAY_ART = /painting|paintings|dipinto|peinture|gem(ä|ae)lde|album\s*(leaf|of)|hanging scroll|handscroll|folding screen|ink and |ink on |colou?r on |watercolou?r|oil on|calligraphy|drawn by|painted by|self.?portrait|portrait of|landscape|자화상|초상|필\s|그림|수묵|담채|채색|비단에|종이에|화첩|병풍|족자|서화|산수/i;
/* 그림 제목에 흔한 글자 — 圖(도) · 帖(첩) · 屛(병) */
const SAY_TITLE = /[圖図帖屛屏軸卷巻]|jeondo|jesaekdo|chongramdo|nongjeopdo|byeong\b/i;
/* 그림이 아니라고 말해 주는 낱말 */
const SAY_NOT = /photograph|사진|letter|편지|광고|advertisement|magazine|잡지|poster|포스터|grave|tomb|무덤|stamp|우표|banknote|지폐|monument|기념비|statue|동상|exhibition view|전시\s*전경|signature|서명|book cover|표지|map\b|지도|logo|screenshot|plaque|현판|festival|축제|family|가족|married|wedding|결혼|혼례|lecture|강연|homage|오마주/i;

/* ★★ 「…of 작가이름」 — <b>그 사람을 그리거나 찍은 것</b>입니다.
     "Portrait of Kim Hong-do" 는 김홍도의 <b>작품이 아니라</b>
     김홍도를 그린 남의 그림입니다. 앞 판이 이것을 못 가려
     단원 초상을 김홍도 작품으로 담았습니다. */
const SAY_OF = /(portrait|painting|photo|picture|image)\s+of\s+([^.;]{0,50})/gi;
/* ★★ 「사람 + 연도」 꼴 — "Na Hye-sok in 1926" · "Na Hye-sok, 1928"
     사진 설명의 전형입니다. */
const SAY_SHOT = /\bin\s+(1[89]|20)\d\d\b|,\s*(c\.\s*)?(1[89]|20)\d\d\b|\bin\s+[A-Z][a-z]+\s*$/;

function yearIn(text) {
  const t = String(text || '');
  let m = t.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  if (m) return Number(m[1]);
  /* "late 18th century" · "18thC" → 그 세기의 한가운데로 봅니다 */
  m = t.match(/\b(1[0-9]|20)\s*th\s*(century|C)\b/i);
  if (m) return (Number(m[1]) - 1) * 100 + 50;
  return null;
}

/* ★★ 이름 견주기 — <b>닿소리만 남겨</b> 견줍니다.
     로마자 표기가 사람마다 다릅니다.
       Na Hye-sok / Na Hyeseok / Na Hye-seok  → 모두 <b>nhysk</b>
     앞 판은 글자 그대로 견줘서 「Peonies … by Na Hyeseok」을 놓쳤습니다. */
function bones(s2) {
  return String(s2 || '').toLowerCase()
    .replace(/[^a-z가-힣]/g, '')
    .replace(/[aeiou]/g, '');
}

function artScore(f, artist) {
  let sc = 0;
  const text = [f.title, f.object, f.desc].filter(Boolean).join(' ');

  /* ★ 그 작가의 분류 안에 있다는 것만으로 <b>조금</b> 줍니다.
       분류가 그 작가 것이니 아주 무관하진 않습니다. 다만 조금만 —
       사진도 같은 분류에 들어 있습니다. */
  sc += 2;

  const isArt = SAY_ART.test(text);
  if (isArt)                sc += 5;
  if (SAY_TITLE.test(text)) sc += 2;
  if (SAY_NOT.test(text))   sc -= 6;


  /* ★★ 가장 센 신호 — <b>「by 작가이름」</b> */
  const bEn = bones(artist.name_en), bKo = bones(artist.name_ko);
  const bTx = bones(text);
  const named = (bEn.length > 3 && bTx.includes(bEn))
             || (bKo.length > 1 && bTx.includes(bKo));
  const isNot = SAY_NOT.test(text);
  /* ★ 「…이 아니다」 낱말이 걸렸으면 <b>by 덤을 주지 않습니다.</b>
       「나혜석의 가족사진」의 <b>의</b> 를 「그렸다」로 잘못 읽었습니다. */
  if (named && !isNot && /\bby\b|\bdi\b|의\s|필\s/i.test(text)) sc += 5;
  else if (named) sc += 1;

  /* ★ 만든 해가 작가가 살아 있던 때 안에 들면 그림 쪽입니다.
       연도를 <b>글 전체</b>에서 찾습니다 — date 칸만 보면
       설명에 적힌 "c. 1788" 을 놓칩니다. */
  const yr = yearIn(f.date) || yearIn(text);
  const b = artist.birth_year, d = artist.death_year;
  if (yr && b && yr >= b - 5 && yr <= (d || b + 100) + 5) sc += 3;

  /* ★★ 「…of 그 작가」 — 그 사람을 <b>그린/찍은</b> 것입니다.
     ★ 「of」 <b>바로 뒤에</b> 그 작가 이름이 오는지를 봅니다.
       그냥 「of 가 있고 어딘가에 이름이 있다」로 보면
       "Ink painting of two immortals … by Kim Hongdo" 처럼
       <b>진짜 작품</b>까지 깎입니다. 앞 판이 그랬습니다.
     ★ "Self-Portrait by …" 는 본인 작품이므로 뺍니다. */
  SAY_OF.lastIndex = 0;
  let ofHit = false, m2;
  while ((m2 = SAY_OF.exec(text)) !== null) {
    const after = bones(m2[2]);
    if ((bEn.length > 3 && after.includes(bEn)) || (bKo.length > 1 && after.includes(bKo))) {
      ofHit = true; break;
    }
  }
  if (ofHit && !/\bby\b|self.?portrait|자화상/i.test(text)) sc -= 9;

  /* ★ 「이름 + 연도」 꼴은 사진 설명입니다 — 그림 낌새가 없을 때만. */
  if (!isArt && named && SAY_SHOT.test(text)) sc -= 6;

  /* ★★ 최근 날짜 + 자유 라이선스 = 누가 찍어 올린 것.
       그런데 <b>그림을 찍어 올린 것</b>도 많습니다. 그림 낌새가
       없을 때만 깎습니다 — 앞 판은 무조건 깎아 여러 점을 놓쳤습니다. */
  const shot = yearIn(f.date);
  if (!isArt && !named && shot && shot >= 2000 && /CC /i.test(f.license || '')) sc -= 4;

  /* ★ 아주 작은 것은 섬네일 사진이 많습니다. 그림 낌새가 있으면
       깎지 않습니다 — 김홍도 《계회도》가 232x567 입니다. */
  const long = Math.max(f.w || 0, f.h || 0);
  if (!isArt && !named && long && long < 400) sc -= 3;

  return sc;
}

/* ── 저작권 관문 ──────────────────────────────────────────────
   ★★ 2026-08-23 · 서도호 분류에서 드러났습니다 (파트너 확인).
     미국 정부가 찍은 사진이라 <b>사진은</b> 퍼블릭 도메인입니다.
     그러나 <b>작품 자체의 저작권은 살아 있습니다.</b> 사진의 권리와
     작품의 권리는 <b>다릅니다.</b>

   ▶ 죽은 지 <b>70년</b>이 안 된 작가는 통째로 건너뜁니다.
     살아 있는 작가는 말할 것도 없습니다.
     ★ 이것은 점수로 재는 것이 아닙니다. <b>관문</b>입니다.
       아무리 그림다워도 권리가 없으면 못 싣습니다.

   ★ 엄격하게 갑니다. 남의 작품을 함부로 실으면 점 하나가 아니라
     <b>아카이브 전체의 믿음</b>이 무너집니다.
   ★ 몰년을 모르는 사람도 건너뜁니다 — 모를 때 안 싣는 쪽입니다.
     조선 화가는 몰년이 다 있으므로 잃는 것이 거의 없습니다. */
const PD_YEARS = 70;

function rightsGate(artist) {
  const now = new Date().getFullYear();
  const d = artist.death_year;
  if (d && (now - d) > PD_YEARS) return { ok: true, why: '' };
  if (d) return { ok: false, why: `몰년 ${d} — 아직 ${PD_YEARS}년이 안 됐습니다` };
  /* 몰년이 없어도 태어난 지 오래면 풀린 것으로 봅니다 */
  const b = artist.birth_year;
  if (b && (now - b) > (PD_YEARS + 100)) return { ok: true, why: '' };
  return { ok: false, why: b ? `몰년 모름 (${b}년생)` : '생몰년 모름' };
}

/* ── 같은 것 여러 장 거르기 ───────────────────────────────────
   ★★ 서도호 스물이 <b>한 작품을 여러 각도에서 찍은 것</b>이었습니다
     (LCCN2013634555 … 574). 그대로 담으면 목록이 똑같은 것으로
     도배됩니다.
   ★ 파일 이름에서 <b>번호와 잔글씨를 걷어 낸 뼈대</b>가 같으면
     한 장만 남깁니다. 가장 큰 것을 남깁니다 — 같은 작품이라면
     큰 쪽이 낫습니다. */
function skeleton(f) {
  return String(f.title || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/lccn\d+/g, '')
    .replace(/dsc\d+/g, '')
    .replace(/[-_\s]*\(?\d{1,6}\)?$/g, '')
    .replace(/[^a-z가-힣]/g, '')
    .slice(0, 40);
}

function dedupe(list) {
  const best = new Map();
  for (const f of list) {
    const k = skeleton(f) || String(f.title);
    const cur = best.get(k);
    const size = (f.w || 0) * (f.h || 0);
    if (!cur || size > (cur.w || 0) * (cur.h || 0)) best.set(k, f);
  }
  return [...best.values()];
}

/* ★ 분류 이름이 <b>작가 분류가 아닌 것</b>을 걸러 냅니다.
     「Category:Files by KYJOON」은 어떤 사용자가 올린 파일 모음입니다.
     위키데이터 P373 이 잘못 걸린 것이고, 그 안에는 그 작가의 작품이
     없습니다. */
const BAD_CAT = /^(files by|media by|images by|photographs by|uploads by|user:)/i;

async function catPeek(artists) {
  console.log('\n══ 커먼즈 분류 엿보기 — 거르지 않고 있는 그대로 ══\n');

  const cats = await commonsCats(artists.map((a) => a.wikidata_id));
  console.log(`  커먼즈 분류가 있는 작가 ${cats.size}명 / ${artists.length}명\n`);
  if (!cats.size) return;

  const names = [...cats.values()];
  const counts = await catCounts(names);

  /* ★ 저작권이 안 풀린 작가는 <b>목록에서부터</b> 뺍니다.
       그림다움을 재기 전에 거르는 관문입니다. */
  let blocked = 0;
  const okArtists = artists.filter((a) => {
    if (!cats.has(a.wikidata_id)) return false;
    const g = rightsGate(a);
    if (!g.ok) { blocked++; return false; }
    return true;
  });
  console.log(`  저작권이 안 풀려 건너뛴 작가 ${blocked}명`
            + ` (죽은 지 ${PD_YEARS}년이 안 됐거나 몰년을 모름)\n`);

  const rows = okArtists
    .filter((a) => cats.has(a.wikidata_id))
    .map((a) => ({ a, ko: a.name_ko || a.name_en, cat: cats.get(a.wikidata_id),
                   n: counts.get(cats.get(a.wikidata_id)) || 0 }))
    .filter((r) => {
      if (BAD_CAT.test(r.cat)) {
        console.log(`  (건너뜀 · ${r.ko} — Category:${r.cat} 는 작가 분류가 아닙니다)`);
        return false;
      }
      return true;
    })
    .sort((x, y) => y.n - x.n);

  const total = rows.reduce((s, r) => s + r.n, 0);
  console.log(`  분류 안 파일 모두 ${total}개 (거르기 전)\n`);
  console.log('  파일 많은 작가 서른');
  for (const r of rows.slice(0, 30)) {
    console.log(`    ${String(r.ko).padEnd(14)} ${String(r.n).padStart(5)}개   Category:${r.cat}`);
  }

  /* ★ 세 사람만 <b>실제 파일 이름</b>을 봅니다. 여기서 무엇을
       걸러야 할지가 드러납니다. */
  /* ★ 점수를 <b>파일마다 찍어</b> 보여 줍니다. 「이건 그림인데
       왜 빠졌지」를 파트너가 눈으로 볼 수 있어야 합니다. */
  const pick = rows.filter((r) => r.n > 0).slice(0, 4);
  let keep = 0, drop = 0;
  for (const r of pick) {
    console.log(`\n  ── ${r.ko} · Category:${r.cat} · ${r.n}개 가운데 스물 ──`);
    const fs = dedupe(await catFiles(r.cat, 20));
    for (const f of fs) {
      const sc = artScore(f, r.a);
      const ok = sc >= 4;
      if (ok) keep++; else drop++;
      console.log(`    [${ok ? '담음' : '뺌 '} ${String(sc).padStart(3)}] ${f.title}`);
      console.log(`             ${f.w}x${f.h} · ${f.license}`
                + (f.date ? ` · 연도:${String(f.date).slice(0, 24)}` : ''));
      if (f.desc) console.log(`             ${f.desc}`);
    }
  }
  console.log(`\n  네 사람 여든 개 가운데 — 담을 것 ${keep} · 뺄 것 ${drop}`);
  console.log('  ★ 「담음/뺌」이 어긋난 것이 있으면 알려 주십시오. 점수를 고칩니다.');
  console.log('  ★ 지금은 담지 않았습니다.');
}

/* ══ 분류에서 거두기 ═════════════════════════════════════════════
   ★ catPeek 이 보여 준 것을 <b>그대로</b> 담습니다. 눈으로 본 것과
     담기는 것이 다르면 안 됩니다 — 같은 함수(artScore·dedupe·
     rightsGate)를 씁니다.
   ★ 커먼즈 파일에는 위키데이터 번호가 없습니다. 그래서
     <b>파일 이름</b>을 열쇠로 씁니다(commons_file).
     sql/link-12-B-apply.sql 을 먼저 돌려야 합니다. */
function fromFile(f, artist) {
  /* 이름 — ObjectName 이 있으면 그것을, 없으면 파일 이름에서 */
  let title = String(f.object || '').trim();
  if (!title || /^[A-Za-z0-9 ._-]{0,4}$/.test(title)) {
    title = String(f.title || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_]/g, ' ').trim();
  }
  /* ★ 커먼즈 이름표에 딸려 오는 잔글씨를 걷어 냅니다
       "Inwang jesaekdolabel QS:Lja,…" 처럼 옵니다. */
  title = title.replace(/label\s+QS:.*$/i, '').replace(/date\s+QS:.*$/i, '').trim();
  if (!title) return null;

  const yr = yearIn(f.date) || yearIn([f.title, f.object, f.desc].join(' '));
  const inLife = yr && artist.birth_year
              && yr >= artist.birth_year - 5
              && yr <= (artist.death_year || artist.birth_year + 100) + 5;

  const url = 'https://commons.wikimedia.org/wiki/Special:FilePath/'
            + encodeURIComponent(String(f.title).replace(/ /g, '_'));

  const w = {
    commons_file: f.title,
    title,
    title_en:    /[가-힣]/.test(title) ? null : title,
    year_text:   inLife ? String(yr) : null,
    year_from:   inLife ? yr : null,
    year_to:     inLife ? yr : null,
    medium:      null,
    dimensions:  null,
    genre:       null,
    artist_name: artist.name_ko || artist.name_en,
    artist_id:   artist.id,
    /* ★ 그 작가의 분류에서 나왔고 그림으로 판정된 것입니다.
         위키데이터가 「그렸다」고 한 것(P170)보다는 약한 근거라
         auto 가 아니라 <b>cat</b> 으로 적습니다. 나중에 골라
         다시 볼 수 있어야 합니다. */
    link_status: 'cat',
    image_url:   url + '?width=1200',
    image_small: url + '?width=800',
    image_credit: 'Wikimedia Commons' + (f.license ? ' · ' + f.license : ''),
    rights:      'public',
    holder:      null,
    link_source: 'https://commons.wikimedia.org/wiki/File:'
               + encodeURIComponent(String(f.title).replace(/ /g, '_')),
    hidden:      false
  };
  w.quality = quality(w);
  return w;
}

async function upsertFiles(rows) {
  if (!rows.length) return { ok: 0, msg: '' };
  const r = await fetch(SB_URL + '/rest/v1/artworks?on_conflict=commons_file', {
    method: 'POST',
    headers: {
      apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal'
    },
    body: JSON.stringify(rows)
  });
  if (!r.ok) {
    const t = (await r.text()).slice(0, 300);
    if (t.includes('42P10') || t.includes('commons_file')) {
      return { ok: 0, msg: '★ artworks.commons_file 칸이 없거나 고유 인덱스가 없습니다. '
                         + 'sql/link-12-B-apply.sql 을 먼저 돌리십시오. (' + t + ')' };
    }
    return { ok: 0, msg: r.status + ' ' + t };
  }
  return { ok: rows.length, msg: '' };
}

async function catHarvest(artists) {
  console.log('\n══ 커먼즈 분류에서 거두기 ══\n');

  const cats = await commonsCats(artists.map((a) => a.wikidata_id));
  const use = artists.filter((a) => cats.has(a.wikidata_id)
                                 && !BAD_CAT.test(cats.get(a.wikidata_id))
                                 && rightsGate(a).ok);
  console.log(`  분류가 있고 저작권이 풀린 작가 ${use.length}명\n`);
  if (!use.length) return;

  let got = 0, kept = 0, put = 0, dropped = 0, merged = 0;
  const errs = [];

  for (const a of use) {
    const cat = cats.get(a.wikidata_id);
    let fs = [];
    try { fs = await catFiles(cat, 200); }
    catch (e) { if (isStop(e)) { console.log('  ■ 멈춥니다'); break; } continue; }
    got += fs.length;

    const before = fs.length;
    fs = dedupe(fs);
    merged += before - fs.length;

    const rows = [];
    for (const f of fs) {
      /* ★ 그림 파일만 — pdf · svg · ogg 가 섞입니다 */
      if (f.mime && !/^image\/(jpeg|png|tiff?|webp)$/.test(f.mime)) { dropped++; continue; }
      if (artScore(f, a) < 4) { dropped++; continue; }
      const w = fromFile(f, a);
      if (!w) { dropped++; continue; }
      rows.push(w);
    }
    kept += rows.length;

    if (!DRY && rows.length) {
      const res = await upsertFiles(rows);
      if (res.msg) { errs.push(res.msg); if (errs.length > 3) break; }
      else put += res.ok;
    }
    if (rows.length) {
      console.log(`    ${String(a.name_ko || a.name_en).padEnd(14)}`
                + ` ${String(rows.length).padStart(3)}점  (분류 ${before}개 중)`);
    }
  }

  console.log('\n──────────────────────────────');
  console.log(`  분류에서 본 파일    ${got}`);
  console.log(`  같은 것이라 합침    ${merged}`);
  console.log(`  그림이 아니라 뺌    ${dropped}`);
  console.log(`  담을 만한 작품      ${kept}점 (작가와 모두 이어짐)`);
  if (!DRY) console.log(`  실제로 담음         ${put}`);
  if (errs.length) {
    console.log(`  ★ 문제 ${errs.length}건`);
    errs.slice(0, 3).forEach((m) => console.log('     · ' + m));
  }
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
  if (CAT)     { await catHarvest(artists); return; }

  const have = await loadExisting();
  console.log(`  이미 담긴 작품 번호 ${have.size}개 (이것들은 건너뜁니다)\n`);

  /* ★★ 저작권 관문 — 그림다움을 재기 <b>전에</b> 거릅니다.
       죽은 지 70년이 안 된 작가의 작품은 권리가 살아 있습니다.
       위키데이터에서 받은 것도 마찬가지입니다. */
  const okArtists = artists.filter((a) => rightsGate(a).ok);
  console.log(`  저작권이 풀린 작가 ${okArtists.length}명`
            + ` (안 풀려 건너뜀 ${artists.length - okArtists.length}명)\n`);

  const byQid = new Map(okArtists.map((a) => [a.wikidata_id, a]));
  const qids  = okArtists.map((a) => a.wikidata_id);

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
