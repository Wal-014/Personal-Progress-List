import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
            assert.doesNotMatch(run[2], /\$\{\{\s*secrets\./);
            runIndent = line.indexOf('run:');
        } else if (runIndent !== null && line.trim()) {
            if (line.search(/\S/) > runIndent) {
                assert.doesNotMatch(line, /\$\{\{\s*secrets\./);
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
    const mask = step.match(/^\s*echo "::add-mask::\$password"\s*$/m);
    assert.ok(mask, 'The password must be registered as a log mask');
    const firstDump = step.indexOf('supabase db dump');
    assert.ok(firstDump > mask.index, 'The password must be masked before the first dump');
});

test('backup dump diagnostics are not redirected to /dev/null', () => {
    const step = workflow().split(/^ {6}- /m).find(step => step.startsWith('name: Dump and encrypt database\n'));
    assert.ok(step, 'The dump step must exist');
    assert.doesNotMatch(step, /2>\s*(?:\/dev\/null|&1)/);
});
