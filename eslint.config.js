import js from '@eslint/js';
import globals from 'globals';
import { readFileSync } from 'node:fs';

const appFiles = ['data/demo-data.js', 'js/**/*.js'];

/** The page's scripts in load order, as index.html lists them. */
export const appScripts = readFileSync('index.html', 'utf8')
    .match(/<script src="(?!https?:)[^"]+"/g)
    .map(tag => tag.slice(13, -1));

/** Every top-level name the scripts declare, once per declaration. */
export const topLevelNames = appScripts
    .flatMap(file => [...readFileSync(file, 'utf8').matchAll(/^(?:const|let|var|(?:async\s+)?function\*?|class)\s+([A-Za-z_$][\w$]*)/gm)])
    .map(([, name]) => name);

// The app uses classic scripts that share top-level names across files (see the load order in index.html),
// so each file's top-level declarations are declared as globals for the others.
const sharedGlobals = Object.fromEntries(topLevelNames.map(name => [name, 'writable']));

export default [
    { ignores: ['node_modules/', 'vendor/'] },
    js.configs.recommended,
    {
        files: appFiles,
        languageOptions: {
            sourceType: 'script',
            globals: { ...globals.browser, ...sharedGlobals, Sortable: 'readonly' }
        },
        rules: {
            'no-redeclare': ['error', { builtinGlobals: false }],
            // Network lookups are best effort: a failed request is ignored on purpose
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-unused-vars': ['error', { vars: 'local', caughtErrors: 'none' }],
            // A local that hides another script's global looks like that global; browser globals may be reused
            'no-shadow': ['error', { builtinGlobals: true, allow: Object.keys(globals.browser) }]
        }
    },
    {
        files: ['sw.js'],
        languageOptions: { sourceType: 'script', globals: globals.serviceworker }
    },
    {
        files: ['eslint.config.js', 'tests/**/*.js', 'scripts/**/*.js'],
        languageOptions: { globals: globals.node }
    }
];
