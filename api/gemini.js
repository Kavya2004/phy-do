import pdfParse from 'pdf-parse';

function decodeBase64Data(dataUrl) {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  return Buffer.from(base64, 'base64');
}

async function extractPdfText(dataUrl) {
  try {
    const buffer = decodeBase64Data(dataUrl);
    const pdfData = await pdfParse(buffer);
    const cleaned = (pdfData.text || '').replace(/\s+/g, ' ').trim();
    return cleaned.slice(0, 14000) + (cleaned.length > 14000 ? '...' : '');
  } catch (err) {
    console.error('PDF extraction failed:', err);
    return null;
  }
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
      const { messages, files } = req.body;
      
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
          return res.status(400).json({ error: 'Valid messages array is required' });
      }

      if (!process.env.GEMINI_API_KEY) {
          return res.status(500).json({ error: 'API key not configured' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
      let geminiMessages = messages
          .filter(msg => msg.role !== 'system')
          .map(msg => ({
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: msg.content }]
          }));

      // Add files to the last user message
      if (files && files.length > 0 && geminiMessages.length > 0) {
          const lastUserMsg = geminiMessages[geminiMessages.length - 1];
          if (lastUserMsg.role === 'user') {
              const attachmentNotes = [];

              for (const file of files) {
                  attachmentNotes.push(`- ${file.name} (${file.type})`);

                  if (file.type.startsWith('image/')) {
                      const base64Data = file.data.includes(',') ? file.data.split(',')[1] : file.data;
                      if (base64Data && base64Data.length > 0) {
                          lastUserMsg.parts.push({
                              inlineData: {
                                  mimeType: file.type,
                                  data: base64Data
                              }
                          });
                      }
                      if (file.ocrText && file.ocrText.trim()) {
                          const ocrText = file.ocrText.trim().slice(0, 5000);
                          lastUserMsg.parts.push({ text: `OCR text from image ${file.name}: ${ocrText}` });
                      }
                  } else if (file.type === 'application/pdf') {
                      const pdfText = await extractPdfText(file.data);
                      if (pdfText) {
                          lastUserMsg.parts.push({ text: `Extracted text from PDF ${file.name}: ${pdfText}` });
                      }
                  }
              }

              if (attachmentNotes.length > 0) {
                  lastUserMsg.parts[0].text += `\n\nAttached files:\n${attachmentNotes.join('\n')}\nPlease use the contents of these attachments to answer the user's question.`;
              }
          }
      }

      const systemMessage = messages.find(msg => msg.role === 'system');
      if (systemMessage && geminiMessages.length > 0) {
          if (geminiMessages[0].role === 'user') {
              geminiMessages[0].parts[0].text = `${systemMessage.content}\n\nUser: ${geminiMessages[0].parts[0].text}`;
          }
      }

      const requestBody = {
          contents: geminiMessages,
          generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 8192,
          }
      };

      const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
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