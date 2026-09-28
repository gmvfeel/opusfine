/* ══════════════════════════════════════════════════════════════
   관리자 화면 로그인 지킴이 — assets/admin-guard.js
   2026-09-29 · 오퍼스클램의 assets/admin-guard.js 를 그대로 가져옴
   (파트너가 2026-08-06 악보 106건 헛담은 일에서 나온 장치 —
   브라우저에 담긴 토큰만 보면 만료된 것도 「살아 있다」고 보임)

   무엇을 하나
     OFAdminGuard.check(sb)        지금 로그인이 살아 있는지 서버에
                                   물어봅니다. 만료가 가까우면 되살려 봅니다.
     OFAdminGuard.watch(sb, el)    화면 표시를 살아있게 지켜봅니다.
     OFAdminGuard.isAuthLost(msg)  오류가 「로그인 풀림」 때문인지 알아봅니다.

   ★ 화면을 고치지 않습니다 — 판단만 돌려줍니다.
   ★ /admin/ 밖에서는 아무 일도 하지 않습니다.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.OFAdminGuard) return;

  var SOON_MS = 2 * 60 * 1000;

  function check(sb) {
    if (!sb) return Promise.resolve({ ok: false, why: 'error', msg: '접속 객체가 없습니다.' });

    return sb.auth.getSession().then(function (r) {
      var ses = r && r.data && r.data.session;
      if (!ses) return { ok: false, why: 'no-session', msg: '로그인하지 않았습니다.' };

      var msLeft = (ses.expires_at ? ses.expires_at * 1000 : 0) - Date.now();
      if (msLeft < SOON_MS) {
        return sb.auth.refreshSession().then(function (rr) {
          if (rr.error || !(rr.data && rr.data.session)) {
            return { ok: false, why: 'expired', msg: '로그인이 풀렸습니다. 다시 로그인해 주십시오.' };
          }
          return afterSession(sb);
        })['catch'](function () {
          return { ok: false, why: 'expired', msg: '로그인이 풀렸습니다. 다시 로그인해 주십시오.' };
        });
      }
      return afterSession(sb);
    })['catch'](function (e) {
      return { ok: false, why: 'error', msg: '로그인 확인에 실패했습니다 — ' + (e.message || e) };
    });
  }

  function afterSession(sb) {
    return sb.auth.getUser().then(function (u) {
      var user = u && u.data && u.data.user;
      if (u.error || !user) {
        return { ok: false, why: 'expired', msg: '로그인이 풀렸습니다. 다시 로그인해 주십시오.' };
      }
      return sb.from('members').select('id,name,is_admin').eq('id', user.id).maybeSingle()
        .then(function (m) {
          if (m.error || !m.data) {
            return { ok: false, why: 'expired', msg: '로그인이 풀렸습니다. 다시 로그인해 주십시오.' };
          }
          if (m.data.is_admin !== true) {
            return { ok: false, why: 'not-admin', msg: '관리자만 쓸 수 있습니다.' };
          }
          return { ok: true, me: m.data };
        });
    })['catch'](function (e) {
      return { ok: false, why: 'error', msg: '로그인 확인에 실패했습니다 — ' + (e.message || e) };
    });
  }

  function isAuthLost(msg) {
    var m = String(msg || '').toLowerCase();
    return /row-level security|jwt|token|unauthorized|not authenticated|permission denied/.test(m);
  }

  var BAR_ID = 'ofAuthBar';

  function bar(msg) {
    var el = document.getElementById(BAR_ID);
    if (!msg) { if (el) el.remove(); return; }

    if (!document.getElementById('ofAuthBarCss')) {
      var st = document.createElement('style');
      st.id = 'ofAuthBarCss';
      st.textContent =
          '#' + BAR_ID + '{position:fixed;top:0;left:0;right:0;z-index:99999;'
        + 'padding:13px 18px;background:#8C3A2B;color:#fff;'
        + 'font-size:14px;font-weight:700;line-height:1.6;text-align:center;'
        + 'box-shadow:0 4px 18px rgba(0,0,0,.4);}'
        + '#' + BAR_ID + ' a{color:#ffd9a8;text-decoration:underline;margin-left:10px;}'
        + '#' + BAR_ID + ' .x{position:absolute;right:12px;top:9px;width:30px;height:30px;'
        + 'border:0;border-radius:50%;background:rgba(255,255,255,.16);color:#fff;'
        + 'font-size:15px;line-height:1;cursor:pointer;}'
        + 'body{transition:padding-top .15s ease;}';
      document.head.appendChild(st);
    }

    if (!el) {
      el = document.createElement('div');
      el.id = BAR_ID;
      document.body.appendChild(el);
    }
    el.innerHTML = '★ ' + msg
      + '<a href="/admin/login.html?next=' + encodeURIComponent(location.pathname) + '">다시 로그인 &#8594;</a>'
      + '<button type="button" class="x" aria-label="닫기">&#10005;</button>';
    var x = el.querySelector('.x');
    if (x) x.addEventListener('click', function () { el.remove(); });
  }

  function watch(sb, el, opt) {
    opt = opt || {};
    window.__ofAdminGuardOn = true;
    var every = (opt.everyMin || 5) * 60 * 1000;

    function paint(r) {
      if (el) {
        el.innerHTML = r.ok
          ? '<b>' + esc(r.me.name || '-') + '</b> · 관리자'
          : '★ <b>' + esc(r.msg) + '</b> '
            + '<a href="/admin/login.html?next=' + encodeURIComponent(location.pathname)
            + '" style="color:#A8863C">다시 로그인 &#8594;</a>';
      }
      if (r.ok) bar(null);
      else if (r.why === 'expired' || r.why === 'no-session') bar(esc(r.msg));

      if (r.ok) { if (opt.on) opt.on(r.me); }
      else { if (opt.off) opt.off(r.msg, r.why); }
    }

    function tick() { check(sb).then(paint); }

    tick();
    setInterval(tick, every);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) tick();
    });
    return { refresh: tick };
  }

  function esc(v) {
    var d = document.createElement('div');
    d.textContent = (v == null ? '' : String(v));
    return d.innerHTML;
  }

  window.OFAdminGuard = { check: check, watch: watch, isAuthLost: isAuthLost, bar: bar };

  /* ══ 스스로 붙습니다 (자동) — /admin/ 과 /tools/ 아래에서만 ══ */
  function autoStart() {
    if (window.__ofAdminGuardOn) return;
    var p = location.pathname;
    if (p.indexOf('/admin/') !== 0 && p.indexOf('/tools/') !== 0) return;
    if (p === '/admin/login.html') return;               /* 로그인 화면 자신은 뺌 */

    var n = 0;
    (function tick() {
      var c = window.__ofSb;
      if (!c && window.OF && window.OF.sb) {
        window.OF.sb().then(function (sb) {
          if (window.__ofAdminGuardOn) return;
          window.__ofAdminGuardOn = true;
          watch(sb, document.getElementById('who'), { everyMin: 5 });
        });
        return;
      }
      if (!c) {
        if (++n > 60) return;
        return setTimeout(tick, 50);
      }
      if (window.__ofAdminGuardOn) return;
      window.__ofAdminGuardOn = true;
      watch(c, document.getElementById('who'), { everyMin: 5 });
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoStart);
  } else {
    autoStart();
  }
})();
