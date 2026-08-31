/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 미술대학 상세 · assets/school-view.js
   ------------------------------------------------------------------
   schools 한 줄을 읽어 그립니다. 그리고 <b>동문 이름을 작가DB와
   맞대어</b> 이어 줍니다 — 이것이 오퍼스클램의 「그물」에 해당합니다.

   ★★ 값을 치르고 배운 것

     ① <b>hidden 은 not.is.true</b> 로 거릅니다.

     ② <b>견본을 두지 않습니다.</b> 자료가 없으면 「아직 없습니다」로
        적습니다. 실패하면 실패했다고 적습니다.

     ③ 동문 이름을 <b>이름으로 맞댑니다.</b> 이것은 위험한 방식입니다 —
        「율리우스 아살」이 「태국 태음력」으로 걸린 일이 있었습니다.
        그래서 <b>온이름이 똑같을 때만</b> 잇습니다. 비슷한 것,
        일부만 겹치는 것은 잇지 않습니다.
        못 이은 이름은 <b>링크 없이 그대로 보여</b> 줍니다 —
        그것도 자료이고, 나중에 작가DB가 자라면 저절로 이어집니다.

     ④ 이름으로 맞대는 것이 못 미더우면 나중에 <b>학교 ↔ 작가</b> 연결
        표를 따로 두는 것이 맞습니다. 오퍼스클램은 인물↔학교를
        19,044줄짜리 연결표로 갖고 있습니다.
        지금은 자료가 250곳뿐이라 이름 맞대기로 시작합니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var hasKo = function (s) { return /[가-힣]/.test(String(s || '')); };

  function head() {
    return { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };
  }

  /* 이름 다듬기 — 맞댈 때만 씁니다. 보여줄 때는 원래 글자를 씁니다. */
  function norm(s) {
    return String(s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   /* 발음기호 · Jørgen → Jorgen */
      .toLowerCase()
      .replace(/[^0-9a-z가-힣]/g, '');
  }

  async function get(url) {
    var res = await fetch(url, { headers: head() });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 160));
    return await res.json();
  }

  /* ── 동문 이름을 작가DB와 맞대기 ──────────────────────────── */
  async function linkAlumni(names) {
    var found = {};
    if (!names.length) return found;

    /* 이름 그대로 찾습니다. 한 번에 물으면 주소가 너무 길어지므로
       20개씩 나눕니다. */
    for (var i = 0; i < names.length; i += 20) {
      var part = names.slice(i, i + 20);
      var ors = part.map(function (n) {
        var v = n.replace(/[*(),.]/g, ' ').trim();
        if (!v) return null;
        return 'name_ko.eq.' + encodeURIComponent(v) + ',name_en.eq.' + encodeURIComponent(v);
      }).filter(Boolean).join(',');
      if (!ors) continue;

      try {
        var rows = await get(OF.SB_URL + '/rest/v1/artists?select=id,name_ko,name_en'
          + '&hidden=not.is.true&or=(' + ors + ')&limit=200');
        rows.forEach(function (a) {
          /* ★ 온이름이 똑같을 때만 잇습니다 */
          [a.name_ko, a.name_en].forEach(function (nm) {
            if (!nm) return;
            var k = norm(nm);
            if (k && !found[k]) found[k] = a.id;
          });
        });
      } catch (e) {
        /* 못 이었어도 화면은 그립니다. 이름만 링크 없이 보입니다. */
      }
    }
    return found;
  }

  /* ── 그리기 ───────────────────────────────────────────────── */
  function render(s, links) {
    var name  = s.name_ko || s.name_en || '(이름 없음)';
    var roman = !hasKo(name);
    var logo  = s.logo_url || s.image_url;
    var desc  = s.description || s.bio;

    var h = '';

    /* 머리 */
    h += '<div class="sv-hd">';
    h += logo
      ? '<div class="sv-logo"><img src="' + esc(logo) + '" alt=""'
        + ' onerror="this.parentNode.classList.add(&quot;none&quot;);this.remove()"></div>'
      : '<div class="sv-logo none"></div>';
    h += '<div class="sv-hb">';
    if (s.category) h += '<div class="sv-cat">' + esc(s.category) + '</div>';
    h += '<h1 class="sv-nm' + (roman ? ' roman' : '') + '">' + esc(name) + '</h1>';
    if (!roman && s.name_en && s.name_en !== name) {
      h += '<div class="sv-en">' + esc(s.name_en) + '</div>';
    }

    var meta = [];
    if (s.location) meta.push(esc(s.location));
    if (s.founded)  meta.push(esc(s.founded) + ' 설립');
    if (meta.length) {
      h += '<div class="sv-meta">' + meta.map(function (m) {
        return '<span>' + m + '</span>';
      }).join('') + '</div>';
    }

    var ln = [];
    if (s.link_home) ln.push('<a href="' + esc(s.link_home) + '" target="_blank" rel="noopener">공식 홈페이지 →</a>');
    if (s.link_wiki) ln.push('<a href="' + esc(s.link_wiki) + '" target="_blank" rel="noopener">위키백과 →</a>');
    if (s.wikidata_id) ln.push('<a href="https://www.wikidata.org/wiki/' + esc(s.wikidata_id)
      + '" target="_blank" rel="noopener">위키데이터 →</a>');
    if (ln.length) h += '<div class="sv-links">' + ln.join('') + '</div>';

    h += '</div></div>';

    /* 동문 — 이 화면의 주인공이라 위에 둡니다 */
    h += '<div class="sv-sec"><div class="sv-sk">Alumni · 거쳐 간 작가</div>';
    if (s.alumni) {
      var names = String(s.alumni).split(/\s*,\s*/).filter(Boolean);
      var linked = 0;
      h += '<div class="sv-al">';
      h += names.map(function (n) {
        var id = links[norm(n)];
        if (id) {
          linked++;
          return '<a href="/db/artist-view.html?id=' + encodeURIComponent(id) + '">'
               + esc(n) + '</a>';
        }
        return '<span>' + esc(n) + '</span>';
      }).join('');
      h += '</div>';
      if (linked < names.length) {
        h += '<div class="sv-none" style="margin-top:14px">'
          + '점선으로 둘러진 이름은 아직 작가DB에 없습니다 · '
          + names.length + '명 가운데 ' + linked + '명이 이어졌습니다</div>';
      }
    } else {
      h += '<div class="sv-none">동문 자료가 아직 없습니다.</div>';
    }
    h += '</div>';

    /* 소개문 */
    h += '<div class="sv-sec"><div class="sv-sk">About</div>';
    if (desc) {
      h += '<div class="sv-txt">' + String(desc).split(/\n+/).map(function (p) {
        return '<p>' + esc(p) + '</p>';
      }).join('') + '</div>';
    } else {
      h += '<div class="sv-none">소개문이 아직 없습니다.</div>';
    }
    h += '</div>';

    /* 자료 출처 */
    h += '<div class="sv-sec" style="border:0">'
      + '<p class="demo-note">이 자료는 <b>위키데이터</b>에서 받았습니다 · '
      + '로고는 위키미디어 커먼즈의 원본을 링크합니다';
    if (roman) h += ' · 한글 이름이 아직 없어 영문으로 보입니다';
    h += '</p></div>';

    return h;
  }

  async function boot() {
    var box = document.getElementById('svMain');
    var bc  = document.getElementById('svBc');
    if (!box) return;

    var id = new URLSearchParams(location.search).get('id');
    if (!id) {
      box.innerHTML = '<div class="sv-sec" style="border:0">'
        + '<div class="demo-note">주소에 학교 번호가 없습니다. '
        + '<a href="/db/school.html">목록</a>에서 골라 주십시오.</div></div>';
      if (bc) bc.textContent = '—';
      return;
    }

    try {
      var rows = await get(OF.SB_URL + '/rest/v1/schools?select=*'
        + '&id=eq.' + encodeURIComponent(id) + '&hidden=not.is.true&limit=1');
      if (!rows.length) {
        box.innerHTML = '<div class="sv-sec" style="border:0">'
          + '<div class="demo-note">그 학교를 찾지 못했습니다. '
          + '<a href="/db/school.html">목록으로</a></div></div>';
        if (bc) bc.textContent = '—';
        return;
      }
      var s = rows[0];
      var name = s.name_ko || s.name_en || '(이름 없음)';
      document.title = name + ' — OPUSFINE';
      if (bc) bc.textContent = name;

      var names = s.alumni ? String(s.alumni).split(/\s*,\s*/).filter(Boolean) : [];
      var links = await linkAlumni(names);

      box.innerHTML = render(s, links);

    } catch (e) {
      /* ★ 실패하면 견본을 두지 않고 실패했다고 적습니다 */
      box.innerHTML = '<div class="sv-sec" style="border:0"><div class="demo-note">'
        + '자료를 불러오지 못했습니다 — ' + esc(String(e.message).slice(0, 200))
        + '</div></div>';
      if (bc) bc.textContent = '—';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();
})();
