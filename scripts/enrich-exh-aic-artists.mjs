#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 시카고미술관(AIC) 전시 참여작가 채우기 ·
   scripts/enrich-exh-aic-artists.mjs
   ------------------------------------------------------------------
   쓰는 법
     node scripts/enrich-exh-aic-artists.mjs --peek
     node scripts/enrich-exh-aic-artists.mjs --limit 200 --dry
     node scripts/enrich-exh-aic-artists.mjs --limit 7000

   ★★ 2026-10-01 · 파트너가 "전시-작가 연결"을 훑어보라고 해서 보니,
     전시 9,624건 중 8,833건(92%)은 <b>연결을 못 한 게 아니라 원본에
     참여작가 정보 자체가 없었습니다</b>. 그중 aicExh(시카고미술관)가
     6,259건으로 가장 큰데, api/collect.js 가 애초에 artist_ids 칸을
     요청조차 안 하고 있었습니다.
   ★ api.artic.edu 를 직접 두드려 보니 exhibitions 에 <b>artist_ids</b>
     칸이 실제로 있습니다(표본 100건 중 23건·23% 채워짐). 다만 이름이
     아니라 AIC 내부 작가번호라, /artists 로 한 번 더 물어야 이름이
     나옵니다.
   ▶ 이 스크립트가 하는 일
     ① exhibitions(source=aicExh) 목록을 받습니다(아직
        exhibition_artists 가 없는 것만).
     ② AIC exhibitions API 에 <b>ids= 묶음 조회</b>로 artist_ids 를
        한 번에 받습니다(전시 하나마다 부르지 않음).
     ③ 나온 작가번호를 모아 AIC artists API 에 역시 <b>ids= 묶음</b>
        조회로 이름을 받습니다.
     ④ 우리 작가DB 에 이름이 있으면 잇고, 없고 <b>사람 이름 꼴</b>이면
        새로 만듭니다(NGA·스미소니언과 같은 규칙 — AIC 작가 권위파일은
        이미 정제돼 있어 걸러낼 말이 적지만, Unknown·Anonymous 류는
        그대로 있을 수 있어 같은 필터를 씁니다).
     ⑤ exhibition_artists 에 담고, exhibitions.artists 글자칸도
        (비어 있으면) 채웁니다 — 다른 자료원과 같은 모양을 유지합니다.
   ★ <b>빈칸만 채웁니다</b> — 이미 exhibition_artists 에 그 전시 줄이
     있으면 건너뜁니다(재실행 안전).
   ══════════════════════════════════════════════════════════════════ */

import { makeGetJSON, isStop, stopReason } from './lib/http.mjs';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const UA = 'OpusFineArtArchiveBot/1.0 (https://opusfine.vercel.app; non-commercial art archive project)';

const getJSON = makeGetJSON({ ua: UA, accept: 'application/json', tries: 5, maxWaitMs: 90 * 1000, budgetMs: 30 * 60 * 1000 });

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? (argv[i + 1] || d) : d; };
const LIMIT = Number(arg('limit', 7000));
const DRY   = argv.includes('--dry');
const PEEK  = argv.includes('--peek');

if (!SB_URL || !SB_KEY) {
  console.error('★ SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

/* ── 사람 이름 꼴인지 (NGA·스미소니언과 같은 규칙) ── */
const NAME_EXCLUDE_RE = new RegExp(
  '(century|dynasty|unknown|anonymous|\\bafter\\b|circle of|attributed to' +
  '|manner of|\\bschool\\b|workshop|follower of|possibly by|style of' +
  '|copy after|active |probably by|formerly attrib|\\band\\b|\\bor\\b' +
  '|\\bcalled\\b|studio|imitator of|in the manner|questionably|attrib\\.' +
  '|master of|^master\\b|institut|company|\\binc\\.?\\b|foundry|\\bmint\\b' +
  '|\\bpress\\b|museum|\\bsociety\\b|gallery|\\btrust\\b|association)', 'i');

function isCleanPersonName(name) {
  const nm = String(name || '').trim();
  if (!nm) return false;
  if (NAME_EXCLUDE_RE.test(nm)) return false;
  if (/[(&[\]]/.test(nm)) return false;
  return true;
}

/* ── 우리 작가DB 이름 맵 ── */
async function loadArtists() {
  const byName = new Map();
  let from = 0;
  for (;;) {
    const r = await fetch(
      SB_URL + '/rest/v1/artists?select=id,name_ko,name_en&limit=1000&offset=' + from,
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    if (!r.ok) break;
    const rows = await r.json();
    if (!rows.length) break;
    for (const a of rows)
      for (const nm of [a.name_ko, a.name_en]) {
        if (!nm) continue;
        const k = String(nm).trim().toLowerCase();
        if (!k) continue;
        if (!byName.has(k)) byName.set(k, []);
        byName.get(k).push(a.id);
      }
    from += rows.length;
    if (rows.length < 1000) break;
  }
  return byName;
}

async function sbGet(path) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
  });
  if (!r.ok) throw new Error('읽기 실패 ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

/* ── 우리 쪽 aicExh 전시 목록 (exhibition_artists 아직 없는 것만) ── */
async function loadTargetExhibitions(limit) {
  const linked = new Set(
    (await sbGet('exhibition_artists?select=exhibition_id')).map((r) => r.exhibition_id)
  );
  const out = [];
  let from = 0;
  for (;;) {
    const rows = await sbGet(
      'exhibitions?select=id,source_id,artists&source=eq.aicExh&hidden=not.is.true'
      + '&order=id.asc&limit=1000&offset=' + from
    );
    if (!rows.length) break;
    for (const r of rows) if (!linked.has(r.id)) out.push(r);
    from += rows.length;
    if (rows.length < 1000) break;
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}

/* ── AIC 전시 → artist_ids 묶음 조회 ── */
async function fetchArtistIds(sourceIds) {
  const map = new Map(); /* source_id(string) -> [artist_id,...] */
  const PACK = 100; /* AIC 문서 예시가 100개씩 */
  for (let i = 0; i < sourceIds.length; i += PACK) {
    const part = sourceIds.slice(i, i + PACK);
    const url = 'https://api.artic.edu/api/v1/exhibitions?ids=' + part.join(',')
      + '&fields=' + encodeURIComponent('id,artist_ids') + '&limit=' + PACK;
    const j = await getJSON(url);
    for (const row of (j && j.data) || []) {
      if (Array.isArray(row.artist_ids) && row.artist_ids.length) {
        map.set(String(row.id), row.artist_ids);
      }
    }
  }
  return map;
}

/* ── AIC 작가번호 → 이름 묶음 조회 ── */
async function fetchArtistNames(ids) {
  const map = new Map(); /* artist_id(number) -> name */
  const uniq = [...new Set(ids)];
  const PACK = 100;
  for (let i = 0; i < uniq.length; i += PACK) {
    const part = uniq.slice(i, i + PACK);
    const url = 'https://api.artic.edu/api/v1/artists?ids=' + part.join(',')
      + '&fields=' + encodeURIComponent('id,title') + '&limit=' + PACK;
    const j = await getJSON(url);
    for (const row of (j && j.data) || []) {
      if (row.id != null && row.title) map.set(row.id, String(row.title).trim());
    }
  }
  return map;
}

/* ★ 이번 실행에서 새로 만든 작가 — 이름당 한 번만 */
async function resolveArtist(name, byName, cache, dry) {
  const key = String(name).trim().toLowerCase();
  const hit = byName.get(key);
  if (hit && hit.length === 1) return { id: hit[0], status: 'auto' };
  if (hit && hit.length > 1)   return { id: null,   status: 'ambig' };
  if (cache.has(key))          return { id: cache.get(key), status: 'auto' };
  if (!isCleanPersonName(name)) return { id: null, status: 'none' };
  if (dry) return { id: null, status: 'wouldCreate' };

  const r = await fetch(SB_URL + '/rest/v1/artists', {
    method: 'POST',
    headers: {
      apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json', Prefer: 'return=representation'
    },
    body: JSON.stringify([{
      name_ko: name.trim(), name_en: name.trim(), hidden: false,
      kind: 'person', source: 'aic-exh-collect-auto', quality: 0
    }])
  });
  if (!r.ok) return { id: null, status: 'none' };
  const rows = await r.json();
  const id = rows && rows[0] && rows[0].id;
  if (!id) return { id: null, status: 'none' };
  cache.set(key, id);
  byName.set(key, [id]);
  return { id, status: 'auto' };
}

async function insertExhibitionArtists(rows) {
  if (!rows.length) return;
  const r = await fetch(SB_URL + '/rest/v1/exhibition_artists', {
    method: 'POST',
    headers: {
      apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json', Prefer: 'return=minimal'
    },
    body: JSON.stringify(rows)
  });
  if (!r.ok) throw new Error('exhibition_artists 담기 실패 ' + r.status + ' ' + (await r.text()).slice(0, 250));
}

async function patchExhibitionArtistsText(id, text) {
  const r = await fetch(SB_URL + '/rest/v1/exhibitions?id=eq.' + id, {
    method: 'PATCH',
    headers: {
      apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json', Prefer: 'return=minimal'
    },
    body: JSON.stringify({ artists: text })
  });
  if (!r.ok) throw new Error('exhibitions.artists 고치기 실패 ' + r.status);
}

(async () => {
  console.log(`▶ 시카고미술관 전시 참여작가 채우기 · limit=${LIMIT}${DRY ? ' · 담지 않고 세어만 봅니다' : ''}${PEEK ? ' · peek' : ''}`);

  const targets = await loadTargetExhibitions(PEEK ? 5 : LIMIT);
  console.log(`  대상 전시(아직 참여작가 표 없음) ${targets.length}건`);
  if (!targets.length) { console.log('  (채울 곳이 없습니다)'); return; }

  console.log('  AIC 에서 artist_ids 받는 중…');
  const idMap = await fetchArtistIds(targets.map((t) => t.source_id));
  console.log(`  artist_ids 있는 전시 ${idMap.size}/${targets.length}건`);

  const allArtistIds = [...idMap.values()].flat();
  console.log('  AIC 작가번호 → 이름 받는 중… (' + new Set(allArtistIds).size + '명)');
  const nameMap = await fetchArtistNames(allArtistIds);

  if (PEEK) {
    console.log('\n▶ 한 곳만 살펴봅니다\n');
    const t = targets.find((x) => idMap.has(String(x.source_id))) || targets[0];
    console.log('  전시 id:', t.id, '· AIC source_id:', t.source_id);
    const ids = idMap.get(String(t.source_id)) || [];
    console.log('  artist_ids:', ids);
    console.log('  이름:', ids.map((i) => nameMap.get(i) || '(못 찾음)'));
    return;
  }

  console.log('  우리 작가DB 를 받는 중…');
  const byName = await loadArtists();
  console.log(`  이름 ${byName.size}개를 담아 두었습니다`);

  const artistCache = new Map();
  let exhWithArtists = 0, artistRowsPut = 0, created = 0, wouldCreate = 0, auto = 0, ambig = 0, none = 0;
  const errs = [];

  try {
    for (const t of targets) {
      const ids = idMap.get(String(t.source_id));
      if (!ids || !ids.length) continue;

      const names = [...new Set(ids.map((i) => nameMap.get(i)).filter(Boolean))];
      if (!names.length) continue;

      const rows = [];
      for (let i = 0; i < names.length; i++) {
        const nm = names[i];
        const beforeSize = artistCache.size;
        const res = await resolveArtist(nm, byName, artistCache, DRY);
        if (res.status === 'auto') { auto++; if (artistCache.size > beforeSize) created++; }
        else if (res.status === 'ambig') ambig++;
        else if (res.status === 'wouldCreate') wouldCreate++;
        else none++;
        rows.push({
          exhibition_id: t.id, artist_id: res.id, artist_name: nm,
          link_status: res.status === 'wouldCreate' ? 'none' : res.status,
          sort_no: i + 1
        });
      }

      if (!DRY) {
        await insertExhibitionArtists(rows);
        if (!t.artists || !String(t.artists).trim()) {
          await patchExhibitionArtistsText(t.id, names.join(', '));
        }
        artistRowsPut += rows.length;
      }
      exhWithArtists++;
      if (exhWithArtists % 200 === 0) console.log(`  ${exhWithArtists}/${idMap.size}건 처리…`);
    }
  } catch (e) {
    if (isStop(e)) console.log('  ■ 멈춥니다 — ' + stopReason(e));
    else errs.push(e.message);
  }

  console.log('──────────────────────────────');
  console.log(`  참여작가 채운 전시   ${exhWithArtists}`);
  console.log(`  담은 참여작가 줄     ${artistRowsPut}`);
  console.log(`  작가와 이어짐 ${auto} · 후보 여럿 ${ambig} · 못 이음 ${none}`);
  if (!DRY) console.log(`  그 중 새로 만든 작가 ${created}명`);
  if (DRY && wouldCreate) console.log(`  (--dry 라 만들지 않았지만, 만들었을 이름 ${wouldCreate}개)`);
  if (DRY) console.log('  (--dry 라 실제로 담지 않았습니다)');
  if (errs.length) {
    console.log(`  ★ 문제 ${errs.length}건`);
    errs.slice(0, 5).forEach((m) => console.log('     · ' + m));
  }
})();
