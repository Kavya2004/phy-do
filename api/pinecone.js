import { Pinecone } from '@pinecone-database/pinecone';

async function getEmbedding(text) {
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'models/gemini-embedding-001', content: { parts: [{ text }] } })
        }
    );
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Embedding API error: ${res.status} - ${err}`);
    }
    const data = await res.json();
    return data.embedding.values;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });

    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME) {
        console.error('[Pinecone] Missing env vars. PINECONE_API_KEY:', !!process.env.PINECONE_API_KEY, 'PINECONE_INDEX_NAME:', !!process.env.PINECONE_INDEX_NAME);
        return res.status(500).json({ error: 'Pinecone not configured' });
    }

    try {
        const embedding = await getEmbedding(query.trim().substring(0, 500));
        console.log('[Pinecone] embedding ok, dim:', embedding.length, 'index:', process.env.PINECONE_INDEX_NAME);

        const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        const index = pc.index(process.env.PINECONE_INDEX_NAME);

        const results = await index.query({
            vector: embedding,
            topK: 5,
            includeMetadata: true
        });
        console.log('[Pinecone] matches:', results.matches?.length ?? 0);

        const chunks = (results.matches || []).map(match => ({
            score: match.score,
            text: match.metadata?.text || match.metadata?.content || '',
            source: match.metadata?.source || 'Course Material',
            page: match.metadata?.page || null,
            url: match.metadata?.url || null,
            embed_url: match.metadata?.embed_url || null,
            drive_file_id: match.metadata?.drive_file_id || null,
            file_name: match.metadata?.file_name || null,
            type: match.metadata?.type || null
        })).filter(c => c.text);

        res.status(200).json({ chunks });
    } catch (error) {
        console.error('[Pinecone] error:', error.message);
        res.status(500).json({ error: 'Pinecone query failed', message: error.message });
    }
}
