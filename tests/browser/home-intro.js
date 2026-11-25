/* global document */

/** The first-visit guide sits in its own full-width Home row, as tall as its content. Pass this to the browser runner. */
export default async function checkHomeIntro(page) {
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const measure = () => page.evaluate(() => {
        const box = selector => document.querySelector(selector)?.getBoundingClientRect();
        const intro = document.querySelector('.hintro');
        const content = intro && [...intro.children].reduce((sum, child) => sum + child.getBoundingClientRect().height, 0);
        return { home: box('.hcontent'), intro: box('.hintro'), content, lists: box('.hlists'), previews: box('.hpreviews') };
    });
    for (const theme of ['nebula', 'porcelain']) {
        for (const lang of ['es', 'en']) {
            for (const [width, height] of [[390, 844], [768, 1024], [1100, 800], [1280, 720], [1366, 768], [1440, 900], [1920, 1080]]) {
                const label = `${theme} ${lang} ${width}x${height}`;
                await page.setViewportSize({ width, height });
                await page.evaluate(`localStorage.removeItem('gintro'); profile.levels = []; profile.wishlists = []; ui.theme = '${theme}'; ui.lang = '${lang}'; ui.tab = 'home'; render()`);
                const shown = await measure();
                check(shown.intro, `${label}: the guide is missing`);
                check(Math.abs(shown.intro.width - shown.home.width) < 1, `${label}: the guide does not span the Home grid`);
                check(shown.intro.height < shown.content + 80, `${label}: the guide is ${Math.round(shown.intro.height)}px for ${Math.round(shown.content)}px of content`);
                check(shown.lists.top >= shown.intro.bottom && shown.previews.top >= shown.intro.bottom, `${label}: Home sections overlap the guide`);
                await page.locator('[data-act=introhide]').click();
                const hidden = await measure();
                check(!hidden.intro, `${label}: the guide did not hide`);
                check(Math.abs(hidden.lists.top - hidden.home.top) < 1, `${label}: the lists do not start Home once the guide is hidden`);
                const sideColumn = hidden.previews.left >= hidden.lists.right;
                check(!sideColumn || Math.abs(hidden.previews.top - hidden.home.top) < 1, `${label}: the side column does not start Home`);
                check(shown.previews.left >= shown.lists.right == sideColumn, `${label}: the guide changed the Home columns`);
            }
        }
    }
}
