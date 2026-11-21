export async function checkDrawerClose(page) {
    const viewport = page.viewportSize();
    const theme = await page.evaluate('ui.theme');
    const sidebar = page.locator('#shell-sidebar');
    const opener = page.locator('#shell-menu');
    const close = sidebar.locator('[data-act=drawerclose]');
    const results = [];
    try {
        for (const appearance of ['nebula', 'porcelain']) {
            await page.evaluate('ui.theme = ' + JSON.stringify(appearance) + '; render()');
            for (const [width, height] of [[390, 844], [1100, 800], [1440, 900]]) {
                await page.setViewportSize({ width, height });
                const label = appearance + ' ' + width + 'x' + height;
                if (width >= 1280) {
                    if (!await close.evaluate(button => button.ownerDocument.defaultView.getComputedStyle(button.parentElement).display === 'none' &&
                        button.getClientRects().length === 0))
                        throw new Error(label + ': the permanent sidebar shows a close button');
                } else {
                    await opener.press('Enter');
                    await sidebar.waitFor();
                    const ready = await close.evaluate(button => {
                        const { top, bottom, width, height } = button.getBoundingClientRect();
                        const profileTop = button.closest('#shell-sidebar').querySelector('.shell-identity').getBoundingClientRect().top;
                        return top >= 0 && bottom <= profileTop && width >= 44 && height >= 44 &&
                            button === button.ownerDocument.activeElement && button.matches(':focus-visible') &&
                            button.ownerDocument.defaultView.getComputedStyle(button.querySelector('svg')).stroke.includes('#nav-metal');
                    });
                    if (!ready || !await close.isVisible())
                        throw new Error(label + ': the close button should be visible above the profile and focused');
                    await close.click();
                    if (await sidebar.getAttribute('data-open') !== 'false' ||
                        !await opener.evaluate(button => button === button.ownerDocument.activeElement))
                        throw new Error(label + ': closing the drawer did not restore focus to the menu button');
                }
                results.push(label);
            }
        }
    } finally {
        if (viewport) await page.setViewportSize(viewport);
        await page.evaluate('ui.theme = ' + JSON.stringify(theme) + '; render()');
    }
    return results;
}

/** Run against an already-open local app page with Playwright. */
export default async function checkAcceptance(page) {
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const viewport = page.viewportSize();
    const results = [];
    const show = (tab, detail = false) => page.evaluate(
        `ui.tab = '${tab}'; ui.edit = 0; ui.drawer = false;
        ui.sel = ${detail && tab !== 'wish' ? "rankedIds(ui.tab)[0]" : 'null'};
        ui.wl = ${detail && tab === 'wish' ? "profile.wishlists[0].id" : 'null'};
        render(); window.scrollTo(0, 0);`
    );
    const fit = async label => {
        const overflow = await page.evaluate(`[...document.querySelectorAll('html, main, #lw, .rcol, dialog[open], [aria-modal=true], dialog[open] .box, :popover-open')]
            .filter(node => {
                if (!node.clientWidth) return false;
                const rect = node.getBoundingClientRect();
                return (node === document.documentElement ? node.scrollWidth > innerWidth : node.scrollWidth > node.clientWidth + 1) ||
                    (node.matches('dialog[open], [aria-modal=true], :popover-open') &&
                        (rect.top < -0.5 || rect.left < -0.5 || rect.right > innerWidth + 0.5 || rect.bottom > innerHeight + 0.5));
            }).map(node => node.id || node.className || node.tagName)`);
        check(!overflow.length, `${label}: overflow in ${overflow.join(', ')}`);
    };
    const dialog = async (selector, returnedTo = selector) => {
        await page.locator(selector).first().press('Enter');
        await page.locator('dialog[open]').last().waitFor();
        await fit(selector);
        await page.keyboard.press('Escape');
        await page.locator('dialog[open]').last().waitFor({ state: 'detached' });
        check(await page.locator(returnedTo).first().evaluate(el => el === el.ownerDocument.activeElement),
            `${selector}: focus did not return to ${returnedTo}`);
    };
    const rows = async (prefix, width) => {
        const cards = await page.locator('#lst .lv').evaluateAll(levels => levels.map(level => {
            const rank = level.querySelector('.rk');
            const images = Array.from(rank.querySelectorAll('img'));
            return { height: level.getBoundingClientRect().height, number: rank.textContent.trim(),
                emblems: images.map(image => ({ src: image.getAttribute('src'), loaded: image.naturalWidth > 0,
                    fits: image.getBoundingClientRect().top >= level.getBoundingClientRect().top &&
                        image.getBoundingClientRect().bottom <= level.getBoundingClientRect().bottom })) };
        }));
        check(cards.length === 6 && cards[0].height > 0 && cards.every(card => card.height === cards[0].height),
            `${prefix} at ${width}px: ranks 1–6 should have equal heights`);
        for (const [index, card] of cards.entries()) {
            check(index === 5 ? card.number === '6' && card.emblems.length === 0 :
                card.emblems.length === 1 && card.emblems[0].loaded && card.emblems[0].fits &&
                card.emblems[0].src.endsWith(`/${prefix}-${index + 1}.webp`),
            `${prefix} at ${width}px: incorrect rank ${index + 1} marker`);
        }
    };
    await page.evaluate(`
        window.revampAcceptanceState = { profile, ui: { ...ui } };
        profile = emptyProfile();
        for (const kind of ['classic', 'platform']) {
            for (let rank = 1; rank <= 6; rank++) {
                const id = kind + '-acceptance-' + rank;
                profile.levels.push({ id, name: 'Náufrago de prueba ' + rank, creator: 'Demo Author', kind, diff: 'Hard', tags: [] });
                profile.order[kind].push(id);
            }
        }
        profile.wishlists = [{ id: 'acceptance-wish', name: 'Demo goals', items: [
            { id: 'acceptance-item', name: 'Demo wishlist level', status: 'todo', tags: [] }
        ] }];
        resetListFilters(); ui.theme = 'nebula'; ui.background = 'grid'; ui.listReturnY = 0;
    `);
    try {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await show('home');
        await checkDrawerClose(page);
        for (const width of [360, 390, 1024, 1440]) {
            await page.setViewportSize({ width, height: 800 });
            for (const kind of ['classic', 'platform']) {
                await show(kind);
                await page.locator('#lst .rk img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
                await rows(kind === 'platform' ? 'platformer' : 'classic', width);
                await fit(`${kind} list at ${width}px`);
                await show(kind, true);
                await fit(`${kind} detail at ${width}px`);
                await page.locator('.rcol [data-act=edit]').press('Enter');
                await fit(`${kind} edit at ${width}px`);
            }
            for (const [tab, detail] of [['wish', false], ['wish', true], ['stats', false], ['home', false]]) {
                await show(tab, detail);
                await fit(`${tab}${detail ? ' detail' : ''} at ${width}px`);
            }

            await dialog('.hadd');
            await dialog('[data-act=bell]');
            if (width < 1280) {
                await page.locator('#shell-menu').press('Enter');
                await fit('Navigation drawer');
            }
            await dialog('[data-act=pause]');
            await dialog('[data-act=tags]');
            for (const action of ['localdata', 'pedit', 'asignin']) {
                await page.locator('#profile-pill').press('Enter');
                await fit('Profile menu');
                await dialog(`.pmenu [data-act=${action}]`, '#profile-pill');
            }
            if (width < 1280) {
                await page.keyboard.press('Escape');
                check(await page.locator('#shell-menu').evaluate(el => el === el.ownerDocument.activeElement),
                    'Drawer focus did not return to the navigation button');
            }
            await show('wish');
            await dialog('.page-title [data-act=wnew]');
            await show('wish', true);
            await dialog('[data-act=wadd]');
            await dialog('[data-act=wedit]');
            results.push(width);
        }
        for (const rank of [1, 6]) {
            await show('classic');
            const target = page.locator(`#lst .lv[data-id="classic-acceptance-${rank}"]`);
            await target.press('Enter');
            await target.press('Tab');
            await page.keyboard.press('Shift+Tab');
            const state = await target.evaluate(el => {
                const view = el.ownerDocument.defaultView;
                const style = view.getComputedStyle(el);
                const marker = view.getComputedStyle(el, '::before');
                const row = el.getBoundingClientRect(), pane = el.closest('#lw').getBoundingClientRect();
                return { selected: marker.content !== 'none' && marker.boxShadow.includes('inset'),
                    focused: el.matches(':focus-visible') && style.outlineStyle === 'solid' && parseFloat(style.outlineWidth) > 0,
                    positionedOutside: parseFloat(style.outlineOffset) >= 0 &&
                        row.top - pane.top >= parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth) &&
                        pane.bottom - row.bottom >= parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth) };
            });
            check(state.selected && state.focused && state.positionedOutside,
                `Rank ${rank} needs a visible inset selection marker and a separate, unclipped keyboard outline`);
        }
        return { widths: results, selectedRanks: [1, 6] };
    }
    finally {
        await page.evaluate(`
            closeModal();
            ({ profile, ui } = window.revampAcceptanceState);
            delete window.revampAcceptanceState;
            render();
        `);
        await page.emulateMedia({ reducedMotion: null });
        if (viewport) await page.setViewportSize(viewport);
    }
}
