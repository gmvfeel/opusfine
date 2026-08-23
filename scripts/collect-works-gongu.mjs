#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 공유마당 · scripts/collect-works-gongu.mjs
   ------------------------------------------------------------------
   쓰는 법
     node scripts/collect-works-gongu.mjs --peek
     node scripts/collect-works-gongu.mjs --limit 500 --dry
     node scripts/collect-works-gongu.mjs

   ★★ 2026-08-23 · <b>정의서를 받아 짐작을 걷어 냈습니다</b> (파트너 제공).
     요청 주소·코드표·응답 항목이 다 적혀 있습니다. 오늘 e뮤지엄에서
     주소를 못 찾아 두 시간을 쓴 것과 정반대입니다.

     요청 URL  http://gongu.copyright.or.kr/gongu/wrt/wrtApi/search.json

   ★ 공유마당이 왜 좋은가
     · 회화만 <b>30,603건</b> · 서예·조형·공예·판화도 따로
     · <b>저작권 처리가 끝난 것만</b> 모아 둔 곳입니다. 우리가 손으로
       하던 「사후 70년」 판단을 그쪽이 이미 해 두었습니다.
     · 상세에 <b>재료·크기·소장처·제작연도</b>가 옵니다 —
       우리 시그니처 캡션(작가/《작품》,연도/재료/소장처)에 딱 맞습니다.

   ★★ 라이선스를 <b>골라 받습니다</b>
     오퍼스파인에는 광고가 붙습니다(상업적 이용). 그래서
     <b>상업적 이용이 막힌 것은 아예 받지 않습니다.</b>
       받음  97 만료 · 98 기증(자유이용) · 01 KOGL 제1유형 · 21 CC BY · 23 CC BY-SA
       안 받음 02·04 KOGL 상업금지 · 24·26·27 CCL 비영리
       안 받음 22·25 CCL 변경금지 — <b>썸네일로 줄이는 것도 「변경」</b>일
              수 있습니다. 다툼의 소지를 애초에 안 만듭니다.
     ★ 99 기증(이용허락)도 뺍니다 — 건별로 허락을 받아야 합니다.

   ★ --peek 은 담지 않고 <b>몇 건인지·도판이 뜨는지</b>만 봅니다.
   ══════════════════════════════════════════════════════════════════ */

import { makeGetJSON, isStop, stopReason } from './lib/http.mjs';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const KEY    = process.env.GONGU_KEY;

const API = 'https://gongu.copyright.or.kr/gongu/wrt/wrtApi/search.json';
const UA  = 'OpusfineBot/1.0 (https://opusfine.com; cser@wixon.co.kr)';

/* 정의서 코드표 — 짐작이 아니라 <b>받아 적은 것</b>입니다 */
const LICENSE = {
  '97': { nm: '만료',            ok: true,  rights: 'public' },
  '98': { nm: '기증(자유이용)',  ok: true,  rights: 'public' },
  '01': { nm: 'KOGL 출처표시',   ok: true,  rights: 'public' },
  '21': { nm: 'CC BY',           ok: true,  rights: 'public' },
  '23': { nm: 'CC BY-SA',        ok: true,  rights: 'public' },
  '99': { nm: '기증(이용허락)',  ok: false },
  '02': { nm: 'KOGL 상업금지',   ok: false },
  '03': { nm: 'KOGL 변경금지',   ok: false },
  '04': { nm: 'KOGL 상업+변경금지', ok: false },
  '20': { nm: 'CCL(기타)',       ok: false },
  '22': { nm: 'CC BY-ND',        ok: false },
  '24': { nm: 'CC BY-NC',        ok: false },
  '25': { nm: 'CC BY-NC-ND',     ok: false },
  '26': { nm: 'CC BY-NC-SA',     ok: false },
  '27': { nm: 'CCL(기타)',       ok: false }
};
const USE = Object.keys(LICENSE).filter((k) => LICENSE[k].ok);

const WRT_ART   = '10004';   /* 저작물유형 · 미술 */
const FILE_IMG  = '02';      /* 파일유형 · 이미지 */

const getJSON = makeGetJSON({
  ua: UA, accept: 'application/json',
  tries: 5, maxWaitMs: 120 * 1000, budgetMs: 40 * 60 * 1000
});

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? (argv[i + 1] || d) : d; };
const PEEK  = argv.includes('--peek');
const DRY   = argv.includes('--dry');
const LIMIT = Number(arg('limit', 5000));
const PAGE  = 100;

if (!KEY) {
  console.error('★ GONGU_KEY 가 없습니다. 공유마당 API 키를 Secrets 에 넣으십시오.');
  process.exit(1);
}
if (!PEEK && (!SB_URL || !SB_KEY)) {
  console.error('★ SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

function url(page, rows, lic) {
  return API + '?apiKey=' + encodeURIComponent(KEY)
    + '&wrtTy=' + WRT_ART + '&wrtFileTy=' + FILE_IMG
    + '&licenseCd=' + (lic || USE.join(','))
    + '&pageUnit=' + rows + '&pageIndex=' + page;
}

/* 응답에서 줄을 꺼냅니다 — 정의서에 resultList 로 적혀 있습니다 */
function rowsOf(j) {
  if (!j) return [];
  if (Array.isArray(j.resultList)) return j.resultList;
  for (const k of Object.keys(j)) if (Array.isArray(j[k]) && j[k].length && j[k][0].wrtSn) return j[k];
  return [];
}
const totalOf = (j) => Number((j && (j.resultCnt ?? j.totalCount)) || 0);

/* ── 우리 작가DB ── */
async function loadArtists() {
  const byName = new Map();
  let from = 0;
  for (;;) {
    const r = await fetch(SB_URL + '/rest/v1/artists?select=id,name_ko,name_en&limit=1000&offset=' + from,
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    if (!r.ok) break;
    const rows = await r.json();
    if (!rows.length) break;                       /* ★ 0줄일 때 끝냅니다 */
    for (const a of rows) for (const nm of [a.name_ko, a.name_en]) {
      if (!nm) continue;
      const k = String(nm).trim();
      if (!k) continue;
      if (!byName.has(k)) byName.set(k, []);
      byName.get(k).push(a.id);
    }
    from += rows.length;
  }
  return byName;
}

function quality(w) {
  let n = 0;
  if (w.image_url)   n += 4;
  if (w.year_text)   n += 2;
  if (w.medium)      n += 2;
  if (w.artist_name) n += 2;
  if (w.artist_id)   n += 2;
  if (w.holder)      n += 1;
  if (w.link_source) n += 1;
  if (w.genre)       n += 1;
  return n;
}

/* ── 한 점 만들기 ──
   ★ 목록만으로도 담을 수 있게 짭니다. 상세는 재료·소장처가 있어
     더 좋지만 <b>건마다 한 번 더 물어야</b> 합니다. 하루 한도가
     있으므로 목록으로 먼저 채우고, 상세는 나중에 채웁니다. */
function build(o, byName) {
  const sn = String(o.wrtSn || '').trim();
  const title = String(o.orginSj || '').trim();
  if (!sn || !title) return null;

  /* ★ 라이선스를 <b>다시 확인</b>합니다. 요청에서 걸렀어도
       응답이 다르게 올 수 있습니다 — 믿고 넘어가지 않습니다. */
  const code = String(o.licenseCd || '').padStart(2, '0');
  const L = LICENSE[code];
  if (!L || !L.ok) return null;

  const who = String(o.authorListNm || o.athrNm || '').split(',')[0].trim();
  const w = {
    gongu_sn:   sn,
    title,
    title_en:   null,
    year_text:  String(o.orginCrtDt || '').trim() || null,
    medium:     String(o.orginMatrlTech || '').trim() || null,
    dimensions: String(o.orginSize || '').trim() || null,
    genre:      String(o.clListName || o.clNm || '').replace(/\s+/g, ' ').trim() || null,
    artist_name: (!who || /미상/.test(who)) ? null : who,
    artist_id:  null,
    link_status: 'none',
    image_url:  String(o.detailThmbUrl || o.thumbUrl || '').trim() || null,
    image_small: String(o.thumbUrl || o.detailThmbUrl || '').trim() || null,
    image_credit: '공유마당 · ' + (o.srcTrgetInttNm || '한국저작권위원회')
                + ' (' + (L.nm) + ')',
    rights:     L.rights,
    holder:     String(o.orginPosesn || o.srcTrgetInttNm || '').trim() || null,
    link_source: String(o.gongLinkUrl || o.linkUrl || '').trim()
              || ('https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=' + sn),
    hidden:     false
  };

  /* 작가 잇기 — 이름이 꼭 같고 하나뿐일 때만 */
  if (w.artist_name) {
    const hit = byName.get(w.artist_name);
    if (hit && hit.length === 1) { w.artist_id = hit[0]; w.link_status = 'auto'; }
    else if (hit && hit.length > 1) { w.link_status = 'ambig'; }
  }
  w.quality = quality(w);
  if (w.quality < 4) return null;
  return w;
}

async function upsert(rows) {
  if (!rows.length) return { ok: 0, msg: '' };
  const r = await fetch(SB_URL + '/rest/v1/artworks?on_conflict=gongu_sn', {
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
    if (t.includes('42P10') || t.includes('gongu_sn'))
      return { ok: 0, msg: '★ artworks.gongu_sn 칸이나 고유 인덱스가 없습니다. '
                         + 'sql/gongu-14-B-apply.sql 을 먼저 돌리십시오. (' + t + ')' };
    return { ok: 0, msg: r.status + ' ' + t };
  }
  return { ok: rows.length, msg: '' };
}

/* ══ 엿보기 ══════════════════════════════════════════════════════ */
async function peek() {
  console.log('▶ 공유마당 엿보기 — 담지 않습니다\n');

  /* ① 닿는가 · 열쇠가 먹는가 */
  console.log('── ① 닿는가 · 열쇠가 먹는가');
  let j = null;
  try { j = await getJSON(url(1, 3, '97')); }
  catch (e) {
    console.log('   ✕ ' + String(e.message).slice(0, 160));
    console.log('     (api.kcisa.kr 과 같은 증상이면 GitHub Actions 에서는 못 받습니다)');
    return;
  }
  const rows0 = rowsOf(j);
  console.log(`   ✔ 답이 옵니다 · 전체 ${totalOf(j).toLocaleString()}건 · 이번에 ${rows0.length}줄`);
  if (!rows0.length) {
    console.log('   ※ 줄이 없습니다. 답 앞부분 —');
    console.log('   ' + JSON.stringify(j).slice(0, 600));
    return;
  }

  /* ② 라이선스마다 몇 건인가 */
  console.log('\n── ② 라이선스마다 몇 건인가 (미술 · 이미지)');
  for (const [code, L] of Object.entries(LICENSE)) {
    let n = null;
    try { n = totalOf(await getJSON(url(1, 1, code))); } catch (e) { }
    console.log(`   ${(L.ok ? '받음  ' : '안 받음')} ${code} ${L.nm.padEnd(18)}`
              + (n == null ? '(못 셈)' : n.toLocaleString() + '건'));
  }
  let useN = null;
  try { useN = totalOf(await getJSON(url(1, 1))); } catch (e) { }
  console.log(`   ── 받을 것 모두: ${useN == null ? '?' : useN.toLocaleString()}건`);

  /* ③ 한 줄이 무엇을 주나 */
  console.log('\n── ③ 한 줄이 주는 칸과 값');
  const o = rows0[0];
  for (const k of Object.keys(o)) {
    console.log('   ' + k.padEnd(20)
      + String(o[k] === null || o[k] === '' ? '(빈 값)' : o[k]).slice(0, 78).replace(/\s+/g, ' '));
  }

  console.log('\n── ④ 우리 표에 들어갈 모습');
  const w = build(o, new Map());
  if (!w) console.log('   (충실도가 모자라거나 라이선스가 안 맞아 담지 않습니다)');
  else for (const [k, v] of Object.entries(w))
    console.log('   ' + k.padEnd(14) + String(v === null ? '(빈 값)' : v).slice(0, 88));

  /* ⑤ 도판이 실제로 뜨는가 — 오늘의 핵심 */
  console.log('\n── ⑤ 도판이 실제로 뜨는가');
  for (const r of rows0.slice(0, 3)) {
    const u = String(r.thumbUrl || r.detailThmbUrl || '').trim();
    if (!u) { console.log('   ✕ 주소 없음 — ' + (r.orginSj || '')); continue; }
    let s = '?';
    try {
      const rr = await fetch(u, { headers: { 'User-Agent': UA } });
      const ct = rr.headers.get('content-type') || '';
      const b = await rr.arrayBuffer();
      s = (rr.ok && /image/.test(ct) && b.byteLength > 3000)
        ? `뜸 ✔ ${ct.split(';')[0]} ${b.byteLength}바이트`
        : `안 뜸 ✕ HTTP ${rr.status} ${ct} ${b.byteLength}바이트`;
    } catch (e) { s = '✕ ' + String(e.message).slice(0, 60); }
    console.log(`   [${s}] ${String(r.orginSj || '').slice(0, 34)}`);
    console.log(`     ${u.slice(0, 120)}`);
  }

  console.log('\n──────────────────────────────');
  console.log('★ ⑤가 「뜸 ✔」이면 붙일 수 있습니다. 지금은 담지 않았습니다.');
}

/* ══ 돌리기 ══════════════════════════════════════════════════════ */
(async () => {
  if (PEEK) { await peek(); return; }

  console.log(`▶ 공유마당 수집 · 미술·이미지 · 라이선스 ${USE.join(',')}`
    + ` · limit=${LIMIT}${DRY ? ' · 세어만 봅니다' : ''}`);

  let byName = new Map();
  try { byName = await loadArtists(); } catch (e) { }
  console.log(`  작가 이름 ${byName.size}개를 담아 두었습니다\n`);

  let got = 0, kept = 0, put = 0, skipLic = 0, thin = 0, auto = 0;
  const errs = [];

  for (let p = 1; got < LIMIT; p++) {
    let j = null;
    try { j = await getJSON(url(p, PAGE)); }
    catch (e) {
      if (isStop(e)) { console.log('  ■ 멈춥니다 — ' + stopReason(e)); break; }
      errs.push(`page ${p}: ${e.message}`);
      if (errs.length > 3) break;
      continue;
    }
    const rows = rowsOf(j);
    if (!rows.length) break;                       /* ★ 0줄일 때 끝냅니다 */
    const total = totalOf(j);

    const out = [];
    for (const o of rows) {
      got++;
      const before = kept;
      const w = build(o, byName);
      if (!w) {
        const code = String(o.licenseCd || '').padStart(2, '0');
        if (!LICENSE[code] || !LICENSE[code].ok) skipLic++; else thin++;
        continue;
      }
      kept++;
      if (w.link_status === 'auto') auto++;
      out.push(w);
    }

    if (!DRY && out.length) {
      const res = await upsert(out);
      if (res.msg) { errs.push(res.msg); if (errs.length > 3) break; }
      else put += res.ok;
    }
    console.log(`  ${got}/${total || '?'} · 담을 것 ${kept}${DRY ? '' : ` · 담음 ${put}`}`);
    if (total && got >= total) break;
  }

  console.log('──────────────────────────────');
  console.log(`  받은 것            ${got}`);
  console.log(`  라이선스가 안 맞아 뺌 ${skipLic}`);
  console.log(`  얇아서 뺀 것        ${thin}`);
  console.log(`  담을 만한 것        ${kept}`);
  console.log(`  작가와 이어짐       ${auto}`);
  if (!DRY) console.log(`  실제로 담음         ${put}`);
  if (errs.length) {
    console.log(`  ★ 문제 ${errs.length}건`);
    errs.slice(0, 3).forEach((m) => console.log('     · ' + m));
  }
})();
