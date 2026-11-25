/**
 * Plain-ASCII handling for customer SMS text.
 *
 * The dealer system turns non-ASCII characters (em dashes, curly quotes and
 * apostrophes) into "?", so every SMS draft must be plain ASCII only, with
 * no quotation marks wrapped around it.
 */

const ASCII_REPLACEMENTS = {
  '\u2018': "'",
  '\u2019': "'",
  '\u201A': "'",
  '\u201B': "'",
  '\u201C': '"',
  '\u201D': '"',
  '\u201E': '"',
  '\u2013': '-',
  '\u2014': '-',
  '\u2015': '-',
  '\u2026': '...',
  '\u00D7': 'x',
  '\u2022': '-',
  '\u00A0': ' ',
  '\u00AB': '"',
  '\u00BB': '"',
  '\u2039': "'",
  '\u203A': "'",
};

export function toPlainAscii(value) {
  const text = String(value ?? '');
  let out = '';
  for (const ch of text) {
    if (Object.prototype.hasOwnProperty.call(ASCII_REPLACEMENTS, ch)) {
      out += ASCII_REPLACEMENTS[ch];
    } else if (ch.charCodeAt(0) < 128) {
      out += ch;
    }
    // Any other non-ASCII character is dropped rather than sent as "?".
  }
  return out;
}

export function isPlainAscii(value) {
  return [...String(value ?? '')].every(ch => ch.charCodeAt(0) < 128);
}

/** Prompt rules to add to any SMS-generation prompt. */
export const SMS_ASCII_RULES = [
  'Use plain ASCII characters only - no em dashes, curly apostrophes, curly quotes or other special characters (the dealer system turns them into "?").',
  'Do not wrap the SMS in quotation marks. Output only the SMS text, nothing else.',
].join('\n');
