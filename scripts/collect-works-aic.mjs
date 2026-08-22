#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 작품 수집 (시카고 미술관) · scripts/collect-works-aic.mjs
   ------------------------------------------------------------------
   쓰는 법
     node scripts/collect-works-aic.mjs --q "Korea" --limit 300
     node scripts/collect-works-aic.mjs --all --limit 1000     (검색 없이 훑기)
     node scripts/collect-works-aic.mjs --q "Korea" --dry
     node scripts/collect-works-aic.mjs --peek                 (칸 이름만 봅니다)

   ★ 시카고가 메트보다 나은 점
     · 한 번에 <b>100점씩</b> 줍니다 (메트는 한 점씩 물어야 합니다)
     · 훨씬 덜 막힙니다
     · <b>전시 이력</b>을 함께 담고 있습니다 — 전시DB 의 뿌리가 됩니다

   ★★ <b>칸 이름을 짐작하지 않습니다.</b>
     fields 를 지정하지 않고 통째로 받아, 있는 칸을 골라 씁니다.
     --peek 을 붙이면 자료원이 실제로 주는 칸 이름을 찍어 봅니다.
     짐작해 적어 두면 이름이 다를 때 <b>조용히 빈 값</b>이 됩니다.

   ★ 저작권 — is_public_domain 이 참일 때만 도판을 담습니다.
     아니면 도판 없이 소장처로만 잇습니다(linked).

   ★ 도판은 시카고 IIIF 원본 주소를 링크합니다. 우리 저장소에 담지
     않습니다.
   ══════════════════════════════════════════════════════════════════ */

import { makeGetJSON, isStop, stopReason } from './lib/http.mjs';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('★ SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

const API = 'https://api.artic.edu/api/v1';
const UA  = 'OpusfineBot/1.0 (https://opusfine.com; cser@wixon.co.kr)';

const getJSON = makeGetJSON({
  ua: UA, accept: 'application/json',
  tries: 5, maxWaitMs: 120 * 1000, budgetMs: 40 * 60 * 1000
});

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? (argv[i + 1] || d) : d; };
const Q     = arg('q', '');
const LIMIT = Number(arg('limit', 300));
const ALL   = argv.includes('--all');
const DRY   = argv.includes('--dry');
const PEEK  = argv.includes('--peek');

/* ── 여러 이름 가운데 <b>있는 것</b>을 씁니다 ──
   자료원이 칸 이름을 바꾸거나 제가 잘못 알고 있어도 견딥니다. */
function pick(o, names) {
  for (const n of names) {
    const v = o[n];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}
function num(v) { return Number.isFinite(Number(v)) ? Number(v) : null; }

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
    if (!rows.length) break;               /* ★ 0줄일 때 끝냅니다 */
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
  if (w.exhibition_history) n += 2;   /* 전시 이력은 값진 자료입니다 */
  return n;
}

function build(o, iiif, byName) {
  const title = String(pick(o, ['title']) || '').trim();
  if (!title) return null;

  const pub = o.is_public_domain === true;
  const imgId = pick(o, ['image_id']);
  const big   = (pub && imgId && iiif) ? `${iiif}/${imgId}/full/1686,/0/default.jpg` : null;
  const small = (pub && imgId && iiif) ? `${iiif}/${imgId}/full/843,/0/default.jpg`  : null;

  const w = {
    aic_id:      num(pick(o, ['id'])),
    title,
    title_en:    title,
    year_text:   pick(o, ['date_display']),
    year_from:   num(pick(o, ['date_start'])),
    year_to:     num(pick(o, ['date_end'])),
    medium:      pick(o, ['medium_display', 'medium']),
    dimensions:  pick(o, ['dimensions']),
    genre:       pick(o, ['classification_title', 'artwork_type_title', 'classification']),
    artist_name: (pick(o, ['artist_title', 'artist_display']) || '').toString().split('\n')[0].trim() || null,
    image_url:   big,
    image_small: small,
    image_credit: pub ? 'The Art Institute of Chicago (CC0)' : null,
    rights:      pub ? 'public' : 'linked',
    holder:      'The Art Institute of Chicago',
    holder_dept: pick(o, ['department_title', 'department']),
    accession:   pick(o, ['main_reference_number', 'accession_number']),
    link_source: o.id ? 'https://www.artic.edu/artworks/' + o.id : null,
    /* ★ 전시 이력을 <b>글 그대로</b> 담아 둡니다. 지금 안 받아 두면
         전시DB 를 만들 때 시카고를 다시 통째로 훑어야 합니다. */
    exhibition_history: pick(o, ['exhibition_history']),
    provenance:         pick(o, ['provenance_text', 'provenance']),
    credit_line:        pick(o, ['credit_line']),
    artist_id:   null,
    link_status: 'none',
    hidden:      false
  };
  if (!w.aic_id) return null;

  if (w.artist_name) {
    const hit = byName.get(w.artist_name.toLowerCase());
    if (hit && hit.length === 1) { w.artist_id = hit[0]; w.link_status = 'auto'; }
    else if (hit && hit.length > 1) { w.link_status = 'ambig'; }
  }

  w.quality = quality(w);
  if (w.quality < 4) return null;
  return w;
}

async function upsert(rows) {
  if (!rows.length) return { ok: 0, msg: '' };
  const r = await fetch(SB_URL + '/rest/v1/artworks?on_conflict=aic_id', {
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

/* ── 한 쪽 받기 ──
   ★ 검색과 목록은 길이 다릅니다.
     검색  /artworks/search?q=…   — 답에 자료가 얇게 옵니다
     목록  /artworks?page=…       — 자료가 통째로 옵니다
     그래서 검색은 <b>번호만</b> 받고 상세는 /artworks?ids= 로 묶어 받습니다. */
async function searchIds(q, need) {
  const ids = [];
  for (let page = 1; ids.length < need && page <= 20; page++) {
    const u = API + '/artworks/search?q=' + encodeURIComponent(q)
            + '&limit=100&page=' + page + '&fields=id';
    const j = await getJSON(u);
    const rows = (j && j.data) || [];
    if (!rows.length) break;               /* ★ 0줄일 때 끝냅니다 */
    rows.forEach((r) => { if (r && r.id) ids.push(r.id); });
    if (!j.pagination || page >= (j.pagination.total_pages || 1)) break;
  }
  return ids.slice(0, need);
}

async function byIds(ids) {
  const u = API + '/artworks?ids=' + ids.join(',') + '&limit=' + ids.length;
  const j = await getJSON(u);
  return { rows: (j && j.data) || [], iiif: j && j.config && j.config.iiif_url };
}

async function listPage(page) {
  const u = API + '/artworks?page=' + page + '&limit=100';
  const j = await getJSON(u);
  return { rows: (j && j.data) || [], iiif: j && j.config && j.config.iiif_url,
           total: j && j.pagination && j.pagination.total_pages };
}

/* ── 돌리기 ───────────────────────────────────────────────────── */
(async () => {
  /* ★ 칸 이름 엿보기 — 짐작하지 않으려는 장치입니다 */
  if (PEEK) {
    const { rows, iiif } = await listPage(1);
    if (!rows.length) { console.log('★ 아무것도 못 받았습니다.'); return; }
    console.log('iiif 주소:', iiif);
    console.log('한 점이 가진 칸 이름:');
    Object.keys(rows[0]).sort().forEach((k) => {
      const v = rows[0][k];
      const t = v === null ? 'null' : Array.isArray(v) ? `배열(${v.length})` : typeof v;
      console.log(`  ${k}  —  ${t}`);
    });
    console.log('\n첫 점 몇 가지:');
    ['id','title','artist_title','date_display','medium_display','dimensions',
     'classification_title','department_title','main_reference_number',
     'is_public_domain','image_id','exhibition_history'].forEach((k) => {
      const v = rows[0][k];
      console.log(`  ${k} = ` + (v === undefined ? '(없는 칸)' :
        String(v).slice(0, 90).replace(/\n/g, ' ⏎ ')));
    });
    return;
  }

  console.log(`▶ 작품 수집 (시카고) · ${ALL ? '검색 없이 훑기' : 'q="' + Q + '"'} · limit=${LIMIT}${DRY ? ' · 담지 않고 세어만 봅니다' : ''}`);

  console.log('  우리 작가DB 를 받는 중…');
  let byName = new Map();
  try { byName = await loadArtists(); } catch (e) { console.log('  (작가DB 를 못 받아 잇기는 건너뜁니다)'); }
  console.log(`  이름 ${byName.size}개를 담아 두었습니다`);

  let got = 0, kept = 0, thin = 0, put = 0, pub = 0, linked = 0, auto = 0, ambig = 0;
  const errs = [];
  let iiifUrl = null;

  async function handle(rows, iiif) {
    if (iiif) iiifUrl = iiif;
    const out = [];
    for (const o of rows) {
      if (!o) continue;
      got++;
      const w = build(o, iiifUrl, byName);
      if (!w) { thin++; continue; }
      kept++;
      if (w.rights === 'public') pub++; else linked++;
      if (w.link_status === 'auto') auto++;
      if (w.link_status === 'ambig') ambig++;
      out.push(w);
    }
    if (!DRY && out.length) {
      const res = await upsert(out);
      if (res.msg) errs.push(res.msg); else put += res.ok;
    }
  }

  try {
    if (ALL) {
      for (let page = 1; got < LIMIT; page++) {
        const { rows, iiif, total } = await listPage(page);
        if (!rows.length) break;
        await handle(rows, iiif);
        console.log(`  ${got}/${LIMIT} · 담을 것 ${kept}${DRY ? '' : ` · 담음 ${put}`}`);
        if (total && page >= total) break;
      }
    } else {
      const ids = await searchIds(Q || 'Korea', LIMIT);
      console.log(`  걸린 작품 ${ids.length}점`);
      for (let i = 0; i < ids.length; i += 100) {
        const part = ids.slice(i, i + 100);
        const { rows, iiif } = await byIds(part);
        await handle(rows, iiif);
        console.log(`  ${Math.min(i + 100, ids.length)}/${ids.length} · 담을 것 ${kept}${DRY ? '' : ` · 담음 ${put}`}`);
      }
    }
  } catch (e) {
    if (isStop(e)) console.log('  ■ 멈춥니다 — ' + stopReason(e));
    else errs.push(e.message);
  }

  console.log('──────────────────────────────');
  console.log(`  받은 작품        ${got}`);
  console.log(`  담을 만한 작품   ${kept}`);
  console.log(`  얇아서 뺀 작품   ${thin}`);
  console.log(`  도판 실을 수 있음 ${pub} · 저작권 있어 링크만 ${linked}`);
  console.log(`  작가와 이어짐    ${auto} · 후보 여럿 ${ambig}`);
  if (!DRY) console.log(`  실제로 담음      ${put}`);
  if (errs.length) {
    console.log(`  ★ 문제 ${errs.length}건`);
    errs.slice(0, 5).forEach((m) => console.log('     · ' + m));
  }
})();
