/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 이달의 미술학교 · assets/school-month.js · 2026-10-01
   ------------------------------------------------------------------
   오퍼스클램 community/school-month.html 인라인 스크립트를 오퍼스파인
   자료(schools) 칸 이름에 맞춰 옮겼습니다.
     estab_type → founder_type, departments → depts
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.OF || !OF.SB_URL) return;

  var H = { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };
  var mainEl = document.getElementById('smMain');
  if (!mainEl) return;

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function nl2br(v) { return esc(v).replace(/\r?\n/g, '<br>'); }
  function has(v) { return v != null && String(v).trim() !== ''; }
  function monthLabel(ym) {
    var p = String(ym || '').split('-');
    return p.length === 2 ? p[0] + '년 ' + Number(p[1]) + '월' : ym;
  }
  function api(path) {
    return fetch(OF.SB_URL + '/rest/v1/' + path, { headers: H }).then(function (r) {
      if (!r.ok) throw new Error('load failed');
      return r.json();
    });
  }
  function paras(txt) {
    return String(txt).split(/\n\s*\n/).map(function (p) {
      return '<p>' + nl2br(p.trim()) + '</p>';
    }).join('');
  }
  function splitList(txt) {
    return String(txt).split(/[,·;／\/\n]+/).map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function tags(txt) {
    var arr = splitList(txt);
    if (arr.length < 2) return '<div class="sm-body">' + nl2br(txt) + '</div>';
    return '<div class="sm-tags">' + arr.map(function (x) {
      return '<span class="sm-tag">' + esc(x) + '</span>';
    }).join('') + '</div>';
  }
  function section(title, inner) {
    return '<section class="sm-sec"><h2>' + esc(title) + '</h2>' + inner + '</section>';
  }
  function logoHtml(url, name) {
    if (has(url)) return '<img src="' + esc(url) + '" alt="' + esc(name || '') + '" loading="lazy" referrerpolicy="no-referrer">';
    var ini = (name || '').trim().slice(0, 1);
    return '<span class="sm-initial">' + esc(ini) + '</span>';
  }

  function render(row, s) {
    if (!s) {
      mainEl.innerHTML = '<div class="sm-empty">이번 달 소개할 학교가 아직 준비되지 않았습니다.<br>곧 소개해 드리겠습니다.</div>';
      return;
    }

    var nm = s.name_ko || s.name_en || '';

    var meta = '';
    if (has(s.location))     meta += '<dt>위치</dt><dd>' + esc(s.location) + '</dd>';
    if (has(s.founder_type)) meta += '<dt>설립</dt><dd>' + esc(s.founder_type) + '</dd>';
    if (has(s.founded))      meta += '<dt>설립연도</dt><dd>' + esc(s.founded) + '</dd>';
    if (has(s.link_home))    meta += '<dt>홈페이지</dt><dd><a href="' + esc(s.link_home) + '" target="_blank" rel="noopener noreferrer">' + esc(s.link_home) + '</a></dd>';

    var head =
      '<div class="sm-head">' +
        '<div class="sm-logo">' + logoHtml(s.logo_url || s.image_url, nm) + '</div>' +
        '<div class="sm-info">' +
          '<h2 class="sm-name">' + esc(nm) + '</h2>' +
          (has(s.name_en) && s.name_en !== nm ? '<p class="sm-name-en">' + esc(s.name_en) + '</p>' : '') +
          (meta ? '<dl class="sm-meta">' + meta + '</dl>' : '') +
        '</div>' +
        '<div class="sm-monthbox"><span class="sm-badge">' + esc(monthLabel(row.ym)) + '</span></div>' +
      '</div>';

    var secs = '';
    if (has(s.description)) secs += section('소개', '<div class="sm-body">' + paras(s.description) + '</div>');
    if (has(s.depts))   secs += section('학과', tags(s.depts));
    if (has(s.alumni))  secs += section('동문', tags(s.alumni));
    if (has(s.features)) secs += section('특징', '<div class="sm-body">' + paras(s.features) + '</div>');

    secs += section('더 보기',
      '<div class="sm-go">' +
        '<div class="sm-go-t"><b>' + esc(nm) + '</b>' +
          '<span>미술학교DB에서 더 자세한 정보를 보실 수 있습니다</span></div>' +
        '<a href="/db/school-view.html?id=' + encodeURIComponent(s.id) + '">학교DB 보기</a>' +
      '</div>');

    mainEl.innerHTML = head + secs;
  }

  function load() {
    mainEl.innerHTML = '<div class="sm-skel"></div>';

    api('monthly_school?select=ym,school_id&order=ym.desc&limit=1')
      .then(function (list) {
        if (!list.length) { render(null, null); return; }
        var row = list[0];
        return api('schools?select=id,name_ko,name_en,location,founder_type,founded,depts,alumni,'
            + 'features,logo_url,image_url,description,link_home,link_wiki,link_video'
            + '&id=eq.' + row.school_id)
          .then(function (rows) { render(row, rows[0] || null); });
      })
      .catch(function () {
        mainEl.innerHTML = '<div class="sm-empty">정보를 불러오지 못했습니다.<br>잠시 후 다시 시도해 주세요.</div>';
      });
  }

  load();
})();
