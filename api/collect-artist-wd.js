/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 위키데이터 미술가 담기 · api/collect-artist-wd.js
   ------------------------------------------------------------------
   ★ 왜 만드나 (2026-09-13)

     파트너께서 물으셨습니다 —
       「해외 작가가 50명뿐인데, 아직 안 모은 거야 원천이 없는 거야?」

     <b>아직 안 모은 것입니다.</b> 위키데이터를 세어 보니 —

       미술가 전체(화가·조각·사진·설치·판화)      393,802명
       그중 1900년 이후 출생                      207,460명
       그중 1950년 이후 출생                       87,188명

     지금까지는 <b>도판</b>을 따라갔습니다. 클리블랜드·메트·커먼즈는
     저작권이 풀린 그림이라 <b>옛 작가만</b> 들어왔고, 전시는 서울시립·
     국립현대 같은 <b>한국 기관</b>만 봤으니 한국 작가만 들어왔습니다.
     해외 현역이 들어올 문이 <b>아예 없었습니다.</b>

   ★★★ 이 파일은 <b>담기만</b> 합니다

     위키데이터 조회는 <b>브라우저</b>(tools/collect-wd.html)가 합니다.
     까닭 — 한 해치 조회에 <b>27초</b>가 걸립니다. Vercel 함수는
     그만큼 못 기다립니다(전시 수집 때 504 를 겪었습니다).
     브라우저는 시간 제한이 없고, WDQS 가 <b>CORS 를 열어 두었습니다</b>
     (opusfine.vercel.app 에서 직접 불러 HTTP 200 을 확인했습니다).

     ▶ 브라우저가 고르고 → 이 파일이 <b>service key 로</b> 담습니다.
       공개 열쇠로는 쓸 수 없으므로 이 자리가 필요합니다.

   ★★ 이름으로 맞대지 않습니다

     2026-09-13 에 하루 종일 겪은 일입니다 —
       오윤(민중미술가) 항목에 <b>야구 선수</b>가, 황수연(조각가)에
       <b>무용가</b>가, 유현미(미술가)에 <b>각본가</b>가 덮여 있었습니다.
       전부 <b>이름으로</b> 위키데이터를 찾은 탓입니다.
     ▶ 여기서는 <b>Q 를 열쇠로</b> 담습니다.
     ▶ 같은 Q 가 이미 있으면 <b>건너뜁니다.</b> 덮어쓰지 않습니다 —
       이미 담긴 작가에게는 전시·작품이 붙어 있을 수 있습니다.

   ── Vercel 환경변수 ────────────────────────────────────────────
     SUPABASE_URL · SUPABASE_SERVICE_KEY · COLLECT_TOKEN
     (전시·작품·초상 수집과 같은 것. 새로 넣을 것 없습니다)

   ── 쓰는 법 ────────────────────────────────────────────────────
     POST /api/collect-artist-wd?token=...&mode=apply
       몸통 : { "rows": [ { wikidata_id, name_ko, ... }, ... ] }

     mode=preview 면 <b>세어만 보고 담지 않습니다.</b>
   ══════════════════════════════════════════════════════════════════ */

const SOURCE   = 'wikidata-art-2026-09';
const CHUNK    = 100;
const MAX_ROWS = 2000;

/* 담아도 되는 칸만 받습니다 — 브라우저가 보낸 것을 그대로 믿지 않습니다 */
const ALLOW = [
  'wikidata_id', 'name_ko', 'name_en', 'bio',
  'birth_year', 'death_year', 'life',
  'nationality', 'field', 'image_url', 'image_credit', 'link_wiki'
];

/* 뚜렷이 미술이 아닌 직업 — 하나라도 있으면 <b>물립니다.</b>
   미술관이 소장했더라도 동명이인이 섞일 수 있습니다.
   ★ 브라우저에서도 한 번 거르지만 <b>여기서 다시</b> 겁니다 —
     담는 자리에서 막는 것이 마지막 빗장입니다. */
/* ★★ 2026-09-13 · <b>체스·사이클·스포츠</b>를 더했습니다.
     첫 판으로 1,611명을 담았더니 <b>786명이 체스 기사·사이클 선수</b>였습니다.
     화면 쪽 미술 직업 Q 목록에 잘못 적은 번호가 둘 있었습니다 —
       Q10873124 (주석 「도예가」) → 실제 <b>체스 기사</b>
       Q2309784  (주석 「textile artist」) → 실제 <b>사이클 선수</b>
     Q 목록은 고쳤지만, <b>담는 자리에서 한 번 더</b> 겁니다. */
const NOT_ART = /위키미디언|위키백과인|체스|바둑|포커|축구|야구|농구|배구|배드민턴|탁구|펜싱|골프|피겨|사이클|자전거|수영|육상|스키|바이애슬론|스케이팅|레이스카|스포츠|선수|해설가|캐스터|프로게이머|가수|배우|아이돌|래퍼|아나운서|개그맨|성우|모델|정치인|대학생|테러리스트|저격수|군인|의사|간호사|변호사|회계사|요리사|과학자|언론인|chess|cyclist|footballer|athlete|swimmer|skier/i;

function clean (r) {
  if (!r || typeof r !== 'object') return null;
  const qid = String(r.wikidata_id || '');
  if (!/^Q\d+$/.test(qid)) return null;

  const name = String(r.name_ko || '').trim();
  if (!name) return null;

  /* ★ 직업칸이 비면 담지 않습니다 — 체스 기사인지 아닌지
       <b>가릴 수가 없기</b> 때문입니다 (첫 판에서 571명이 그랬습니다). */
  if (!String(r.field || '').trim()) return null;
  if (NOT_ART.test(String(r.field || ''))) return null;

  const o = {};
  ALLOW.forEach(function (k) {
    const v = r[k];
    if (v === undefined || v === '' || v === null) { o[k] = null; return; }
    if (k === 'birth_year' || k === 'death_year') {
      const n = parseInt(v, 10);
      o[k] = (Number.isFinite(n) && n > 0 && n < 2100) ? n : null;
      return;
    }
    o[k] = String(v).slice(0, 2000);
  });

  /* 주소는 https 만 받습니다 */
  ['image_url', 'link_wiki'].forEach(function (k) {
    if (o[k] && !/^https:\/\//.test(o[k])) o[k] = null;
  });
  if (!o.image_url) o.image_credit = null;

  o.source  = SOURCE;
  o.hidden  = false;
  o.is_oc   = false;
  o.quality = 0;
  o.sort_no = 0;
  return o;
}

async function sbInsert (rows) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  const r = await fetch(url.replace(/\/+$/, '')
      + '/rest/v1/artists?on_conflict=wikidata_id', {
    method: 'POST',
    headers: {
      apikey: key, Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal'
    },
    body: JSON.stringify(rows)
  });
  if (!r.ok) throw new Error('담기 실패 ' + r.status + ' · ' + (await r.text()).slice(0, 240));
}

async function sbCount () {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  const r = await fetch(url.replace(/\/+$/, '')
      + '/rest/v1/artists?select=id&source=eq.' + encodeURIComponent(SOURCE) + '&limit=1', {
    method: 'HEAD',
    headers: { apikey: key, Authorization: 'Bearer ' + key, Prefer: 'count=exact' }
  });
  const m = /\/(\d+)$/.exec(r.headers.get('content-range') || '');
  return m ? Number(m[1]) : null;
}

/* ══════════════════════════════════════════════════════════════════ */
export default async function handler (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const q = req.query || {};

  const want = process.env.COLLECT_TOKEN || '';
  if (!want) { res.status(500).json({ 오류: 'COLLECT_TOKEN 이 서버에 없습니다' }); return; }
  if (String(q.token || '') !== want) { res.status(401).json({ 오류: '자물쇠가 안 맞습니다' }); return; }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    res.status(500).json({ 오류: 'SUPABASE_URL 또는 SUPABASE_SERVICE_KEY 가 서버에 없습니다' }); return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ 오류: 'POST 로 보내십시오' }); return;
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const raw = (body && Array.isArray(body.rows)) ? body.rows : null;
  if (!raw) { res.status(400).json({ 오류: '몸통에 rows 배열이 없습니다' }); return; }
  if (raw.length > MAX_ROWS) { res.status(400).json({ 오류: '한 번에 ' + MAX_ROWS + '줄까지' }); return; }

  const got = raw.map(clean).filter(Boolean);

  /* 같은 묶음 안에 같은 Q 가 둘이면 뒤엣것만 —
     PostgREST 는 한 번의 upsert 안에 같은 열쇠가 둘이면 성냅니다 */
  const seen = new Set(), uniq = [];
  for (let i = got.length - 1; i >= 0; i--) {
    if (seen.has(got[i].wikidata_id)) continue;
    seen.add(got[i].wikidata_id); uniq.push(got[i]);
  }
  uniq.reverse();

  const sum = {
    자료원: SOURCE,
    모드: String(q.mode || 'preview'),
    받은줄: raw.length,
    거른줄: raw.length - got.length,
    담을줄: uniq.length,
    초상있음: uniq.filter(function (r) { return r.image_url; }).length,
    국적있음: uniq.filter(function (r) { return r.nationality; }).length,
    한글이름: uniq.filter(function (r) { return /[가-힣]/.test(r.name_ko); }).length
  };

  if (String(q.mode || 'preview') !== 'apply') {
    sum.맛보기 = uniq.slice(0, 8).map(function (r) {
      return [r.name_ko, r.name_en || '', r.birth_year || '?',
              r.nationality || '국적?', r.field || '직업?'].join(' · ');
    });
    res.status(200).json(sum);
    return;
  }

  try {
    for (let i = 0; i < uniq.length; i += CHUNK) await sbInsert(uniq.slice(i, i + CHUNK));
    sum.한일 = '담음 (이미 있는 Q 는 건너뜀)';
    sum.이자료원_모두 = await sbCount();
    res.status(200).json(sum);
  } catch (e) {
    res.status(500).json({ ok: false, 오류: String(e.message || e), 요약: sum });
  }
}
