import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

for (const kind of ['classic', 'platform']) {
    test(`bulk deletion confirms the count and preserves surviving ${kind} levels in order`, async () => {
        const other = kind === 'classic' ? 'platform' : 'classic';
        const profile = {
            levels: ['a', 'b', 'c', 'd', 'unranked'].map(id => ({ id, kind })).concat({ id: 'other', kind: other }),
            order: { [kind]: ['d', 'b', 'c', 'a'], [other]: ['other'] }
        };
        const ui = { tab: kind, sel: 'a' }, prompts = [];
        const count = {}, button = {}, row = { setAttribute(key, value) { this[key] = value; } };
        let approved = false, saves = 0;
        const { app, context } = loadScripts(['js/components/levels.js'], {
            ui, profile, isListTab: () => true, render() {},
            findLevel: id => profile.levels.find(level => level.id === id),
            qs: selector => ({ '.list-selection output': count, '[data-act=list-delete]': button })[selector],
            save: () => saves++, t: key => key === 'levelSelectionCount' ? '{n} selected' : 'Delete {n} levels?',
            askConfirm: async title => { prompts.push(title); return approved; }
        });
        app('renderList = () => {}; toggleLevelSelection()');
        assert.match(app('listSelectionControls()'), /data-act=list-delete disabled/);
        for (const id of ['a', 'b', 'b', 'c', 'unranked', 'other'])
            app('pickListLevel')(row, id);
        assert.equal(row['aria-pressed'], 'true');
        assert.equal(button.disabled, false);
        assert.equal(count.textContent, '3 selected');
        await app('deleteSelectedLevels()');
        assert.deepEqual(prompts, ['Delete 3 levels?']);
        assert.equal(profile.levels.length, 6);
        approved = true;
        await app('deleteSelectedLevels()');
        assert.deepEqual(Array.from(profile.levels, level => level.id), ['b', 'd', 'other']);
        assert.deepEqual(Array.from(profile.order[kind]), ['d', 'b']);
        assert.deepEqual(profile.order[other], ['other']);
        assert.equal(ui.sel, null);
        assert.equal(ui.levelSelection, null);
        assert.equal(saves, 1);
        context.canEdit = () => false;
        app('toggleLevelSelection()');
        assert.equal(ui.levelSelection, null);
    });
}

test('switching profiles during confirmation leaves both profiles intact', async () => {
    const original = { levels: [{ id: 'a', kind: 'classic' }], order: { classic: ['a'] } };
    let confirm;
    const { app, context } = loadScripts(['js/components/levels.js'], {
        ui: { tab: 'classic' }, profile: original, qs() {}, render() {},
        t: () => '{n}', isListTab: () => true,
        askConfirm: () => new Promise(resolve => { confirm = resolve; })
    });
    app('renderList = () => {}; toggleLevelSelection(); ui.levelSelection.ids.add("a")');
    const deletion = app('deleteSelectedLevels()');
    context.profile = structuredClone(original);
    confirm(true);
    await deletion;
    assert.equal(app('currentLevelSelection()'), null);
    assert.equal(original.levels.length, 1);
    assert.deepEqual(original, context.profile);
});
