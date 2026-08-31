// ============================================================
// OPUSFINE · 진단 · 위키데이터가 무엇을 주는지 날것으로 봅니다
//   scripts/diag-wd-label.mjs
//
//  ★ 왜 만들었나
//    fill-nameko-wd.mjs 가 128명 전원 0건을 냈습니다.
//    Kim Beom(김범) · Lee Hyung-koo(이형구) 처럼 한국어 위키백과에
//    문서가 있을 법한 작가까지 「라벨도 문서도 없다」로 나왔습니다.
//    <b>자료가 없는 것인지 제 코드가 틀린 것인지</b> 갈라야 합니다.
//
//  ★ 이 파일은 DB 도 건드리지 않고 Supabase 열쇠도 쓰지 않습니다.
//    작가 번호를 손으로 박아 넣고, 받은 것을 <b>그대로 찍습니다.</b>
//
//  ★ 무엇을 갈라 보는가
//    ① 한 개씩 부를 때 · 여러 개를 세로줄로 이어 부를 때
//    ② props 를 세로줄로 이을 때 · 따로따로 부를 때
//    ③ origin=* 를 붙일 때 · 뗄 때
//    ④ 응답의 열쇠(key) 이름이 무엇인지 — 우리가 넣은 번호와 같은지
// ============================================================

const UA = 'OpusfineBot/1.0 (https://opusfine.vercel.app; cser@wixon.co.kr)';
const WD = 'https://www.wikidata.org/w/api.php';

/* 로그에서 본 작가들 · 한국어 문서가 있을 법한 쪽을 골랐습니다 */
const SAMPLE = [
  { qid: 'Q17466325', now: 'Kim Beom' },
  { qid: 'Q3228889',  now: 'Lee Hyung-koo' },
  { qid: 'Q1741599',  now: 'Kim Young-hee' },
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function raw(url, label) {
  console.log('\n────────────────────────────────────────────');
  console.log('▶ ' + label);
  console.log('  ' + url);
  let res;
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  } catch (e) {
    console.log('  ✗ 연결 실패: ' + e.message);
    return null;
  }
  console.log('  HTTP ' + res.status + ' · ' + (res.headers.get('content-type') || '?'));
  const text = await res.text();
  console.log('  길이 ' + text.length + '바이트');
  console.log('  앞 400자:');
  console.log('  ' + text.slice(0, 400).replace(/\n/g, '\n  '));
  let json = null;
  try { json = JSON.parse(text); }
  catch (e) { console.log('  ✗ JSON 이 아닙니다: ' + e.message); return null; }
  if (json.error) {
    console.log('  ✗ 위키데이터가 오류를 냈습니다:');
    console.log('    ' + JSON.stringify(json.error).slice(0, 300));
  }
  return json;
}

/* 받은 것에서 우리가 찾던 것이 있는지 짚어 봅니다 */
function inspect(json) {
  if (!json) return;
  console.log('\n  ── 뜯어보기 ──');
  console.log('  최상위 열쇠: ' + Object.keys(json).join(', '));
  const ents = json.entities;
  if (!ents) { console.log('  ✗ entities 가 없습니다'); return; }
  console.log('  entities 열쇠: ' + Object.keys(ents).join(', '));
  for (const k of Object.keys(ents)) {
    const e = ents[k] || {};
    const labels = e.labels || {};
    const sites  = e.sitelinks || {};
    const lk = Object.keys(labels);
    const sk = Object.keys(sites);
    console.log('\n  [' + k + ']');
    console.log('    항목 열쇠: ' + Object.keys(e).join(', '));
    console.log('    labels 개수 ' + lk.length
      + (lk.length ? ' · 보기: ' + lk.slice(0, 12).join(',') : ''));
    console.log('    ko 라벨: ' + (labels.ko ? JSON.stringify(labels.ko) : '없음'));
    console.log('    en 라벨: ' + (labels.en ? JSON.stringify(labels.en).slice(0, 120) : '없음'));
    console.log('    sitelinks 개수 ' + sk.length
      + (sk.length ? ' · 보기: ' + sk.slice(0, 12).join(',') : ''));
    console.log('    kowiki: ' + (sites.kowiki ? JSON.stringify(sites.kowiki).slice(0, 200) : '없음'));
    console.log('    zhwiki: ' + (sites.zhwiki ? JSON.stringify(sites.zhwiki).slice(0, 200) : '없음'));
  }
}

(async () => {
  console.log('══════════════════════════════════════════════');
  console.log(' 진단 · 위키데이터 응답 날것 보기 · 담지 않습니다');
  console.log('══════════════════════════════════════════════');
  console.log('\n살펴볼 작가');
  for (const s of SAMPLE) console.log('  ' + s.qid + '  ' + s.now);

  const q1 = SAMPLE[0].qid;
  const ids3 = SAMPLE.map(s => s.qid).join('|');

  // ① 가장 단순한 꼴 — 한 개 · props 하나 · origin 없음
  inspect(await raw(
    `${WD}?action=wbgetentities&ids=${q1}&props=labels&format=json`,
    '① 한 개 · props=labels · origin 없음'
  ));
  await sleep(1500);

  // ② props 를 세로줄로 이었을 때 ← 여기가 의심스럽습니다
  inspect(await raw(
    `${WD}?action=wbgetentities&ids=${q1}&props=labels|sitelinks&format=json`,
    '② 한 개 · props=labels|sitelinks (세로줄 그대로)'
  ));
  await sleep(1500);

  // ③ props 세로줄을 인코딩했을 때
  inspect(await raw(
    `${WD}?action=wbgetentities&ids=${q1}&props=${encodeURIComponent('labels|sitelinks')}&format=json`,
    '③ 한 개 · props 세로줄을 %7C 로 인코딩'
  ));
  await sleep(1500);

  // ④ origin=* 를 붙였을 때 ← fill-nameko 가 쓴 꼴
  inspect(await raw(
    `${WD}?action=wbgetentities&ids=${q1}&props=labels|sitelinks&format=json&origin=*`,
    '④ 한 개 · origin=* 붙임 (fill-nameko 가 쓴 꼴)'
  ));
  await sleep(1500);

  // ⑤ 여러 개를 세로줄로 이었을 때
  inspect(await raw(
    `${WD}?action=wbgetentities&ids=${ids3}&props=labels|sitelinks&format=json&origin=*`,
    '⑤ 세 개 · 세로줄로 이음 · origin=* (fill-nameko 가 쓴 꼴 그대로)'
  ));
  await sleep(1500);

  // ⑥ sitelinks 만 · 한국어 문서가 정말 있는지
  inspect(await raw(
    `${WD}?action=wbgetentities&ids=${ids3}&props=sitelinks&sitefilter=kowiki&format=json`,
    '⑥ 세 개 · sitelinks 만 · kowiki 로 좁힘'
  ));

  console.log('\n══════════════════════════════════════════════');
  console.log(' 끝. 어느 꼴에서 ko 라벨이나 kowiki 가 나왔는지');
  console.log(' 위 로그를 견주어 보면 원인이 갈립니다.');
  console.log('══════════════════════════════════════════════');
})();
