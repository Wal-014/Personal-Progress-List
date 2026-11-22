export default async function checkModalDismiss(page) {
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    await page.setViewportSize({ width: 1280, height: 900 });
    const addLevel = page.locator('.hadd[data-act=add]');
    const dialog = page.locator('#md dialog[open]');
    const field = dialog.locator('#gdq');
    const open = async () => {
        await addLevel.click();
        await field.waitFor();
    };
    const closedBy = async action => {
        await action();
        await dialog.waitFor({ state: 'detached' });
    };
    const drag = async (from, to) => {
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y, { steps: 12 });
        await page.mouse.up();
    };

    await open();
    const text = 'Unsaved text for drag selection';
    await field.pressSequentially(text);
    const input = await field.boundingBox();
    const inside = { x: Math.round(input.x + 15), y: Math.round(input.y + input.height / 2) };
    const backdrop = { x: 8, y: inside.y };
    check(await dialog.evaluate((element, point) => element.ownerDocument.elementFromPoint(point.x, point.y) === element, backdrop),
        'The drag endpoint must hit the backdrop');

    await page.mouse.move(inside.x, inside.y);
    await page.mouse.down();
    await page.mouse.move(inside.x + 105, inside.y, { steps: 8 });
    check(await field.evaluate(element => element.selectionStart < element.selectionEnd), 'The drag must select text');
    await page.mouse.move(backdrop.x, backdrop.y, { steps: 12 });
    await page.mouse.up();
    check(await dialog.count() === 1 && await field.inputValue() === text, 'Releasing on the backdrop must preserve the form and text');

    await drag(backdrop, inside);
    check(await dialog.count() === 1 && await field.inputValue() === text, 'Releasing inside the box must preserve the form and text');
    await closedBy(() => page.mouse.click(backdrop.x, backdrop.y));
    await open();
    await closedBy(() => page.keyboard.press('Escape'));
    await open();
    await closedBy(() => dialog.locator('[data-act=close]').click());

    const confirmation = page.locator('body > dialog.modal[open]');
    await page.evaluate("void showDialog({ title: 'Dismissal check' })");
    await confirmation.waitFor();
    await page.mouse.click(8, 8);
    check(await confirmation.count() === 1, 'A backdrop click must keep confirmation dialogs open');
    await confirmation.locator('[data-r="0"]').click();
    await confirmation.waitFor({ state: 'detached' });

    await open();
    const box = await dialog.locator('.box').boundingBox();
    const y = Math.floor(box.y + box.height / 2);
    const outsideEdge = { x: Math.floor(box.x) - 1, y };
    const insideEdge = { x: Math.ceil(box.x) + 1, y };
    const hitsBackdrop = point => dialog.evaluate((element, { x, y }) => element.ownerDocument.elementFromPoint(x, y) === element, point);
    check(await hitsBackdrop(outsideEdge) && !(await hitsBackdrop(insideEdge)), 'The touch points must straddle the box edge');
    const touch = await page.context().newCDPSession(page);
    const dispatch = (type, ...touchPoints) => touch.send('Input.dispatchTouchEvent', { type, touchPoints });
    try {
        await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true });
        await dispatch('touchStart', outsideEdge);
        await dispatch('touchMove', insideEdge);
        await dispatch('touchEnd');
        check(await dialog.count() === 1, 'A touch starting on the backdrop and ending inside must keep the dialog open');

        await dispatch('touchStart', insideEdge);
        await dispatch('touchMove', outsideEdge);
        await dispatch('touchEnd');
        check(await dialog.count() === 1, 'A touch starting inside and ending on the backdrop must keep the dialog open');

        await dispatch('touchStart', { x: 8, y: 8 });
        await closedBy(() => dispatch('touchEnd'));
    } finally {
        await touch.send('Emulation.setTouchEmulationEnabled', { enabled: false });
        await touch.detach();
    }
}
