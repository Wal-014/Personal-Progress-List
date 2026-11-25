/* global document, getComputedStyle */

/** Help buttons in the Add and Edit level forms stay 20px circles whose wider hit ring reaches no other control. Pass this to the browser runner. */
export default async function checkHelpTips(page) {
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const cdp = await page.context().newCDPSession(page);
    const measure = scope => page.evaluate(selector => {
        const root = document.querySelector(selector);
        root.querySelector('.gdclr').hidden = false; // shown beside the help button while a filter is active
        const controls = [...root.querySelectorAll('button, input, select, textarea, summary, output, [role=button]')]
            .filter(node => !node.matches('.help-tip') && !node.closest('.level-action-bar') && node.getClientRects().length);
        return [...root.querySelectorAll('.help-tip')].filter(tip => tip.getClientRects().length).map(tip => {
            const box = tip.getBoundingClientRect(), ring = getComputedStyle(tip, '::after');
            const hit = { left: box.left + parseFloat(ring.left), right: box.right - parseFloat(ring.right), top: box.top + parseFloat(ring.top), bottom: box.bottom - parseFloat(ring.bottom) };
            const reached = controls.filter(node => {
                const other = node.getBoundingClientRect();
                return other.left < hit.right && other.right > hit.left && other.top < hit.bottom && other.bottom > hit.top;
            }).map(node => node.id || node.className || node.tagName);
            return { id: tip.getAttribute('popovertarget'), width: box.width, height: box.height, radius: getComputedStyle(tip).borderRadius,
                hitWidth: hit.right - hit.left, hitHeight: hit.bottom - hit.top, reached };
        });
    }, scope);
    const verify = async (scope, label) => {
        await page.locator(scope).waitFor();
        const tips = await measure(scope);
        check(tips.length > 5, `${label}: help buttons are missing`);
        for (const tip of tips) {
            check(Math.abs(tip.width - 20) < 0.5 && Math.abs(tip.height - 20) < 0.5 && tip.radius == '50%', `${label} ${tip.id}: ${tip.width}x${tip.height} radius ${tip.radius}`);
            check(tip.hitWidth >= 44 && tip.hitHeight >= 24, `${label} ${tip.id}: the hit area is ${tip.hitWidth}x${tip.hitHeight}`);
            check(!tip.reached.length, `${label} ${tip.id}: the hit area reaches ${tip.reached.join(', ')}`);
        }
        const first = page.locator(`${scope} .help-tip`).first();
        await first.click();
        check(await page.evaluate(id => document.getElementById(id).matches(':popover-open'), await first.getAttribute('popovertarget')), `${label}: a click does not open the explanation`);
        await page.keyboard.press('Escape');
    };
    try {
        for (const touch of [false, true]) {
            await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: touch ? 5 : 1 });
            for (const theme of ['nebula', 'porcelain']) {
                for (const lang of ['es', 'en']) {
                    for (const [width, height] of [[390, 844], [1440, 900]]) {
                        const label = `${touch ? 'touch' : 'mouse'} ${theme} ${lang} ${width}`;
                        await page.setViewportSize({ width, height });
                        await page.evaluate(`document.querySelector('dialog[open]')?.close(); ui.theme = '${theme}'; ui.lang = '${lang}'; ui.tab = 'home'; ui.sel = null; ui.edit = 0; render()`);
                        await page.locator('.hlists .hadd').click();
                        await verify('.modal', `${label} Add`);
                        await page.evaluate(`document.querySelector('dialog[open]')?.close(); ui.tab = 'classic'; ui.sel = profile.levels.find(level => level.kind == 'classic').id; ui.edit = 1; render()`);
                        await verify('.rcol', `${label} Edit`);
                    }
                }
            }
        }
    }
    finally {
        await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
}
