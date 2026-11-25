/**
 * Moves an open tab to a newly deployed version. A tab with nothing to lose reloads once at once; otherwise a notice
 * offers the update and it applies by itself when the tab is next hidden with nothing left to lose.
 */

const UPDATE_CHECK_EVERY = 30 * 60 * 1000;
const UPDATE_CHECK_GAP = 5 * 60 * 1000;

let lastUpdateCheck = 0, updateWaiting = false;

/** A dialog may hold typed input, an edited level may differ from its saved copy, and account changes may still be uploading. */
const updateIsSafe = () => !qs('dialog[open]') && !levelFormChanged(qs('.rcol')) && !(cloudUser && cloudSync.pending);

const applyUpdate = () => location.reload();

function showUpdateNotice() {
    if (qs('.update-notice'))
        return;
    const notice = document.createElement('div');
    notice.className = 'update-notice';
    notice.setAttribute('role', 'status');
    notice.innerHTML = `<span>${t('updateReady')}</span><button type=button class=pri data-act=appupdate>${t('updateNow')}</button>`;
    document.body.append(notice);
}

/** Called when a new service worker takes over a page an older one was serving. */
function newVersionReady() {
    if (updateIsSafe())
        return applyUpdate();
    updateWaiting = true;
    showUpdateNotice();
}

/** Asks the browser to look for a new worker, at most once per gap and never offline. */
function checkForUpdate(registration, now = Date.now()) {
    if (navigator.onLine === false || now - lastUpdateCheck < UPDATE_CHECK_GAP)
        return;
    lastUpdateCheck = now;
    registration.update().catch(() => {});
}

function updateOnVisibility(registration) {
    if (document.visibilityState == 'visible')
        checkForUpdate(registration);
    else if (updateWaiting && updateIsSafe())
        applyUpdate();
}

/** Long-lived tabs look again when they come back into view, when the connection returns and every half hour. */
function watchForUpdates(registration) {
    document.addEventListener('visibilitychange', () => updateOnVisibility(registration));
    window.addEventListener('online', () => checkForUpdate(registration));
    setInterval(() => checkForUpdate(registration), UPDATE_CHECK_EVERY);
}
