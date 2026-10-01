#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 학술 논문 수집 (OpenAlex) · scripts/collect-papers-openalex.mjs
   ------------------------------------------------------------------
   쓰는 법
     node scripts/collect-papers-openalex.mjs --peek
     node scripts/collect-papers-openalex.mjs --limit 500 --dry
     node scripts/collect-papers-openalex.mjs --limit 20000
     node scripts/collect-papers-openalex.mjs --limit 20000 --kr-only

   ★ 앞서 scripts/peek-academic-art.mjs · peek-academic-art2.mjs 로
     정찰한 결과 — 미술로 또렷이 잡히는 subfield 셋입니다.
       1213  Visual Arts and Performing Arts (공연 논문이 섞여 있음)
       1209  Museology
       1206  Conservation
     1213 은 이름 그대로 공연예술(음악·무용·연극·영화)이 섞입니다.
     이 스크립트는 거르지 않고 <b>받아 온 것을 topic 글자와 함께</b>
     담습니다 — 화면에서 topic 을 보여 주면 사람이 직접 가를 수 있고,
     스크립트가 섣불리 잘라내는 것보다 투명합니다.

   ★ OpenAlex 는 열쇠가 필요 없는 공개 API 입니다(mailto 를 붙이면
     더 너그러운 처리를 받습니다 — "polite pool").
     https://docs.openalex.org

   ★ cursor 쪽매김(파셈)을 씁니다 — offset 쪽매김은 1만 건이 한도이고
     이 자료는 그보다 많습니다.

   ★ --kr-only 를 주면 institutions.country_code:kr 조건을 더합니다
     (논문에 참여한 기관 중 하나라도 한국이면 걸립니다). 오퍼스파인은
     한국 미술 아카이브이므로 처음엔 이 쪽으로 좁혀 받습니다.

   ★ openalex_id 로 on_conflict upsert — 같은 논문을 두 번 담지 않습니다.
   ══════════════════════════════════════════════════════════════════ */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? (argv[i + 1] || d) : d; };
const LIMIT   = Number(arg('limit', 2000));
const DRY     = argv.includes('--dry');
const PEEK    = argv.includes('--peek');
const KR_ONLY = argv.includes('--kr-only');

if (!PEEK && (!SB_URL || !SB_KEY)) {
  console.error('★ SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

const OA   = 'https://api.openalex.org';
const MAIL = 'cser@wixon.co.kr';
const UA   = 'OpusfineBot/1.0 (https://opusfine.vercel.app; ' + MAIL + ')';
const SUBFIELDS = '1213|1209|1206';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
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

function filterStr() {
  let f = 'primary_topic.subfield.id:' + SUBFIELDS;
  if (KR_ONLY) f += ',institutions.country_code:kr';
  return f;
}

function shape(w) {
  const authors = (w.authorships || []).slice(0, 6)
    .map((a) => a.author && a.author.display_name).filter(Boolean).join(', ');
  const countries = Array.from(new Set(
    (w.authorships || []).flatMap((a) => a.countries || [])
  )).join(',');
  const loc = w.primary_location || {};
  const src = loc.source || {};
  return {
    openalex_id:    String(w.id || '').split('/').pop(),
    title:          w.title || w.display_name || '(제목 없음)',
    authors,
    year:           w.publication_year || null,
    venue:          src.display_name || null,
    topic:          (w.primary_topic && w.primary_topic.display_name) || null,
    doi:            w.doi || null,
    url:            loc.landing_page_url || (w.open_access && w.open_access.oa_url) || w.doi || null,
    is_oa:          !!(w.open_access && w.open_access.is_oa),
    cited_by_count: w.cited_by_count || 0,
    country:        countries || null,
    source:         'openalex-' + SUBFIELDS.replace(/\|/g, '-') + (KR_ONLY ? '-kr' : ''),
    hidden:         false
  };
}

const COLS = ['openalex_id', 'title', 'authors', 'year', 'venue', 'topic', 'doi',
  'url', 'is_oa', 'cited_by_count', 'country', 'source', 'hidden'];

async function upsert(rows) {
  if (!rows.length) return { ok: 0, msg: '' };
  const r = await fetch(SB_URL + '/rest/v1/papers?on_conflict=openalex_id'
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
  console.log(' OPUSFINE 학술 논문 수집 (OpenAlex)');
  console.log(' 조건: ' + filterStr());
  console.log('════════════════════════════════════════════════\n');

  if (PEEK) {
    const d = await get(OA + '/works?per_page=1&filter=' + encodeURIComponent(filterStr())
      + '&mailto=' + encodeURIComponent(MAIL));
    console.log('전체 맞는 건수: ' + (d && d.meta ? d.meta.count : '?'));

    const d2 = await get(OA + '/works?per_page=10&sort=cited_by_count:desc&filter='
      + encodeURIComponent(filterStr()) + '&mailto=' + encodeURIComponent(MAIL));
    console.log('\n많이 인용된 것 10건:');
    if (d2 && Array.isArray(d2.results)) {
      for (const w of d2.results) {
        const s = shape(w);
        console.log('\n  · ' + s.title);
        console.log('    ' + (s.year || '?') + ' · ' + (s.authors || '저자 미상')
          + ' · 인용 ' + s.cited_by_count);
        console.log('    주제: ' + s.topic + ' · 학술지: ' + (s.venue || '?'));
      }
    }
    console.log('\n끝. 담은 것은 없습니다.');
    return;
  }

  let cursor = '*';
  let got = 0, created = 0, skipped = 0;
  const beforeCountQ = DRY ? null : await get(SB_URL + '/rest/v1/papers?select=id&limit=1');
  void beforeCountQ;

  while (got < LIMIT) {
    const per = Math.min(200, LIMIT - got);
    const d = await get(OA + '/works?per_page=' + per
      + '&filter=' + encodeURIComponent(filterStr())
      + '&sort=cited_by_count:desc'
      + '&cursor=' + encodeURIComponent(cursor)
      + '&mailto=' + encodeURIComponent(MAIL));
    await sleep(250);

    if (!d || !Array.isArray(d.results) || !d.results.length) {
      console.log('더 받을 것이 없습니다.');
      break;
    }

    const rows = d.results.map(shape).filter((r) => r.title && r.title !== '(제목 없음)');
    skipped += d.results.length - rows.length;
    got += d.results.length;

    if (DRY) {
      console.log('  (dry) ' + rows.length + '건 받음 · 누적 ' + got);
    } else {
      const res = await upsert(rows);
      if (!res.ok && rows.length) {
        console.log('  ✗ 담기 실패: ' + res.msg);
      } else {
        created += res.ok;
        console.log('  담음 ' + res.ok + '건 · 누적 ' + created + '/' + got);
      }
    }

    cursor = d.meta && d.meta.next_cursor;
    if (!cursor) { console.log('마지막 쪽입니다.'); break; }
  }

  console.log('\n════════════════════════════════════════════════');
  console.log(' 받은 것 ' + got + '건 · 담은 것 ' + created + '건 · 제목 없어 뺀 것 ' + skipped + '건');
  console.log('════════════════════════════════════════════════');
})();
