import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

const user = { id: 'user-a', user_metadata: { display_name: ' Player A ' } };
const ownProfile = { id: 'user-a', display_name: 'Player A', username: null, is_public: false };
const plain = value => JSON.parse(JSON.stringify(value));

function accounts({ url = 'https://example.com/app/?keep=yes#section', saved = false, beta = true } = {}) {
    const calls = [], timers = [], alerts = [], toasts = [], dialogs = [], renders = [], scripts = [];
    const answers = new Map();
    const location = new URL(url);
    let callback;
    const respond = (method, value) => answers.set(method, [...(answers.get(method) || []), value]);
    const invoke = async (method, ...args) => {
        calls.push([method, ...plain(args)]);
        const value = answers.get(method)?.shift();
        if (value instanceof Error)
            throw value;
        return await (value || { data: { user, session: { user } }, error: null });
    };
    const client = {
        auth: Object.fromEntries(['getSession', 'signInWithOAuth', 'signInWithPassword', 'signUp', 'resend', 'resetPasswordForEmail', 'updateUser', 'reauthenticate', 'signOut', 'verifyOtp']
            .map(method => [method, (...args) => invoke(method, ...args)])),
        rpc: (...args) => invoke('rpc', ...args),
        from(table) {
            calls.push(['from', table]);
            return {
                select(columns) {
                    calls.push(['select', columns]);
                    return { eq: (column, id) => {
                        calls.push(['eq', column, id]);
                        return { maybeSingle: () => invoke('maybeSingle') };
                    } };
                },
                insert: fields => invoke('insert', fields),
                update(fields) {
                    calls.push(['update', plain(fields)]);
                    return { eq: (column, id) => {
                        calls.push(['eq', column, id]);
                        return { select: () => ({ single: () => invoke('single') }) };
                    } };
                }
            };
        }
    };
    client.auth.onAuthStateChange = handler => {
        calls.push(['subscribe']);
        callback = handler;
        return { data: { subscription: { unsubscribe() {} } } };
    };
    const localStorage = { gbeta: beta ? 'cloud' : '', removeItem(key) { delete this[key]; } };
    if (saved)
        localStorage['sb-mjgklvdnuhbnyucytaji-auth-token'] = 'saved';
    const loaded = loadScripts(['js/config.js', 'js/cloud.js', 'js/account.js', 'js/i18n.js'], {
        URL, URLSearchParams, TypeError, location, localStorage, ui: { lang: 'en' },
        history: { state: { keep: true }, replaceState(state, title, next) { location.href = new URL(next, location).href; } },
        document: { createElement: () => ({ remove() {} }), head: { appendChild(script) { scripts.push(script); script.onload(); } } },
        supabase: { createClient() { calls.push(['createClient']); return client; } },
        setTimeout(work, delay) { assert.equal(delay, 0); timers.push(work); },
        render() { renders.push(plain(loaded.app('account'))); },
        showAlert(text) { alerts.push(text); },
        showToast(text) { toasts.push(text); },
        openAuthDialog(mode, note) { dialogs.push([mode, note]); }
    });
    return {
        ...loaded, calls, timers, alerts, toasts, dialogs, renders, scripts, location, respond,
        state: () => plain(loaded.app('account')),
        emit: (event, session) => callback(event, session),
        async flush() { while (timers.length) await timers.shift()(); },
        async signedIn() {
            await loaded.app('initAccount()');
            respond('maybeSingle', { data: ownProfile, error: null });
            callback('SIGNED_IN', { user });
            await this.flush();
        }
    };
}

test('beta off stays off and beta on without a session stays idle without loading the client', async () => {
    for (const beta of [false, true]) {
        const page = accounts({ beta });
        assert.deepEqual(page.state(), { status: 'off', user: null, profile: null, recovering: false });
        await page.app('initAccount()');
        assert.equal(page.state().status, beta ? 'idle' : 'off');
        assert.equal(page.scripts.length, 0);
        assert.equal(page.renders.length, beta ? 1 : 0);
    }
});

test('a saved session or any auth parameter in query or hash loads the client once', async () => {
    const urls = ['code', 'token_hash', 'error', 'error_code', 'error_description'];
    const options = [{ saved: true }, ...urls.flatMap(key => ['?', '#'].map(separator => ({ url: 'https://example.com/app/' + separator + key + '=value' })))];
    for (const option of options) {
        const page = accounts(option);
        await page.app('initAccount()');
        await page.app('initAccount()');
        assert.equal(page.scripts.length, 1, JSON.stringify(option));
        assert.equal(page.calls.filter(call => call[0] == 'subscribe').length, 1);
    }
});

test('the auth callback defers profile calls and redraws only changed state', async () => {
    const page = accounts({ saved: true });
    await page.app('initAccount()');
    const before = page.calls.length;
    page.respond('maybeSingle', { data: ownProfile, error: null });
    assert.equal(page.emit('INITIAL_SESSION', { user }), undefined);
    assert.equal(page.calls.length, before);
    assert.equal(page.state().user, null);
    await page.flush();
    assert.deepEqual(page.state(), { status: 'signed-in', user, profile: ownProfile, recovering: false });
    assert.ok(page.renders.some(state => state.status == 'loading' && state.user?.id == user.id));
    assert.ok(page.calls.some(call => call[0] == 'eq' && call[1] == 'id' && call[2] == user.id));
    const draws = page.renders.length, reads = page.calls.filter(call => call[0] == 'maybeSingle').length;
    for (const event of ['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'])
        page.emit(event, { user });
    await page.flush();
    assert.equal(page.renders.length, draws);
    assert.equal(page.calls.filter(call => call[0] == 'maybeSingle').length, reads);
    page.emit('USER_UPDATED', { user: { ...user, email: 'new@example.com' } });
    await page.flush();
    assert.equal(page.state().user.email, 'new@example.com');
    page.emit('PASSWORD_RECOVERY', { user });
    await page.flush();
    assert.equal(page.state().recovering, true);
    page.emit('SIGNED_OUT', null);
    await page.flush();
    assert.deepEqual(page.state(), { status: 'signed-out', user: null, profile: null, recovering: false });
    const signedOutDraws = page.renders.length;
    page.emit('INITIAL_SESSION', null);
    await page.flush();
    assert.equal(page.renders.length, signedOutDraws);
});

test('profile fallback inserts once, tolerates a duplicate and trims the metadata name', async () => {
    for (const duplicate of [false, true]) {
        const page = accounts({ saved: true });
        await page.app('initAccount()');
        page.respond('maybeSingle', { data: null, error: null });
        page.respond('insert', { data: null, error: duplicate ? { code: '23505' } : null });
        page.respond('maybeSingle', { data: ownProfile, error: null });
        page.emit('SIGNED_IN', { user });
        await page.flush();
        assert.deepEqual(page.calls.filter(call => call[0] == 'insert'), [['insert', { id: 'user-a', display_name: 'Player A' }]]);
        assert.equal(page.state().status, 'signed-in');
    }
    for (const [metadata, expected] of [[{ full_name: 'Full' }, 'Full'], [{ name: 'Name' }, 'Name'], [{}, 'Player'], [{ display_name: '  ' }, 'Player'], [{ display_name: 'x'.repeat(50) }, 'x'.repeat(40)]]) {
        const page = accounts({ saved: true });
        await page.app('initAccount()');
        page.respond('maybeSingle', { data: null, error: null });
        page.respond('maybeSingle', { data: ownProfile, error: null });
        page.emit('SIGNED_IN', { user: { ...user, user_metadata: metadata } });
        await page.flush();
        assert.equal(page.calls.find(call => call[0] == 'insert')[1].display_name, expected);
    }
});

test('profile read and insert failures are surfaced without claiming a signed-in profile', async () => {
    for (const stage of ['maybeSingle', 'insert']) {
        const page = accounts({ saved: true });
        await page.app('initAccount()');
        if (stage == 'insert')
            page.respond('maybeSingle', { data: null, error: null });
        page.respond(stage, { data: null, error: { code: 'over_request_rate_limit' } });
        page.emit('SIGNED_IN', { user });
        await page.flush();
        assert.notEqual(page.state().status, 'signed-in');
        assert.equal(page.state().profile, null);
        assert.equal(page.alerts.length, 1);
    }
});

const actionCases = [
    ['signInWithGoogle()', 'signInWithOAuth', [{ provider: 'google', options: { redirectTo: 'https://example.com/app/' } }], {}],
    ['signInWithEmail("a@example.com", "password")', 'signInWithPassword', [{ email: 'a@example.com', password: 'password' }], {}],
    ['signUpWithEmail("a@example.com", "password", "Player")', 'signUp', [{ email: 'a@example.com', password: 'password', options: { emailRedirectTo: 'https://example.com/app/', data: { display_name: 'Player' } } }], {}],
    ['resendConfirmation("a@example.com")', 'resend', [{ type: 'signup', email: 'a@example.com', options: { emailRedirectTo: 'https://example.com/app/' } }], {}],
    ['sendPasswordReset("a@example.com")', 'resetPasswordForEmail', ['a@example.com', { redirectTo: 'https://example.com/app/' }], {}],
    ['updatePassword("password", "123456")', 'updateUser', [{ password: 'password', nonce: '123456' }], {}],
    ['updateEmail("a@example.com")', 'updateUser', [{ email: 'a@example.com' }, { emailRedirectTo: 'https://example.com/app/' }], { needsConfirmation: true }],
    ['signOutAccount()', 'signOut', [{ scope: 'local' }], {}],
    ['deleteAccount()', 'rpc', ['delete_account'], {}]
];

for (const [expression, method, args, expected] of actionCases) {
    test(expression + ' uses the correct client call and success shape', async () => {
        const page = accounts();
        assert.deepEqual(plain(await page.app(expression)), expected);
        assert.ok(page.calls.some(call => JSON.stringify(call) == JSON.stringify([method, ...args])));
        if (method == 'rpc')
            assert.deepEqual(page.calls.at(-1), ['signOut', { scope: 'local' }]);
    });
    test(expression + ' maps returned errors and thrown network failures', async () => {
        for (const failure of [{ data: null, error: { code: 'invalid_credentials' } }, new TypeError('Failed to fetch')]) {
            const page = accounts();
            page.respond(method, failure);
            const result = plain(await page.app(expression));
            assert.deepEqual(result, { error: failure instanceof Error ? 'authOffline' : 'authBadLogin' });
        }
    });
}

test('sign-up without a session needs confirmation', async () => {
    const page = accounts();
    page.respond('signUp', { data: { user, session: null }, error: null });
    assert.deepEqual(plain(await page.app('signUpWithEmail("a@example.com", "password", "Player")')), { needsConfirmation: true });
});

test('password changes request a nonce when required and clear recovery only after success', async () => {
    const page = accounts();
    page.app('account.recovering = true');
    page.respond('updateUser', { data: null, error: { code: 'reauthentication_needed' } });
    assert.deepEqual(plain(await page.app('updatePassword("password")')), { needsNonce: true });
    assert.equal(page.calls.at(-1)[0], 'reauthenticate');
    assert.equal(page.state().recovering, true);
    page.respond('updateUser', { data: null, error: { code: 'reauthentication_needed' } });
    page.respond('reauthenticate', { data: null, error: { status: 429 } });
    assert.deepEqual(plain(await page.app('updatePassword("password")')), { error: 'authTooMany' });
    assert.deepEqual(plain(await page.app('updatePassword("password", "123456")')), {});
    assert.equal(page.state().recovering, false);
});

test('profile saves allow only editable fields and use the signed-in user id', async () => {
    const page = accounts({ saved: true });
    await page.signedIn();
    const fields = { display_name: 'New', username: 'new_name', color: '#123456', secondary_color: '#abcdef', bio: 'Hello', country: 'CR', is_public: true };
    page.respond('single', { data: { ...ownProfile, ...fields }, error: null });
    page.context.fields = { ...fields, id: 'user-b', created_at: 'fake', updated_at: 'fake', unexpected: true };
    assert.deepEqual(plain(await page.app('saveOwnProfile(fields)')), {});
    assert.deepEqual(page.calls.find(call => call[0] == 'update'), ['update', fields]);
    assert.deepEqual(page.calls.at(-2), ['eq', 'id', 'user-a']);
    assert.deepEqual(page.state().profile, { ...ownProfile, ...fields });
    for (const [code, key] of [['23505', 'usernameTaken'], ['23514', 'profileInvalid'], ['other', 'authFailed']]) {
        page.respond('single', { data: null, error: { code } });
        assert.deepEqual(plain(await page.app('saveOwnProfile({ username: "new_name" })')), { error: key });
        assert.equal(page.state().profile.display_name, 'New');
    }
    page.respond('single', new TypeError('Failed to fetch'));
    assert.deepEqual(plain(await page.app('saveOwnProfile({ bio: "Hello" })')), { error: 'authOffline' });
});

test('sign-out clears account state and a failed sign-out preserves it', async () => {
    const page = accounts({ saved: true });
    await page.signedIn();
    page.app('account.recovering = true');
    page.respond('signOut', { error: { status: 0 } });
    assert.deepEqual(plain(await page.app('signOutAccount()')), { error: 'authOffline' });
    assert.equal(page.state().status, 'signed-in');
    assert.deepEqual(plain(await page.app('signOutAccount()')), {});
    assert.deepEqual(page.state(), { status: 'signed-out', user: null, profile: null, recovering: false });
});

test('deletion stops on RPC error and reports local sign-out errors', async () => {
    const page = accounts();
    page.respond('rpc', { error: { code: 'invalid_credentials' } });
    assert.deepEqual(plain(await page.app('deleteAccount()')), { error: 'authBadLogin' });
    assert.equal(page.calls.some(call => call[0] == 'signOut'), false);
    page.respond('signOut', { error: { status: 0 } });
    assert.deepEqual(plain(await page.app('deleteAccount()')), { error: 'authOffline' });
});

test('email links verify supported types, set recovery and remove auth parameters from query and hash', async () => {
    for (const type of ['email', 'signup', 'recovery', 'email_change']) {
        for (const separator of ['?', '#']) {
            const page = accounts({ url: `https://example.com/app/${separator}token_hash=secret&type=${type}&keep=yes` });
            await page.app('initAccount()');
            assert.ok(page.calls.some(call => JSON.stringify(call) == JSON.stringify(['verifyOtp', { token_hash: 'secret', type }])));
            assert.equal(page.state().recovering, type == 'recovery');
            assert.equal(page.location.href, 'https://example.com/app/' + separator + 'keep=yes');
        }
    }
    const page = accounts({ url: 'https://example.com/app/?keep=yes&code=secret&token_hash=secret&type=invalid#error=failed&error_code=otp_expired&error_description=expired&section=stats' });
    await page.app('initAccount()');
    assert.equal(page.calls.some(call => call[0] == 'verifyOtp'), false);
    assert.equal(page.location.href, 'https://example.com/app/?keep=yes#section=stats');
    assert.deepEqual(page.alerts, [page.app('t("authLinkExpired")')]);
});

test('an email change link says whether the other address still has to confirm', async () => {
    for (const [newEmail, key] of [['new@example.test', 'accountEmailOtherLink'], [null, 'accountEmailUpdated']]) {
        const page = accounts({ url: 'https://example.com/app/?token_hash=secret&type=email_change' });
        page.respond('verifyOtp', { data: { user: { ...user, new_email: newEmail } }, error: null });
        await page.app('initAccount()');
        assert.deepEqual(page.toasts, [page.app('t("' + key + '")')]);
        assert.deepEqual(page.alerts, []);
    }
});

test('a code that brings no session opens sign-in with an explanation, and a working code does not', async () => {
    for (const session of [null, { user }]) {
        const page = accounts({ url: 'https://example.com/app/?code=from-email' });
        page.respond('getSession', { data: { session }, error: null });
        await page.app('initAccount()');
        assert.deepEqual(page.dialogs, session ? [] : [['signin', page.app('t("authLinkElsewhere")')]]);
        assert.deepEqual(page.alerts, []);
        assert.equal(page.location.href, 'https://example.com/app/');
    }
});

test('verification failures and URL errors are shown once with translated messages', async () => {
    for (const url of ['?token_hash=secret&type=recovery&keep=yes#section=stats', '?error=denied&error_code=otp_expired&error_description=expired&keep=yes#section=stats']) {
        const page = accounts({ url: 'https://example.com/app/' + url });
        page.respond('verifyOtp', { data: null, error: { code: 'otp_expired' } });
        await page.app('initAccount()');
        await page.app('initAccount()');
        assert.deepEqual(page.alerts, [page.app('t("authLinkExpired")')]);
        assert.equal(page.location.href, 'https://example.com/app/?keep=yes#section=stats');
    }
});

test('auth errors prefer known codes before status and include fetch failures', () => {
    const page = accounts();
    const mappings = {
        invalid_credentials: 'authBadLogin', email_not_confirmed: 'authUnconfirmed', user_already_exists: 'authExists', email_exists: 'authExists',
        weak_password: 'authWeak', over_email_send_rate_limit: 'authEmailWait', over_request_rate_limit: 'authTooMany', same_password: 'authSamePassword',
        otp_expired: 'authLinkExpired', email_address_invalid: 'authBadEmail'
    };
    for (const [code, key] of Object.entries(mappings)) {
        assert.equal(page.app('authErrorKey')({ code, status: 429 }), key);
        assert.notEqual(page.app(`t('${key}')`), key);
    }
    for (const failure of [{ name: 'AuthRetryableFetchError' }, { status: 0 }, new TypeError('Failed to fetch')])
        assert.equal(page.app('authErrorKey')(failure), 'authOffline');
    assert.equal(page.app('authErrorKey')({ status: 429 }), 'authTooMany');
    assert.equal(page.app('authErrorKey')({ code: 'unknown', status: 500 }), 'authFailed');
    assert.equal(page.app('authErrorKey')(new TypeError('Invalid input')), 'authFailed');
});

test('PKCE parameters stay available until the client has restored its session', async () => {
    const page = accounts({ url: 'https://example.com/app/?code=secret&keep=yes#section=stats' });
    let finish;
    page.respond('getSession', new Promise(resolve => { finish = resolve; }));
    const initialization = page.app('initAccount()');
    await new Promise(setImmediate);
    assert.equal(page.location.searchParams.get('code'), 'secret');
    finish({ data: { session: null }, error: null });
    await initialization;
    assert.equal(page.location.href, 'https://example.com/app/?keep=yes#section=stats');
});

test('an initial signed-out event does not discard a verified recovery session', async () => {
    const page = accounts({ url: 'https://example.com/app/?token_hash=secret&type=recovery' });
    await page.app('initAccount()');
    page.respond('maybeSingle', { data: ownProfile, error: null });
    page.emit('INITIAL_SESSION', null);
    page.emit('PASSWORD_RECOVERY', { user });
    await page.flush();
    assert.equal(page.state().status, 'signed-in');
    assert.equal(page.state().recovering, true);
});

test('a profile request is shared across auth events and cannot restore an account after sign-out', async () => {
    const page = accounts({ saved: true });
    await page.app('initAccount()');
    let finish;
    page.respond('maybeSingle', new Promise(resolve => { finish = resolve; }));
    page.emit('SIGNED_IN', { user });
    const pending = page.timers.shift()();
    await new Promise(setImmediate);
    page.emit('TOKEN_REFRESHED', { user });
    await page.flush();
    assert.equal(page.calls.filter(call => call[0] == 'maybeSingle').length, 1);
    await page.app('signOutAccount()');
    finish({ data: ownProfile, error: null });
    await pending;
    assert.deepEqual(page.state(), { status: 'signed-out', user: null, profile: null, recovering: false });
});

test('changing users loads the new own profile and drops the old recovery flag', async () => {
    const page = accounts({ saved: true });
    await page.signedIn();
    page.app('account.recovering = true');
    const other = { id: 'user-b', user_metadata: {} }, otherProfile = { id: 'user-b', display_name: 'Other' };
    page.respond('maybeSingle', { data: otherProfile, error: null });
    page.emit('SIGNED_IN', { user: other });
    await page.flush();
    assert.deepEqual(page.state(), { status: 'signed-in', user: other, profile: otherProfile, recovering: false });
});

test('auth cleanup preserves unrelated query and hash parameters and removes an empty hash', async () => {
    for (const [hash, expected] of [
        ['#section=stats&error=denied', '#section=stats'],
        ['#error=denied', ''],
        ['#keep=a%20b&error=denied', '#keep=a+b']
    ]) {
        const page = accounts({ url: 'https://example.com/app/?keep=yes&code=secret' + hash });
        await page.app('initAccount()');
        assert.equal(page.location.search, '?keep=yes');
        assert.equal(page.location.hash, expected);
    }
});

test('beta off refuses account actions without loading the vendor', async () => {
    const page = accounts({ beta: false });
    for (const [expression] of actionCases)
        assert.deepEqual(plain(await page.app(expression)), { error: 'authFailed' });
    assert.deepEqual(plain(await page.app('saveOwnProfile({ display_name: "Player" })')), { error: 'authFailed' });
    assert.equal(page.scripts.length, 0);
});

test('a failed vendor load returns an offline error and the next action retries', async () => {
    const page = accounts();
    page.context.document.head.appendChild = script => { page.scripts.push(script); script.onerror(); };
    assert.deepEqual(plain(await page.app('signInWithEmail("a@example.com", "password")')), { error: 'authOffline' });
    page.context.document.head.appendChild = script => { page.scripts.push(script); script.onload(); };
    assert.deepEqual(plain(await page.app('signInWithEmail("a@example.com", "password")')), {});
    assert.equal(page.scripts.length, 2);
    assert.notEqual(page.scripts[0], page.scripts[1]);
});
