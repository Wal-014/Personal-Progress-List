import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

const createApp = () => {
    let writes = 0;
    const localStorage = {};
    Object.defineProperty(localStorage, 'gdp', { get: () => localStorage.saved, set: value => { localStorage.saved = value; writes++; } });
    const { context, app, load } = loadScripts(['js/config.js', 'js/i18n.js', 'js/utils.js', 'js/state.js'], { localStorage });
    const setProfiles = profs => {
        context.profs = profs;
        app('store = { cur: Object.keys(profs)[0], profs }');
    };
    const loadEvents = () => {
        context.document = { body: {}, addEventListener() {} };
        context.window = { addEventListener() {} };
        context.render = () => {};
        context.matchWithAredl = () => {};
        load(['js/events.js']);
    };
    return { app, context, load, loadEvents, localStorage, setProfiles, writes: () => writes };
};

test('isHexColor accepts only six hexadecimal digits after a hash', () => {
    const { app } = createApp(), valid = app('isHexColor');
    for (const value of ['#123456', '#aBcDeF', '#000000', '#FFFFFF'])
        assert.equal(valid(value), true, value);
    for (const value of [undefined, null, 123456, {}, ['#123456'], '', '#abc', '#12345678', '123456', '#gggggg', ' #123456', '#123456\n', '"><script>'])
        assert.equal(valid(value), false, String(value));
});

test('cubeIcon paints the body and face independently with a separate shade and unique gradient', () => {
    const { app } = createApp(), cube = app('cubeIcon'), first = cube('#12ab9F', '#aB1234'), second = cube('#12ab9F', '#aB1234');
    assert.match(first, /fill="#12ab9F"/);
    assert.match(first, /x=12 y=13 width=8 height=8 fill="#aB1234"/);
    assert.match(first, /x=28 y=13 width=8 height=8 fill="#aB1234"/);
    assert.match(first, /x=12 y=28 width=24 height=6 fill="#aB1234"/);
    assert.match(first, /stop-opacity="?0(?:\s|"|\s*\/)/);
    assert.match(first, /stop-opacity="?\.3/);
    assert.notEqual(first.match(/linearGradient id=([^ >]+)/)[1], second.match(/linearGradient id=([^ >]+)/)[1]);
});

test('cubeIcon falls back safely for invalid colours', () => {
    const { app } = createApp(), cube = app('cubeIcon');
    for (const value of [undefined, null, 1, {}, ['#123456'], '#abc', '#123456\n', '"><script>']) {
        const svg = cube(value, value);
        assert.match(svg, /fill="#ffe94d"/);
        assert.equal((svg.match(/fill="#5ef0ff"/g) || []).length, 3);
        assert.equal(svg.includes('<script>'), false);
        assert.match(cube('#123456', value), /fill="#123456"/);
        assert.equal((cube(value, '#abcdef').match(/fill="#abcdef"/g) || []).length, 3);
    }
});

test('ensureProfileColors preserves valid colours and migrates invalid colours by position', () => {
    const { app, setProfiles, localStorage, writes } = createApp();
    const profs = Object.fromEntries(Array.from({ length: 9 }, (_, i) => ['p' + i, { name: 'P' + i, data: {} }]));
    profs.p0.color = '#123aBC';
    profs.p0.secondaryColor = '#fEdCbA';
    profs.p1.secondaryColor = '"><script>';
    profs.p2.color = '"><script>';
    setProfiles(profs);
    app('ensureProfileColors()');
    assert.deepEqual(Object.values(profs).map(p => p.color), ['#123aBC', '#a6ff4d', '#ff8af2', '#ffb35c', '#7af6ff', '#ff7a8a', '#c9a2ff', '#ffe94d', '#a6ff4d']);
    assert.deepEqual(Object.values(profs).map(p => p.secondaryColor), ['#fEdCbA', ...Array(8).fill('#5ef0ff')]);
    assert.deepEqual(JSON.parse(localStorage.gdp).profs, profs);
    assert.equal(writes(), 1);
    app('ensureProfileColors()');
    assert.equal(writes(), 1, 'a migrated store is not saved again');
    delete profs.p1;
    app('ensureProfileColors()');
    assert.equal(profs.p2.color, '#ff8af2', 'deleting a profile does not shift other colours');
    assert.equal(writes(), 1);
});

test('ensureProfileColors saves once when only secondary colours need migration', () => {
    const { app, setProfiles, writes } = createApp();
    const profs = { a: { color: '#123456' }, b: { color: '#abcdef', secondaryColor: '#ABCDEF' } };
    setProfiles(profs);
    app('ensureProfileColors()');
    assert.equal(profs.a.color, '#123456');
    assert.equal(profs.a.secondaryColor, '#5ef0ff');
    assert.equal(profs.b.secondaryColor, '#ABCDEF');
    assert.equal(writes(), 1);
    app('ensureProfileColors()');
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

const flush = () => new Promise(resolve => setImmediate(resolve));

test('askProfile preserves untouched colours exactly and defaults invalid values', async () => {
    const { app, context, load } = createApp();
    load(['js/components/dialogs.js']);
    context.showDialog = ({ enhance }) => enhance({ querySelector: () => ({}) })('Player');
    const ask = app('askProfile');
    assert.deepEqual({ ...await ask('Edit profile', { name: 'Player', color: '#FFE94D', secondaryColor: '#ABCDEF' }) }, { name: 'Player', color: '#FFE94D', secondaryColor: '#ABCDEF' });
    assert.deepEqual({ ...await ask('New profile', { name: 'Player', color: null, secondaryColor: 'invalid' }) }, { name: 'Player', color: '#ffe94d', secondaryColor: '#5ef0ff' });
});

test('askProfile shows a labelled radio group per colour with its own radio name', () => {
    const { app, context, load } = createApp();
    load(['js/components/dialogs.js']);
    let extra;
    context.showDialog = options => {
        extra = options.extra;
        return new Promise(() => {});
    };
    app('askProfile')('Edit profile', { name: 'Player', color: '#ffe94d', secondaryColor: '#5ef0ff' });
    assert.match(extra, /<span class=lab id="profile-color">Color principal<\/span><div class=profile-swatches role=radiogroup aria-labelledby="profile-color" data-color=color>/);
    assert.match(extra, /<span class=lab id="profile-secondaryColor">Color secundario<\/span><div class=profile-swatches role=radiogroup aria-labelledby="profile-secondaryColor" data-color=secondaryColor>/);
    assert.equal(extra.match(/name="profile-color"/g).length, 7);
    assert.equal(extra.match(/name="profile-secondaryColor"/g).length, 7);
    assert.match(extra, /name="profile-color" value="#ffe94d" aria-label="Amarillo" checked/);
    assert.match(extra, /data-selected=true><input type=color value="#5ef0ff"/, 'the default secondary colour is not a preset, so its custom picker is selected');
});

test('the profile dialog changes only the colour group that was edited', () => {
    const { app, context, load } = createApp();
    load(['js/components/dialogs.js']);
    const colourGroup = color => {
        const custom = { parentNode: { dataset: {} } }, radios = [...app('PROFILE_COLORS')].map(value => ({ value, checked: false }));
        const group = { dataset: { color }, custom, radios, querySelector: () => custom, querySelectorAll: () => radios };
        [custom, ...radios].forEach(input => input.closest = () => group);
        return group;
    };
    const primary = colourGroup('color'), secondary = colourGroup('secondaryColor'), preview = {}, fieldset = { querySelector: () => preview };
    let read;
    context.showDialog = ({ enhance }) => {
        read = enhance({ querySelector: () => fieldset });
        return new Promise(() => {});
    };
    app('askProfile')('Edit profile', { name: 'Player', color: '#ffe94d', secondaryColor: '#5ef0ff' });
    const pink = secondary.radios.find(radio => radio.value == '#ff8af2');
    fieldset.oninput({ target: pink });
    assert.deepEqual({ ...read('Player') }, { name: 'Player', color: '#ffe94d', secondaryColor: '#ff8af2' });
    assert.deepEqual(secondary.radios.filter(radio => radio.checked), [pink]);
    assert.equal(secondary.custom.parentNode.dataset.selected, false);
    assert.equal(primary.radios.some(radio => radio.checked), false, 'the other group is left alone');
    assert.match(preview.innerHTML, /x=2\.5 y=2\.5 width=43 height=43 rx=3 fill="#ffe94d"/);
    assert.equal(preview.innerHTML.match(/fill="#ff8af2"/g).length, 3);
    primary.custom.value = '#123456';
    fieldset.oninput({ target: primary.custom });
    assert.deepEqual({ ...read('Player') }, { name: 'Player', color: '#123456', secondaryColor: '#ff8af2' });
    assert.equal(primary.custom.parentNode.dataset.selected, true);
    assert.equal(primary.radios.some(radio => radio.checked), false);
    assert.equal(pink.checked, true, 'the secondary choice survives a primary change');
    assert.match(preview.innerHTML, /fill="#123456"/);
});

test('creating and editing profiles saves both colours independently outside their data', async () => {
    const { app, context, setProfiles, loadEvents } = createApp();
    setProfiles({ old: { name: 'Old', color: '#ffe94d', secondaryColor: '#ABCDEF', data: app('emptyProfile()') } });
    loadEvents();
    context.askProfile = async (title, values) => {
        assert.equal(title, 'Nuevo perfil');
        assert.deepEqual({ ...values }, { name: '', color: '#a6ff4d', secondaryColor: '#5ef0ff' });
        return { name: 'New', color: '#ff8af2', secondaryColor: '#123456' };
    };
    app('ACTIONS.pnew()');
    await flush();
    const created = app('store.profs[store.cur]');
    assert.equal(created.name, 'New');
    assert.equal(created.color, '#ff8af2');
    assert.equal(created.secondaryColor, '#123456');
    assert.equal(created.data.color, undefined);
    assert.equal(created.data.secondaryColor, undefined);
    context.askProfile = async (title, values) => {
        assert.equal(title, 'Editar perfil');
        assert.equal(values.name, 'Old');
        assert.equal(values.color, '#ffe94d');
        assert.equal(values.secondaryColor, '#ABCDEF');
        return { name: 'Edited', color: '#123456', secondaryColor: values.secondaryColor };
    };
    app('ACTIONS.pedit(null, "old")');
    await flush();
    assert.equal(app('store.profs.old.name'), 'Edited');
    assert.equal(app('store.profs.old.color'), '#123456');
    assert.equal(app('store.profs.old.secondaryColor'), '#ABCDEF');
    context.askProfile = async (title, values) => ({ name: values.name, color: values.color, secondaryColor: '#123456' });
    app('ACTIONS.pedit(null, "old")');
    await flush();
    assert.equal(app('store.profs.old.color'), '#123456');
    assert.equal(app('store.profs.old.secondaryColor'), '#123456', 'identical colours are allowed');
    assert.equal(created.color, '#ff8af2');
    assert.equal(created.secondaryColor, '#123456');
});

test('export and import preserve profile metadata separately from level data', async () => {
    const { app, context, setProfiles, loadEvents } = createApp();
    setProfiles({ a: { name: 'Player', color: '#123456', secondaryColor: '#ABCDEF', data: app('emptyProfile()') } });
    loadEvents();
    let exported;
    context.Blob = Blob;
    context.URL = { createObjectURL: blob => { exported = blob; return 'blob:test'; }, revokeObjectURL() {} };
    context.setTimeout = () => {};
    context.document.createElement = () => ({ click() {} });
    app('ACTIONS.exp(null)');
    const json = await exported.text();
    assert.equal(JSON.parse(json).profileColor, '#123456');
    assert.equal(JSON.parse(json).profileSecondaryColor, '#ABCDEF');
    assert.equal(JSON.parse(json).profileName, 'Player');
    context.askProfile = async (title, values) => {
        assert.equal(title, 'Importar perfil');
        assert.deepEqual({ ...values }, { name: 'Player', color: '#123456', secondaryColor: '#ABCDEF' });
        return values;
    };
    context.document.body.onchange({ target: { id: 'fi', dataset: {}, files: [{ name: 'export.json', text: async () => json }] } });
    await flush();
    assert.equal(app('store.profs[store.cur].color'), '#123456');
    assert.equal(app('store.profs[store.cur].secondaryColor'), '#ABCDEF');
    assert.equal(app('store.profs[store.cur].data.profileColor'), undefined);
    assert.equal(app('store.profs[store.cur].data.profileSecondaryColor'), undefined);
    assert.equal(app('store.profs[store.cur].data.profileName'), undefined);
});

test('import offers an unused preset for an invalid colour and leaves cancellation unchanged', async () => {
    const { app, context, setProfiles, writes, loadEvents } = createApp();
    setProfiles({ a: { name: 'Player', color: '#ffe94d', data: app('emptyProfile()') } });
    loadEvents();
    context.askProfile = async (title, values) => {
        assert.equal(title, 'Importar perfil');
        assert.deepEqual({ ...values }, { name: 'Fallback', color: '#a6ff4d', secondaryColor: '#5ef0ff' });
        return null;
    };
    const json = JSON.stringify({ ...app('emptyProfile()'), profileColor: '"><script>' });
    context.document.body.onchange({ target: { id: 'fi', dataset: {}, files: [{ name: 'Fallback.json', text: async () => json }] } });
    await flush();
    assert.equal(app('Object.keys(store.profs).length'), 1);
    assert.equal(writes(), 0);
});

test('importing older files or invalid secondary colours supplies the default outside data', async () => {
    for (const secondaryColor of [undefined, null, '#abc', '"><script>']) {
        const { app, context, setProfiles, loadEvents } = createApp();
        setProfiles({ a: { name: 'Player', color: '#ffe94d', secondaryColor: '#123456', data: app('emptyProfile()') } });
        loadEvents();
        context.askProfile = async (title, values) => {
            assert.equal(values.color, '#ABCDEF');
            assert.equal(values.secondaryColor, '#5ef0ff');
            return values;
        };
        const json = JSON.stringify({ ...app('emptyProfile()'), profileColor: '#ABCDEF', profileSecondaryColor: secondaryColor });
        await app('importProfile')({ name: 'Legacy.json', text: async () => json });
        assert.equal(app('store.profs[store.cur].name'), 'Legacy');
        assert.equal(app('store.profs[store.cur].color'), '#ABCDEF');
        assert.equal(app('store.profs[store.cur].secondaryColor'), '#5ef0ff');
        assert.equal(app('store.profs[store.cur].data.profileSecondaryColor'), undefined);
    }
});
