// api/pdf-image.js - Serve a single PDF page as a PNG image
import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { readFile, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PDF_PATH = process.env.PDF_PATH || join(__dirname, '..', 'Physics2e.pdf');

export default async function handler(req, res) {
  const page = parseInt(req.query.page || req.body?.page || 1);
  if (!page || page < 1 || page > 1697) return res.status(400).json({ error: 'Invalid page' });

  if (!existsSync(PDF_PATH)) return res.status(404).json({ error: 'PDF not found on server' });

  const outPrefix = join(tmpdir(), `pdf-page-${Date.now()}-${page}`);

  try {
    await new Promise((resolve, reject) => {
      execFile('pdftoppm', [
        '-r', '150',
        '-png',
        '-f', String(page),
        '-l', String(page),
        PDF_PATH,
        outPrefix
      ], (err) => err ? reject(err) : resolve());
    });

    // pdftoppm outputs outPrefix-000001.png style
    const padded = String(page).padStart(6, '0');
    const imgPath = `${outPrefix}-${padded}.png`;

    const imgBuffer = await readFile(imgPath);
    await unlink(imgPath).catch(() => {});

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(imgBuffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to render page: ' + err.message });
  }
}
