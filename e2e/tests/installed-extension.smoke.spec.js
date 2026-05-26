import {test, expect} from '@playwright/test';

const adminUsername = process.env.ESPO_E2E_ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ESPO_E2E_ADMIN_PASSWORD || '1';

async function login(page) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const usernameInput = page.locator('#field-userName');

    try {
        await usernameInput.waitFor({state: 'visible', timeout: 10_000});
    } catch {
        return;
    }

    await usernameInput.fill(adminUsername);
    await page.locator('#field-password').fill(adminPassword);

    await page.locator('#btn-login').click();

    await page.waitForSelector('#field-userName', {
        state: 'hidden',
        timeout: 15_000,
    });

    await page.waitForLoadState('networkidle');
}

test('extension appears in admin extensions page', async ({page}) => {
    await login(page);

    await page.goto('/#Admin/extensions');

    await expect(page.getByText('GeoSpatial', {exact: true})).toBeVisible();
});
