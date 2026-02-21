export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, gameName, age, imageBase64, imageMimeType } = req.body;

  if (!url && !gameName && !imageBase64) {
    return res.status(400).json({ error: 'Chybí vstupní data.' });
  }

  const content = [];

  if (imageBase64) {
    const mimeType = imageMimeType && ['image/jpeg','image/jpg','image/png','image/webp'].includes(imageMimeType)
      ? imageMimeType
      : 'image/jpeg';
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: mimeType, data: imageBase64 }
    });
  }

  content.push({ type: 'text', text: buildPrompt(url, gameName, age) });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 2500,
        messages: [{ role: 'user', content }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Chyba AI API');
    }

    const data = await response.json();
    const raw = data.content.map(b => b.text || '').join('');

    const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) throw new Error('AI nevrátila validní odpověď.');

    const parsed = JSON.parse(jsonMatch[1]);

    // Fetch real app icons from Google Play for recommended games
    if (parsed.doporucene && Array.isArray(parsed.doporucene)) {
      await Promise.all(parsed.doporucene.map(async (game) => {
        if (game.package_id) {
          try {
            const playRes = await fetch(
              `https://play.google.com/store/apps/details?id=${game.package_id}&hl=cs`,
              { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
            );
            const html = await playRes.text();
            // Extract og:image which is the app icon
            const iconMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
            if (iconMatch) game.icon_url = iconMatch[1];
          } catch (e) {
            // silently fail, frontend will show emoji fallback
          }
        }
      }));
    }

    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

function buildPrompt(url, gameName, age) {
  let storeInfo = '';
  if (url) {
    if (url.includes('play.google.com')) storeInfo = `Google Play URL: ${url}`;
    else if (url.includes('apps.apple.com') || url.includes('itunes.apple.com')) storeInfo = `Apple App Store URL: ${url}`;
    else storeInfo = `URL hry: ${url}`;
  }

  return `Jsi odborník na dětskou bezpečnost a hodnocení vhodnosti her. Analyzuj hru pro dítě ve věku ${age} let.

${gameName ? `Název hry: ${gameName}` : ''}
${storeInfo}
${!gameName && !url ? 'Hru urči z přiloženého screenshotu nebo obrázku.' : ''}

Pokud máš přiložený obrázek, použij ho k identifikaci hry.
Na základě svých znalostí proveď důkladnou analýzu vhodnosti pro dítě věku ${age} let.

Vrať POUZE JSON v tomto přesném formátu (nic jiného):

\`\`\`json
{
  "nazev": "Název hry",
  "vek": ${age},
  "celkove_hodnoceni": "vhodna|castecne|nevhodna",
  "skore": 75,
  "kriteria": {
    "nasili": {"skore": 1, "komentar": "popis"},
    "nevhodny_obsah": {"skore": 1, "komentar": "popis"},
    "monetizace": {"skore": 3, "komentar": "popis"},
    "cizi_lide": {"skore": 1, "komentar": "popis"},
    "adiktivnost": {"skore": 2, "komentar": "popis"},
    "reklamy": {"skore": 2, "komentar": "popis"}
  },
  "duvody": ["Důvod 1", "Důvod 2", "Důvod 3"],
  "doporuceni": "Závěr a doporučení pro rodiče v 2-3 větách.",
  "doporucene": [
    {
      "nazev": "Název hry 1",
      "vyvojar": "Název vývojáře",
      "popis": "Krátký popis v 1 větě proč je vhodná",
      "skore_vhodnosti": 92,
      "hodnoceni_hvezdy": 4.6,
      "pocet_stazeni": "50M+",
      "package_id": "com.skutecne.packageid",
      "google_play_url": "https://play.google.com/store/apps/details?id=com.skutecne.packageid",
      "apple_store_url": "https://apps.apple.com/app/id123456789"
    }
  ]
}
\`\`\`

PRAVIDLA pro pole "doporucene" - velmi důležité:
- Uveď přesně 3 skutečné existující hry podobného žánru jako analyzovaná
- Každá musí mít skore_vhodnosti minimálně 80 bodů
- Všechny musí být vhodné pro věk ${age} let
- package_id MUSÍ být skutečné Android package ID (např. "com.kiloo.subwaysurf" pro Subway Surfers)
- google_play_url sestav z package_id: https://play.google.com/store/apps/details?id=<package_id>
- hodnoceni_hvezdy = reálné hodnocení na Google Play zaokrouhlené na 1 desetinné místo
- pocet_stazeni = reálný údaj z Google Play (např. "100M+", "50M+", "10M+", "1M+")
- apple_store_url vyplň pouze pokud hra skutečně existuje na iOS se správným ID, jinak null

Skóre kritérií: 1=bez problémů, 2=mírné, 3=střední, 4=výrazné, 5=závažné
Skóre vhodnosti: 0-100 (100=ideální pro dítě, 0=zcela nevhodná)
celkove_hodnoceni: "vhodna" pro 70+, "castecne" pro 40-69, "nevhodna" pro méně`;
}
