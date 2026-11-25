/**
 * Contextual help: a small ? button whose explanation opens in a popover, so scrolling forms cannot clip it.
 * Click, tap, Enter, Space, Escape and clicks outside work natively through popovertarget; a mouse hover also opens it.
 */

function helpTip(key, label) {
    const id = 'help-' + key;
    return `<button type=button class=help-tip popovertarget=${id} aria-label="${escapeHtml(t('helpFor').replace('{label}', label))}">?</button><span id=${id} class=help-pop popover role=tooltip>${escapeHtml(t('help_' + key))}</span>`;
}

const helpPopover = button => document.getElementById(button.getAttribute('popovertarget'));

/** Places an opening explanation below its button, or above it when there is no room, inside the viewport. */
function positionHelp(popover) {
    const button = document.querySelector(`[popovertarget="${popover.id}"]`);
    if (!button)
        return;
    const anchor = button.getBoundingClientRect(), gap = 6, margin = 8;
    const left = Math.max(margin, Math.min(anchor.left, innerWidth - popover.offsetWidth - margin));
    const below = anchor.bottom + gap;
    const top = below + popover.offsetHeight > innerHeight - margin ? Math.max(margin, anchor.top - popover.offsetHeight - gap) : below;
    popover.style.setProperty('--help-left', left + 'px');
    popover.style.setProperty('--help-top', top + 'px');
}

/** A hover opens the explanation and leaving closes it, unless a click pinned it open meanwhile. */
function hoverHelp(event) {
    const button = event.target.closest?.('.help-tip');
    if (!button || event.pointerType != 'mouse' || button.contains(event.relatedTarget))
        return;
    const popover = helpPopover(button);
    if (event.type == 'pointerover' && !popover.matches(':popover-open')) {
        popover.dataset.hover = '1';
        popover.showPopover();
    }
    else if (event.type == 'pointerout' && popover.dataset.hover) {
        delete popover.dataset.hover;
        popover.hidePopover();
    }
}

/** Clicking a hover-opened explanation keeps it open instead of toggling it closed. */
function pinHelp(event) {
    const button = event.target.closest?.('.help-tip');
    const popover = button && helpPopover(button);
    if (popover?.dataset.hover) {
        delete popover.dataset.hover;
        event.preventDefault();
    }
}

function openedHelp(event) {
    if (event.target.matches?.('.help-pop') && event.newState == 'open')
        positionHelp(event.target);
}

/** A fixed popover would drift away from its button while the form scrolls. */
const closeHelpOnScroll = () => document.querySelector('.help-pop:popover-open')?.hidePopover();
