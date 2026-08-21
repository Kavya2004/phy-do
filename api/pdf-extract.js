import pdfParse from 'pdf-parse/lib/pdf-parse.js';

const GEMINI_EXTRACTION_PROMPT =
  'Extract all question text from this PDF exactly as written. ' +
  'List every question with its number (e.g. "1.", "2a.", "Part B:"). ' +
  'Do not summarise or paraphrase — reproduce the wording verbatim. ' +
  'If there are sub-parts, include them. Output plain text only.';

function decodeBase64Data(dataUrl) {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  return Buffer.from(base64, 'base64');
}

function getRawBase64(dataUrl) {
  return dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
}

async function extractWithGeminiVision(base64DataUrl) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: GEMINI_EXTRACTION_PROMPT },
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: getRawBase64(base64DataUrl)
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 8192
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini Vision extraction failed: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter(p => !p.thought)
    .map(p => p.text ?? '')
    .join('')
    .trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: 'Missing data field' });

    // Step 1: try pdf-parse (fast, works for text-layer PDFs)
    let text = null;
    try {
      const buffer = decodeBase64Data(data);
      const pdfData = await pdfParse(buffer);
      const cleaned = (pdfData.text || '').replace(/\s+/g, ' ').trim();
      if (cleaned.length >= 200) {
        text = cleaned.slice(0, 14000) + (cleaned.length > 14000 ? '...' : '');
      }
    } catch (parseErr) {
      console.warn('[pdf-extract] pdf-parse failed, falling back to Gemini Vision:', parseErr.message);
    }

    // Step 2: fallback to Gemini Vision for scanned / image-only PDFs
    if (!text) {
      console.log('[pdf-extract] pdf-parse yielded < 200 chars — using Gemini Vision fallback');
      try {
        const visionText = await extractWithGeminiVision(data);
        if (visionText && visionText.length > 0) {
          text = visionText.slice(0, 14000) + (visionText.length > 14000 ? '...' : '');
        }
      } catch (visionErr) {
        console.error('[pdf-extract] Gemini Vision fallback failed:', visionErr.message);
      }
    }

    if (!text) {
      return res.status(422).json({ error: 'Could not extract text from PDF' });
    }

    res.status(200).json({ text });
  } catch (err) {
    console.error('[pdf-extract] Unexpected error:', err);
    res.status(500).json({ error: 'Failed to extract PDF text', message: err.message });
  }
}
