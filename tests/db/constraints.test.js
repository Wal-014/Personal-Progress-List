import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createTestContext, enabled, ok } from './helpers.js';

const context = enabled ? createTestContext() : null;
after(async () => context?.cleanup());

const invalid = [
    ['profiles', 'username', 'Ab'], ['profiles', 'username', 'ABC'],
    ['profiles', 'username', 'a'.repeat(21)], ['profiles', 'username', 'abc-'],
    ['profiles', 'display_name', ''], ['profiles', 'display_name', 'x'.repeat(41)],
    ['profiles', 'display_name', ' Name '], ['profiles', 'display_name', 'A\nB'],
    ['profiles', 'color', 'red'], ['profiles', 'secondary_color', '#12345g'],
    ['profiles', 'bio', 'x'.repeat(301)], ['profiles', 'country', 'esp'],
    ['profiles', 'is_public', true],
    ['user_settings', 'lang', 'fr'], ['user_settings', 'theme', 'light'],
    ['levels', 'id', ''], ['levels', 'id', 'x'.repeat(41)], ['levels', 'id', 'bad id'],
    ['levels', 'kind', 'unknown'], ['levels', 'name', ''],
    ['levels', 'name', 'x'.repeat(101)], ['levels', 'name', 'A\nB'],
    ['levels', 'level_id', 'abc'], ['levels', 'level_id', '1'.repeat(13)],
    ['levels', 'creator', 'x'.repeat(101)], ['levels', 'creator', 'A\tB'],
    ['levels', 'difficulty', 'unknown'], ['levels', 'rating', 'unknown'],
    ['levels', 'aredl_status', 'unknown'], ['levels', 'aredl_position', 0], ['levels', 'aredl_position', 100001],
    ['levels', 'video_url', 'javascript:alert(1)'], ['levels', 'video_url', `https://${'x'.repeat(493)}`],
    ['levels', 'enjoyment', -11], ['levels', 'enjoyment', 11],
    ['levels', 'liking', -11], ['levels', 'liking', 11],
    ['levels', 'tags', ['x'.repeat(41)]], ['levels', 'tags', Array(51).fill('Tag')],
    ['levels', 'tags', ['']], ['levels', 'tags', [' Tag ']], ['levels', 'tags', ['A\nB']], ['levels', 'tags', [null]],
    ['levels', 'deaths', []], ['levels', 'deaths', 1], ['levels', 'deaths', null],
    ['levels', 'deaths', { 101: 1 }], ['levels', 'deaths', { '05': 1 }],
    ['levels', 'deaths', { 5: -1 }], ['levels', 'deaths', { 5: 1.5 }],
    ['levels', 'deaths', { 5: 10000001 }], ['levels', 'deaths', { 5: '1' }],
    ['levels', 'deaths', { 5: null }], ['levels', 'deaths', { 5: {} }],
    ['level_notes', 'level_id', 'bad id'], ['level_notes', 'notes', ''], ['level_notes', 'notes', 'x'.repeat(5001)],
    ['list_orders', 'kind', 'unknown'], ['list_orders', 'level_ids', Array(5001).fill('level')],
    ['list_orders', 'level_ids', ['bad id']], ['list_orders', 'level_ids', ['x'.repeat(41)]], ['list_orders', 'level_ids', [null]],
    ['wishlists', 'id', 'bad id'], ['wishlists', 'id', 'x'.repeat(41)],
    ['wishlists', 'name', ''], ['wishlists', 'name', 'x'.repeat(101)], ['wishlists', 'name', 'A\nB'],
    ['wishlists', 'position', -1], ['wishlists', 'item_ids', Array(5001).fill('item')],
    ['wishlists', 'item_ids', ['bad id']], ['wishlists', 'item_ids', ['x'.repeat(41)]],
    ['wishlist_items', 'id', 'bad id'], ['wishlist_items', 'id', 'x'.repeat(41)],
    ['wishlist_items', 'wishlist_id', 'bad id'],
    ['wishlist_items', 'name', ''], ['wishlist_items', 'name', 'x'.repeat(101)], ['wishlist_items', 'name', 'A\nB'],
    ['wishlist_items', 'level_id', 'abc'], ['wishlist_items', 'level_id', '1'.repeat(13)],
    ['wishlist_items', 'creator', 'x'.repeat(101)], ['wishlist_items', 'creator', 'A\tB'],
    ['wishlist_items', 'difficulty', 'unknown'], ['wishlist_items', 'rating', 'unknown'],
    ['wishlist_items', 'kind', 'unknown'], ['wishlist_items', 'status', 'unknown'],
    ['wishlist_items', 'progress', -1], ['wishlist_items', 'progress', 101],
    ['tags', 'name', ''], ['tags', 'name', 'x'.repeat(41)],
    ['tags', 'name', ' Tag '], ['tags', 'name', 'A\nB'],
    ['tags', 'color', '#12345g'], ['tags', 'position', -1]
];
for (const field of ['attempts_normal', 'attempts_copy', 'time_normal', 'time_practice', 'time_practice_copy']) {
    invalid.push(['levels', field, -1], ['levels', field, 1000000001]);
}

describe('database constraints through the Data API', { skip: !enabled }, () => {
    let client;

    before(async () => {
        ({ client } = await context.createUser());
        for (const [table, row] of [
            ['user_settings', { lang: 'en', theme: 'blue' }],
            ['levels', { id: 'level', kind: 'classic', name: 'Level' }],
            ['level_notes', { level_id: 'level', notes: 'Notes' }],
            ['list_orders', { kind: 'classic' }],
            ['wishlists', { id: 'wishlist', name: 'Wishlist' }],
            ['wishlist_items', { id: 'item', wishlist_id: 'wishlist', name: 'Item' }],
            ['tags', { name: 'Tag', color: '#abcdef' }]
        ]) ok(await client.from(table).insert(row));
    });

    test('invalid field values are rejected without changing the row', async t => {
        for (const [index, [table, field, value]] of invalid.entries()) {
            await t.test(`${table}.${field} rejects case ${index + 1}`, async () => {
                const original = ok(await client.from(table).select('*').single());
                const result = await client.from(table).update({ [field]: value }).eq(table === 'profiles' ? 'id' : 'user_id', original[table === 'profiles' ? 'id' : 'user_id']);
                assert.equal(result.error?.code, value === null ? '23502' : '23514', result.error?.message);
                assert.deepEqual(ok(await client.from(table).select('*').single()), original);
            });
        }
    });

    test('valid boundary values and optional null fields are accepted', async () => {
        const deaths = Object.fromEntries(Array.from({ length: 101 }, (_, percent) => [percent, percent === 100 ? 10000000 : 0]));
        ok(await client.from('profiles').update({ username: 'player_123', is_public: true, display_name: 'x'.repeat(40), bio: 'x'.repeat(300), country: 'CR' }).not('id', 'is', null));
        const level = ok(await client.from('levels').update({
            name: 'x'.repeat(100), level_id: '123456789012', creator: 'x'.repeat(100), difficulty: 'Extreme Demon',
            rating: 'mythic', aredl_status: 'r', aredl_position: 100000, attempts_normal: 1000000000, attempts_copy: 0,
            time_normal: 0, time_practice: 1000000000, time_practice_copy: 0, completed_on: '2026-11-11',
            video_url: 'HTTPS://example.test/video', enjoyment: -10, liking: 10, tags: Array(50).fill('x'.repeat(40)), deaths
        }).eq('id', 'level').select().single());
        assert.deepEqual(level.deaths, deaths);
        ok(await client.from('levels').update({ tags: [], deaths: {}, difficulty: null, rating: null, video_url: null }).eq('id', 'level'));
        ok(await client.from('level_notes').update({ notes: 'x'.repeat(5000) }).eq('level_id', 'level'));
        ok(await client.from('list_orders').update({ level_ids: Array(5000).fill('level') }).eq('kind', 'classic'));
        ok(await client.from('wishlists').update({ item_ids: Array(5000).fill('item') }).eq('id', 'wishlist'));
        ok(await client.from('wishlist_items').update({ progress: 100, kind: null, status: 'done' }).eq('id', 'item'));
        ok(await client.from('tags').update({ name: 'x'.repeat(40), color: '#ABCDEF' }).eq('name', 'Tag'));
        const anonymous = await context.anon.from('levels').select('*');
        assert.equal(anonymous.error?.code, '42501');
        assert.equal(anonymous.data, null);
    });
});
