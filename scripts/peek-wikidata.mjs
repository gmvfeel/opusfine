const UA = 'OpusfineBot/1.0 (https://opusfine.vercel.app; cser@wixon.co.kr)';
const q = `SELECT ?item ?itemLabel WHERE {
  ?item wdt:P31/wdt:P279* wd:Q1572070 .
  ?item wdt:P17 wd:Q884 .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ko,en". }
} LIMIT 50`;
const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q);
fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } })
  .then(async r => { console.log('status', r.status); console.log((await r.text()).slice(0,2000)); })
  .catch(e => console.log('ERR', e.message));
