export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, gameName, age, imageBase64 } = req.body;

  if (!url && !gameName && !imageBase64) {
    return res.status(400).json({ error: 'Chybí vstupní data.' });
  }

  const content = [];

  if (imageBase64) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 }
    });
  }

  content.push({
    type: 'text',
    text: buildPrompt(url, gameName, age)
  });

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
        max_tokens: 1500,
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
    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

function buildPrompt(url, gameName, age) {
  return `Jsi odborník na dětskou bezpečnost a hodnocení vhodnosti her. Analyzuj hru pro dítě ve věku ${age} let.

${gameName ? `Název hry: ${gameName}` : ''}
${url ? `Google Play URL: ${url}` : ''}
${!gameName && !url ? 'Hru urči z přiloženého screenshotu.' : ''}

Na základě svých znalostí o hře proveď analýzu.

Vrať POUZE JSON v tomto přesném formátu:

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
  "doporuceni": "Závěr a doporučení pro rodiče v 2-3 větách."
}
\`\`\`

Skóre kritérií: 1=bez problémů, 2=mírné, 3=střední, 4=výrazné, 5=závažné
Skóre vhodnosti: 0-100 (100=ideální, 0=zcela nevhodná)
celkove_hodnoceni: "vhodna" pro 70+, "castecne" pro 40-69, "nevhodna" pro méně`;
}
