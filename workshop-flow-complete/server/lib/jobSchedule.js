/**
 * Daily job schedule CSV import (from the DMS Report_CSV_Exports).
 *
 * The schedule gives the agent the customer name and vehicle for a job card,
 * so SMS drafts do not have to rely on hand-typed details.
 *
 * Match on Job Card, NOT rego — the same vehicle can appear twice under
 * different job cards. If no row matches a job card, the draft is
 * incomplete: never invent a name, vehicle or phone number.
 */

// Minimal RFC 4180-style CSV parser: quoted fields, embedded commas and
// doubled quotes, CRLF or LF line endings.
export function parseCsvText(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  const input = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(r => r.some(cell => String(cell).trim() !== ''));
}

function columnIndex(headers, name) {
  return headers.indexOf(name);
}

function cellValue(cells, headers, name) {
  const idx = columnIndex(headers, name);
  return idx === -1 ? '' : String(cells[idx] ?? '').trim();
}

export function parseJobScheduleCsv(csvText) {
  const grid = parseCsvText(csvText);
  if (!grid.length) {
    return { rows: [], errors: ['Empty file — no rows found.'], inDates: [] };
  }

  const headers = grid[0].map(header => String(header || '').trim().toLowerCase());
  if (columnIndex(headers, 'job card') === -1) {
    return { rows: [], errors: ['No "Job Card" column found. Is this a daily job schedule export?'], inDates: [] };
  }

  const rows = [];
  const errors = [];
  for (let i = 1; i < grid.length; i++) {
    const cells = grid[i];
    const jobCard = cellValue(cells, headers, 'job card');
    if (!jobCard) {
      errors.push(`Row ${i + 1}: missing Job Card — skipped.`);
      continue;
    }
    rows.push({
      jobCard,
      inDate: cellValue(cells, headers, 'in date'),
      inTime: cellValue(cells, headers, 'in time'),
      pickupDate: cellValue(cells, headers, 'pick up date'),
      pickupTime: cellValue(cells, headers, 'pick up time'),
      rego: cellValue(cells, headers, 'rego'),
      modelDescription: cellValue(cells, headers, 'model description'),
      owner: cellValue(cells, headers, 'owner'),
      driver: cellValue(cells, headers, 'driver'),
      mobile: cellValue(cells, headers, 'mobile'),
      email: cellValue(cells, headers, 'email'),
      operation: cellValue(cells, headers, 'operation'),
      advisor: cellValue(cells, headers, 'advisor name') || cellValue(cells, headers, 'advisor'),
      status: cellValue(cells, headers, 'status'),
      vin: cellValue(cells, headers, 'vin'),
    });
  }

  return {
    rows,
    errors,
    inDates: [...new Set(rows.map(row => row.inDate).filter(Boolean))],
  };
}

export function matchJobCard(rows, jobCard) {
  const wanted = String(jobCard || '').trim().toUpperCase();
  if (!wanted) return null;
  return (rows || []).find(row => String(row.jobCard || '').trim().toUpperCase() === wanted) || null;
}

export function scheduleRowToCustomer(row) {
  if (!row) return null;
  return {
    customerName: (row.owner || '').trim(),
    vehicle: (row.modelDescription || '').trim(),
    mobile: (row.mobile || '').trim(),
    rego: (row.rego || '').trim(),
  };
}
