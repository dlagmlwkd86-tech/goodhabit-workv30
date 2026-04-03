// /api/ai.js — Vercel Serverless Function (Gemini 3.1 Flash-Lite Preview)

const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview";
const MAX_RETRIES = 4;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(baseMs) {
  return Math.floor(Math.random() * Math.min(1000, Math.max(250, baseMs * 0.25)));
}

function safeJson(res) {
  return res.json().catch(() => ({}));
}

function extractRetryDelayMs(response, data, attempt) {
  const retryAfter = response?.headers?.get?.("retry-after");
  if (retryAfter) {
    const secs = Number.parseFloat(retryAfter);
    if (Number.isFinite(secs) && secs > 0) return Math.ceil(secs * 1000);
  }

  const candidates = [
    data?.error?.details,
    data?.error?.message,
    data?.message,
  ].filter(Boolean).join(" ");

  const secMatch = candidates.match(/retry in\s+([\d.]+)s/i);
  if (secMatch) {
    const secs = Number.parseFloat(secMatch[1]);
    if (Number.isFinite(secs) && secs > 0) return Math.ceil(secs * 1000);
  }

  const msMatch = candidates.match(/retry in\s+([\d.]+)ms/i);
  if (msMatch) {
    const ms = Number.parseFloat(msMatch[1]);
    if (Number.isFinite(ms) && ms > 0) return Math.ceil(ms);
  }

  const base = Math.min(16000, 2000 * (2 ** attempt));
  return base + jitter(base);
}

function friendlyAiMessage(status, data) {
  const raw = String(data?.error?.message || data?.message || "");
  if (status === 429 || /quota|resource_exhausted|rate limit|too many requests/i.test(raw)) {
    return "AI 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.";
  }
  return raw || "AI 요청 중 오류가 발생했습니다.";
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, grounded } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000,
    },
  };

  if (grounded) {
    body.tools = [{ google_search_retrieval: { dynamic_retrieval_config: { mode: 'MODE_DYNAMIC', dynamic_threshold: 0.3 } } }];
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      const data = await safeJson(response);

      if (!response.ok) {
        const shouldRetry = response.status === 429 || /quota|resource_exhausted|rate limit|too many requests/i.test(String(data?.error?.message || data?.message || ''));
        if (shouldRetry && attempt < MAX_RETRIES) {
          const waitMs = extractRetryDelayMs(response, data, attempt);
          await sleep(waitMs);
          continue;
        }

        const userMessage = friendlyAiMessage(response.status, data);
        console.error('Gemini API error:', { status: response.status, data });
        return res.status(response.status).json({ error: userMessage, rawError: data?.error?.message || null });
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return res.status(200).json({ text });
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        const base = Math.min(16000, 2000 * (2 ** attempt));
        await sleep(base + jitter(base));
        continue;
      }
      console.error('Server error:', err);
      return res.status(500).json({ error: 'AI 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
    }
  }

  return res.status(429).json({ error: 'AI 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.' });
}
