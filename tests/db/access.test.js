import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createTestContext, enabled, ok } from './helpers.js';

const tables = ['profiles', 'user_settings', 'levels', 'level_notes', 'list_orders', 'wishlists', 'wishlist_items', 'tags', 'level_tags'];
const context = enabled ? createTestContext() : null;
after(async () => context?.cleanup());

function fixtures(userId) {
    return [
        { table: 'profiles', key: { id: userId }, row: { id: userId, display_name: 'Player' }, patch: { display_name: 'Updated' } },
        { table: 'user_settings', key: { user_id: userId }, row: { lang: 'en', theme: 'blue' }, patch: { theme: 'night' } },
        { table: 'levels', key: { user_id: userId, id: 'level' }, row: { id: 'level', kind: 'classic', name: 'Level' }, patch: { name: 'Updated level' } },
        { table: 'level_notes', key: { user_id: userId, level_id: 'level' }, row: { level_id: 'level', notes: 'Notes' }, patch: { notes: 'Updated notes' } },
        { table: 'list_orders', key: { user_id: userId, kind: 'classic' }, row: { kind: 'classic', level_ids: ['level'] }, patch: { level_ids: [] } },
        { table: 'wishlists', key: { user_id: userId, id: 'wishlist' }, row: { id: 'wishlist', name: 'Wishlist' }, patch: { name: 'Updated wishlist' } },
        { table: 'wishlist_items', key: { user_id: userId, id: 'item' }, row: { id: 'item', wishlist_id: 'wishlist', name: 'Item' }, patch: { status: 'prog' } },
        { table: 'tags', key: { user_id: userId, name: 'Focus' }, row: { name: 'Focus', color: '#abcdef' }, patch: { color: '#123456' } },
        { table: 'level_tags', key: { user_id: userId, level_id: 'level', tag_name: 'Focus' }, row: { level_id: 'level', tag_name: 'Focus' }, patch: { position: 1 } }
    ];
}

async function seed(user) {
    for (const fixture of fixtures(user.id).slice(1)) {
        ok(await user.client.from(fixture.table).insert(fixture.row));
    }
}

describe('account access through the Data API', { skip: !enabled }, () => {
    let owner;
    let other;

    before(async () => {
        owner = await context.createUser({ display_name: ' \u0001Alice\u007f ' });
        other = await context.createUser();
        await seed(owner);
        await seed(other);
    });

    test('signup creates one private profile from metadata or Player', async () => {
        const profile = ok(await owner.client.from('profiles').select('*').single());
        assert.equal(profile.id, owner.id);
        assert.equal(profile.display_name, 'Alice');
        assert.equal(profile.is_public, false);
        assert.equal(profile.username, null);
        assert.equal(profile.color, '#ffe94d');
        assert.equal(profile.secondary_color, '#5ef0ff');
        assert.equal(ok(await other.client.from('profiles').select('display_name').single()).display_name, 'Player');

        const duplicate = await owner.client.from('profiles').insert({ id: owner.id, display_name: 'Duplicate' });
        assert.equal(duplicate.error?.code, '23505');
        assert.deepEqual(ok(await owner.client.from('profiles').select('display_name')), [{ display_name: 'Alice' }]);
    });

    test('metadata falls back after sanitizing each candidate and limits the name to 40 characters', async () => {
        for (const [metadata, expected] of [
            [{ display_name: ' \n ', full_name: ' Full Name ', name: 'Name' }, 'Full Name'],
            [{ full_name: '\t', name: ' Name ' }, 'Name'],
            [{ display_name: 'x'.repeat(50) }, 'x'.repeat(40)],
            [{ display_name: '\n', full_name: ' ', name: '\t' }, 'Player']
        ]) {
            const user = await context.createUser(metadata);
            assert.equal(ok(await user.client.from('profiles').select('display_name').single()).display_name, expected);
        }
    });

    test('owners read and update every table and cannot forge timestamps or versions', async () => {
        const forged = { version: 99, created_at: '2000-01-01T00:00:00Z', updated_at: '2099-01-01T00:00:00Z' };
        for (const fixture of fixtures(owner.id)) {
            const row = ok(await owner.client.from(fixture.table).select('*').match(fixture.key).single());
            assert.equal(row[fixture.table === 'profiles' ? 'id' : 'user_id'], owner.id);
            if (fixture.table !== 'profiles') assert.equal(row.version, 1);
            const patch = fixture.table === 'profiles'
                ? { ...fixture.patch, created_at: forged.created_at, updated_at: forged.updated_at }
                : { ...fixture.patch, ...forged };
            const updated = ok(await owner.client.from(fixture.table).update(patch).match(fixture.key).select().single());
            for (const [key, value] of Object.entries(fixture.patch)) assert.deepEqual(updated[key], value);
            assert.equal(updated.created_at, row.created_at);
            assert.ok(Date.parse(updated.updated_at) >= Date.parse(row.updated_at));
            assert.ok(Math.abs(Date.now() - Date.parse(updated.updated_at)) < 60000);
            if (fixture.table !== 'profiles') assert.equal(updated.version, 2);
        }
    });

    test('inserts ignore client versions and timestamps on every data table', async () => {
        const user = await context.createUser();
        for (const fixture of fixtures(user.id).slice(1)) {
            const row = ok(await user.client.from(fixture.table).insert({
                ...fixture.row, version: 99, created_at: '2000-01-01T00:00:00Z', updated_at: '2099-01-01T00:00:00Z'
            }).select().single());
            assert.equal(row.version, 1);
            assert.equal(row.created_at, row.updated_at);
            assert.ok(Math.abs(Date.now() - Date.parse(row.created_at)) < 60000);
        }
    });

    test('another user cannot read, change, delete, insert or take ownership of any owner row', async () => {
        for (const fixture of fixtures(owner.id)) {
            const { table, key, patch } = fixture;
            const original = ok(await owner.client.from(table).select('*').match(key).single());
            assert.deepEqual(ok(await other.client.from(table).select('*').match(key)), []);
            assert.deepEqual(ok(await other.client.from(table).update(patch).match(key).select()), []);
            const deletion = await other.client.from(table).delete().match(key).select();
            if (['profiles', 'user_settings'].includes(table)) assert.equal(deletion.error?.code, '42501');
            else assert.deepEqual(ok(deletion), []);
            const ownerColumn = table === 'profiles' ? 'id' : 'user_id';
            const insertion = await other.client.from(table).insert({ ...fixture.row, [ownerColumn]: owner.id });
            assert.equal(insertion.error?.code, '42501', table);
            const ownKey = fixtures(other.id).find(item => item.table === table).key;
            const reassignment = await other.client.from(table).update({ [ownerColumn]: owner.id }).match(ownKey);
            assert.equal(reassignment.error?.code, '42501', table);
            assert.deepEqual(ok(await owner.client.from(table).select('*').match(key).single()), original);
        }
    });

    test('anonymous clients have no read or write access to any table', async () => {
        for (const { table, key, row, patch } of fixtures(owner.id)) {
            const original = ok(await owner.client.from(table).select('*').match(key).single());
            for (const query of [
                context.anon.from(table).select('*'),
                context.anon.from(table).insert({ ...row, ...key }),
                context.anon.from(table).update(patch).match(key),
                context.anon.from(table).delete().match(key)
            ]) {
                const result = await query;
                assert.equal(result.error?.code, '42501', table);
                assert.equal(result.data, null);
            }
            assert.deepEqual(ok(await owner.client.from(table).select('*').match(key).single()), original);
        }
    });

    test('private helpers and counters are not exposed through the Data API', async () => {
        for (const client of [owner.client, context.anon]) {
            for (const name of ['charge_write_budget', 'handle_new_user', 'track_writes', 'stamp_row', 'archive_deleted_rows', 'purge_user_deleted_rows']) {
                assert.equal((await client.rpc(name, name === 'charge_write_budget' ? { rows: 0 } : {})).error?.code, 'PGRST202');
            }
            assert.equal((await client.schema('private').from('write_budget').select('*')).error?.code, 'PGRST106');
            assert.equal((await client.schema('private').from('deleted_rows').select('*')).error?.code, 'PGRST106');
        }
    });

    test('owners cannot delete their profile or settings', async () => {
        for (const fixture of fixtures(owner.id).slice(0, 2)) {
            assert.equal((await owner.client.from(fixture.table).delete().match(fixture.key)).error?.code, '42501');
            assert.equal(ok(await owner.client.from(fixture.table).select('*').match(fixture.key)).length, 1);
        }
    });

    test('foreign keys cannot attach notes or items to another account', async () => {
        ok(await owner.client.from('levels').insert({ id: 'owner-only', name: 'Private', kind: 'classic' }));
        ok(await owner.client.from('wishlists').insert({ id: 'owner-only', name: 'Private' }));
        assert.equal((await other.client.from('level_notes').insert({ level_id: 'owner-only', notes: 'Intrusion' })).error?.code, '23503');
        assert.equal((await other.client.from('wishlist_items').insert({ id: 'intrusion', wishlist_id: 'owner-only', name: 'Intrusion' })).error?.code, '23503');
    });

    test('deleting levels and wishlists cascades and owners can delete every other data table', async () => {
        for (const table of ['levels', 'wishlists', 'list_orders', 'tags']) {
            const fixture = fixtures(owner.id).find(item => item.table === table);
            assert.equal(ok(await owner.client.from(table).delete().match(fixture.key).select()).length, 1);
        }
        for (const table of ['level_notes', 'wishlist_items', 'level_tags']) {
            assert.deepEqual(ok(await owner.client.from(table).select('*')), []);
            const fixture = fixtures(other.id).find(item => item.table === table);
            assert.equal(ok(await other.client.from(table).delete().match(fixture.key).select()).length, 1);
        }
    });

    test('deleting an auth user cascades to all public account data', async () => {
        const user = await context.createUser();
        await seed(user);
        await context.deleteUser(user.id);
        for (const table of tables) {
            assert.deepEqual(ok(await context.admin.from(table).select('*').eq(table === 'profiles' ? 'id' : 'user_id', user.id)), []);
        }
    });
});
