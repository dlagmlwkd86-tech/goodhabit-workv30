import { assertSameOrigin, getSupabaseAdmin, json, requireAuth } from "../server/common.js";

const MAX_PROMPT_LENGTH = 6000;

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    assertSameOrigin(req);
    const supabase = getSupabaseAdmin();
    const me = await requireAuth(req, res, supabase);
    if (!me) return;

    const prompt = String(req.body?.prompt || "").trim();
    const grounded = !!req.body?.grounded;
    if (!prompt) return json(res, 400, { error: "prompt is required" });
    if (prompt.length > MAX_PROMPT_LENGTH) return json(res, 400, { error: `프롬프트는 ${MAX_PROMPT_LENGTH}자 이하로 입력해주세요` });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return json(res, 500, { error: "GEMINI_API_KEY not configured" });

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1500 },
    };

    if (grounded) {
      body.tools = [{ google_search_retrieval: { dynamic_retrieval_config: { mode: "MODE_DYNAMIC", dynamic_threshold: 0.3 } } }];
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    ).finally(() => clearTimeout(timeout));

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Gemini API error:", data);
      return json(res, response.status, { error: data.error?.message || "AI API error" });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return json(res, 200, { text });
  } catch (err) {
    console.error("AI server error:", err);
    return json(res, err?.name === "AbortError" ? 504 : (err?.status || 500), {
      error: err?.name === "AbortError" ? "AI 응답 시간이 초과되었습니다" : (err?.message || "Internal server error"),
    });
  }
}
