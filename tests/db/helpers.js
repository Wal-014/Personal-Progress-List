import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_KEY;

if (url && !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
    throw new Error('Database tests must use a local Supabase stack.');
}

export const enabled = Boolean(url && anonKey && serviceKey);

export function ok(result) {
    assert.equal(result.error, null, result.error?.message);
    return result.data;
}

export function createTestContext() {
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    const admin = createClient(url, serviceKey, options);
    const anon = createClient(url, anonKey, options);
    const users = new Set();

    async function createUser(userMetadata = {}) {
        const email = `db-${randomUUID()}@example.test`;
        const password = `Test9-${randomUUID()}`;
        const { user } = ok(await admin.auth.admin.createUser({
            email, password, email_confirm: true, user_metadata: userMetadata
        }));
        users.add(user.id);
        const client = createClient(url, anonKey, options);
        ok(await client.auth.signInWithPassword({ email, password }));
        return { id: user.id, client };
    }

    async function deleteUser(id) {
        ok(await admin.auth.admin.deleteUser(id));
        users.delete(id);
    }

    async function cleanup() {
        const results = await Promise.allSettled([...users].map(deleteUser));
        assert.deepEqual(results.filter(result => result.status === 'rejected'), []);
    }

    return { admin, anon, createUser, deleteUser, cleanup };
}
