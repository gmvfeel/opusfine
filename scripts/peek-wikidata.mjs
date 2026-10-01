const UA = 'OpusfineBot/1.0 (https://opusfine.vercel.app; cser@wixon.co.kr)';

async function run(label, q) {
  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } });
    const t = await r.text();
    console.log('── ' + label + ' · status ' + r.status + ' ──');
    console.log(t.slice(0, 3000));
  } catch (e) { console.log('── ' + label + ' 실패: ' + e.message); }
  console.log('');
}

(async () => {
  // 1) 한국(Q884) 조직 중 이름에 "미술"이 들어간 것 — 분류를 못박지 않고 넓게
  await run('이름에 "미술" 포함 · 한국 조직', `
    SELECT ?item ?itemLabel ?instanceLabel WHERE {
      ?item wdt:P17 wd:Q884 .
      ?item rdfs:label ?lbl . FILTER(CONTAINS(?lbl, "미술") && LANG(?lbl) = "ko")
      OPTIONAL { ?item wdt:P31 ?instance }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "ko,en". }
    } LIMIT 60`);

  // 2) 한국미술협회 자신의 항목과 P31(instance of) 값
  await run('"한국미술협회" 자체 항목 찾기', `
    SELECT ?item ?itemLabel ?instance ?instanceLabel WHERE {
      ?item rdfs:label "한국미술협회"@ko .
      OPTIONAL { ?item wdt:P31 ?instance }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "ko,en". }
    } LIMIT 10`);
})();
