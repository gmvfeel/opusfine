// ============================================================
// OPUSFINE · 학술(미술) 정찰기 — 세기만 합니다
//
//  ★ 이 파일은 DB 를 건드리지 않습니다. 담지 않습니다. 세기만 합니다.
//    Supabase 열쇠도 쓰지 않습니다.
//
//  무엇을 보는가
//    ① OpenAlex 에 미술 관련 subfield 가 실제로 있는가 · 이름과 번호
//    ② 각 subfield 에 논문이 몇 건인가
//    ③ 그중 한국 소속 저자의 논문이 몇 건인가
//    ④ 한국 미술 관련 낱말로 찾으면 몇 건인가
//
//  왜 이렇게 하는가 (오퍼스클램에서 값을 치르고 배운 것)
//    - search= 로 찾으면 본문에 낱말이 한 번 스친 무관한 논문이 대량 섞입니다.
//      그래서 subfield 로 거릅니다.
//    - 만들기 전에 확인합니다. peek → dry → 담기.
// ============================================================

const OA   = 'https://api.openalex.org';
const MAIL = 'cser@wixon.co.kr';                 // OpenAlex polite pool (오퍼스클램과 같은 연락처)
const UA   = 'OpusfineBot/1.0 (https://opusfine.vercel.app; ' + MAIL + ')';

// ── 부드럽게 두드리기 ────────────────────────────────────────
// GitHub Actions 는 여러 사람이 IP 를 나눠 쓰므로 429 가 자주 납니다.
// 우리 탓이 아니라 남이 쓴 몫까지 합산되기 때문입니다. 넉넉히 기다립니다.
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function get(path) {
  const url = OA + path + (path.includes('?') ? '&' : '?') + 'mailto=' + encodeURIComponent(MAIL);
  for (let i = 0; i < 6; i++) {
    let res;
    try {
      res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    } catch (e) {
      console.log('    (연결 실패 · 다시 시도합니다) ' + e.message);
      await sleep(5000 * (i + 1));
      continue;
    }
    if (res.status === 429) {
      const ra = Number(res.headers.get('Retry-After') || 0);
      const wait = Math.min(ra ? ra * 1000 : 8000 * (i + 1), 90000);
      console.log('    (429 요청과다 · ' + Math.round(wait / 1000) + '초 쉽니다)');
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      console.log('    (HTTP ' + res.status + ')');
      await sleep(4000);
      continue;
    }
    return await res.json();
  }
  return null;
}

// 건수만 세는 요청 — per_page=1 로 최소한만 받고 meta.count 를 봅니다
async function count(filter) {
  const d = await get('/works?per_page=1&filter=' + encodeURIComponent(filter));
  return d && d.meta ? d.meta.count : null;
}

// ── ① 미술 subfield 찾기 ─────────────────────────────────────
// 이름을 짐작해 박아 넣지 않습니다. 실제로 찾아서 무엇이 있는지 봅니다.
const PROBES = [
  'art', 'art history', 'visual arts', 'fine arts',
  'art history and theory', 'museum', 'aesthetics', 'archaeology',
];

async function findSubfields() {
  const found = new Map();   // id → { name, field, works }
  for (const q of PROBES) {
    const d = await get('/topics?per_page=200&filter=display_name.search:' + encodeURIComponent(q));
    if (!d || !Array.isArray(d.results)) { console.log('  · "' + q + '" → 응답 없음'); continue; }
    let n = 0;
    for (const t of d.results) {
      const sf = t.subfield;
      if (!sf || !sf.id) continue;
      const id = String(sf.id).split('/').pop();
      if (!found.has(id)) {
        found.set(id, {
          name:  sf.display_name || '(이름 없음)',
          field: (t.field && t.field.display_name) || '',
          topics: [],
        });
        n++;
      }
      const rec = found.get(id);
      if (rec.topics.length < 4) rec.topics.push(t.display_name);
    }
    console.log('  · "' + q + '" → topic ' + d.results.length + '건 · 새 subfield ' + n + '개');
    await sleep(1200);
  }
  return found;
}

// ── 실행 ─────────────────────────────────────────────────────
(async () => {
  console.log('════════════════════════════════════════════════');
  console.log(' OPUSFINE 학술(미술) 정찰 · 담지 않습니다');
  console.log('════════════════════════════════════════════════\n');

  console.log('① 미술 관련 subfield 를 찾습니다');
  const subs = await findSubfields();
  if (!subs.size) {
    console.log('\n  ✗ 하나도 못 찾았습니다. 요청이 막혔을 수 있습니다.');
    process.exit(0);
  }

  console.log('\n  찾은 subfield ' + subs.size + '개');
  for (const [id, v] of subs) {
    console.log('    ' + id.padEnd(6) + ' ' + v.name + '   [' + v.field + ']');
    console.log('           보기: ' + v.topics.join(' · '));
  }

  console.log('\n② subfield 마다 논문이 몇 건인지 셉니다');
  console.log('   ' + 'id'.padEnd(6) + ' ' + 'subfield'.padEnd(34) + ' ' + '전체'.padStart(10) + ' ' + '한국소속'.padStart(9));
  console.log('   ' + '─'.repeat(64));
  const rows = [];
  for (const [id, v] of subs) {
    const all = await count('primary_topic.subfield.id:' + id);
    await sleep(1200);
    const kr  = await count('primary_topic.subfield.id:' + id + ',institutions.country_code:kr');
    await sleep(1200);
    rows.push({ id, name: v.name, all, kr });
    console.log('   ' + id.padEnd(6) + ' ' + String(v.name).slice(0, 34).padEnd(34)
      + ' ' + String(all ?? '?').padStart(10) + ' ' + String(kr ?? '?').padStart(9));
  }

  console.log('\n③ 한국 미술 낱말로 제목을 찾으면 몇 건인지 봅니다');
  console.log('   (subfield 와 겹칩니다. 더하지 마십시오)');
  const KR_WORDS = [
    'Korean art', 'Korean painting', 'Korean ceramics', 'Korean Buddhist art',
    'Joseon painting', 'Korean contemporary art', 'Korean artist',
    'Goryeo celadon', 'Korean calligraphy', 'Dansaekhwa',
  ];
  for (const w of KR_WORDS) {
    const n = await count('title.search:' + w);
    console.log('   ' + String(w).padEnd(30) + String(n ?? '?').padStart(8));
    await sleep(1200);
  }

  const top = rows.filter(r => r.all).sort((a, b) => b.all - a.all)[0];
  console.log('\n════════════════════════════════════════════════');
  console.log(' 요약');
  console.log('   subfield ' + subs.size + '개 · 가장 큰 것: '
    + (top ? top.name + ' (' + top.all.toLocaleString() + '건)' : '판정 불가'));
  console.log('   한국소속 합계(겹침 포함): '
    + rows.reduce((s, r) => s + (r.kr || 0), 0).toLocaleString() + '건');
  console.log('════════════════════════════════════════════════');
  console.log('\n※ 이 수치는 「받을 수 있는 최대」입니다.');
  console.log('   실제로 담을 때는 걸러내기 관문을 지나므로 줄어듭니다.');
})();
