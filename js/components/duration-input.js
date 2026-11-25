/** Largest value of each part; the hours keep the total within the database limit of 1,000,000,000 seconds. */
const DURATION_PART_MAX = { h: 277777, m: 59, s: 59 };

function durationClock(seconds) {
    return seconds == null ? '' : [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
}

function durationInput(field, seconds) {
    const parts = seconds == null ? ['', '', ''] : durationClock(seconds).split(':');
    return `<div class=duration role=group aria-labelledby="fm-${escapeHtml(field)}-label"><div class=field-head><label id="fm-${escapeHtml(field)}-label" for="fm-${escapeHtml(field)}_h">${escapeHtml(t(field))}</label>${helpTip(field, t(field))}</div><div class=duration-parts>${['h', 'm', 's'].map((part, index) => `${index ? '<span aria-hidden=true>:</span>' : ''}<div><input type=text inputmode=numeric data-duration="${escapeHtml(field)}" id="fm-${escapeHtml(field)}_${part}" name="${escapeHtml(field)}_${part}" aria-labelledby="fm-${escapeHtml(field)}-label fm-${escapeHtml(field)}_${part}-unit" value="${escapeHtml(parts[index])}" autocomplete=off><label id="fm-${escapeHtml(field)}_${part}-unit" for="fm-${escapeHtml(field)}_${part}">${escapeHtml(t('duration' + part))}</label></div>`).join('')}</div></div>`;
}

/** Seconds of a duration field: null when all parts are empty, NaN when a part is invalid (the typed text is kept for correction). */
function readDuration(form, field) {
    const inputs = ['h', 'm', 's'].map(part => form.elements[field + '_' + part]);
    let invalid = false;
    inputs.forEach((input, index) => {
        const bad = input.value !== '' && (!/^\d+$/.test(input.value) || +input.value > DURATION_PART_MAX['hms'[index]]);
        input.setCustomValidity(bad ? t(index ? 'errDurationPart' : 'errDurationHours') : '');
        invalid ||= bad;
    });
    if (invalid)
        return NaN;
    if (inputs.every(input => input.value === ''))
        return null;
    const seconds = +inputs[0].value * 3600 + +inputs[1].value * 60 + +inputs[2].value;
    if (seconds > 1000000000) {
        inputs[0].setCustomValidity(t('errDurationLimit'));
        return NaN;
    }
    return seconds;
}

function durationBlur(event) {
    const input = event.target;
    if (input.dataset.duration && /^\d+$/.test(input.value) && +input.value <= DURATION_PART_MAX[input.name.slice(-1)])
        input.value = String(Number(input.value)).padStart(2, '0');
}

function durationKeydown(event) {
    const input = event.target, part = input.name.slice(-1);
    if (event.key == ':' && part != 's') {
        event.preventDefault();
        const next = input.form.elements[input.dataset.duration + '_' + (part == 'h' ? 'm' : 's')];
        next.focus();
        next.select();
    }
    else if (event.key == 'ArrowUp' || event.key == 'ArrowDown') {
        event.preventDefault();
        if (!/^\d*$/.test(input.value))
            return;
        input.value = String(Math.max(0, Math.min(DURATION_PART_MAX[part], +input.value + (event.key == 'ArrowUp' ? 1 : -1))));
        updateTotals(input.form);
    }
    else if (event.key.length == 1 && !/\d/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey)
        event.preventDefault();
}
