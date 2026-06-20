async function scrapeRemoteOffers() {
  const r = await fetch('https://www.olx.pl/praca/?search%5Bfilter_enum_workplace%5D%5B0%5D=remote_work_possibility', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await r.text();

  // Extract short IDs from CID4 links
  const idMatches = [...html.matchAll(/CID4-ID([a-zA-Z0-9]+)\.html/g)];
  const shortIds = [...new Set(idMatches.map(m => m[1]))];
  console.log('Short IDs:', shortIds.length, shortIds.slice(0,3));

  // Try to fetch offer by short ID from OLX API
  for (const sid of shortIds.slice(0, 3)) {
    try {
      const r2 = await fetch(`https://www.olx.pl/api/v1/offers/${sid}/`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
      });
      console.log(`ID ${sid}: status ${r2.status}`);
      if (r2.ok) {
        const d = await r2.json();
        console.log('  Title:', d.data?.title);
      }
    } catch (e) {
      console.log(`ID ${sid}: error`, e.message);
    }
  }

  // Try the full URL approach
  try {
    const r3 = await fetch('https://www.olx.pl/api/v1/offers/1079271032/', {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    });
    const d = await r3.json();
    console.log('Full ID test:', d.data?.title);
  } catch (e) {
    console.log('Full ID error:', e.message);
  }
}
scrapeRemoteOffers();
