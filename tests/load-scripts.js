import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export const syncScripts = ['js/sync.js', 'js/local-migration.js'];

/**
 * Runs app scripts in order in a new context, the way the page shares one global scope between its classic scripts.
 * Returns the context, an evaluator for code in it, and a loader for scripts added after stubs are in place.
 * `transform` maps a file to a function that rewrites its source, for constants a test needs to flip.
 */
export function loadScripts(files, globals = {}, { transform = {} } = {}) {
    const context = vm.createContext({ canEdit: () => true, ...globals });
    const source = file => (transform[file] || (code => code))(readFileSync(file, 'utf8'));
    const load = more => more.forEach(file => vm.runInContext(source(file), context, { filename: file }));
    load(files);
    return { context, app: code => vm.runInContext(code, context), load };
}
