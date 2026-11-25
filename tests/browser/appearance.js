/* global document, getComputedStyle */

/** Reusable Playwright check; pass its exported function to the browser runner. */
export default async function checkAppearance(page) {
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const results = [];
    await page.evaluate('closeModal()');
    for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (const theme of ['nebula', 'porcelain']) {
            for (const screen of ['home', 'classic']) {
                await page.evaluate(`ui.theme = '${theme}'; ui.tab = '${screen}'; ui.edit = 0; ui.sel = profile.levels.find(level => level.kind == 'classic').id; render()`);
                const state = await page.evaluate(`(() => {
                    const root = getComputedStyle(document.documentElement);
                    return { overflow: document.documentElement.scrollWidth > innerWidth, background: getComputedStyle(document.body).backgroundColor,
                        legacySurface: root.getPropertyValue('--obj').trim(),
                        surface: root.getPropertyValue('--color-surface').trim(), selected: !!document.querySelector('.rcol.has') };
                })()`);
                check(!state.overflow, `${theme} ${screen} at ${width}: overflow`);
                check(state.legacySurface == state.surface, `${theme}: content surface must match the active palette`);
                if (screen == 'classic') check(state.selected, 'Level details must be visible');
                results.push({ width, theme, screen, ...state });
            }
        }
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate("ui.tab = 'home'; render(); document.querySelector('.hadd').setAttribute('aria-busy', 'true'); openModal(pauseUI()); document.querySelector('.appearance-option').setAttribute('aria-busy', 'true')");
    const indicators = async () => page.evaluate(`['.hadd', '.appearance-option'].map(selector => {
        const style = getComputedStyle(document.querySelector(selector), '::after');
        return { animation: style.animationName, content: style.content };
    })`);
    check((await indicators()).every(state => state.animation == 'appearance-spin'), 'Loading indicators should animate normally');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    check((await indicators()).every(state => state.animation == 'none' && state.content != 'none'), 'Reduced motion must keep static indicators');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const previews = await page.evaluate(`Array.from(document.querySelectorAll('.theme-preview'), element => ({
        theme: element.className.split('sw-')[1], background: getComputedStyle(element).backgroundImage,
        surface: getComputedStyle(element).getPropertyValue('--color-surface').trim()
    }))`);
    check(previews.length == 6 && new Set(previews.map(preview => preview.surface)).size == 6, 'Each preview must use its own palette');
    await page.evaluate('closeModal()');
    const celestial = await checkCelestial(page, check);
    await page.emulateMedia({ forcedColors: 'active' });
    check(await page.evaluate(() => [
        [document.body, '::before'], [document.body, '::after'], [document.querySelector('#app'), '::after']
    ].every(([node, pseudo]) => getComputedStyle(node, pseudo).display == 'none')), 'Forced colours must hide the decorative layers');
    await page.emulateMedia({ forcedColors: 'none' });
    return { layouts: results, previews, celestial, loading: 'normal and reduced motion passed', forcedColors: 'passed' };
}

async function checkCelestial(page, check) {
    const results = [];
    const sample = (delay = 0) => page.evaluate(async delay => {
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        const layers = [document.body, document.querySelector('#app')].map(node => getComputedStyle(node, '::after'));
        return {
            opacity: layers.map(layer => Number(layer.opacity)),
            masks: layers.map(layer => [layer.maskImage, layer.maskPosition, layer.maskSize, layer.maskRepeat]),
            transitions: layers.map(layer => [layer.transitionProperty, layer.transitionDuration])
        };
    }, delay);
    const same = (left, right) => JSON.stringify(left) == JSON.stringify(right);

    for (const [width, height] of [[1440, 900], [390, 844]]) {
        await page.setViewportSize({ width, height });
        const openSidebar = async () => { if (width < 1280) await page.locator('#shell-menu').click(); };
        const sidebarTab = async tab => {
            await openSidebar();
            const choices = page.locator('#list-choices-trigger');
            if (['classic', 'platform'].includes(tab) && await choices.getAttribute('aria-expanded') == 'false') await choices.click();
            return `.shell-nav [data-act=tab][data-v=${tab}]`;
        };
        for (const theme of ['nebula', 'porcelain']) {
            await openSidebar();
            await page.locator('[data-act=pause]').click();
            await page.locator('[data-picker=theme] summary').click();
            await page.locator(`[data-act=theme][data-v=${theme}]`).click();
            await page.locator('[data-picker=background] summary').click();
            await page.locator('[data-act=background][data-v=celestial]').click();
            await page.locator('.pause [data-act=close]').click();
            if (width < 1280) await page.keyboard.press('Escape');
            const mixed = await sample(450);
            check(mixed.masks[0][0].includes('/stars.svg') && mixed.masks[1][0].includes('/moons.svg'), 'Celestial needs separate star and moon masks');
            check(mixed.opacity[0] == mixed.opacity[1] && mixed.opacity[0] > 0, 'Home needs two subdued motifs');
            check(mixed.transitions.every(([property, duration]) => property == 'opacity' && duration == '0.4s'), 'Only opacity should transition for 400ms');

            const switches = [];
            let previous = mixed.opacity;
            const navigate = async (selector, view, changes = true) => {
                await page.locator(selector).click();
                const mid = await sample(changes ? 150 : 0);
                const end = changes ? await sample(300) : mid;
                check(same(end.masks, mixed.masks), `${view}: masks must stay in place`);
                check(mid.opacity.every((value, index) => changes
                    ? value > Math.min(previous[index], end.opacity[index]) && value < Math.max(previous[index], end.opacity[index])
                    : value == previous[index]), `${view}: unexpected opacity while switching views`);
                switches.push({ view, mid: mid.opacity, settled: end.opacity });
                previous = end.opacity;
                return end.opacity;
            };
            const classic = await navigate('.hcard-classic', 'Classic');
            const pill = '.mode-switch [data-v=platform]';
            const platform = await navigate(pill, 'Platformer (pill)');
            check(classic[0] > mixed.opacity[0] && mixed.opacity[0] > platform[0], 'Stars must peak in Classic and dim in Platformer');
            check(platform[1] > mixed.opacity[1] && mixed.opacity[1] > classic[1], 'Moons must peak in Platformer and dim in Classic');
            check(same(await navigate(await sidebarTab('classic'), 'Classic (sidebar)'), classic), 'Sidebar must restore the Classic emphasis');
            check(same(await navigate(await sidebarTab('platform'), 'Platformer (sidebar)'), platform), 'Sidebar must restore the Platformer emphasis');
            check(same(await navigate(await sidebarTab('wish'), 'Wishlists'), mixed.opacity), 'Wishlists must return to mixed');
            await navigate(await sidebarTab('stats'), 'Statistics', false);
            await navigate(await sidebarTab('home'), 'Home', false);

            await page.emulateMedia({ reducedMotion: 'reduce' });
            for (const [selector, expected] of [['.hcard-classic', classic], [pill, platform]]) {
                await page.locator(selector).click();
                const instant = await sample();
                check(same(instant.opacity, expected) && instant.transitions.every(([, duration]) => duration == '0s'), 'Reduced motion must switch instantly');
            }
            await page.locator(await sidebarTab('home')).click();
            check(same((await sample()).opacity, mixed.opacity), 'Reduced motion must return to mixed instantly');
            await page.emulateMedia({ reducedMotion: 'no-preference' });
            results.push({ width, height, theme, switches });
        }
    }
    return results;
}
