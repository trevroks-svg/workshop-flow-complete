import { parseJobScheduleCsv, matchJobCard } from '../lib/jobSchedule.js';

// In-memory store for the current day's imported schedule. The schedule is
// imported fresh each morning from the DMS export, so it does not need to
// survive a server restart. A Supabase table is the persistence step if
// Trevor wants the schedule kept across restarts.
let storedSchedule = { rows: [], inDates: [], importedAt: null };

export function getStoredSchedule() {
  return storedSchedule;
}

export function resetStoredSchedule() {
  storedSchedule = { rows: [], inDates: [], importedAt: null };
}

export async function importJobSchedule(req, res) {
  try {
    const { csvText } = req.body || {};
    if (typeof csvText !== 'string' || !csvText.trim()) {
      return res.status(400).json({ success: false, error: 'csvText is required' });
    }

    const { rows, errors, inDates } = parseJobScheduleCsv(csvText);
    if (!rows.length) {
      return res.status(400).json({
        success: false,
        error: errors[0] || 'No job rows found in the CSV.',
        errors,
      });
    }

    storedSchedule = { rows, inDates, importedAt: new Date().toISOString() };
    return res.json({
      success: true,
      rowCount: rows.length,
      inDates,
      importedAt: storedSchedule.importedAt,
      errors,
    });
  } catch (err) {
    console.error('importJobSchedule route error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Job schedule import failed' });
  }
}

export async function matchJobSchedule(req, res) {
  try {
    const jobCard = String(req.query?.jobCard || '').trim();
    if (!jobCard) {
      return res.status(400).json({ success: false, error: 'jobCard query param is required' });
    }

    const row = matchJobCard(storedSchedule.rows, jobCard);
    return res.json({
      success: true,
      matched: row != null,
      scheduleLoaded: storedSchedule.rows.length > 0,
      importedAt: storedSchedule.importedAt,
      row: row || null,
    });
  } catch (err) {
    console.error('matchJobSchedule route error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Job schedule lookup failed' });
  }
}

export async function jobScheduleStatus(req, res) {
  return res.json({
    success: true,
    loaded: storedSchedule.rows.length > 0,
    rowCount: storedSchedule.rows.length,
    inDates: storedSchedule.inDates,
    importedAt: storedSchedule.importedAt,
  });
}
