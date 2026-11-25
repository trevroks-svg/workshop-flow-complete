import { test, expect } from '@playwright/test';
import {
  TEST_USERS,
  createConsoleCollector,
  ensureHealthyPage,
  getVisibleMenuItems,
  loginAs,
  logout,
} from './helpers/auth.js';
import { appendReport } from './helpers/report.js';

test.describe.serial('role dashboard access', () => {
  for (const user of TEST_USERS) {
    test(`${user.label} can log in and see a healthy dashboard`, async ({ page }) => {
      const consoleErrors = createConsoleCollector(page);
      const pagesLoaded = [];
      let menuItems = [];
      let loginSuccess = false;

      try {
        await loginAs(page, user);
        loginSuccess = true;
        pagesLoaded.push('Dashboard');

        await ensureHealthyPage(page);
        menuItems = await getVisibleMenuItems(page);

        expect(menuItems).toContain('Job History Search');
        expect(consoleErrors).toEqual([]);
      } finally {
        appendReport({
          role: user.label,
          loginSuccess,
          menuItems,
          pagesLoaded,
          consoleErrors,
        });

        if (loginSuccess) {
          await logout(page);
        }
      }
    });
  }
});
