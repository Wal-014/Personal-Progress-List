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
    await page.evaluate("closeModal(); ui.background = 'celestial'; render()");
    const motif = await page.evaluate("getComputedStyle(document.body, '::after').maskImage");
    check(motif.startsWith('url('), 'Celestial motif must be a mask');
    await page.emulateMedia({ forcedColors: 'active' });
    check(await page.evaluate("['::before', '::after'].every(layer => getComputedStyle(document.body, layer).display == 'none')"), 'Forced colours must hide both decorative layers');
    await page.emulateMedia({ forcedColors: 'none' });
    return { layouts: results, previews, loading: 'normal and reduced motion passed', forcedColors: 'passed' };
}
