#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 용어사전 수집 (GOKAMS 한국미술 다국어 용어사전 · 미술 용어)
   ------------------------------------------------------------------
   쓰는 법
     node scripts/collect-terms-gokams.mjs --peek
     node scripts/collect-terms-gokams.mjs --start 1 --end 1400 --dry
     node scripts/collect-terms-gokams.mjs --start 1 --end 1400

   ★ scripts/peek-gokams2.mjs 로 정찰한 결과 — collect-groups-gokams.mjs
     가 쓰려던 group_view.asp(단체)와 달리, <b>art_view.asp(미술 용어)는
     해외 IP를 막지 않습니다</b> — 맨몸 요청으로도 idx=30·103·104·1000이
     실제 내용을 그대로 돌려줍니다. (idx=1·500·1500+ 는 진짜 없는
     번호라 500 — 차단이 아니라 빈 번호입니다.)
   ★ 「미술」·「회」·「시대」·「조각」·「예술」로 넓게 찾아본 결과 idx
     최댓값이 1,119 까지 나왔고, idx=1000 도 실제 항목이라 1,400 까지
     넉넉히 훑습니다.

   ★ 한 항목의 얼개(peek-gokams2.mjs 로 확인):
       <p>국문</p><span>공공미술</span>
       <p>영문</p><span>public art</span>
       <p>한문</p><span>公共美術</span>
       <p>중문</p><span>公共艺术</span>
       <p>일문</p><span>パブリックアート</span>
       <th>비고/구분</th><td>일반</td>
       <th>개념정의</th><td>(국문 정의 글)</td>
   ══════════════════════════════════════════════════════════════════ */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? (argv[i + 1] || d) : d; };
const START = Number(arg('start', 1));
const END   = Number(arg('end', 1400));
const DRY   = argv.includes('--dry');
const PEEK  = argv.includes('--peek');

if (!PEEK && (!SB_URL || !SB_KEY)) {
  console.error('★ SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

const BASE = 'https://www.gokams.or.kr/visual-art/art-terms/glossary/art_view.asp';
const UA = 'OpusfineBot/1.0 (https://opusfine.vercel.app; cser@wixon.co.kr)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(idx) {
  for (let i = 0; i < 4; i++) {
    let res;
    try {
      res = await fetch(BASE + '?idx=' + idx + '&page=1', { headers: { 'User-Agent': UA } });
    } catch (e) {
      await sleep(3000 * (i + 1));
      continue;
    }
    if (res.status === 500) return null;         /* 그 번호는 없는 것 */
    if (res.status === 429) { await sleep(8000 * (i + 1)); continue; }
    if (!res.ok) { await sleep(2000); continue; }
    return await res.text();
  }
  return null;
}

function stripTags(s) {
  return String(s || '').replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function field(html, label) {
  var re = new RegExp('<p>' + label + '</p>\\s*<span>([^<]*)</span>', 'i');
  var m = html.match(re);
  return m ? m[1].trim() : '';
}

function shape(idx, html) {
  var nameKo = field(html, '국문');
  var nameEn = field(html, '영문');
  var nameHan = field(html, '한문');
  var nameCn = field(html, '중문');
  var nameJp = field(html, '일문');

  var catM = html.match(/<th>비고\/구분<\/th>\s*<td>([\s\S]{0,60}?)<\/td>/i);
  var cat = catM ? stripTags(catM[1]) : '';

  var defM = html.match(/<th>개념정의<\/th>\s*<td>([\s\S]{20,4000}?)<\/td>\s*<\/tr>/i);
  var def = defM ? stripTags(defM[1]) : '';

  if (!nameKo) {
    var tM = html.match(/<title>([^<]+)<\/title>/i);
    if (tM) nameKo = tM[1].replace(/\s*[-–|].*$/, '').trim();
  }

  return {
    gokams_idx: idx,
    term_ko: nameKo || null,
    term_en: nameEn || null,
    term_han: nameHan || null,
    term_cn: nameCn || null,
    term_jp: nameJp || null,
    category: cat || null,
    definition_ko: def || null,
    source: 'gokams-art-glossary-20261001',
    hidden: false
  };
}

const COLS = ['gokams_idx', 'term_ko', 'term_en', 'term_han', 'term_cn', 'term_jp',
  'category', 'definition_ko', 'source', 'hidden'];

async function upsert(rows) {
  if (!rows.length) return { ok: 0, msg: '' };
  const r = await fetch(SB_URL + '/rest/v1/glossary?on_conflict=gokams_idx'
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
  console.log(' OPUSFINE 용어사전 수집 (GOKAMS 미술 용어)');
  console.log(' 번호 범위: ' + START + ' ~ ' + END);
  console.log('════════════════════════════════════════════════\n');

  var found = 0, kept = 0, created = 0, byCat = {};
  var batch = [];

  for (var idx = START; idx <= END; idx++) {
    var html = await get(idx);
    await sleep(200);
    if (!html) continue;
    found++;

    var row = shape(idx, html);
    if (!row.term_ko) continue;
    kept++;
    var cat = row.category || '(분류 없음)';
    byCat[cat] = (byCat[cat] || 0) + 1;

    if (PEEK) {
      if (kept <= 15) console.log('  · [' + idx + '] ' + row.term_ko + ' (' + (row.category || '?') + ')');
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
    if (kept % 50 === 0) console.log('  … idx=' + idx + ' 까지 봄 · 걸린 것 ' + kept + '건');
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
  console.log(' 걸린 것 ' + kept + '건' + (PEEK ? ' · 담지 않았습니다(peek)' : ' · 담은 것 ' + created + '건'));
  console.log('════════════════════════════════════════════════');
})();
