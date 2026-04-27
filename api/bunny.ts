import type { VercelRequest, VercelResponse } from '@vercel/node';

// Bunny.net Storage proxy
// Keeps the AccessKey on the server. Client sends base64 audio, we upload.
//
// Env vars required:
//   BUNNY_STORAGE_ZONE      e.g. "beci-english"
//   BUNNY_STORAGE_PASSWORD  the Storage Zone Access Key (Password)
//   BUNNY_STORAGE_REGION    e.g. "sg" (Singapore), "" for default
//   BUNNY_CDN_HOST          e.g. "beci-english.b-cdn.net"

const STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const STORAGE_PASSWORD = process.env.BUNNY_STORAGE_PASSWORD;
const STORAGE_REGION = process.env.BUNNY_STORAGE_REGION || '';
const CDN_HOST = process.env.BUNNY_CDN_HOST;

function storageBaseUrl() {
  const prefix = STORAGE_REGION ? `${STORAGE_REGION}.` : '';
  return `https://${prefix}storage.bunnycdn.com/${STORAGE_ZONE}`;
}

function publicUrl(path: string) {
  return `https://${CDN_HOST}/${path.replace(/^\/+/, '')}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!STORAGE_ZONE || !STORAGE_PASSWORD || !CDN_HOST) {
    const missing = [
      !STORAGE_ZONE && 'BUNNY_STORAGE_ZONE',
      !STORAGE_PASSWORD && 'BUNNY_STORAGE_PASSWORD',
      !CDN_HOST && 'BUNNY_CDN_HOST',
    ].filter(Boolean).join(', ');
    return res.status(500).json({
      error: `Bunny storage env vars not configured: missing ${missing}`,
    });
  }

  const { action, path, base64, contentType } = req.body || {};

  if (!action || !path) {
    return res.status(400).json({ error: 'Missing action or path' });
  }

  // Path safety: no leading slashes, no .., must be relative
  const cleanPath = String(path).replace(/^\/+/, '');
  if (cleanPath.includes('..') || cleanPath.includes('//')) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  try {
    if (action === 'upload') {
      if (!base64) return res.status(400).json({ error: 'Missing base64 body' });

      const buffer = Buffer.from(base64, 'base64');
      const url = `${storageBaseUrl()}/${cleanPath}`;

      const upRes = await fetch(url, {
        method: 'PUT',
        headers: {
          AccessKey: STORAGE_PASSWORD,
          'Content-Type': contentType || 'application/octet-stream',
        },
        body: buffer,
      });

      if (!upRes.ok) {
        const text = await upRes.text();
        console.error('Bunny upload failed', upRes.status, text);
        return res.status(upRes.status).json({ error: `Bunny upload failed: ${text}` });
      }

      return res.json({
        path: cleanPath,
        url: publicUrl(cleanPath),
      });
    }

    if (action === 'delete') {
      const url = `${storageBaseUrl()}/${cleanPath}`;
      const delRes = await fetch(url, {
        method: 'DELETE',
        headers: { AccessKey: STORAGE_PASSWORD },
      });

      // 404 means already gone — treat as success
      if (!delRes.ok && delRes.status !== 404) {
        const text = await delRes.text();
        console.error('Bunny delete failed', delRes.status, text);
        return res.status(delRes.status).json({ error: `Bunny delete failed: ${text}` });
      }

      return res.json({ ok: true });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('Bunny route error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message });
  }
}

// Increase body size limit for audio uploads (default is 1MB-ish)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
