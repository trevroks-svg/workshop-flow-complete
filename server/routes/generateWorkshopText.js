import OpenAI from 'openai';

const VALID_TYPES = new Set(['sms', 'recommendation']);
const VALID_SMS_VARIANTS = new Set(['short', 'standard', 'detailed']);

function validatePayload(body) {
  if (!body || typeof body !== 'object') return 'request body is required';
  if (!VALID_TYPES.has(body.type)) return 'type must be sms or recommendation';
  if (typeof body.repairLines !== 'string' || !body.repairLines.trim()) return 'repairLines is required';
  if (body.type === 'sms' && body.variant && !VALID_SMS_VARIANTS.has(body.variant)) {
    return 'variant must be short, standard, or detailed';
  }
  return null;
}

function buildPrompt(payload) {
  if (payload.type === 'recommendation') {
    return `Generate professional recommendation text for an Australian car dealership invoice/DMS system.

REPAIRS:
${payload.repairLines}

STRICT RULES:
1. List each repair separately on its own line.
2. Use: "Recommend [repair]: Parts $X.XX + Labour $X.XX = Total $X.XX inc GST" when all values are supplied.
3. If labour is not supplied, state only the parts price including GST.
4. If a price is TBC, write "Parts price TBC".
5. Use a professional, factual, neutral tone.
6. Never invent a repair or price.
7. Output only the recommendation text.`;
  }

  const customerName = String(payload.customerName || '').trim();
  const vehicle = String(payload.vehicle || '').trim();
  const greeting = customerName ? `Hi ${customerName},` : 'Hi there,';
  const opening = vehicle ? `${greeting} for your ${vehicle}` : greeting;
  const variant = VALID_SMS_VARIANTS.has(payload.variant) ? payload.variant : 'standard';
  const variantInstruction = variant === 'short'
    ? 'Keep it brief and under 160 characters if possible.'
    : variant === 'detailed'
      ? 'Include every repair and individual price; up to 320 characters is acceptable.'
      : 'Use a clear standard length and list every repair with its individual price.';

  return `Generate an SMS for an Australian car dealership service advisor requesting customer approval.

REPAIRS:
${payload.repairLines}
TOTAL INC GST: ${payload.totalIncGst == null ? 'price TBC' : `$${Number(payload.totalIncGst).toFixed(2)}`}
STYLE: ${variant}

STRICT RULES:
1. Start with: "${opening}"
2. Use friendly wording such as "we recommend" or "we've found".
3. List every repair on its own line with its supplied price.
4. Include a TOTAL line; use exactly "Total: price TBC" when no total is supplied.
5. End with: "Please reply YES to approve or NO to decline. Fleurieu Motor Group Service 08 8552 1255"
6. ${variantInstruction}
7. Never invent a repair or price.
8. Output only the SMS text.`;
}

export default async function generateWorkshopText(req, res) {
  try {
    const payload = req.body || {};
    const validationError = validatePayload(payload);
    if (validationError) return res.status(400).json({ success: false, error: validationError });

    if (!process.env.OPENAI_API_KEY && !req.app?.locals?.openaiClient) {
      return res.status(500).json({ success: false, error: 'OPENAI_API_KEY is not configured' });
    }

    const openai = req.app?.locals?.openaiClient || new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: process.env.OPENAI_WORKSHOP_TEXT_MODEL || 'gpt-5.4-nano',
      input: buildPrompt(payload),
    });
    const text = (response.output_text || '').trim();
    if (!text) return res.status(502).json({ success: false, error: 'OpenAI returned no text' });

    return res.json({ success: true, text });
  } catch (error) {
    console.error('generateWorkshopText route error:', error);
    return res.status(500).json({ success: false, error: error.message || 'AI text generation failed' });
  }
}

export { buildPrompt, validatePayload };
