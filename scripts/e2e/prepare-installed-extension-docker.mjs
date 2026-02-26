import fs from 'node:fs';
import path from 'node:path';
import {execSync} from 'node:child_process';

const projectRoot = process.cwd();
const configPath = path.join(projectRoot, 'config.json');

function run(command) {
    console.log(`\n> ${command}`);
    execSync(command, {
        cwd: projectRoot,
        stdio: 'inherit',
    });
}

function writeDockerConfig() {
    const config = {
        espocrm: {
            repository: 'https://github.com/espocrm/espocrm.git',
            branch: 'stable',
        },
        database: {
            host: process.env.E2E_DB_HOST || 'db',
            port: null,
            charset: 'utf8mb4',
            dbname: process.env.E2E_DB_NAME || 'ext-geo-spatial',
            user: process.env.E2E_DB_USER || 'espocrm',
            password: process.env.E2E_DB_PASSWORD || 'espocrm',
        },
        install: {
            language: 'en_US',
            defaultOwner: 'www-data',
            defaultGroup: 'www-data',
            siteUrl: process.env.E2E_SITE_URL || 'http://localhost:8080',
            adminUsername: process.env.E2E_ADMIN_USERNAME || 'admin',
            adminPassword: process.env.E2E_ADMIN_PASSWORD || '1',
        },
    };

    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function main() {
    console.log('Preparing Dockerized packaged-install E2E environment...');

    writeDockerConfig();

    run('docker compose up -d --build db app');
    run('docker compose exec -T app sh -lc "npm ci"');
    run('docker compose exec -T app sh -lc "node scripts/e2e/prepare-installed-extension.mjs"');

    console.log('\nDockerized packaged-install E2E environment is ready.');
}

main();
