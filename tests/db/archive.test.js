import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';
import { createTestContext, enabled, ok } from './helpers.js';

const context = enabled ? createTestContext() : null;
after(async () => context?.cleanup());

async function seed(user) {
    for (const [table, rows] of [
        ['user_settings', { lang: 'en' }],
        ['levels', { id: 'level', kind: 'classic', name: 'Level', level_id: 123456789012 }],
        ['level_notes', { level_id: 'level', notes: 'Private notes' }],
        ['tags', [{ name: 'Focus', color: '#abcdef' }, { name: 'Practice', color: '#123456' }]],
        ['level_tags', [{ level_id: 'level', tag_name: 'Focus', position: 0 }, { level_id: 'level', tag_name: 'Practice', position: 1 }]],
        ['list_orders', { kind: 'classic', level_ids: ['level'] }],
        ['wishlists', { id: 'wishlist', name: 'Wishlist' }],
        ['wishlist_items', [
            { id: 'first', wishlist_id: 'wishlist', name: 'First', level_id: 123456789012 },
            { id: 'second', wishlist_id: 'wishlist', name: 'Second' }
        ]]
    ]) ok(await user.client.from(table).insert(rows));
}

async function archived(userId) {
    return ok(await context.admin.rpc('archived_rows', { target_user: userId }));
}

async function snapshots(user, tables) {
    const rows = [];
    for (const table of tables) {
        for (const row of ok(await user.client.from(table).select('*').eq('user_id', user.id))) {
            rows.push({ table_name: table, row_data: row });
        }
    }
    return rows;
}

function assertArchive(rows, expected, userId) {
    const key = row => `${row.table_name}:${row.row_data.id ?? row.row_data.level_id ?? row.row_data.kind ?? row.row_data.name}:${row.row_data.tag_name ?? ''}`;
    const byRow = (left, right) => key(left).localeCompare(key(right));
    assert.deepEqual(rows.map(({ table_name, row_data }) => ({ table_name, row_data })).sort(byRow), expected.sort(byRow));
    for (const [index, row] of rows.entries()) {
        assert.equal(row.row_data.user_id, userId);
        assert.equal(typeof row.id, 'number');
        assert.ok(Math.abs(Date.now() - Date.parse(row.deleted_at)) < 60000);
        if (index > 0) assert.ok(rows[index - 1].id > row.id, 'Archive rows must be newest first.');
    }
}

describe('private deleted-row archive', { skip: !enabled }, () => {
    test('deleting a level archives its full row, notes and level tags for only the requested account', async () => {
        const owner = await context.createUser();
        const other = await context.createUser();
        await seed(owner);
        await seed(other);
        const tables = ['levels', 'level_notes', 'level_tags'];
        const expected = await snapshots(owner, tables);
        const otherExpected = await snapshots(other, tables);
        assert.equal(expected.length, 4);
        assert.deepEqual(await archived(owner.id), []);
        ok(await owner.client.from('levels').delete().eq('id', 'level'));
        ok(await other.client.from('levels').delete().eq('id', 'level'));
        assertArchive(await archived(owner.id), expected, owner.id);
        assertArchive(await archived(other.id), otherExpected, other.id);
        for (const table of tables) assert.deepEqual(ok(await owner.client.from(table).select('*').eq('user_id', owner.id)), []);
        assert.equal(ok(await owner.client.from('tags').select('*').eq('user_id', owner.id)).length, 2);
        ok(await owner.client.from('levels').delete().eq('id', 'level'));
        assert.equal((await archived(owner.id)).length, 4);
    });

    test('deleting a wishlist archives it and every cascaded item', async () => {
        const owner = await context.createUser();
        await seed(owner);
        const expected = await snapshots(owner, ['wishlists', 'wishlist_items']);
        assert.equal(expected.length, 3);
        ok(await owner.client.from('wishlists').delete().eq('id', 'wishlist'));
        assertArchive(await archived(owner.id), expected, owner.id);
        assert.deepEqual(ok(await owner.client.from('wishlists').select('*').eq('user_id', owner.id)), []);
        assert.deepEqual(ok(await owner.client.from('wishlist_items').select('*').eq('user_id', owner.id)), []);
    });

    test('deleting a tag archives it and its level tags, and list-order deletes are archived', async () => {
        const owner = await context.createUser();
        await seed(owner);
        const expected = (await snapshots(owner, ['tags', 'level_tags', 'list_orders']))
            .filter(row => row.table_name === 'list_orders' || (row.row_data.name ?? row.row_data.tag_name) === 'Focus');
        assert.equal(expected.length, 3);
        ok(await owner.client.from('tags').delete().eq('name', 'Focus'));
        ok(await owner.client.from('list_orders').delete().eq('kind', 'classic'));
        assertArchive(await archived(owner.id), expected, owner.id);
        assert.deepEqual(ok(await owner.client.from('level_tags').select('tag_name').eq('user_id', owner.id)), [{ tag_name: 'Practice' }]);
        assert.equal(ok(await owner.client.from('levels').select('id').eq('user_id', owner.id).single()).id, 'level');
    });

    test('deleting an auth user with live data purges prior archives without archiving account cascades', async () => {
        const owner = await context.createUser();
        const other = await context.createUser();
        await seed(owner);
        await seed(other);
        ok(await owner.client.from('wishlists').delete().eq('id', 'wishlist'));
        ok(await other.client.from('wishlists').delete().eq('id', 'wishlist'));
        const otherArchive = await archived(other.id);
        assert.equal((await archived(owner.id)).length, 3);
        await context.deleteUser(owner.id);
        assert.deepEqual(await archived(owner.id), []);
        assert.deepEqual(await archived(other.id), otherArchive);
        for (const table of ['profiles', 'user_settings', 'levels', 'level_notes', 'level_tags', 'list_orders', 'wishlists', 'wishlist_items', 'tags']) {
            assert.deepEqual(ok(await context.admin.from(table).select('*').eq(table === 'profiles' ? 'id' : 'user_id', owner.id)), []);
        }
    });

    test('authenticated and anonymous clients cannot call the archive recovery function', async () => {
        const owner = await context.createUser();
        const other = await context.createUser();
        await seed(owner);
        ok(await owner.client.from('levels').delete().eq('id', 'level'));
        for (const client of [owner.client, other.client, context.anon]) {
            const result = await client.rpc('archived_rows', { target_user: owner.id });
            assert.equal(result.error?.code, '42501');
            assert.equal(result.data, null);
        }
        assert.equal((await archived(owner.id)).length, 4);
    });
});
