import { Pinecone } from '@pinecone-database/pinecone';

async function getEmbedding(text) {
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'models/text-embedding-004', content: { parts: [{ text }] } })
        }
    );
    if (!res.ok) throw new Error(`Embedding API error: ${res.status}`);
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
        return res.status(500).json({ error: 'Pinecone not configured' });
    }

    try {
        const embedding = await getEmbedding(query.trim().substring(0, 500));

        const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        const index = pc.index(process.env.PINECONE_INDEX_NAME);

        const results = await index.query({
            vector: embedding,
            topK: 5,
            includeMetadata: true
        });

        const chunks = (results.matches || []).map(match => ({
            score: match.score,
            text: match.metadata?.text || match.metadata?.content || '',
            source: match.metadata?.source || match.metadata?.filename || 'Physics Material',
            page: match.metadata?.page || match.metadata?.pageNumber || null
        })).filter(c => c.text);

        res.status(200).json({ chunks });
    } catch (error) {
        res.status(500).json({ error: 'Pinecone query failed', message: error.message });
    }
}
