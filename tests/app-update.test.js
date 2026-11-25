import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

function updateFixture() {
    const appended = [], listeners = {}, nodes = {};
    let reloads = 0;
    const document = {
        visibilityState: 'visible', body: { append: node => { appended.push(node); nodes['.update-notice'] = node; } },
        querySelector: selector => nodes[selector] ?? null,
        createElement: () => ({ setAttribute(name, value) { this[name] = value; } }),
        addEventListener: (name, handler) => { listeners[name] = handler; }
    };
    const f = loadScripts(['js/i18n.js', 'js/utils.js', 'js/app-update.js'], {
        ui: { lang: 'en' }, document, navigator: { onLine: true }, cloudUser: null, cloudSync: { pending: 0 },
        location: { reload: () => reloads++ }, levelFormChanged: () => false,
        window: { addEventListener: (name, handler) => { listeners['window:' + name] = handler; } }, setInterval: () => 0
    });
    return { ...f, document, nodes, appended, listeners, get reloads() { return reloads; } };
}

test('a new version reloads a tab with nothing to lose once', () => {
    const f = updateFixture();
    f.app('newVersionReady()');
    assert.equal(f.reloads, 1);
    assert.equal(f.appended.length, 0);
});

for (const [label, setup] of [
    ['an open dialog', f => { f.nodes['dialog[open]'] = {}; }],
    ['an edited level with changes', f => { f.context.levelFormChanged = () => true; }],
    ['account changes still uploading', f => { f.app("cloudUser = 'u'; cloudSync.pending = 2"); }]
])
    test(`with ${label}, a new version waits behind a notice and applies when the tab is hidden with nothing to lose`, () => {
        const f = updateFixture();
        setup(f);
        f.app('newVersionReady(); newVersionReady()');
        assert.equal(f.reloads, 0);
        assert.equal(f.appended.length, 1);
        assert.equal(f.appended[0].role, 'status');
        assert.match(f.appended[0].innerHTML, /A new version of the app is ready\.<\/span><button type=button class=pri data-act=appupdate>Update now<\/button>/);
        f.document.visibilityState = 'hidden';
        f.app('updateOnVisibility')({ update: async () => {} });
        assert.equal(f.reloads, 0);
        delete f.nodes['dialog[open]'];
        f.context.levelFormChanged = () => false;
        f.app('cloudSync.pending = 0');
        f.app('updateOnVisibility')({ update: async () => {} });
        assert.equal(f.reloads, 1);
    });

test('open tabs look for a new version when shown or back online, at most every five minutes and never offline', () => {
    const f = updateFixture();
    let checks = 0;
    const registration = { update: async () => { checks++; } };
    f.app('watchForUpdates')(registration);
    f.listeners.visibilitychange();
    assert.equal(checks, 1);
    f.listeners['window:online']();
    assert.equal(checks, 1, 'a second check within five minutes is skipped');
    f.app('checkForUpdate')(registration, Date.now() + 5 * 60 * 1000 + 1);
    assert.equal(checks, 2);
    f.app('navigator.onLine = false');
    f.app('checkForUpdate')(registration, Date.now() + 60 * 60 * 1000);
    assert.equal(checks, 2);
    f.app('navigator.onLine = true; updateWaiting = false');
    f.document.visibilityState = 'hidden';
    f.listeners.visibilitychange();
    assert.equal(f.reloads, 0, 'hiding a tab without a waiting update does not reload it');
});

test('a failed update check is ignored', async () => {
    const f = updateFixture();
    f.app('checkForUpdate')({ update: () => Promise.reject(new Error('offline')) }, Date.now() + 10 * 60 * 1000);
    await new Promise(setImmediate);
});
