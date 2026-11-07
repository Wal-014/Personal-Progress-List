import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

const { context, app } = loadScripts(['js/config.js', 'js/i18n.js', 'js/utils.js', 'js/state.js', 'js/components/faces.js', 'js/components/empty-list.js', 'js/components/levels.js', 'js/components/wishlists.js'], { localStorage: {} });

for (const [lang, addLabel, wishTitle, wishText, listTitle, listText, noMatch] of [
    ['es', '+ Añadir nivel', 'Tu wishlist está vacía', 'Añade los niveles que quieres jugar y sigue aquí tu progreso.', 'Aún no hay niveles', 'Añade el primer nivel que hayas superado para empezar tu ranking.', 'Ningún nivel coincide con la búsqueda'],
    ['en', '+ Add level', 'Your wishlist is empty', 'Add the levels you want to play and track your progress here.', 'No levels yet', 'Add the first level you have beaten to start your ranking.', 'No levels match the search']
]) {
    test(`emptyList renders its content and translated action in ${lang}`, () => {
        context.lang = lang;
        app('ui.lang = lang');
        const html = app('emptyList')({ icon: '<svg class=i></svg>', title: 'Empty title', text: 'Empty hint', action: 'test-add' });
        assert.equal(html, `<div class=empty><svg class=i></svg><h3>Empty title</h3><p>Empty hint</p><button class=pri data-act=test-add>${addLabel}</button></div>`);
    });

    for (const hasItems of [false, true])
        test(`wishView renders ${hasItems ? 'items' : 'an empty state outside the grid'} in ${lang}`, () => {
            context.lang = lang;
            app(`profile = emptyProfile(); ui.lang = lang; ui.wl = 'wishlist';
                profile.wishlists = [{ id: 'wishlist', name: 'My wishlist', items: [] }];`);
            if (hasItems)
                app("profile.wishlists[0].items.push({ id: 'wanted', name: 'Wanted level', status: 'todo' })");
            const html = app('wishView()');
            const header = html.split(hasItems ? '<div class=wl>' : '<div class=empty>')[0];
            assert.ok(header.startsWith('<div class="wh">'));
            assert.ok(header.includes(`<button class=pri data-act=wadd>${addLabel}</button>`));
            if (hasItems) {
                assert.match(html, /<div class=wl><div class="obj wi s-todo" data-id="wanted"/);
                assert.ok(html.includes('<span class=nm>Wanted level</span>'));
                assert.doesNotMatch(html, /class=empty/);
            }
            else {
                assert.ok(html.endsWith(`<div class=empty>${app('ICONS.wish')}<h3>${wishTitle}</h3><p>${wishText}</p><button class=pri data-act=wadd>${addLabel}</button></div>`));
                assert.doesNotMatch(html, /class=wl\b/);
            }
        });

    for (const kind of ['classic', 'platform']) {
        test(`list renders an empty ${kind} state in ${lang} even with levels of the other kind`, () => {
            context.lang = lang;
            context.kind = kind;
            app(`profile = emptyProfile(); ui.lang = lang; ui.tab = kind; ui.q = ''; ui.tagFilter = [];
                profile.levels = [{ id: 'other', name: 'Other level', kind: kind == 'classic' ? 'platform' : 'classic' }];`);
            const html = app('list()');
            assert.equal(html, `<div id=lst></div><div class=empty>${app('ICONS.add')}<h3>${listTitle}</h3><p>${listText}</p><button class=pri data-act=add>${addLabel}</button></div>`);
        });

        test(`list distinguishes search and tag misses from a matching ${kind} level in ${lang}`, () => {
            context.lang = lang;
            context.kind = kind;
            app(`profile = emptyProfile(); ui.lang = lang; ui.tab = kind;
                profile.levels = [{ id: 'ranked', name: 'Matching level', kind, tags: ['Played'] }];
                profile.order[kind] = ['ranked'];`);
            for (const filters of ['ui.q = "absent"; ui.tagFilter = []', 'ui.q = ""; ui.tagFilter = ["Missing"]']) {
                app(filters);
                const html = app('list()');
                assert.equal(html, `<div id=lst></div><p class=by>${noMatch}</p>`);
                assert.doesNotMatch(html, /class=empty/);
            }
            app('ui.q = "matching"; ui.tagFilter = ["Played"]');
            const html = app('list()');
            assert.match(html, /<div id=lst><div class="obj lv top1" data-id="ranked"/);
            assert.ok(html.includes('<span class=nm>Matching level</span>'));
            assert.doesNotMatch(html, /class=empty/);
            assert.ok(!html.includes(noMatch));
        });
    }
}
