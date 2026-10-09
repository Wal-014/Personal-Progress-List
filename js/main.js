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
    if ('serviceWorker' in navigator) {
        let rl;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!rl) {
                rl = 1;
                location.reload();
            }
        });
        navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {
        });
    }
})();
