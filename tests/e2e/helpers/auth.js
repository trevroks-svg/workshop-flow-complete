import { expect } from '@playwright/test';

export const TEST_PASSWORD = 'TestPass123!';

export const TEST_USERS = [
  { role: 'technician', label: 'Technician', email: 'test.technician@fmgauto.com.au' },
  { role: 'parts_interpreter', label: 'Parts Interpreter', email: 'test.parts@fmgauto.com.au' },
  { role: 'workshop_controller', label: 'Workshop Controller', email: 'test.wc@fmgauto.com.au' },
  { role: 'service_advisor', label: 'Service Advisor', email: 'test.advisor@fmgauto.com.au' },
  { role: 'service_manager', label: 'Service Manager', email: 'test.manager@fmgauto.com.au' },
  { role: 'admin', label: 'Administrator', email: 'test.admin@fmgauto.com.au' },
];

export function createConsoleCollector(page) {
  const consoleErrors = [];

  page.on('console', message => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', error => {
    consoleErrors.push(error.message);
  });

  return consoleErrors;
}

export async function loginAs(page, user) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(TEST_PASSWORD);
  // Exact match: the login page also has a "Sign in with Google" button,
  // and the loose /sign in/i pattern matches both (strict mode violation).
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();

  await expect(page.getByRole('heading', { name: /parts requests/i })).toBeVisible();
  await expect(page.getByText(new RegExp(`Logged in as\\s+${user.label}`, 'i'))).toBeVisible();
}

export async function logout(page) {
  const accountButton = page
    .locator('header button')
    .filter({ hasText: /technician|parts interpreter|workshop controller|service advisor|service manager|administrator|super admin/i })
    .first();

  try {
    await accountButton.click();
    await page.getByRole('menuitem', { name: /sign out/i }).click({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/(login|landing|$)/);
  } catch {
    // The page may already be closed (e.g. after a test timeout) — only
    // clear storage and navigate when it is still alive, so a logout
    // failure never masks the real test error.
    if (!page.isClosed()) {
      try {
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
        await page.goto('/login');
      } catch {
        // Page went away mid-cleanup; nothing more to do.
      }
    }
  }
}

export async function ensureHealthyPage(page) {
  await expect(page.locator('body')).not.toHaveText(/page not found/i);
  await expect(page.locator('body')).not.toHaveText(/access restricted|access denied/i);

  const visibleText = (await page.locator('body').innerText()).trim();
  expect(visibleText.length).toBeGreaterThan(20);
}

export async function getVisibleMenuItems(page) {
  const accountButton = page
    .locator('header button')
    .filter({ hasText: /technician|parts interpreter|workshop controller|service advisor|service manager|administrator|super admin/i })
    .first();
  await accountButton.click();
  const items = await page
    .locator('[role="menu"] [role="menuitem"], [role="menu"] a')
    .evaluateAll(nodes => nodes.map(node => node.textContent.trim()).filter(Boolean));
  await page.keyboard.press('Escape');
  return [...new Set(items)];
}

export function makeJobCard(prefix = 'J') {
  const digits = String(Math.floor(10_000_000 + Math.random() * 90_000_000));
  return `${prefix}${digits}`;
}
