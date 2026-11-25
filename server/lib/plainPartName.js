// Plain-language part names for customer-facing drafts.
//
// Dealer quote PDFs use terse part-code jargon (ELEMENT SUB-ASSY, LN1MF TOYOTA
// BATTERY, BLADE,HYBRID REFILL,8.5x710MM) and tyre lines are just a size and a
// code (225/65R17 102H SC-MS). Drafts must read in plain English and keep the
// full tyre size - never the jargon, and never a dropped prefix like "R17".
//
// Mirrored in src/lib/plainPartName.js - keep the two copies identical.

const BRANDS = {
  kumho: 'Kumho',
  hifly: 'Hifly',
  toyota: 'Toyota',
  michelin: 'Michelin',
  bridgestone: 'Bridgestone',
  goodyear: 'Goodyear',
  pirelli: 'Pirelli',
  continental: 'Continental',
  dunlop: 'Dunlop',
  yokohama: 'Yokohama',
  falken: 'Falken',
  cooper: 'Cooper',
  bfgoodrich: 'BFGoodrich',
};

// A tyre size, e.g. 225/65R17, 235/55 R19, 265/60R18.
export const TYRE_SIZE_RE = /\b(\d{2,3}\/\d{2}\s*R\d{2})\b/i;

// A tyre model code such as HP71 or HP801. Deliberately requires two or more
// leading letters then digits, so load/speed codes (102H), size suffixes (R17)
// and pattern codes without digits (SC-MS) are not mistaken for a model.
const TYRE_MODEL_RE = /\b([A-Z]{2,}\d{2,})\b/i;

function sentenceCase(text) {
  const cleaned = String(text).replace(/\s+/g, ' ').trim().toLowerCase();
  if (!cleaned) return 'Part';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// Capitalise only the first letter, keeping brand and model codes (HP71)
// as they are.
function capitaliseFirst(text) {
  const cleaned = String(text).replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Part';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// Classify a PDF line description (or a request part description) into the
// part family the app uses, plus brand / model / tyre size when recognisable.
// partType is an optional hint from the request: note-priced items carry the
// request's part type (a note saying "hifly HP801 $179 each" has no tyre
// word or size in it, but the job's part is tyres).
// Returns { family, brand, model, size } where family is one of
// tyres, air_filter, cabin_filter, battery, wiper_blades, brake_pads,
// brake_rotors, other.
export function classifyPart(text, partType) {
  const raw = String(text || '').trim();
  const sizeMatch = raw.match(TYRE_SIZE_RE);
  const size = sizeMatch ? sizeMatch[1].toUpperCase().replace(/\s+/g, '') : null;
  const isTyre = partType === 'tyres' || /\btyres?\b|\btires?\b/i.test(raw) || !!size;
  const brandKey = Object.keys(BRANDS).find((b) => new RegExp(`\\b${b}\\b`, 'i').test(raw));
  const brand = brandKey ? BRANDS[brandKey] : null;

  if (isTyre) {
    const modelMatch = raw.match(TYRE_MODEL_RE);
    const model = modelMatch ? modelMatch[1].toUpperCase() : null;
    return { family: 'tyres', brand, model, size };
  }
  if (/\bcabin\b|\bpollen\b/i.test(raw)) return { family: 'cabin_filter', brand, model: null, size: null };
  if (/\bfilter\b/i.test(raw) && /\bair\b/i.test(raw)) return { family: 'air_filter', brand, model: null, size: null };
  if (/element\s+sub-?assy/i.test(raw) || /air\s+refiner/i.test(raw)) return { family: 'air_filter', brand, model: null, size: null };
  if (/\bbatter(y|ies)\b/i.test(raw)) return { family: 'battery', brand, model: null, size: null };
  if (/\bwiper\b|\bblade\b/i.test(raw)) return { family: 'wiper_blades', brand, model: null, size: null };
  if (/\bbrake\s*pad\b/i.test(raw)) return { family: 'brake_pads', brand, model: null, size: null };
  if (/\bbrake\s*(disc|rotor)\b/i.test(raw)) return { family: 'brake_rotors', brand, model: null, size: null };
  if (/\bfilter\b/i.test(raw)) return { family: 'other', brand, model: null, size: null };
  return { family: 'other', brand, model: null, size: null };
}

// Plain-language name for a part, e.g. "Tyre 225/65R17", "Kumho HP71 tyre",
// "Hifly HP801 tyre 235/55R19", "Toyota battery", "Air filter",
// "Cabin filter", "Wiper blades". partType is the optional request part
// type hint (see classifyPart).
export function plainPartName(text, partType) {
  const { family, brand, model, size } = classifyPart(text, partType);
  switch (family) {
    case 'tyres': {
      const name = [brand, model, 'tyre'].filter(Boolean).join(' ');
      return size ? `${capitaliseFirst(name)} ${size}` : capitaliseFirst(name);
    }
    case 'air_filter':
      return 'Air filter';
    case 'cabin_filter':
      return 'Cabin filter';
    case 'battery':
      return brand ? `${brand} battery` : 'Battery';
    case 'wiper_blades':
      return 'Wiper blades';
    case 'brake_pads':
      return 'Brake pads';
    case 'brake_rotors':
      return 'Brake rotors';
    default:
      return sentenceCase(text);
  }
}

// Family of a quote group, from its repair name (and its part type when set).
export function groupFamily(group) {
  return classifyPart(group?.repair_name || '', group?.part_type).family;
}

// True when the groups are two or more alternatives of the same part -
// e.g. two tyre brands at different prices. Their totals are alternatives,
// never to be added together.
export function groupsHaveOptions(groups) {
  if (!Array.isArray(groups) || groups.length < 2) return false;
  const families = groups.map((g) => groupFamily(g));
  const first = families[0];
  if (first === 'other') return false;
  return families.every((f) => f === first);
}
