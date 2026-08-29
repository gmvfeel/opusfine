#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 전시 수집 (서울시립미술관) · scripts/collect-exh-seoul.mjs
   ------------------------------------------------------------------
   쓰는 법
     node scripts/collect-exh-seoul.mjs --dry
     node scripts/collect-exh-seoul.mjs

   ★★ 2026-08-24 · 서울 열린데이터광장에서 <b>확인하고</b> 만들었습니다.
     서비스 이름 ListExhibitionOfSeoulMOAInfo · <b>878건</b>
       · 지금 열리는 전시 16건 · 앞으로 2건 · 지난 것 860건
       · 878건 <b>전부</b> 포스터 주소가 있고, 840건에 설명이 있습니다
       · 공공누리 제1유형 — 출처표시만 하면 상업적 이용·변경 가능

   ★★★ 이 표가 <b>대문 히어로를 제자리로 돌려놓습니다.</b>
     히어로는 원래 실제 전시를 무작위로 소개하고 그 전시로 이어 주는
     자리였는데, 표가 없어 작가 소개로 임시 대체해 두었습니다.

   ★ 포스터는 <b>Content-Type 이 안 옵니다.</b> 서울시립미술관 서버가
     형식표를 안 보냅니다. 브라우저는 내용을 보고 알아서 그립니다.
     ▶ 우리도 <b>안 믿고 그냥 링크</b>합니다. 화면에서는 잘 뜹니다.

   ★ 한 번에 1,000건까지 줍니다. 878건이라 <b>한 번에</b> 받습니다.
   ══════════════════════════════════════════════════════════════════ */

import { makeGetJSON, isStop, stopReason } from './lib/http.mjs';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const KEY    = process.env.SEOUL_KEY;

const BASE = 'http://openapi.seoul.go.kr:8088';
const SVC  = 'ListExhibitionOfSeoulMOAInfo';
const UA   = 'OpusfineBot/1.0 (https://opusfine.com; cser@wixon.co.kr)';
const SRC  = 'sema';                 /* 서울시립미술관 */
const CREDIT = '서울시립미술관 (공공누리 제1유형)';

const getJSON = makeGetJSON({
  ua: UA, accept: 'application/json',
  tries: 5, maxWaitMs: 90 * 1000, budgetMs: 30 * 60 * 1000
});

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? (argv[i + 1] || d) : d; };
const DRY   = argv.includes('--dry');
const LIMIT = Number(arg('limit', 1000));

if (!KEY) { console.error('★ SEOUL_KEY 가 없습니다.'); process.exit(1); }
if (!DRY && (!SB_URL || !SB_KEY)) {
  console.error('★ SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

const url = (a, b) => `${BASE}/${encodeURIComponent(KEY)}/json/${SVC}/${a}/${b}/`;

/* 서울시 응답은 「{서비스명:{list_total_count, RESULT, row:[…]}}」 꼴 */
function unwrap(j) {
  if (!j || typeof j !== 'object') return null;
  for (const k of Object.keys(j)) {
    const v = j[k];
    if (v && typeof v === 'object' && (Array.isArray(v.row) || v.list_total_count != null))
      return { total: Number(v.list_total_count || 0), rows: v.row || [] };
  }
  return null;
}

/* ── 글 다듬기 ──
   ★ DP_INFO 가 <b>HTML 덩이</b>로 옵니다. 태그를 걷어 내고 씁니다.
     그대로 담으면 화면에 태그가 그대로 보이거나, 남의 스타일이
     우리 화면을 흔듭니다. */
/* ★★ 2026-08-24 · 실체 문자를 <b>낱개로 적다가 놓쳤습니다</b>.
     「오윤(1946&ndash;1986)」— &ndash; 가 그대로 남았습니다.
     &mdash; &rsquo; &hellip; &middot; … 이런 것이 끝없이 있습니다.
   ▶ 낱개로 적지 않고 <b>규칙으로</b> 풉니다.
       · 숫자 실체 &#8211; · &#x2013; — 코드 그대로 글자로
       · 이름 실체 &ndash;          — 표를 두고 찾아 바꿉니다
     ★ 표에 없는 이름은 <b>그대로 둡니다.</b> 지우면 뜻이 사라집니다. */
const ENT = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  ndash: '–', mdash: '—', minus: '−', hellip: '…', middot: '·',
  lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201C', rdquo: '\u201D',
  laquo: '«', raquo: '»', times: '×', divide: '÷', deg: '°',
  copy: '©', reg: '®', trade: '™', bull: '•', prime: '′', Prime: '″',
  larr: '←', rarr: '→', uarr: '↑', darr: '↓', harr: '↔',
  ensp: ' ', emsp: ' ', thinsp: ' ', shy: '', zwnj: '', zwj: ''
};

function unent(t) {
  return String(t || '')
    /* 숫자 실체 — &#8211; · &#x2013; */
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => {
      const n = parseInt(h, 16);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    })
    .replace(/&#(\d+);/g, (m, d) => {
      const n = Number(d);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    })
    /* 이름 실체 — 표에 있는 것만. 없으면 그대로 둡니다 */
    .replace(/&([a-zA-Z][a-zA-Z0-9]{1,9});/g, (m, k) =>
      Object.prototype.hasOwnProperty.call(ENT, k) ? ENT[k] : m);
}

function plain(html) {
  let t = String(html || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  t = unent(t);
  /* ★ &amp;lt; 처럼 <b>두 번 싸인</b> 것이 섞입니다. 한 번 더 풉니다.
       다만 두 번까지만 — 끝없이 풀면 원문의 &amp; 까지 사라집니다. */
  if (/&[a-zA-Z#]/.test(t)) t = unent(t);
  return t
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* 짧은 소개 — 히어로에 걸 것이라 <b>한 문장</b>으로 자릅니다 */
function summarize(t) {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  if (s.length <= 120) return s;
  const cut = s.slice(0, 118);
  const dot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('다 '), cut.lastIndexOf('다.'));
  return (dot > 40 ? cut.slice(0, dot + 1) : cut).trim() + '…';
}

function dateOf(v) {
  const m = /^(\d{4})[-.\/]?(\d{2})[-.\/]?(\d{2})/.exec(String(v || '').trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/* ── 겹낫표 벗기기 ────────────────────────────────────────────
   ★★ 2026-08-24 · <b>반만 벗겨져 짝이 깨졌습니다.</b>
       「2026 타이틀 매치 《오인환 vs. 장서영》」
        → 《2026 타이틀 매치 《오인환 vs. 장서영》   ← 앞이 안 벗겨짐
     낫표가 <b>가운데</b> 있는 제목이 많습니다. 맨 앞뒤만 보고
     벗기면 뒤쪽만 떨어져 짝이 깨집니다.
   ▶ <b>앞뒤가 짝일 때만</b> 벗깁니다. 「2026 타이틀 매치 《…》」처럼
     앞에 다른 글이 있으면 <b>손대지 않습니다</b> — 그것이 온전한
     제목이기 때문입니다. */
function stripBrackets(t) {
  let s2 = String(t || '').trim();
  for (let i = 0; i < 3; i++) {
    const m = /^([《<「『])\s*(.+?)\s*([》>」』])$/.exec(s2);
    if (!m) break;
    const pair = { '《': '》', '<': '>', '「': '」', '『': '』' };
    if (pair[m[1]] !== m[3]) break;          /* 짝이 아니면 그만둡니다 */
    const inner = m[2];
    /* ★ 안쪽에 여는 낫표가 또 있으면 <b>겉이 짝이 아닙니다.</b>
         「《가》와 《나》」 같은 것 — 벗기면 뜻이 깨집니다. */
    if (/[《「『]/.test(inner)) break;
    s2 = inner.trim();
  }
  return s2 || String(t || '').trim();
}

function quality(e) {
  let n = 0;
  if (e.poster_url)  n += 4;
  if (e.summary)     n += 2;
  if (e.body)        n += 2;
  if (e.start_date)  n += 2;
  if (e.end_date)    n += 1;
  if (e.venue)       n += 1;
  if (e.artists)     n += 1;
  if (e.link_source) n += 1;
  return n;
}

/* ── 한 건 만들기 ── */
function build(r) {
  const id = String(r.DP_EX_NO || '').trim();
  const title = String(r.DP_NAME || '').replace(/\s+/g, ' ').trim();
  if (!id || !title) return null;

  const body = plain(r.DP_INFO);
  const e = {
    source:      SRC,
    source_id:   id,
    /* ★ 제목이 「《오윤》」처럼 겹낫표째 옵니다. 우리 화면이 낫표를
         따로 붙이므로 여기서 벗깁니다 — 안 그러면 《《오윤》》. */
    title:       stripBrackets(title),
    subtitle:    String(r.DP_SUBNAME || '').trim() || null,
    venue:       String(r.DP_PLACE || '').trim() || null,
    venue_dept:  null,
    start_date:  dateOf(r.DP_START),
    end_date:    dateOf(r.DP_END),
    artists:     String(r.DP_ARTIST || '').replace(/\s+/g, ' ').trim() || null,
    organizer:   String(r.DP_SPONSOR || '').trim() || null,
    genre:       String(r.DP_ART_PART || '').trim() || null,
    work_count:  /^\d+$/.test(String(r.DP_ART_CNT || '').trim())
                   ? Number(r.DP_ART_CNT) : null,
    summary:     summarize(body),
    body:        body || null,
    open_time:   String(r.DP_VIEWTIME || '').replace(/\s+/g, ' ').trim() || null,
    charge:      String(r.DP_VIEWCHARGE || '').replace(/\s+/g, ' ').trim() || null,
    /* ★ 포스터는 http 로 옵니다. https 로 바꿔 둡니다 —
         우리 화면이 https 라 http 그림은 브라우저가 막습니다. */
    poster_url:  String(r.DP_MAIN_IMG || '').trim().replace(/^http:/, 'https:') || null,
    poster_credit: CREDIT,
    link_source: String(r.DP_LNK || r.DP_HOMEPAGE || '').trim() || null,
    /* ★ 공공누리 제1유형 — 출처표시만 하면 상업적 이용·변경 가능 */
    rights:      'public',
    hidden:      false
  };
  e.quality = quality(e);
  /* 이름과 날짜조차 없으면 담지 않습니다 */
  if (!e.start_date && !e.end_date) return null;
  return e;
}

async function upsert(rows) {
  if (!rows.length) return { ok: 0, msg: '' };
  const r = await fetch(SB_URL + '/rest/v1/exhibitions?on_conflict=source,source_id', {
    method: 'POST',
    headers: {
      apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      /* ★ merge — 전시는 <b>바뀝니다</b>. 기간이 늘거나 설명이 붙습니다.
           작품과 달리 덮어써야 최신이 됩니다. */
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(rows)
  });
  if (!r.ok) {
    const t = (await r.text()).slice(0, 300);
    if (/exhibitions|42P01|42P10/.test(t))
      return { ok: 0, msg: '★ exhibitions 표나 고유 인덱스가 없습니다. '
                         + 'sql/exh-19-B-apply.sql 을 먼저 돌리십시오. (' + t + ')' };
    return { ok: 0, msg: r.status + ' ' + t };
  }
  return { ok: rows.length, msg: '' };
}

/* ══ 돌리기 ══════════════════════════════════════════════════════ */
(async () => {
  console.log('▶ 전시 수집 (서울시립미술관)' + (DRY ? ' · 세어만 봅니다' : ''));

  let j = null;
  try { j = await getJSON(url(1, LIMIT)); }
  catch (e) {
    if (isStop(e)) console.log('  ■ 멈춥니다 — ' + stopReason(e));
    else console.log('  ★ 못 받았습니다 — ' + String(e.message).slice(0, 160));
    return;
  }
  const u = unwrap(j);
  if (!u || !u.rows.length) {
    console.log('  ★ 줄이 없습니다 — ' + JSON.stringify(j).slice(0, 300));
    return;
  }
  console.log(`  받은 것 ${u.rows.length}건 / 모두 ${u.total.toLocaleString()}건\n`);

  const out = [];
  let thin = 0;
  for (const r of u.rows) {
    const e = build(r);
    if (!e) { thin++; continue; }
    out.push(e);
  }

  /* 오늘 기준으로 갈라 봅니다 */
  const today = new Date().toISOString().slice(0, 10);
  const now  = out.filter((e) => (e.start_date || '') <= today && today <= (e.end_date || ''));
  const soon = out.filter((e) => (e.start_date || '') > today);
  const pic  = out.filter((e) => e.poster_url);

  console.log(`  담을 것        ${out.length}건`);
  console.log(`  얇아서 뺀 것    ${thin}건`);
  console.log(`  ★ 지금 열림    ${now.length}건`);
  console.log(`  앞으로 열림    ${soon.length}건`);
  console.log(`  포스터 있음    ${pic.length}건\n`);

  console.log('  지금 열리는 전시');
  for (const e of now.slice(0, 12))
    console.log(`    ${e.start_date} ~ ${e.end_date}  《${e.title.slice(0, 34)}》`
              + `  · ${String(e.venue || '').slice(0, 20)}`);
  if (!now.length) console.log('    (없습니다)');

  if (DRY) {
    console.log('\n  한 건이 표에 들어갈 모습');
    const s = now[0] || out[0];
    for (const [k, v] of Object.entries(s))
      console.log('    ' + k.padEnd(14)
        + String(v === null ? '(빈 값)' : v).replace(/\s+/g, ' ').slice(0, 84));
    console.log('\n  (세어만 봤습니다)');
    return;
  }

  let put = 0;
  const errs = [];
  for (let i = 0; i < out.length; i += 200) {
    const res = await upsert(out.slice(i, i + 200));
    if (res.msg) { errs.push(res.msg); if (errs.length > 3) break; }
    else put += res.ok;
    console.log(`  담는 중 ${put}/${out.length}`);
  }

  console.log('──────────────────────────────');
  console.log(`  실제로 담음     ${put}건`);
  if (errs.length) {
    console.log(`  ★ 문제 ${errs.length}건`);
    errs.slice(0, 3).forEach((m) => console.log('     · ' + m));
  }
  console.log('\n★ 다음 — 대문 히어로를 전시 자리로 되돌립니다.');
})();
