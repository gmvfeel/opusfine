// ============================================================
// OPUSFINE · 학술(미술) 정찰 2차 — 좁혀서 안을 들여다봅니다
//
//  ★ 1차 정찰의 잘못
//    topic 이름에 'art' 나 'archaeology' 가 스치기만 해도 subfield 를
//    주웠습니다. 그래서 교육학 726만 건 · 철학 300만 건 · 고고학 다섯 갈래가
//    딸려 왔습니다. 오퍼스클램이 'search= 를 쓰면 안 된다'고 적어둔 것과
//    같은 실수를 topic 이름 검색으로 되풀이한 것입니다.
//
//  ★ 이번에는
//    진짜 미술인 subfield 셋만 놓고, 그 안의 topic 을 전부 꺼내
//    <b>무엇이 들어 있는지</b> 봅니다. 특히 1213 은 이름이
//    'Visual Arts and Performing Arts' 라 공연 논문이 섞여 있을 것입니다.
//
//  ★ 이 파일도 DB 를 건드리지 않습니다. Supabase 열쇠를 쓰지 않습니다.
// ============================================================

const OA   = 'https://api.openalex.org';
const MAIL = 'cser@wixon.co.kr';
const UA   = 'OpusfineBot/1.0 (https://opusfine.vercel.app; ' + MAIL + ')';

// 1차에서 확인된 진짜 미술 subfield 셋 (숫자를 짐작하지 않고 받아온 것입니다)
const SUBS = [
  { id: '1213', name: 'Visual Arts and Performing Arts' },
  { id: '1209', name: 'Museology' },
  { id: '1206', name: 'Conservation' },
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function get(path) {
  const url = OA + path + (path.includes('?') ? '&' : '?') + 'mailto=' + encodeURIComponent(MAIL);
  for (let i = 0; i < 6; i++) {
    let res;
    try {
      res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    } catch (e) {
      console.log('    (연결 실패 · 다시 시도) ' + e.message);
      await sleep(5000 * (i + 1));
      continue;
    }
    if (res.status === 429) {
      const ra = Number(res.headers.get('Retry-After') || 0);
      const wait = Math.min(ra ? ra * 1000 : 8000 * (i + 1), 90000);
      console.log('    (429 · ' + Math.round(wait / 1000) + '초 쉽니다)');
      await sleep(wait);
      continue;
    }
    if (!res.ok) { console.log('    (HTTP ' + res.status + ')'); await sleep(4000); continue; }
    return await res.json();
  }
  return null;
}

async function count(filter) {
  const d = await get('/works?per_page=1&filter=' + encodeURIComponent(filter));
  return d && d.meta ? d.meta.count : null;
}

// ── 미술인지 공연인지 갈라 보는 잣대 ─────────────────────────
// 판정이 아니라 <b>눈으로 보시라고</b> 표시만 합니다. 이 잣대로 거르지 않습니다.
const LOOKS_PERFORM = /music|dance|theat|performance|opera|drama|film|cinema|acting|choreograph/i;
const LOOKS_VISUAL  = /art|paint|sculpt|museum|gallery|visual|craft|ceramic|photograph|architect|design|heritage|conservation|curat|exhibit/i;

(async () => {
  console.log('════════════════════════════════════════════════');
  console.log(' OPUSFINE 학술(미술) 정찰 2차 · 담지 않습니다');
  console.log('════════════════════════════════════════════════\n');

  // ── ① subfield 안에 무엇이 들어 있나 ──────────────────────
  for (const s of SUBS) {
    console.log('\n──────────────────────────────────────────');
    console.log('[' + s.id + '] ' + s.name);
    console.log('──────────────────────────────────────────');

    const d = await get('/topics?per_page=200&filter=subfield.id:' + s.id);
    await sleep(1200);
    if (!d || !Array.isArray(d.results)) { console.log('  응답 없음'); continue; }

    const vis = [], per = [], etc = [];
    for (const t of d.results) {
      const nm = t.display_name || '';
      if (LOOKS_PERFORM.test(nm) && !LOOKS_VISUAL.test(nm)) per.push(t);
      else if (LOOKS_VISUAL.test(nm)) vis.push(t);
      else etc.push(t);
    }
    console.log('  topic ' + d.results.length + '개 · 미술로 보이는 것 ' + vis.length
      + ' · 공연으로 보이는 것 ' + per.length + ' · 애매한 것 ' + etc.length);

    const show = (label, arr) => {
      if (!arr.length) return;
      console.log('\n  ▶ ' + label);
      for (const t of arr) {
        const id = String(t.id).split('/').pop();
        console.log('     ' + id.padEnd(8) + String(t.works_count ?? '?').padStart(8) + '  ' + t.display_name);
      }
    };
    show('미술로 보이는 것', vis);
    show('공연으로 보이는 것 ← 이것들이 섞여 있습니다', per);
    show('애매한 것 ← 파트너께서 보셔야 합니다', etc);
  }

  // ── ② 한국 소속 논문을 topic 별로 ─────────────────────────
  console.log('\n\n══════════════════════════════════════════════');
  console.log(' 한국 소속 저자의 논문 · topic 별로 많은 순');
  console.log('══════════════════════════════════════════════');
  for (const s of SUBS) {
    const d = await get('/works?per_page=1&filter='
      + encodeURIComponent('primary_topic.subfield.id:' + s.id + ',institutions.country_code:kr')
      + '&group_by=primary_topic.id');
    await sleep(1500);
    console.log('\n[' + s.id + '] ' + s.name);
    if (!d || !Array.isArray(d.group_by)) { console.log('  응답 없음'); continue; }
    for (const g of d.group_by.slice(0, 15)) {
      if (!g.count) continue;
      console.log('   ' + String(g.count).padStart(6) + '  ' + (g.key_display_name || g.key));
    }
  }

  // ── ③ 한국 미술 낱말 · 이번엔 subfield 안에서만 ───────────
  console.log('\n\n══════════════════════════════════════════════');
  console.log(' 한국 미술 낱말 · 미술 subfield 안에서만 셉니다');
  console.log(' (1차에서는 분야 제한 없이 세어 부풀려져 있었습니다)');
  console.log('══════════════════════════════════════════════');
  const IN3 = 'primary_topic.subfield.id:1213|1209|1206';
  const WORDS = [
    'Korean art', 'Korean painting', 'Joseon painting', 'Korean ceramics',
    'Korean Buddhist art', 'Korean contemporary art', 'Goryeo celadon',
    'Korean calligraphy', 'Dansaekhwa', 'Korean folk painting',
  ];
  console.log('   ' + '낱말'.padEnd(28) + '전체'.padStart(9) + '미술분야만'.padStart(12));
  console.log('   ' + '─'.repeat(50));
  for (const w of WORDS) {
    const a = await count('title.search:' + w);
    await sleep(1200);
    const b = await count('title.search:' + w + ',' + IN3);
    await sleep(1200);
    console.log('   ' + String(w).padEnd(28) + String(a ?? '?').padStart(9) + String(b ?? '?').padStart(12));
  }

  // ── ④ 실제로 어떤 논문이 오는지 열 건 ─────────────────────
  console.log('\n\n══════════════════════════════════════════════');
  console.log(' 실제로 무엇이 오는지 · 한국 소속 · 미술분야 · 최근 10건');
  console.log(' ★ 숫자보다 이것을 보셔야 합니다');
  console.log('══════════════════════════════════════════════');
  const d = await get('/works?per_page=10&sort=publication_date:desc&filter='
    + encodeURIComponent(IN3 + ',institutions.country_code:kr')
    + '&select=' + encodeURIComponent('id,title,publication_year,primary_topic,authorships'));
  if (d && Array.isArray(d.results)) {
    for (const w of d.results) {
      const au = (w.authorships || []).slice(0, 2)
        .map(a => a.author && a.author.display_name).filter(Boolean).join(', ');
      console.log('\n   · ' + (w.title || '(제목 없음)'));
      console.log('     ' + (w.publication_year || '?') + ' · ' + (au || '저자 미상'));
      console.log('     주제: ' + ((w.primary_topic && w.primary_topic.display_name) || '?'));
    }
  } else {
    console.log('   응답 없음');
  }

  console.log('\n════════════════════════════════════════════════');
  console.log(' 끝. 담은 것은 없습니다.');
  console.log('════════════════════════════════════════════════');
})();
