import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';
import { createTestContext, enabled, ok } from './helpers.js';

const context = enabled ? createTestContext() : null;
after(async () => context?.cleanup());

async function count(client, table, userId) {
    const result = await client.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId);
    ok(result);
    return result.count;
}

describe('per-account database limits', { skip: !enabled }, () => {
    for (const [table, limit, makeRow] of [
        ['levels', 5000, index => ({ id: `level-${index}`, kind: 'classic', name: 'Level' })],
        ['wishlists', 200, index => ({ id: `wishlist-${index}`, name: 'Wishlist' })],
        ['wishlist_items', 5000, index => ({ id: `item-${index}`, wishlist_id: 'parent', name: 'Item' })],
        ['tags', 300, index => ({ name: `Tag ${index}`, color: '#abcdef' })]
    ]) {
        test(`${table} accepts ${limit} rows and rejects the next row atomically`, async () => {
            const { id, client } = await context.createUser();
            if (table === 'wishlist_items') ok(await client.from('wishlists').insert({ id: 'parent', name: 'Parent' }));
            const rows = Array.from({ length: limit }, (_, index) => makeRow(index));
            for (let offset = 0; offset < rows.length; offset += 1000) {
                ok(await client.from(table).insert(rows.slice(offset, offset + 1000)));
            }
            assert.equal(await count(client, table, id), limit);
            const overflow = await client.from(table).insert([makeRow(limit), makeRow(limit + 1)]);
            assert.equal(overflow.error?.code, '23514');
            assert.equal(overflow.error?.message, `row_limit:${table}`);
            assert.equal(await count(client, table, id), limit);
            const next = await client.from(table).insert(makeRow(limit));
            assert.equal(next.error?.code, '23514');
            assert.equal(next.error?.message, `row_limit:${table}`);
            assert.equal(await count(client, table, id), limit);
        });
    }

    test('level_tags accepts 50000 rows and rejects the next row atomically', async () => {
        const { id, client } = await context.createUser();
        ok(await context.admin.from('levels').insert(Array.from({ length: 1001 }, (_, index) => ({
            user_id: id, id: `level-${index}`, kind: 'classic', name: 'Level'
        }))));
        ok(await context.admin.from('tags').insert(Array.from({ length: 50 }, (_, index) => ({
            user_id: id, name: `Tag ${index}`, color: '#abcdef'
        }))));
        // Administrative seeding isolates the row cap from the separate write budget.
        for (let offset = 0; offset < 50000; offset += 1000) {
            ok(await context.admin.from('level_tags').insert(Array.from({ length: 1000 }, (_, index) => ({
                user_id: id, level_id: `level-${Math.floor((offset + index) / 50)}`,
                tag_name: `Tag ${(offset + index) % 50}`, position: (offset + index) % 50
            }))));
        }
        assert.equal(await count(client, 'level_tags', id), 50000);
        for (const rows of [
            [{ level_id: 'level-1000', tag_name: 'Tag 0' }, { level_id: 'level-1000', tag_name: 'Tag 1' }],
            { level_id: 'level-1000', tag_name: 'Tag 0' }
        ]) {
            const result = await client.from('level_tags').insert(rows);
            assert.equal(result.error?.code, '23514');
            assert.equal(result.error?.message, 'row_limit:level_tags');
            assert.equal(await count(client, 'level_tags', id), 50000);
        }
    });

    test('50000 written rows are allowed, later inserts and updates return HTTP 429, and deletes still work', async () => {
        const { id, client } = await context.createUser();
        ok(await context.admin.from('tags').insert({ user_id: id, name: 'Budget', color: '#abcdef' }));
        const started = Date.now();
        for (let offset = 0; offset < 5000; offset += 1000) {
            ok(await client.from('levels').insert(Array.from({ length: 1000 }, (_, index) => ({
                id: `level-${offset + index}`, kind: 'classic', name: 'Budget'
            }))));
        }
        for (let index = 0; index < 8; index++) {
            ok(await client.from('levels').update({ name: `Budget ${index}` }).like('id', 'level-%'));
        }
        ok(await client.from('level_tags').insert(Array.from({ length: 4999 }, (_, index) => ({
            level_id: `level-${index}`, tag_name: 'Budget'
        }))));
        ok(await client.from('level_tags').update({ position: 1 }).eq('level_id', 'level-0'));
        assert.equal(ok(await client.from('levels').select('version').eq('user_id', id).eq('id', 'level-0').single()).version, 9);
        for (const query of [
            client.from('levels').update({ name: 'Over budget' }).like('id', 'level-%'),
            client.from('level_notes').insert({ level_id: 'level-0', notes: 'Over budget' }),
            client.from('level_tags').insert({ level_id: 'level-4999', tag_name: 'Budget' }),
            client.from('level_tags').update({ position: 2 }).eq('level_id', 'level-0'),
            client.from('profiles').update({ display_name: 'Over budget' }).not('id', 'is', null),
            client.from('user_settings').insert({ lang: 'en', theme: 'blue' })
        ]) {
            const result = await query;
            assert.equal(result.status, 429);
            assert.equal(result.error?.code, 'PT429');
            assert.equal(result.error?.message, 'write_budget_exceeded');
        }
        assert.ok(Date.now() - started < 60000, 'The budget test must finish within one window.');
        assert.equal(await count(client, 'levels', id), 5000);
        assert.equal(await count(client, 'level_tags', id), 4999);
        assert.deepEqual(ok(await client.from('levels').select('name,version').eq('user_id', id).eq('id', 'level-0').single()), { name: 'Budget 7', version: 9 });
        assert.deepEqual(ok(await client.from('level_tags').select('position,version').eq('user_id', id).eq('level_id', 'level-0').single()), { position: 1, version: 2 });
        const deletion = await client.from('levels').delete({ count: 'exact' }).like('id', 'level-%');
        ok(deletion);
        assert.equal(deletion.count, 5000);
        assert.equal(await count(client, 'levels', id), 0);
        assert.equal(await count(client, 'level_tags', id), 0);
        await context.deleteUser(id);
        assert.deepEqual(ok(await context.admin.rpc('archived_rows', { target_user: id })), []);
        const other = await context.createUser();
        ok(await other.client.from('levels').insert({ id: 'independent', kind: 'classic', name: 'Independent budget' }));
    });
});
