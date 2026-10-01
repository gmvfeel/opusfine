#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 미술단체 수집 (GOKAMS 한국미술 다국어 용어사전)
   ------------------------------------------------------------------
   쓰는 법
     node scripts/collect-groups-gokams.mjs --peek
     node scripts/collect-groups-gokams.mjs --peek --end 1600
     node scripts/collect-groups-gokams.mjs --start 1 --end 1600 --dry
     node scripts/collect-groups-gokams.mjs --start 1 --end 1600

   ★ scripts/peek-gokams.mjs 로 정찰한 결과 —
     · 목록 화면(group_list.asp)은 자바스크립트 자동완성/초성검색이라
       사람이 글자를 눌러야만 움직입니다. 빈 검색은 「총 0건」을 보입니다.
     · main/search.asp 에 POST 로 글자를 보내면 걸리는 것만 옵니다 —
       부분 검색이라 모든 단체를 들추지 못합니다(이름에 그 글자가
       없으면 영영 못 찾습니다).
     ▶ 그래서 <b>group_view.asp?idx=N</b> 을 번호 그대로 훑습니다.
       잘못된 번호는 500 오류가 오는데(진짜 없는 자료가 아니라
       art_list/person_list 와 idx 를 나눠 쓰는 체계라 group_view 로는
       안 열리는 번호가 많습니다), 그 번호는 조용히 건너뜁니다.
     ★★ 「회」·「미술」·「연구」·「협회」로 넓게 검색해 본 결과 idx 최댓값이
       1,506 까지 나왔습니다 — 기본 끝 번호를 1,800 으로 넉넉히 잡습니다.

   ★ 오퍼스파인은 이미 전시공간(venues)·기관·재단(institutions) 화면이
     있습니다. GOKAMS 쪽 분류(구분)에는 「미술관/박물관」·「기관/공간」도
     섞여 있어 겹칠 수 있으므로, <b>v1 은 「협회/단체」 분류만</b> 담습니다
     (--all 을 주면 전체 분류를 담습니다).

   ★ 예의상 한 번에 한 번호씩, 사이사이 쉬며 받습니다 — 작은 공공기관
     사이트라 짧은 시간에 몰아치지 않습니다.
   ══════════════════════════════════════════════════════════════════ */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? (argv[i + 1] || d) : d; };
const START = Number(arg('start', 1));
const END   = Number(arg('end', 1800));
const DRY   = argv.includes('--dry');
const PEEK  = argv.includes('--peek');
const ALL_CATS = argv.includes('--all');

if (!PEEK && (!SB_URL || !SB_KEY)) {
  console.error('★ SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

const BASE = 'https://www.gokams.or.kr/visual-art/art-terms/glossary/group_view.asp';
const UA = 'OpusfineBot/1.0 (https://opusfine.vercel.app; cser@wixon.co.kr)';
const KEEP_CATS = ALL_CATS ? null : new Set(['협회/단체']);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

var DEBUG_LEFT = PEEK ? 15 : 0;

async function get(idx) {
  for (let i = 0; i < 4; i++) {
    let res, errMsg = '';
    try {
      res = await fetch(BASE + '?idx=' + idx, { headers: { 'User-Agent': UA } });
    } catch (e) {
      errMsg = e.message;
      if (DEBUG_LEFT > 0) { console.log('  [디버그 idx=' + idx + '] 연결 실패: ' + errMsg); DEBUG_LEFT--; }
      await sleep(3000 * (i + 1));
      continue;
    }
    if (DEBUG_LEFT > 0) {
      console.log('  [디버그 idx=' + idx + '] status ' + res.status);
      DEBUG_LEFT--;
    }
    if (res.status === 500) return null;            /* 그 번호는 없는 것 */
    if (res.status === 429) { await sleep(8000 * (i + 1)); continue; }
    if (!res.ok) { await sleep(2000); continue; }
    return await res.text();
  }
  return null;
}

/* ── group_view.asp 의 html 조각에서 값 뽑기 ──
   ★ 정식 파서(cheerio 등)를 깔지 않고, 구조가 단순한 표라 정규식으로
     충분합니다 — venues/institutions 처럼 표가 아니라 1건짜리 상세라
     "라벨 다음 칸" 패턴만 찾으면 됩니다. */
function pick(html, label) {
  // <th>라벨</th> ... <td>값</td> 또는 라벨: 값 같은 꼴 둘 다 시도
  var re1 = new RegExp(label + '\\s*(?:</[^>]+>)?\\s*(?:<[^>]+>)*\\s*([^<\\n][\\s\\S]{0,400}?)\\s*(?:<\\/t[dh]>|<\\/li>|<\\/div>)', 'i');
  var m = html.match(re1);
  return m ? m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
}
function stripTags(s) {
  return String(s || '').replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function shape(idx, html) {
  // 단체명(국문) — 보통 페이지 맨 위 큰 제목
  var nameKo = pick(html, '단체명') || pick(html, '국문');
  var cat = pick(html, '구분');
  var nameEn = pick(html, '영문|English');
  var nameCn = pick(html, '중문|한문');
  var nameJp = pick(html, '일문|日本語');
  var alias = pick(html, '이칭\\s*/?\\s*별칭');
  var website = pick(html, '웹사이트');
  // 소개(국문) — 가장 긴 문단일 가능성이 높아, 라벨 이후 다음 라벨 전까지 크게 자릅니다
  var introM = html.match(/소개[\s\S]{0,50}?(?:<\/[^>]+>)\s*([\s\S]{20,3000}?)(?:<h\d|<table|웹사이트|관련용어|비고)/i);
  var intro = introM ? stripTags(introM[1]) : '';

  if (!nameKo) {
    // 라벨 패턴이 안 맞으면 <title> 이나 h1/h2 에서라도 건집니다
    var tM = html.match(/<title>([^<]+)<\/title>/i);
    if (tM) nameKo = tM[1].replace(/\s*[-–|].*$/, '').trim();
  }

  return {
    gokams_idx: idx,
    name_ko: nameKo || null,
    name_en: nameEn || null,
    name_cn: nameCn || null,
    name_jp: nameJp || null,
    aliases: alias || null,
    category: cat || null,
    bio: intro || null,
    link_home: website && /^https?:\/\//i.test(website) ? website : null,
    source: 'gokams-glossary-20261001',
    hidden: false
  };
}

const COLS = ['gokams_idx', 'name_ko', 'name_en', 'name_cn', 'name_jp', 'aliases',
  'category', 'bio', 'link_home', 'source', 'hidden'];

async function upsert(rows) {
  if (!rows.length) return { ok: 0, msg: '' };
  const r = await fetch(SB_URL + '/rest/v1/groups?on_conflict=gokams_idx'
    + '&columns=' + encodeURIComponent(COLS.join(',')), {
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

(async () => {
  console.log('════════════════════════════════════════════════');
  console.log(' OPUSFINE 미술단체 수집 (GOKAMS 용어사전)');
  console.log(' 번호 범위: ' + START + ' ~ ' + END
    + (KEEP_CATS ? ' · 분류: 협회/단체만' : ' · 분류: 전체'));
  console.log('════════════════════════════════════════════════\n');

  var found = 0, kept = 0, created = 0, byCat = {};
  var batch = [];

  for (var idx = START; idx <= END; idx++) {
    var html = await get(idx);
    await sleep(220);
    if (!html) continue;
    found++;

    var row = shape(idx, html);
    if (!row.name_ko) continue;
    var cat = row.category || '(분류 없음)';
    byCat[cat] = (byCat[cat] || 0) + 1;

    if (KEEP_CATS && !KEEP_CATS.has(row.category)) continue;
    kept++;

    if (PEEK) {
      if (kept <= 12) {
        console.log('  · [' + idx + '] ' + row.name_ko + ' (' + (row.category || '?') + ')');
      }
      continue;
    }

    batch.push(row);
    if (batch.length >= 20) {
      if (DRY) {
        console.log('  (dry) ' + batch.length + '건 · 누적 ' + kept);
      } else {
        var res = await upsert(batch);
        if (!res.ok && batch.length) console.log('  ✗ 담기 실패(' + idx + '): ' + res.msg);
        else created += res.ok;
      }
      batch = [];
    }
    if (kept % 20 === 0) console.log('  … idx=' + idx + ' 까지 봄 · 걸린 것 ' + kept + '건');
  }

  if (batch.length && !PEEK) {
    if (DRY) console.log('  (dry) 마지막 ' + batch.length + '건');
    else {
      var res2 = await upsert(batch);
      if (!res2.ok) console.log('  ✗ 담기 실패(마지막): ' + res2.msg);
      else created += res2.ok;
    }
  }

  console.log('\n════════════════════════════════════════════════');
  console.log(' 번호 ' + (END - START + 1) + '개 중 자료 있음 ' + found + '건 · 분류별:');
  Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; })
    .forEach(function (c) { console.log('   ' + c + ' · ' + byCat[c] + '건'); });
  console.log(' 걸린 것(담을 대상) ' + kept + '건' + (PEEK ? ' · 담지 않았습니다(peek)' : ' · 담은 것 ' + created + '건'));
  console.log('════════════════════════════════════════════════');
})();
