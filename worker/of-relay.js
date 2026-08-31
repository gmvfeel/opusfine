/**
 * of-relay — 오퍼스파인 수집기용 중계기
 *
 * 왜 필요한가
 *   api.kcisa.kr (한국문화정보원) 이 GitHub Actions 서버에서 닿지 않습니다.
 *   이 Worker 가 대신 물어보고 답을 그대로 돌려줍니다.
 *
 * 쓰는 법
 *   https://of-relay.wixon.workers.dev/health
 *     → 중계기가 실제로 api.kcisa.kr 에 닿는지 확인. 브라우저에서 그냥 열면 됩니다.
 *
 *   https://of-relay.wixon.workers.dev/kcisa/openapi/API_CCA_145/request?serviceKey=...&numOfRows=10
 *     → https://api.kcisa.kr/openapi/API_CCA_145/request?serviceKey=...&numOfRows=10 로 대신 요청
 *
 * 안전장치
 *   아래 UPSTREAM 에 적힌 곳으로만 나갑니다. 아무 주소나 중계하는 열린 프록시가 아닙니다.
 *   RELAY_TOKEN 을 설정해 두면 X-Relay-Token 헤더가 맞는 요청만 받습니다. (선택)
 */

const UPSTREAM = {
  kcisa: 'https://api.kcisa.kr',
  emuseum: 'http://www.emuseum.go.kr',
};

const TIMEOUT_MS = 25000;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const colo = (request.cf && request.cf.colo) || '?';

    // ── 대문 ────────────────────────────────────────────────
    if (parts.length === 0) {
      return json({
        name: 'of-relay',
        version: 'v3',
        colo,
        usage: [
          '/health       상대 서버 루트에 닿는지',
          '/probe        진짜 API 경로를 키 없이 두드리기',
          '/probe-key    Cloudflare 비밀값의 키로 두드리기',
          '/probe-img    시카고 도판을 서버가 받아올 수 있는지',
          '/kcisa/<경로>  api.kcisa.kr 로 중계',
          '/emuseum/<경로> www.emuseum.go.kr 로 중계',
        ],
        upstreams: Object.keys(UPSTREAM),
      });
    }

    // ── 시카고 도판을 서버가 받아올 수 있는지 ──────────────────
    // 목록 API 로 표본을 얻고, 그 도판을 실제로 내려받아 봅니다.
    // 형식표(Content-Type)는 믿지 않고 바이트 앞머리로 판정합니다.
    if (parts[0] === 'probe-img') {
      const out = { colo, checked_at: new Date().toISOString() };

      // 1) 목록 API
      const listUrl =
        'https://api.artic.edu/api/v1/artworks/search' +
        '?q=Korea&limit=3&fields=id,title,image_id,artist_title,date_display';
      let sample = [];
      const t0 = Date.now();
      try {
        const r = await withTimeout(
          fetch(listUrl, { method: 'GET', headers: { 'User-Agent': UA } }),
          TIMEOUT_MS
        );
        const txt = await r.text();
        out.list_api = { status: r.status, ms: Date.now() - t0 };
        if (r.ok) {
          try {
            const j = JSON.parse(txt);
            sample = (j.data || []).filter((d) => d.image_id);
            out.list_api.got = sample.length;
            out.list_api.titles = sample.map((d) => d.title);
          } catch (e) {
            out.list_api.parse_error = String(e);
            out.list_api.body_head = txt.slice(0, 300);
          }
        } else {
          out.list_api.body_head = txt.slice(0, 300);
        }
      } catch (e) {
        out.list_api = {
          error: String(e && e.message ? e.message : e),
          ms: Date.now() - t0,
        };
      }

      // 2) 도판 내려받기
      out.images = [];
      for (const d of sample.slice(0, 2)) {
        const imgUrl =
          'https://www.artic.edu/iiif/2/' + d.image_id + '/full/843,/0/default.jpg';
        const t1 = Date.now();
        try {
          const r = await withTimeout(
            fetch(imgUrl, { method: 'GET', headers: { 'User-Agent': UA } }),
            TIMEOUT_MS
          );
          const buf = await r.arrayBuffer();
          const head = new Uint8Array(buf.slice(0, 4));
          const hex = Array.from(head)
            .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
            .join(' ');
          const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
          const isPng =
            head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
          out.images.push({
            title: d.title,
            status: r.status,
            content_type: r.headers.get('Content-Type') || null,
            bytes: buf.byteLength,
            first_bytes: hex,
            looks_like_image: isJpeg || isPng,
            ms: Date.now() - t1,
          });
        } catch (e) {
          out.images.push({
            title: d.title,
            error: String(e && e.message ? e.message : e),
            ms: Date.now() - t1,
          });
        }
      }

      return json(out);
    }

    // ── 진짜 키로 두드리기 ────────────────────────────────────
    // 키는 Cloudflare 비밀값(KEY_A / KEY_B)에 넣습니다. 주소창에 안 나옵니다.
    if (parts[0] === 'probe-key') {
      const keys = [];
      if (env.KEY_A) keys.push({ label: 'KEY_A', value: env.KEY_A });
      if (env.KEY_B) keys.push({ label: 'KEY_B', value: env.KEY_B });
      if (keys.length === 0) {
        return json(
          { error: 'KEY_A / KEY_B 비밀값이 없습니다. Cloudflare 설정에서 먼저 넣어주십시오.' },
          400
        );
      }

      const paths = [
        { name: 'emuseum / 유물목록', url: 'http://www.emuseum.go.kr/openapi/relic/list' },
        { name: 'emuseum / 코드', url: 'http://www.emuseum.go.kr/openapi/code' },
      ];

      const out = [];
      for (const k of keys) {
        for (const p of paths) {
          const u = new URL(p.url);
          u.searchParams.set('serviceKey', k.value);
          u.searchParams.set('numOfRows', '1');
          u.searchParams.set('pageNo', '1');
          const t0 = Date.now();
          try {
            const r = await withTimeout(
              fetch(u.toString(), { method: 'GET', headers: { 'User-Agent': UA } }),
              TIMEOUT_MS
            );
            const text = (await r.text()).slice(0, 700);
            out.push({
              key: k.label,
              name: p.name,
              status: r.status,
              ms: Date.now() - t0,
              // 혹시 응답에 키가 되읽혀 나와도 화면에 안 나오게 가립니다
              body_head: text.split(k.value).join('***KEY***'),
            });
          } catch (e) {
            out.push({
              key: k.label,
              name: p.name,
              error: String(e && e.message ? e.message : e),
              ms: Date.now() - t0,
            });
          }
        }
      }
      return json({ colo, checked_at: new Date().toISOString(), probes: out });
    }

    // ── 진짜 API 경로 두드리기 ────────────────────────────────
    // 키 없이 두드립니다. 서버가 살아 있으면 「키가 없다」는 오류를 돌려줍니다.
    // 그 오류와 530 은 완전히 다른 신호이므로 이걸로 갈립니다.
    if (parts[0] === 'probe') {
      const targets = [
        {
          name: 'kcisa / 12·20개 기관',
          url: 'https://api.kcisa.kr/openapi/API_CCA_145/request?serviceKey=PROBE&numOfRows=1&pageNo=1',
        },
        {
          name: 'emuseum / 유물목록',
          url: 'http://www.emuseum.go.kr/openapi/relic/list?serviceKey=PROBE&numOfRows=1&pageNo=1',
        },
        {
          name: 'emuseum / 코드',
          url: 'http://www.emuseum.go.kr/openapi/code?serviceKey=PROBE',
        },
      ];

      const out = [];
      for (const t of targets) {
        const t0 = Date.now();
        try {
          const r = await withTimeout(
            fetch(t.url, { method: 'GET', headers: { 'User-Agent': UA } }),
            TIMEOUT_MS
          );
          const text = (await r.text()).slice(0, 400);
          out.push({
            name: t.name,
            status: r.status,
            content_type: r.headers.get('Content-Type') || null,
            ms: Date.now() - t0,
            body_head: text,
          });
        } catch (e) {
          out.push({
            name: t.name,
            error: String(e && e.message ? e.message : e),
            ms: Date.now() - t0,
          });
        }
      }
      return json({ colo, checked_at: new Date().toISOString(), probes: out });
    }

    // ── 닿는지 확인 ──────────────────────────────────────────
    if (parts[0] === 'health') {
      const results = {};
      for (const [name, base] of Object.entries(UPSTREAM)) {
        const t0 = Date.now();
        try {
          const r = await withTimeout(
            fetch(base + '/', { method: 'GET', headers: { 'User-Agent': UA } }),
            TIMEOUT_MS
          );
          results[name] = {
            reachable: true,
            status: r.status,
            ms: Date.now() - t0,
          };
        } catch (e) {
          results[name] = {
            reachable: false,
            error: String(e && e.message ? e.message : e),
            ms: Date.now() - t0,
          };
        }
      }
      return json({ colo, checked_at: new Date().toISOString(), results });
    }

    // ── 중계 ────────────────────────────────────────────────
    const base = UPSTREAM[parts[0]];
    if (!base) {
      return json(
        { error: 'unknown upstream', got: parts[0], allowed: Object.keys(UPSTREAM) },
        400
      );
    }

    // 토큰을 설정해 둔 경우에만 검사합니다
    if (env.RELAY_TOKEN) {
      if (request.headers.get('X-Relay-Token') !== env.RELAY_TOKEN) {
        return json({ error: 'bad or missing X-Relay-Token' }, 401);
      }
    }

    if (request.method !== 'GET') {
      return json({ error: 'GET only' }, 405);
    }

    const target = new URL(base + '/' + parts.slice(1).join('/'));
    target.search = url.search;

    // 키를 헤더로 보내면 질의문자열에 붙여 줍니다 (주소에 키를 안 남기려는 경우)
    const headerKey = request.headers.get('X-Api-Key');
    if (headerKey && !target.searchParams.has('serviceKey')) {
      target.searchParams.set('serviceKey', headerKey);
    }

    const t0 = Date.now();
    try {
      const upstream = await withTimeout(
        fetch(target.toString(), {
          method: 'GET',
          headers: {
            'User-Agent': UA,
            Accept: request.headers.get('Accept') || 'application/json',
          },
          redirect: 'follow',
        }),
        TIMEOUT_MS
      );

      const body = await upstream.arrayBuffer();
      const headers = new Headers();
      const ct = upstream.headers.get('Content-Type');
      if (ct) headers.set('Content-Type', ct);
      headers.set('X-Relay-Upstream-Status', String(upstream.status));
      headers.set('X-Relay-Ms', String(Date.now() - t0));
      headers.set('X-Relay-Colo', colo);
      headers.set('Cache-Control', 'no-store');

      return new Response(body, { status: upstream.status, headers });
    } catch (e) {
      return json(
        {
          error: 'upstream fetch failed',
          detail: String(e && e.message ? e.message : e),
          target: target.origin + target.pathname,
          ms: Date.now() - t0,
          colo,
        },
        502
      );
    }
  },
};

const UA = 'opusfine-relay/1.0 (+https://opusfine.vercel.app)';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout after ' + ms + 'ms')), ms)
    ),
  ]);
}
