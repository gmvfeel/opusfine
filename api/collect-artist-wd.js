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
/* ★★★ 2026-09-13 · 거르개는 <b>스포츠·게임 선수만</b> 막습니다.

     처음엔 배우·가수·감독·작가·정치인까지 막았는데, 시험해 보니
     <b>살바도르 달리(배우)와 파블로 피카소(영화 배우)가 버려졌습니다.</b>
     미술가는 흔히 다른 일도 겸합니다.

     체스 기사 786명이 들어온 것은 거르개가 약해서가 아니라
     <b>미술 직업 Q 번호를 잘못 적어서</b>였습니다
     (Q10873124 를 「도예가」인 줄 알았는데 <b>체스 기사</b>였습니다).
     그건 화면 쪽 Q 목록을 고쳐 막았고, 여기는 <b>마지막 빗장</b>입니다. */
const NOT_ART = /체스|바둑|포커|축구|야구|농구|배구|핸드볼|배드민턴|탁구|펜싱|골프|피겨|사이클|자전거|수영|육상|스키|스노보드|바이애슬론|스케이팅|레이스카|카레이서|프로게이머|선수|해설가|캐스터|위키미디언|위키백과인|아키비스트|chess player|cyclist|footballer|athlete|swimmer|skier|racing driver|wikimedian/i;

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
  o.is_oc   = false;

  /* ★★★ 2026-09-15 · hidden · quality · sort_no 를 <b>더 이상 넣지 않습니다.</b>
       까닭 — 이 값들은 <b>새로 담는 사람</b>에게만 뜻이 있는데, 같은 Q 가 이미
       있으면 upsert 가 <b>기존 행을 덮어써</b> 애써 해 둔 일을 지웠습니다.

       실제로 벌어진 일(Supabase edge 로그로 확인 · 2026-09-14 21:54 UTC) —
         · 숨겨 둔 연예인 14명이 <b>이틀 연속</b> 풀렸습니다(hidden=false 로 덮임)
         · quality 도 0 으로 덮일 뻔했습니다(이번엔 마침 무사)

       ★ 새로 담기는 행은 DB 기본값이 대신합니다 —
         hidden 은 기본 false · quality·sort_no 는 재산정이 채웁니다
         (sql/20260914_재산정_표준.sql 을 담기 뒤에 돌리십시오).
       ★ DB 쪽에도 방아쇠를 걸어 두었습니다(of_keep_hidden_trg) — 두 겹으로 막습니다. */
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
      /* ★★ 2026-09-15 · <b>ignore-duplicates</b> 여야 합니다.
           2026-09-14 에 배포된 판은 merge-duplicates 였습니다(로그로 확인).
           merge 는 같은 Q 가 있으면 기존 행을 <b>통째로 덮어씁니다</b>.
           ▶ 이 파일을 고친 뒤 <b>배포가 실제로 됐는지</b> 확인하십시오 —
             GitHub 에는 ignore 라 적혀 있는데 돌던 것은 merge 였습니다. */
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
