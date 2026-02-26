import {test, expect} from '@playwright/test';

const adminUsername = process.env.ESPO_E2E_ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ESPO_E2E_ADMIN_PASSWORD || '1';

async function login(page) {
    await page.goto('/#Login');

    const usernameInput = page.locator('input[name="username"]');

    if (!(await usernameInput.isVisible())) {
        return;
    }

    await usernameInput.fill(adminUsername);
    await page.locator('input[name="password"]').fill(adminPassword);

    const submitButton = page
        .locator('button[type="submit"], .btn.btn-primary')
        .first();

    await submitButton.click();
    await expect(page).not.toHaveURL(/#Login/);
}

test('extension appears in admin extensions page', async ({page}) => {
    await login(page);

    await page.goto('/#Admin/extensions');

    await expect(page.getByText('GeoSpatial')).toBeVisible();
});
