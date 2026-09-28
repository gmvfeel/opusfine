/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 관리자 계정 만들기 통로 · api/invite-admin.js
   ------------------------------------------------------------------
   ★ 왜 이 파일이 있나
     오퍼스파인엔 공개 회원가입이 없습니다(파트너 결정 · 2026-09-29 ·
     파트너·내부 관계자만). 그런데 로그인하려면 auth.users 에 계정이
     있어야 하고, 그건 비밀번호를 암호로 바꾸는 절차가 따로 있어
     SQL 로 직접 못 만듭니다(Supabase 가 관리하는 형식).
     ▶ 그래서 Admin API 를 <b>서버에서만</b> 부르는 통로를 하나 둡니다.

   ★★ 열쇠를 화면에 두지 않습니다
     SUPABASE_SERVICE_KEY 는 여기서만 씁니다. COLLECT_TOKEN 자물쇠는
     api/collect.js 와 같은 것을 그대로 씁니다 — 새 자물쇠를 늘리지
     않습니다.

   ── Vercel 환경변수 (이미 있는 것을 그대로 씀) ───────────────────
     SUPABASE_URL           https://jmankqdbvyrnyhxjmqsa.supabase.co
     SUPABASE_SERVICE_KEY   Supabase → Settings → API Keys → service_role
     COLLECT_TOKEN           (이미 있음 · api/collect.js 와 같은 값)

   ── 쓰는 법 (터미널에서, 화면 없이) ───────────────────────────────
     curl -X POST https://opusfine.vercel.app/api/invite-admin \
       -H "Content-Type: application/json" \
       -d '{"token":"…COLLECT_TOKEN…","email":"…","password":"…",
            "name":"…","make_admin":true}'

     make_admin:true 를 주면 members.is_admin 도 바로 true 로 올립니다.
     안 주면 계정만 생기고 관리자는 아닙니다(나중에 SQL 로 올림).
   ══════════════════════════════════════════════════════════════════ */

export default async function handler (req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ 오류: 'POST 로만 부르십시오' });
    return;
  }

  const want = process.env.COLLECT_TOKEN;
  if (!want) { res.status(500).json({ 오류: '서버에 COLLECT_TOKEN 이 없습니다' }); return; }

  const body = req.body || {};
  if (String(body.token || '') !== want) {
    res.status(401).json({ 오류: '자물쇠가 안 맞습니다' });
    return;
  }

  const email = String(body.email || '').trim();
  const password = String(body.password || '');
  const name = String(body.name || '').trim();
  if (!email || !password) {
    res.status(400).json({ 오류: 'email 과 password 가 필요합니다' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ 오류: '비밀번호는 8자 이상이어야 합니다' });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    res.status(500).json({ 오류: 'SUPABASE_URL 또는 SUPABASE_SERVICE_KEY 가 서버에 없습니다' });
    return;
  }

  try {
    /* ── 계정 만들기 (Admin API) ── 만들면 members 행도
       트리거로 자동 생깁니다(is_admin=false 로 시작). */
    const cr = await fetch(url.replace(/\/+$/, '') + '/auth/v1/admin/users', {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: name ? { name: name } : {}
      })
    });
    const created = await cr.json();
    if (!cr.ok) {
      res.status(cr.status).json({ 오류: '계정 만들기 실패', 상세: created });
      return;
    }
    const uid = created.id || (created.user && created.user.id);

    /* ── 관리자로 올리기 (요청했을 때만) ── */
    if (body.make_admin && uid) {
      const up = await fetch(url.replace(/\/+$/, '') + '/rest/v1/members?id=eq.' + uid, {
        method: 'PATCH',
        headers: {
          'apikey': key,
          'Authorization': 'Bearer ' + key,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ is_admin: true })
      });
      if (!up.ok) {
        res.status(200).json({
          ok: true, id: uid, email: email,
          경고: '계정은 만들었는데 is_admin 올리기가 실패했습니다 — ' + (await up.text()).slice(0, 200)
        });
        return;
      }
    }

    res.status(200).json({ ok: true, id: uid, email: email, is_admin: !!body.make_admin });
  } catch (e) {
    res.status(500).json({ 오류: String(e.message || e) });
  }
}
