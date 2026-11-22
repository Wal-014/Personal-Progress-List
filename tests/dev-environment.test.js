import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DEV_ORIGIN = 'https://ppl-dev.waquermaster.workers.dev';
const PRODUCTION_ORIGIN = 'https://wal-014.github.io';

// Only whole-line comments are dropped: the URLs inside the values contain `//`
const readJsonc = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\s*\/\/.*$/gm, ''));

test('the dev site Worker serves the built site at the dev URL', () => {
    const config = readJsonc('dev-site/wrangler.jsonc');
    assert.equal(config.name, 'ppl-dev');
    assert.equal(new URL(DEV_ORIGIN).host, `${config.name}.waquermaster.workers.dev`);
    assert.equal(resolve(dirname('dev-site/wrangler.jsonc'), config.assets.directory), resolve('_site'));
    assert.equal(config.main, undefined, 'an assets-only Worker runs no code');
    assert.equal(config.workers_dev, true);
});

test('the relay allows the production and dev sites', () => {
    const { vars } = readJsonc('relay/wrangler.jsonc');
    assert.deepEqual(vars.ALLOWED_ORIGINS.split(','), [PRODUCTION_ORIGIN, DEV_ORIGIN]);
});

const ci = () => readFileSync('.github/workflows/ci.yml', 'utf8').replace(/\r\n/g, '\n');
const jobNames = yaml => [...yaml.split(/^jobs:\n/m)[1].matchAll(/^ {2}([\w-]+):$/gm)].map(([, name]) => name);
const job = (yaml, name) => yaml.match(new RegExp(`^ {2}${name}:\n((?: {4}.*\n|\n)+)`, 'm'))?.[1] ?? '';
const jobIf = (yaml, name) => job(yaml, name).match(/^ {4}if: (.*)$/m)?.[1];

test('ci actions are pinned to commit SHAs', () => {
    const actions = [...ci().matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)/gm)];
    assert.ok(actions.length > 0);
    for (const [, action] of actions)
        assert.match(action, /^[^@]+@[a-f0-9]{40}$/);
});

test('ci run scripts never interpolate expressions', () => {
    let runIndent = null;
    for (const line of ci().split('\n')) {
        const run = line.match(/^(\s*)(?:-\s+)?run:\s*(.*)$/);
        if (run) {
            assert.doesNotMatch(run[2], /\$\{\{/);
            runIndent = line.indexOf('run:');
        }
        else if (runIndent !== null && line.trim()) {
            if (line.search(/\S/) > runIndent)
                assert.doesNotMatch(line, /\$\{\{/);
            else
                runIndent = null;
        }
    }
});

test('ci runs on pushes to main and development', () => {
    assert.match(ci(), /^ {2}push:\n {4}branches: \[main, development\]$/m);
});

test('jobs that read secrets never run for pull requests', () => {
    const yaml = ci(), readers = jobNames(yaml).filter(name => job(yaml, name).includes('secrets.'));
    assert.deepEqual(readers.sort(), ['deploy-dev', 'migrate-prod']);
    for (const name of readers) {
        assert.match(jobIf(yaml, name), /github\.event_name != 'pull_request'/, name);
        assert.match(jobIf(yaml, name), /github\.ref == 'refs\/heads\/(main|development)'/, name);
    }
});

test('deploy-dev builds the dev site and deploys it from development', () => {
    const yaml = ci(), steps = job(yaml, 'deploy-dev');
    assert.match(jobIf(yaml, 'deploy-dev'), /refs\/heads\/development/);
    assert.match(steps, /^ {6}name: development$/m);
    assert.match(steps, /npm run site -- development/);
    assert.match(steps, /wrangler deploy --config dev-site\/wrangler\.jsonc/);
    assert.doesNotMatch(steps, /PRODUCTION_RELEASE|fetch-depth: 0\b/);
});

test('deploy checks out full history and flags the site build as a production release', () => {
    const steps = job(ci(), 'deploy');
    assert.match(steps, /^ {6}- uses: actions\/checkout@[^\n]+\n {8}with:\n(?: {10}[^\n]+\n)* {10}fetch-depth: 0$/m);
    assert.match(steps, /^ {6}- run: npm run site\n {8}env:\n {10}PRODUCTION_RELEASE: "true"$/m);
});

test('the production deploy waits for the production migrations', () => {
    const yaml = ci();
    assert.match(job(yaml, 'deploy'), /^ {4}needs: \[ci, db, migrate-prod\]$/m);
    assert.equal(jobIf(yaml, 'migrate-prod'), jobIf(yaml, 'deploy'), 'the daily scheduled deploy must not be skipped');
    assert.match(jobIf(yaml, 'deploy'), /refs\/heads\/main/);
    assert.match(job(yaml, 'migrate-prod'), /supabase db push --db-url "\$SUPABASE_DB_URL"/);
});

test('dependabot updates go to development first', () => {
    const config = readFileSync('.github/dependabot.yml', 'utf8');
    const ecosystems = config.match(/package-ecosystem:/g).length;
    assert.equal(config.match(/^ {4}target-branch: development$/gm)?.length, ecosystems);
});
