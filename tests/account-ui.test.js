import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';
import { readFileSync } from 'node:fs';

function createApp(globals = {}) {
    const nodes = {}, listeners = {};
    const document = { body: {}, addEventListener: (name, handler) => { (listeners[name] ||= []).push(handler); }, querySelector: selector => nodes[selector] || null };
    nodes['#md'] = element({ innerHTML: '' });
    nodes['#md dialog'] = element({ querySelector: () => null, addEventListener() {}, showModal() {}, close() {} });
    const env = loadScripts(['js/config.js', 'js/i18n.js', 'js/utils.js', 'js/account.js', 'js/components/dialogs.js', 'js/components/account-ui.js', 'js/events.js'], {
        document, window: { addEventListener() {} }, renderTagSuggestions() {}, ui: { lang: 'en' }, cloudSync: { pending: 0 }, cloudUser: null, queueMicrotask: () => {}, ...globals
    });
    return { ...env, document, nodes, listeners };
}

function element(values = {}) {
    const attributes = {};
    let html = '', text = '';
    return Object.assign({
        isConnected: true, disabled: false, dataset: {},
        get innerHTML() { return html; },
        set innerHTML(value) { html = value; text = String(value).replace(/<[^>]*>/g, ''); },
        get textContent() { return text; },
        set textContent(value) { text = value; html = value; },
        setAttribute(key, value) { attributes[key] = value; },
        getAttribute: key => attributes[key], removeAttribute: key => delete attributes[key],
        focus() { this.focused = true; },
        setCustomValidity(message) { this.validityMessage = message; },
        reportValidity() { this.reported = true; return !this.validityMessage; },
    }, values);
}

function fakeForm(mode = 'signin') {
    const button = element({ textContent: 'Submit' }), message = element(), forward = element(), heading = element(), nonceField = element({ hidden: true });
    const elements = Object.fromEntries(Object.entries({ aemail: 'owner@example.test', apassword: 'Password9', adisplay: 'Player', pdisplay: ' Player ', pusername: '', pbio: '', pcountry: '', pnewpassword: 'Password9', pconfirm: 'Password9', pnonce: '', enew: 'new@example.test' }).map(([key, value]) => [key, element({ value })]));
    elements.pnonce.disabled = true;
    const form = element({ dataset: { mode }, elements, profileColors: { color: '#123456', secondaryColor: '#abcdef' },
        querySelector: selector => selector === '[type=submit]' ? button : selector === '#auth-forward' ? forward : selector === 'h3' ? heading : selector === '#nonce-field' ? nonceField : selector === 'input' ? elements.aemail : message
    });
    Object.values(elements).forEach(input => input.form = form);
    return { form, button, message, forward, heading, nonceField };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

function signedIn(app, extra = '') {
    app(`account = { status: 'signed-in', user: { id: 'owner', email: 'owner@example.test', identities: [{ provider: 'email' }] }, profile: { display_name: 'Player', username: 'player', color: '#123456', secondary_color: '#abcdef', bio: 'Hello', country: 'CR', created_at: '2026-10-10T12:00:00Z', ${extra} } }`);
}

test('account button stays hidden off beta and reflects every account status', () => {
    const { app } = createApp();
    assert.equal(app('accountButton()'), '');
    for (const status of ['idle', 'signed-out', 'loading']) {
        app(`account.status = '${status}'`);
        const html = app('accountButton()');
        assert.match(html, /fill="#8a8fa3"/);
        assert.equal(html.includes('aria-busy=true'), status === 'loading');
        if (status !== 'loading') assert.match(html, /data-act=asignin/);
    }
    app(`account = { status: 'signed-in', profile: { display_name: 'Player', username: 'player', color: '#123456', secondary_color: '#abcdef' } }`);
    const html = app('accountButton()');
    assert.match(html, /popovertarget=amenu/);
    assert.match(html, /Account \u00b7 Player/);
    for (const action of ['aprofile', 'aedit', 'asettings', 'asignout']) assert.ok(html.includes('data-act=' + action));
});

test('Google settings share one request and only accept an explicit true', async () => {
    for (const external of [{ google: true }, { google: false }, { google: 'true' }, {}]) {
        let calls = 0;
        const { app } = createApp({ fetch: async (url, options) => {
            calls++;
            assert.ok(url.endsWith('/auth/v1/settings'));
            assert.ok(options.headers.apikey);
            return { ok: true, json: async () => ({ external }) };
        } });
        const first = app('googleSignInAvailable()');
        assert.equal(first, app('googleSignInAvailable()'));
        assert.equal(await first, external.google === true);
        assert.equal(calls, 1);
    }
    const { app } = createApp({ fetch: async () => { throw Error('offline'); } });
    assert.equal(await app('googleSignInAvailable()'), false);
});

test('auth templates provide labelled fields, password toggles and mode navigation', () => {
    const { app } = createApp();
    for (const mode of ['signin', 'signup', 'reset']) {
        const html = app(`authDialog('${mode}')`);
        assert.match(html, /id=af data-mode=/);
        assert.match(html, /label for=aemail/);
        assert.match(html, /id=amsg[^>]*role=alert/);
        assert.equal(html.includes('id=apassword'), mode !== 'reset');
        assert.equal(html.includes('id=adisplay'), mode === 'signup');
        assert.equal(html.includes('data-act=agoogle'), false);
        if (mode !== 'reset') {
            assert.match(html, /aria-controls="apassword"/);
            assert.match(html, /aria-pressed=false/);
        }
    }
});

test('menu, profile card, forms and confirmation panel escape all hostile user values', () => {
    const { app, context, nodes } = createApp();
    const hostile = `<img src=x onerror=alert(1)>"'`;
    context.hostile = hostile;
    signedIn(app);
    app('Object.assign(account.profile, { display_name: hostile, username: hostile, bio: hostile }); account.user.email = hostile');
    const escaped = app('escapeHtml(hostile)');
    for (const template of ['accountButton()', 'profileCard()', 'profileForm()', 'confirmationPanel(hostile)']) {
        const html = app(template);
        assert.equal(html.includes(hostile), false, template);
        assert.ok(html.includes(escaped), template);
        assert.equal(html.includes('<img'), false, template);
    }
    nodes['#enew'] = element();
    app('settingsDialog()');
    assert.ok(nodes['#md'].innerHTML.includes(escaped));
    assert.equal(nodes['#md'].innerHTML.includes('<img'), false);
});

test('Google appears only after availability resolves and never in a replaced dialog', async () => {
    for (const available of [true, false]) {
        let resolve;
        const { app, context, nodes } = createApp();
        const { form } = fakeForm();
        nodes['#af'] = form;
        nodes['#agoogle-slot'] = element({ innerHTML: '' });
        context.googleSignInAvailable = () => new Promise(done => resolve = done);
        app('openAuthDialog()');
        assert.equal(form.elements.aemail.focused, true);
        assert.equal(nodes['#agoogle-slot'].innerHTML, '');
        resolve(available);
        await flush();
        assert.equal(nodes['#agoogle-slot'].innerHTML.includes('data-act=agoogle'), available);
    }
    const { app, context, nodes } = createApp();
    nodes['#af'] = fakeForm().form;
    const slot = nodes['#agoogle-slot'] = element({ innerHTML: '' });
    let resolve;
    context.googleSignInAvailable = () => new Promise(done => resolve = done);
    app('openAuthDialog()');
    slot.isConnected = false;
    resolve(true);
    await flush();
    assert.equal(slot.innerHTML, '');
});

test('email sign-in disables duplicate submits and focuses errors with a resend path', async () => {
    const { app, context } = createApp(), { form, button, message, forward } = fakeForm();
    let resolve, calls = 0;
    context.signInWithEmail = (email, password) => {
        calls++;
        assert.equal(email, 'owner@example.test');
        assert.equal(password, 'Password9');
        return new Promise(done => resolve = done);
    };
    const pending = app('submitAuth')(form);
    assert.equal(button.disabled, true);
    assert.equal(button.getAttribute('aria-busy'), 'true');
    assert.equal(button.textContent, 'Signing in…');
    await app('submitAuth')(form);
    assert.equal(calls, 1);
    resolve({ error: 'authUnconfirmed' });
    await pending;
    assert.equal(button.disabled, false);
    assert.equal(button.getAttribute('aria-busy'), undefined);
    assert.equal(button.textContent, 'Submit');
    assert.equal(message.textContent, app('t("authUnconfirmed")'));
    assert.equal(message.focused, true);
    assert.match(forward.innerHTML, /data-act=aresend/);
});

test('all mapped auth errors appear next to the form and are focused', async () => {
    const { app, context } = createApp();
    const codes = ['invalid_credentials', 'email_not_confirmed', 'user_already_exists', 'weak_password', 'over_email_send_rate_limit', 'over_request_rate_limit', 'same_password', 'otp_expired', 'email_address_invalid', 'unknown'];
    for (const code of codes) {
        context.failure = { code };
        const key = app('authErrorKey(failure)'), { form, message } = fakeForm();
        context.signInWithEmail = async () => ({ error: key });
        await app('submitAuth')(form);
        assert.equal(message.textContent, app(`t('${key}')`));
        assert.equal(message.focused, true);
    }
});

test('sign-in toast waits for the profile and is shown once', async () => {
    const toasts = [], { app, context } = createApp();
    context.showToast = value => toasts.push(value);
    context.signInWithEmail = async () => ({});
    await app('submitAuth')(fakeForm().form);
    assert.deepEqual(toasts, []);
    signedIn(app);
    app('accountRendered(); accountRendered()');
    assert.deepEqual(toasts, ['Signed in as Player']);
});

test('signup passes the name and replaces the form with the inbox panel', async () => {
    const { app, context } = createApp(), { form, heading } = fakeForm('signup');
    context.signUpWithEmail = async (...args) => {
        assert.deepEqual(args, ['owner@example.test', 'Password9', 'Player']);
        return { needsConfirmation: true };
    };
    await app('submitAuth')(form);
    assert.match(form.innerHTML, /Check your inbox/);
    assert.match(form.innerHTML, /owner@example.test/);
    assert.match(form.innerHTML, /data-act=aresend/);
    assert.equal(heading.focused, true);
});

test('reset uses the same message regardless of account existence and keeps failures actionable', async () => {
    const { app, context } = createApp(), messages = [];
    for (const result of [{}, { error: 'authBadLogin' }, { error: 'authExists' }, { error: 'authUnconfirmed' }]) {
        const { form, message } = fakeForm('reset');
        context.sendPasswordReset = async () => result;
        await app('submitAuth')(form);
        messages.push(message.textContent);
        assert.equal(message.focused, true);
    }
    assert.equal(new Set(messages).size, 1);
    assert.equal(messages[0], 'If an account exists for owner@example.test, we sent a link to choose a new password.');
    const { form, message } = fakeForm('reset');
    context.sendPasswordReset = async () => ({ error: 'authOffline' });
    await app('submitAuth')(form);
    assert.equal(message.textContent, app('t("authOffline")'));
});

test('resend and Google actions show pending state and recover from errors', async () => {
    const { app, context } = createApp(), message = element(), root = element({ querySelector: () => message });
    for (const [action, method] of [['resendAccountEmail', 'resendConfirmation'], ['continueWithGoogle', 'signInWithGoogle']]) {
        let resolve;
        const button = element({ dataset: { email: 'owner@example.test' }, closest: () => root });
        context[method] = () => new Promise(done => resolve = done);
        const pending = app(action)(button);
        assert.equal(button.disabled, true);
        resolve({ error: 'authTooMany' });
        await pending;
        assert.equal(button.disabled, false);
        assert.equal(message.textContent, app('t("authTooMany")'));
        assert.equal(message.focused, true);
    }
});

test('pending actions restore the Google mark and other button icons after an error', async () => {
    const { app } = createApp(), button = element({ innerHTML: '<svg aria-hidden=true></svg>Continue with Google' });
    const markup = button.innerHTML;
    await app('accountPending')(button, 'accountSigningIn', async () => ({}));
    assert.equal(button.innerHTML, markup);
});

test('password visibility toggle updates its control, label and pressed state', () => {
    const { app, nodes } = createApp(), input = nodes['#apassword'] = element({ type: 'password' }), text = element();
    const button = element({ querySelector: () => text });
    button.setAttribute('aria-controls', 'apassword');
    app('toggleAccountPassword')(button);
    assert.equal(input.type, 'text');
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    assert.equal(button.getAttribute('aria-label'), 'Hide password');
    app('toggleAccountPassword')(button);
    assert.equal(input.type, 'password');
    assert.equal(button.getAttribute('aria-pressed'), 'false');
});

test('password form requires a match, reveals the nonce and submits it on retry', async () => {
    const { app, context } = createApp(), { form, message, nonceField } = fakeForm(), toasts = [];
    form.elements.pconfirm.value = 'Different9';
    context.updatePassword = async () => assert.fail('mismatched passwords must not be sent');
    await app('submitAccountPassword')(form);
    assert.ok(form.elements.pconfirm.validityMessage);
    assert.equal(message.focused, true);
    form.elements.pconfirm.value = 'Password9';
    context.updatePassword = async (password, nonce) => {
        assert.equal(password, 'Password9');
        assert.equal(nonce, undefined);
        return { needsNonce: true };
    };
    await app('submitAccountPassword')(form);
    assert.equal(nonceField.hidden, false);
    assert.equal(form.elements.pnonce.disabled, false);
    assert.equal(form.elements.pnonce.required, true);
    assert.equal(form.elements.pnonce.focused, true);
    form.elements.pnonce.value = '123456';
    context.updatePassword = async (password, nonce) => { assert.equal(nonce, '123456'); return {}; };
    context.showToast = value => toasts.push(value);
    await app('submitAccountPassword')(form);
    assert.deepEqual(toasts, ['Password changed']);
});

test('profile card localizes country and membership date and preserves biography line breaks', () => {
    const { app } = createApp();
    signedIn(app);
    const html = app('profileCard()');
    assert.match(html, /Costa Rica/);
    assert.match(html, /Member since/);
    assert.match(html, /class=profile-bio>Hello/);
    app("account.profile.username = null");
    assert.match(app('profileCard()'), /No username yet/);
});

test('all 249 countries are unique, localized, sorted and preserve the saved selection', () => {
    const { app } = createApp();
    signedIn(app);
    assert.equal(app('COUNTRY_CODES.length'), 249);
    assert.equal(app('new Set(COUNTRY_CODES).size'), 249);
    for (const lang of ['en', 'es']) {
        app(`ui.lang = '${lang}'`);
        const html = app('profileForm()');
        const options = [...html.matchAll(/<option value="([A-Z]{2})"( selected)?>([^<]*)<\/option>/g)];
        assert.equal(options.length, 249);
        assert.deepEqual(options.filter(option => option[2]).map(option => option[1]), ['CR']);
        const labels = options.map(option => option[3]);
        assert.deepEqual(labels, [...labels].sort((a, b) => a.localeCompare(b, lang)));
    }
});

test('profile form lowercases usernames, clears errors and updates the bio counter', () => {
    const { app, nodes } = createApp(), username = element({ id: 'pusername', value: 'MiXeD_9' }), bio = element({ id: 'pbio', value: 'Hello' });
    username.setCustomValidity('Taken');
    app('accountFormInput')(username);
    assert.equal(username.value, 'mixed_9');
    assert.equal(username.validityMessage, '');
    nodes['#bio-count'] = element();
    app('accountFormInput')(bio);
    assert.equal(nodes['#bio-count'].textContent, '5 / 300');
});

test('profile saves optional empty fields as null and handles username conflicts on the field', async () => {
    const { app, context } = createApp(), { form } = fakeForm(), toasts = [];
    context.showToast = value => toasts.push(value);
    context.saveOwnProfile = async fields => {
        assert.deepEqual({ ...fields }, { display_name: 'Player', username: null, color: '#123456', secondary_color: '#abcdef', bio: null, country: null });
        return {};
    };
    await app('submitAccountProfile')(form);
    assert.deepEqual(toasts, ['Profile saved']);
    context.saveOwnProfile = async () => ({ error: 'usernameTaken' });
    await app('submitAccountProfile')(form);
    assert.equal(form.elements.pusername.validityMessage, app('t("usernameTaken")'));
    assert.equal(form.elements.pusername.focused, true);
    assert.equal(form.elements.pusername.reported, true);
});

test('settings distinguish email identities, send email changes and show confirmation', async () => {
    const { app, context, nodes } = createApp();
    signedIn(app);
    nodes['#enew'] = element();
    assert.equal(app('hasPasswordIdentity()'), true);
    app('settingsDialog()');
    assert.match(nodes['#md'].innerHTML, /Change password/);
    app("account.user.identities = [{ provider: 'google' }]");
    assert.equal(app('hasPasswordIdentity()'), false);
    app('settingsDialog()');
    assert.match(nodes['#md'].innerHTML, /Add a password/);
    const { form, message } = fakeForm();
    context.updateEmail = async email => { assert.equal(email, 'new@example.test'); return { needsConfirmation: true }; };
    await app('submitAccountEmail')(form);
    assert.equal(message.textContent, 'Confirm the change from the links we sent to both addresses.');
});

test('delete confirmation requires the matching account email, case insensitively', async () => {
    const { app, context } = createApp(), message = element(), root = element({ querySelector: () => message }), button = element({ closest: () => root }), toasts = [];
    signedIn(app);
    let deletions = 0;
    context.deleteAccount = async () => { deletions++; return {}; };
    context.showToast = value => toasts.push(value);
    for (const answer of [null, 'wrong@example.test', 'OWNER@EXAMPLE.TEST']) {
        context.showDialog = async options => {
            assert.equal(options.danger, 1);
            assert.equal(options.input, 1);
            assert.ok(options.label.includes('owner@example.test'));
            return answer;
        };
        await app('confirmAccountDeletion')(button);
        if (answer !== 'OWNER@EXAMPLE.TEST') assert.equal(deletions, 0);
    }
    assert.equal(message.focused, true);
    assert.equal(deletions, 1);
    assert.deepEqual(toasts, ['Account deleted']);
});

test('recovery waits for other dialogs, opens once and can open on a later recovery', () => {
    const { app, context, nodes } = createApp();
    signedIn(app);
    app('account.recovering = true');
    let opened = 0;
    context.passwordDialog = () => { opened++; };
    nodes['dialog[open]'] = element();
    app('accountRendered()');
    assert.equal(opened, 0);
    delete nodes['dialog[open]'];
    app('accountRendered(); accountRendered()');
    assert.equal(opened, 1);
    app('account.recovering = false; accountRendered(); account.recovering = true; accountRendered()');
    assert.equal(opened, 2);
});

test('form dispatch reaches named account handlers and preserves level form validation', () => {
    const { app, context, document, nodes } = createApp(), calls = [];
    for (const [id, handler] of [['af', 'submitAuth'], ['pf', 'submitAccountProfile'], ['pwf', 'submitAccountPassword'], ['ef', 'submitAccountEmail'], ['fm', 'saveLevel'], ['wf', 'saveWishlistItem']]) {
        context[handler] = form => calls.push(form.id);
        document.body.onsubmit({ preventDefault() {}, target: { id, elements: { name: { value: 'Level' } } } });
    }
    assert.deepEqual(calls, ['af', 'pf', 'pwf', 'ef', 'fm', 'wf']);
    nodes['#gdq'] = element();
    document.body.onsubmit({ preventDefault() {}, target: { id: 'fm', elements: { name: { value: '' } } } });
    assert.equal(nodes['#gdq'].reported, true);
    assert.ok(nodes['#gdq'].validityMessage);
    assert.equal(app('typeof ACTIONS.asignin'), 'function');
});

test('sign-out shows success or a retryable error and restores its pending button', async () => {
    const { app, context } = createApp(), toasts = [], alerts = [], button = element({ textContent: 'Sign out' });
    context.showToast = message => toasts.push(message);
    context.showDialog = async options => alerts.push(options.title);
    context.signOutAccount = async () => ({});
    await app('signOutFromMenu')(button);
    assert.deepEqual(toasts, ['Signed out']);
    context.signOutAccount = async () => ({ error: 'authOffline' });
    await app('signOutFromMenu')(button);
    assert.deepEqual(alerts, [app('t("authOffline")')]);
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, 'Sign out');
});

test('sign-out warns about pending changes and only proceeds after confirmation', async () => {
    const { app, context } = createApp({ cloudSync: { pending: 3 } }), button = element({ textContent: 'Sign out' });
    let calls = 0;
    context.signOutAccount = async () => { calls++; return {}; };
    context.showToast = () => {};
    for (const answer of [false, true]) {
        context.showDialog = async options => {
            assert.equal(options.danger, 1);
            assert.equal(options.msg, '3 changes are not saved yet. Sign out and lose them?');
            return answer;
        };
        await app('signOutFromMenu')(button);
        assert.equal(calls, answer ? 1 : 0);
    }
});

test('sign-out uses the singular warning for one pending change in both languages', async () => {
    const { app, context } = createApp({ cloudSync: { pending: 1 } }), button = element({ textContent: 'Sign out' });
    for (const [lang, message] of [['en', '1 change is not saved yet. Sign out and lose it?'], ['es', '1 cambio aún no está guardado. ¿Cerrar sesión y perderlo?']]) {
        app(`ui.lang = '${lang}'`);
        context.showDialog = async options => { assert.equal(options.msg, message); return false; };
        await app('signOutFromMenu')(button);
    }
});

test('profile, password and email failures keep the form open and focus their alerts', async () => {
    const { app, context } = createApp();
    for (const [handler, method] of [['submitAccountProfile', 'saveOwnProfile'], ['submitAccountPassword', 'updatePassword'], ['submitAccountEmail', 'updateEmail']]) {
        const { form, message } = fakeForm();
        context[method] = async () => ({ error: 'authOffline' });
        await app(handler)(form);
        assert.equal(message.textContent, app('t("authOffline")'));
        assert.equal(message.focused, true);
    }
});

test('both popovers anchor to their own trigger and stay within the viewport', () => {
    const { context, nodes, listeners } = createApp({ innerWidth: 360, innerHeight: 800 });
    const anchors = { pmenu: { left: 12, bottom: 150 }, amenu: { left: 250, bottom: 60 } };
    for (const id of ['pmenu', 'amenu']) {
        nodes[`[popovertarget=${id}]`] = { getBoundingClientRect: () => anchors[id] };
        const popover = { id, style: {} };
        listeners.beforetoggle[0]({ target: popover, newState: 'open' });
        assert.equal(popover.style.top, anchors[id].bottom + 6 + 'px');
        assert.equal(popover.style.width, '336px');
        assert.equal(popover.style.left, '12px');
    }
    assert.ok(context.document);
});

test('email templates are bilingual, configured and carry app-verifiable links or a code', () => {
    const config = readFileSync('supabase/config.toml', 'utf8');
    for (const [name, type] of [['confirmation', 'email'], ['recovery', 'recovery'], ['email_change', 'email_change'], ['reauthentication', null]]) {
        const html = readFileSync(`supabase/templates/${name}.html`, 'utf8');
        assert.ok(config.includes(`[auth.email.template.${name}]`));
        assert.ok(config.includes(`content_path = "./supabase/templates/${name}.html"`));
        assert.ok(html.includes('Personal Ranked Progress'));
        assert.match(html, /lang="es"/);
        assert.match(html, /lang="en"/);
        assert.doesNotMatch(html, /<script|<img|https?:/i);
        if (type) assert.ok(html.includes(`{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=${type}`));
        else assert.ok(html.includes('{{ .Token }}'));
    }
});

test('privacy starts with the specified account disclosure in both languages', () => {
    const { app } = createApp();
    const paragraphs = {
        es: 'Puedes usar la aplicación sin cuenta: entonces tus datos (niveles, perfiles y wishlists) se guardan solo en el almacenamiento local de tu navegador y únicamente salen de él si exportas un perfil. Si creas una cuenta (en pruebas), tu correo y el progreso que guardes en ella se almacenan en Supabase, el proveedor de base de datos del proyecto, en servidores de Estados Unidos; puedes borrar la cuenta y sus datos cuando quieras desde Ajustes de la cuenta. Si entras con Google, Google comparte con la aplicación tu nombre y tu correo. El único servidor propio del proyecto es el intermediario de la búsqueda de niveles, que no guarda tus datos.',
        en: "You can use the app without an account: your data (levels, profiles and wishlists) is then stored only in your browser's local storage and leaves it only if you export a profile. If you create an account (in testing), your email address and the progress you save in it are stored with Supabase, the project's database provider, on servers in the United States; you can delete the account and its data at any time from Account settings. If you sign in with Google, Google shares your name and email address with the app. The project's only server of its own is the level search relay, which does not store your data."
    };
    for (const lang of ['es', 'en']) assert.equal(app(`TRANSLATIONS.${lang}.privacyTxt`).split('\n\n')[0], paragraphs[lang]);
});

test('share dialog covers username setup, private and public profiles', () => {
    const { app, nodes } = createApp({ location: new URL('https://example.test/app/?beta=cloud') });
    signedIn(app);
    app('account.profile.username = null; shareDialog()');
    assert.match(nodes['#md'].innerHTML, /Choose a username/);
    assert.doesNotMatch(nodes['#md'].innerHTML, /data-act=asharestate/);
    app('account.profile.username = "player"; account.profile.is_public = false; shareDialog()');
    assert.match(nodes['#md'].innerHTML, /Only you can see your progress/);
    assert.match(nodes['#md'].innerHTML, /data-v=false aria-pressed=true/);
    assert.doesNotMatch(nodes['#md'].innerHTML, /id=share-link/);
    app('account.profile.is_public = true; shareDialog()');
    assert.match(nodes['#md'].innerHTML, /data-v=true aria-pressed=true/);
    assert.match(nodes['#md'].innerHTML, /readonly/);
    assert.match(nodes['#md'].innerHTML, /https:\/\/example.test\/app\/\?user=player/);
    assert.match(app('profileCard()'), /Public/);
    assert.match(app('profileCard()'), /data-act=ashare/);
    assert.match(app('accountMenu()'), /data-act=ashare/);
});

test('share copy reports success and selects the link after clipboard failure', async () => {
    const toasts = [], copies = [];
    const { app, context, nodes } = createApp({ navigator: { clipboard: { writeText: async value => copies.push(value) } }, location: new URL('https://example.test/app/'), showToast: value => toasts.push(value) });
    context.showToast = value => toasts.push(value);
    signedIn(app, 'is_public: true');
    const input = nodes['#share-link'] = element({ value: 'https://example.test/app/?user=player', select() { this.selected = true; } });
    await app('copyProfileLink()');
    assert.deepEqual(copies, [input.value]);
    assert.deepEqual(toasts, ['Link copied']);
    app('navigator.clipboard.writeText = async () => { throw Error("denied"); }');
    await app('copyProfileLink()');
    assert.equal(input.selected, true);
    assert.equal(input.focused, true);
    assert.equal(toasts.at(-1), 'Press Ctrl+C to copy');
});

test('share visibility saves once with pending controls and inline errors', async () => {
    const { app, context, nodes } = createApp({ location: new URL('https://example.test/app/') });
    signedIn(app, 'is_public: false');
    let resolve, fields, calls = 0;
    context.saveOwnProfile = values => { calls++; fields = values; return new Promise(done => resolve = done); };
    const buttons = [element({ dataset: { v: 'false' } }), element({ dataset: { v: 'true' } })], message = element();
    const root = element({ querySelector: () => message, querySelectorAll: () => buttons });
    buttons.forEach(button => button.closest = () => root);
    nodes['#share-dialog'] = root;
    const pending = app('setProfileVisibility')(buttons[1]);
    assert.deepEqual({ ...fields }, { is_public: true });
    assert.ok(buttons.every(button => button.disabled));
    await app('setProfileVisibility')(buttons[0]);
    assert.equal(calls, 1);
    resolve({ error: 'authOffline' });
    await pending;
    assert.ok(buttons.every(button => !button.disabled));
    assert.equal(message.textContent, app('t("authOffline")'));
    context.saveOwnProfile = async values => { app(`account.profile.is_public = ${values.is_public}`); return {}; };
    await app('setProfileVisibility')(buttons[1]);
    assert.match(nodes['#md'].innerHTML, /id=share-link/);
    await app('setProfileVisibility')(buttons[0]);
    assert.match(nodes['#md'].innerHTML, /Only you can see your progress/);
});
