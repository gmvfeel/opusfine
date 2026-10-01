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
})();
