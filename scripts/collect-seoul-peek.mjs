#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 서울 열린데이터광장 탐색 · scripts/collect-seoul-peek.mjs
   ------------------------------------------------------------------
   쓰는 법
     node scripts/collect-seoul-peek.mjs

   ★★ 2026-08-24 · <b>담지 않습니다. 보기만 합니다.</b>
     오늘 공유마당 상세에서 <b>300건을 잘못 채웠습니다.</b> 정의서에
     적힌 칸 이름만 믿고 <b>실제로 값이 오는지 보지 않은</b> 탓입니다.
     그래서 이번에는 <b>확인기와 수집기를 아예 나눠</b> 둡니다.
     이 파일에는 담는 코드가 <b>한 줄도 없습니다.</b>

   ★ 무엇을 보나
       ① 닿는가          — api.kcisa.kr 은 GitHub 서버에서 못 닿았습니다
       ② 열쇠가 먹는가
       ③ <b>서비스 이름</b>이 무엇인가 — 이것을 모릅니다. 두드려 봅니다
       ④ 무엇을 주는가   — 칸 이름과 값을 있는 그대로
       ⑤ 도판이 있는가   — 전시 포스터·소장품 도판

   ★ 서울 열린데이터광장 주소 꼴 (안내에서 확인)
       http://openapi.seoul.go.kr:8088/{인증키}/{형식}/{서비스명}/{시작}/{끝}/
     ★ 서비스 이름을 <b>짐작으로 하나 박지 않습니다.</b> 여럿 두드려
       보고 <b>어느 것이 답하는지</b> 봅니다. 인계문서 교훈 ② —
       「짐작해 박아 넣으면 조용히 틀립니다」.

   ★ 왜 서울인가 (2026-08-24 확인)
       · 갱신일 2026-08-29 — 살아 있습니다
       · <b>공공누리 제1유형</b> — 출처표시만 하면 상업적 이용·변경 가능
       · 전시 정보와 <b>소장품 정보</b>가 함께 있습니다
       · api.kcisa.kr 과 <b>다른 기관</b>입니다 (서울특별시)
   ══════════════════════════════════════════════════════════════════ */

const KEY = process.env.SEOUL_KEY;
const UA  = 'OpusfineBot/1.0 (https://opusfine.com; cser@wixon.co.kr)';
const BASE = 'http://openapi.seoul.go.kr:8088';

if (!KEY) {
  console.error('★ SEOUL_KEY 가 없습니다. 서울 열린데이터광장 인증키를 Secrets 에 넣으십시오.');
  process.exit(1);
}

/* ★ 두드려 볼 서비스 이름 — 서울시가 쓰는 이름 규칙에서 짚이는 것들.
     맞는 것 하나를 고르는 것이 아니라 <b>어느 것이 답하는지</b> 봅니다. */
const NAMES = [
  /* 전시 */
  'ListExhibitionOfSeoulMOAInfo',
  'ListExhibitionOfSeoulMOA',
  'SemaExhibitionKor',
  'ListSeoulMuseumExhibition',
  'ListExhibitionOfSeoulMOAKor',
  'SebcExhibitInfoKor',
  /* 소장품 */
  'ListCollectionOfSeoulMOAInfo',
  'ListCollectionOfSeoulMOA',
  'SemaCollectionKor',
  'ListSeoulMuseumCollection'
];

function url(name, a, b, type) {
  return `${BASE}/${encodeURIComponent(KEY)}/${type || 'json'}/${name}/${a}/${b}/`;
}

async function raw(u) {
  const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'application/json, */*' } });
  return { status: r.status, type: r.headers.get('content-type') || '', body: await r.text() };
}

/* 서울시 응답은 「{서비스명:{list_total_count, RESULT:{CODE,MESSAGE}, row:[…]}}」 꼴입니다 */
function unwrap(j) {
  if (!j || typeof j !== 'object') return null;
  for (const k of Object.keys(j)) {
    const v = j[k];
    if (v && typeof v === 'object' && (Array.isArray(v.row) || v.list_total_count != null))
      return { name: k, total: Number(v.list_total_count || 0),
               rows: v.row || [], result: v.RESULT || null };
  }
  if (j.RESULT) return { name: null, total: 0, rows: [], result: j.RESULT };
  return null;
}

const IMGISH = /img|image|thumb|photo|poster|사진|url|link|file/i;

(async () => {
  console.log('▶ 서울 열린데이터광장 탐색 — <b>담지 않습니다</b>\n');
  console.log('  열쇠: ' + KEY.slice(0, 8) + '…\n');

  /* ── ① 닿는가 ── */
  console.log('── ① GitHub 서버에서 닿는가');
  let probe = null;
  try { probe = await raw(url(NAMES[0], 1, 1)); }
  catch (e) {
    console.log('   ✕ 못 닿습니다 — ' + String(e.message).slice(0, 140));
    console.log('     (api.kcisa.kr 과 같은 증상입니다. 이러면 GitHub Actions 에서는');
    console.log('      수집할 수 없고, 다른 자리에서 돌리거나 중계가 필요합니다.)');
    return;
  }
  console.log(`   ✔ 닿습니다 — HTTP ${probe.status} · ${probe.body.length}바이트\n`);

  /* ── ②③ 어느 이름이 답하는가 ── */
  console.log('── ②③ 어느 서비스 이름이 답하는가');
  const alive = [];
  for (const nm of NAMES) {
    let r = null;
    try { r = await raw(url(nm, 1, 3)); }
    catch (e) { console.log(`   ${nm.padEnd(30)} ✕ ${String(e.message).slice(0, 40)}`); continue; }

    let j = null;
    try { j = JSON.parse(r.body); } catch (e) { }
    const u = j ? unwrap(j) : null;

    if (!u) {
      console.log(`   ${nm.padEnd(30)} ? ${r.body.slice(0, 70).replace(/\s+/g, ' ')}`);
      continue;
    }
    const code = u.result && u.result.CODE;
    const msg  = u.result && u.result.MESSAGE;

    if (u.rows.length) {
      console.log(`   ${nm.padEnd(30)} ★ 답합니다 — ${u.total.toLocaleString()}건`);
      alive.push({ nm, u });
    } else {
      console.log(`   ${nm.padEnd(30)} — ${code || ''} ${String(msg || '').slice(0, 44)}`);
    }
  }

  if (!alive.length) {
    console.log('\n★ 답하는 이름이 없습니다.');
    console.log('  서울 열린데이터광장의 해당 자료 쪽에서 <b>「Open API」 탭</b>을 열면');
    console.log('  <b>샘플 URL</b> 이 적혀 있습니다. 그 주소를 보내 주시면 맞추겠습니다.');
    console.log('    전시  https://data.seoul.go.kr/dataList/OA-15323/S/1/datasetView.do');
    console.log('    소장품 https://data.seoul.go.kr/dataList/OA-15321/S/1/datasetView.do');
    return;
  }

  /* ── ④⑤ 무엇을 주는가 ── */
  for (const a of alive) {
    console.log(`\n── ④ ${a.nm} 이 주는 칸과 값 (첫 줄)`);
    const o = a.u.rows[0];
    for (const k of Object.keys(o)) {
      console.log('   ' + k.padEnd(24)
        + String(o[k] === null || o[k] === '' ? '(빈 값)' : o[k])
            .replace(/\s+/g, ' ').slice(0, 76));
    }

    const imgs = Object.keys(o).filter((k) => IMGISH.test(k) && o[k]);
    console.log('\n   ' + (imgs.length
      ? '★ 도판·주소로 보이는 칸: ' + imgs.join(', ')
      : '✕ 도판·주소로 보이는 칸이 <b>없습니다</b>'));

    /* 도판이 있으면 <b>실제로 뜨는지</b> 불러 봅니다 */
    for (const k of imgs.slice(0, 3)) {
      const v = String(o[k]);
      if (!/^https?:\/\//.test(v)) { console.log(`     ${k} — 주소 꼴이 아닙니다`); continue; }
      let s = '?';
      try {
        const rr = await fetch(v, { headers: { 'User-Agent': UA } });
        const ct = rr.headers.get('content-type') || '';
        const b = await rr.arrayBuffer();
        s = (rr.ok && /image/.test(ct) && b.byteLength > 3000)
          ? `뜸 ✔ ${(b.byteLength / 1024).toFixed(0)}KB`
          : `안 뜸 ✕ HTTP ${rr.status} ${ct.split(';')[0]}`;
      } catch (e) { s = '✕ ' + String(e.message).slice(0, 40); }
      console.log(`     [${s}] ${k}`);
    }

    /* 두어 줄 더 — 무엇이 들었는지 감을 잡습니다 */
    console.log('\n   보기 몇 줄');
    for (const r of a.u.rows.slice(0, 3)) {
      const bits = Object.keys(r).slice(0, 4)
        .map((k) => String(r[k] || '').replace(/\s+/g, ' ').slice(0, 26));
      console.log('     ' + bits.join(' · '));
    }
  }

  console.log('\n──────────────────────────────');
  console.log('★ 이 결과를 보고 수집기를 씁니다. 지금은 아무것도 담지 않았습니다.');
})();
