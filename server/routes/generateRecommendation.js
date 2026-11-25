import OpenAI from 'openai';
import { toPlainAscii } from '../lib/smsText.js';

function getOpenAIClient(req) {
  return req.app?.locals?.openaiClient || new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export default async function generateRecommendation(req, res) {
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
      model: process.env.OPENAI_RECOMMENDATION_MODEL || 'gpt-5.4-nano',
      input: prompt,
    });

    // Recommendation text is pasted into the DMS invoice, so it follows the
    // same plain-ASCII rule as SMS drafts.
    const text = toPlainAscii((response.output_text || '').trim());
    if (!text) {
      return res.status(502).json({ success: false, error: 'OpenAI returned no recommendation text' });
    }

    return res.json({ success: true, text });
  } catch (err) {
    console.error('generateRecommendation route error:', err);
    return res.status(500).json({ success: false, error: err.message || 'AI recommendation generation failed' });
  }
}
