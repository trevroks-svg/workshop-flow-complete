import OpenAI from 'openai';
import { parseQuoteText } from '../lib/quoteParser.js';

const repairAnalysisSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['pdf_was_readable', 'notes_used_for_pricing', 'line_items', 'groups', 'quote_total_inc_gst'],
  properties: {
    pdf_was_readable: { type: 'boolean' },
    notes_used_for_pricing: { type: 'boolean' },
    quote_total_inc_gst: { type: ['number', 'null'] },
    line_items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'description',
          'part_number',
          'quantity',
          'unit_price_ex_gst',
          'gst',
          'line_total_inc_gst',
        ],
        properties: {
          description: { type: 'string' },
          part_number: { type: ['string', 'null'] },
          quantity: { type: ['number', 'null'] },
          unit_price_ex_gst: { type: ['number', 'null'] },
          gst: { type: ['number', 'null'] },
          line_total_inc_gst: { type: ['number', 'null'] },
        },
      },
    },
    groups: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['repair_name', 'parts', 'parts_cost_ex_gst', 'estimated_labour_hours'],
        properties: {
          repair_name: { type: 'string' },
          parts: {
            type: 'array',
            items: { type: 'string' },
          },
          parts_cost_ex_gst: { type: ['number', 'null'] },
          estimated_labour_hours: { type: ['number', 'null'] },
        },
      },
    },
  },
};

function buildDataContext(request, partsText) {
  const pdfText = (request?.quote_pdf_text || '').trim();
  const notes = (request?.parts_interpreter_notes || '').trim();

  let context = '';

  if (pdfText) {
    context += 'PDF QUOTE TEXT:\n';
    context += `${pdfText}\n`;
  }

  if (notes) {
    context += '\nPARTS INTERPRETER NOTES:\n';
    context += `${notes}\n`;
  }

  if (partsText) {
    context += '\nTECHNICIAN PARTS LIST:\n';
    context += `${partsText}\n`;
  }

  return context.trim();
}

function buildPrompt(request, partsText) {
  const context = buildDataContext(request, partsText);

  return `You are an experienced Australian automotive workshop service advisor assistant.

Extract parts quote data from the provided text, then group related line items into customer-facing repair jobs.

DATA:
${context || '(no quote text, notes, or parts list provided)'}

Rules:
- Use the PDF quote text as the primary pricing source when present.
- If PDF text is missing or has no explicit prices, use Parts Interpreter notes for pricing.
- Never invent or estimate a parts price.
- If a part line gives unit price ex GST and GST, preserve those values.
- parts_cost_ex_gst must be the sum of explicit parts prices excluding GST for that repair group.
- line_total_inc_gst must be the line total including GST when explicitly found.
- quote_total_inc_gst must be the quote total including GST when explicitly found.
- If a price is missing, use null.
- If a line has $0.00, use null for that price unless the text clearly says it is free.
- Labour hours are allowed to be estimated in 0.25 hour increments and are editable later.
- Air filter alone should be grouped as "Air Filter".
- Return structured data only.`;
}

function parseOutput(response) {
  const text = response.output_text || '';
  if (!text) return null;
  return JSON.parse(text);
}

async function hydrateRequestFromDatabase(request) {
  if (!request?.id || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return request;
  }

  try {
    const { supabaseAdmin } = await import('../supabaseAdmin.js');
    const { data, error } = await supabaseAdmin
      .from('parts_requests')
      .select('*')
      .eq('id', request.id)
      .maybeSingle();

    if (error) throw error;
    return data ? { ...request, ...data } : request;
  } catch (error) {
    console.warn('Could not hydrate request before repair analysis:', error);
    return request;
  }
}

export default async function analyseRepairs(req, res) {
  try {
    const { request, partsText = '' } = req.body || {};
    if (!request || typeof request !== 'object') {
      return res.status(400).json({ success: false, error: 'request is required' });
    }

    const requestForAnalysis = await hydrateRequestFromDatabase(request);

    const rulesAnalysis = parseQuoteText(requestForAnalysis.quote_pdf_text);
    if (rulesAnalysis.success) {
      return res.json({
        success: true,
        source: 'rules',
        confidence: rulesAnalysis.confidence,
        result: rulesAnalysis.result,
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ success: false, error: 'OPENAI_API_KEY is not configured' });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.responses.create({
      model: process.env.OPENAI_ANALYSE_REPAIRS_MODEL || 'gpt-5.4-nano',
      input: buildPrompt(requestForAnalysis, partsText),
      text: {
        format: {
          type: 'json_schema',
          name: 'repair_quote_analysis',
          strict: true,
          schema: repairAnalysisSchema,
        },
      },
    });

    const result = parseOutput(response);
    if (!result) {
      return res.status(502).json({ success: false, error: 'OpenAI returned no structured analysis' });
    }

    return res.json({ success: true, source: 'openai', confidence: null, result });
  } catch (err) {
    console.error('analyseRepairs route error:', err);
    return res.status(500).json({ success: false, error: err.message || 'AI repair analysis failed' });
  }
}
