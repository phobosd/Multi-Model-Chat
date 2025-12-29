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

    console.log(`[Chat] Request for provider: ${provider}, model: ${modelId}`);

    try {
        // Format messages for OpenAI-compatible APIs (OpenAI, Custom, EXO)
        const formatMessages = (msgs) => {
            return msgs.map(m => {
                let content = m.content;

                // Handle attachments if they exist
                if (m.attachments && m.attachments.length > 0) {
                    const parts = [{ type: 'text', text: content }];
                    m.attachments.forEach(att => {
                        parts.push({
                            type: 'image_url',
                            image_url: { url: att }
                        });
                    });
                    content = parts;
                }

                return {
                    role: m.role,
                    content: content
                };
            });
        };

        if (provider === 'openai' || provider === 'custom' || provider === 'exo') {
            let url = '';
            if (provider === 'custom' || provider === 'exo') {
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

            const apiBody = {
                model: modelId || (provider === 'openai' ? 'gpt-4-turbo-preview' : 'gpt-3.5-turbo'),
                messages: formatMessages(messages),
                stream: true,
            };

            console.log(`[Chat] Forwarding to: ${url}`);

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(apiBody),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[Chat] Provider Error (${response.status}):`, errorText);
                try {
                    return res.status(response.status).json(JSON.parse(errorText));
                } catch (e) {
                    return res.status(response.status).json({ error: errorText });
                }
            }

            // Set headers for streaming
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            // Pipe the stream
            response.body.pipe(res);

            response.body.on('error', (err) => {
                console.error('[Chat] Stream Error:', err);
                res.end();
            });
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
        } else if (provider === 'exo' || provider === 'custom') {
            if (!baseUrl) throw new Error('Base URL required for model discovery');
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

// Proxy for EXO state (active instances)
app.post('/api/exo/state', async (req, res) => {
    const { baseUrl, apiKey } = req.body;

    try {
        if (!baseUrl) throw new Error('Base URL required for EXO state discovery');
        const cleanBaseUrl = baseUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '');
        const url = `${cleanBaseUrl}/state`;

        const headers = {};
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        const response = await fetch(url, { headers });
        if (!response.ok) {
            return res.status(response.status).json({ error: response.statusText });
        }

        const data = await response.json();
        console.log('[EXO State] Response:', JSON.stringify(data, null, 2));
        res.json(data);
    } catch (error) {
        console.error('EXO State Proxy Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Proxy for EXO nodes (resource usage)
app.post('/api/exo/nodes', async (req, res) => {
    const { baseUrl, apiKey } = req.body;

    try {
        if (!baseUrl) throw new Error('Base URL required for EXO nodes discovery');
        const cleanBaseUrl = baseUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '');
        const url = `${cleanBaseUrl}/nodes`;

        const headers = {};
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        const response = await fetch(url, { headers });
        if (!response.ok) {
            // If /nodes doesn't exist, try /state as a fallback
            const stateUrl = `${cleanBaseUrl}/state`;
            const stateRes = await fetch(stateUrl, { headers });
            if (stateRes.ok) {
                const stateData = await stateRes.json();
                return res.json(stateData.nodes || stateData);
            }
            return res.status(response.status).json({ error: response.statusText });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('EXO Nodes Proxy Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Proxy for EXO instance previews
app.post('/api/exo/instance/previews', async (req, res) => {
    const { baseUrl, apiKey, modelId } = req.body;

    try {
        if (!baseUrl) throw new Error('Base URL required for EXO preview');
        const cleanBaseUrl = baseUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '');
        const url = `${cleanBaseUrl}/instance/previews?model_id=${encodeURIComponent(modelId)}`;

        const headers = {};
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        const response = await fetch(url, { headers });
        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('EXO Preview Proxy Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Proxy for EXO instance creation (loading a model)
app.post('/api/exo/instance', async (req, res) => {
    const { baseUrl, apiKey, instanceConfig } = req.body;

    try {
        if (!baseUrl) throw new Error('Base URL required for EXO instance creation');
        const cleanBaseUrl = baseUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '');
        const url = `${cleanBaseUrl}/instance`;

        const headers = {
            'Content-Type': 'application/json'
        };
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ instance: instanceConfig })
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('EXO Instance Creation Proxy Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Proxy for EXO instance deletion (unloading a model)
app.delete('/api/exo/instance/:id', async (req, res) => {
    const { id } = req.params;
    const { baseUrl, apiKey } = req.body;

    try {
        if (!baseUrl) throw new Error('Base URL required for EXO instance deletion');
        const cleanBaseUrl = baseUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '');
        const url = `${cleanBaseUrl}/instance/${id}`;

        const headers = {};
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        const response = await fetch(url, {
            method: 'DELETE',
            headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: errorText });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('EXO Instance Deletion Proxy Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend proxy server running on http://localhost:${PORT}`);
});
