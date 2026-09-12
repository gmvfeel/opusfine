/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 작가 초상·생몰·소개 수집 · api/collect-artist.js
   ------------------------------------------------------------------
   ★ 왜 만드나 (2026-09-12)
     대문 「작가」 자리가 <b>한국 인물 일색</b>이었습니다.
     초상 있는 작가 125명 중 <b>110명이 한국인</b>이라
     어떻게 뽑아도 안 섞입니다.
     클리블랜드 작가 685명(고야·뒤러·휘슬러·호머)을 담았지만
     <b>초상이 5명뿐</b>입니다.

   ★★★ 이름만으로 커먼즈를 뒤지면 안 됩니다
     지금 DB 에 이런 초상이 붙어 있었습니다 —
       박태홍 → Park Tae-Hong.JPG        <b>축구선수</b>
       강상우 → 240403 FC 서울 vs …      <b>축구선수</b>
       정수정 → KRYSTAL JUNG             <b>아이돌</b>
       김웅용 → Solving Integral Ca…     <b>수학 신동</b>
     전시 참여작가와 유명인이 <b>동명이인</b>이면 그대로 걸립니다.
     ▶ 인계문서 7-5 와 같은 뿌리 — <b>이름은 사람을 가리키기에
       모자란 열쇠</b>입니다.

   ★ 그래서 위키데이터를 지납니다
     「사람인가(P31=Q5)」와 「직업이 미술인가(P106)」를 <b>함께</b> 물어
     동명이인을 걸러냅니다. 실제로 시험하니 —
       Francisco de Goya  → Q5432 · 1746-1828 · 초상 있음
       박태홍·강상우·정수정 → <b>미술인 아님 · 안 담음</b>
     그리고 생몰·소개까지 함께 옵니다.

   ── Vercel 환경변수 ────────────────────────────────────────────
     SUPABASE_URL · SUPABASE_SERVICE_KEY · COLLECT_TOKEN
     (전시·작품 수집과 같은 것. 새로 넣을 것 없습니다)

   ── 쓰는 법 ────────────────────────────────────────────────────
     /api/collect-artist?token=…&who=roman&mode=preview&from=0&to=20
     /api/collect-artist?token=…&who=roman&mode=apply&from=0&to=20

       who=roman  name_en 있는 작가 (클리블랜드 685명) — <b>먼저</b>
       who=all    초상 없는 작가 모두
       from·to 는 <b>작가 차례</b>입니다. 한 번에 20명까지.
       위키데이터를 사람마다 두 번 두드려야 해서 느립니다.
   ══════════════════════════════════════════════════════════════════ */

const WD_API  = 'https://www.wikidata.org/w/api.php';
const WD_DATA = 'https://www.wikidata.org/wiki/Special:EntityData/';
const COMMONS = 'https://commons.wikimedia.org/wiki/Special:FilePath/';

const MAX_BATCH = 20;
const TIMEOUT_MS = 9000;

/* 미술 직업 (P106) — 이 가운데 하나라도 있어야 작가로 봅니다.
   화가 · 판화가 · 조각가 · 사진가 · 소묘가 · 도예가 · 서예가 ·
   미술가 · 삽화가 · 공예가 */
const ART_JOBS = new Set([
  'Q1028181',   /* painter 화가 */
  'Q10694573',  /* printmaker 판화가 */
  'Q1281618',   /* sculptor 조각가 */
  'Q33231',     /* photographer 사진가 */
  'Q1114448',   /* cartoonist 만화가 */
  'Q11569986',  /* draftsperson 소묘가 */
  'Q15296811',  /* illustrator 삽화가 */
  'Q483501',    /* artist 미술가 */
  'Q1925963',   /* graphic artist */
  'Q644687',    /* engraver 각인공 */
  'Q10873124',  /* ceramicist 도예가 */
  'Q329439',    /* calligrapher 서예가 */
  'Q1925963',   /* graphic artist */
  'Q2309784',   /* textile artist */
  'Q3391743'    /* visual artist */
]);

async function j (url) {
  const c = new AbortController();
  const t = setTimeout(function () { c.abort(); }, TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: c.signal,
      headers: { 'User-Agent': 'OpusfineBot/1.0 (https://opusfine.vercel.app; cser@wixon.co.kr)',
                 'Accept': 'application/json' }
    });
    return await r.json();
  } finally { clearTimeout(t); }
}

function yearOf (claims, prop) {
  const a = (claims[prop] || [])[0];
  if (!a || !a.mainsnak || !a.mainsnak.datavalue) return null;
  const v = a.mainsnak.datavalue.value;
  if (!v || !v.time) return null;
  const y = parseInt(String(v.time).slice(1, 5), 10);
  return Number.isFinite(y) && y > 0 && y < 2100 ? y : null;
}
function firstVal (claims, prop) {
  const a = (claims[prop] || [])[0];
  return (a && a.mainsnak && a.mainsnak.datavalue) ? a.mainsnak.datavalue.value : null;
}

/* ══════════════════════════════════════════════════════════════════
   한 사람 찾기 — 미술인이 아니면 null
   ★ 검색 결과 <b>앞 다섯</b>을 훑습니다. 첫 결과가 동명이인일 수 있고,
     그 다음에 진짜 화가가 있는 일이 흔합니다.
   ══════════════════════════════════════════════════════════════════ */
async function lookup (name) {
  const s = await j(WD_API + '?action=wbsearchentities&format=json&language=en'
    + '&uselang=en&limit=5&origin=*&search=' + encodeURIComponent(name));
  const hits = (s && s.search) || [];

  for (const h of hits) {
    let e = null;
    try {
      const d = await j(WD_DATA + h.id + '.json?origin=*');
      e = d && d.entities && d.entities[h.id];
    } catch (err) { continue; }
    if (!e) continue;

    const C = e.claims || {};

    /* ① 사람인가 */
    const isHuman = (C.P31 || []).some(function (c) {
      const v = c.mainsnak && c.mainsnak.datavalue;
      return v && v.value && v.value.id === 'Q5';
    });
    if (!isHuman) continue;

    /* ② 직업이 미술인가 — <b>여기가 동명이인을 막는 자리</b> */
    const jobs = (C.P106 || []).map(function (c) {
      const v = c.mainsnak && c.mainsnak.datavalue;
      return v && v.value && v.value.id;
    });
    if (!jobs.some(function (q) { return ART_JOBS.has(q); })) continue;

    const img = firstVal(C, 'P18');
    const desc = (e.descriptions && e.descriptions.en && e.descriptions.en.value) || null;

    return {
      wd: h.id,
      image_url: img ? (COMMONS + encodeURIComponent(String(img).replace(/ /g, '_')) + '?width=800') : null,
      birth_year: yearOf(C, 'P569'),
      death_year: yearOf(C, 'P570'),
      bio: desc
    };
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════ */
async function sbGet (path) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  const r = await fetch(url.replace(/\/+$/, '') + '/rest/v1/' + path, {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  if (!r.ok) throw new Error('읽기 실패 ' + r.status + ' · ' + (await r.text()).slice(0, 200));
  return await r.json();
}

async function sbPatch (id, body) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  const r = await fetch(url.replace(/\/+$/, '') + '/rest/v1/artists?id=eq.' + id, {
    method: 'PATCH',
    headers: { apikey: key, Authorization: 'Bearer ' + key,
               'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('담기 실패 ' + r.status + ' · ' + (await r.text()).slice(0, 200));
}

/* ══════════════════════════════════════════════════════════════════ */
export default async function handler (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const q = req.query || {};

  const want = process.env.COLLECT_TOKEN;
  if (!want) { res.status(500).json({ 오류: '서버에 COLLECT_TOKEN 이 없습니다' }); return; }
  if (String(q.token || '') !== want) { res.status(401).json({ 오류: '자물쇠가 안 맞습니다' }); return; }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    res.status(500).json({ 오류: 'SUPABASE_URL 또는 SUPABASE_SERVICE_KEY 가 서버에 없습니다' }); return;
  }

  const mode = String(q.mode || 'preview');
  const from = Math.max(0, parseInt(q.from, 10) || 0);
  let to = Math.max(from, parseInt(q.to, 10) || (from + MAX_BATCH));
  if (to - from > MAX_BATCH) to = from + MAX_BATCH;

  /* ── 누구부터 볼까 ──
     who=roman  name_en 이 있는 작가 (클리블랜드 685명 · 고야·뒤러·휘슬러)
     who=all    초상 없는 작가 모두
     ★ <b>roman 을 먼저</b> 도는 것을 권합니다. 대문 「작가」 자리가
       한국 인물 일색인 것을 푸는 게 이 일의 목적이고,
       이들은 <b>작품이 다섯 점 이상</b> 있어 동명이인 위험도 낮습니다.
     ★ 한국 이름은 위키데이터에 없는 경우가 많고, 있어도
       <b>동명이인</b>이 많습니다. 미술 직업 거르개가 막아 주지만
       수확이 적어 뒤로 둡니다. */
  const who = String(q.who || 'roman');
  /* ★ name_en 으로는 못 가릅니다 — 한국 작가에게도 이미 붙어
       있습니다(김아타 → Atta Kim · 이불 → Lee Bul).
     ▶ <b>이름에 한글이 없는 것</b>으로 가릅니다 — 757명.
       (PostgREST 의 not.imatch 로 되는 것을 두드려 확인했습니다) */
  let people = [];
  try {
    people = await sbGet('artists?select=id,name_ko,name_en'
      + '&hidden=not.is.true&image_url=is.null'
      + (who === 'roman' ? '&name_ko=not.imatch.[가-힣]' : '')
      + '&order=id.asc&offset=' + from + '&limit=' + (to - from));
  } catch (e) {
    res.status(500).json({ 오류: String(e.message || e) }); return;
  }

  const 결과 = [];
  let 찾음 = 0, 못찾음 = 0, 초상 = 0, 생몰 = 0;

  for (const p of people) {
    const nm = (p.name_en && /[A-Za-z]/.test(p.name_en)) ? p.name_en : p.name_ko;
    if (!nm) { 못찾음++; continue; }

    let r = null;
    try { r = await lookup(nm); } catch (e) { r = null; }

    if (!r) { 못찾음++; 결과.push({ 이름: nm, 판정: '미술인 아님·못찾음' }); continue; }
    찾음++;
    if (r.image_url) 초상++;
    if (r.birth_year) 생몰++;

    결과.push({ 이름: nm, wd: r.wd, 초상: r.image_url ? '○' : '✕',
                생몰: (r.birth_year || '?') + '–' + (r.death_year || '?'),
                소개: (r.bio || '').slice(0, 40) });

    if (mode === 'apply') {
      const body = {};
      if (r.image_url) body.image_url = r.image_url;
      if (r.birth_year) body.birth_year = r.birth_year;
      if (r.death_year) body.death_year = r.death_year;
      if (r.bio) body.bio = r.bio;
      body.updated_at = new Date().toISOString();
      if (Object.keys(body).length > 1) {
        try { await sbPatch(p.id, body); } catch (e) {
          결과[결과.length - 1].오류 = String(e.message || e).slice(0, 90);
        }
      }
    }
  }

  res.status(200).json({
    모드: mode, 누구: who, 차례: from + '~' + to,
    본사람: people.length, 찾음: 찾음, 못찾음: 못찾음,
    초상붙음: 초상, 생몰붙음: 생몰,
    결과: 결과
  });
}
