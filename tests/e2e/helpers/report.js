import fs from 'node:fs';
import path from 'node:path';

const reportDir = path.resolve('test-results', 'e2e');
const jsonPath = path.join(reportDir, 'summary.json');
const markdownPath = path.join(reportDir, 'summary.md');

function readEntries() {
  if (!fs.existsSync(jsonPath)) return [];
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

function writeMarkdown(entries) {
  const lines = [
    '# E2E Test Summary',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '| Role | Login | Menu Items | Pages Loaded | Console Errors |',
    '| --- | --- | --- | --- | --- |',
    ...entries.map(entry => [
      entry.role || 'workflow',
      entry.loginSuccess ? 'pass' : 'fail',
      (entry.menuItems || []).join(', ') || '-',
      (entry.pagesLoaded || []).join(', ') || '-',
      (entry.consoleErrors || []).join('<br>') || '-',
    ].map(value => String(value).replace(/\|/g, '\\|')).join(' | ')).map(row => `| ${row} |`),
    '',
  ];

  fs.writeFileSync(markdownPath, lines.join('\n'));
}

export function resetReport() {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(jsonPath, '[]');
  writeMarkdown([]);
}

export function appendReport(entry) {
  fs.mkdirSync(reportDir, { recursive: true });
  const entries = readEntries();
  entries.push({
    role: entry.role,
    loginSuccess: Boolean(entry.loginSuccess),
    menuItems: entry.menuItems || [],
    pagesLoaded: entry.pagesLoaded || [],
    consoleErrors: entry.consoleErrors || [],
    notes: entry.notes || [],
  });
  fs.writeFileSync(jsonPath, JSON.stringify(entries, null, 2));
  writeMarkdown(entries);
}
