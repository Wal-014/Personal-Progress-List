import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

function formFixture() {
    const errors = [], focused = [];
    let renders = 0;
    const selected = { html: '', insertAdjacentHTML(position, html) { this.html += html; } };
    const nodes = { '#tgq': { value: '', focus() { focused.push('tgq'); } }, '#tgr': { innerHTML: '' }, '#tgs': selected };
    const localStorage = {};
    const f = loadScripts(['js/config.js', 'js/i18n.js', 'js/utils.js', 'js/state.js', 'js/components/levels.js', 'js/events.js'], {
        localStorage, document: {
            body: {}, addEventListener() {}, querySelector: selector => nodes[selector],
            querySelectorAll: selector => selector == '#tgs input' ? [...selected.html.matchAll(/name=tg value="([^"]*)"/g)].map(match => ({ value: match[1] })) : []
        },
        window: { addEventListener() {} }, render: () => renders++,
        setFieldError: (input, message) => errors.push(message)
    });
    f.app(`ui.lang = 'en'; store = { cur: 'p', profs: { p: { data: emptyProfile() } } }; profile = store.profs.p.data;
        profile.tags.push({ name: 'Fluked', color: '#123456' });
        profile.levels.push({ id: 'l', name: 'Saved', kind: 'classic', tags: [], notes: 'saved note' })`);
    return { ...f, nodes, errors, focused, localStorage, selected, get renders() { return renders; } };
}

test('creating a tag from the level form saves it to the catalog and selects it without saving the level or redrawing', () => {
    const f = formFixture();
    f.nodes['#tgq'].value = 'Hard';
    f.app('ACTIONS.tgnew')({ dataset: { v: 'Hard' } });
    assert.deepEqual(JSON.parse(f.localStorage.gdp).profs.p.data.tags, [{ name: 'Fluked', color: '#123456' }, { name: 'Hard', color: '#00e5ff' }]);
    assert.match(f.selected.html, /data-act=tgrm data-v="Hard"/);
    assert.equal(f.nodes['#tgq'].value, '');
    assert.deepEqual(f.focused, ['tgq']);
    assert.equal(f.renders, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(f.app('findLevel("l")'))), { id: 'l', name: 'Saved', kind: 'classic', tags: [], notes: 'saved note' });
    assert.doesNotMatch(f.nodes['#tgr'].innerHTML, /data-v="Hard"/);
});

test('creating a tag uses the tag manager rules and changes nothing when they reject the name', () => {
    const f = formFixture();
    for (const [name, message] of [['Fluked', 'A tag with that name already exists'], ['x'.repeat(25), 'Up to 24 characters per tag.']]) {
        f.app('ACTIONS.tgnew')({ dataset: { v: name } });
        assert.equal(f.errors.at(-1), message);
    }
    assert.equal(f.localStorage.gdp, undefined);
    assert.equal(f.selected.html, '');
    assert.equal(f.app('profile.tags.length'), 1);
});

test('picking an existing tag selects it and returns to the search', () => {
    const f = formFixture();
    f.nodes['#tgq'].value = 'flu';
    f.app('ACTIONS.tgadd')({ dataset: { v: 'Fluked' } });
    assert.match(f.selected.html, /data-v="Fluked"/);
    assert.equal(f.nodes['#tgq'].value, '');
    assert.deepEqual(f.focused, ['tgq']);
    assert.equal(f.localStorage.gdp, undefined);
});
