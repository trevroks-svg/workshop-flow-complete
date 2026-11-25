/**
 * Checks that a quote PDF belongs to the job it is attached to.
 *
 * A real trial caught a battery quote PDF attached to a tyres job, so a
 * mismatched PDF must never be used to build a quote. The check is
 * deterministic (no AI call) and runs before any quote is built, on both the
 * rules-parser path and the AI path.
 *
 * Signals checked, in order:
 * 1. Job card number — if the PDF text contains a job-card-like number that
 *    differs from the request's job card, it is a mismatch.
 * 2. Parts family — if the PDF's line items mention none of the requested
 *    parts (e.g. battery lines on a tyres job), it is a mismatch.
 * 3. Vehicle — if the PDF mentions the request's vehicle description, that
 *    supports a match. (The request carries no rego, so rego cannot be
 *    checked here.)
 *
 * Returns { status: 'match' | 'mismatch' | 'unverified', reason, ... }.
 * 'unverified' means the PDF has no job card number or part detail to
 * confirm it either way — it is a warning, not a block.
 */

const JOB_CARD_PATTERN = /\b[JB]\d{7,9}\b/g;

const PART_KEYWORDS = {
  air_filter: ['air filter', 'air element', 'air cleaner'],
  pollen_filter: ['pollen', 'cabin filter', 'cabin air'],
  battery: ['battery'],
  wiper_blades: ['wiper', 'blade'],
  front_pads: ['brake pad', 'pad set', 'pads'],
  rear_pads: ['brake pad', 'pad set', 'pads'],
  front_rotors: ['disc', 'rotor'],
  rear_rotors: ['disc', 'rotor'],
  tyres: ['tyre', 'tire'],
  other: [],
};

function normalise(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Compare job card numbers on their numeric core, so "J03073149" and
// "03073149" count as the same card.
function jobCardCore(token) {
  return String(token || '').toUpperCase().replace(/^[JB]/, '');
}

function findJobCardNumbers(text) {
  const found = new Set();
  for (const match of String(text || '').matchAll(JOB_CARD_PATTERN)) {
    found.add(match[0].toUpperCase());
  }
  for (const match of String(text || '').matchAll(/job\s*(?:card|no\.?|number)\s*[:#]?\s*([JB]?\d{7,9})/gi)) {
    found.add(match[1].toUpperCase());
  }
  return [...found];
}

export function checkPdfMatchesJob(request, pdfText, lineItems = []) {
  const jobCard = String(request?.job_card_number || '').trim().toUpperCase();
  const pdf = String(pdfText || '');
  const foundCards = findJobCardNumbers(pdf);

  if (jobCard && foundCards.length && !foundCards.some(token => jobCardCore(token) === jobCardCore(jobCard))) {
    return {
      status: 'mismatch',
      reason: `Quote PDF shows job card ${foundCards.join(', ')} but this request is job card ${jobCard}.`,
      jobCardNumbersFound: foundCards,
      jobCardExpected: jobCard,
    };
  }

  // Parts-family check: the PDF's line items should mention at least one of
  // the requested parts. A battery-only quote on a tyres job is a mismatch.
  const requestedTypes = (request?.parts || []).map(part => part.part_type).filter(Boolean);
  const descriptions = (lineItems || []).map(item => normalise(item.description)).filter(Boolean);
  if (requestedTypes.length && descriptions.length) {
    const haystack = descriptions.join(' ');
    const anyFamilyMatches = requestedTypes.some(type => {
      const keywords = PART_KEYWORDS[type] || [];
      if (!keywords.length) return true; // 'other' parts: cannot judge from keywords
      return keywords.some(keyword => haystack.includes(keyword));
    });
    if (!anyFamilyMatches) {
      return {
        status: 'mismatch',
        reason: 'Quote PDF line items do not mention any of the requested parts.',
        jobCardNumbersFound: foundCards,
        jobCardExpected: jobCard || null,
      };
    }
  }

  if (jobCard && foundCards.some(token => jobCardCore(token) === jobCardCore(jobCard))) {
    return {
      status: 'match',
      reason: `Quote PDF shows the same job card (${jobCard}).`,
      jobCardNumbersFound: foundCards,
      jobCardExpected: jobCard,
    };
  }

  const vehicle = normalise(request?.vehicle_type);
  if (vehicle && normalise(pdf).includes(vehicle)) {
    return {
      status: 'match',
      reason: 'Quote PDF mentions the same vehicle.',
      jobCardNumbersFound: foundCards,
      jobCardExpected: jobCard || null,
    };
  }

  return {
    status: 'unverified',
    reason: 'Quote PDF has no job card number or part detail to confirm it belongs to this job.',
    jobCardNumbersFound: foundCards,
    jobCardExpected: jobCard || null,
  };
}
