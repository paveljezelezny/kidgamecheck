import { kv } from '@vercel/kv';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, gameName, age, imageBase64, imageMimeType, lang } = req.body;

  if (!url && !gameName && !imageBase64) {
    return res.status(400).json({ error: 'Chybí vstupní data.' });
  }

  // Increment counter in KV
  try { await kv.incr('total_analyses'); } catch (e) { /* non-critical, continue */ }

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

  content.push({ type: 'text', text: buildPrompt(url, gameName, age, lang) });

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
        max_tokens: 3000,
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
    if (!jsonMatch) throw new Error('AI nevrátila validní odpověď. Zkus to prosím znovu.');

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[1]);
    } catch (e) {
      throw new Error('Chyba při zpracování odpovědi AI. Zkus to prosím znovu.');
    }
    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

function buildPrompt(url, gameName, age, lang) {
  const isEn = lang === 'en';
  let storeInfo = '';
  if (url) {
    if (url.includes('play.google.com')) storeInfo = `Google Play URL: ${url}`;
    else if (url.includes('apps.apple.com') || url.includes('itunes.apple.com')) storeInfo = `Apple App Store URL: ${url}`;
    else storeInfo = `Game URL: ${url}`;
  }

  const langInstruction = isEn
    ? 'IMPORTANT: Write ALL text fields (nazev, popis, duvody, doporuceni, komentar) in ENGLISH.'
    : 'DŮLEŽITÉ: Piš všechna textová pole (nazev, popis, duvody, doporuceni, komentar) ČESKY.';

  return `You are an expert in child safety and game suitability rating. Analyze the game for a child aged ${age}.

${gameName ? `Game name: ${gameName}` : ''}
${storeInfo}
${!gameName && !url ? 'Identify the game from the attached screenshot or image.' : ''}

${langInstruction}

If an image is attached, use it to identify the game.
Based on your knowledge, perform a thorough suitability analysis for a child aged ${age}.

Return ONLY JSON in this exact format (nothing else):

\`\`\`json
{
  "nazev": "Game name",
  "vek": ${age},
  "celkove_hodnoceni": "vhodna|castecne|nevhodna",
  "skore": 75,
  "kriteria": {
    "nasili": {"skore": 1, "komentar": "description"},
    "nevhodny_obsah": {"skore": 1, "komentar": "description"},
    "monetizace": {"skore": 3, "komentar": "description"},
    "cizi_lide": {"skore": 1, "komentar": "description"},
    "adiktivnost": {"skore": 2, "komentar": "description"},
    "reklamy": {"skore": 2, "komentar": "description"}
  },
  "duvody": ["Finding 1", "Finding 2", "Finding 3"],
  "doporuceni": "Conclusion and recommendation for parents in 2-3 sentences.",
  "doporucene": [
    {
      "nazev": "Game name 1",
      "vyvojar": "Developer name",
      "popis": "Short description in 1 sentence why it is suitable",
      "skore_vhodnosti": 92,
      "hodnoceni_hvezdy": 4.6,
      "pocet_stazeni": "50M+",
      "package_id": "com.real.packageid",
      "google_play_url": "https://play.google.com/store/search?q=Game+Name&c=apps",
      "apple_store_url": "https://apps.apple.com/search?term=Game+Name"
    }
  ]
}
\`\`\`

RULES for "doporucene":
- List exactly 3 real existing games of similar genre
- Each must have skore_vhodnosti of at least 70
- All must be suitable for age ${age}
- package_id must be a real Android package ID
- google_play_url: always use search https://play.google.com/store/search?q=<name>&c=apps
- apple_store_url: always use search https://apps.apple.com/search?term=<name>
- hodnoceni_hvezdy = real Google Play rating rounded to 1 decimal
- pocet_stazeni = real Google Play download count (e.g. "100M+", "50M+", "10M+", "1M+")

Criteria scores: 1=no issues, 2=mild, 3=moderate, 4=significant, 5=severe
Suitability score: 0-100 (100=ideal for child, 0=completely unsuitable)
celkove_hodnoceni: "vhodna" for 70+, "castecne" for 40-69, "nevhodna" for less`;
}
