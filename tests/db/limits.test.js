import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';
import { createTestContext, enabled, ok } from './helpers.js';

const context = enabled ? createTestContext() : null;
after(async () => context?.cleanup());

async function count(client, table) {
    const result = await client.from(table).select('*', { count: 'exact', head: true });
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
            const { client } = await context.createUser();
            if (table === 'wishlist_items') ok(await client.from('wishlists').insert({ id: 'parent', name: 'Parent' }));
            const rows = Array.from({ length: limit }, (_, index) => makeRow(index));
            for (let offset = 0; offset < rows.length; offset += 1000) {
                ok(await client.from(table).insert(rows.slice(offset, offset + 1000)));
            }
            assert.equal(await count(client, table), limit);
            const overflow = await client.from(table).insert([makeRow(limit), makeRow(limit + 1)]);
            assert.equal(overflow.error?.code, '23514');
            assert.equal(overflow.error?.message, `row_limit:${table}`);
            assert.equal(await count(client, table), limit);
            const next = await client.from(table).insert(makeRow(limit));
            assert.equal(next.error?.code, '23514');
            assert.equal(next.error?.message, `row_limit:${table}`);
            assert.equal(await count(client, table), limit);
        });
    }

    test('20000 written rows are allowed, later inserts and updates return HTTP 429, and deletes still work', async () => {
        const { client } = await context.createUser();
        const started = Date.now();
        for (let offset = 0; offset < 4000; offset += 1000) {
            ok(await client.from('levels').insert(Array.from({ length: 1000 }, (_, index) => ({
                id: `level-${offset + index}`, kind: 'classic', name: 'Budget'
            }))));
        }
        for (let index = 0; index < 4; index++) {
            ok(await client.from('levels').update({ name: `Budget ${index}` }).like('id', 'level-%'));
        }
        assert.equal(ok(await client.from('levels').select('version').eq('id', 'level-0').single()).version, 5);
        for (const query of [
            client.from('levels').update({ name: 'Over budget' }).like('id', 'level-%'),
            client.from('levels').insert({ id: 'overflow', kind: 'classic', name: 'Over budget' }),
            client.from('profiles').update({ display_name: 'Over budget' }).not('id', 'is', null),
            client.from('user_settings').insert({ lang: 'en', theme: 'blue' })
        ]) {
            const result = await query;
            assert.equal(result.status, 429);
            assert.equal(result.error?.code, 'PT429');
            assert.equal(result.error?.message, 'write_budget_exceeded');
        }
        assert.ok(Date.now() - started < 60000, 'The budget test must finish within one window.');
        assert.equal(await count(client, 'levels'), 4000);
        assert.deepEqual(ok(await client.from('levels').select('name,version').eq('id', 'level-0').single()), { name: 'Budget 3', version: 5 });
        assert.equal(ok(await client.from('levels').delete().like('id', 'level-%').select('id')).length, 4000);
        const other = await context.createUser();
        ok(await other.client.from('levels').insert({ id: 'independent', kind: 'classic', name: 'Independent budget' }));
    });
});
