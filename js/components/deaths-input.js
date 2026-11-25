const deathChip = (percent, count) => `<span class="chip death-chip"><button type=button data-act=dthedit>${escapeHtml(percent)}% · ${escapeHtml(count)}</button><button type=button data-act=dthremove aria-label="${escapeHtml(t('deathRemove').replace('{percent}', percent))}">${ICONS.del}</button><input type=hidden name=dth value="${escapeHtml(percent)}:${escapeHtml(count)}"></span>`;

function deathsInput(deaths = {}) {
    return `<div class=deaths-input role=group aria-labelledby=death-label><div class=field-head><span class=lab id=death-label>${t('deaths')}</span>${helpTip('deaths', t('deaths'))}</div><div class=death-fields><div><label for=death-percent>${t('deathPercent')}</label><input id=death-percent data-death-field type=text inputmode=numeric pattern="[0-9]*" autocomplete=off aria-describedby=death-percent-error><small class=death-error id=death-percent-error></small></div><div><label for=death-count>${t('deathCount')}</label><input id=death-count data-death-field type=text inputmode=numeric pattern="[0-9]*" autocomplete=off aria-describedby=death-count-error><small class=death-error id=death-count-error></small></div><button type=button class=blue data-act=dthadd>${t('add')}</button><button type=button data-act=dthcancel hidden>${t('cancel')}</button></div><div class=death-prompt role=status></div><div class=death-chips>${Object.keys(deaths).sort((a, b) => a - b).map(percent => deathChip(percent, deaths[percent])).join('')}</div></div>`;
}

const deathInputs = root => [...root.querySelectorAll('input[name=dth]')];

/** Deaths object from the chips' "percent:count" values. */
const deathsFromValues = values => Object.fromEntries(values.map(value => {
    const [percent, count] = value.split(':');
    return [percent, +count];
}));

function clearDeathPrompt(root) {
    root.querySelector('.death-prompt').innerHTML = '';
    delete root.dataset.pendingPercent;
    delete root.dataset.pendingCount;
}

function validateDeathField(input, value = input.value) {
    const percent = input.id == 'death-percent', max = percent ? 100 : 10000000;
    const error = /^[0-9]+$/.test(value) && +value <= max ? '' : t(percent ? 'deathPercentError' : 'deathCountError');
    input.setCustomValidity(error);
    input.setAttribute('aria-invalid', error ? 'true' : 'false');
    input.closest('.deaths-input').querySelector('#' + input.id + '-error').textContent = error;
    return !error;
}

function deathInputChanged(input) {
    clearDeathPrompt(input.closest('.deaths-input'));
    if (input.value)
        validateDeathField(input);
    else {
        input.setCustomValidity('');
        input.setAttribute('aria-invalid', 'false');
        input.closest('.deaths-input').querySelector('#' + input.id + '-error').textContent = '';
    }
}

function cancelDeathEdit(button) {
    const root = button.closest('.deaths-input');
    delete root.dataset.editPercent;
    for (const id of ['#death-percent', '#death-count']) {
        const input = root.querySelector(id);
        input.value = '';
        deathInputChanged(input);
    }
    root.querySelector('[data-act=dthadd]').textContent = t('add');
    root.querySelector('[data-act=dthcancel]').hidden = true;
    root.querySelector('#death-percent').focus();
}

function commitDeath(root, percent, count) {
    for (const input of deathInputs(root)) {
        const key = input.value.split(':')[0];
        if (key == root.dataset.editPercent || +key == percent)
            input.closest('.death-chip').remove();
    }
    const template = document.createElement('template');
    template.innerHTML = deathChip(percent, count);
    const before = deathInputs(root).find(input => +input.value.split(':')[0] > percent);
    root.querySelector('.death-chips').insertBefore(template.content.firstElementChild, before?.closest('.death-chip') || null);
    cancelDeathEdit(root.querySelector('#death-percent'));
}

function addDeath(button) {
    const root = button.closest('.deaths-input'), percent = root.querySelector('#death-percent'), count = root.querySelector('#death-count');
    clearDeathPrompt(root);
    for (const input of [percent, count]) {
        if (!validateDeathField(input)) {
            input.reportValidity();
            return;
        }
    }
    const p = +percent.value, c = +count.value;
    const duplicate = deathInputs(root).find(input => +input.value.split(':')[0] == p && input.value.split(':')[0] != root.dataset.editPercent);
    if (!duplicate)
        return commitDeath(root, p, c);
    const existing = +duplicate.value.split(':')[1], prompt = root.querySelector('.death-prompt');
    root.dataset.pendingPercent = p;
    root.dataset.pendingCount = c;
    prompt.innerHTML = `<p>${escapeHtml(t('deathDuplicate').replace('{percent}', p).replace('{count}', existing))}</p><div class=death-choices><button type=button class=blue data-act=dthresolve data-choice=sum>${escapeHtml(t('deathSum').replace('{count}', existing + c))}</button><button type=button data-act=dthresolve data-choice=replace>${t('deathReplace')}</button><button type=button data-act=dthresolve data-choice=cancel>${t('cancel')}</button></div>`;
    prompt.querySelector('button').focus();
}

function resolveDeath(button) {
    const root = button.closest('.deaths-input');
    if (button.dataset.choice == 'cancel') {
        clearDeathPrompt(root);
        return root.querySelector('#death-percent').focus();
    }
    if (root.dataset.pendingPercent == null)
        return;
    const p = +root.dataset.pendingPercent, duplicate = deathInputs(root).find(input => +input.value.split(':')[0] == p);
    const count = +root.dataset.pendingCount + (button.dataset.choice == 'sum' ? +duplicate.value.split(':')[1] : 0);
    const field = root.querySelector('#death-count');
    if (!validateDeathField(field, String(count)))
        return field.reportValidity();
    commitDeath(root, p, count);
}

function editDeath(button) {
    const root = button.closest('.deaths-input'), [percent, count] = button.closest('.death-chip').querySelector('input').value.split(':');
    cancelDeathEdit(button);
    root.dataset.editPercent = percent;
    root.querySelector('#death-percent').value = percent;
    root.querySelector('#death-count').value = count;
    root.querySelector('[data-act=dthadd]').textContent = t('deathUpdate');
    root.querySelector('[data-act=dthcancel]').hidden = false;
}

function removeDeath(button) {
    const chip = button.closest('.death-chip'), root = button.closest('.deaths-input');
    const next = chip.nextElementSibling || chip.previousElementSibling;
    if (root.dataset.editPercent == chip.querySelector('input').value.split(':')[0])
        cancelDeathEdit(button);
    clearDeathPrompt(root);
    chip.remove();
    (next?.querySelector('button') || root.querySelector('#death-percent')).focus();
}

function deathInputKeydown(event) {
    event.preventDefault();
    const input = event.target, root = input.closest('.deaths-input');
    if (input.id == 'death-percent' && root.querySelector('#death-count').value === '') {
        if (validateDeathField(input))
            root.querySelector('#death-count').focus();
        else
            input.reportValidity();
        return;
    }
    addDeath(input);
}
