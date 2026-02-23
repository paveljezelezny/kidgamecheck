import net from 'net';
import tls from 'tls';

function redisCommand(args) {
  return new Promise((resolve) => {
    const url = process.env.REDIS_URL;
    if (!url) return resolve(null);

    const match = url.match(/redis:\/\/([^:]+):([^@]+)@([^:]+):(\d+)/);
    if (!match) return resolve(null);

    const [, , password, host, portStr] = match;
    const port = parseInt(portStr);

    const cmd = `*${args.length}\r\n` + args.map(a => `$${String(a).length}\r\n${a}\r\n`).join('');
    const auth = `*2\r\n$4\r\nAUTH\r\n$${password.length}\r\n${password}\r\n`;

    const isRedisLabs = host.includes('redislabs.com') || host.includes('ec2.cloud');
    const socket = isRedisLabs
      ? tls.connect({ host, port, rejectUnauthorized: false })
      : net.connect({ host, port });

    let buf = '';
    const timeout = setTimeout(() => { socket.destroy(); resolve(null); }, 4000);

    socket.on('connect', () => socket.write(auth + cmd));
    socket.on('data', d => {
      buf += d.toString();
      const lines = buf.split('\r\n');
      const responses = lines.filter(l => l.startsWith('+') || l.startsWith(':') || l.startsWith('$') || l.startsWith('-'));
      if (responses.length >= 2) {
        clearTimeout(timeout);
        socket.destroy();
        const last = responses[responses.length - 1];
        resolve(last.startsWith(':') ? parseInt(last.slice(1)) : last.slice(1));
      }
    });
    socket.on('error', () => { clearTimeout(timeout); resolve(null); });
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const val = await redisCommand(['GET', 'total_analyses']);
    return res.status(200).json({ count: parseInt(val) || 0 });
  } catch {
    return res.status(200).json({ count: 0 });
  }
}
