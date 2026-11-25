/** Unsaved-change protection for the Add and Edit Level form. */

const levelFormBaselines = new WeakMap(), lastFocusedFields = new WeakMap();

/** The level search filters only narrow results; they are not part of the level. */
const LEVEL_SEARCH_FIELDS = new Set(['gdrate', 'gddiff']);

let discardPrompt = null;

const levelFormState = form => JSON.stringify([...new FormData(form)].filter(([name]) => !LEVEL_SEARCH_FIELDS.has(name)));

/** Records what a newly drawn level form holds, so a later close can tell whether anything changed. */
function rememberLevelForm(root) {
    const form = root?.querySelector('#fm');
    if (!form || levelFormBaselines.has(form))
        return;
    levelFormBaselines.set(form, levelFormState(form));
    form.addEventListener('focusin', event => lastFocusedFields.set(form, event.target));
}

function levelFormChanged(root) {
    const form = root?.querySelector('#fm');
    return !!form && levelFormBaselines.has(form) && levelFormBaselines.get(form) !== levelFormState(form);
}

/**
 * Resolves true when the level form inside root may close: it is unchanged, or the user chose to discard it.
 * Repeated attempts while the question is open share it. Keeping the changes returns focus to the last field used
 * when it ended up outside the form, as after a backdrop click.
 */
function confirmLevelFormExit(root) {
    if (!levelFormChanged(root))
        return Promise.resolve(true);
    const form = root.querySelector('#fm');
    discardPrompt ||= showDialog({ title: t('discardTitle'), msg: t('discardText'), ok: t('discardOk'), cancel: t('keepEditing'), danger: 1 })
        .finally(() => { discardPrompt = null; });
    return discardPrompt.then(discard => {
        if (!discard && !form.contains(document.activeElement))
            lastFocusedFields.get(form)?.focus({ preventScroll: true });
        return discard;
    });
}
