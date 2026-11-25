import OpenAI from 'openai';
import { toPlainAscii } from '../lib/smsText.js';

function getOpenAIClient(req) {
  return req.app?.locals?.openaiClient || new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export default async function generateAdvisorSms(req, res) {
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
      model: process.env.OPENAI_ADVISOR_SMS_MODEL || 'gpt-5.4-nano',
      input: prompt,
    });

    const smsText = toPlainAscii((response.output_text || '').trim());
    if (!smsText) {
      return res.status(502).json({ success: false, error: 'OpenAI returned no SMS text' });
    }

    return res.json({ success: true, smsText });
  } catch (err) {
    console.error('generateAdvisorSms route error:', err);
    return res.status(500).json({ success: false, error: err.message || 'AI SMS generation failed' });
  }
}
