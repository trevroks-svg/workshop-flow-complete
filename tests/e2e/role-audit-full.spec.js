import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { TEST_USERS, TEST_PASSWORD } from './helpers/auth.js';

const screenshotsRoot = path.resolve('tests', 'screenshots');
const reportPath = path.resolve('role-audit-report.md');

const roleWorkflows = {
  technician: [
    'Create Vehicle Inspection',
    'Save Draft Inspection',
    'Submit Inspection',
    'Create Parts Request',
    'Upload Photos',
    'Generate Recommendation',
    'View Submitted Requests',
  ],
  parts_interpreter: [
    'View New Parts Requests',
    'Open Request Details',
    'Add Quote Information',
    'Add ETA Information',
    'Save Quote',
    'Submit To Workshop Controller',
  ],
  workshop_controller: [
    'View Quoted Requests',
    'Review Request',
    'Approve Request',
    'Send To Advisor',
    'Verify Status Change',
  ],
  service_advisor: [
    'View Submitted Vehicle Inspections',
    'View Approved Recommendations',
    'View Customer Quote Information',
    'Mark Approved',
    'Mark Declined',
    'Verify Dashboard Updates',
  ],
  service_manager: [
    'View Reports',
    'View Follow Up Report',
    'View Open Requests',
    'View Dashboard Metrics',
    'Verify Reporting Pages Load',
  ],
  admin: [
    'View User Management',
    'View Business Settings',
    'View Admin Dashboard',
    'View System Configuration',
    'Verify Administrative Functions Load',
  ],
};

const knownWorkflowPages = {
  technician: [
    { name: 'Vehicle Inspection', url: '/VehicleInspection' },
    { name: 'Parts Request Form', url: '/PartsRequestForm' },
    { name: 'Submitted Requests Dashboard', url: '/Dashboard' },
  ],
  parts_interpreter: [
    { name: 'Parts Requests Dashboard', url: '/Dashboard' },
  ],
  workshop_controller: [
    { name: 'Controller Dashboard', url: '/Dashboard' },
  ],
  service_advisor: [
    { name: 'Advisor Dashboard', url: '/Dashboard' },
  ],
  service_manager: [
    { name: 'Follow-Up Report', url: '/FollowUpReport' },
    { name: 'Cleanup Orders', url: '/CleanupOrders' },
    { name: 'Business Settings', url: '/BusinessSettings' },
    { name: 'Manager Dashboard', url: '/Dashboard' },
  ],
  admin: [
    { name: 'User Management', url: '/AdminUsers' },
    { name: 'Business Settings', url: '/BusinessSettings' },
    { name: 'Statistics Dashboard', url: '/AdminStats' },
    { name: 'Testing Checklist', url: '/TestingChecklist' },
    { name: 'Admin Dashboard', url: '/Dashboard' },
  ],
};

function cleanName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'page';
}

function uniqueByUrl(pages) {
  const seen = new Set();
  return pages.filter(page => {
    if (seen.has(page.url)) return false;
    seen.add(page.url);
    return true;
  });
}

function setupCollectors(page) {
  const events = {
    consoleErrors: [],
    pageErrors: [],
    networkErrors: [],
    apiErrors: [],
  };

  page.on('console', message => {
    if (message.type() === 'error') {
      events.consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', error => {
    events.pageErrors.push(error.message);
  });

  page.on('requestfailed', request => {
    events.networkErrors.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`.trim());
  });

  page.on('response', response => {
    const url = response.url();
    if (response.status() >= 400 && /supabase|\/api\/|rest\/v1|auth\/v1|storage\/v1/i.test(url)) {
      events.apiErrors.push(`${response.status()} ${response.request().method()} ${url}`);
    }
  });

  return events;
}

function diffEvents(events, mark) {
  return {
    consoleErrors: events.consoleErrors.slice(mark.consoleErrors),
    pageErrors: events.pageErrors.slice(mark.pageErrors),
    networkErrors: events.networkErrors.slice(mark.networkErrors),
    apiErrors: events.apiErrors.slice(mark.apiErrors),
  };
}

function markEvents(events) {
  return {
    consoleErrors: events.consoleErrors.length,
    pageErrors: events.pageErrors.length,
    networkErrors: events.networkErrors.length,
    apiErrors: events.apiErrors.length,
  };
}

async function login(page, user) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /parts requests/i })).toBeVisible({ timeout: 20_000 });
}

async function logout(page) {
  const accountButton = page.locator('header button').filter({
    hasText: /technician|parts interpreter|workshop controller|service advisor|service manager|administrator|super admin/i,
  }).first();

  try {
    await accountButton.click();
    await page.getByRole('menuitem', { name: /sign out/i }).click({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/(login|landing|$)/, { timeout: 10_000 });
  } catch {
    if (!page.isClosed()) {
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      }).catch(() => {});
      await page.goto('/login', { waitUntil: 'domcontentloaded' }).catch(() => {});
    }
  }
}

async function getMenuPages(page) {
  const accountButton = page.locator('header button').filter({
    hasText: /technician|parts interpreter|workshop controller|service advisor|service manager|administrator|super admin/i,
  }).first();

  await accountButton.click();
  const items = await page.locator('[role="menu"] [role="menuitem"], [role="menu"] a').evaluateAll(nodes =>
    nodes
      .map(node => {
        const text = node.textContent.trim().replace(/\s+/g, ' ');
        const anchor = node.matches('a') ? node : node.querySelector('a');
        return { name: text, url: anchor?.getAttribute('href') || null };
      })
      .filter(item => item.name)
  );
  await page.keyboard.press('Escape');

  return items;
}

async function getDashboardWidgets(page) {
  return page.locator('main').evaluate(node => {
    const selectors = [
      'h1',
      'h2',
      'h3',
      '[role="tab"]',
      'button',
      '[data-slot="card-title"]',
    ];

    const values = selectors.flatMap(selector =>
      Array.from(node.querySelectorAll(selector)).map(el => el.textContent.trim().replace(/\s+/g, ' '))
    );

    return Array.from(new Set(values.filter(Boolean))).slice(0, 80);
  });
}

async function evaluatePage(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1_500);

  const bodyText = await page.locator('body').innerText({ timeout: 10_000 }).catch(() => '');
  const visibleText = bodyText.trim();
  const hasSpinner = await page.locator('.animate-spin').count().catch(() => 0);
  const isBlank = visibleText.length < 20;
  const permissionDenied = /access restricted|access denied|permission denied|not authorized|unauthorized/i.test(visibleText);
  const pageNotFound = /page not found/i.test(visibleText);
  const loadingLoop = hasSpinner > 0 && visibleText.length < 80;

  return {
    visibleTextLength: visibleText.length,
    isBlank,
    permissionDenied,
    pageNotFound,
    loadingLoop,
    title: await page.title().catch(() => ''),
  };
}

function flattenIssues(results) {
  const issues = [];

  for (const role of results.roles) {
    if (!role.loginSuccess) {
      issues.push({ severity: 'CRITICAL', role: role.roleName, issue: 'Login failed', detail: role.loginError || 'Unknown login failure' });
    }

    for (const testedPage of role.pagesTested) {
      if (testedPage.blankPage) {
        issues.push({ severity: 'CRITICAL', role: role.roleName, issue: `Blank page: ${testedPage.name}`, detail: testedPage.url });
      }
      if (testedPage.pageNotFound) {
        issues.push({ severity: 'HIGH', role: role.roleName, issue: `Broken navigation: ${testedPage.name}`, detail: testedPage.url });
      }
      if (testedPage.permissionDenied) {
        issues.push({ severity: 'HIGH', role: role.roleName, issue: `Permission denied: ${testedPage.name}`, detail: testedPage.url });
      }
      if (testedPage.loadingLoop) {
        issues.push({ severity: 'HIGH', role: role.roleName, issue: `Potential loading loop: ${testedPage.name}`, detail: testedPage.url });
      }
      for (const error of testedPage.pageErrors) {
        issues.push({ severity: 'HIGH', role: role.roleName, issue: `React/runtime error on ${testedPage.name}`, detail: error });
      }
      for (const error of testedPage.apiErrors) {
        issues.push({ severity: 'MEDIUM', role: role.roleName, issue: `API error on ${testedPage.name}`, detail: error });
      }
      for (const error of testedPage.networkErrors) {
        issues.push({ severity: 'MEDIUM', role: role.roleName, issue: `Network error on ${testedPage.name}`, detail: error });
      }
      for (const error of testedPage.consoleErrors) {
        issues.push({ severity: 'LOW', role: role.roleName, issue: `Console error on ${testedPage.name}`, detail: error });
      }
    }
  }

  return issues;
}

function section(lines, title, issues) {
  lines.push(`## ${title}`, '');
  if (!issues.length) {
    lines.push('None recorded.', '');
    return;
  }
  for (const issue of issues) {
    lines.push(`- **${issue.role}** - ${issue.issue}: ${issue.detail}`);
  }
  lines.push('');
}

function writeReport(results) {
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const issues = flattenIssues(results).sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  const lines = [
    '# Workshop Flow Role Audit Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Base URL: ${results.baseURL}`,
    '',
    'Mutation note: Workflow actions that create, save, submit, approve, decline, upload, or otherwise change records were not executed because `.env` points to a hosted Supabase project and the audit instructions prohibit updating production data.',
    '',
  ];

  for (const role of results.roles) {
    lines.push(`## ${role.roleName}`, '');
    lines.push(`- Login Success/Fail: ${role.loginSuccess ? 'Success' : 'Fail'}`);
    if (role.loginError) lines.push(`- Login Error: ${role.loginError}`);
    lines.push(`- Visible Menu Items: ${role.menuItems.length ? role.menuItems.join(', ') : 'None recorded'}`);
    lines.push(`- Visible Dashboard Widgets: ${role.dashboardWidgets.length ? role.dashboardWidgets.join(', ') : 'None recorded'}`);
    lines.push(`- Pages Tested: ${role.pagesTested.map(page => page.name).join(', ') || 'None'}`);
    lines.push(`- Pages Passed: ${role.pagesTested.filter(page => page.passed).map(page => page.name).join(', ') || 'None'}`);
    lines.push(`- Pages Failed: ${role.pagesTested.filter(page => !page.passed).map(page => `${page.name} (${page.failureReasons.join('; ')})`).join(', ') || 'None'}`);
    lines.push(`- Console Errors: ${role.pagesTested.flatMap(page => page.consoleErrors).length || 0}`);
    lines.push(`- Network Errors: ${role.pagesTested.flatMap(page => page.networkErrors).length || 0}`);
    lines.push(`- API Errors: ${role.pagesTested.flatMap(page => page.apiErrors).length || 0}`);
    lines.push(`- Permission Errors: ${role.pagesTested.filter(page => page.permissionDenied).length || 0}`);
    lines.push(`- Blank Pages: ${role.pagesTested.filter(page => page.blankPage).length || 0}`);
    lines.push(`- Screenshots Captured: ${role.screenshots.length}`);
    lines.push('');

    lines.push('| Page | URL | Result | Findings | Screenshot |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const page of role.pagesTested) {
      lines.push(`| ${page.name} | ${page.url} | ${page.passed ? 'Pass' : 'Fail'} | ${page.failureReasons.join('<br>') || '-'} | ${page.screenshot || '-'} |`);
    }
    lines.push('');

    lines.push('| Workflow Check | Result | Notes |');
    lines.push('| --- | --- | --- |');
    for (const workflow of role.workflowChecks) {
      lines.push(`| ${workflow.name} | ${workflow.result} | ${workflow.notes} |`);
    }
    lines.push('');
  }

  section(lines, 'CRITICAL ISSUES', issues.filter(issue => issue.severity === 'CRITICAL'));
  section(lines, 'HIGH PRIORITY ISSUES', issues.filter(issue => issue.severity === 'HIGH'));
  section(lines, 'MEDIUM PRIORITY ISSUES', issues.filter(issue => issue.severity === 'MEDIUM'));
  section(lines, 'LOW PRIORITY ISSUES', issues.filter(issue => issue.severity === 'LOW'));

  const highest = issues[0];
  lines.push('## Single Highest Priority Issue To Fix First', '');
  lines.push(highest ? `**${highest.role} - ${highest.issue}:** ${highest.detail}` : 'No failing issue was recorded by the audit run.');
  lines.push('');

  fs.writeFileSync(reportPath, lines.join('\n'));
}

test.describe.serial('complete role audit', () => {
  test.setTimeout(300_000);

  test('audits all configured roles and writes report', async ({ page }, testInfo) => {
    fs.mkdirSync(screenshotsRoot, { recursive: true });

    const baseURL = testInfo.project.use.baseURL || 'http://localhost:5173';
    const results = { baseURL, roles: [] };

    for (const user of TEST_USERS) {
      const roleDir = path.join(screenshotsRoot, cleanName(user.label));
      fs.mkdirSync(roleDir, { recursive: true });
      const events = setupCollectors(page);
      const roleResult = {
        roleName: user.label,
        role: user.role,
        loginSuccess: false,
        loginError: null,
        menuItems: [],
        dashboardWidgets: [],
        pagesTested: [],
        workflowChecks: [],
        screenshots: [],
      };

      try {
        await login(page, user);
        roleResult.loginSuccess = true;

        const dashboardShot = path.join(roleDir, 'dashboard.png');
        await page.screenshot({ path: dashboardShot, fullPage: true });
        roleResult.screenshots.push(path.relative(process.cwd(), dashboardShot));

        const menu = await getMenuPages(page);
        roleResult.menuItems = menu.map(item => item.name);
        roleResult.dashboardWidgets = await getDashboardWidgets(page);

        const pages = uniqueByUrl([
          { name: 'Dashboard', url: '/Dashboard' },
          ...menu.filter(item => item.url && !/sign out/i.test(item.name)).map(item => ({
            name: item.name,
            url: item.url,
          })),
          ...(knownWorkflowPages[user.role] || []),
        ]);

        for (const auditPage of pages) {
          const before = markEvents(events);
          await page.goto(auditPage.url, { waitUntil: 'domcontentloaded' });
          const health = await evaluatePage(page);
          const screenshot = path.join(roleDir, `${cleanName(auditPage.name)}.png`);
          await page.screenshot({ path: screenshot, fullPage: true });
          roleResult.screenshots.push(path.relative(process.cwd(), screenshot));
          const eventDelta = diffEvents(events, before);
          const failureReasons = [];

          if (health.isBlank) failureReasons.push('Blank page');
          if (health.permissionDenied) failureReasons.push('Permission denied/restricted message');
          if (health.pageNotFound) failureReasons.push('Page not found');
          if (health.loadingLoop) failureReasons.push('Potential loading loop');
          if (eventDelta.pageErrors.length) failureReasons.push(`Runtime errors: ${eventDelta.pageErrors.length}`);
          if (eventDelta.apiErrors.length) failureReasons.push(`API errors: ${eventDelta.apiErrors.length}`);
          if (eventDelta.networkErrors.length) failureReasons.push(`Network errors: ${eventDelta.networkErrors.length}`);

          roleResult.pagesTested.push({
            name: auditPage.name,
            url: auditPage.url,
            passed: failureReasons.length === 0,
            failureReasons,
            screenshot: path.relative(process.cwd(), screenshot),
            consoleErrors: eventDelta.consoleErrors,
            pageErrors: eventDelta.pageErrors,
            networkErrors: eventDelta.networkErrors,
            apiErrors: eventDelta.apiErrors,
            permissionDenied: health.permissionDenied,
            blankPage: health.isBlank,
            pageNotFound: health.pageNotFound,
            loadingLoop: health.loadingLoop,
          });
        }

        for (const workflowName of roleWorkflows[user.role] || []) {
          roleResult.workflowChecks.push({
            name: workflowName,
            result: /view|open|verify reporting pages load|view dashboard metrics/i.test(workflowName) ? 'Covered by page/menu audit where data was available' : 'Skipped',
            notes: /view|open|verify reporting pages load|view dashboard metrics/i.test(workflowName)
              ? 'Read/navigation coverage only; no record mutation performed.'
              : 'Not executed because the action would create, save, submit, approve, decline, upload, or change hosted Supabase data.',
          });
        }
      } catch (error) {
        roleResult.loginError = error.message;
      } finally {
        results.roles.push(roleResult);
        if (roleResult.loginSuccess) {
          await logout(page);
        }
      }
    }

    writeReport(results);
  });
});
