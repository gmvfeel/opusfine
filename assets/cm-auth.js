/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 커뮤니티 회원 — assets/cm-auth.js · 2026-10-01
   ------------------------------------------------------------------
   오퍼스클램 assets/auth.js(911줄)의 뼈대를 오퍼스파인에 맞춰 줄여
   옮겼습니다. 바뀐 것:
     · persons/members(음악) → community_members(미술), 표 칸 이름도
       오퍼스파인 전용(member_type: artist·org·school·general)
     · Supabase 클라이언트는 새로 만들지 않고 OF.sb() 하나만 씁니다
       (config.js 가 이미 「하나만 만든다」를 지킵니다)
     · 매직링크·일일 로그인 포인트·커스텀 생년월일 3단 고르개·
       이메일 도메인 분리 입력 등 음악 전용 부가 기능은 뺐습니다.
       (나중에 필요해지면 오퍼스클램을 다시 참고해 더하면 됩니다)
     · 관리자 로그인용 public.members 표와는 전혀 다른 표입니다 —
       섞이지 않도록 회원가입 때 user_metadata.cm_signup='true' 를
       반드시 실어 보냅니다 (DB 쪽 handle_new_member() 트리거가 이
       표시를 보고 관리자 계정표에 끼워 넣지 않습니다).

   내놓는 것 — window.CM
     usernameAvailable(u)      아이디 중복 확인
     login(idOrUsername, pw)   아이디(또는 이메일)로 로그인
     logout()
     session()                 현재 세션
     me()                      내 community_members 행
     nextUrl()                 로그인 뒤 돌아갈 주소(열린 넘겨주기 방지)
     social(provider)          소셜 로그인('google'|'kakao')
     signup(common, type, extra)  회원가입 한 번에
     formSignup(doc, type)     [data-k] 달린 입력을 훑어 자동으로 모음
     updateMe(fields)          마이페이지에서 내 정보 고치기
     sendPasswordReset(email)
     updatePassword(newPw)
     withdraw()                탈퇴(상태만 바꿈, 계정 자체는 관리자가 정리)
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.CM) return;
  if (!window.OF || !OF.sb) { console.error('[cm-auth] OF.sb 가 없습니다 — config.js 를 먼저 불러오십시오.'); return; }

  var TYPE_LABEL = { artist: '작가 회원', org: '미술관계자·단체 회원', school: '미술학교 회원', general: '일반 회원' };

  function esc(v) { return String(v == null ? '' : v); }
  function looksEmail(v) { return /.+@.+\..+/.test(String(v || '')); }

  function nextUrl() {
    try {
      var q = new URLSearchParams(location.search).get('next') || '';
      if (!q) return '/';
      if (q.indexOf('//') !== -1) return '/';
      if (q.indexOf('\\') !== -1) return '/';
      if (q.charAt(0) !== '/') return '/';
      return q;
    } catch (e) { return '/'; }
  }

  function usernameAvailable(u) {
    return OF.sb().then(function (sb) {
      if (!sb) return false;
      return sb.rpc('cm_username_available', { p_username: u }).then(function (r) {
        return !r.error && r.data === true;
      })['catch'](function () { return false; });
    });
  }

  function emailForUsername(u) {
    return OF.sb().then(function (sb) {
      if (!sb) return null;
      return sb.rpc('cm_email_for_username', { p_username: u }).then(function (r) {
        return (!r.error && r.data) ? r.data : null;
      })['catch'](function () { return null; });
    });
  }

  function login(idOrUsername, pw) {
    return OF.sb().then(function (sb) {
      if (!sb) return { ok: false, msg: '접속 준비 중입니다. 잠시 후 다시 시도해 주세요.' };
      var idp = String(idOrUsername || '').trim();
      var go = looksEmail(idp) ? Promise.resolve(idp) : emailForUsername(idp);
      return go.then(function (email) {
        if (!email) return { ok: false, msg: '아이디 또는 비밀번호가 올바르지 않습니다.' };
        return sb.auth.signInWithPassword({ email: email, password: pw }).then(function (r) {
          if (r.error) return { ok: false, msg: '아이디 또는 비밀번호가 올바르지 않습니다.' };
          var uid = r.data && r.data.user && r.data.user.id;
          return sb.from('community_members').select('status').eq('id', uid).maybeSingle().then(function (m) {
            if (m.data && m.data.status === 'withdrawn') {
              sb.auth.signOut();
              return { ok: false, msg: '탈퇴한 계정입니다.' };
            }
            return { ok: true };
          });
        });
      });
    });
  }

  function logout() {
    return OF.sb().then(function (sb) { return sb ? sb.auth.signOut() : null; });
  }

  function session() {
    return OF.sb().then(function (sb) {
      if (!sb) return null;
      return sb.auth.getSession().then(function (r) { return (r.data && r.data.session) || null; });
    });
  }

  function me() {
    return OF.sb().then(function (sb) {
      if (!sb) return null;
      return sb.auth.getUser().then(function (u) {
        var user = u && u.data && u.data.user;
        if (!user) return null;
        return sb.from('community_members').select('*').eq('id', user.id).maybeSingle()
          .then(function (r) { return r.data || null; });
      });
    });
  }

  function social(provider) {
    return OF.sb().then(function (sb) {
      if (!sb) return;
      var redirectTo = location.origin + '/account/login.html'
        + (nextUrl() !== '/' ? '?next=' + encodeURIComponent(nextUrl()) : '');
      return sb.auth.signInWithOAuth({ provider: provider, options: { redirectTo: redirectTo } });
    });
  }

  /* 회원가입 — common: {username,password,name,email,phone,birth}
     type: artist|org|school|general, extra: 그 외 칸(jsonb 로 들어감) */
  function signup(common, type, extra) {
    return OF.sb().then(function (sb) {
      if (!sb) return { ok: false, msg: '접속 준비 중입니다. 잠시 후 다시 시도해 주세요.' };
      if (!common.username || !common.password || !common.email || !common.name) {
        return { ok: false, msg: '필수 항목을 모두 입력해 주세요.' };
      }
      return usernameAvailable(common.username).then(function (ok) {
        if (!ok) return { ok: false, msg: '이미 사용 중인 아이디입니다.' };
        return sb.auth.signUp({
          email: common.email,
          password: common.password,
          options: { data: { cm_signup: 'true', name: common.name } }
        }).then(function (r) {
          if (r.error) return { ok: false, msg: r.error.message || '가입 처리 중 오류가 발생했습니다.' };
          var user = r.data && r.data.user;
          if (!user) return { ok: false, msg: '가입은 되었으나 확인 메일 절차가 필요할 수 있습니다. 메일함을 확인해 주세요.' };
          var row = {
            id: user.id,
            username: common.username,
            member_type: type,
            name: common.name,
            email: common.email,
            phone: common.phone || null,
            birth: common.birth || null,
            interests: common.interests || [],
            extra: extra || {}
          };
          return sb.from('community_members').insert(row).then(function (ins) {
            if (ins.error) return { ok: false, msg: '회원 정보 저장 중 오류가 발생했습니다 — ' + ins.error.message };
            return { ok: true, type: type };
          });
        });
      });
    });
  }

  /* [data-k] 달린 입력을 훑어 자동으로 공통/부가 칸으로 나눕니다.
     공통 칸 목록은 아래 COMMON_KEYS 한 곳에만 둡니다. */
  var COMMON_KEYS = ['username', 'password', 'password2', 'name', 'name_en', 'email', 'phone', 'birth'];

  function readForm(doc) {
    var out = { common: {}, extra: {}, interests: [] };
    doc.querySelectorAll('[data-k]').forEach(function (el) {
      var k = el.getAttribute('data-k');
      var v;
      if (el.type === 'checkbox') {
        if (!el.checked) return;
        if (el.hasAttribute('data-multi')) { out.interests.push(el.value); return; }
        v = el.value;
      } else {
        v = (el.value || '').trim();
      }
      if (!v) return;
      if (COMMON_KEYS.indexOf(k) !== -1) out.common[k] = v;
      else out.extra[k] = v;
    });
    return out;
  }

  function validateRequired(doc) {
    var bad = [];
    doc.querySelectorAll('[data-req]').forEach(function (el) {
      var v = el.type === 'checkbox' ? el.checked : (el.value || '').trim();
      if (!v) bad.push(el);
    });
    return bad;
  }

  function formSignup(doc, type) {
    var bad = validateRequired(doc);
    if (bad.length) { bad[0].focus(); return Promise.resolve({ ok: false, msg: '필수 항목(*)을 모두 입력해 주세요.' }); }
    var f = readForm(doc);
    if (f.common.password !== f.common.password2) {
      return Promise.resolve({ ok: false, msg: '비밀번호가 서로 다릅니다.' });
    }
    if (String(f.common.password || '').length < 8) {
      return Promise.resolve({ ok: false, msg: '비밀번호는 8자 이상이어야 합니다.' });
    }
    delete f.common.password2;
    f.common.interests = f.interests;
    return signup(f.common, type, f.extra);
  }

  function updateMe(fields) {
    return OF.sb().then(function (sb) {
      if (!sb) return { ok: false, msg: '접속 준비 중입니다.' };
      return sb.auth.getUser().then(function (u) {
        var user = u && u.data && u.data.user;
        if (!user) return { ok: false, msg: '로그인이 필요합니다.' };
        return sb.from('community_members').update(fields).eq('id', user.id).then(function (r) {
          return r.error ? { ok: false, msg: r.error.message } : { ok: true };
        });
      });
    });
  }

  function sendPasswordReset(email) {
    return OF.sb().then(function (sb) {
      if (!sb) return { ok: false };
      return sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/account/reset-password.html' })
        .then(function (r) { return { ok: !r.error, msg: r.error ? r.error.message : '' }; });
    });
  }

  function updatePassword(pw) {
    return OF.sb().then(function (sb) {
      if (!sb) return { ok: false };
      return sb.auth.updateUser({ password: pw }).then(function (r) {
        return { ok: !r.error, msg: r.error ? r.error.message : '' };
      });
    });
  }

  function withdraw() {
    return OF.sb().then(function (sb) {
      if (!sb) return { ok: false };
      return sb.rpc('cm_withdraw_me').then(function (r) {
        if (r.error) return { ok: false, msg: r.error.message };
        return sb.auth.signOut().then(function () { return { ok: true }; });
      });
    });
  }

  window.CM = {
    TYPE_LABEL: TYPE_LABEL,
    usernameAvailable: usernameAvailable,
    emailForUsername: emailForUsername,
    login: login,
    logout: logout,
    session: session,
    me: me,
    nextUrl: nextUrl,
    social: social,
    signup: signup,
    formSignup: formSignup,
    updateMe: updateMe,
    sendPasswordReset: sendPasswordReset,
    updatePassword: updatePassword,
    withdraw: withdraw
  };

  /* ══ 헤더의 로그인/회원가입/마이페이지 자리를 로그인 상태에 맞춰 바꿉니다 ══
     partials/header.html 의 두 자리(작은 메뉴·전체메뉴)에
     data-cm-auth 를 달아 두면, 이 스크립트가 알아서 채웁니다. */
  function paintHeader(meRow) {
    var spots = document.querySelectorAll('[data-cm-auth]');
    if (!spots.length) return;
    spots.forEach(function (el) {
      var wide = el.getAttribute('data-cm-auth') === 'wide';
      var cls = wide ? '' : ' class="act"';
      if (meRow) {
        var nm = esc(meRow.name || meRow.username || '회원');
        el.innerHTML = wide
          ? '<a' + cls + ' href="/account/mypage.html">' + nm + '님</a><a' + cls + ' href="/account/mypage.html">마이페이지</a><a' + cls + ' href="#" data-cm-logout>로그아웃</a>'
          : '<a' + cls + ' href="/account/mypage.html">' + nm + '님</a><a' + cls + ' href="#" data-cm-logout>로그아웃</a>';
      } else {
        el.innerHTML = '<a' + cls + ' href="/account/login.html">로그인</a><a' + cls + ' href="/account/join.html">회원가입</a>';
      }
    });
    document.querySelectorAll('[data-cm-logout]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        logout().then(function () { location.reload(); });
      });
    });
  }

  function initHeader() {
    if (!document.querySelector('[data-cm-auth]')) return;
    session().then(function (ses) {
      if (!ses) { paintHeader(null); return; }
      me().then(function (row) { paintHeader(row && row.status !== 'withdrawn' ? row : null); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeader);
  } else {
    initHeader();
  }
  /* partials/header.html 은 /assets/include.js 로 뒤늦게 끼워지므로,
     끼움이 끝난 뒤(oc:included)에도 한 번 더 시도합니다. */
  document.addEventListener('oc:included', initHeader);
})();
