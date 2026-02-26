import fs from 'node:fs';
import path from 'node:path';
import {execSync} from 'node:child_process';

const projectRoot = process.cwd();
const siteDir = path.join(projectRoot, 'site');
const buildDir = path.join(projectRoot, 'build');

function run(command, cwd = projectRoot) {
    console.log(`\n> ${command}`);
    execSync(command, {
        cwd,
        stdio: 'inherit',
    });
}

function getNewestZipFile() {
    if (!fs.existsSync(buildDir)) {
        throw new Error('Build directory not found. Expected `build/`.');
    }

    const candidates = fs
        .readdirSync(buildDir)
        .filter(file => file.toLowerCase().endsWith('.zip'))
        .map(file => {
            const fullPath = path.join(buildDir, file);
            const stat = fs.statSync(fullPath);

            return {file, mtimeMs: stat.mtimeMs};
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);

    if (!candidates.length) {
        throw new Error('No extension zip found in `build/`.');
    }

    return candidates[0].file;
}

function main() {
    console.log('Preparing a clean EspoCRM instance for packaged-install E2E tests...');

    // Fetch fresh site sources and install composer deps for test tooling.
    run('node build --prepare-test');

    // Install a clean Espo instance without copying extension source files.
    run('node build --install');

    // Build the real installable extension artifact.
    run('node build --extension');

    const zipFile = getNewestZipFile();

    console.log(`\nInstalling packaged extension artifact: ${zipFile}`);
    run(`php command.php extension --file="../build/${zipFile}"`, siteDir);

    // Keep metadata/cache in a deterministic state before browser tests run.
    run('php command.php rebuild', siteDir);

    console.log('\nPackaged-install E2E environment is ready.');
}

main();
