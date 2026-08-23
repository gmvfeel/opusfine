#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 작품 수집 (클리블랜드) · scripts/collect-works-cma.mjs
   ------------------------------------------------------------------
   쓰는 법
     node scripts/collect-works-cma.mjs --peek
     node scripts/collect-works-cma.mjs --dept "Korean Art" --limit 500 --dry
     node scripts/collect-works-cma.mjs --limit 3000
     node scripts/collect-works-cma.mjs --since 2026-08-01

   ★★ 왜 클리블랜드인가 — <b>도판이 실제로 뜹니다.</b>
     2026-08-23 확인용 화면(tools/cma-proof.html)에서 한국·중국·일본
     모두 「뜸 ✔」이었습니다. 시카고는 여기서 걸렸습니다.
     인증키도 없고 공표된 호출 한도도 없습니다.

   ★ 담는 범위 — <b>한국·중국·일본</b> 세 부서 (파트너 결정)
       한국   443
       중국 2,478
       일본 3,237   합 6,158점 (CC0 · 도판 있음 기준)
     인도·동남아(3,377)는 <b>일부러 뺐습니다</b>. 한국 미술을 읽는
     맥락 밖입니다. 넣으면 소장품 창고처럼 보입니다.
     넣고 싶으시면 --dept 로 부르면 됩니다.

   ★★ 저작권을 먼저 봅니다
     share_license_status 가 <b>CC0 일 때만</b> 도판을 담고
     rights=public 으로 적습니다. 아니면 도판을 싣지 않고
     rights=linked 로 두어 소장처로만 잇습니다.
     모르면 unknown — 화면에 안 나옵니다. 모를 때 안 싣는 쪽이 안전합니다.

   ★★ 작가와 잇기는 <b>이름이 꼭 같고 우리 DB 에 하나뿐일 때만</b> 합니다.
       하나뿐 → auto · 여럿 → ambig(사람이 판단) · 없음 → none
     이름만 같다고 이으면 동명이인이 뒤섞입니다.

   ★ 도판은 클리블랜드 CDN 주소를 그대로 링크합니다. 우리 저장소에
     담지 않습니다. (나중에 R2 로 옮길 때 image_url 만 바꾸면 됩니다)

   ★ 받는 대로 즉시 담습니다. 모아서 한 번에 담으면 중간에 끊겼을 때
     통째로 날아갑니다.

   ★ --peek — <b>담지 않고</b> 자료원이 주는 칸 이름과 값을 보여 줍니다.
     짐작해 박아 넣지 않기 위한 것입니다. 시카고는 이렇게 해서
     한 번에 맞췄습니다.
   ══════════════════════════════════════════════════════════════════ */

import { makeGetJSON, isStop, stopReason } from './lib/http.mjs';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

const API = 'https://openaccess-api.clevelandart.org/api/artworks';
const UA  = 'OpusfineBot/1.0 (https://opusfine.com; cser@wixon.co.kr)';
const HOLDER = 'The Cleveland Museum of Art';

/* 한 번에 최대 1000점까지 줍니다 (문서 확인) */
const PAGE = 500;

const getJSON = makeGetJSON({
  ua: UA, accept: 'application/json',
  tries: 5, maxWaitMs: 120 * 1000, budgetMs: 40 * 60 * 1000
});

/* ── 명령줄 ───────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? (argv[i + 1] || d) : d; };
const PEEK  = argv.includes('--peek');
const DRY   = argv.includes('--dry');
const LIMIT = Number(arg('limit', 8000));
const SINCE = arg('since', '');
const ONE   = arg('dept', '');

/* ★ 부서 이름은 <b>문서와 확인 화면에서 실제로 확인한 것</b>입니다.
     짐작한 이름을 쓰지 않습니다 — 「Indian and Southeast Asian Art」로
     물었을 때 0점이 나왔고, 「South East Asian」이 맞았습니다. */
const DEPTS = ONE ? [ONE] : ['Korean Art', 'Chinese Art', 'Japanese Art'];

if (!PEEK && (!SB_URL || !SB_KEY)) {
  console.error('★ SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

/* ── 우리 작가DB 를 미리 받아 둡니다 ──
   ★ 작품마다 물어보면 수천 번을 묻게 됩니다. 한 번에 받아
     이름으로 찾을 수 있게 담아 둡니다. */
async function loadArtists() {
  const byName = new Map();
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
  if (w.title_orig)  n += 1;
  return n;
}

/* ── 작가 이름 ──
   ★ 클리블랜드는 "Song Xu (Chinese, 1525-c. 1606)" 처럼 <b>괄호에
     국적과 생몰년</b>을 붙여 줍니다. 그대로 담으면 우리 작가DB 의
     이름과 영영 맞지 않습니다. 괄호를 떼어 냅니다.
   ★ 작가가 없는 것(도자·공예 등)은 culture 를 씁니다 —
     "Korea, Joseon dynasty" 같은 것입니다. 이것은 <b>이름이 아니므로
     작가와 잇지 않습니다.</b> */
function creatorOf(o) {
  const c = (o.creators || []).find((x) => x && x.description) || (o.creators || [])[0];
  if (!c) return { name: null, culture: (o.culture || [])[0] || null };
  const raw = String(c.description || '').trim();
  const name = raw.replace(/\s*\(.*$/, '').trim()
            || String(c.name_in_original_language || '').trim();
  return { name: name || null, culture: (o.culture || [])[0] || null };
}

/* ── 전시 이력 ──
   ★ 시카고는 글 한 덩이로 주었지만, 클리블랜드는 <b>날짜가 나뉘어</b>
     옵니다. 전시DB 를 만들 때 그대로 쓸 수 있게 담아 둡니다. */
function exhibitionText(o) {
  const ex = o.exhibitions || {};
  const one = (x) => {
    if (!x) return null;
    const t = String(x.title || x.description || '').replace(/<[^>]*>/g, '').trim();
    if (!t) return null;
    const d = x.opening_date ? String(x.opening_date).slice(0, 10) : '';
    return d ? `${t} (${d})` : t;
  };
  const all = [].concat(ex.current || [], ex.legacy || []).map(one).filter(Boolean);
  return all.length ? all.join('\n') : null;
}

/* ── 한 점 만들기 ── */
function build(o, byName) {
  if (!o || !o.id) return null;
  const title = String(o.title || '').trim();
  if (!title) return null;                   /* 이름 없는 것은 담지 않습니다 */

  const cc0 = o.share_license_status === 'CC0';
  const web = ((o.images || {}).web || {}).url || null;
  /* print(3400px)는 담지 않습니다 — 위 image_url 주석 참조 */

  const { name, culture } = creatorOf(o);
  const wd = ((o.external_resources || {}).wikidata || [])[0] || null;

  const w = {
    cma_id:      o.id,
    title,
    title_en:    title,
    title_orig:  String(o.title_in_original_language || '').trim() || null,
    year_text:   o.creation_date || null,
    year_from:   Number.isFinite(o.creation_date_earliest) ? o.creation_date_earliest : null,
    year_to:     Number.isFinite(o.creation_date_latest)   ? o.creation_date_latest   : null,
    medium:      o.technique || null,
    dimensions:  o.measurements || null,
    genre:       o.type || null,
    artist_name: name,
    /* ★ CC0 가 아니면 도판을 <b>싣지 않습니다.</b> 주소가 와도 안 씁니다.
       ★★ 상세 화면도 <b>web(900px)</b>을 씁니다. print 는 3400px 에
         5~10MB 라 손전화에서 한 장 여는 데 몇 초가 걸립니다. 우리
         상세 화면은 900px 이면 넉넉합니다.
       ★ 큰 것을 잃는 것이 아닙니다 — print 주소는 web 주소의
         <b>_web 을 _print 로 바꾸면</b> 그대로 나옵니다(규칙이 일정합니다).
         나중에 확대 보기를 만들 때 담아 둔 것 없이 만들 수 있습니다. */
    image_url:   cc0 ? web : null,
    image_small: cc0 ? web : null,
    image_credit: cc0 ? `${HOLDER} (CC0)` : null,
    rights:      cc0 ? 'public' : 'linked',
    holder:      HOLDER,
    holder_dept: o.department || null,
    accession:   o.accession_number || null,
    link_source: o.url || null,
    /* ★ 위키데이터 번호만 떼어 담습니다 — 주소째 담으면 나중에
         작가DB(wikidata_id)와 맞춰 볼 때 매번 잘라 내야 합니다. */
    wikidata_id: wd ? (String(wd).match(/Q\d+/) || [null])[0] : null,
    exhibition_history: exhibitionText(o),
    artist_id:   null,
    link_status: 'none',
    hidden:      false
  };

  /* ── 작가 잇기 — 이름이 꼭 같고 하나뿐일 때만 ──
     ★ culture(「Korea, Joseon dynasty」)는 작가가 아니므로
       artist_name 에 넣지 않습니다. 넣으면 「조선왕조」라는 이름의
       작가가 생깁니다. */
  if (w.artist_name) {
    const hit = byName.get(w.artist_name.toLowerCase());
    if (hit && hit.length === 1) { w.artist_id = hit[0]; w.link_status = 'auto'; }
    else if (hit && hit.length > 1) { w.link_status = 'ambig'; }
  } else if (culture) {
    /* 작자 미상 — 문화권만 적어 둡니다. 잇지 않습니다. */
    w.artist_name = null;
    w.genre = w.genre || null;
  }

  w.quality = quality(w);
  /* ★ 충실도 컷오프 — 도판도 이름도 없는 것은 담지 않습니다 */
  if (w.quality < 4) return null;
  return w;
}

async function upsert(rows) {
  if (!rows.length) return { ok: 0, msg: '' };
  const r = await fetch(SB_URL + '/rest/v1/artworks?on_conflict=cma_id', {
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
function pageUrl(dept, skip, limit) {
  let u = API + '?department=' + encodeURIComponent(dept)
        + '&has_image=1&limit=' + limit + '&skip=' + skip;
  /* ★ cc0 는 값이 없는 필터입니다 (문서 확인) */
  u += '&cc0';
  if (SINCE) u += '&updated_since=' + encodeURIComponent(SINCE);
  return u;
}

/* ══ 엿보기 ══════════════════════════════════════════════════════
   ★ 담지 않습니다. 자료원이 <b>실제로 주는 것</b>만 보여 줍니다. */
async function peek() {
  console.log('▶ 엿보기 — 담지 않습니다\n');
  for (const d of ['Korean Art', 'Chinese Art', 'Japanese Art',
                   'Indian and South East Asian Art']) {
    let j = null;
    try { j = await getJSON(pageUrl(d, 0, 1)); }
    catch (e) { console.log(`  ${d.padEnd(34)} ★ 못 받음 — ${e.message}`); continue; }
    const n = (j && j.info && j.info.total) || 0;
    console.log(`  ${d.padEnd(34)} ${String(n).padStart(6)}점`);
  }

  console.log('\n▶ 한국 소장품 한 점의 칸과 값\n');
  const j = await getJSON(pageUrl('Korean Art', 0, 1));
  const o = (j.data || [])[0];
  if (!o) { console.log('  (없습니다)'); return; }

  const show = (k, v) => console.log('  ' + String(k).padEnd(30) +
    (v == null || v === '' ? '(없음)' : String(v).replace(/\s+/g, ' ').slice(0, 90)));
  for (const k of ['id','accession_number','share_license_status','title',
                   'title_in_original_language','creation_date','creation_date_earliest',
                   'creation_date_latest','technique','measurements','department',
                   'collection','type','url']) show(k, o[k]);
  show('creators[0].description', ((o.creators || [])[0] || {}).description);
  show('culture[0]',              (o.culture || [])[0]);
  show('images.web.url',          ((o.images || {}).web || {}).url);
  show('images.print.url',        ((o.images || {}).print || {}).url);
  show('external_resources.wikidata', ((o.external_resources || {}).wikidata || [])[0]);
  show('exhibitions 수', ((o.exhibitions || {}).current || []).length
                       + ((o.exhibitions || {}).legacy  || []).length);

  console.log('\n▶ 우리 표에 들어갈 모습\n');
  const w = build(o, new Map());
  if (!w) { console.log('  (충실도가 모자라 담지 않습니다)'); return; }
  for (const [k, v] of Object.entries(w)) show(k, v);
}

/* ══ 돌리기 ══════════════════════════════════════════════════════ */
(async () => {
  if (PEEK) { await peek(); return; }

  console.log(`▶ 작품 수집 (클리블랜드) · ${DEPTS.join(' / ')}`
    + ` · limit=${LIMIT}${SINCE ? ' · since=' + SINCE : ''}${DRY ? ' · 담지 않고 세어만 봅니다' : ''}`);

  console.log('  우리 작가DB 를 받는 중…');
  let byName = new Map();
  try { byName = await loadArtists(); }
  catch (e) { console.log('  (작가DB 를 못 받아 잇기는 건너뜁니다)'); }
  console.log(`  이름 ${byName.size}개를 담아 두었습니다\n`);

  let got = 0, kept = 0, thin = 0, put = 0;
  let pub = 0, linked = 0, auto = 0, ambig = 0;
  const errs = [];
  let stopped = false;

  for (const dept of DEPTS) {
    if (stopped) break;
    let skip = 0, total = null, mine = 0;

    for (;;) {
      if (mine >= LIMIT) break;
      const take = Math.min(PAGE, LIMIT - mine);

      let j = null;
      try { j = await getJSON(pageUrl(dept, skip, take)); }
      catch (e) {
        if (isStop(e)) { console.log('  ■ 멈춥니다 — ' + stopReason(e)); stopped = true; break; }
        errs.push(`${dept} skip=${skip}: ${e.message}`); break;
      }

      if (total == null) {
        total = (j.info && j.info.total) || 0;
        console.log(`  【${dept}】 모두 ${total}점`);
      }

      const data = j.data || [];
      /* ★ 0줄일 때 끝냅니다. 「요청보다 적으니 끝」이 아닙니다 —
           마지막 쪽이 짧게 올 수 있습니다. */
      if (!data.length) break;

      const rows = [];
      for (const o of data) {
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

      skip += data.length;
      mine += data.length;
      console.log(`    ${Math.min(skip, total || skip)}/${total} · 담을 것 ${kept}${DRY ? '' : ` · 담음 ${put}`}`);
      if (total && skip >= total) break;
    }
  }

  console.log('──────────────────────────────');
  console.log(`  받은 작품         ${got}`);
  console.log(`  담을 만한 작품    ${kept}`);
  console.log(`  얇아서 뺀 작품    ${thin}`);
  console.log(`  도판 실을 수 있음 ${pub} · 저작권 있어 링크만 ${linked}`);
  console.log(`  작가와 이어짐     ${auto} · 후보 여럿(사람이 볼 것) ${ambig}`);
  if (!DRY) console.log(`  실제로 담음       ${put}`);
  if (errs.length) {
    console.log(`  ★ 문제 ${errs.length}건`);
    errs.slice(0, 5).forEach((m) => console.log('     · ' + m));
  }
})();
