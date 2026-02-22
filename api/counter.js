import Redis from 'ioredis';

let redis = null;
function getRedis() {
  if (!redis && process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, {
      tls: process.env.REDIS_URL.includes('redislabs.com') ? { rejectUnauthorized: false } : undefined,
      connectTimeout: 5000,
      lazyConnect: true,
    });
  }
  return redis;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const client = getRedis();
    if (!client) return res.status(200).json({ count: 0 });
    await client.connect().catch(() => {});
    const count = await client.get('total_analyses');
    return res.status(200).json({ count: parseInt(count) || 0 });
  } catch (e) {
    return res.status(200).json({ count: 0 });
  }
}
