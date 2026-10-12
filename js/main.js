/**
 * Punto de entrada: carga el perfil inicial, dibuja la interfaz y registra el service worker.
 */

(async () => {
    if (!store) {
        const demo = window.DEMO_PROFILE || { levels: [], order: { classic: [], platform: [] }, wishlists: [], tags: [] };
        store = { cur: 'p1', profs: { p1: { name: demo.profileName || 'Demo', data: demo } } };
        profile = demo;
        save();
    }
    ensureProfileDefaults();
    render();
    if (storeWasUnreadable)
        showAlert(t('dataUnreadable'));
    if ('serviceWorker' in navigator) {
        // Reload only when a new version replaces the one serving this page, not when the first install takes control
        let reloadOnUpdate = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (reloadOnUpdate) {
                reloadOnUpdate = false;
                location.reload();
            }
        });
        navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {
        });
    }
})();
