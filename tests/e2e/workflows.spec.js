import { test, expect } from '@playwright/test';
import {
  TEST_USERS,
  createConsoleCollector,
  ensureHealthyPage,
  loginAs,
  logout,
  makeJobCard,
} from './helpers/auth.js';
import { appendReport } from './helpers/report.js';

const users = Object.fromEntries(TEST_USERS.map(user => [user.role, user]));

async function addFirstPart(page, partName = 'Air Filter') {
  await page.getByRole('button', { name: /add part|add your first part/i }).first().click();
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: partName }).click();
}

test.describe.serial('role workflows', () => {
  test('technician can create a vehicle inspection', async ({ page }) => {
    const consoleErrors = createConsoleCollector(page);
    const pagesLoaded = [];

    try {
      await loginAs(page, users.technician);
      pagesLoaded.push('Dashboard');

      await page.getByRole('link', { name: /new inspection/i }).click();
      await expect(page.getByRole('heading', { name: /vehicle inspection/i })).toBeVisible();
      pagesLoaded.push('VehicleInspection');

      await page.getByPlaceholder('J12345678').fill(makeJobCard());
      await page.getByPlaceholder('Customer Name').fill('E2E Inspection Customer');
      await page.getByPlaceholder('Vehicle Registration').fill('E2ETST');
      await page.getByPlaceholder('Vehicle Make / Model').fill('Toyota Test');
      await page.getByPlaceholder('Odometer Reading').fill('12345');

      const technicianName = page.getByPlaceholder('Technician Name');
      if (!(await technicianName.inputValue())) {
        await technicianName.fill('E2E Technician');
      }

      await page.getByRole('button', { name: /submit to service advisor/i }).click();
      await expect(page.getByRole('heading', { name: /parts requests/i })).toBeVisible();
      pagesLoaded.push('Dashboard after inspection submit');

      await expect(page.locator('body')).not.toHaveText(/failed/i);
      expect(consoleErrors).toEqual([]);
    } finally {
      appendReport({
        role: 'Technician workflow: vehicle inspection',
        loginSuccess: true,
        pagesLoaded,
        consoleErrors,
      });
      await logout(page);
    }
  });

  test('technician can create a parts request', async ({ page }) => {
    const consoleErrors = createConsoleCollector(page);
    const pagesLoaded = [];
    const jobCard = makeJobCard();

    try {
      await loginAs(page, users.technician);
      pagesLoaded.push('Dashboard');

      await page.getByRole('link', { name: /new request/i }).click();
      await expect(page.getByRole('heading', { name: /new parts request/i })).toBeVisible();
      pagesLoaded.push('PartsRequestForm');

      await page.getByLabel(/job card number/i).fill(jobCard);
      await addFirstPart(page);
      await page.getByRole('button', { name: /submit request/i }).click();

      await expect(page.getByRole('heading', { name: new RegExp(`job #${jobCard}`, 'i') })).toBeVisible();
      pagesLoaded.push('RequestDetail');

      await ensureHealthyPage(page);
      expect(consoleErrors).toEqual([]);
    } finally {
      appendReport({
        role: 'Technician workflow: parts request',
        loginSuccess: true,
        pagesLoaded,
        consoleErrors,
      });
      await logout(page);
    }
  });

  test('parts interpreter can view submitted requests', async ({ page }) => {
    const consoleErrors = createConsoleCollector(page);
    const pagesLoaded = [];

    try {
      await loginAs(page, users.parts_interpreter);
      pagesLoaded.push('Dashboard');

      await page.getByRole('tab', { name: /sent to parts/i }).click();
      await expect(page.getByText(/sent to parts|no requests/i)).toBeVisible();
      pagesLoaded.push('Sent to Parts queue');

      await ensureHealthyPage(page);
      expect(consoleErrors).toEqual([]);
    } finally {
      appendReport({
        role: 'Parts Interpreter workflow',
        loginSuccess: true,
        pagesLoaded,
        consoleErrors,
      });
      await logout(page);
    }
  });

  test('workshop controller can view quoted request queue', async ({ page }) => {
    const consoleErrors = createConsoleCollector(page);
    const pagesLoaded = [];

    try {
      await loginAs(page, users.workshop_controller);
      pagesLoaded.push('Dashboard');

      await page.getByRole('tab', { name: /needs review/i }).click();
      await expect(page.getByText(/needs review|no requests/i)).toBeVisible();
      pagesLoaded.push('Quoted requests queue');

      await ensureHealthyPage(page);
      expect(consoleErrors).toEqual([]);
    } finally {
      appendReport({
        role: 'Workshop Controller workflow',
        loginSuccess: true,
        pagesLoaded,
        consoleErrors,
      });
      await logout(page);
    }
  });

  test('service advisor can view submitted inspections and recommendations', async ({ page }) => {
    const consoleErrors = createConsoleCollector(page);
    const pagesLoaded = [];

    try {
      await loginAs(page, users.service_advisor);
      pagesLoaded.push('Dashboard');

      await expect(page.getByText(/vehicle inspections/i)).toBeVisible();
      await expect(page.getByText(/upsells\/recommendations/i)).toBeVisible();
      pagesLoaded.push('Advisor dashboard queues');

      await ensureHealthyPage(page);
      expect(consoleErrors).toEqual([]);
    } finally {
      appendReport({
        role: 'Service Advisor workflow',
        loginSuccess: true,
        pagesLoaded,
        consoleErrors,
      });
      await logout(page);
    }
  });
});
