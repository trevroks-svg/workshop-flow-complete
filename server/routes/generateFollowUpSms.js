import OpenAI from 'openai';

function isValidWorkItem(item) {
  return item && typeof item === 'object' && typeof item.repairName === 'string' && item.repairName.trim();
}

function validatePayload(body) {
  if (!body || typeof body !== 'object') return 'request body is required';
  if (typeof body.jobCard !== 'string' || !body.jobCard.trim()) return 'jobCard is required';
  if (typeof body.status !== 'string' || !body.status.trim()) return 'status is required';
  if (!Array.isArray(body.declinedWork) || !body.declinedWork.every(isValidWorkItem)) {
    return 'declinedWork must be an array of repair items';
  }
  return null;
}

function formatMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `$${number.toFixed(2)} inc GST` : 'price TBC';
}

function buildPrompt(payload) {
  const workLines = payload.declinedWork.map(item => [
    `- Repair: ${item.repairName}`,
    `  Parts: ${(item.parts || []).join(', ') || item.repairName}`,
    `  Parts ex GST: ${item.partsCostExGst == null ? 'TBC' : `$${Number(item.partsCostExGst).toFixed(2)}`}`,
    `  Labour: ${item.labourHours == null ? 'not specified' : `${item.labourHours}h @ $${item.labourRate}/h ex GST`}`,
    `  Total: ${formatMoney(item.totalIncGst)}`,
  ].join('\n')).join('\n\n');

  return `Generate a concise SMS follow-up for an Australian car dealership service advisor.

CUSTOMER NAME: ${payload.customerName || '(not provided)'}
VEHICLE: ${payload.vehicle || '(not specified)'}
JOB CARD: ${payload.jobCard}
STATUS: ${payload.status}
DECLINE DATE / STATUS DATE: ${payload.declineDate || '(not provided)'}
TOTAL: ${formatMoney(payload.totalIncGst)}

DECLINED OR UNANSWERED WORK:
${workLines}

STRICT RULES:
1. Output only the SMS text.
2. Keep it friendly, clear, and professional.
3. Mention this is a follow-up, not a new quote.
4. Use only the supplied repairs and prices. Never invent missing prices.
5. If any price is missing, write "price TBC".
6. End with: "Please reply YES to approve or call Fleurieu Motor Group Service on 08 8552 1255 to discuss."`;
}

function getOpenAIClient(req) {
  return req.app?.locals?.openaiClient || new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export default async function generateFollowUpSms(req, res) {
  try {
    const payload = req.body || {};
    const validationError = validatePayload(payload);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    if (!process.env.OPENAI_API_KEY && !req.app?.locals?.openaiClient) {
      return res.status(500).json({ success: false, error: 'OPENAI_API_KEY is not configured' });
    }

    const openai = getOpenAIClient(req);
    const response = await openai.responses.create({
      model: process.env.OPENAI_FOLLOW_UP_SMS_MODEL || 'gpt-5.4-nano',
      input: buildPrompt(payload),
    });

    const smsText = (response.output_text || '').trim();
    if (!smsText) {
      return res.status(502).json({ success: false, error: 'OpenAI returned no SMS text' });
    }

    return res.json({ success: true, smsText });
  } catch (err) {
    console.error('generateFollowUpSms route error:', err);
    return res.status(500).json({ success: false, error: err.message || 'AI follow-up SMS generation failed' });
  }
}

export { buildPrompt, validatePayload };
