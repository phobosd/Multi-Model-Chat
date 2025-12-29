import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Proxy for chat completions
app.post('/api/chat', async (req, res) => {
    const { messages, model } = req.body;
    const { provider, apiKey, baseUrl, modelId } = model;

    try {
        if (provider === 'openai' || provider === 'custom') {
            let url = '';
            if (provider === 'custom') {
                const cleanBaseUrl = baseUrl?.replace(/\/$/, '') || '';
                const finalBaseUrl = cleanBaseUrl.endsWith('/v1') ? cleanBaseUrl : `${cleanBaseUrl}/v1`;
                url = `${finalBaseUrl}/chat/completions`;
            } else {
                url = 'https://api.openai.com/v1/chat/completions';
            }

            const headers = {
                'Content-Type': 'application/json',
            };
            if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: modelId || (provider === 'openai' ? 'gpt-4-turbo-preview' : 'gpt-3.5-turbo'),
                    messages,
                    stream: true,
                }),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                return res.status(response.status).json(error);
            }

            // Set headers for streaming
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            // Pipe the stream
            response.body.pipe(res);
        } else if (provider === 'gemini') {
            if (!apiKey) throw new Error('API Key required for Gemini');

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId || 'gemini-pro'}:generateContent?key=${apiKey}`;

            const contents = messages.map(m => {
                const parts = [{ text: m.content }];
                if (m.attachments) {
                    m.attachments.forEach(att => {
                        const base64Data = att.split(',')[1];
                        const mimeType = att.split(';')[0].split(':')[1];
                        parts.push({
                            inline_data: {
                                mime_type: mimeType,
                                data: base64Data
                            }
                        });
                    });
                }
                return {
                    role: m.role === 'user' ? 'user' : 'model',
                    parts
                };
            });

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents }),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                return res.status(response.status).json(error);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            // Gemini non-streaming response for now (to match frontend logic)
            res.json({ text });
        } else {
            res.status(400).json({ error: `Provider ${provider} not implemented` });
        }
    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Proxy for model discovery
app.post('/api/models', async (req, res) => {
    const { provider, apiKey, baseUrl } = req.body;

    try {
        let url = '';
        const headers = {};

        if (provider === 'openai') {
            url = 'https://api.openai.com/v1/models';
            if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
        } else if (provider === 'gemini') {
            if (!apiKey) throw new Error('API Key required for Gemini model discovery');
            url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        } else {
            if (!baseUrl) throw new Error('Base URL required for custom model discovery');
            const cleanBaseUrl = baseUrl.replace(/\/$/, '');
            const finalBaseUrl = cleanBaseUrl.endsWith('/v1') ? cleanBaseUrl : `${cleanBaseUrl}/v1`;
            url = `${finalBaseUrl}/models`;
            if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const response = await fetch(url, { headers });
        if (!response.ok) {
            return res.status(response.status).json({ error: response.statusText });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Models Proxy Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend proxy server running on http://localhost:${PORT}`);
});
