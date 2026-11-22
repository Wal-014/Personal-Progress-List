/* global document, getComputedStyle, window */

export default async function checkHeaderIcons(page, capture = async () => {}) {
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const results = [];
    const originalViewport = page.viewportSize();
    const original = await page.evaluateHandle('({ account, cloudSync, cloudUser, cloudSession, store, profile, ui: { ...ui } })');
    try {
        await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'no-preference' });
        for (const [width, height] of [[1440, 900], [390, 844]]) {
            await page.setViewportSize({ width, height });
            for (const theme of ['nebula', 'porcelain']) {
                const label = theme + ' at ' + width;
                await page.evaluate(`(() => {
                    profile = emptyProfile();
                    profile.levels = [{ id: 'tracked', name: 'Tracked level', kind: 'classic', tags: [] }];
                    profile.wishlists = [{ id: 'goals', name: 'Goals', items: [
                        { id: 'pending', name: 'Wishlist level', kind: 'classic', status: 'done' }
                    ] }];
                    store = { cur: 'icon-test', profs: { 'icon-test': { name: 'Local player', color: '#123456', data: profile } } };
                    account = { status: 'signed-in', profile: { display_name: 'Account player', username: 'player', cube_id: 2 } };
                    cloudSync = { status: 'saved', pending: 1, error: '' };
                    cloudUser = 'icon-test';
                    cloudSession = { pulled: true };
                    ui.theme = '${theme}'; ui.lang = 'es'; ui.tab = 'home'; ui.drawer = false;
                    render();
                })()`);
                await page.evaluate('document.fonts.ready');
                const header = await page.evaluate(`(() => {
                    const header = document.querySelector('.shell-header');
                    const bell = header.querySelector('[data-act=bell]');
                    const svg = getComputedStyle(bell.querySelector('svg'));
                    const heights = [header.getBoundingClientRect().height];
                    const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
                    const brand = header.querySelector('.shell-brand').getBoundingClientRect();
                    let overlaps = false;
                    let savingText, warningStroke, retryVisible;
                    for (const status of ['offline', 'saving']) {
                        cloudSync.status = status;
                        renderCloudStatus();
                        const indicator = header.querySelector('.cloud-indicator');
                        const retry = header.querySelector('[data-act=csync]');
                        const bounds = indicator.getBoundingClientRect();
                        overlaps ||= [brand, bell.getBoundingClientRect()].some(rect => intersects(rect, bounds));
                        heights.push(header.getBoundingClientRect().height);
                        if (status === 'saving') savingText = indicator.textContent;
                        else {
                            const icon = getComputedStyle(indicator.querySelector('svg'));
                            warningStroke = icon.stroke === icon.color && icon.strokeWidth === '2.35px';
                            retryVisible = retry.checkVisibility() && !intersects(brand, retry.getBoundingClientRect());
                        }
                    }
                    return { heights, overlaps, warningStroke, retryVisible, savingText,
                        metallic: svg.stroke.includes('#nav-metal') && svg.strokeWidth === '2.35px',
                        badge: bell.querySelector('.bdg').textContent };
                })()`);
                check(header.heights.every(value => value === header.heights[0]), label + ' header height must stay stable');
                check(!header.overlaps && header.warningStroke && header.retryVisible, label + ' statuses must fit and retain warning and retry');
                check(header.savingText === 'Guardando\u2026' && header.metallic && header.badge === '2', label + ' status, bell or badge is incorrect');
                await capture(page, theme, width, 'header', '.shell-header');
                await page.emulateMedia({ reducedMotion: 'reduce' });
                check(await page.locator('.cloud-indicator').evaluate(icon => getComputedStyle(icon).transitionDuration) === '0s',
                    label + ' must show saving immediately with reduced motion');
                await page.emulateMedia({ reducedMotion: 'no-preference' });
                await page.evaluate("cloudSync.status = 'saved'; renderCloudStatus()");
                check(await page.locator('.shell-header').evaluate(element => element.getBoundingClientRect().height) === header.heights[0],
                    label + ' clearing saving must retain the header height');

                await page.locator('[data-act=bell]').click();
                const panel = page.locator('dialog .notification-box');
                await panel.waitFor();
                check(await panel.locator('[data-section=notice]').count() === 1 && await panel.locator('[data-section=pending]').count() === 1,
                    label + ' panel must contain one notice and one pending item');
                const rowStrokes = await panel.locator('.notification-icon > svg').evaluateAll(icons => icons.map(icon => getComputedStyle(icon).stroke));
                check(rowStrokes[0].includes('#notification-notice-metal') && rowStrokes[1].includes('#notification-pending-metal'),
                    label + ' must keep distinct accent and success strokes');
                await capture(page, theme, width, 'notifications', 'dialog .notification-box');
                await panel.locator('[data-act=close]').click();

                const openProfileMenu = async id => {
                    if (width < 1280) await page.locator('#shell-menu').click();
                    await page.locator('#profile-pill').click();
                    const menu = page.locator(id + ':popover-open');
                    await menu.waitFor();
                    const boxes = await menu.locator(':scope > .pma > svg').evaluateAll(icons => icons.map(icon => {
                        const { width, x } = icon.getBoundingClientRect();
                        return [width, x, getComputedStyle(icon).stroke];
                    }));
                    check(boxes.length === 5 && boxes.every(([size, x, stroke]) =>
                        size === 24 && x === boxes[0][1] && stroke.includes('#nav-metal')), label + ' menu icons must align and use metallic strokes');
                    await capture(page, theme, width, id.slice(1), id);
                };
                await openProfileMenu('#amenu');
                await page.evaluate("account = { status: 'signed-out' }; cloudUser = cloudSession = null; cloudSync.status = 'saved'; ui.drawer = false; render()");
                await openProfileMenu('#pmenu');
                await page.evaluate("document.querySelector('#pmenu').hidePopover()");
                await capture(page, theme, width, 'sidebar', '.shell-nav');

                await page.emulateMedia({ forcedColors: 'active' });
                const visibleStrokes = await page.evaluate(() => [
                    '.shell-nav > button > svg', '[data-act=bell] > svg', '#pmenu > .pma > svg'
                ].every(selector => {
                    const style = getComputedStyle(document.querySelector(selector));
                    return style.stroke === style.color && parseFloat(style.strokeWidth) > 0;
                }));
                check(visibleStrokes, label + ' icons must use currentColor in forced colors');
                await page.emulateMedia({ forcedColors: 'none' });
                results.push({ width, height, theme, headerHeight: header.heights[0] });
            }
        }
    } finally {
        await original.evaluate(saved => { window.headerIconsOriginal = saved; });
        await page.evaluate('closeModal(); ({ account, cloudSync, cloudUser, cloudSession, store, profile } = window.headerIconsOriginal); Object.assign(ui, window.headerIconsOriginal.ui); delete window.headerIconsOriginal; render()');
        await original.dispose();
        if (originalViewport) await page.setViewportSize(originalViewport);
        await page.emulateMedia({ forcedColors: null, reducedMotion: null });
    }
    return results;
}
