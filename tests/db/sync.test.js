import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';
import { createTestContext, enabled, ok } from './helpers.js';

const context = enabled ? createTestContext() : null;
after(async () => context?.cleanup());

const tables = [
    'user_settings', 'levels', 'level_notes', 'level_tags',
    'list_orders', 'wishlists', 'wishlist_items', 'tags'
];

const initialChanges = [
    { table: 'levels', key: { id: 'level' }, version: null, row: { id: 'level', kind: 'classic', name: 'Level', attempts_normal: 10 } },
    { table: 'level_notes', key: { level_id: 'level' }, version: null, row: { level_id: 'level', notes: 'Private notes' } },
    { table: 'tags', key: { name: 'Practice' }, version: null, row: { name: 'Practice', color: '#abcdef' } },
    { table: 'level_tags', key: { level_id: 'level', tag_name: 'Practice' }, version: null, row: { level_id: 'level', tag_name: 'Practice', position: 1 } },
    { table: 'list_orders', key: { kind: 'classic' }, version: null, row: { kind: 'classic', level_ids: ['level'] } },
    { table: 'wishlists', key: { id: 'wishlist' }, version: null, row: { id: 'wishlist', name: 'Wishlist', item_ids: ['item'] } },
    { table: 'wishlist_items', key: { id: 'item' }, version: null, row: { id: 'item', wishlist_id: 'wishlist', name: 'Item', level_id: 123456789 } },
    { table: 'user_settings', key: {}, version: null, row: { lang: 'en', theme: 'blue' } }
];

describe('versioned database sync', { skip: !enabled }, () => {
    test('an empty pull returns the profile, empty arrays and a stable revision', async () => {
        const { id, client } = await context.createUser();
        const revision = ok(await client.rpc('sync_revision'));
        assert.match(revision, /^[0-9a-f]{32}$/);
        const pulled = ok(await client.rpc('sync_pull'));
        assert.deepEqual(pulled.profile, ok(await client.from('profiles').select('*').eq('id', id).single()));
        for (const table of tables) assert.deepEqual(pulled[table], []);
        assert.equal(pulled.revision, revision);
        assert.equal(ok(await client.rpc('sync_revision')), revision);
        const pushed = ok(await client.rpc('sync_push', { changes: [] }));
        assert.deepEqual(pushed, { applied: [], conflicts: [], rejected: [], previous_revision: revision, revision });
    });

    test('every table round-trips with server versions, defaults and all columns', async () => {
        const { id, client } = await context.createUser();
        const before = ok(await client.rpc('sync_revision'));
        const pushed = ok(await client.rpc('sync_push', { changes: initialChanges }));
        assert.deepEqual(pushed.applied, initialChanges.map(({ table, key }) => ({ table, key, version: 1 })));
        assert.deepEqual(pushed.conflicts, []);
        assert.deepEqual(pushed.rejected, []);
        assert.notEqual(pushed.revision, before);
        assert.equal(pushed.previous_revision, before);
        assert.equal(pushed.revision, ok(await client.rpc('sync_revision')));
        const pulled = ok(await client.rpc('sync_pull'));
        assert.equal(pulled.revision, pushed.revision);
        for (const { table, row } of initialChanges) {
            assert.equal(pulled[table].length, 1, table);
            const stored = pulled[table][0];
            assert.deepEqual(stored, ok(await client.from(table).select('*').eq('user_id', id).single()));
            for (const [column, value] of Object.entries(row)) assert.deepEqual(stored[column], value, `${table}.${column}`);
            assert.equal(stored.user_id, id);
            assert.equal(stored.version, 1);
            assert.ok(stored.created_at);
            assert.equal(stored.updated_at, stored.created_at);
        }
        assert.deepEqual(pulled.levels[0].deaths, {});
        assert.equal(pulled.wishlist_items[0].status, 'todo');
        assert.equal(pulled.wishlist_items[0].enrich_checked, false);
        assert.equal(pulled.tags[0].position, 0);

        const edits = [
            { table: 'levels', key: { id: 'level' }, version: 1, row: { id: 'level', name: 'Updated level' } },
            { table: 'level_notes', key: { level_id: 'level' }, version: 1, row: { level_id: 'level', notes: 'Updated notes' } },
            { table: 'tags', key: { name: 'Practice' }, version: 1, row: { name: 'Practice', color: '#123456' } },
            { table: 'level_tags', key: { level_id: 'level', tag_name: 'Practice' }, version: 1, row: { level_id: 'level', tag_name: 'Practice', position: 2 } },
            { table: 'list_orders', key: { kind: 'classic' }, version: 1, row: { kind: 'classic', level_ids: [] } },
            { table: 'wishlists', key: { id: 'wishlist' }, version: 1, row: { id: 'wishlist', name: 'Updated wishlist' } },
            { table: 'wishlist_items', key: { id: 'item' }, version: 1, row: { id: 'item', status: 'prog', progress: 42 } },
            { table: 'user_settings', key: {}, version: 1, row: { theme: 'night' } }
        ];
        const updated = ok(await client.rpc('sync_push', { changes: edits }));
        assert.deepEqual(updated.applied, edits.map(({ table, key }) => ({ table, key, version: 2 })));
        assert.deepEqual(updated.conflicts, []);
        assert.deepEqual(updated.rejected, []);
        assert.notEqual(updated.revision, pushed.revision);
        assert.equal(updated.previous_revision, pushed.revision);
        const after = ok(await client.rpc('sync_pull'));
        assert.equal(after.revision, updated.revision);
        for (const { table, row } of edits) {
            const stored = after[table][0];
            assert.equal(stored.version, 2, table);
            assert.equal(stored.created_at, pulled[table][0].created_at);
            for (const [column, value] of Object.entries(row)) assert.deepEqual(stored[column], value, `${table}.${column}`);
        }
        assert.equal(after.levels[0].kind, 'classic');
        assert.equal(after.levels[0].attempts_normal, 10);
        assert.equal(after.user_settings[0].lang, 'en');
    });

    test('stale updates and duplicate inserts return the current row unchanged', async () => {
        const { id, client } = await context.createUser();
        const inserted = ok(await client.rpc('sync_push', { changes: [initialChanges[0]] }));
        assert.deepEqual(inserted.applied, [{ table: 'levels', key: { id: 'level' }, version: 1 }]);
        const updated = ok(await client.rpc('sync_push', { changes: [
            { table: 'levels', key: { id: 'level' }, version: 1, row: { id: 'level', name: 'Current', attempts_normal: null } }
        ] }));
        assert.deepEqual(updated.applied, [{ table: 'levels', key: { id: 'level' }, version: 2 }]);
        const current = ok(await client.from('levels').select('*').eq('user_id', id).eq('id', 'level').single());
        assert.equal(current.name, 'Current');
        assert.equal(current.attempts_normal, null);
        for (const version of [1, null]) {
            const result = ok(await client.rpc('sync_push', { changes: [
                { table: 'levels', key: { id: 'level' }, version, row: { id: 'level', kind: 'classic', name: 'Stale' } }
            ] }));
            assert.deepEqual(result.applied, []);
            assert.deepEqual(result.rejected, []);
            assert.deepEqual(result.conflicts, [{ table: 'levels', key: { id: 'level' }, row: current }]);
            assert.equal(result.revision, updated.revision);
            assert.deepEqual(ok(await client.from('levels').select('*').eq('user_id', id).eq('id', 'level').single()), current);
        }
    });

    test('deletes require the current version and are idempotent once the row is gone', async () => {
        const { id, client } = await context.createUser();
        ok(await client.rpc('sync_push', { changes: [initialChanges[0]] }));
        ok(await client.rpc('sync_push', { changes: [
            { table: 'levels', key: { id: 'level' }, version: 1, row: { id: 'level', name: 'Current' } }
        ] }));
        const current = ok(await client.from('levels').select('*').eq('user_id', id).eq('id', 'level').single());
        const stale = ok(await client.rpc('sync_push', { changes: [
            { table: 'levels', key: { id: 'level' }, version: 1, row: null }
        ] }));
        assert.deepEqual(stale.applied, []);
        assert.deepEqual(stale.rejected, []);
        assert.deepEqual(stale.conflicts, [{ table: 'levels', key: { id: 'level' }, row: current }]);
        assert.deepEqual(ok(await client.from('levels').select('*').eq('user_id', id).eq('id', 'level').single()), current);
        const deleted = ok(await client.rpc('sync_push', { changes: [
            { table: 'levels', key: { id: 'level' }, version: 2, row: null }
        ] }));
        assert.deepEqual(deleted.applied, [{ table: 'levels', key: { id: 'level' }, version: null }]);
        assert.deepEqual(deleted.conflicts, []);
        assert.deepEqual(deleted.rejected, []);
        assert.deepEqual(ok(await client.from('levels').select('*').eq('user_id', id)), []);
        const repeated = ok(await client.rpc('sync_push', { changes: [
            { table: 'levels', key: { id: 'level' }, version: 2, row: null }
        ] }));
        assert.deepEqual(repeated, { ...deleted, previous_revision: deleted.revision });
        const missing = ok(await client.rpc('sync_push', { changes: [
            { table: 'levels', key: { id: 'level' }, version: 2, row: { id: 'level', name: 'Missing' } }
        ] }));
        assert.deepEqual(missing.applied, []);
        assert.deepEqual(missing.rejected, []);
        assert.deepEqual(missing.conflicts, [{ table: 'levels', key: { id: 'level' }, row: null }]);
    });

    test('changes in a batch observe earlier writes to the same key', async () => {
        const { id, client } = await context.createUser();
        const result = ok(await client.rpc('sync_push', { changes: [
            initialChanges[0],
            { table: 'levels', key: { id: 'level' }, version: 1, row: { id: 'level', name: 'Second' } },
            { table: 'levels', key: { id: 'level' }, version: 2, row: null }
        ] }));
        assert.deepEqual(result.applied, [
            { table: 'levels', key: { id: 'level' }, version: 1 },
            { table: 'levels', key: { id: 'level' }, version: 2 },
            { table: 'levels', key: { id: 'level' }, version: null }
        ]);
        assert.deepEqual(result.conflicts, []);
        assert.deepEqual(result.rejected, []);
        assert.deepEqual(ok(await client.from('levels').select('*').eq('user_id', id)), []);
    });

    test('user_settings accepts empty rows without inventing a key or losing defaults', async () => {
        const { id, client } = await context.createUser();
        const inserted = ok(await client.rpc('sync_push', { changes: [
            { table: 'user_settings', key: {}, version: null, row: {} }
        ] }));
        assert.deepEqual(inserted.applied, [{ table: 'user_settings', key: {}, version: 1 }]);
        assert.deepEqual(inserted.conflicts, []);
        assert.deepEqual(inserted.rejected, []);
        const stored = ok(await client.rpc('sync_pull')).user_settings[0];
        assert.equal(stored.user_id, id);
        assert.equal(stored.lang, null);
        assert.equal(stored.theme, null);
        const updated = ok(await client.rpc('sync_push', { changes: [
            { table: 'user_settings', key: {}, version: 1, row: {} }
        ] }));
        assert.deepEqual(updated.applied, [{ table: 'user_settings', key: {}, version: 2 }]);
        assert.deepEqual(updated.conflicts, []);
        assert.deepEqual(updated.rejected, []);
        const pulled = ok(await client.rpc('sync_pull')).user_settings[0];
        assert.equal(pulled.version, 2);
        assert.equal(pulled.lang, null);
        assert.equal(pulled.theme, null);
        assert.equal(pulled.created_at, stored.created_at);
    });

    test('a constraint failure rejects only its change and preserves valid neighbors', async () => {
        const { id, client } = await context.createUser();
        const result = ok(await client.rpc('sync_push', { changes: [
            { table: 'tags', key: { name: 'Before' }, version: null, row: { name: 'Before', color: '#abcdef' } },
            { table: 'tags', key: { name: 'Invalid' }, version: null, row: { name: 'Invalid', color: 'red' } },
            { table: 'tags', key: { name: 'After' }, version: null, row: { name: 'After', color: '#123456' } }
        ] }));
        assert.deepEqual(result.applied, [
            { table: 'tags', key: { name: 'Before' }, version: 1 },
            { table: 'tags', key: { name: 'After' }, version: 1 }
        ]);
        assert.deepEqual(result.conflicts, []);
        assert.equal(result.rejected.length, 1);
        assert.deepEqual({ ...result.rejected[0], message: undefined }, {
            table: 'tags', key: { name: 'Invalid' }, code: '23514', message: undefined
        });
        assert.match(result.rejected[0].message, /check constraint/);
        assert.deepEqual(ok(await client.from('tags').select('name').eq('user_id', id).order('name')), [{ name: 'After' }, { name: 'Before' }]);
        assert.equal(result.revision, ok(await client.rpc('sync_revision')));
    });

    test('invalid change shapes and forbidden columns are rejected before any write', async () => {
        const { id, client } = await context.createUser();
        const before = ok(await client.rpc('sync_revision'));
        const invalid = [
            { table: 'profiles', key: { id }, version: null, row: { id, display_name: 'Forbidden' } },
            { table: 'private.write_budget', key: {}, version: 1, row: null },
            { table: 'unknown', key: {}, version: null, row: {} },
            { table: 'levels', key: { level_id: 'level' }, version: null, row: { id: 'level', kind: 'classic', name: 'Wrong key' } },
            { table: 'levels', key: {}, version: null, row: { id: 'level', kind: 'classic', name: 'Missing key' } },
            { table: 'levels', key: { id: 'level', extra: true }, version: null, row: { id: 'level', kind: 'classic', name: 'Extra key' } },
            { table: 'levels', key: { id: null }, version: 1, row: null },
            { table: 'levels', key: ['level'], version: 1, row: null },
            { table: 'levels', version: 1, row: null },
            { table: 'level_tags', key: { level_id: 'level' }, version: 1, row: null },
            { table: 'user_settings', key: { user_id: id }, version: null, row: {} },
            { table: 'levels', key: { id: 'level' }, version: null, row: [] },
            { table: 'levels', key: { id: 'level' }, version: null, row: 'invalid' },
            { table: 'levels', key: { id: 'level' }, version: null, row: { id: 'other', kind: 'classic', name: 'Mismatch' } },
            { table: 'levels', key: { id: 'level' }, version: null, row: { kind: 'classic', name: 'Missing row key' } },
            { table: 'levels', key: { id: 'level' }, version: null, row: { id: 'level', kind: 'classic', name: 'Unknown column', unknown: 1 } },
            { table: 'levels', key: { id: 'level' }, version: null, row: null },
            ...['user_id', 'version', 'created_at', 'updated_at'].map(column => ({
                table: 'levels', key: { id: 'level' }, version: null,
                row: { id: 'level', kind: 'classic', name: 'Server column', [column]: null }
            })),
            ...['1', 1.5, true, {}, 2147483648].map(version => ({
                table: 'levels', key: { id: 'level' }, version, row: { id: 'level', name: 'Invalid version' }
            }))
        ];
        const result = ok(await client.rpc('sync_push', { changes: invalid }));
        assert.deepEqual(result.applied, []);
        assert.deepEqual(result.conflicts, []);
        assert.equal(result.rejected.length, invalid.length);
        for (const [index, change] of invalid.entries()) {
            const rejection = result.rejected[index];
            assert.equal(rejection.table, change.table);
            assert.deepEqual(rejection.key, change.key ?? null);
            assert.equal(rejection.code, '22023', JSON.stringify(change));
            assert.ok(rejection.message);
        }
        assert.equal(result.revision, before);
        assert.equal(ok(await client.rpc('sync_revision')), before);
        for (const table of tables) assert.deepEqual(ok(await client.from(table).select('*').eq('user_id', id)), []);
    });

    test('value conversion reports its SQLSTATE and does not discard valid changes', async () => {
        const { id, client } = await context.createUser();
        const result = ok(await client.rpc('sync_push', { changes: [
            { table: 'levels', key: { id: 'bad' }, version: null, row: { id: 'bad', kind: 'classic', name: 'Invalid type', attempts_normal: 'many' } },
            initialChanges[0],
            { table: 'levels', key: { id: 'level' }, version: 1, row: { id: 'level', attempts_normal: 'many' } }
        ] }));
        assert.deepEqual(result.applied, [{ table: 'levels', key: { id: 'level' }, version: 1 }]);
        assert.deepEqual(result.conflicts, []);
        assert.deepEqual(result.rejected.map(({ table, key, code }) => ({ table, key, code })), [
            { table: 'levels', key: { id: 'bad' }, code: '22P02' },
            { table: 'levels', key: { id: 'level' }, code: '22P02' }
        ]);
        for (const rejection of result.rejected) assert.match(rejection.message, /invalid input syntax/);
        const rows = ok(await client.from('levels').select('id,attempts_normal,version').eq('user_id', id));
        assert.deepEqual(rows, [{ id: 'level', attempts_normal: 10, version: 1 }]);
    });

    test('foreign keys fail within the offending change and accept parents sent first', async () => {
        const { client } = await context.createUser();
        const assignment = initialChanges[3];
        const result = ok(await client.rpc('sync_push', { changes: [
            initialChanges[0], assignment, initialChanges[2], assignment
        ] }));
        assert.deepEqual(result.applied, [
            { table: 'levels', key: { id: 'level' }, version: 1 },
            { table: 'tags', key: { name: 'Practice' }, version: 1 },
            { table: 'level_tags', key: { level_id: 'level', tag_name: 'Practice' }, version: 1 }
        ]);
        assert.deepEqual(result.conflicts, []);
        assert.equal(result.rejected.length, 1);
        assert.equal(result.rejected[0].code, '23503');
        assert.equal(result.rejected[0].table, 'level_tags');
        assert.deepEqual(result.rejected[0].key, assignment.key);
        assert.match(result.rejected[0].message, /foreign key constraint/);
        const item = ok(await client.rpc('sync_push', { changes: [initialChanges[6], initialChanges[5], initialChanges[6]] }));
        assert.equal(item.rejected.length, 1);
        assert.equal(item.rejected[0].code, '23503');
        assert.deepEqual(item.applied, [
            { table: 'wishlists', key: { id: 'wishlist' }, version: 1 },
            { table: 'wishlist_items', key: { id: 'item' }, version: 1 }
        ]);
        const deleted = ok(await client.rpc('sync_push', { changes: [
            { table: 'level_tags', key: assignment.key, version: 1, row: null },
            { table: 'levels', key: { id: 'level' }, version: 1, row: null }
        ] }));
        assert.equal(deleted.applied.length, 2);
        assert.deepEqual(deleted.rejected, []);
    });

    test('non-arrays and 501 changes fail atomically while 500 changes are allowed', async () => {
        const { id, client } = await context.createUser();
        const before = ok(await client.rpc('sync_revision'));
        const changes = Array.from({ length: 501 }, (_, index) => ({
            table: 'levels', key: { id: `batch-${index}` }, version: null,
            row: { id: `batch-${index}`, kind: 'classic', name: 'Batch' }
        }));
        for (const invalid of [changes, {}, null, 'invalid', 42]) {
            const result = await client.rpc('sync_push', { changes: invalid });
            assert.equal(result.error?.code, '22023');
            assert.equal(result.error?.message, 'batch_too_large');
            assert.equal(ok(await client.rpc('sync_revision')), before);
            assert.deepEqual(ok(await client.from('levels').select('*').eq('user_id', id)), []);
        }
        const result = ok(await client.rpc('sync_push', { changes: changes.slice(0, 500) }));
        assert.equal(result.applied.length, 500);
        assert.ok(result.applied.every(change => change.version === 1));
        assert.deepEqual(result.conflicts, []);
        assert.deepEqual(result.rejected, []);
        const counted = await client.from('levels').select('*', { count: 'exact', head: true }).eq('user_id', id);
        ok(counted);
        assert.equal(counted.count, 500);
    });

    test('another account cannot change, pull or fingerprint the owner data', async () => {
        const owner = await context.createUser();
        const other = await context.createUser();
        const before = ok(await other.client.rpc('sync_pull'));
        ok(await owner.client.rpc('sync_push', { changes: initialChanges }));
        ok(await owner.client.from('profiles').update({
            username: `sync_${owner.id.slice(0, 8)}`, is_public: true, display_name: 'Owner'
        }).eq('id', owner.id));
        assert.deepEqual(ok(await other.client.rpc('sync_pull')), before);
        assert.equal(ok(await other.client.rpc('sync_revision')), before.revision);
        const ownerData = ok(await owner.client.rpc('sync_pull'));
        const attempts = ok(await other.client.rpc('sync_push', { changes: [
            { table: 'levels', key: { id: 'level' }, version: 1, row: { id: 'level', name: 'Intrusion' } },
            { table: 'levels', key: { id: 'level' }, version: 1, row: null }
        ] }));
        // B has no such level: the update conflicts with nothing, and the delete of a row B does not have is already done
        assert.deepEqual(attempts.applied, [{ table: 'levels', key: { id: 'level' }, version: null }]);
        assert.deepEqual(attempts.rejected, []);
        assert.deepEqual(attempts.conflicts, [{ table: 'levels', key: { id: 'level' }, row: null }]);
        assert.equal(attempts.revision, before.revision);
        assert.deepEqual(ok(await owner.client.rpc('sync_pull')), ownerData);
        const ownInsert = ok(await other.client.rpc('sync_push', { changes: initialChanges }));
        assert.equal(ownInsert.applied.length, 8);
        assert.deepEqual(ownInsert.conflicts, []);
        assert.deepEqual(ownInsert.rejected, []);
        const otherData = ok(await other.client.rpc('sync_pull'));
        assert.equal(otherData.profile.id, other.id);
        for (const table of tables) {
            assert.equal(otherData[table].length, 1, table);
            assert.equal(otherData[table][0].user_id, other.id, table);
        }
        assert.deepEqual(ok(await owner.client.rpc('sync_pull')), ownerData);
        ok(await owner.client.from('levels').update({ name: 'Owner changed' }).eq('id', 'level'));
        ok(await owner.client.from('tags').delete().eq('name', 'Practice'));
        assert.equal(ok(await other.client.rpc('sync_revision')), otherData.revision);
        assert.deepEqual(ok(await other.client.rpc('sync_pull')), otherData);
    });

    test('anonymous callers cannot execute any sync function', async () => {
        for (const [name, args] of [['sync_push', { changes: [] }], ['sync_pull', {}], ['sync_revision', {}]]) {
            const result = await context.anon.rpc(name, args);
            assert.ok(result.error?.code === '42501' || result.status === 401, `${name}: ${JSON.stringify(result.error)}`);
        }
    });

    for (const [table, key, row, patch, keeper] of [
        ['levels', { id: 'target' }, { id: 'target', kind: 'classic', name: 'Target' }, { name: 'Updated' },
            { id: 'keeper', kind: 'classic', name: 'Keeper' }],
        ['level_tags', { level_id: 'parent', tag_name: 'Base' }, { level_id: 'parent', tag_name: 'Base' }, { position: 1 },
            { level_id: 'other-parent', tag_name: 'Base' }],
        ['wishlist_items', { id: 'target' }, { id: 'target', wishlist_id: 'parent', name: 'Target' }, { progress: 42 },
            { id: 'keeper', wishlist_id: 'parent', name: 'Keeper' }],
        ['tags', { name: 'Target' }, { name: 'Target', color: '#abcdef' }, { color: '#123456' },
            { name: 'Keeper', color: '#abcdef' }]
    ]) {
        test(`${table} changes the revision on insert, update and deletion of an older row`, async () => {
            const { client } = await context.createUser();
            ok(await client.from('levels').insert([
                { id: 'parent', kind: 'classic', name: 'Parent' },
                { id: 'other-parent', kind: 'classic', name: 'Other parent' }
            ]));
            ok(await client.from('tags').insert({ name: 'Base', color: '#abcdef' }));
            ok(await client.from('wishlists').insert({ id: 'parent', name: 'Parent' }));
            let revision = ok(await client.rpc('sync_revision'));
            for (const change of [
                { table, key, version: null, row },
                { table, key, version: 1, row: { ...key, ...patch } }
            ]) {
                const result = ok(await client.rpc('sync_push', { changes: [change] }));
                assert.equal(result.applied.length, 1);
                assert.deepEqual(result.conflicts, []);
                assert.deepEqual(result.rejected, []);
                assert.notEqual(result.revision, revision);
                revision = result.revision;
                assert.equal(ok(await client.rpc('sync_revision')), revision);
                assert.equal(ok(await client.rpc('sync_pull')).revision, revision);
            }
            // A newer survivor keeps max(updated_at) unchanged, so the count must detect this delete.
            ok(await client.from(table).insert(keeper));
            revision = ok(await client.rpc('sync_revision'));
            const result = ok(await client.rpc('sync_push', { changes: [{ table, key, version: 2, row: null }] }));
            assert.deepEqual(result.applied, [{ table, key, version: null }]);
            assert.deepEqual(result.conflicts, []);
            assert.deepEqual(result.rejected, []);
            assert.notEqual(result.revision, revision);
            assert.equal(ok(await client.rpc('sync_revision')), result.revision);
            assert.equal(ok(await client.rpc('sync_revision')), result.revision);
        });
    }

    test('updating the profile changes only its owner revision and pull', async () => {
        const { id, client } = await context.createUser();
        const other = await context.createUser();
        const before = ok(await client.rpc('sync_revision'));
        const otherRevision = ok(await other.client.rpc('sync_revision'));
        ok(await client.from('profiles').update({ display_name: 'New display name' }).eq('id', id));
        const after = ok(await client.rpc('sync_revision'));
        assert.notEqual(after, before);
        assert.equal(ok(await client.rpc('sync_revision')), after);
        const pulled = ok(await client.rpc('sync_pull'));
        assert.equal(pulled.profile.display_name, 'New display name');
        assert.equal(pulled.revision, after);
        assert.equal(ok(await other.client.rpc('sync_revision')), otherRevision);
    });

    test('exceeding the write budget returns HTTP 429 and rolls back the entire push', async () => {
        const { id, client } = await context.createUser();
        ok(await context.admin.from('levels').insert(Array.from({ length: 1000 }, (_, index) => ({
            user_id: id, id: `level-${index}`, kind: 'classic', name: 'Budget parent'
        }))));
        ok(await context.admin.from('tags').insert(Array.from({ length: 50 }, (_, index) => ({
            user_id: id, name: `Tag ${index}`, color: '#abcdef'
        }))));
        const started = Date.now();
        for (let offset = 0; offset < 49999; offset += 5000) {
            ok(await client.from('level_tags').insert(Array.from({ length: Math.min(5000, 49999 - offset) }, (_, index) => ({
                level_id: `level-${Math.floor((offset + index) / 50)}`,
                tag_name: `Tag ${(offset + index) % 50}`, position: (offset + index) % 50
            }))));
        }
        const before = ok(await client.rpc('sync_revision'));
        const result = await client.rpc('sync_push', { changes: [
            { table: 'tags', key: { name: 'Rollback' }, version: null, row: { name: 'Rollback', color: '#abcdef' } },
            { table: 'level_notes', key: { level_id: 'level-0' }, version: null, row: { level_id: 'level-0', notes: 'Over budget' } }
        ] });
        assert.equal(result.status, 429);
        assert.equal(result.error?.code, 'PT429');
        assert.equal(result.error?.message, 'write_budget_exceeded');
        assert.equal(ok(await client.rpc('sync_revision')), before);
        assert.deepEqual(ok(await client.from('tags').select('*').eq('user_id', id).eq('name', 'Rollback')), []);
        assert.deepEqual(ok(await client.from('level_notes').select('*').eq('user_id', id)), []);
        const counted = await client.from('level_tags').select('*', { count: 'exact', head: true }).eq('user_id', id);
        ok(counted);
        assert.equal(counted.count, 49999);
        assert.ok(Date.now() - started < 60000, 'The budget test must finish within one window.');
    });
});
