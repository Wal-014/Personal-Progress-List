import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createTestContext, enabled, ok } from './helpers.js';

test('delete_account removes only the caller and all their rows; anonymous execution is denied', { skip: !enabled }, async () => {
    const context = createTestContext();
    const email = `delete-${randomUUID()}@example.test`, password = `Test9-${randomUUID()}`;
    const { user } = ok(await context.admin.auth.admin.createUser({ email, password, email_confirm: true }));
    const client = createClient(process.env.SUPABASE_TEST_URL, process.env.SUPABASE_TEST_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    try {
        ok(await client.auth.signInWithPassword({ email, password }));
        const other = await context.createUser();
        const fixtures = [
            ['user_settings', { lang: 'en', theme: 'blue' }],
            ['levels', { id: 'level', kind: 'classic', name: 'Level' }],
            ['level_notes', { level_id: 'level', notes: 'Notes' }],
            ['list_orders', { kind: 'classic', level_ids: ['level'] }],
            ['wishlists', { id: 'wishlist', name: 'Wishlist' }],
            ['wishlist_items', { id: 'item', wishlist_id: 'wishlist', name: 'Item' }],
            ['tags', { name: 'Focus', color: '#abcdef' }]
        ];
        for (const [table, row] of fixtures) {
            ok(await client.from(table).insert(row));
            ok(await other.client.from(table).insert(row));
        }
        const snapshots = new Map();
        for (const table of ['profiles', ...fixtures.map(([table]) => table)])
            snapshots.set(table, ok(await other.client.from(table).select('*').eq(table === 'profiles' ? 'id' : 'user_id', other.id)));
        const denied = await context.anon.rpc('delete_account');
        assert.equal(denied.error?.code, '42501');
        assert.ok(ok(await context.admin.auth.admin.getUserById(user.id)).user);
        ok(await client.rpc('delete_account'));
        assert.equal((await context.admin.auth.admin.getUserById(user.id)).error?.status, 404);
        for (const [table, snapshot] of snapshots) {
            assert.deepEqual(ok(await context.admin.from(table).select('*').eq(table === 'profiles' ? 'id' : 'user_id', user.id)), [], table);
            assert.deepEqual(ok(await other.client.from(table).select('*').eq(table === 'profiles' ? 'id' : 'user_id', other.id)), snapshot, table);
        }
    }
    finally {
        const removed = await context.admin.auth.admin.deleteUser(user.id);
        if (removed.error) assert.equal(removed.error.status, 404);
        await context.cleanup();
    }
});
