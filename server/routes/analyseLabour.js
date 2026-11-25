import OpenAI from 'openai';

function getOpenAIClient(req) {
  return req.app?.locals?.openaiClient || new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export default async function analyseLabour(req, res) {
  try {
    const { prompt } = req.body || {};
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ success: false, error: 'prompt is required' });
    }

    if (!process.env.OPENAI_API_KEY && !req.app?.locals?.openaiClient) {
      return res.status(500).json({ success: false, error: 'OPENAI_API_KEY is not configured' });
    }

    const openai = getOpenAIClient(req);
    const response = await openai.responses.create({
      model: process.env.OPENAI_LABOUR_MODEL || 'gpt-5.4-nano',
      input: prompt,
    });

    // Raw model text — the caller parses the JSON labour lines from it,
    // exactly as it did from the old browser call.
    const text = (response.output_text || '').trim();
    if (!text) {
      return res.status(502).json({ success: false, error: 'OpenAI returned no labour analysis' });
    }

    return res.json({ success: true, text });
  } catch (err) {
    console.error('analyseLabour route error:', err);
    return res.status(500).json({ success: false, error: err.message || 'AI labour analysis failed' });
  }
}
