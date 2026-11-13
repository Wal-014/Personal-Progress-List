import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, describe, test } from 'node:test';
import { createTestContext, enabled, ok } from './helpers.js';

const suffix = randomUUID().replaceAll('-', '').slice(0, 16);
const levelId = `public-level-${suffix}`;
const wishlistId = `public-wishlist-${suffix}`;
const itemId = `public-item-${suffix}`;
const tagName = `Public tag ${suffix}`;
const publicTables = ['levels', 'level_tags', 'list_orders', 'wishlists', 'wishlist_items', 'tags'];
const privateTables = ['level_notes', 'user_settings'];
const context = enabled ? createTestContext() : null;

after(async () => context?.cleanup());

function username(user) {
    return `p${user.id.replaceAll('-', '').slice(0, 19)}`;
}

function fixtures(userId) {
    return [
        { table: 'profiles', key: { id: userId }, row: { id: userId, display_name: 'Player' }, patch: { display_name: 'Updated player' } },
        { table: 'user_settings', key: { user_id: userId }, row: { lang: 'en', theme: 'blue' }, patch: { theme: 'night' } },
        { table: 'levels', key: { user_id: userId, id: levelId }, row: { id: levelId, kind: 'classic', name: 'Level', attempts_normal: 42, deaths: { 75: 2 } }, patch: { name: 'Updated level' } },
        { table: 'level_notes', key: { user_id: userId, level_id: levelId }, row: { level_id: levelId, notes: 'Private journal sentinel' }, patch: { notes: 'Updated private journal' } },
        { table: 'list_orders', key: { user_id: userId, kind: 'classic' }, row: { kind: 'classic', level_ids: [levelId] }, patch: { level_ids: [] } },
        { table: 'wishlists', key: { user_id: userId, id: wishlistId }, row: { id: wishlistId, name: 'Wishlist', item_ids: [itemId] }, patch: { name: 'Updated wishlist' } },
        { table: 'wishlist_items', key: { user_id: userId, id: itemId }, row: { id: itemId, wishlist_id: wishlistId, name: 'Item' }, patch: { status: 'prog' } },
        { table: 'tags', key: { user_id: userId, name: tagName }, row: { name: tagName, color: '#abcdef' }, patch: { color: '#123456' } },
        { table: 'level_tags', key: { user_id: userId, level_id: levelId, tag_name: tagName }, row: { level_id: levelId, tag_name: tagName }, patch: { position: 1 } }
    ];
}

async function seed(user) {
    for (const { table, row } of fixtures(user.id).slice(1)) {
        const inserted = ok(await user.client.from(table).insert(row).select().single());
        assert.equal(inserted.user_id, user.id, table);
    }
}

async function publish(user) {
    ok(await user.client.from('profiles').update({
        username: username(user), is_public: true, display_name: 'Public player',
        bio: 'A public biography', country: 'CR', color: '#123456', secondary_color: '#abcdef'
    }).eq('id', user.id));
}

async function snapshot(user) {
    const rows = {};
    for (const { table, key } of fixtures(user.id)) {
        rows[table] = ok(await user.client.from(table).select('*').match(key).single());
    }
    return rows;
}

async function assertHidden(client, user) {
    for (const table of ['profiles', ...publicTables, ...privateTables]) {
        const result = await client.from(table).select('*').eq(table === 'profiles' ? 'id' : 'user_id', user.id);
        if (privateTables.includes(table) && result.error) {
            assert.equal(result.error.code, '42501', table);
        } else {
            assert.deepEqual(ok(result), [], table);
        }
    }
    assert.equal(ok(await client.rpc('public_profile', { target_username: username(user) })), null);
}

describe('public profiles through RLS and the Data API', { skip: !enabled }, () => {
    test('new accounts and private usernames are indistinguishable from missing profiles', async () => {
        const owner = await context.createUser();
        const other = await context.createUser();
        const profile = ok(await owner.client.from('profiles').select('*').eq('id', owner.id).single());
        assert.equal(profile.is_public, false);
        assert.equal(profile.username, null);
        for (const client of [context.anon, other.client]) await assertHidden(client, owner);

        await seed(owner);
        ok(await owner.client.from('profiles').update({ username: username(owner) }).eq('id', owner.id));
        for (const client of [context.anon, other.client, owner.client]) {
            const unknown = ok(await client.rpc('public_profile', { target_username: 'unknown_' + username(other).slice(0, 12) }));
            const privateProfile = ok(await client.rpc('public_profile', { target_username: username(owner) }));
            assert.equal(unknown, null);
            assert.equal(privateProfile, unknown);
        }
        for (const client of [context.anon, other.client]) await assertHidden(client, owner);
    });

    test('a profile cannot become public without a username', async () => {
        const owner = await context.createUser();
        const result = await owner.client.from('profiles').update({ is_public: true }).eq('id', owner.id);
        assert.equal(result.error?.code, '23514');
        const profile = ok(await owner.client.from('profiles').select('username, is_public').eq('id', owner.id).single());
        assert.deepEqual(profile, { username: null, is_public: false });
    });

    test('publishing exposes exactly the public data and making it private hides it again', async () => {
        const owner = await context.createUser();
        const other = await context.createUser();
        await seed(owner);
        await seed(other);
        await publish(other);
        await publish(owner);
        const original = await snapshot(owner);
        const { id, username: name, display_name, color, secondary_color, bio, country, created_at } = original.profiles;
        const expectedProfile = { id, username: name, display_name, color, secondary_color, bio, country, created_at };

        for (const client of [context.anon, other.client, owner.client]) {
            for (const table of ['profiles', ...publicTables]) {
                const rows = ok(await client.from(table).select('*').eq(table === 'profiles' ? 'id' : 'user_id', owner.id));
                assert.deepEqual(rows, [original[table]], table);
            }
            const view = ok(await client.rpc('public_profile', { target_username: username(owner) }));
            assert.deepEqual(Object.keys(view).sort(), ['profile', ...publicTables].sort());
            assert.deepEqual(view.profile, expectedProfile);
            assert.equal(Object.hasOwn(view.profile, 'email'), false);
            assert.doesNotMatch(JSON.stringify(view), /"notes"\s*:/);
            assert.equal(JSON.stringify(view).includes('Private journal sentinel'), false);
            for (const table of publicTables) assert.deepEqual(view[table], [original[table]], table);
        }
        for (const client of [context.anon, other.client]) {
            for (const table of privateTables) {
                const result = await client.from(table).select('*').eq('user_id', owner.id);
                if (result.error) assert.equal(result.error.code, '42501', table);
                else assert.deepEqual(ok(result), [], table);
            }
        }

        ok(await owner.client.from('profiles').update({ is_public: false }).eq('id', owner.id));
        for (const client of [context.anon, other.client]) await assertHidden(client, owner);
        assert.equal(ok(await owner.client.rpc('public_profile', { target_username: username(owner) })), null);
        assert.equal(ok(await owner.client.from('levels').select('*').eq('user_id', owner.id)).length, 1);
    });

    test('public profiles without data return empty arrays for every public collection', async () => {
        const owner = await context.createUser();
        const other = await context.createUser();
        await publish(owner);
        for (const client of [context.anon, other.client]) {
            const view = ok(await client.rpc('public_profile', { target_username: username(owner) }));
            assert.equal(view.profile.id, owner.id);
            assert.deepEqual(Object.keys(view).sort(), ['profile', ...publicTables].sort());
            for (const table of publicTables) assert.deepEqual(view[table], [], table);
        }
    });

    test('anonymous visitors cannot write any table whether a profile is private or public', async () => {
        const owner = await context.createUser();
        await seed(owner);
        for (const isPublic of [false, true]) {
            if (isPublic) await publish(owner);
            const original = await snapshot(owner);
            for (const { table, key, row, patch } of fixtures(owner.id)) {
                const ownerColumn = table === 'profiles' ? 'id' : 'user_id';
                for (const query of [
                    context.anon.from(table).insert({ ...row, [ownerColumn]: owner.id }),
                    context.anon.from(table).update(patch).match(key),
                    context.anon.from(table).delete().match(key)
                ]) {
                    const result = await query;
                    assert.equal(result.error?.code, '42501', `${table}, public: ${isPublic}`);
                    assert.equal(result.data, null);
                }
            }
            assert.deepEqual(await snapshot(owner), original);
        }
    });

    test('signed-in visitors can write only their own rows while public owner rows stay unchanged', async () => {
        const owner = await context.createUser();
        const other = await context.createUser();
        await seed(owner);
        await publish(owner);
        const original = await snapshot(owner);
        await seed(other);
        const ownFixtures = fixtures(other.id);

        for (const { table, key, row, patch } of fixtures(owner.id)) {
            const ownerColumn = table === 'profiles' ? 'id' : 'user_id';
            assert.deepEqual(ok(await other.client.from(table).update(patch).match(key).select()), [], table);
            const deletion = await other.client.from(table).delete().match(key).select();
            if (['profiles', 'user_settings'].includes(table)) assert.equal(deletion.error?.code, '42501', table);
            else assert.deepEqual(ok(deletion), [], table);
            assert.equal((await other.client.from(table).insert({ ...row, [ownerColumn]: owner.id })).error?.code, '42501', table);

            const ownKey = ownFixtures.find(fixture => fixture.table === table).key;
            assert.equal((await other.client.from(table).update({ [ownerColumn]: owner.id }).match(ownKey)).error?.code, '42501', table);
            const updated = ok(await other.client.from(table).update(patch).match(ownKey).select().single());
            assert.equal(updated[ownerColumn], other.id, table);
            for (const [field, value] of Object.entries(patch)) assert.deepEqual(updated[field], value, table);
        }
        for (const { table, key } of ownFixtures.toReversed()) {
            const deletion = await other.client.from(table).delete().match(key).select();
            if (['profiles', 'user_settings'].includes(table)) {
                assert.equal(deletion.error?.code, '42501', table);
            } else {
                assert.equal(ok(deletion).length, 1, table);
                assert.deepEqual(ok(await other.client.from(table).select('*').match(key)), [], table);
            }
        }
        assert.deepEqual(await snapshot(owner), original);
    });

    test('sync stays scoped to the caller when another account publishes and edits public data', async () => {
        const owner = await context.createUser();
        const other = await context.createUser();
        await seed(other);
        const baseline = ok(await other.client.rpc('sync_pull'));
        const revision = ok(await other.client.rpc('sync_revision'));
        assert.equal(baseline.profile.id, other.id);
        assert.equal(baseline.revision, revision);
        for (const table of [...publicTables, ...privateTables]) {
            assert.equal(baseline[table].length, 1, table);
            assert.equal(baseline[table][0].user_id, other.id, table);
        }

        await seed(owner);
        await publish(owner);
        for (const edited of [false, true]) {
            if (edited) {
                ok(await owner.client.from('levels').update({ name: 'Changed public level' }).eq('user_id', owner.id).eq('id', levelId));
            }
            const visible = ok(await other.client.rpc('public_profile', { target_username: username(owner) }));
            assert.equal(visible.levels[0].name, edited ? 'Changed public level' : 'Level');
            assert.deepEqual(ok(await other.client.rpc('sync_pull')), baseline);
            assert.equal(ok(await other.client.rpc('sync_revision')), revision);
        }
    });
});
