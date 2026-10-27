import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const createApp = () => {
    let writes = 0;
    const localStorage = {}, context = vm.createContext({ localStorage });
    Object.defineProperty(localStorage, 'gdp', { get: () => localStorage.saved, set: value => { localStorage.saved = value; writes++; } });
    for (const file of ['js/config.js', 'js/i18n.js', 'js/utils.js', 'js/state.js'])
        vm.runInContext(readFileSync(file, 'utf8'), context, { filename: file });
    const app = code => vm.runInContext(code, context);
    const setProfiles = profs => {
        context.profs = profs;
        app('store = { cur: Object.keys(profs)[0], profs }');
    };
    return { app, context, localStorage, setProfiles, writes: () => writes };
};

test('isHexColor accepts only six hexadecimal digits after a hash', () => {
    const { app } = createApp(), valid = app('isHexColor');
    for (const value of ['#123456', '#aBcDeF', '#000000', '#FFFFFF'])
        assert.equal(valid(value), true, value);
    for (const value of [undefined, null, 123456, {}, ['#123456'], '', '#abc', '#12345678', '123456', '#gggggg', ' #123456', '#123456\n', '"><script>'])
        assert.equal(valid(value), false, String(value));
});

test('cubeIcon paints the chosen colour with a separate shade and unique gradient', () => {
    const { app } = createApp(), cube = app('cubeIcon'), first = cube('#12ab9F'), second = cube('#12ab9F');
    assert.match(first, /fill="#12ab9F"/);
    assert.match(first, /stop-opacity="?0(?:\s|"|\s*\/)/);
    assert.match(first, /stop-opacity="?\.3/);
    assert.notEqual(first.match(/linearGradient id=([^ >]+)/)[1], second.match(/linearGradient id=([^ >]+)/)[1]);
});

test('cubeIcon falls back safely for invalid colours', () => {
    const { app } = createApp(), cube = app('cubeIcon');
    for (const value of [undefined, null, 1, '#abc', '"><script>']) {
        const svg = cube(value);
        assert.match(svg, /fill="#ffe94d"/);
        assert.equal(svg.includes('<script>'), false);
    }
});

test('ensureProfileColors preserves valid colours and migrates invalid colours by position', () => {
    const { app, setProfiles, localStorage, writes } = createApp();
    const profs = Object.fromEntries(Array.from({ length: 9 }, (_, i) => ['p' + i, { name: 'P' + i, data: {} }]));
    profs.p0.color = '#123aBC';
    profs.p2.color = '"><script>';
    setProfiles(profs);
    app('ensureProfileColors()');
    assert.deepEqual(Object.values(profs).map(p => p.color), ['#123aBC', '#a6ff4d', '#ff8af2', '#ffb35c', '#7af6ff', '#ff7a8a', '#c9a2ff', '#ffe94d', '#a6ff4d']);
    assert.deepEqual(JSON.parse(localStorage.gdp).profs, profs);
    assert.equal(writes(), 1);
    app('ensureProfileColors()');
    assert.equal(writes(), 1, 'a migrated store is not saved again');
    delete profs.p1;
    app('ensureProfileColors()');
    assert.equal(profs.p2.color, '#ff8af2', 'deleting a profile does not shift other colours');
    assert.equal(writes(), 1);
});

test('nextProfileColor picks the first unused preset regardless of case or custom colours', () => {
    const { app, setProfiles } = createApp();
    setProfiles({});
    assert.equal(app('nextProfileColor()'), '#ffe94d');
    setProfiles({ a: { color: '#FFE94D' }, b: { color: '#123456' }, c: { color: '#ff8af2' } });
    assert.equal(app('nextProfileColor()'), '#a6ff4d');
});

test('nextProfileColor cycles by profile count once every preset is used', () => {
    const { app, setProfiles } = createApp();
    const profs = Object.fromEntries(['#ffe94d', '#a6ff4d', '#ff8af2', '#ffb35c', '#7af6ff', '#ff7a8a', '#c9a2ff'].map((color, i) => ['p' + i, { color }]));
    setProfiles(profs);
    assert.equal(app('nextProfileColor()'), '#ffe94d');
    profs.extra = { color: '#123456' };
    assert.equal(app('nextProfileColor()'), '#a6ff4d');
});

const loadEvents = context => {
    context.document = { body: {}, addEventListener() {} };
    context.window = { addEventListener() {} };
    context.render = () => {};
    context.matchWithAredl = () => {};
    vm.runInContext(readFileSync('js/events.js', 'utf8'), context, { filename: 'js/events.js' });
};
const flush = () => new Promise(resolve => setImmediate(resolve));

test('creating and editing profiles saves the selected colour outside their data', async () => {
    const { app, context, setProfiles } = createApp();
    setProfiles({ old: { name: 'Old', color: '#ffe94d', data: app('emptyProfile()') } });
    loadEvents(context);
    context.askProfile = async (title, name, color) => {
        assert.deepEqual([title, name, color], ['Nuevo perfil', '', '#a6ff4d']);
        return { name: 'New', color: '#ff8af2' };
    };
    app('ACTIONS.pnew()');
    await flush();
    const created = app('store.profs[store.cur]');
    assert.equal(created.name, 'New');
    assert.equal(created.color, '#ff8af2');
    assert.equal(created.data.color, undefined);
    context.askProfile = async (title, name, color) => {
        assert.deepEqual([title, name, color], ['Editar perfil', 'Old', '#ffe94d']);
        return { name: 'Edited', color: '#123456' };
    };
    app('ACTIONS.pedit(null, "old")');
    await flush();
    assert.equal(app('store.profs.old.name'), 'Edited');
    assert.equal(app('store.profs.old.color'), '#123456');
    assert.equal(created.color, '#ff8af2');
});

test('export and import preserve profile metadata separately from level data', async () => {
    const { app, context, setProfiles } = createApp();
    setProfiles({ a: { name: 'Player', color: '#123456', data: app('emptyProfile()') } });
    loadEvents(context);
    let exported;
    context.Blob = Blob;
    context.URL = { createObjectURL: blob => { exported = blob; return 'blob:test'; }, revokeObjectURL() {} };
    context.setTimeout = () => {};
    context.document.createElement = () => ({ click() {} });
    app('ACTIONS.exp(null)');
    const json = await exported.text();
    assert.equal(JSON.parse(json).profileColor, '#123456');
    assert.equal(JSON.parse(json).profileName, 'Player');
    context.askProfile = async (title, name, color) => {
        assert.deepEqual([title, name, color], ['Importar perfil', 'Player', '#123456']);
        return { name, color };
    };
    context.document.body.onchange({ target: { id: 'fi', dataset: {}, files: [{ name: 'export.json', text: async () => json }] } });
    await flush();
    assert.equal(app('store.profs[store.cur].color'), '#123456');
    assert.equal(app('store.profs[store.cur].data.profileColor'), undefined);
    assert.equal(app('store.profs[store.cur].data.profileName'), undefined);
});

test('import offers an unused preset for an invalid colour and leaves cancellation unchanged', async () => {
    const { app, context, setProfiles, writes } = createApp();
    setProfiles({ a: { name: 'Player', color: '#ffe94d', data: app('emptyProfile()') } });
    loadEvents(context);
    context.askProfile = async (title, name, color) => {
        assert.deepEqual([title, name, color], ['Importar perfil', 'Fallback', '#a6ff4d']);
        return null;
    };
    const json = JSON.stringify({ ...app('emptyProfile()'), profileColor: '"><script>' });
    context.document.body.onchange({ target: { id: 'fi', dataset: {}, files: [{ name: 'Fallback.json', text: async () => json }] } });
    await flush();
    assert.equal(app('Object.keys(store.profs).length'), 1);
    assert.equal(writes(), 0);
});
