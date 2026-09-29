/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 가벼운 CSV 읽개 · scripts/lib/csv.mjs
   ------------------------------------------------------------------
   ★ 이 프로젝트 수집 스크립트는 외부 패키지를 안 씁니다(node 만으로
     돕니다 · GitHub Actions 에 npm install 단계가 없습니다). 그래서
     csv-parse 같은 라이브러리 대신 <b>직접</b> 짭니다.

   ★★ 콤마로만 자르면 안 됩니다. 내셔널갤러리 데이터는 provenance 같은
     칸에 <b>줄바꿈과 콤마가 든 채로 따옴표(")</b>에 싸여 옵니다.
     문자 하나씩 보는 상태기계라야 이런 칸도 옳게 잘립니다.

   ★★★ 2026-09-29 · <b>처음엔 모든 줄을 배열 하나에 다 쌓았다가</b>
     GitHub Actions 러너에서 <b>메모리가 넘쳐 죽었습니다</b>
     (objects.csv 의 provenancetext 칸이 몇 단락씩 되는데, 그런 칸까지
     146,099줄 × 31칸을 통째로 붙들고 있었던 탓 — Node 힙이 4GB 를
     넘겼습니다). ▶ streamCSV 로 <b>줄마다 즉시 콜백</b>을 부르고,
     그 줄의 배열은 콜백이 끝나면 버립니다. 쓰는 쪽(collect-works-nga)
     에서 <b>필요한 칸만 골라 가벼운 값으로</b> 옮겨 담고, 나머지
     (원문·주석 등 큰 칸)는 쳐다보지도 않습니다. */

/* 문자 하나씩 보아 줄을 완성하는 대로 onRow(fields) 를 부릅니다.
   fields 는 그 줄의 칸 배열 — onRow 가 끝나면 버려집니다(안 쌓음). */
export function parseCSVStream(text, onRow) {
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(field); onRow(row); row = []; field = ''; i++; continue; }
      field += c; i++; continue;
    }
  }
  if (field.length || row.length) { row.push(field); onRow(row); }
}

/* 파일을 읽어 머리글(header)을 얻은 뒤, 줄마다 onRow(row, idx) 를
   부릅니다. idx 는 「칸이름→자리」— row[idx.title] 식으로 씁니다.
   ★ 줄을 쌓아 두지 않으므로 큰 CSV 도 가볍게 지나갈 수 있습니다. */
export function streamCSV(fs, file, onRow) {
  const text = fs.readFileSync(file, 'utf8');
  let idx = null;
  let n = 0;
  parseCSVStream(text, (row) => {
    if (!idx) { idx = Object.fromEntries(row.map((h, i) => [h, i])); return; }
    n++;
    onRow(row, idx);
  });
  return n;
}
