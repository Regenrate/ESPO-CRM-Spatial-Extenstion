import {defineConfig} from '@playwright/test';

const baseURL = process.env.ESPO_E2E_BASE_URL || 'http://127.0.0.1:8080';

export default defineConfig({
    testDir: './e2e/tests',
    timeout: 60_000,
    expect: {
        timeout: 10_000,
    },
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [['list'], ['html', {open: 'never'}]] : 'list',
    use: {
        baseURL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: {
                browserName: 'chromium',
                headless: true,
            },
        },
    ],
});
