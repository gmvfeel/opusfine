/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 연결 정보 · assets/config.js
   ------------------------------------------------------------------
   ★ Supabase 주소와 공개키를 <b>여기 한 곳에만</b> 둡니다.
     화면마다 적어 두면 나중에 갈아 끼울 때 빠뜨리는 곳이 생깁니다.

   ★ 여기 있는 것은 <b>공개키</b>입니다. 브라우저에 그대로 실려 나가는
     것이라 감출 수 없고, 감출 까닭도 없습니다. 이 키로 무엇을 읽고
     쓸 수 있는지는 <b>DB 쪽 자물쇠(RLS)</b>가 정합니다.

   ★★ service_role 키는 <b>절대 여기 두지 마십시오.</b> 그것은 모든
     자물쇠를 여는 열쇠입니다. 자동수집 워크플로에서만 쓰고,
     GitHub Secrets 에 넣습니다 — 오퍼스클램과 같습니다.

   ★ 클라이언트는 반드시 <b>하나만</b> 만듭니다(OF.sb()). createClient 를
     두 번 부르면 로그인 정보가 질의에 실리지 않아, RLS 가 로그인한
     사람을 남처럼 봅니다. 오퍼스클램에서 여러 번 겪은 일입니다.
   ══════════════════════════════════════════════════════════════════ */
window.OF = window.OF || {};

OF.SB_URL = 'https://jmankqdbvyrnyhxjmqsa.supabase.co';
OF.SB_KEY = 'sb_publishable_q8y3AUDpoQrT86HmZMLBHA_dn9-CJ3x';

/* supabase-js 를 아직 안 실었으면 여기서 싣습니다.
   화면마다 <script> 를 적어 둘 필요가 없습니다. */
OF._libWait = null;
OF.lib = function () {
  if (window.supabase && window.supabase.createClient) return Promise.resolve(true);
  if (OF._libWait) return OF._libWait;
  OF._libWait = new Promise(function (done) {
    var old = document.querySelector('script[data-of-sblib]');
    if (old) {
      old.addEventListener('load', function () { done(true); });
      old.addEventListener('error', function () { done(false); });
      return;
    }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    s.setAttribute('data-of-sblib', '1');
    s.onload = function () { done(true); };
    s.onerror = function () { done(false); };
    (document.head || document.documentElement).appendChild(s);
  });
  return OF._libWait;
};

/* 하나뿐인 클라이언트 */
OF.sb = function () {
  return OF.lib().then(function (ok) {
    if (!ok) return null;
    if (!window.__ofSb) window.__ofSb = window.supabase.createClient(OF.SB_URL, OF.SB_KEY);
    return window.__ofSb;
  });
};

/* ── 도판 주소 손질 ────────────────────────────────────────────
   ★★ 2026-08-22 · <b>시카고 도판이 다 깨졌습니다</b> (파트너 확인).
     시카고는 Cloudflare 뒤에 있어, 다른 사이트에서 브라우저가 직접
     그림을 부르면 <b>봇 검사 화면</b>이 오고 그림이 오지 않습니다.
     주소는 맞습니다 — 주소창에 직접 넣으면 그림이 뜹니다.

   ▶ <b>우리 서버를 거쳐</b> 부릅니다. 브라우저는 opusfine 주소를 부르고,
     Vercel 이 시카고에 대신 물어 옵니다(vercel.json 의 rewrites).
     서버끼리 주고받는 것이라 봇 검사에 걸리지 않습니다.

   ★ 그림을 <b>우리 저장소에 담는 것이 아닙니다.</b> 지나가게만 합니다 —
     담으면 저장소가 무거워지고 자료가 늘 때마다 커집니다.

   ★ 메트는 이렇게 하지 않아도 잘 옵니다. 손대지 않습니다 —
     거칠 까닭이 없는 것을 거치면 느려지기만 합니다. */
OF.img = function (u) {
  if (!u) return u;
  var m = /^https?:\/\/www\.artic\.edu\/iiif\/2\/(.+)$/.exec(String(u));
  return m ? '/img/aic/' + m[1] : u;
};
