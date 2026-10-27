import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * Runs app scripts in order in a new context, the way the page shares one global scope between its classic scripts.
 * Returns the context, an evaluator for code in it, and a loader for scripts added after stubs are in place.
 */
export function loadScripts(files, globals = {}) {
    const context = vm.createContext(globals);
    const load = more => more.forEach(file => vm.runInContext(readFileSync(file, 'utf8'), context, { filename: file }));
    load(files);
    return { context, app: code => vm.runInContext(code, context), load };
}
