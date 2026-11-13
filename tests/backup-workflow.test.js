import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const workflowPath = new URL('../.github/workflows/backup.yml', import.meta.url);
const recipientsPath = new URL('../supabase/backup-recipients.txt', import.meta.url);
const workflow = () => readFileSync(workflowPath, 'utf8').replace(/\r\n/g, '\n');

test('backup actions are pinned to full commit SHAs', () => {
    const actions = [...workflow().matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)/gm)];
    assert.ok(actions.length > 0, 'The workflow must use pinned actions');
    for (const [, action] of actions) {
        assert.match(action, /^[^@]+@[a-f0-9]{40}$/);
    }
});

test('backup run scripts never interpolate secrets directly', () => {
    const lines = workflow().split('\n');
    let runIndent = null;
    for (const line of lines) {
        const run = line.match(/^(\s*)(?:-\s+)?run:\s*(.*)$/);
        if (run) {
            assert.doesNotMatch(run[2], /\$\{\{/);
            runIndent = line.indexOf('run:');
        } else if (runIndent !== null && line.trim()) {
            if (line.search(/\S/) > runIndent) {
                assert.doesNotMatch(line, /\$\{\{/);
            } else {
                runIndent = null;
            }
        }
    }
});

test('backup top-level permissions grant only contents read', () => {
    const permissions = workflow().match(/^permissions:\n((?:[ \t]+[^\n]*\n)+)/m);
    assert.ok(permissions, 'Top-level permissions must be explicit');
    assert.equal(permissions[1].trim(), 'contents: read');
});

test('backup artifact upload includes only encrypted files', () => {
    const steps = workflow().split(/^ {6}- /m);
    const uploads = steps.filter(step => /uses:\s*actions\/upload-artifact@/.test(step));
    assert.equal(uploads.length, 1);
    const paths = [...uploads[0].matchAll(/^\s+path:\s*(.+)$/gm)];
    assert.equal(paths.length, 1);
    assert.match(paths[0][1].trim(), /^[^\n]*\.age$/);
    assert.match(uploads[0], /^\s+retention-days: 90\s*$/m);
});

test('backup recipients contain only age public keys and comments', () => {
    const recipients = readFileSync(recipientsPath, 'utf8');
    for (const line of recipients.split(/\r?\n/)) {
        if (line.trim() && !line.startsWith('#')) assert.match(line, /^age1/);
    }
});

test('backup masks the database password before dumping', () => {
    const step = workflow().split(/^ {6}- /m).find(step => step.startsWith('name: Dump and encrypt database\n'));
    assert.ok(step, 'The dump step must exist');
    const mask = step.match(/^\s*printf '::add-mask::%s\\n' "\$\{BACKUP_DB_PASSWORD\/\/%\/%25\}"\s*$/m);
    assert.ok(mask, 'The password must be registered as a log mask');
    const firstDump = step.indexOf('supabase db dump');
    assert.ok(firstDump > mask.index, 'The password must be masked before the first dump');
    assert.ok(step.indexOf('prepare_backup_db_url') < mask.index, 'Clean the URL before extracting its password mask');
});

test('backup checks and dumps with the shared URL preparation function', () => {
    const content = workflow();
    assert.ok(content.indexOf('uses: actions/checkout@') < content.indexOf('name: Check database secret'));
    for (const name of ['Check database secret', 'Dump and encrypt database']) {
        const step = content.split(/^ {6}- /m).find(step => step.startsWith(`name: ${name}\n`));
        assert.match(step, /source scripts\/backup-db-url\.sh\n\s+prepare_backup_db_url/);
    }
    assert.doesNotMatch(content, /GITHUB_ENV/);
});

const bashProbe = spawnSync('bash', ['--noprofile', '--norc', '-c', 'exit 0'], { encoding: 'utf8' });
const bashSkip = bashProbe.error || bashProbe.status !== 0
    ? `Bash is unavailable: ${bashProbe.error?.message || bashProbe.stderr.trim() || `exit ${bashProbe.status}`}`
    : false;
const validPassword = 's3cret%40%23%25%3F%2F%20%0A';
const validUrl = `postgresql://postgres.project:${validPassword}@pooler.example.com:5432/postgres`;

function prepareUrl(url, expectedUrl = validUrl, expectedPassword = validPassword) {
    return spawnSync('bash', ['--noprofile', '--norc', '-s'], {
        cwd: new URL('..', import.meta.url),
        encoding: 'utf8',
        env: { ...process.env, SUPABASE_DB_URL: url, EXPECTED_URL: expectedUrl, EXPECTED_PASSWORD: expectedPassword },
        input: 'set -euo pipefail\nsource scripts/backup-db-url.sh\nprepare_backup_db_url\n[[ "$SUPABASE_DB_URL" == "$EXPECTED_URL" && "$BACKUP_DB_PASSWORD" == "$EXPECTED_PASSWORD" ]]\n'
    });
}

for (const [name, value] of [
    ['valid URL', validUrl],
    ['trailing newline', `${validUrl}\n`],
    ['CR and LF anywhere', validUrl.replace('project:', 'pro\r\nject:')],
    ['surrounding whitespace', ` \t${validUrl} \t`],
    ['double quotes', `"${validUrl}"`],
    ['single quotes', `'${validUrl}'`],
    ['quotes with surrounding whitespace', ` \t"${validUrl}"\r\n `]
]) {
    test(`backup URL preparation accepts ${name}`, { skip: bashSkip }, () => {
        const result = prepareUrl(value);
        assert.equal(result.status, 0, result.stderr || result.stdout);
        assert.equal(result.stdout + result.stderr, '', 'Successful preparation must not print credentials');
    });
}

test('backup URL preparation accepts the postgres scheme', { skip: bashSkip }, () => {
    const value = validUrl.replace('postgresql://', 'postgres://');
    assert.equal(prepareUrl(value, value).status, 0);
});

test('backup URL preparation accepts a plain password and placeholder text outside it', { skip: bashSkip }, () => {
    const value = 'postgresql://PASSWORD:private123@pooler.example.com:5432/CONTRASENA';
    const result = prepareUrl(value, value, 'private123');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(result.stdout + result.stderr, '');
});

const encodingError = '::error::SUPABASE_DB_URL: the password contains characters that must be percent-encoded (for example @ → %40, # → %23, % → %25)';
for (const [name, password, value, errors] of [
    ...['#', '?', '/', '@', ' ', '\t', '%', '%2', '%GG'].map(character => [
        `unencoded ${JSON.stringify(character)}`, `private${character}tail`,
        `postgresql://postgres.project:private${character}tail@pooler.example.com:5432/postgres`, [encodingError]
    ]),
    ['missing port', validPassword, validUrl.replace(':5432', ''), ['::error::SUPABASE_DB_URL port must be non-empty and contain only digits.']],
    ['non-numeric port', validPassword, validUrl.replace(':5432', ':abc'), ['::error::SUPABASE_DB_URL port must be non-empty and contain only digits.']],
    ['missing user', validPassword, validUrl.replace('postgres.project:', ':'), ['::error::SUPABASE_DB_URL user must be non-empty and contain no URL delimiters or whitespace.']],
    ['missing password', '', validUrl.replace(validPassword, ''), ['::error::SUPABASE_DB_URL password must be non-empty.']],
    ['missing host', validPassword, validUrl.replace('pooler.example.com', ''), ['::error::SUPABASE_DB_URL host must be non-empty and contain no URL delimiters or whitespace.']],
    ['missing database', validPassword, validUrl.slice(0, -'postgres'.length), ['::error::SUPABASE_DB_URL database must be non-empty and contain no path/query delimiters or whitespace.']],
    ['wrong scheme', validPassword, validUrl.replace('postgresql://', 'https://'), ['::error::SUPABASE_DB_URL scheme must start with postgresql:// or postgres://.']],
    ...['CONTRASENA', 'PASSWORD', 'YOUR-PASSWORD'].map(password => [
        `placeholder ${password}`, password, validUrl.replace(validPassword, password), ['::error::SUPABASE_DB_URL password contains a placeholder; replace it with the percent-encoded database password.']
    ]),
    ['multiple problems', 'PASSWORD#tail', 'https://postgres.project:PASSWORD#tail@pooler.example.com/postgres', [
        '::error::SUPABASE_DB_URL scheme must start with postgresql:// or postgres://.', encodingError,
        '::error::SUPABASE_DB_URL password contains a placeholder; replace it with the percent-encoded database password.',
        '::error::SUPABASE_DB_URL port must be non-empty and contain only digits.'
    ]],
    ['missing credentials', '', 'postgresql://pooler.example.com:5432/postgres', ['::error::SUPABASE_DB_URL user/password section must have the shape <user>:<password>@.']]
]) {
    test(`backup URL preparation rejects ${name} without exposing credentials`, { skip: bashSkip }, () => {
        const result = prepareUrl(value);
        assert.equal(result.status, 1, result.stderr || result.stdout);
        const lines = (result.stdout + result.stderr).trim().split(/\r?\n/);
        assert.deepEqual(lines.sort(), [...errors].sort());
        for (const line of lines) {
            assert.ok(line.startsWith('::error::'));
            if (password) assert.ok(!line.includes(password), 'Diagnostics must not contain the password');
            assert.ok(!line.includes(value), 'Diagnostics must not contain the URL');
        }
    });
}

test('backup dump diagnostics are not redirected to /dev/null', () => {
    const step = workflow().split(/^ {6}- /m).find(step => step.startsWith('name: Dump and encrypt database\n'));
    assert.ok(step, 'The dump step must exist');
    assert.doesNotMatch(step, /2>\s*(?:\/dev\/null|&1)/);
});
