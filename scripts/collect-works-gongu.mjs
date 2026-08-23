#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 공유마당 탐색 · scripts/collect-works-gongu.mjs
   ------------------------------------------------------------------
   쓰는 법
     node scripts/collect-works-gongu.mjs --peek

   ★★ 왜 공유마당인가 (2026-08-23 · 확인함)
     · 회화 분류에만 <b>30,603건</b>. 서예·조형·공예·소묘·판화도 따로.
     · 저작권을 <b>「만료저작물」</b>로 거를 수 있습니다 — 우리가 손으로
       하던 「사후 70년」 판단을 그쪽이 이미 해 두었습니다.
     · 제공처에 <b>한국미술정보센터·국립중앙박물관·국립현대미술관·
       문화재청·국립민속박물관·한국미술협회</b>가 있습니다.

   ★★ 오늘 두 번 막힌 것을 되풀이하지 않기 위한 순서
       ① <b>닿는가</b> — api.kcisa.kr 은 GitHub 서버에서 못 닿았습니다.
                      이것부터 봅니다. 못 닿으면 나머지는 뜻이 없습니다.
       ② <b>자료가 오는가</b> — 목록에서 몇 건이 잡히는가
       ③ <b>도판이 뜨는가</b> — 실제 그림 주소를 받아 불러 봅니다
       ④ 제공처·저작권 <b>코드값</b>을 알아냅니다 (짐작하지 않습니다)

   ★ 목록 쪽은 <b>열쇠 없이도</b> 열립니다(공개 화면). 그래서 ①~④ 를
     열쇠 없이 먼저 봅니다. 공식 API 주소는 열쇠 화면에 적혀 있는데
     아직 모르므로, 알게 되면 그때 붙입니다.

   ★ 긁기(scraping)는 <b>확인용으로만</b> 씁니다. 실제 수집은
     공식 API 로 합니다 — 남의 화면을 긁어 쓰는 것은 예의가 아니고
     화면이 바뀌면 조용히 깨집니다.
   ══════════════════════════════════════════════════════════════════ */

import { makeGetJSON } from './lib/http.mjs';

const KEY = process.env.GONGU_KEY || '';
const UA  = 'OpusfineBot/1.0 (https://opusfine.com; cser@wixon.co.kr)';
const BASE = 'https://gongu.copyright.or.kr';

/* 화면에서 확인한 갈래 코드 */
const LIST = BASE + '/gongu/wrt/wrtCl/listWrtImage.do';
const CLS = [
  { name: '회화',       wrtTy: 10004, cl: 10035 },
  { name: '서예',       wrtTy: 10004, cl: 10040 },
  { name: '조형',       wrtTy: 10004, cl: 10038 },
  { name: '캘리그라피', wrtTy: 10004, cl: 10036 },
  { name: '만화',       wrtTy: 10004, cl: 10042 }
];

async function raw(u) {
  const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xml,*/*' } });
  return { status: r.status, type: r.headers.get('content-type') || '', body: await r.text() };
}

/* ── 화면에서 값 뽑기 ──
   ★ 정규식으로 화면을 읽습니다. 확인용이라 이 정도면 됩니다.
     실제 수집은 API 로 하므로 여기 규칙이 깨져도 자료가 상하지 않습니다. */
function total(html) {
  const m = /총\s*:\s*<[^>]*>?\s*([\d,]+)\s*<?[^>]*>?\s*건/.exec(html)
         || /([\d,]{3,})\s*건/.exec(html);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}
function items(html) {
  const out = [];
  const re = /wrt\/wrt\/view\.do\?wrtSn=(\d+)[^"']*["'][^>]*>([^<]{1,80})</g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const t = m[2].replace(/\s+/g, ' ').trim();
    if (t && !/이미지$/.test(t)) out.push({ sn: m[1], title: t });
  }
  /* 같은 것이 두 번 잡힙니다(그림 링크 + 글자 링크) */
  const seen = new Set();
  return out.filter((x) => (seen.has(x.sn) ? false : (seen.add(x.sn), true)));
}
/* 고르개의 코드값 — 짐작하지 않고 화면에서 뽑습니다 */
function options(html, nameHint) {
  const out = [];
  const re = new RegExp('<(?:option|input)[^>]*value=["\'](\\d{1,8})["\'][^>]*>\\s*([^<]{1,30})', 'g');
  let m;
  while ((m = re.exec(html)) !== null) {
    const t = m[2].trim();
    if (t && (!nameHint || nameHint.test(t))) out.push([t, m[1]]);
  }
  return out;
}

(async () => {
  console.log('▶ 공유마당 탐색 — 담지 않습니다\n');
  console.log('  열쇠: ' + (KEY ? '있음(' + KEY.slice(0, 8) + '…)' : '없음 — 목록 확인만 합니다') + '\n');

  /* ── ① 닿는가 ── */
  console.log('── ① GitHub 서버에서 닿는가');
  let home = null;
  try { home = await raw(BASE + '/gongu/main/main.do'); }
  catch (e) {
    console.log('   ✕ 못 닿습니다 — ' + String(e.message).slice(0, 120));
    console.log('     (api.kcisa.kr 과 같은 증상입니다. 이러면 GitHub Actions 에서는');
    console.log('      수집할 수 없고, 다른 자리에서 돌리거나 중계가 필요합니다.)');
    return;
  }
  console.log(`   ✔ 닿습니다 — HTTP ${home.status} · ${home.body.length}바이트\n`);

  /* ── ② 갈래마다 몇 건인가 ── */
  console.log('── ② 갈래마다 몇 건인가');
  let firstHtml = null;
  for (const c of CLS) {
    const u = `${LIST}?menuNo=200018&pageIndex=1&sortSe=date&wrtTy=${c.wrtTy}&depth2ClSn=${c.cl}&pageUnit=24`;
    let r = null;
    try { r = await raw(u); } catch (e) { console.log(`   ${c.name} ✕ ${e.message}`); continue; }
    const n = total(r.body);
    console.log(`   ${c.name.padEnd(12)} ${n == null ? '(못 셈)' : n.toLocaleString() + '건'}`);
    if (!firstHtml) firstHtml = r.body;
  }

  /* ── ③ 제공처·저작권 코드값 ── */
  console.log('\n── ③ 고르개 코드값 (짐작하지 않고 화면에서 뽑습니다)');
  if (firstHtml) {
    const prov = options(firstHtml, /미술정보|박물관|미술관|문화재청|미술협회|고전번역/);
    if (prov.length) {
      console.log('   제공처');
      prov.slice(0, 15).forEach(([t, v]) => console.log(`     ${t.padEnd(20)} ${v}`));
    } else {
      console.log('   (제공처 코드를 화면에서 못 뽑았습니다 — 화면 구조가 다릅니다)');
    }
  }

  /* ── ④ 한 점을 열어 도판 주소를 봅니다 ── */
  console.log('\n── ④ 도판이 뜨는가');
  if (!firstHtml) { console.log('   (목록을 못 받아 건너뜁니다)'); return; }
  const list = items(firstHtml);
  console.log(`   목록에서 잡은 항목 ${list.length}개`);
  if (!list.length) { console.log('   (항목을 못 뽑았습니다)'); return; }

  for (const it of list.slice(0, 3)) {
    console.log(`\n   ▸ ${it.title} (wrtSn=${it.sn})`);
    let d = null;
    try { d = await raw(`${BASE}/gongu/wrt/wrt/view.do?wrtSn=${it.sn}&menuNo=200018`); }
    catch (e) { console.log('     ✕ 상세를 못 받음'); continue; }

    /* 도판 주소로 보이는 것 */
    const imgs = [...new Set([...d.body.matchAll(/(?:src|href)=["']([^"']*(?:thumb|image|img|down|file)[^"']*)["']/gi)]
      .map((m) => m[1])
      .filter((u) => !/static\/gongu\/img/.test(u))
      .map((u) => (u.startsWith('http') ? u : BASE + u)))].slice(0, 6);

    if (!imgs.length) { console.log('     ✕ 도판 주소를 못 찾음'); continue; }
    for (const u of imgs) {
      let ok = '?', len = 0, ct = '';
      try {
        const r = await fetch(u, { headers: { 'User-Agent': UA } });
        ct = r.headers.get('content-type') || '';
        const b = await r.arrayBuffer();
        len = b.byteLength;
        ok = (r.ok && /image/.test(ct) && len > 3000) ? '뜸 ✔' : `HTTP ${r.status}`;
      } catch (e) { ok = '✕ ' + String(e.message).slice(0, 40); }
      console.log(`     [${ok}] ${ct.split(';')[0]} ${len}바이트`);
      console.log(`       ${u.slice(0, 110)}`);
    }

    /* 저작권 표시 */
    const lic = /(만료저작물|기증저작물|공공누리|제\s*1\s*유형|CC[- ]?BY[-A-Z]*)/.exec(d.body);
    if (lic) console.log(`     저작권 표시: ${lic[1]}`);
  }

  console.log('\n──────────────────────────────');
  console.log('★ 이 결과를 보내 주시면 다음을 정합니다.');
  console.log('  · 닿는다 → 공식 API 주소를 열쇠 화면에서 확인해 붙입니다');
  console.log('  · 도판이 뜬다 → 어느 주소꼴을 쓸지 정합니다');
  console.log('  지금은 아무것도 담지 않았습니다.');
})();
