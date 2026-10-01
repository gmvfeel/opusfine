#!/usr/bin/env node
/* 한 번 쓰고 버리는 정찰 스크립트 — GOKAMS 미술단체 목록 페이지의 실제
   구조(초성검색/더보기가 부르는 진짜 주소)를 raw HTML 에서 찾습니다.
   WebFetch 는 markdown 으로 바꾸며 <script> 를 지워 버려 여기서는 못 봅니다. */
const UA = 'Mozilla/5.0 (OpusfineBot research; cser@wixon.co.kr)';

async function get(url, opts) {
  const r = await fetch(url, Object.assign({ headers: { 'User-Agent': UA } }, opts || {}));
  const t = await r.text();
  return { status: r.status, len: t.length, body: t };
}

(async () => {
  console.log('════ group_list.asp (그대로) ════');
  let r = await get('https://www.gokams.or.kr/visual-art/art-terms/glossary/group_list.asp');
  console.log('status', r.status, 'len', r.len);
  // search_initial / call_page 함수 정의, ajax 호출 주소 찾기
  const fnNames = ['search_initial', 'call_page', 'fn_search', 'goPage', 'getList'];
  for (const name of fnNames) {
    const i = r.body.indexOf('function ' + name);
    if (i >= 0) {
      console.log('--- function ' + name + ' ---');
      console.log(r.body.slice(i, i + 800));
    }
  }
  // .asp 로 끝나는 모든 상대/절대 주소 뽑기
  const asps = Array.from(new Set((r.body.match(/[\w./-]+\.asp[^"'\s)]*/g) || [])));
  console.log('--- .asp 주소들 ---');
  console.log(asps.slice(0, 60).join('\n'));

  // ajax 라는 말이 들어간 곳 주변
  const ai = r.body.toLowerCase().indexOf('ajax');
  if (ai >= 0) {
    console.log('--- "ajax" 주변 ---');
    console.log(r.body.slice(Math.max(0, ai - 200), ai + 400));
  }

  // 폼(form) 자체
  const fi = r.body.indexOf('<form');
  if (fi >= 0) {
    console.log('--- <form> ---');
    console.log(r.body.slice(fi, fi + 600));
  }

  // ★ 2번째 정찰 · search_json.asp 를 category=group · 빈 keyword 로 불러 봅니다
  console.log('\n════ search_json.asp (category=group, keyword=빈값) ════');
  const base = 'https://www.gokams.or.kr/visual-art/art-terms/inc/search_json.asp';
  for (const cat of ['group', 'all', '']) {
    const u = base + '?keyword=&category=' + encodeURIComponent(cat);
    try {
      const rr = await get(u);
      console.log('category=' + JSON.stringify(cat), 'status', rr.status, 'len', rr.len);
      console.log(rr.body.slice(0, 1500));
      console.log('...');
    } catch (e) { console.log('category=' + cat + ' 실패: ' + e.message); }
  }

  // ★ 「ㄱ」한 글자로도 불러 봅니다 — 초성검색이 이 끝점을 쓸 수도 있습니다
  console.log('\n════ search_json.asp (keyword=ㄱ, category=group) ════');
  {
    const u = base + '?keyword=' + encodeURIComponent('ㄱ') + '&category=group';
    const rr = await get(u);
    console.log('status', rr.status, 'len', rr.len);
    console.log(rr.body.slice(0, 1500));
  }

  // ★ main/search.asp 자체도 POST 로 불러 봅니다 (category=group, s2=빈값)
  console.log('\n════ main/search.asp (POST category=group, s2=빈값) ════');
  {
    const u = 'https://www.gokams.or.kr/visual-art/art-terms/main/search.asp';
    const rr = await get(u, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'category=group&s2='
    });
    console.log('status', rr.status, 'len', rr.len);
    const idxes = Array.from(new Set((rr.body.match(/idx=\d+/g) || [])));
    console.log('idx= 패턴 수: ' + idxes.length);
    console.log(idxes.slice(0, 40).join(', '));
  }

  // ★ 「미」 한 글자로 POST — 실제 결과가 나오는지 봅니다
  console.log('\n════ main/search.asp (POST category=group, s2=미) ════');
  {
    const u = 'https://www.gokams.or.kr/visual-art/art-terms/main/search.asp';
    const rr = await get(u, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: 'category=group&s2=' + encodeURIComponent('미')
    });
    console.log('status', rr.status, 'len', rr.len);
    const idxes = Array.from(new Set((rr.body.match(/idx=\d+/g) || [])));
    console.log('idx= 패턴 수: ' + idxes.length);
    console.log(idxes.slice(0, 40).join(', '));
    const cntMatch = rr.body.match(/총\s*[\d,]+\s*건/);
    if (cntMatch) console.log('건수 표시: ' + cntMatch[0]);
    if (!idxes.length) console.log(rr.body.slice(0, 1200));
  }

  // ★ category 선택지(select option) 찾아보기
  console.log('\n════ group_list.asp 의 <select>/<option> ════');
  {
    const si = r.body.indexOf('<select');
    if (si >= 0) console.log(r.body.slice(si, si + 1000));
    const opts = Array.from(new Set((r.body.match(/<option[^>]*>[^<]*<\/option>/g) || [])));
    console.log('--- option 전체 ---');
    console.log(opts.slice(0, 40).join('\n'));
  }

  // ★ search_json.asp 를 legacy escape() 식 %uXXXX 인코딩으로 다시 시도
  console.log('\n════ search_json.asp (escape() 식 %u3131, category=group) ════');
  {
    const u = 'https://www.gokams.or.kr/visual-art/art-terms/inc/search_json.asp'
      + '?keyword=%u3131&category=group';
    const rr = await get(u);
    console.log('status', rr.status, 'len', rr.len);
    console.log(rr.body.slice(0, 1000));
  }

  // ★ POST 검색으로 idx 최댓값 가늠하기 — 「회」(협회·학회·연구회 등에
  //   흔함)·「미술」·「연구」로 넓게 찾아 idx 범위를 봅니다.
  console.log('\n════ main/search.asp (POST 넓은 낱말로 idx 범위 가늠) ════');
  for (const word of ['회', '미술', '연구', '협회']) {
    const u = 'https://www.gokams.or.kr/visual-art/art-terms/main/search.asp';
    const rr = await get(u, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: 'category=group&s2=' + encodeURIComponent(word)
    });
    const idxes = Array.from(new Set((rr.body.match(/idx=(\d+)/g) || [])
      .map((s) => Number(s.split('=')[1]))));
    const cntMatch = rr.body.match(/총\s*[\d,]+\s*건/);
    console.log('"' + word + '" · status ' + rr.status + ' · idx 수 ' + idxes.length
      + ' · 최댓값 ' + (idxes.length ? Math.max(...idxes) : '-')
      + ' · ' + (cntMatch ? cntMatch[0] : '건수 표시 없음'));
  }
})();
