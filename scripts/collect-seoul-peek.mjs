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
  /* ★ 전시 — 2026-08-24 <b>확인됨</b> · 878건 */
  'ListExhibitionOfSeoulMOAInfo',
  /* ★ 소장품 — 아직 못 찾았습니다. 전시가 「…OfSeoulMOAInfo」였으니
       같은 규칙으로 짚어 봅니다. 짐작이지만 <b>두드려 보고</b> 고릅니다. */
  'ListCollectionOfSeoulMOAInfo',
  'ListArtCollectionOfSeoulMOAInfo',
  'ListSeoulMOACollectionInfo',
  'ListCollectionOfSeoulMOAKorInfo',
  'ListSemaCollectionInfo',
  'ListArtOfSeoulMOAInfo',
  'ListWorksOfSeoulMOAInfo',
  /* 교육 — 규칙이 맞는지 견주어 보려는 것입니다 */
  'ListEducationOfSeoulMOAInfo'
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

/* ── 그림인지 <b>내용으로</b> 알아내기 ──────────────────────────
   ★★ 2026-08-24 · 서울시립미술관 서버는 <b>Content-Type 을 안 보냅니다.</b>
     형식표만 믿으면 65KB 짜리 진짜 그림을 「그림이 아님」으로 봅니다.
     브라우저가 하는 대로 <b>앞머리 바이트</b>를 봅니다.
   ★ 이것은 앞으로 다른 자료원에도 씁니다 — 국내 공공 서버는
     형식표를 빠뜨리는 곳이 드물지 않습니다. */
function sniff(ab) {
  const b = new Uint8Array(ab.slice(0, 12));
  if (b.length < 4) return null;
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'JPEG';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'PNG';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'GIF';
  if (b[0] === 0x42 && b[1] === 0x4D) return 'BMP';
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return 'WEBP';
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'HEIC/AVIF';
  return null;
}

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

    /* ── 도판이 <b>실제로 뜨는지</b> ──
       ★★ 2026-08-24 · 첫 판에서 DP_MAIN_IMG 가 「HTTP 200 인데
         그림이 아님」으로 나왔습니다. 까닭이 여럿일 수 있습니다.
           · 주소가 잘렸다        → <b>온전히 찍어</b> 봅니다
           · 참조 검사(referer)   → 머리를 붙여 다시 불러 봅니다
           · http 라서 막혔다     → https 로 바꿔 봅니다
           · 정말 그림이 없다     → 답이 무엇인지 앞부분을 찍습니다
         <b>어느 것인지 알아야</b> 고칠 수 있습니다. */
    for (const k of imgs.slice(0, 2)) {
      const v0 = String(o[k]);
      console.log(`\n     ── ${k}`);
      console.log('     온전한 주소:');
      console.log('       ' + v0);
      if (!/^https?:\/\//.test(v0)) { console.log('     (주소 꼴이 아닙니다)'); continue; }

      const tries = [
        ['그냥',        v0, { 'User-Agent': UA }],
        ['https 로',    v0.replace(/^http:/, 'https:'), { 'User-Agent': UA }],
        ['참조 붙여',   v0, { 'User-Agent': UA, Referer: 'https://sema.seoul.go.kr/' }],
        ['브라우저인 척', v0, {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                      + ' (KHTML, like Gecko) Chrome/126 Safari/537.36',
          Referer: 'https://sema.seoul.go.kr/',
          Accept: 'image/avif,image/webp,image/*,*/*;q=0.8'
        }]
      ];
      for (const [nm, u, hd] of tries) {
        let msg = '?';
        try {
          const rr = await fetch(u, { headers: hd, redirect: 'follow' });
          const ct = rr.headers.get('content-type') || '';
          const ab = await rr.arrayBuffer();
          const n = ab.byteLength;
          const kind = sniff(ab);
          /* ★★ 2026-08-24 · 앞 판에서 「HTTP 200 인데 그림이 아님」이라
               잘못 판정했습니다. 65KB 가 왔는데도요.
               까닭 — 서울시립미술관 서버가 <b>Content-Type 을 안 보냅니다.</b>
               브라우저는 <b>내용을 보고</b> 알아서 그립니다.
             ▶ 형식표를 믿지 말고 <b>바이트 앞머리</b>를 봅니다.
               JPEG 는 FF D8 FF · PNG 는 89 50 4E 47 로 시작합니다. */
          const ok = rr.ok && kind && n > 3000;
          msg = ok
            ? `뜸 ✔ ${kind} ${(n / 1024).toFixed(0)}KB`
              + (ct ? '' : ' (형식표는 안 옵니다 — 내용으로 알아냈습니다)')
            : `✕ HTTP ${rr.status} · ${kind || '그림 아님'} · ${n}바이트`;
          if (!ok && n && n < 4000) {
            const t = Buffer.from(ab).toString('utf8').replace(/\s+/g, ' ').slice(0, 150);
            if (t.trim()) msg += '\n         답: ' + t;
          }
        } catch (e) { msg = '✕ ' + String(e.message).slice(0, 60); }
        console.log(`       ${nm.padEnd(12)} ${msg}`);
      }
    }

    /* 두어 줄 더 — 무엇이 들었는지 감을 잡습니다 */
    console.log('\n   보기 몇 줄');
    for (const r of a.u.rows.slice(0, 3)) {
      console.log('     ' + [r.DP_NAME || r.TITLE || Object.values(r)[2],
                             r.DP_PLACE || '', r.DP_START || '', r.DP_END || '']
        .map((x) => String(x || '').replace(/\s+/g, ' ').slice(0, 30)).join(' · '));
    }
  }

  /* ── ⑥ 「지금 열리는 전시」가 몇 건인가 ──
     ★★ 히어로에 걸 것은 <b>지난 전시가 아니라 지금 하는 전시</b>입니다.
       878건 가운데 오늘 기준으로 열려 있는 것이 <b>몇 건인지</b> 봐야
       히어로를 되돌릴 수 있는지 판단이 섭니다.
     ★ 한 번에 1,000건까지 주므로 878건을 <b>한 번에</b> 받아 셉니다. */
  const ex = alive.find((a) => /Exhibition/i.test(a.nm));
  if (ex) {
    console.log('\n── ⑥ 지금 열리는 전시가 몇 건인가');
    let rows = [];
    try {
      const r = await raw(url(ex.nm, 1, 1000));
      const u = unwrap(JSON.parse(r.body));
      rows = (u && u.rows) || [];
    } catch (e) { console.log('   (못 셈 — ' + String(e.message).slice(0, 50) + ')'); }

    if (rows.length) {
      const today = new Date().toISOString().slice(0, 10);
      const now = rows.filter((r) => (r.DP_START || '') <= today && today <= (r.DP_END || ''));
      const soon = rows.filter((r) => (r.DP_START || '') > today);
      const past = rows.filter((r) => (r.DP_END || '9999') < today);
      const img = rows.filter((r) => r.DP_MAIN_IMG);
      const info = rows.filter((r) => String(r.DP_INFO || '').trim());

      console.log(`   받은 것        ${rows.length}건`);
      console.log(`   ★ 지금 열림    ${now.length}건`);
      console.log(`   앞으로 열림    ${soon.length}건`);
      console.log(`   지난 것        ${past.length}건`);
      console.log(`   포스터 주소 있음 ${img.length}건 · 설명 있음 ${info.length}건`);

      console.log('\n   지금 열리는 전시 (열까지)');
      for (const r of now.slice(0, 10))
        console.log(`     ${String(r.DP_START).slice(0, 10)} ~ ${String(r.DP_END).slice(0, 10)}`
                  + `  ${String(r.DP_NAME || '').replace(/\s+/g, ' ').slice(0, 40)}`
                  + `  · ${String(r.DP_PLACE || '').slice(0, 20)}`);
      if (!now.length) console.log('     (없습니다)');
    }
  }

  console.log('\n──────────────────────────────');
  console.log('★ 이 결과를 보고 수집기를 씁니다. 지금은 아무것도 담지 않았습니다.');
})();
