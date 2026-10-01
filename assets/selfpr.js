/* ══════════════════════════════════════════════════════════════════
   OPUSFINE SELF PR · assets/selfpr.js · 2026-10-01
   ------------------------------------------------------------------
   오퍼스클램 community/selfpr.html 의 인라인 스크립트를 오퍼스파인
   자료(artists) 칸 이름에 맞춰 옮겼습니다.
     persons → artists, description/description_en → bio/bio_en,
     person_works → artworks(artist_id), person_awards → (없음, 뺌)
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.OF || !OF.SB_URL) return;

  var H = { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };
  var mainEl = document.getElementById('spMain');
  var pastEl = document.getElementById('spPast');
  if (!mainEl) return;

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function nl2br(v) { return esc(v).replace(/\r?\n/g, '<br>'); }
  function has(v) { return v != null && String(v).trim() !== ''; }
  function dayLabel(d) {
    var p = String(d || '').slice(0, 10).split('-');
    return p.length === 3 ? p[0] + '.' + p[1] + '.' + p[2] : d;
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
    if (arr.length < 2) return '<div class="sp-body">' + nl2br(txt) + '</div>';
    return '<div class="sp-tags">' + arr.map(function (x) {
      return '<span class="sp-tag">' + esc(x) + '</span>';
    }).join('') + '</div>';
  }
  function section(title, inner) {
    return '<section class="sp-sec"><h2>' + esc(title) + '</h2>' + inner + '</section>';
  }
  function photoHtml(url, name) {
    if (has(url)) return '<img src="' + esc(url) + '" alt="' + esc(name || '') + '" loading="lazy" referrerpolicy="no-referrer">';
    return '';
  }

  function render(row, p, list) {
    if (!p) {
      mainEl.innerHTML = '<div class="sp-empty">오늘 소개할 작가가 아직 준비되지 않았습니다.<br>곧 소개해 드리겠습니다.</div>';
      return;
    }

    var nm = p.name_ko || p.name_en || '';
    var role = (p.field || p.genre || '').split(',')[0].trim();

    var meta = '';
    if (has(p.life))        meta += '<dt>생몰</dt><dd>' + esc(p.life) + '</dd>';
    else if (p.birth_year)  meta += '<dt>생몰</dt><dd>' + esc(p.birth_year) + (p.death_year ? ' – ' + p.death_year : '') + '</dd>';
    if (has(p.nationality)) meta += '<dt>국적</dt><dd>' + esc(p.nationality.split(',')[0].trim()) + '</dd>';
    if (has(p.school))      meta += '<dt>출신학교</dt><dd>' + esc(p.school) + '</dd>';
    if (has(p.era_name))    meta += '<dt>사조</dt><dd>' + esc(p.era_name) + '</dd>';

    var opts = list.map(function (d) {
      return '<option value="' + esc(d.ymd) + '"' + (d.ymd === row.ymd ? ' selected' : '') + '>'
        + esc(dayLabel(d.ymd)) + '</option>';
    }).join('');

    var head =
      '<div class="sp-head">' +
        (has(p._photo) ? '<div class="sp-photo">' + photoHtml(p._photo, nm) + '</div>' : '') +
        '<div class="sp-info">' +
          (role ? '<div class="sp-role">' + esc(role) + '</div>' : '') +
          '<h2 class="sp-name">' + esc(nm) + '</h2>' +
          (has(p.name_en) && p.name_en !== nm ? '<p class="sp-name-en">' + esc(p.name_en) + '</p>' : '') +
          (meta ? '<dl class="sp-meta">' + meta + '</dl>' : '') +
        '</div>' +
        '<div class="sp-daybox">' +
          '<span class="sp-badge">' + esc(dayLabel(row.ymd)) + '</span>' +
          (list.length > 1 ? '<select class="sp-daysel" id="spDay" aria-label="날짜 선택">' + opts + '</select>' : '') +
        '</div>' +
      '</div>';

    var secs = '';
    var hasKo = has(p.bio), hasEn = has(p.bio_en);
    if (hasKo) {
      secs += section('소개',
        '<div class="sp-body">' + paras(p.bio) + '</div>'
        + (hasEn
          ? '<details class="sp-en" style="margin-top:12px"><summary style="cursor:pointer;font-size:13px;color:var(--ink-3)">영문 소개 원문 보기</summary>'
            + '<div class="sp-body" style="margin-top:10px">' + paras(p.bio_en) + '</div></details>'
          : ''));
    } else if (hasEn) {
      secs += section('소개 (영문)', '<div class="sp-body">' + paras(p.bio_en) + '</div>');
    }

    if (has(p.rep_work)) secs += section('대표작', tags(p.rep_work));

    if (p._works && p._works.length) {
      var ws = p._works.slice(0, 12);
      secs += section('수록 작품 (' + p._works.length + '점)',
        '<ul class="sp-list">' + ws.map(function (w) {
          var ti = w.title || w.title_en || '';
          var yr = w.year_text || w.year_from || '';
          var sub = [w.medium, w.genre].filter(has).join(' · ');
          return '<li><span class="sp-li-y">' + esc(yr) + '</span>'
            + '<span class="sp-li-t"><em style="font-style:normal;font-family:var(--serif)">《' + esc(ti) + '》</em>'
            + (sub ? ' <span class="sp-li-s">' + esc(sub) + '</span>' : '')
            + '</span></li>';
        }).join('') + '</ul>'
        + (p._works.length > ws.length
          ? '<p style="margin-top:10px;font-size:12.5px;color:var(--ink-3)">그리고 ' + (p._works.length - ws.length)
            + '점이 더 있습니다 — 작가DB에서 전부 보실 수 있습니다.</p>'
          : ''));
    }

    if (has(p.field)) secs += section('분야', tags(p.field));

    secs += section('더 보기',
      '<div class="sp-go">' +
        '<div class="sp-go-t"><b>' + esc(nm) + '</b>' +
          '<span>작가DB에서 작품·전시 이력까지 보실 수 있습니다</span></div>' +
        '<a href="/db/artist-view.html?id=' + encodeURIComponent(p.id) + '">작가DB 보기</a>' +
      '</div>');

    mainEl.innerHTML = head + secs;

    var sel = document.getElementById('spDay');
    if (sel) sel.addEventListener('change', function () { load(sel.value); });
  }

  function renderPast(list, curYmd) {
    var rest = list.filter(function (d) { return d.ymd !== curYmd && d._p; });
    if (!rest.length) { pastEl.innerHTML = ''; return; }
    pastEl.innerHTML =
      '<div class="sp-past"><h2>지난 소개</h2><div class="sp-grid">' +
      rest.slice(0, 12).map(function (d) {
        var p = d._p;
        var nm = p.name_ko || p.name_en || '';
        var sub = (p.field || p.nationality || '').split(',')[0].trim();
        return '<a class="sp-card" href="?ymd=' + encodeURIComponent(d.ymd) + '">' +
          '<span class="sp-card-img">' + photoHtml(p._photo, nm) + '</span>' +
          '<span class="sp-card-body">' +
            '<span class="sp-card-day">' + esc(dayLabel(d.ymd)) + '</span>' +
            '<span class="sp-card-name">' + esc(nm) + '</span>' +
            (sub ? '<span class="sp-card-sub">' + esc(sub) + '</span>' : '') +
          '</span></a>';
      }).join('') + '</div></div>';
  }

  function load(ymd) {
    mainEl.innerHTML = '<div class="sp-skel"></div>';
    pastEl.innerHTML = '';

    api('daily_self_pr?select=ymd,artist_id,score&order=ymd.desc&limit=30')
      .then(function (list) {
        if (!list.length) { render(null, null, []); return; }

        var row = ymd ? list.filter(function (d) { return d.ymd === ymd; })[0] : list[0];
        if (!row) row = list[0];

        var ids = list.map(function (d) { return d.artist_id; }).filter(Boolean);
        var uniq = ids.filter(function (v, i) { return ids.indexOf(v) === i; });
        if (!uniq.length) { render(row, null, list); return; }

        return Promise.all([
          api('artists?select=id,name_ko,name_en,field,genre,nationality,life,birth_year,death_year,'
              + 'era_name,school,rep_work,bio,bio_en,image_url'
              + '&id=in.(' + uniq.join(',') + ')'),
          api('artworks?select=artist_id,title,title_en,year_text,year_from,medium,genre'
              + '&artist_id=in.(' + uniq.join(',') + ')&hidden=not.is.true'
              + '&order=year_from.asc,id.asc&limit=400').catch(function () { return []; }),
        ]).then(function (res) {
          var people = res[0] || [], works = res[1] || [];
          var byId = {}, wkId = {};
          works.forEach(function (w) { (wkId[w.artist_id] = wkId[w.artist_id] || []).push(w); });

          people.forEach(function (x) {
            x._photo = x.image_url || '';
            x._works = wkId[x.id] || [];
            byId[x.id] = x;
          });
          list.forEach(function (d) { d._p = byId[d.artist_id] || null; });

          render(row, byId[row.artist_id] || null, list);
          renderPast(list, row.ymd);
        });
      })
      .catch(function () {
        mainEl.innerHTML = '<div class="sp-empty">정보를 불러오지 못했습니다.<br>잠시 후 다시 시도해 주세요.</div>';
      });
  }

  var q = new URLSearchParams(location.search);
  load(q.get('ymd') || '');
})();
