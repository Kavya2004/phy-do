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
    const { messages, files } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Valid messages array is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // Strip system messages out — Gemini has no system role.
    // We'll re-attach them to the appropriate user turns below.
    let geminiMessages = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

    // Attach image files to the last user message.
    // PDFs: the binary was stripped client-side after extraction; the extracted
    // text lives in pinnedUploadContext (a system message) and reaches Gemini
    // via the system-message injection below — no inlineData needed here.
    if (files && files.length > 0 && geminiMessages.length > 0) {
      const lastUserIdx = geminiMessages.length - 1;
      const lastUserMsg = geminiMessages[lastUserIdx];
      if (lastUserMsg.role === 'user') {
        const attachmentNotes = [];

        for (const file of files) {
          if (file.type && file.type.startsWith('image/') && file.data) {
            attachmentNotes.push(`- ${file.name} (${file.type})`);
            const base64Data = file.data.includes(',') ? file.data.split(',')[1] : file.data;
            if (base64Data) {
              lastUserMsg.parts.push({
                inlineData: { mimeType: file.type, data: base64Data }
              });
            }
            if (file.ocrText && file.ocrText.trim()) {
              lastUserMsg.parts.push({
                text: `OCR text from image "${file.name}": ${file.ocrText.trim().slice(0, 5000)}`
              });
            }
          }
          // PDFs: data was deleted client-side; extractedText is in pinnedUploadContext.
          // Nothing to attach here.
        }

        if (attachmentNotes.length > 0) {
          lastUserMsg.parts[0].text +=
            `\n\nAttached files:\n${attachmentNotes.join('\n')}\nPlease use the contents of these attachments to answer the question.`;
        }
      }
    }

    // Collect ALL system messages (base prompt at index 0, plus ephemeral ones:
    // course materials, mode reminder, pinnedUploadContext, didactic trigger).
    // Split into the persistent base prompt (always first) and the ephemeral
    // per-turn instructions, then attach them to the right places:
    //
    //   • Base system prompt → prepended to the FIRST user turn so Gemini has
    //     the persona and rules from the very start of the conversation.
    //   • Ephemeral per-turn messages → prepended to the LAST user turn so they
    //     are immediately before the response Gemini is about to generate.
    //     Attaching them to turn 1 would bury them under the conversation history.
    const systemMessages = messages.filter(msg => msg.role === 'system');
    const baseSystemMsg = systemMessages[0]; // the permanent persona/rules prompt
    const ephemeralMsgs = systemMessages.slice(1); // course material, mode, PDF context, etc.

    const firstUserIdx = geminiMessages.findIndex(m => m.role === 'user');
    const lastUserIdx2 = [...geminiMessages].map(m => m.role).lastIndexOf('user');

    if (baseSystemMsg && firstUserIdx !== -1) {
      geminiMessages[firstUserIdx].parts[0].text =
        `${baseSystemMsg.content}\n\n---\n\nUser: ${geminiMessages[firstUserIdx].parts[0].text}`;
    }

    if (ephemeralMsgs.length > 0 && lastUserIdx2 !== -1) {
      const ephemeralBlock = ephemeralMsgs.map(m => m.content).join('\n\n---\n\n');
      // Only prepend if the last user turn is different from the first
      // (otherwise we'd double-inject onto the same message).
      if (lastUserIdx2 !== firstUserIdx) {
        geminiMessages[lastUserIdx2].parts[0].text =
          `${ephemeralBlock}\n\n---\n\nUser: ${geminiMessages[lastUserIdx2].parts[0].text}`;
      } else {
        // Single-turn conversation: append ephemeral block after the base system prompt
        geminiMessages[lastUserIdx2].parts[0].text +=
          `\n\n---\n\n${ephemeralBlock}`;
      }
    }

    const requestBody = {
      contents: geminiMessages,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 65536,
      }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // gemini-2.5-flash is a thinking model — internal reasoning parts have
    // thought: true. Filter those out and join only the real response text.
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const generatedText = parts
      .filter(p => !p.thought)
      .map(p => p.text ?? '')
      .join('');

    if (!generatedText) {
      throw new Error('No response generated from Gemini');
    }

    res.status(200).json({ response: generatedText });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to get response from Gemini',
      message: error.message
    });
  }
}
