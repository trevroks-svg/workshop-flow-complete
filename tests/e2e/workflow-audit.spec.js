import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { TEST_USERS, TEST_PASSWORD, makeJobCard } from './helpers/auth.js';

const users = Object.fromEntries(TEST_USERS.map(user => [user.role, user]));
const screenshotsRoot = path.resolve('tests', 'screenshots', 'workflow-audit');
const reportPath = path.resolve('workflow-audit-report.md');
const quoteFixture = path.resolve('tests', 'fixtures', 'test-audit-quote.pdf');

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'step';
}

function readEnv() {
  return Object.fromEntries(
    fs.readFileSync('.env', 'utf8')
      .split(/\r?\n/)
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

async function createAuditDb() {
  const env = readEnv();
  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.auth.signInWithPassword({
    email: users.admin.email,
    password: TEST_PASSWORD,
  });

  return { supabase, authError: error?.message || null };
}

function createCollectors(page) {
  const events = {
    consoleErrors: [],
    pageErrors: [],
    networkErrors: [],
    apiErrors: [],
  };

  page.on('console', message => {
    if (message.type() === 'error') events.consoleErrors.push(message.text());
  });
  page.on('pageerror', error => events.pageErrors.push(error.message));
  page.on('requestfailed', request => {
    const url = request.url();
    if (/supabase|\/api\/|rest\/v1|auth\/v1|storage\/v1/i.test(url)) {
      events.networkErrors.push(`${request.method()} ${url} ${request.failure()?.errorText || ''}`.trim());
    }
  });
  page.on('response', response => {
    const url = response.url();
    if (response.status() >= 400 && /supabase|\/api\/|rest\/v1|auth\/v1|storage\/v1/i.test(url)) {
      events.apiErrors.push(`${response.status()} ${response.request().method()} ${url}`);
    }
  });

  return events;
}

function markEvents(events) {
  return Object.fromEntries(Object.entries(events).map(([key, value]) => [key, value.length]));
}

function diffEvents(events, mark) {
  return Object.fromEntries(Object.entries(events).map(([key, value]) => [key, value.slice(mark[key])]));
}

async function clearSession(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  }).catch(() => {});
}

async function login(page, user) {
  await clearSession(page);
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /parts requests/i })).toBeVisible({ timeout: 20_000 });
}

async function chooseRadixOption(page, triggerText, optionText) {
  await page.getByRole('combobox').filter({ hasText: triggerText }).first().click();
  await page.getByRole('option', { name: optionText }).click();
}

async function findPartsRequest(supabase, jobCard) {
  const { data, error } = await supabase
    .from('parts_requests')
    .select('*')
    .eq('job_card_number', jobCard)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

async function findInspection(supabase, jobCard, customerName) {
  const { data, error } = await supabase
    .from('vehicle_inspections')
    .select('*')
    .eq('job_card_number', jobCard)
    .eq('customer_name', customerName)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

async function safeDeleteById(supabase, table, id, markerPredicate) {
  const { data, error: readError } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  if (readError) return { table, id, cleaned: false, error: readError.message };
  if (!data) return { table, id, cleaned: true, note: 'already absent' };
  if (!markerPredicate(data)) return { table, id, cleaned: false, error: 'marker check failed; record not deleted' };

  const { error } = await supabase.from(table).delete().eq('id', id);
  return { table, id, cleaned: !error, error: error?.message || null };
}

async function cleanupAuditData(supabase, state) {
  const results = [];

  if (state.partsRequestId) {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('request_id', state.partsRequestId);
    if (error) {
      results.push({ table: 'notifications', cleaned: false, error: error.message });
    } else {
      for (const notification of notifications || []) {
        results.push(await safeDeleteById(
          supabase,
          'notifications',
          notification.id,
          row => row.request_id === state.partsRequestId || row.job_card_number === state.partsJobCard
        ));
      }
    }
  }

  if (state.inspectionId) {
    results.push(await safeDeleteById(
      supabase,
      'vehicle_inspections',
      state.inspectionId,
      row => String(row.customer_name || '').startsWith(state.tag) || String(row.technician_notes || '').startsWith(state.tag)
    ));
  }

  if (state.partsRequestId) {
    results.push(await safeDeleteById(
      supabase,
      'parts_requests',
      state.partsRequestId,
      row => row.id === state.partsRequestId && String(row.notes || '').startsWith(state.tag)
    ));
  }

  if (state.quotePdfUrl) {
    const marker = '/storage/v1/object/public/workshop-photos/';
    const objectPath = state.quotePdfUrl.includes(marker)
      ? decodeURIComponent(state.quotePdfUrl.split(marker)[1].split('?')[0])
      : null;
    if (objectPath?.startsWith('quote-pdfs/')) {
      const { error } = await supabase.storage.from('workshop-photos').remove([objectPath]);
      results.push({ table: 'storage:workshop-photos', id: objectPath, cleaned: !error, error: error?.message || null });
    }
  }

  return results;
}

function buildReport(context) {
  const stripAnsi = value => String(value || '').replace(/\u001b\[[0-9;]*m/g, '');
  const stepRows = context.steps.map(step =>
    `| ${step.name} | ${step.status} | ${stripAnsi(step.notes || '-').replace(/\r?\n/g, '<br>')} | ${step.screenshot || '-'} |`
  ).join('\n');

  const consoleErrors = context.steps.flatMap(step => step.events.consoleErrors.concat(step.events.pageErrors)).map(stripAnsi);
  const apiErrors = context.steps.flatMap(step => step.events.apiErrors.concat(step.events.networkErrors)).map(stripAnsi);
  const failed = context.steps.filter(step => step.status === 'FAIL');
  const skipped = context.steps.filter(step => step.status === 'SKIPPED');
  const schemaError = consoleErrors.find(error => /Could not find the .* column of 'parts_requests'/i.test(error));
  const firstFix = failed.length === 0
    ? 'No handoff failure recorded. Review API abort noise separately if it remains reproducible outside navigation/logout transitions.'
    : schemaError
    ? `Fix parts request submission payload/schema mismatch: ${schemaError}`
    : failed[0]?.notes || (apiErrors[0] ? `Investigate API/network failure: ${apiErrors[0]}` : 'None recorded.');

  return `# Workshop Flow Workflow Audit Report

Generated: ${new Date().toISOString()}
Base URL: ${context.baseURL}
Marker: ${context.tag}

Safety note: Only TEST-AUDIT-marked records created by this run were used. Cleanup was attempted only for captured IDs after marker checks.

## Steps

| Step | Result | Notes | Screenshot |
| --- | --- | --- | --- |
${stepRows}

## Console Errors

${consoleErrors.length ? consoleErrors.map(error => `- ${error}`).join('\n') : 'None recorded.'}

## API Errors

${apiErrors.length ? apiErrors.map(error => `- ${error}`).join('\n') : 'None recorded.'}

## Status Changes Observed

${context.statusChanges.length ? context.statusChanges.map(change => `- ${change}`).join('\n') : 'None recorded.'}

## Records Created

${context.recordsCreated.length ? context.recordsCreated.map(record => `- ${record}`).join('\n') : 'None recorded.'}

## Records Cleaned Up

${context.cleanupResults.length ? context.cleanupResults.map(result => `- ${result.table}${result.id ? ` ${result.id}` : ''}: ${result.cleaned ? 'cleaned' : 'not cleaned'}${result.error ? ` (${result.error})` : ''}${result.note ? ` (${result.note})` : ''}`).join('\n') : 'No cleanup attempted or no records were created.'}

## Recommended First Fix

${failed.length || apiErrors.length ? stripAnsi(firstFix) : 'No workflow failure recorded.'}

## Summary

- Steps passed: ${context.steps.filter(step => step.status === 'PASS').length}
- Steps failed: ${failed.length}
- Steps skipped: ${skipped.length}
- Screenshots captured: ${context.steps.filter(step => step.screenshot).length}
`;
}

test.describe.serial('safe TEST-AUDIT workflow audit', () => {
  test.setTimeout(420_000);

  test('end-to-end workflow with TEST-AUDIT records only', async ({ page }, testInfo) => {
    fs.mkdirSync(screenshotsRoot, { recursive: true });
    const events = createCollectors(page);
    const tag = `TEST-AUDIT-${Date.now()}`;
    const mode = process.env.WORKFLOW_AUDIT_MODE || 'full';
    const state = {
      tag,
      inspectionJobCard: makeJobCard(),
      partsJobCard: mode === 'handoff-only' ? `${tag}-PARTS` : makeJobCard(),
      inspectionId: null,
      partsRequestId: null,
      quotePdfUrl: null,
    };
    const context = {
      baseURL: testInfo.project.use.baseURL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
      tag,
      mode,
      steps: [],
      statusChanges: [],
      recordsCreated: [],
      cleanupResults: [],
    };
    const { supabase, authError } = await createAuditDb();
    if (authError) context.steps.push({ name: 'Authenticate cleanup/read client', status: 'FAIL', notes: authError, events: { consoleErrors: [], pageErrors: [], networkErrors: [], apiErrors: [] } });

    async function screenshot(name) {
      const relative = path.join('tests', 'screenshots', 'workflow-audit', `${String(context.steps.length + 1).padStart(2, '0')}-${slug(name)}.png`);
      const absolute = path.resolve(relative);
      await page.screenshot({ path: absolute, fullPage: true }).catch(() => {});
      return relative;
    }

    async function runStep(name, fn) {
      const mark = markEvents(events);
      try {
        const notes = await fn();
        const shot = await screenshot(name);
        context.steps.push({ name, status: 'PASS', notes: notes || '-', screenshot: shot, events: diffEvents(events, mark) });
        return true;
      } catch (error) {
        const shot = await screenshot(`${name} error`);
        context.steps.push({ name, status: 'FAIL', notes: error.message, screenshot: shot, events: diffEvents(events, mark) });
        return false;
      }
    }

    async function skipStep(name, reason) {
      context.steps.push({
        name,
        status: 'SKIPPED',
        notes: reason,
        screenshot: null,
        events: { consoleErrors: [], pageErrors: [], networkErrors: [], apiErrors: [] },
      });
    }

    try {
      if (context.mode !== 'handoff-only') {
        await runStep('Technician creates and submits Vehicle Inspection', async () => {
          await login(page, users.technician);
          await page.getByRole('link', { name: /new inspection/i }).click();
          await expect(page.getByRole('heading', { name: /vehicle inspection/i })).toBeVisible();
          await page.getByPlaceholder('J12345678').fill(state.inspectionJobCard);
          await page.getByPlaceholder('Customer Name').fill(`${tag} Inspection Customer`);
          await page.getByPlaceholder('Vehicle Registration').fill('AUDIT1');
          await page.getByPlaceholder('Vehicle Make / Model').fill(`${tag} Toyota Test`);
          await page.getByPlaceholder('Odometer Reading').fill('12345');
          const technicianName = page.getByPlaceholder('Technician Name');
          if (!(await technicianName.inputValue())) await technicianName.fill(`${tag} Technician`);
          await page.getByPlaceholder(/general observations/i).fill(`${tag} submitted inspection audit`);
          await page.getByRole('button', { name: /submit to service advisor/i }).click();
          await expect(page.getByRole('heading', { name: /parts requests/i })).toBeVisible({ timeout: 20_000 });

          const inspection = await findInspection(supabase, state.inspectionJobCard, `${tag} Inspection Customer`);
          if (!inspection) throw new Error('Submitted TEST-AUDIT inspection was not found in vehicle_inspections.');
          state.inspectionId = inspection.id;
          context.recordsCreated.push(`vehicle_inspections ${inspection.id} (${state.inspectionJobCard})`);
          return `Created vehicle_inspections ${inspection.id}`;
        });

        await runStep('Service Advisor can see submitted inspection', async () => {
          await login(page, users.service_advisor);
          await expect(page.getByText(state.inspectionJobCard)).toBeVisible({ timeout: 20_000 });
          await expect(page.getByText(`${tag} Inspection Customer`)).toBeVisible();
          return 'Submitted inspection visible in advisor Vehicle Inspections queue.';
        });
      }

      await runStep('Technician creates Parts Request', async () => {
        await login(page, users.technician);
        await page.getByRole('link', { name: /new request/i }).click();
        await expect(page.getByRole('heading', { name: /new parts request/i })).toBeVisible();
        await page.getByLabel(/job card number/i).fill(state.partsJobCard);
        await page.getByRole('button', { name: /add part|add your first part/i }).first().click();
        await chooseRadixOption(page, /select part/i, 'Air Filter');
        await page.getByPlaceholder(/any additional information/i).fill(`${tag} parts request audit`);
        await page.getByRole('button', { name: /submit request/i }).click();
        await expect(page.getByRole('heading', { name: new RegExp(`job #${state.partsJobCard}`, 'i') })).toBeVisible({ timeout: 20_000 });

        const request = await findPartsRequest(supabase, state.partsJobCard);
          if (!request) throw new Error('Submitted TEST-AUDIT parts request was not found in parts_requests.');
          if (!String(request.notes || '').startsWith(tag)) throw new Error('Created parts request is missing TEST-AUDIT marker in notes.');
          state.partsRequestId = request.id;
          context.recordsCreated.push(`parts_requests ${request.id} (${state.partsJobCard})`);
          context.statusChanges.push(`${state.partsJobCard}: created as ${request.status}`);
          return `Created parts_requests ${request.id}`;
        });

      if (context.mode === 'parts-request-only') {
        await skipStep('Parts Interpreter can see request', 'Skipped by parts-request-only audit mode.');
        await skipStep('Parts Interpreter adds quote details and submits to Workshop Controller', 'Skipped by parts-request-only audit mode.');
        await skipStep('Workshop Controller can see quoted request', 'Skipped by parts-request-only audit mode.');
        await skipStep('Workshop Controller approves and sends to Service Advisor', 'Skipped by parts-request-only audit mode.');
        await skipStep('Service Advisor can see approved recommendation', 'Skipped by parts-request-only audit mode.');
        await skipStep('Service Advisor marks customer approved', 'Skipped by parts-request-only audit mode.');
        return;
      }

      if (!state.partsRequestId) {
        await skipStep('Parts Interpreter can see request', 'Skipped because parts request was not created.');
        await skipStep('Parts Interpreter adds quote details and submits to Workshop Controller', 'Skipped because parts request was not created.');
        await skipStep('Workshop Controller can see quoted request', 'Skipped because quote was not submitted.');
        await skipStep('Workshop Controller approves and sends to Service Advisor', 'Skipped because quote was not submitted.');
        await skipStep('Service Advisor can see approved recommendation', 'Skipped because workshop approval did not occur.');
        await skipStep('Service Advisor marks customer approved', 'Skipped because recommendation did not reach advisor.');
      } else {
        await runStep('Parts Interpreter can see request', async () => {
          await login(page, users.parts_interpreter);
          await page.getByPlaceholder(/search by job card/i).fill(state.partsJobCard);
          await expect(page.getByText(state.partsJobCard)).toBeVisible({ timeout: 20_000 });
          return 'Request visible in Parts Interpreter queue.';
        });

        const quoteSubmitted = await runStep('Parts Interpreter adds quote details and submits to Workshop Controller', async () => {
          await login(page, users.parts_interpreter);
          await page.goto(`/RequestDetail?id=${state.partsRequestId}`, { waitUntil: 'domcontentloaded' });
          await expect(page.getByRole('heading', { name: new RegExp(`job #${state.partsJobCard}`, 'i') })).toBeVisible({ timeout: 20_000 });
          await page.getByPlaceholder(/add notes about this quote/i).fill(`${tag} parts interpreter quote notes`);
          await page.getByRole('button', { name: /save notes/i }).click();
          await chooseRadixOption(page, /select parts eta/i, 'Stock');
          await expect(page.getByRole('button', { name: /upload quote pdf/i })).toBeEnabled({ timeout: 20_000 });
          await page.getByRole('button', { name: /upload quote pdf/i }).click();
          await page.locator('input[type="file"]').setInputFiles(quoteFixture);
          await page.getByRole('button', { name: /upload & return quote/i }).click({ timeout: 10_000 });
          await expect.poll(async () => {
            const request = await findPartsRequest(supabase, state.partsJobCard);
            return request?.status || 'missing';
          }, { timeout: 30_000 }).toBe('quoted');

          const request = await findPartsRequest(supabase, state.partsJobCard);
          state.quotePdfUrl = request.quote_pdf_url || null;
          state.quotePdfText = request.quote_pdf_text || null;
          expect(request.quote_pdf_text || '').not.toHaveLength(0);
          expect(request.quote_pdf_extracted_at || '').not.toHaveLength(0);
          context.statusChanges.push(`${state.partsJobCard}: ${request.status}`);
          return 'Quote notes and ETA saved; quote PDF uploaded and text extracted for Advisor/AI processing.';
        });

        if (!quoteSubmitted) {
          await skipStep('Workshop Controller can see quoted request', 'Skipped because parts interpreter quote submission did not complete.');
          await skipStep('Workshop Controller approves and sends to Service Advisor', 'Skipped because parts interpreter quote submission did not complete.');
          await skipStep('Service Advisor can see approved recommendation', 'Skipped because workshop approval did not occur.');
          await skipStep('Service Advisor marks customer approved', 'Skipped because recommendation did not reach advisor.');
          await skipStep('Final status recorded correctly', 'Skipped because customer decision was not reached.');
          return;
        }

        await runStep('Workshop Controller can see quoted request', async () => {
          await login(page, users.workshop_controller);
          await page.getByPlaceholder(/search by job card/i).fill(state.partsJobCard);
          await expect(page.getByText(state.partsJobCard)).toBeVisible({ timeout: 20_000 });
          return 'Quoted request visible in Workshop Controller queue.';
        });

        await runStep('Workshop Controller approves and sends to Service Advisor', async () => {
          await login(page, users.workshop_controller);
          await page.goto(`/RequestDetail?id=${state.partsRequestId}`, { waitUntil: 'domcontentloaded' });
          await expect(page.getByRole('heading', { name: new RegExp(`job #${state.partsJobCard}`, 'i') })).toBeVisible({ timeout: 20_000 });
          await chooseRadixOption(page, /select labour time/i, '1 Hour');
          await expect(page.getByRole('button', { name: /approve.*add to recommendations/i })).toBeEnabled({ timeout: 20_000 });
          await page.getByRole('button', { name: /approve.*add to recommendations/i }).click();
          await expect.poll(async () => {
            const request = await findPartsRequest(supabase, state.partsJobCard);
            return request?.status || 'missing';
          }, { timeout: 20_000 }).toBe('advisor_action_required');

          const request = await findPartsRequest(supabase, state.partsJobCard);
          context.statusChanges.push(`${state.partsJobCard}: ${request.status}`);
          return 'Workshop Controller approved via recommendation path.';
        });

        await runStep('Service Advisor can see approved recommendation', async () => {
          await login(page, users.service_advisor);
          await page.getByPlaceholder(/search by job card/i).fill(state.partsJobCard);
          await expect(page.getByText(state.partsJobCard)).toBeVisible({ timeout: 20_000 });
          await page.goto(`/RequestDetail?id=${state.partsRequestId}`, { waitUntil: 'domcontentloaded' });
          await expect(page.getByRole('button', { name: /add to recommendations/i })).toBeVisible({ timeout: 20_000 });
          await page.getByRole('button', { name: /add to recommendations/i }).click();
          await expect(page.getByRole('button', { name: /customer approved/i })).toBeVisible({ timeout: 20_000 });
          const request = await findPartsRequest(supabase, state.partsJobCard);
          context.statusChanges.push(`${state.partsJobCard}: ${request?.status || 'missing after advisor recommendation'}`);
          return 'Approved recommendation visible and added to recommendations.';
        });

        await runStep('Service Advisor marks customer approved', async () => {
          await page.getByRole('button', { name: /customer approved/i }).click();
          await chooseRadixOption(page, /select method/i, 'Phone');
          await page.getByRole('button', { name: /record approval/i }).click();
          await expect(page.getByText(/customer decision.*approved|customer approved/i)).toBeVisible({ timeout: 20_000 });

          const request = await findPartsRequest(supabase, state.partsJobCard);
          if (request?.status !== 'customer_approved') throw new Error(`Expected customer_approved, found ${request?.status || 'missing'}.`);
          context.statusChanges.push(`${state.partsJobCard}: ${request.status}`);
          return 'Customer approval recorded.';
        });
      }
    } finally {
      context.cleanupResults = await cleanupAuditData(supabase, state).catch(error => [
        { table: 'cleanup', cleaned: false, error: error.message },
      ]);
      fs.writeFileSync(reportPath, buildReport(context));
      await supabase.auth.signOut().catch(() => {});
      await clearSession(page);
    }
  });
});
