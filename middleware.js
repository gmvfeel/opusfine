/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 언어 주소 이어주기 · middleware.js
   ------------------------------------------------------------------
   ★ 이 파일이 없으면 <b>/en/… 이 통째로 404</b> 입니다.
     오퍼스클램에서 이탈리아어를 더할 때 이것을 빠뜨려 겪은 일이라
     주석에 「middleware.js 를 빠뜨리면 /it/ 이 통째로 404」라고
     적혀 있습니다.

   ── 무엇을 하는가 ──────────────────────────────────────────────
     /en/db/artist.html  →  (속으로) /db/artist.html 을 내보냅니다
     브라우저 주소는 <b>/en/… 그대로</b> 남습니다.

     그러면 assets/i18n.js 가 주소 첫 마디(en)를 보고
     화면의 한국어를 영어로 바꿉니다.

   ── 왜 이렇게 하나 ─────────────────────────────────────────────
     화면 파일을 언어 수만큼 복사하지 않습니다.
     한국어 화면 <b>한 벌</b>로 여섯 말을 다 냅니다.
     (오퍼스클램 146화면 × 6 = 876파일을 만들지 않은 까닭)

   ── 언어를 더할 때 ─────────────────────────────────────────────
     ★ 세 곳을 <b>함께</b> 고쳐야 합니다
       ① assets/i18n.js 의 LANGS
       ② assets/i18n/{말}.json
       ③ <b>이 파일의 LANGS 와 config.matcher</b>
     하나라도 빠뜨리면 그 말이 404 이거나 한국어로 나옵니다.

   ── 건드리지 않는 것 ───────────────────────────────────────────
     · /assets/ · /partials/ · /tools/ · /sql/ — 파일이므로 그대로
     · 확장자가 붙은 것 (.js · .css · .json · .png …)
     · robots.txt · sitemap.xml · manifest
   ══════════════════════════════════════════════════════════════════ */

/* ★ i18n.js 의 LANGS 와 <b>똑같이</b> 두십시오. */
const LANGS = ['en', 'ja', 'de', 'es', 'it'];

/* 손대지 않을 자리 */
const SKIP_PREFIX = /^\/(assets|partials|seed|scripts|sql|tools|data|img|icon-|manifest|sw\.js|robots\.txt|sitemap\.xml)/i;
const FILE_EXT    = /\.(png|jpe?g|gif|svg|webp|css|js|mjs|json|xml|txt|ico|pdf|webmanifest|woff2?|ttf)$/i;

export const config = {
  /* ★ 여기 적힌 주소에서만 이 파일이 돕니다.
       언어를 더하면 <b>이 목록도 함께</b> 고치십시오. */
  matcher: ['/en/:path*', '/ja/:path*', '/de/:path*', '/es/:path*', '/it/:path*']
};

export default function middleware(request) {
  const url  = new URL(request.url);
  const path = url.pathname;

  /* 첫 마디가 우리가 아는 말인가 */
  const seg = (path.split('/')[1] || '').toLowerCase();
  if (LANGS.indexOf(seg) < 0) return;

  /* 말을 뗀 알맹이 주소 — /en/db/artist → /db/artist */
  let bare = path.slice(('/' + seg).length) || '/';
  if (bare.charAt(0) !== '/') bare = '/' + bare;

  /* 파일 자리는 손대지 않습니다.
     ★ 다만 여기까지 왔다는 것은 /en/assets/… 처럼 잘못 걸린 것이므로
       말을 떼어 제자리로 보냅니다. */
  if (SKIP_PREFIX.test(bare) || FILE_EXT.test(bare)) {
    return Response.redirect(new URL(bare + url.search, url), 308);
  }

  /* 속으로 한국어 화면을 내보냅니다. 주소는 /en/… 그대로 남습니다. */
  const target = new URL(bare + url.search, url);
  return fetch(target, request);
}
