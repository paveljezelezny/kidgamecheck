export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const url = `${process.env.KV_REST_API_URL}/get/total_analyses`;
    const kvRes = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
    });
    const data = await kvRes.json();
    return res.status(200).json({ count: parseInt(data.result) || 0 });
  } catch (e) {
    return res.status(200).json({ count: 0 });
  }
}
