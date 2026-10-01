#!/usr/bin/env node
/* 정찰 2 — art_view.asp(미술 용어)가 group_view.asp 처럼 맨몸 요청에
   500을 돌려주는지, 아니면 다르게 동작하는지 확인합니다. */
const UA = 'OpusfineBot/1.0 (https://opusfine.vercel.app; cser@wixon.co.kr)';

async function get(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    const t = await r.text();
    return { status: r.status, len: t.length, body: t };
  } catch (e) {
    return { status: 'ERR', len: 0, body: e.message };
  }
}

(async () => {
  for (const idx of [30, 103, 104, 1, 500, 1000]) {
    const r = await get('https://www.gokams.or.kr/visual-art/art-terms/glossary/art_view.asp?idx=' + idx + '&page=1');
    console.log('art_view idx=' + idx + ' · status ' + r.status + ' · len ' + r.len);
    if (r.status === 200) {
      const nameM = r.body.match(/국문[\s\S]{0,80}?>([^<]{1,60})</);
      console.log('   맛보기: ' + (nameM ? nameM[1].trim() : r.body.slice(0, 150).replace(/\s+/g, ' ')));
    }
    await new Promise((res) => setTimeout(res, 300));
  }

  console.log('\n── art_list.asp 전체 건수(초기 상태) ──');
  const r2 = await get('https://www.gokams.or.kr/visual-art/art-terms/glossary/art_list.asp');
  console.log('status', r2.status, 'len', r2.len);
  const cntM = r2.body.match(/총\s*[\d,]+\s*건/);
  console.log(cntM ? cntM[0] : '건수 표시 못 찾음');

  console.log('\n── art_list.asp 와 group_list.asp 의 POST 로 넓게 검색해 idx 최댓값 ──');
  for (const [cat, word] of [['word', '미술'], ['word', '회'], ['word', '시대']]) {
    const rr = await (async () => {
      const r = await fetch('https://www.gokams.or.kr/visual-art/art-terms/main/search.asp', {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: 'category=' + encodeURIComponent(cat) + '&s2=' + encodeURIComponent(word)
      });
      return { status: r.status, body: await r.text() };
    })();
    const idxes = Array.from(new Set((rr.body.match(/art_view\.asp\?idx=\d+/g) || [])
      .map((s) => Number(s.split('=')[1]))));
    console.log('word="' + word + '" · status ' + rr.status + ' · art_view idx 수 ' + idxes.length
      + ' · 최댓값 ' + (idxes.length ? Math.max(...idxes) : '-'));
  }
})();
