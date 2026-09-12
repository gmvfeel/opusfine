/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 바깥 API 통로 · api/fetch.js
   ------------------------------------------------------------------
   ★ 왜 필요한가
     브라우저는 <b>다른 사이트로 곧바로 못 부릅니다</b>(CORS).
     어드민 화면에서 api.kcisa.kr 을 불러 보려 했더니
     「Failed to fetch」 가 났습니다. 중계기(of-relay)도 CORS 머리를
     안 붙여서 같았습니다.
     ▶ <b>같은 사이트 안에</b> 통로를 하나 두면 CORS 가 안 걸립니다.

   ★ 왜 Vercel Function 인가
     · GitHub Actions 를 쓰지 않기로 했습니다 (파트너 결정 · 2026-09-11)
       — 필요할 때 어드민에서 직접 돌리는 쪽이 낫습니다
     · Cloudflare 워커를 고치려면 파트너가 대시보드를 열어야 합니다
     · 이 파일은 <b>저장소에 올리기만</b> 하면 됩니다

   ★★ 열린 프록시가 되지 않게 — <b>허락한 곳으로만</b> 나갑니다
     아무 주소나 넘겨 주면 남이 우리 서버를 발판 삼아 아무 데나
     부를 수 있습니다. 아래 ALLOW 에 적힌 곳만 나갑니다.

   ★ 열쇠를 화면에 두지 않습니다
     공공데이터 키는 <b>서버 환경변수</b>에서 꺼내 붙입니다.
     화면 코드에는 키가 들어가지 않습니다.
     ▶ Vercel 프로젝트 설정 → Environment Variables 에
       DATA_GO_KR_KEY 를 넣어 주십시오.
       (GitHub Secrets 에 있는 것과 같은 값입니다)

   ── 쓰는 법 ────────────────────────────────────────────────────
     /api/fetch?to=kcisa&path=/openapi/API_CCA_145/request&numOfRows=5&pageNo=1
       → https://api.kcisa.kr/openapi/API_CCA_145/request
         ?serviceKey=(서버가 붙임)&numOfRows=5&pageNo=1

     to=kcisa     한국문화정보원 (12개 기관 전시 · 20개 기관 유물)
     to=emuseum   e뮤지엄
     to=apis      apis.data.go.kr (전남도립미술관 등)
     to=cma       클리블랜드 미술관
     to=met       메트로폴리탄
     to=gongu     공유마당
     to=seoul     서울 열린데이터광장

   ★ key=1 을 주면 서버가 열쇠를 붙입니다. 안 주면 안 붙입니다
     (열쇠 없이 두드려 보는 정찰에 씁니다).
   ══════════════════════════════════════════════════════════════════ */

/* 나갈 수 있는 곳 — 여기 없으면 안 나갑니다 */
const ALLOW = {
  kcisa:   { base: 'https://api.kcisa.kr',                  keyName: 'serviceKey', env: 'DATA_GO_KR_KEY' },
  apis:    { base: 'https://apis.data.go.kr',               keyName: 'serviceKey', env: 'DATA_GO_KR_KEY' },
  emuseum: { base: 'http://www.emuseum.go.kr',              keyName: 'serviceKey', env: 'DATA_GO_KR_KEY' },
  cma:     { base: 'https://openaccess-api.clevelandart.org', keyName: null,       env: null },
  met:     { base: 'https://collectionapi.metmuseum.org',   keyName: null,         env: null },
  gongu:   { base: 'https://gongu.copyright.or.kr',         keyName: 'apiKey',     env: 'GONGU_KEY' },
  seoul:   { base: 'http://openapi.seoul.go.kr:8088',       keyName: null,         env: 'SEOUL_KEY' },
  wd:      { base: 'https://query.wikidata.org',            keyName: null,         env: null },
  openalex:{ base: 'https://api.openalex.org',              keyName: null,         env: null }
};

/* 한 번에 너무 오래 붙들지 않습니다 */
const TIMEOUT_MS = 25000;

export default async function handler(req, res) {
  /* 같은 사이트에서만 부르게 둡니다 — 아무 데서나 못 부르게 */
  res.setHeader('Cache-Control', 'no-store');

  const q = req.query || {};
  const to = String(q.to || '').toLowerCase();
  const spec = ALLOW[to];

  if (!spec) {
    res.status(400).json({
      error: '모르는 곳입니다',
      to: to || '(없음)',
      갈수있는곳: Object.keys(ALLOW)
    });
    return;
  }

  /* 경로 — 반드시 / 로 시작하게 하고 .. 를 막습니다 */
  let path = String(q.path || '/');
  if (path.charAt(0) !== '/') path = '/' + path;
  if (path.indexOf('..') >= 0) {
    res.status(400).json({ error: '경로에 .. 는 쓸 수 없습니다' });
    return;
  }

  /* 나머지 물음표 뒤 값들을 그대로 넘깁니다 (to·path·key 는 뺍니다) */
  const params = new URLSearchParams();
  Object.keys(q).forEach(function (k) {
    if (k === 'to' || k === 'path' || k === 'key') return;
    const v = q[k];
    if (Array.isArray(v)) v.forEach(function (x) { params.append(k, x); });
    else params.append(k, v);
  });

  /* 열쇠 — key=1 일 때만, 그리고 <b>서버 환경변수</b>에서 */
  let keyUsed = false;
  if (String(q.key || '') === '1' && spec.keyName && spec.env) {
    const val = process.env[spec.env];
    if (!val) {
      res.status(500).json({
        error: '서버에 열쇠가 없습니다',
        필요한환경변수: spec.env,
        어디에: 'Vercel 프로젝트 설정 → Environment Variables'
      });
      return;
    }
    params.set(spec.keyName, val);
    keyUsed = true;
  }

  const qs = params.toString();
  const target = spec.base + path + (qs ? '?' + qs : '');

  /* ── 부르기 ─────────────────────────────────────────────── */
  const started = Date.now();
  let upstream, text, err = null;
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);

  try {
    upstream = await fetch(target, {
      signal: ctrl.signal,
      headers: {
        /* ★ 커먼즈처럼 <b>연락처가 담긴 User-Agent</b> 를 요구하는 곳이
             있습니다. 붙여 두면 손해가 없습니다. */
        'User-Agent': 'OpusfineBot/1.0 (https://opusfine.vercel.app; cser@wixon.co.kr)',
        'Accept': '*/*'
      }
    });
    text = await upstream.text();
  } catch (e) {
    err = String(e && e.message || e);
  } finally {
    clearTimeout(timer);
  }

  const ms = Date.now() - started;

  if (err) {
    res.status(502).json({
      ok: false,
      곳: to,
      부른곳: target.replace(/serviceKey=[^&]+/, 'serviceKey=***'),
      걸린시간ms: ms,
      오류: err
    });
    return;
  }

  /* ★ 응답을 <b>날것 그대로</b> 돌려줍니다.
       JSON 인지 XML 인지 화면에서 보고 판단합니다 —
       서버가 미리 해석하면 「무엇이 왔는지」를 못 봅니다. */
  const ctype = upstream.headers.get('content-type') || '';
  res.status(200).json({
    ok: upstream.ok,
    곳: to,
    부른곳: target.replace(/serviceKey=[^&]+/, 'serviceKey=***'),
    열쇠붙임: keyUsed,
    상태: upstream.status,
    종류: ctype,
    걸린시간ms: ms,
    길이: text.length,
    본문: text.length > 200000 ? text.slice(0, 200000) + '\n…(잘림)' : text
  });
}
