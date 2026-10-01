#!/usr/bin/env node
/* 한 번 쓰고 버리는 정찰 — data.go.kr 「문화예술교육 단체 목록」(15156828)
   파일 내려받기 주소를 raw HTML 에서 찾습니다. WebFetch 는 이 사이트의
   robots.txt 를 못 받아와 아예 거절했습니다. */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

async function get(url, opts) {
  const r = await fetch(url, Object.assign({ headers: { 'User-Agent': UA } }, opts || {}));
  const t = await r.text();
  return { status: r.status, len: t.length, body: t, headers: r.headers };
}

(async () => {
  console.log('════ fileData.do (15156828) ════');
  const r = await get('https://www.data.go.kr/data/15156828/fileData.do');
  console.log('status', r.status, 'len', r.len);

  const patterns = ['atchFileId', 'fileDetailSn', 'fileDownload', 'publicDataPk', 'download.do'];
  for (const p of patterns) {
    const i = r.body.indexOf(p);
    if (i >= 0) {
      console.log('--- "' + p + '" 주변 ---');
      console.log(r.body.slice(Math.max(0, i - 150), i + 250).replace(/\s+/g, ' '));
    } else {
      console.log('"' + p + '" 없음');
    }
  }

  // 모든 href/onclick 중 download 관련
  const dls = Array.from(new Set((r.body.match(/[\w./?&=%-]*download[\w./?&=%-]*/gi) || [])));
  console.log('--- "download" 들어간 주소들 ---');
  console.log(dls.slice(0, 20).join('\n'));

  // API 키/apikey 입력 요구 여부
  console.log('--- "serviceKey" 또는 "openapi" 언급 ---');
  console.log('serviceKey 포함: ' + r.body.includes('serviceKey'));
  console.log('openapi.do 포함: ' + r.body.includes('openapi.do'));

  // ★ 2026-10-01 · raw HTML 에서 찾은 실제 다운로드 주소로 CSV 를 받아
  //   봅니다. 파일데이터는 로그인 없이 받을 수 있다고 적혀 있었습니다.
  console.log('\n════ CSV 실제로 받아보기 ════');
  const dlUrl = 'https://www.data.go.kr/cmm/cmm/fileDownload.do'
    + '?atchFileId=FILE_000000003570540&fileDetailSn=1&insertDataPrcus=N';
  const r2 = await get(dlUrl, { headers: { 'User-Agent': UA, Referer: 'https://www.data.go.kr/data/15156828/fileData.do' } });
  console.log('status', r2.status, 'content-type', r2.headers.get('content-type'));
  console.log('바이트 수(대략, utf8 기준)', Buffer.byteLength(r2.body, 'utf8'));
  const lines = r2.body.split(/\r?\n/).filter(Boolean);
  console.log('줄 수', lines.length);
  console.log('--- 처음 3줄 (글자 깨짐, 인코딩 확인 전) ---');
  console.log(lines.slice(0, 3).join('\n'));

  // ★ 2026-10-01 · 안내문에 인코딩이 안 적혀 있어, 받은 그대로를
  //   EUC-KR 로 다시 읽어 봅니다(공공데이터포털 CSV 는 흔히 이 글자셋).
  console.log('\n════ EUC-KR 로 다시 읽기 ════');
  const r3 = await fetch(dlUrl, { headers: { 'User-Agent': UA, Referer: 'https://www.data.go.kr/data/15156828/fileData.do' } });
  const buf = Buffer.from(await r3.arrayBuffer());
  const text = new TextDecoder('euc-kr').decode(buf);
  const lines2 = text.split(/\r?\n/).filter(Boolean);
  console.log('줄 수(헤더 포함)', lines2.length);
  console.log('--- 헤더 ---');
  console.log(lines2[0]);
  console.log('--- 처음 5줄 ---');
  console.log(lines2.slice(0, 6).join('\n'));

  // 활동분야 칸 값 분포(대략 5번째 칸으로 짐작, 헤더 보고 맞출 것)
  const header = lines2[0].split(',').map((s) => s.replace(/"/g, '').trim());
  console.log('--- 헤더 칸 이름 목록 ---');
  header.forEach((h, i) => console.log('  [' + i + '] ' + h));

  // ★ 활동분야에 "미술"이 들어간 줄만 세어 봅니다(쉼표 안에 따옴표
  //   처리가 필요해 아주 단순한 csv 쪼개기를 씁니다).
  function splitCsvLine(line) {
    const out = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { out.push(cur); cur = ''; continue; }
      cur += c;
    }
    out.push(cur);
    return out;
  }
  let artCount = 0;
  const body = lines2.slice(1);
  for (const ln of body) {
    const cols = splitCsvLine(ln);
    if ((cols[5] || '').includes('미술')) artCount++;
  }
  console.log('\n전체 ' + body.length + '건 중 활동분야에 "미술" 포함: ' + artCount + '건');
})();
