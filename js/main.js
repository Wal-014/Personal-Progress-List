/**
 * Entry point for profile loading, rendering and service worker registration.
 */

(() => {
    if (!store) {
        const demo = window.DEMO_PROFILE || emptyProfile();
        store = { cur: 'p1', profs: { p1: { name: demo.profileName || 'Demo', data: demo } } };
        profile = demo;
        save();
    }
    ensureProfileColors();
    ensureProfileDefaults();
    render();
    if (storeWasUnreadable)
        showAlert(t('dataUnreadable'));
    autoSyncIfStale();
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState == 'visible')
            autoSyncIfStale();
    });
    if ('serviceWorker' in navigator) {
        // Reload only when a new version replaces the one serving this page, not when the first install takes control
        let reloadOnUpdate = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (reloadOnUpdate) {
                reloadOnUpdate = false;
                location.reload();
            }
        });
        // Offline use is optional: without a service worker (opened from disk, or blocked) the app still runs online
        navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {
        });
    }
})();
