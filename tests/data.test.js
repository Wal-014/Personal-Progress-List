import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// state.js and api.js read localStorage when they load, so an empty one is provided
const context = vm.createContext({ localStorage: {} });
for (const file of ['js/config.js', 'js/utils.js', 'js/state.js', 'js/api.js'])
    vm.runInContext(readFileSync(file, 'utf8'), context, { filename: file });
const app = name => vm.runInContext(name, context);
const setGlobal = (name, value) => {
    context.__value = value;
    vm.runInContext(`${name} = __value`, context);
};

test('isValidProfileData accepts an empty profile and a full one', () => {
    const isValid = app('isValidProfileData');
    assert.equal(isValid(app('emptyProfile()')), true);
    assert.equal(isValid({ levels: [{ name: 'A' }], order: { classic: [], platform: [] }, wishlists: [{ items: [{}] }], tags: [{ name: 't' }] }), true);
    assert.equal(isValid({ levels: [], order: { classic: [], platform: [] } }), true);
});

test('isValidProfileData rejects data the app cannot render', () => {
    const isValid = app('isValidProfileData');
    assert.equal(isValid(null), false);
    assert.equal(isValid([]), false);
    assert.equal(isValid({ levels: {}, order: { classic: [], platform: [] } }), false);
    assert.equal(isValid({ levels: ['x'], order: { classic: [], platform: [] } }), false);
    assert.equal(isValid({ levels: [], order: { classic: [] } }), false);
    assert.equal(isValid({ levels: [], order: { classic: [], platform: [] }, wishlists: [{}] }), false);
    assert.equal(isValid({ levels: [], order: { classic: [], platform: [] }, tags: 'a' }), false);
});

test('findAredlByName matches exact names first, then a single partial match', () => {
    setGlobal('aredlCache', [
        { k: 'd', i: 1, n: 'Bloodbath' },
        { k: 'd', i: 2, n: 'Kenos' },
        { k: 'd', i: 3, n: 'Tidal Wave' },
        { k: 'd', i: 4, n: 'Tidal Wave II' },
        { k: 'd', i: 5, n: '...' },
        { k: 'p', i: 6, n: 'Bloodbath' }
    ]);
    const find = (name, kind = 'd') => app('findAredlByName')(name, kind)?.i ?? null;
    assert.equal(find('blood bath'), 1);
    assert.equal(find('Bloodbath', 'p'), 6);
    assert.equal(find('Tidal Wave'), 3);
    assert.equal(find('bloodb'), 1);
    assert.equal(find('tidal'), null, 'several partial matches are ambiguous');
    assert.equal(find('Kenos Remake'), null, 'typed text containing an official name is a different level');
    assert.equal(find('ken'), null, 'partial matches need at least four characters');
    assert.equal(find('!!!'), null);
});

test('tagStyle paints a chip in its tag colour and drops anything that is not #rrggbb', () => {
    setGlobal('profile', { tags: [{ name: 'ok', color: '#12ab9F' }, { name: 'bad', color: 'red;background:url(x)' }] });
    const tagStyle = app('tagStyle');
    assert.equal(tagStyle('ok'), 'color:#12ab9F;border-color:#12ab9F');
    assert.equal(tagStyle('bad'), 'color:var(--b);border-color:var(--b)');
    assert.equal(tagStyle('missing'), 'color:var(--b);border-color:var(--b)');
});
