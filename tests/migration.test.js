import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts, syncScripts } from './load-scripts.js';

const plain = value => JSON.parse(JSON.stringify(value));
const data = () => ({ levels: [], order: { classic: [], platform: [] }, wishlists: [], tags: [] });
const level = (id, extra = {}) => ({ id, name: id, kind: 'classic', ...extra });
const localProfile = (extra = {}) => ({ name: 'Local', color: '#123456', secondaryColor: '#abcdef', data: data(), ...extra });

function device() {
    const storage = { gl: 'en' }, nodes = {}, toasts = [], alerts = [], identities = [], opened = [], tasks = [];
    let saves = 0, closed = 0, confirmed = true;
    const closeListeners = [];
    nodes['#md'] = { get innerHTML() { return this.html || ''; }, set innerHTML(value) { this.html = value; if (value) opened.push(value); } };
    nodes['#md dialog'] = { querySelector: selector => selector === '.migration' && nodes['#md'].innerHTML.includes('id=migration') ? {} : null,
        addEventListener: (name, work) => { if (name === 'close') closeListeners.push(work); },
        showModal() {}, close() { closed++; for (const work of closeListeners.splice(0)) work(); }, remove() {} };
    const document = { body: {}, querySelector: selector => nodes[selector] || null, addEventListener() {} };
    const env = loadScripts(['data/demo-data.js', 'js/config.js', 'js/i18n.js', 'js/utils.js', 'js/state.js', 'js/account.js', 'js/cloud-model.js', ...syncScripts, 'js/components/dialogs.js', 'js/components/local-data.js', 'js/components/home.js', 'js/components/shell.js', 'js/events.js'], {
        document, window: { addEventListener() {} }, localStorage: storage,
        queueMicrotask: task => tasks.push(task), setTimeout: task => tasks.push(task), clearTimeout() {},
        navigator: { onLine: true }, render() {}, matchWithAredl() {}, renderTagSuggestions() {}, URL, Blob
    });
    Object.assign(env.context, {
        saveCloud() { saves++; }, showToast: message => toasts.push(message),
        saveOwnProfile: async fields => { identities.push(plain(fields)); return {}; },
        showDialog: async options => { alerts.push(options); return confirmed; }
    });
    const setup = (profs = { a: localProfile() }, cloud = data()) => {
        env.context.profs = profs; env.context.cloudData = cloud;
        env.app("store = { cur: Object.keys(profs)[0], profs }; profile = cloudData; cloudUser = 'owner'; account.status = 'signed-in'; account.user = { id: 'owner' }; account.profile = { display_name: 'Account', color: '#123456', secondary_color: '#abcdef' }; cloudSession = { pulled: true }; ");
        storage.gdp = JSON.stringify({ cur: Object.keys(profs)[0], profs });
    };
    setup();
    return { ...env, setup, storage, nodes, toasts, alerts, identities, opened, tasks, document,
        saves: () => saves, closed: () => closed, confirm: value => { confirmed = value; } };
}

test('offers exclude demos and markers only for the requested account and tolerate damaged marker storage', () => {
    const d = device();
    d.setup({ demo: localProfile({ data: { ...data(), levels: [level('demo1')] } }), real: localProfile({ data: { ...data(), levels: [level('demo1'), level('n1')] } }), wish: localProfile({ data: { ...data(), wishlists: [{ id: 'w1', name: 'Wish', items: [{ id: 'user-item', name: 'Wanted' }] }] } }), tag: localProfile({ data: { ...data(), tags: [{ name: 'Tag', color: '#123456' }] } }) });
    assert.deepEqual(plain(d.app("localProfilesToOffer('owner')")), ['real', 'wish', 'tag']);
    d.storage.gmigrated = JSON.stringify({ owner: ['real'], other: ['wish'] });
    assert.deepEqual(plain(d.app("localProfilesToOffer('owner')")), ['wish', 'tag']);
    assert.deepEqual(plain(d.app("localProfilesToOffer('other')")), ['real', 'tag']);
    for (const raw of ['{', 'null', '[]', '{"owner":42}', '{"owner":[{},null]}']) {
        d.storage.gmigrated = raw;
        assert.deepEqual(plain(d.app("localProfilesToOffer('owner')")), ['real', 'wish', 'tag']);
    }
});

test('bringing merges without replacement, preserves order and colours, and is safe to retry without touching backups', async () => {
    const d = device(), cloud = data(), local = data();
    cloud.levels = [level('clash'), level('gd', { levelId: '123' }), level('named', { name: 'Caf\u00e9 - Test' })];
    cloud.order.classic = ['named', 'gd']; cloud.tags = [{ name: 'Shared', color: '#111111' }];
    cloud.wishlists = [{ id: 'existing', name: 'Account', items: [{ id: 'taken', name: 'Account item', status: 'todo' }] }];
    local.levels = [level('clash', { name: 'Different' }), level('samegd', { name: 'Different GD', levelId: '123' }), level('samename', { name: 'CAFE test' }), level('added'), level('platform', { name: 'Caf\u00e9 Test', kind: 'platform', levelId: '123' })];
    local.order = { classic: ['clash', 'added'], platform: ['platform'] };
    local.tags = [{ name: 'Shared', color: '#222222' }, { name: 'New', color: '#333333' }];
    local.wishlists = [{ id: 'existing', name: 'Ignored', items: [{ id: 'ignored', name: 'Ignored' }] }, { id: 'newwish', name: 'New wish', items: [{ id: 'taken', name: 'Duplicate' }, { id: 'newitem', name: 'New', status: 'todo' }] }, { id: 'another', name: 'Another', items: [{ id: 'newitem', name: 'Repeated' }] }];
    d.setup({ a: localProfile({ data: local }) }, cloud);
    const backup = d.storage.gdp;
    const result = plain(await d.app("bringLocalProfile('a', false)"));
    assert.equal(result.levels, 2); assert.equal(result.wishlists, 3); assert.equal(result.tags, 1);
    assert.equal(result.existing, 6);
    const merged = plain(d.app('profile'));
    assert.deepEqual(merged.levels.map(l => l.id), ['clash', 'gd', 'named', 'added', 'platform']);
    assert.deepEqual(merged.order, { classic: ['named', 'gd', 'added'], platform: ['platform'] });
    assert.deepEqual(merged.tags, [{ name: 'Shared', color: '#111111' }, { name: 'New', color: '#333333' }]);
    assert.deepEqual(merged.wishlists.map(w => w.items.map(i => i.id)), [['taken', 'ignored'], ['newitem'], []]);
    assert.deepEqual(d.identities, []); assert.equal(d.saves(), 1);
    assert.deepEqual(JSON.parse(d.storage.gmigrated), { owner: ['a'] });
    assert.match(d.toasts[0], /Added 2 levels, 3 wishlists and 1 tag/);
    assert.match(d.toasts[0], /6 were already there/);
    await d.app("bringLocalProfile('a', false)");
    assert.deepEqual(plain(d.app('profile')), merged);
    assert.equal(d.storage.gdp, backup);
    assert.deepEqual(plain(d.app('store')), JSON.parse(backup));
});

test('cleaning counts each changed field and merges normalized tags without modifying its input', () => {
    const d = device(), source = data();
    source.levels = [level('n1', { name: '\u0000' + 'N'.repeat(101), creator: '\u0007' + 'C'.repeat(101), notes: 'x'.repeat(5001), link: 'javascript:alert(1)', enj: -20, lik: 20, attN: -1, attC: 1e10, tN: -20, tP: 1e10, tPC: 1e10, deaths: { 50: 3, 101: 2, 20: -1 }, levelId: '12x', tags: [' Shared ', 'Shared', 'X'.repeat(41)] })];
    source.tags = [{ name: ' Shared ', color: '#123456' }, { name: 'Shared', color: '#abcdef' }, { name: 'X'.repeat(41), color: '#654321' }];
    source.wishlists = [{ id: 'w1', name: 'W'.repeat(101), items: [{ id: 'i1', name: 'I'.repeat(101), creator: 'C'.repeat(101), levelId: 'bad', status: 'todo' }] }];
    d.context.source = source;
    const cleaned = plain(d.app('cleanMigrationData(source)'));
    assert.equal(cleaned.adjusted, 21);
    const l = cleaned.data.levels[0];
    assert.equal(l.name, 'N'.repeat(100)); assert.equal(l.creator, 'C'.repeat(100)); assert.equal(l.notes.length, 5000);
    assert.equal(l.link, ''); assert.equal(l.enj, -10); assert.equal(l.lik, 10);
    assert.deepEqual([l.attN, l.attC, l.tN, l.tP, l.tPC], [0, 1e9, 0, 1e9, 1e9]);
    assert.deepEqual(l.deaths, { 50: 3 }); assert.equal(l.levelId, null);
    assert.deepEqual(l.tags, ['Shared', 'X'.repeat(40)]);
    assert.deepEqual(cleaned.data.tags, [{ name: 'Shared', color: '#123456' }, { name: 'X'.repeat(40), color: '#654321' }]);
    assert.equal(cleaned.data.wishlists[0].name.length, 100);
    assert.equal(cleaned.data.wishlists[0].items[0].name.length, 100);
    assert.equal(cleaned.data.wishlists[0].items[0].creator.length, 100);
    assert.equal(cleaned.data.wishlists[0].items[0].levelId, null);
    assert.equal(source.levels[0].notes.length, 5001);
});

test('invalid local data changes nothing and identity is copied only on request', async () => {
    const d = device();
    d.setup({ a: localProfile({ data: { levels: 'bad' } }) });
    const before = plain(d.app('profile'));
    await d.app("bringLocalProfile('a', true)");
    assert.deepEqual(plain(d.app('profile')), before); assert.equal(d.saves(), 0);
    assert.equal(d.storage.gmigrated, undefined); assert.deepEqual(d.identities, []);
    assert.equal(d.alerts[0].title, 'This profile could not be read');
    d.setup({ a: localProfile({ name: 'N'.repeat(41), data: { ...data(), levels: [level('n1')] } }) });
    d.storage.gmigrated = '{';
    await d.app("bringLocalProfile('a', true)");
    assert.deepEqual(d.identities, [{ display_name: 'N'.repeat(40), color: '#123456', secondary_color: '#abcdef' }]);
    assert.deepEqual(JSON.parse(d.storage.gmigrated), { owner: ['a'] });
});

test('migration dialog escapes names, selects active profile and warns only when account has data', () => {
    const d = device();
    d.setup({ a: localProfile({ name: '<img src=x onerror=alert(1)>', data: { ...data(), levels: [level('n1')] } }) });
    let html = d.app('migrationDialog()');
    assert.match(html, /&lt;img/); assert.doesNotMatch(html, /<img/);
    assert.match(html, /type=radio[^>]*checked/); assert.match(html, /Active on this device/);
    assert.match(html, /role=radiogroup|<fieldset/); assert.doesNotMatch(html, /class=warn/);
    assert.doesNotMatch(html, /type=checkbox[^>]*checked/);
    d.app("profile.levels.push({ id: 'cloud', name: 'Cloud' })");
    html = d.app('migrationDialog()'); assert.match(html, /class=warn/); assert.match(html, /already has 1 level and 0 wishlists/);
});

test('local data deletion is confirmed, cannot remove the last or active signed-out profile and writes only gdp', async () => {
    const d = device();
    await d.app("deleteLocalProfile('a')"); assert.equal(d.alerts.length, 0);
    d.setup({ a: localProfile(), b: localProfile() });
    d.app('cloudUser = null');
    await d.app("deleteLocalProfile('a')"); assert.equal(d.alerts.length, 0);
    d.confirm(false); await d.app("deleteLocalProfile('b')"); assert.ok(d.app('store.profs.b'));
    d.confirm(true); await d.app("deleteLocalProfile('b')"); assert.equal(d.app('store.profs.b'), undefined);
    assert.deepEqual(Object.keys(JSON.parse(d.storage.gdp).profs), ['a']); assert.equal(d.saves(), 0);
    d.setup({ a: localProfile(), b: localProfile() });
    const cloud = plain(d.app('profile'));
    await d.app("deleteLocalProfile('a')");
    assert.equal(d.app('store.cur'), 'b'); assert.deepEqual(plain(d.app('profile')), cloud);
});

test('local data cards escape names, expose backup actions and disable recorded migrations and forbidden deletions', () => {
    const d = device();
    d.setup({ a: localProfile({ name: '<script>x</script>' }), b: localProfile() });
    d.storage.gmigrated = '{"owner":["a"]}';
    let html = d.app('localDataDialog()');
    assert.doesNotMatch(html, /<script>/); assert.match(html, /&lt;script&gt;/);
    assert.match(html, /Already in your account/); assert.match(html, /data-act=localbackup/);
    d.app('cloudUser = null'); html = d.app('localDataDialog()');
    assert.doesNotMatch(html, /data-act=localbring/);
    assert.match(html, /data-act=localdelete data-id="a" disabled/);
});

for (const signed of [true, false]) test('home and menus expose accounts, signed-in=' + signed, () => {
    const d = device();
    d.setup({ a: localProfile({ data: { ...data(), levels: [level('n1')] } }) });
    d.app(`account.status = '${signed ? 'signed-in' : 'signed-out'}'; cloudUser = ${signed ? "'owner'" : 'null'}`);
    const card = d.app('profileSwitcher()');
    assert.ok(card.includes('data-act=localdata'));
    assert.equal(card.includes('data-act=asignin'), !signed);
    assert.equal(card.includes('cloud-account'), signed);
    assert.doesNotMatch(card, /pmenu|data-act=(?:pnew|psel|pedit|pdelid)/);
    assert.doesNotMatch(d.app('paletteButtons()'), /data-act=exp/);
    d.context.aredlLine = () => '';
    assert.doesNotMatch(d.app('pauseUI()'), /data-act=imp/);
    for (const action of ['pnew', 'psel', 'pedit', 'pdelid', 'imp', 'exp'])
        assert.equal(d.app('ACTIONS')[action], undefined);
});

test('account Home hides local data for demo-only backups and guests always see it', () => {
    const d = device();
    d.setup({ a: localProfile({ data: d.context.window.DEMO_PROFILE }) });
    assert.doesNotMatch(d.app('profileSwitcher()'), /data-act=localdata/);
    d.app("account.status = 'signed-out'; cloudUser = null; activateProfile('a')");
    assert.match(d.app('profileSwitcher()'), /guest-account/);
    assert.match(d.app('profileSwitcher()'), /data-act=localdata/);
});

test('use on this device is available only signed out for inactive backups and persists the switch', () => {
    const d = device();
    d.setup({ a: localProfile(), b: localProfile({ name: 'Other', data: { ...data(), levels: [level('n2'), level('n3', { kind: 'platform' })] } }) });
    d.load(['js/api.js']);
    d.app("aredlCache = [{ k: 'd', n: 'n2', i: 123, p: 42 }, { k: 'p', n: 'n3', i: 456, p: 84 }]");
    assert.doesNotMatch(d.app('localDataDialog()'), /data-act=localuse/);
    const cloud = d.app('profile');
    d.app("ACTIONS.localuse(null, 'b')");
    assert.equal(d.app('profile'), cloud);
    assert.equal(d.app('store.cur'), 'a');
    d.app("cloudUser = null; account.status = 'signed-out'; activateProfile('a'); ui.sel = 'old'; ui.wl = 'old'");
    const html = d.app('localDataDialog()');
    assert.doesNotMatch(html, /data-act=localuse data-id="a"/);
    assert.match(html, /data-act=localuse data-id="b">Use on this device/);
    d.app("ACTIONS.localuse(null, 'missing')");
    assert.equal(d.app('store.cur'), 'a');
    d.app("ACTIONS.localuse(null, 'b')");
    assert.equal(d.app('store.cur'), 'b');
    assert.equal(d.app('profile'), d.app('store.profs.b.data'));
    assert.equal(d.app('ui.sel'), null);
    assert.equal(d.app('ui.wl'), null);
    assert.equal(JSON.parse(d.storage.gdp).cur, 'b');
    assert.equal(d.app('profile.levels[0].ar?.p'), 42);
    assert.equal(d.app('profile.levels[1].ar?.p'), 84);
    assert.deepEqual(JSON.parse(d.storage.gdp).profs.b.data.levels.map(entry => entry.ar?.p), [42, 84]);
    assert.equal(d.closed(), 1);
    assert.equal(d.saves(), 0);
});

for (const signed of [false, true]) test('import backup adds a local profile, signed-in=' + signed, async () => {
    const d = device(), originalCloud = d.app('profile');
    d.app(`cloudUser = ${signed ? "'owner'" : 'null'}; account.status = '${signed ? 'signed-in' : 'signed-out'}'; ui.sel = 'old'; ui.wl = 'old'`);
    if (!signed) d.app("activateProfile('a')");
    const before = plain(d.app('profile'));
    let picked = 0;
    d.nodes['#fi'] = { click() { picked++; } };
    assert.match(d.app('localDataDialog()'), /data-act=localimport>Import backup/);
    d.app('ACTIONS.localimport()');
    assert.equal(picked, 1);
    d.context.askProfile = async (title, values) => values;
    const imported = { ...data(), levels: [level('imported')], profileName: 'Backup', profileColor: '#123456', profileSecondaryColor: '#abcdef' };
    await d.app('importProfile')({ name: 'Backup.json', text: async () => JSON.stringify(imported) });
    const id = d.app("Object.keys(store.profs).find(id => id != 'a')");
    assert.ok(id);
    assert.equal(d.app('store.profs')[id].name, 'Backup');
    assert.equal(JSON.parse(d.storage.gdp).profs[id].data.levels[0].id, 'imported');
    assert.equal(d.saves(), 0, 'import must never queue an account save');
    if (signed) {
        assert.equal(d.app('profile'), originalCloud);
        assert.deepEqual(plain(d.app('profile')), before);
        assert.equal(d.app('store.cur'), 'a');
        assert.equal(d.app('cloudSession.pulled'), true);
        assert.match(d.nodes['#md'].innerHTML, new RegExp('data-act=localbring data-id="' + id + '">'));
        d.app('cloudSession.pulled = false');
        assert.match(d.app('localDataDialog()'), new RegExp('data-act=localbring data-id="' + id + '" disabled'));
    } else {
        assert.equal(d.app('store.cur'), id);
        assert.equal(d.app('profile'), d.app('store.profs')[id].data);
        assert.equal(d.app('ui.sel'), null);
        assert.equal(d.app('ui.wl'), null);
    }
});

test('automatic migration waits for a successful pull and unblocked UI, and Not now lasts this page session', () => {
    const d = device();
    d.setup({ a: localProfile({ data: { ...data(), levels: [level('n1')] } }) });
    d.app('cloudSession.pulled = false; maybeOfferMigration()'); assert.equal(d.opened.length, 0);
    d.app('cloudSession.pulled = true'); d.nodes['form, dialog[open], .ms[open]'] = {};
    d.app('maybeOfferMigration()'); assert.equal(d.opened.length, 0);
    delete d.nodes['form, dialog[open], .ms[open]'];
    d.app('maybeOfferMigration()'); assert.equal(d.opened.length, 1);
    d.app('deferMigration(); maybeOfferMigration()'); assert.equal(d.opened.length, 1);
});

test('backup download uses the legacy JSON shape and profile filename', async () => {
    const d = device(), links = [], blobs = [];
    d.setup({ a: localProfile({ name: 'My profile / \u4f60\u597d' }) });
    d.document.createElement = () => { const link = { click() {} }; links.push(link); return link; };
    d.context.URL = { createObjectURL: blob => { blobs.push(blob); return 'blob:backup'; }, revokeObjectURL() {} };
    d.app("downloadLocalBackup('a')");
    assert.equal(links[0].download, 'My-profile-\u4f60\u597d.json');
    assert.deepEqual(JSON.parse(await blobs[0].text()), { ...data(), profileName: 'My profile / \u4f60\u597d', profileColor: '#123456', profileSecondaryColor: '#abcdef' });
});


for (const [field, input, expected] of [
    ['name', '\u0001A\u007f', 'A'], ['creator', 'C'.repeat(101), 'C'.repeat(100)],
    ['notes', 'x'.repeat(5001), 'x'.repeat(5000)], ['link', 'data:text/plain,bad', ''],
    ['link', 'https://example.test/' + 'x'.repeat(500), ('https://example.test/' + 'x'.repeat(500)).slice(0, 500)],
    ['enj', 11, 10], ['lik', -11, -10], ['attN', -1, 0], ['attC', 1e9 + 1, 1e9],
    ['tN', -1, 0], ['tP', 1e9 + 1, 1e9], ['tPC', 1e9 + 1, 1e9],
    ['deaths', { 101: 1, 50: 2.5, 99: -1, 20: 10000001 }, { 20: 10000000 }],
    ['levelId', '123abc', null], ['levelId', '1234567890123', null], ['diff', 'malicious', null],
    ['rating', 'malicious', null], ['date', '2026-02-31', null], ['tags', [' A ', 'A'], ['A']],
]) test(`cleaning adjusts ${field} exactly once for ${JSON.stringify(input).slice(0, 40)}`, () => {
    const d = device();
    d.context.source = { ...data(), levels: [level('n1', { [field]: input })] };
    const result = plain(d.app('cleanMigrationData(source)'));
    assert.deepEqual(result.data.levels[0][field], expected);
    assert.equal(result.adjusted, 1);
});

test('unchanged valid rows stay unchanged and unknown metadata meets database constraints', () => {
    const d = device();
    const good = level('n1', { name: 'Good', creator: 'Creator', levelId: '123', diff: 'Hard', rating: 'epic', date: '2026-11-12', link: 'HTTPS://example.test', notes: 'Note', deaths: { 50: 1 }, enj: -10, lik: 10, tN: 0, tP: 1e9, tPC: null });
    d.context.source = { ...data(), levels: [good] };
    const result = plain(d.app('cleanMigrationData(source)'));
    assert.deepEqual(result.data.levels[0], good); assert.equal(result.adjusted, 0);
    d.context.source.levels[0] = level('n2', { ar: 'bad', date: '0000-01-01', link: 'https://example.test/\u0000' });
    const bad = plain(d.app('cleanMigrationData(source)'));
    assert.equal(bad.data.levels[0].ar, null); assert.equal(bad.data.levels[0].date, null);
    assert.equal(bad.data.levels[0].link, 'https://example.test/'); assert.equal(bad.adjusted, 3);
});

test('malformed profile collections cannot prevent offers or home from rendering', () => {
    const d = device(); d.setup({ a: localProfile({ data: { levels: 'bad', tags: 3, wishlists: {} } }) });
    assert.deepEqual(plain(d.app("localProfilesToOffer('owner')")), []);
});

test('two distinct Geometry Dash IDs with the same name are preserved', async () => {
    const d = device();
    d.setup({ a: localProfile({ data: { ...data(), levels: [level('local', { name: 'Same name', levelId: '43' })] } }) }, { ...data(), levels: [level('remote', { name: 'Same name', levelId: '42' })] });
    await d.app("bringLocalProfile('a', false)");
    assert.deepEqual(plain(d.app('profile.levels.map(l => l.id)')), ['remote', 'local']);
});

test('retry without readable or writable markers still keeps a single copy of every row', async () => {
    const d = device();
    d.setup({ a: localProfile({ data: { ...data(), levels: [level('bad/id', { name: 'A' })], order: { classic: ['bad/id'], platform: [] }, wishlists: [{ id: 'bad/wish', name: 'Wish', items: [{ id: 'bad/item', name: 'Wanted', status: 'todo' }] }] } }) });
    Object.defineProperty(d.storage, 'gmigrated', { get() { throw Error('Storage blocked'); }, set() { throw Error('Storage blocked'); } });
    await d.app("bringLocalProfile('a', false)");
    const once = plain(d.app('profile'));
    await d.app("bringLocalProfile('a', false)");
    assert.deepEqual(plain(d.app('profile')), once);
    assert.equal(once.levels.length, 1); assert.equal(once.wishlists[0].items.length, 1);
    assert.match(once.levels[0].id, /^[A-Za-z0-9_-]{1,40}$/);
    assert.deepEqual(once.order.classic, [once.levels[0].id]);
});

test('identity errors keep the copied data and account changes during the request do not close a new dialog', async () => {
    const d = device(); d.setup({ a: localProfile({ data: { ...data(), levels: [level('n1')] } }) });
    d.context.saveOwnProfile = async () => ({ error: 'authOffline' });
    await d.app("bringLocalProfile('a', true)");
    assert.equal(d.app('profile.levels.length'), 1); assert.equal(d.alerts[0].title, d.app("t('authOffline')"));
    const closed = d.closed();
    d.context.saveOwnProfile = async () => { d.app("cloudUser = 'other'"); return {}; };
    await d.app("bringLocalProfile('a', true)"); assert.equal(d.closed(), closed);
});

test('warning reflects wishlists but not tags alone, and the active offered profile wins selection', () => {
    const d = device();
    d.setup({ empty: localProfile(), active: localProfile({ data: { ...data(), levels: [level('n1')] } }), other: localProfile({ data: { ...data(), levels: [level('n2')] } }) });
    let html = d.app("store.cur = 'active'; migrationDialog()");
    assert.match(html, /value="active" checked/);
    d.app("profile.tags.push({ name: 'Tag', color: '#123456' })"); assert.doesNotMatch(d.app('migrationDialog()'), /class=warn/);
    d.app("profile.wishlists.push({ id: 'w', name: 'Wish', items: [] })"); html = d.app('migrationDialog()');
    assert.match(html, /already has 0 levels and 1 wishlist/);
});

test('named actions use the chosen local profile, require a pull and disable duplicate submission', async () => {
    const d = device();
    d.setup({ a: localProfile(), b: localProfile({ data: { ...data(), levels: [level('n1')] } }) });
    d.nodes['#migration [name=local-profile]:checked'] = { value: 'b' };
    d.nodes['#migration-identity'] = { checked: false };
    const button = { disabled: false };
    const first = d.app('ACTIONS.migrationconfirm')(button);
    await d.app('ACTIONS.migrationconfirm')(button); await first;
    assert.equal(d.saves(), 1); assert.equal(d.app('profile.levels[0].id'), 'n1');
    d.app('cloudSession.pulled = false'); await d.app("bringLocalProfile('a', false)");
    assert.equal(d.saves(), 1);
});


test('an empty wishlist is not real progress offered for migration', () => {
    const d = device();
    d.setup({ a: localProfile({ data: { ...data(), levels: [level('demo1')], wishlists: [{ id: 'w', name: 'Empty', items: [] }] } }) });
    assert.deepEqual(plain(d.app("localProfilesToOffer('owner')")), []);
});


test('optional identity keeps forty full Unicode characters and tolerates an empty local display name', async () => {
    const d = device();
    d.setup({ a: localProfile({ name: '\u{1f600}'.repeat(41) }) });
    await d.app("bringLocalProfile('a', true)");
    assert.equal(Array.from(d.identities[0].display_name).length, 40);
    d.app("store.profs.a.name = ''; account.profile = null");
    await d.app("bringLocalProfile('a', true)");
    assert.equal(d.identities[1].display_name, 'Name');
});


for (const addition of ['none', 'level', 'item', 'tag']) test(`real demo fixture is offered only with user data: ${addition}`, () => {
    const d = device(), demo = plain(d.context.window.DEMO_PROFILE);
    if (addition === 'level') demo.levels.push(level('user-level'));
    if (addition === 'item') demo.wishlists[0].items.push({ id: 'user-item', name: 'User item' });
    if (addition === 'tag') demo.tags.push({ name: 'User tag', color: '#123456' });
    d.setup({ a: localProfile({ data: demo }) });
    assert.deepEqual(plain(d.app("localProfilesToOffer('owner')")), addition === 'none' ? [] : ['a']);
    assert.equal(d.app('profileSwitcher()').includes('data-act=localdata'), addition !== 'none');
});

test('a missing or malformed demo definition does not block real profiles', () => {
    const d = device();
    d.setup({ a: localProfile({ data: { ...data(), levels: [level('demo-user-added')] } }) });
    for (const missing of [undefined, null, {}, { levels: 'bad', tags: null, wishlists: 42 }]) {
        d.context.window.DEMO_PROFILE = missing;
        assert.deepEqual(plain(d.app("localProfilesToOffer('owner')")), ['a']);
    }
});

test('shared demo wishlists append new items from both profiles without replacing account metadata', async () => {
    const d = device(), a = plain(d.context.window.DEMO_PROFILE), b = plain(d.context.window.DEMO_PROFILE);
    a.wishlists[0].items.push({ id: 'user-a', name: 'First user item', status: 'todo' });
    b.wishlists[0].items.push({ id: 'user-b', name: 'Second user item', status: 'todo' });
    d.setup({ a: localProfile({ data: a }), b: localProfile({ data: b }) });
    const first = plain(await d.app("bringLocalProfile('a', false)")); assert.equal(first.wishlists, 1);
    d.app("profile.wishlists[0].name = 'Account name'");
    const second = plain(await d.app("bringLocalProfile('b', false)")); assert.equal(second.wishlists, 1);
    assert.deepEqual(plain(d.app('profile.wishlists[0].items.map(item => item.id)')), ['i1', 'i2', 'i3', 'user-a', 'user-b']);
    assert.equal(d.app('profile.wishlists[0].name'), 'Account name');
    const repeat = plain(await d.app("bringLocalProfile('b', false)"));
    assert.equal(repeat.wishlists, 0); assert.equal(repeat.existing, b.levels.length + b.tags.length + 4);
    assert.equal(d.app('profile.wishlists.length'), 1);
    assert.equal(d.app('profile.wishlists[0].items.length'), 5);
});

test('cut tag names are trimmed again in both tag rows and level assignments', () => {
    const d = device(), name = 'x'.repeat(39) + ' tail';
    d.context.source = { ...data(), levels: [level('n1', { tags: [name] })], tags: [{ name, color: '#123456' }] };
    let cleaned = plain(d.app('cleanMigrationData(source)'));
    assert.equal(cleaned.data.tags[0].name, 'x'.repeat(39));
    assert.deepEqual(cleaned.data.levels[0].tags, ['x'.repeat(39)]); assert.equal(cleaned.adjusted, 2);
    d.context.source.tags = [];
    cleaned = plain(d.app('cleanMigrationData(source)'));
    assert.equal(cleaned.data.tags[0].name, 'x'.repeat(39));
});

test('automatic offer records deferral immediately while a manual opening remains available', () => {
    const d = device(); d.setup({ a: localProfile({ data: { ...data(), levels: [level('n1')] } }) });
    d.app('maybeOfferMigration(); maybeOfferMigration()');
    assert.equal(d.opened.length, 1);
    d.app("openLocalMigration('a')"); assert.equal(d.opened.length, 2);
    d.app('deferMigration(); maybeOfferMigration()'); assert.equal(d.opened.length, 2);
});

for (const [lang, expected, toast] of [
    ['en', '1 level \u00b7 1 wishlist \u00b7 1 tag', 'Added 1 level, 1 wishlist and 1 tag to your account.'],
    ['es', '1 nivel \u00b7 1 wishlist \u00b7 1 etiqueta', 'Se a\u00f1adieron 1 nivel, 1 wishlist y 1 etiqueta a tu cuenta.']
]) test(`singular profile counts and result toast in ${lang}`, async () => {
    const d = device();
    d.setup({ a: localProfile({ data: { ...data(), levels: [level('n1')], wishlists: [{ id: 'wish', name: 'Wish', items: [{ id: 'user-item', name: 'Wanted', status: 'todo' }] }], tags: [{ name: 'User tag', color: '#123456' }] } }) });
    d.app(`ui.lang = '${lang}'`);
    assert.equal(d.app('localProfileCounts(store.profs.a)'), expected);
    await d.app("bringLocalProfile('a', false)");
    assert.equal(d.toasts[0], toast);
});

test('guest summary omits the active badge and keeps the hint below the compact card row', () => {
    const d = device(); d.app("cloudUser = null; account.status = 'signed-out'");
    const html = d.app('profileSwitcher()');
    assert.doesNotMatch(html, /Active on this device/);
    assert.ok(html.indexOf('data-act=asignin') < html.indexOf('Saved only on this device'));
});


test('editing the first profile still counts as real data when startup reused the demo object', () => {
    const d = device();
    d.setup({ a: localProfile({ data: d.context.window.DEMO_PROFILE }) });
    assert.deepEqual(plain(d.app("localProfilesToOffer('owner')")), []);
    d.app("store.profs.a.data.levels.push({ id: 'user-level', name: 'User level', kind: 'classic' })");
    assert.deepEqual(plain(d.app("localProfilesToOffer('owner')")), ['a']);
});
