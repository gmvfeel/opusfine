/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 클리블랜드 작품 수집 · api/collect-art.js
   ------------------------------------------------------------------
   ★ 왜 만드나 (파트너 요청 · 2026-09-12)
     대문에 걸리는 작품이 <b>동양 일색</b>이었습니다.
     지금 DB 13,800점 가운데 —
       공유마당 6,829 (한국 고미술) · 클리블랜드 6,160 (동양 세 부서만)
       시카고   4,139 <b>전부 감춤</b>   · 메트 498 · 커먼즈 282

   ★★ 시카고 4,139점은 <b>살릴 수 없습니다.</b>
     세잔·모네·르누아르·피카소가 들어 있지만 도판이 안 뜹니다.
     브라우저로 직접 열어 보니 —
       「보안 확인 수행 중 · 악의적인 봇으로부터 보호합니다」
     artic.edu 가 <b>봇 차단</b>을 걸어 두었습니다. 통로를 만들어도
     우리 서버가 부르면 더 확실히 걸립니다.
     ▶ 저쪽이 막아 둔 것을 뚫지 않습니다. 감춘 채로 둡니다.

   ★ 클리블랜드는 됩니다 — 도판이 제대로 뜹니다(1263×639 확인).
     지금은 <b>일본·중국·한국 세 부서만</b> 받았고,
     안 받은 부서에 <b>35,257점</b>이 있습니다(CC0 · 도판 있음).
     겹침은 소장번호 300개로 재어 <b>0건</b>이었습니다.

   ── Vercel 환경변수 ────────────────────────────────────────────
     SUPABASE_URL · SUPABASE_SERVICE_KEY · COLLECT_TOKEN
     (api/collect.js 와 같은 것을 씁니다. 새로 넣을 것 없습니다)

   ── 쓰는 법 ────────────────────────────────────────────────────
     /api/collect-art?token=…&dep=Prints&mode=preview&from=0&to=400
     /api/collect-art?token=…&dep=Prints&mode=apply&from=0&to=10600
     /api/collect-art?token=…&mode=undo&dep=Prints

       from·to 는 <b>건너뛸 수</b>(skip)입니다. 쪽이 아닙니다.
       한 번에 100건씩 받아 담습니다.
   ══════════════════════════════════════════════════════════════════ */

const API = 'https://openaccess-api.clevelandart.org/api/artworks/';
const PER = 100;              /* 한 번에 받는 수 — 저쪽 상한 */
/* ★★ 2026-09-12 · 1200 에서 <b>300</b>으로 줄였습니다.
     724건을 한 번에 처리하려다 <b>504 Gateway Timeout</b> 이 났습니다.
     한 번 부를 때 바깥 API 를 8번 두드리고 담기를 4번 하니 너무 깁니다.
     ▶ 300 이면 두드리기 3번 · 담기 2번. 전시 수집 때도 같은 일이 있었고
       12쪽 → 6쪽으로 줄이니 지나갔습니다.
     ★ 400건은 이미 들어갔습니다 — 시간 초과 전에 앞 묶음이 담깁니다.
       겹쳐 담아도 cma_id 유일 색인이 덮어쓰기만 합니다. */
const MAX_SPAN = 300;
const TIMEOUT_MS = 15000;

/* 아직 안 받은 부서 — 받은 셋(Japanese/Chinese/Korean Art)은 여기 없습니다 */
const DEPTS = [
  'Prints', 'Medieval Art', 'Textiles', 'Indian and Southeast Asian Art',
  'Decorative Art and Design', 'Drawings', 'Photography',
  'Egyptian and Ancient Near Eastern Art', 'Art of the Americas',
  'European Painting and Sculpture', 'Greek and Roman Art',
  'Modern European Painting and Sculpture', 'African Art',
  'American Painting and Sculpture', 'Islamic Art'
];

/* ══════════════════════════════════════════════════════════════════
   줄 만들기 — 기존 6,160점과 <b>같은 결</b>로 맞춥니다
   ------------------------------------------------------------------
   기존 줄을 열어 보고 맞춘 것들 —
     title      한국 것만 한글로 옮겨져 있습니다. 서양 것은 원제 그대로
     title_en   <b>늘</b> 원제를 넣습니다 (기존 6,160점 전부 채워져 있음)
     rights     'public'
     holder     'The Cleveland Museum of Art'
     quality    자료가 얼마나 찼는지로 9~17 (기존과 같은 셈)
     slug       채우지 않습니다 — 기존도 전부 비어 있습니다
   ══════════════════════════════════════════════════════════════════ */
function rowOf (x) {
  if (!x || !x.id) return null;

  const img = x.images && x.images.web && x.images.web.url;
  if (!img) return null;                      /* 도판 없는 것은 담지 않습니다 */

  /* 작가 — creators 의 첫 사람. description 에 생몰이 붙어 옵니다
     (「Claude Monet (French, 1840-1926)」) → 이름만 남깁니다 */
  let artist = null;
  if (x.creators && x.creators.length) {
    const d = String(x.creators[0].description || '').trim();
    artist = d.replace(/\s*\([^)]*\)\s*$/, '').trim() || null;
  }

  /* 연도 — creation_date_earliest / latest 가 숫자로 옵니다 */
  const yf = Number.isFinite(x.creation_date_earliest) ? x.creation_date_earliest : null;
  const yt = Number.isFinite(x.creation_date_latest) ? x.creation_date_latest : null;

  /* 충실도 — 기존 줄이 9~17 로 매겨져 있어 같은 셈을 씁니다 */
  let q = 9;
  if (artist) q += 2;
  if (x.technique) q += 1;
  if (x.measurements) q += 1;
  if (x.description) q += 1;
  if (yf !== null) q += 1;
  if (x.type) q += 1;
  if (q > 17) q = 17;

  const title = String(x.title || '').trim();
  if (!title) return null;

  return {
    cma_id: x.id,
    title: title,
    title_en: title,                          /* ★ 원제를 늘 남깁니다 */
    year_text: x.creation_date || null,
    year_from: yf,
    year_to: yt,
    medium: x.technique || null,
    dimensions: x.measurements || null,
    genre: x.type || null,
    artist_name: artist,
    image_url: (x.images && x.images.print && x.images.print.url) || img,
    image_small: img,
    image_credit: x.image_credit || 'The Cleveland Museum of Art (CC0)',
    rights: 'public',
    holder: 'The Cleveland Museum of Art',
    holder_dept: x.department || null,
    accession: x.accession_number || null,
    link_source: x.url || ('https://clevelandart.org/art/' + (x.accession_number || '')),
    credit_line: x.creditline || null,
    provenance: x.provenance || null,
    quality: q,
    hidden: false,
    sort_no: 0
  };
}

/* ══════════════════════════════════════════════════════════════════ */
async function upsert (rows) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL 또는 SUPABASE_SERVICE_KEY 가 서버에 없습니다');

  const r = await fetch(url.replace(/\/+$/, '') + '/rest/v1/artworks?on_conflict=cma_id', {
    method: 'POST',
    headers: {
      'apikey': key, 'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(rows)
  });
  if (!r.ok) throw new Error('담기 실패 ' + r.status + ' · ' + (await r.text()).slice(0, 300));
}

async function removeByDept (dep) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('열쇠가 서버에 없습니다');

  /* ★ 안전장치 — 클리블랜드 것이면서 <b>그 부서만</b> 지웁니다.
       원래 있던 Japanese/Chinese/Korean Art 는 이름이 달라 안 걸립니다. */
  const r = await fetch(url.replace(/\/+$/, '') + '/rest/v1/artworks'
    + '?cma_id=not.is.null&holder_dept=eq.' + encodeURIComponent(dep), {
    method: 'DELETE',
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Prefer': 'return=minimal' }
  });
  if (!r.ok) throw new Error('지우기 실패 ' + r.status + ' · ' + (await r.text()).slice(0, 300));
}

/* ══════════════════════════════════════════════════════════════════ */
export default async function handler (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const q = req.query || {};

  const want = process.env.COLLECT_TOKEN;
  if (!want) { res.status(500).json({ 오류: '서버에 COLLECT_TOKEN 이 없습니다' }); return; }
  if (String(q.token || '') !== want) { res.status(401).json({ 오류: '자물쇠가 안 맞습니다' }); return; }

  const dep = String(q.dep || '');
  if (dep && DEPTS.indexOf(dep) < 0) {
    res.status(400).json({ 오류: '모르는 부서', 받을수있는것: DEPTS });
    return;
  }

  const mode = String(q.mode || 'preview');

  if (mode === 'undo') {
    if (!dep) { res.status(400).json({ 오류: '어느 부서를 지울지 알려 주십시오' }); return; }
    try { await removeByDept(dep); res.status(200).json({ ok: true, 한일: '지움', 부서: dep }); }
    catch (e) { res.status(500).json({ ok: false, 오류: String(e.message || e) }); }
    return;
  }

  const from = Math.max(0, parseInt(q.from, 10) || 0);
  let to = Math.max(from, parseInt(q.to, 10) || (from + PER));
  if (to - from > MAX_SPAN) to = from + MAX_SPAN;

  const rows = [];
  const 쪽별 = [];
  let total = null, 버린것 = 0;

  for (let skip = from; skip < to; skip += PER) {
    const p = new URLSearchParams();
    p.set('limit', String(PER));
    p.set('skip', String(skip));
    p.set('has_image', '1');
    p.set('cc0', '1');
    if (dep) p.set('department', dep);

    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    let j = null;
    try {
      const up = await fetch(API + '?' + p.toString(), {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'OpusfineBot/1.0 (https://opusfine.vercel.app)', 'Accept': 'application/json' }
      });
      j = await up.json();
    } catch (e) {
      쪽별.push({ skip: skip, 오류: String(e.message || e).slice(0, 70) });
      clearTimeout(timer);
      continue;
    }
    clearTimeout(timer);

    if (total === null && j && j.info) total = j.info.total;

    const data = (j && j.data) || [];
    if (!data.length) { 쪽별.push({ skip: skip, 온것: 0 }); break; }

    let 담김 = 0;
    data.forEach(function (x) {
      const row = rowOf(x);
      if (row) { rows.push(row); 담김++; } else { 버린것++; }
    });
    쪽별.push({ skip: skip, 온것: data.length, 쓸것: 담김 });
  }

  /* 같은 묶음 안 겹침 빼기 */
  const seen = new Set(), uniq = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    if (seen.has(rows[i].cma_id)) continue;
    seen.add(rows[i].cma_id); uniq.push(rows[i]);
  }
  uniq.reverse();

  let 작가있음 = 0;
  const 갈래 = {};
  uniq.forEach(function (r) {
    if (r.artist_name) 작가있음++;
    갈래[r.genre || '(없음)'] = (갈래[r.genre || '(없음)'] || 0) + 1;
  });

  const 요약 = {
    부서: dep || '(전체)', 모드: mode, 건너뜀: from + '~' + to,
    부서전체건수: total,
    받은줄: rows.length, 담을줄: uniq.length, 거른줄: 버린것,
    작가있음: 작가있음,
    갈래: Object.entries(갈래).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6)
            .map(function (e) { return e[0] + ' ' + e[1]; }),
    쪽별: 쪽별
  };

  if (mode !== 'apply') {
    요약.맛보기 = uniq.slice(0, 8).map(function (r) {
      return [r.year_from, r.genre, r.artist_name || '(작가미상)', r.title].join(' · ').slice(0, 90);
    });
    res.status(200).json(요약);
    return;
  }

  try {
    if (uniq.length) {
      for (let i = 0; i < uniq.length; i += 100) await upsert(uniq.slice(i, i + 100));
    }
    요약.한일 = '담음';
    res.status(200).json(요약);
  } catch (e) {
    res.status(500).json({ ok: false, 오류: String(e.message || e), 요약: 요약 });
  }
}
