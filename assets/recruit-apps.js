/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 리쿠르트 지원 내역 — assets/recruit-apps.js · 2026-10-01
   ------------------------------------------------------------------
   오퍼스클램 assets/recruit-apps.js 를 참고해 포팅했습니다. 마이페이지에
   두 묶음을 그립니다 — 받은지원(단체·학교가 자기 공고에 온 지원을 봄)
   · 내지원(지원한 사람이 진행 상황을 봄). 펼치기 · 읽음표시 · 상태
   바꾸기 · 메모 · 숨기기/되돌리기 · 지원취소를 그대로 담았습니다.

   쓰는 법
     <div id="raRecv"></div>   받은지원이 들어갈 자리
     <div id="raSent"></div>   내지원이 들어갈 자리
     <script src="/assets/recruit.js"></script>
     <script src="/assets/recruit-apps.js"></script>
     <script>OFRecruitApps.init();</script>
   ══════════════════════════════════════════════════════════════════ */
window.OFRecruitApps = (function () {
  'use strict';

  function sb() { return window.__ofSb || null; }
  async function sbReady() { await OF.sb(); return sb(); }
  function el(s) { return document.querySelector(s); }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmt(d) { var R = window.OFRecruit; return R && R.stampShort ? R.stampShort(d) : ''; }
  function fmtFull(d) { var R = window.OFRecruit; return R && R.stampFull ? R.stampFull(d) : ''; }

  var STATUS = ['접수', '검토중', '서류합격', '불합격', '최종합격'];
  var STATUS_CLS = { '접수': 'new', '검토중': 'ing', '서류합격': 'ok', '불합격': 'no', '최종합격': 'ok2', '지원취소': 'cancel' };

  function recvItem(a) {
    var j = a.recruit_jobs || {};
    var unread = !a.read_at;
    return '<li class="ra-it' + (unread ? ' ra-it--new' : '') + '" data-id="' + esc(a.id) + '">'
      +   '<div class="ra-it-top"><div class="ra-it-who">'
      +       (unread ? '<span class="ra-dot" title="아직 열어 보지 않았습니다"></span>' : '')
      +       '<b>' + esc(a.name || '(이름 없음)') + '</b>'
      +       '<span class="ra-st ra-st--' + (STATUS_CLS[a.status] || 'new') + '">' + esc(a.status) + '</span>'
      +     '</div><span class="ra-it-date">' + esc(fmt(a.created_at)) + '</span></div>'
      +   '<a class="ra-it-job" href="/recruit/job-view.html?id=' + esc(a.job_id) + '">' + esc(j.title || '(공고를 찾을 수 없습니다)') + '</a>'
      +   '<div class="ra-it-more" hidden></div></li>';
  }
  function sentItem(a) {
    var j = a.recruit_jobs || {};
    return '<li class="ra-it" data-id="' + esc(a.id) + '">'
      +   '<div class="ra-it-top"><div class="ra-it-who">'
      +       '<b>' + esc(j.org_name || '(단체명 없음)') + '</b>'
      +       '<span class="ra-st ra-st--' + (STATUS_CLS[a.status] || 'new') + '">' + esc(a.status) + '</span>'
      +     '</div><span class="ra-it-date">' + esc(fmt(a.created_at)) + '</span></div>'
      +   '<a class="ra-it-job" href="/recruit/job-view.html?id=' + esc(a.job_id) + '">' + esc(j.title || '(공고가 지워졌습니다)') + '</a>'
      +   '<div class="ra-it-more" hidden></div></li>';
  }

  function detailHtml(a, forOrg) {
    var out = '';
    if (forOrg) {
      out += '<dl class="ra-dl">'
        + '<dt>연락처</dt><dd>' + esc(a.phone || '—') + (a.phone ? ' <a class="ra-mini" href="tel:' + esc(a.phone) + '">전화</a>' : '') + '</dd>'
        + '<dt>이메일</dt><dd>' + esc(a.email || '—') + (a.email ? ' <a class="ra-mini" href="mailto:' + esc(a.email) + '">메일</a>' : '') + '</dd>'
        + '<dt>지원한 때</dt><dd>' + esc(fmtFull(a.created_at)) + '</dd></dl>';
    } else {
      out += '<dl class="ra-dl">'
        + '<dt>낸 이름</dt><dd>' + esc(a.name || '—') + '</dd>'
        + '<dt>낸 연락처</dt><dd>' + esc(a.phone || '—') + ' · ' + esc(a.email || '—') + '</dd>'
        + '<dt>지원한 때</dt><dd>' + esc(fmtFull(a.created_at)) + '</dd></dl>';
    }
    if (a.talent_id) out += '<p class="ra-row"><span class="ra-row-l">붙인 인재정보</span><a class="ra-mini" href="/recruit/talent-view.html?id=' + esc(a.talent_id) + '">열어 보기</a></p>';
    if (a.file_url) out += '<p class="ra-row"><span class="ra-row-l">붙인 파일</span><a class="ra-mini" href="' + esc(a.file_url) + '" target="_blank" rel="noopener noreferrer">' + esc(a.file_name || '내려받기') + '</a></p>';
    if (a.message) out += '<div class="ra-memo"><span class="ra-row-l">하고 싶은 말</span><p>' + esc(a.message).replace(/\n/g, '<br>') + '</p></div>';

    if (forOrg) {
      out += '<div class="ra-ctl"><label>진행 상태</label>'
        + '<select class="ra-sel" data-id="' + esc(a.id) + '">' + STATUS.map(function (st) { return '<option' + (st === a.status ? ' selected' : '') + '>' + esc(st) + '</option>'; }).join('') + '</select>'
        + '<span class="ra-ctl-msg"></span></div>'
        + '<div class="ra-ctl ra-ctl--memo"><label>메모 <span class="ra-only">지원자에게는 보이지 않습니다</span></label>'
        + '<textarea class="ra-memo-in" rows="2" data-id="' + esc(a.id) + '" placeholder="면접 일정, 참고할 점 등">' + esc(a.org_memo || '') + '</textarea>'
        + '<button type="button" class="ra-mini-btn" data-memo="' + esc(a.id) + '">메모 저장</button></div>'
        + '<div class="ra-ctl">'
        + (a.org_hidden
          ? '<button type="button" class="ra-mini-btn" data-unhide="' + esc(a.id) + '">다시 보이기</button><span class="ra-ctl-msg">지금은 목록에서 감춰져 있습니다.</span>'
          : '<button type="button" class="ra-mini-btn ra-hide-btn" data-hide="' + esc(a.id) + '">목록에서 숨기기</button><span class="ra-ctl-msg">지원자에게는 그대로 남습니다. 언제든 되돌릴 수 있습니다.</span>')
        + '</div>';
    } else if (a.status !== '지원취소' && a.status !== '최종합격') {
      out += '<div class="ra-ctl"><button type="button" class="ra-mini-btn ra-cancel" data-cancel="' + esc(a.id) + '">지원 취소</button>'
        + '<span class="ra-ctl-msg">취소하시면 단체 화면에도 취소로 표시됩니다.</span></div>';
    }
    return out;
  }

  async function drawRecv(box, meId) {
    var c = await sbReady();
    box.innerHTML = '<div class="mp-msg">불러오는 중…</div>';
    var rows = [];
    try {
      var r = await c.from('recruit_applications')
        .select('*,recruit_jobs!inner(id,title,org_name,member_id)')
        .eq('recruit_jobs.member_id', meId)
        .order('created_at', { ascending: false }).limit(200);
      if (r.error) throw r.error;
      rows = r.data || [];
    } catch (e) {
      box.innerHTML = '<div class="mp-msg">받은 지원을 불러오지 못했습니다.<br><span style="font-size:12px;color:#888">' + esc(String((e && e.message) || e)) + '</span></div>';
      return;
    }
    var live = rows.filter(function (a) { return !a.org_hidden; });
    var hid = rows.filter(function (a) { return !!a.org_hidden; });
    box.__reload = function () { drawRecv(box, meId); };

    if (!live.length && !hid.length) {
      box.innerHTML = '<div class="mp-msg">아직 받은 지원이 없습니다.<br><br><a class="mp-btn primary" href="/recruit/job-write.html">채용정보 올리기</a></div>';
      return;
    }
    var unread = live.filter(function (a) { return !a.read_at && a.status !== '지원취소'; }).length;
    box.innerHTML = ''
      + '<div class="ra-sum"><span>모두 <b>' + live.length + '</b>건</span>' + (unread ? '<span class="ra-sum-new">아직 안 본 것 <b>' + unread + '</b>건</span>' : '') + '</div>'
      + (live.length ? '<ul class="ra-list">' + live.map(recvItem).join('') + '</ul>' : '<div class="mp-msg">보이는 지원이 없습니다. 아래에서 숨긴 지원을 펼쳐 보십시오.</div>')
      + (hid.length ? '<div class="ra-hid"><button type="button" class="ra-hid-tog" data-hidtog>숨긴 지원 <b>' + hid.length + '</b>건 보기</button>'
          + '<ul class="ra-list ra-list--hid" hidden>' + hid.map(recvItem).join('') + '</ul></div>' : '');
    bindList(box, rows, true);
  }

  async function drawSent(box, meId) {
    var c = await sbReady();
    box.innerHTML = '<div class="mp-msg">불러오는 중…</div>';
    var rows = [];
    try {
      var r = await c.from('recruit_applications').select('*,recruit_jobs(id,title,org_name)').eq('applicant_id', meId).order('created_at', { ascending: false }).limit(200);
      if (r.error) throw r.error;
      rows = r.data || [];
    } catch (e) {
      box.innerHTML = '<div class="mp-msg">지원 내역을 불러오지 못했습니다.<br><span style="font-size:12px;color:#888">' + esc(String((e && e.message) || e)) + '</span></div>';
      return;
    }
    if (!rows.length) { box.innerHTML = '<div class="mp-msg">아직 지원한 곳이 없습니다.<br><br><a class="mp-btn primary" href="/recruit/job.html">채용정보 보러 가기</a></div>'; return; }
    var live = rows.filter(function (a) { return a.status === '접수' || a.status === '검토중'; }).length;
    box.innerHTML = '<div class="ra-sum"><span>모두 <b>' + rows.length + '</b>건</span>' + (live ? '<span>진행 중 <b>' + live + '</b>건</span>' : '') + '</div>'
      + '<ul class="ra-list">' + rows.map(sentItem).join('') + '</ul>';
    bindList(box, rows, false);
  }

  function bindList(box, rows, forOrg) {
    box.__rows = rows; box.__forOrg = forOrg;
    if (box.__bound) return;
    box.__bound = true;

    function cur() { return box.__rows || []; }
    function byIdOf(id) { var r = cur(); for (var i = 0; i < r.length; i++) if (String(r[i].id) === String(id)) return r[i]; return null; }

    box.addEventListener('click', async function (e) {
      if (e.target.closest('a, select, textarea, button')) return;
      var li = e.target.closest('.ra-it');
      if (!li) return;
      var a = byIdOf(li.getAttribute('data-id'));
      if (!a) return;
      var more = li.querySelector('.ra-it-more');
      if (!more) return;
      if (more.hidden) {
        if (!more.innerHTML) more.innerHTML = detailHtml(a, box.__forOrg);
        more.hidden = false; li.classList.add('ra-it--open');
        if (box.__forOrg && !a.read_at) {
          try {
            var c = await sbReady();
            await c.from('recruit_applications').update({ read_at: new Date().toISOString() }).eq('id', a.id);
            a.read_at = new Date().toISOString();
            li.classList.remove('ra-it--new');
            var dot = li.querySelector('.ra-dot'); if (dot) dot.remove();
            refreshUnread(box, cur());
          } catch (err) {}
        }
      } else { more.hidden = true; li.classList.remove('ra-it--open'); }
    });

    box.addEventListener('change', async function (e) {
      var sel = e.target.closest('.ra-sel');
      if (!sel) return;
      var id = sel.getAttribute('data-id');
      var m = sel.parentNode.querySelector('.ra-ctl-msg');
      var v = sel.value;
      sel.disabled = true;
      if (m) { m.textContent = '바꾸는 중…'; m.className = 'ra-ctl-msg'; }
      try {
        var c = await sbReady();
        var r = await c.from('recruit_applications').update({ status: v }).eq('id', id);
        if (r.error) throw r.error;
        var hit = byIdOf(id); if (hit) hit.status = v;
        var li = box.querySelector('.ra-it[data-id="' + id + '"]');
        var st = li && li.querySelector('.ra-st');
        if (st) { st.textContent = v; st.className = 'ra-st ra-st--' + (STATUS_CLS[v] || 'new'); }
        if (m) { m.textContent = '바꿨습니다.'; m.className = 'ra-ctl-msg ra-ctl-msg--ok'; }
      } catch (err) {
        if (m) { m.textContent = '바꾸지 못했습니다 — ' + String((err && err.message) || err).slice(0, 60); m.className = 'ra-ctl-msg ra-ctl-msg--warn'; }
      }
      sel.disabled = false;
    });

    box.addEventListener('click', async function (e) {
      var tg = e.target.closest('[data-hidtog]');
      if (tg) {
        var ul = box.querySelector('.ra-list--hid');
        if (ul) { var willShow = ul.hidden; ul.hidden = !willShow; tg.innerHTML = (willShow ? '숨긴 지원 접기' : '숨긴 지원 <b>' + ul.querySelectorAll('.ra-it').length + '</b>건 보기'); }
        return;
      }
      var hb = e.target.closest('[data-hide],[data-unhide]');
      if (hb) {
        var toHide = hb.hasAttribute('data-hide');
        var hid2 = hb.getAttribute(toHide ? 'data-hide' : 'data-unhide');
        var hmsg = hb.parentNode.querySelector('.ra-ctl-msg');
        hb.disabled = true; hb.textContent = toHide ? '숨기는 중…' : '되돌리는 중…';
        try {
          var c3 = await sbReady();
          var r3 = await c3.from('recruit_applications').update({ org_hidden: toHide }).eq('id', hid2);
          if (r3.error) throw r3.error;
          if (typeof box.__reload === 'function') { box.__reload(); return; }
          hb.textContent = toHide ? '목록에서 숨기기' : '다시 보이기'; hb.disabled = false;
        } catch (err) {
          hb.disabled = false; hb.textContent = toHide ? '목록에서 숨기기' : '다시 보이기';
          if (hmsg) { hmsg.textContent = '하지 못했습니다 — ' + String((err && err.message) || err).slice(0, 60); hmsg.className = 'ra-ctl-msg ra-ctl-msg--warn'; }
        }
        return;
      }
      var mb = e.target.closest('[data-memo]');
      if (mb) {
        var id = mb.getAttribute('data-memo');
        var ta = box.querySelector('.ra-memo-in[data-id="' + id + '"]');
        mb.disabled = true; mb.textContent = '저장 중…';
        try {
          var c = await sbReady();
          var r = await c.from('recruit_applications').update({ org_memo: ta ? ta.value : '' }).eq('id', id);
          if (r.error) throw r.error;
          mb.textContent = '저장했습니다';
          setTimeout(function () { mb.textContent = '메모 저장'; mb.disabled = false; }, 1600);
        } catch (err) { mb.textContent = '메모 저장'; mb.disabled = false; alert('메모를 저장하지 못했습니다.\n' + String((err && err.message) || err)); }
        return;
      }
      var cb = e.target.closest('[data-cancel]');
      if (cb) {
        var cid = cb.getAttribute('data-cancel');
        if (!confirm('이 지원을 취소하시겠습니까?\n\n취소하면 단체 화면에도 취소로 표시되고,\n같은 공고에 다시 지원하려면 새로 내셔야 합니다.')) return;
        cb.disabled = true; cb.textContent = '취소하는 중…';
        try {
          var c2 = await sbReady();
          var r2 = await c2.from('recruit_applications').update({ status: '지원취소' }).eq('id', cid);
          if (r2.error) throw r2.error;
          var li2 = box.querySelector('.ra-it[data-id="' + cid + '"]');
          var st2 = li2 && li2.querySelector('.ra-st');
          if (st2) { st2.textContent = '지원취소'; st2.className = 'ra-st ra-st--cancel'; }
          cb.remove();
        } catch (err) { cb.disabled = false; cb.textContent = '지원 취소'; alert('취소하지 못했습니다.\n' + String((err && err.message) || err)); }
      }
    });
  }

  function refreshUnread(box, rows) {
    var n = rows.filter(function (a) { return !a.read_at && a.status !== '지원취소' && !a.org_hidden; }).length;
    var e2 = box.querySelector('.ra-sum-new');
    if (!e2) return;
    if (!n) e2.remove(); else e2.innerHTML = '아직 안 본 것 <b>' + n + '</b>건';
  }

  /* ── 시작 — 마이페이지가 부릅니다. 회원 종류에 따라 보일 묶음만 그립니다 ── */
  async function init() {
    var R = window.OFRecruit;
    if (!R) { console.error('assets/recruit.js 를 먼저 불러야 합니다.'); return; }
    var v = await R.viewer();
    if (!v.user) return;
    var recv = el('#raRecv'), sent = el('#raSent');
    if (recv) { if (v.role.hiring) drawRecv(recv, v.user.id); else recv.closest('[data-ra-sec]') && (recv.closest('[data-ra-sec]').hidden = true); }
    if (sent) { if (v.role.individual) drawSent(sent, v.user.id); else sent.closest('[data-ra-sec]') && (sent.closest('[data-ra-sec]').hidden = true); }
  }

  return { init: init, drawRecv: drawRecv, drawSent: drawSent };
})();
