/** Account state, session restoration, and authentication and profile actions. */

let account = { status: 'off', user: null, profile: null, recovering: false };
let accountClientPromise, accountInitialized = false;
let googleSettingsPromise;
const AUTH_PARAMS = ['code', 'token_hash', 'type', 'error', 'error_code', 'error_description', 'access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type', 'provider_token', 'provider_refresh_token'];

function googleSignInAvailable() {
    if (!googleSettingsPromise)
        googleSettingsPromise = Promise.resolve().then(() => fetch(SUPABASE_URL + '/auth/v1/settings', { headers: { apikey: SUPABASE_KEY } }))
            .then(response => response.ok ? response.json() : null)
            .then(settings => settings?.external?.google === true).catch(() => false);
    return googleSettingsPromise;
}

function hasPasswordIdentity() {
    return account.status == 'signed-in' && !!account.user?.identities?.some(identity => identity.provider == 'email');
}

/** Updates account state and renders only when its values change. */
function setAccount(changes) {
    if (Object.keys(changes).some(key => JSON.stringify(account[key]) !== JSON.stringify(changes[key]))) {
        Object.assign(account, changes);
        render();
    }
}

/** Return target for auth redirects, without query parameters or fragments. */
const appUrl = () => location.origin + location.pathname;

/** Maps auth failures to translation keys, preferring known codes over HTTP status. */
function authErrorKey(error) {
    const keys = {
        invalid_credentials: 'authBadLogin', email_not_confirmed: 'authUnconfirmed',
        user_already_exists: 'authExists', email_exists: 'authExists', weak_password: 'authWeak',
        over_email_send_rate_limit: 'authEmailWait', over_request_rate_limit: 'authTooMany',
        same_password: 'authSamePassword', otp_expired: 'authLinkExpired', email_address_invalid: 'authBadEmail'
    };
    if (Object.hasOwn(keys, error?.code))
        return keys[error.code];
    if (error?.status == 429)
        return 'authTooMany';
    if (error?.name == 'AuthRetryableFetchError' || error?.status === 0
        || (error?.name == 'TypeError' && /fetch|network|load failed/i.test(error.message)))
        return 'authOffline';
    return 'authFailed';
}

/** Loads the client and subscribes to auth events once, sharing concurrent attempts. */
function startAccount() {
    if (!accountClientPromise) {
        setAccount({ status: 'loading' });
        accountClientPromise = loadCloud().then(client => {
            client.auth.onAuthStateChange((event, session) => {
                // Auth holds its session lock during this callback; profile queries must run after it returns.
                setTimeout(() => applyAccountSession(event, session), 0);
            });
            return client;
        }).catch(error => {
            accountClientPromise = null;
            setAccount({ status: 'idle' });
            throw error;
        });
    }
    return accountClientPromise;
}

/** Applies deferred auth events and loads the current user's profile, ignoring stale results. */
async function applyAccountSession(event, session) {
    if (event == 'SIGNED_OUT' || !session?.user) {
        setAccount({ status: 'signed-out', user: null, profile: null, recovering: false });
        return;
    }
    if (!['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'PASSWORD_RECOVERY'].includes(event))
        return;
    const nextUser = session.user, changedUser = account.user?.id != nextUser.id;
    setAccount({
        user: nextUser,
        ...(changedUser ? { status: 'loading', profile: null, recovering: false } : {}),
        ...(event == 'PASSWORD_RECOVERY' ? { recovering: true } : {})
    });
    if (changedUser || (!account.profile && account.status != 'loading')) {
        try {
            const own = await ensureOwnProfile();
            if (account.user?.id == nextUser.id)
                setAccount({ profile: own, status: 'signed-in' });
        }
        catch (error) {
            if (account.user?.id == nextUser.id) {
                setAccount({ status: 'signed-out', user: null, profile: null, recovering: false });
                showAlert(t(authErrorKey(error)));
            }
        }
    }
}

/** Reads auth-link parameters from both the query and the hash. */
function accountUrlParams() {
    const url = new URL(location.href);
    return { url, fragment: new URLSearchParams(url.hash.slice(1)) };
}

/** Removes consumed auth-link parameters while keeping unrelated parameters. */
function cleanAccountUrl() {
    const { url, fragment } = accountUrlParams();
    if (!AUTH_PARAMS.some(key => url.searchParams.has(key) || fragment.has(key)))
        return;
    for (const key of AUTH_PARAMS) {
        url.searchParams.delete(key);
        fragment.delete(key);
    }
    url.hash = fragment.toString();
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
}

/** Restores a saved session or handles an auth link; otherwise leaves the client unloaded. */
async function initAccount() {
    if (accountInitialized || !cloudBeta())
        return;
    accountInitialized = true;
    const { url, fragment } = accountUrlParams();
    const get = key => url.searchParams.get(key) || fragment.get(key);
    const hasAuth = ['code', 'token_hash', 'error', 'error_code', 'error_description'].some(key => url.searchParams.has(key) || fragment.has(key));
    if (!hasAuth && !hasCloudSession()) {
        setAccount({ status: 'idle' });
        return;
    }
    let linkError = get('error') || get('error_code') || get('error_description')
        ? { code: get('error_code') || get('error') } : null;
    try {
        const client = await startAccount();
        const restored = await client.auth.getSession();
        if (restored.error)
            linkError = linkError || restored.error;
        const token = get('token_hash'), type = get('type');
        if (!linkError && token && ['email', 'signup', 'recovery', 'email_change'].includes(type)) {
            const { data, error } = await client.auth.verifyOtp({ token_hash: token, type });
            if (error)
                linkError = error;
            else if (type == 'recovery')
                setAccount({ recovering: true });
            // An email change needs both addresses to confirm; until then the user still has a pending new_email
            else if (type == 'email_change')
                showToast(t(data?.user?.new_email ? 'accountEmailOtherLink' : 'accountEmailUpdated'));
        }
    }
    catch (error) {
        linkError = linkError || error;
    }
    finally {
        cleanAccountUrl();
    }
    if (linkError)
        showAlert(t(authErrorKey(linkError)));
}

/** Reads the owner's row, recreating it if the signup trigger has not supplied it. */
async function ensureOwnProfile() {
    const client = await startAccount(), owner = account.user;
    if (!owner)
        throw Error('No account session');
    const select = () => client.from('profiles').select('*').eq('id', owner.id).maybeSingle();
    let result = await select();
    if (result.error)
        throw result.error;
    if (!result.data) {
        const metadata = owner.user_metadata || {};
        const name = [metadata.display_name, metadata.full_name, metadata.name].find(value => typeof value == 'string' && value.trim()) || 'Player';
        const inserted = await client.from('profiles').insert({ id: owner.id, display_name: name.trim().slice(0, 40) });
        if (inserted.error && inserted.error.code != '23505')
            throw inserted.error;
        result = await select();
        if (result.error)
            throw result.error;
    }
    if (!result.data)
        throw Error('Account profile is missing');
    return result.data;
}

/** Runs a beta account action and converts expected failures into translation keys. */
async function accountAction(action) {
    try {
        if (!cloudBeta())
            return { error: 'authFailed' };
        const result = await action(await startAccount());
        if (result.error && typeof result.error != 'string')
            return { error: authErrorKey(result.error) };
        return result;
    }
    catch (error) {
        return { error: authErrorKey(error) };
    }
}

async function signInWithGoogle() {
    return accountAction(async client => {
        const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: appUrl() } });
        return error ? { error } : {};
    });
}

async function signInWithEmail(email, password) {
    return accountAction(async client => {
        const { error } = await client.auth.signInWithPassword({ email, password });
        return error ? { error } : {};
    });
}

async function signUpWithEmail(email, password, displayName) {
    return accountAction(async client => {
        const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: appUrl(), data: { display_name: displayName } } });
        return error ? { error } : data.session ? {} : { needsConfirmation: true };
    });
}

async function resendConfirmation(email) {
    return accountAction(async client => {
        const { error } = await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: appUrl() } });
        return error ? { error } : {};
    });
}

async function sendPasswordReset(email) {
    return accountAction(async client => {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
        return error ? { error } : {};
    });
}

async function updatePassword(password, nonce) {
    return accountAction(async client => {
        const { error } = await client.auth.updateUser({ password, nonce });
        if (error?.code == 'reauthentication_needed') {
            const reauthentication = await client.auth.reauthenticate();
            return reauthentication.error ? { error: reauthentication.error } : { needsNonce: true };
        }
        if (error)
            return { error };
        setAccount({ recovering: false });
        return {};
    });
}

async function updateEmail(email) {
    return accountAction(async client => {
        const { error } = await client.auth.updateUser({ email }, { emailRedirectTo: appUrl() });
        return error ? { error } : { needsConfirmation: true };
    });
}

async function saveOwnProfile(fields) {
    return accountAction(async client => {
        if (!account.user)
            return { error: 'authFailed' };
        const ownerId = account.user.id;
        const allowed = ['display_name', 'username', 'color', 'secondary_color', 'bio', 'country', 'is_public'];
        const values = Object.fromEntries(Object.entries(fields).filter(([key]) => allowed.includes(key)));
        const { data, error } = await client.from('profiles').update(values).eq('id', ownerId).select().single();
        if (error?.code == '23505')
            return { error: 'usernameTaken' };
        if (error?.code == '23514')
            return { error: 'profileInvalid' };
        if (error)
            return { error };
        if (account.user?.id == ownerId)
            setAccount({ profile: data });
        return {};
    });
}

async function signOutAccount() {
    return accountAction(async client => {
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error)
            return { error };
        setAccount({ status: 'signed-out', user: null, profile: null, recovering: false });
        return {};
    });
}

async function deleteAccount() {
    return accountAction(async client => {
        const { error } = await client.rpc('delete_account');
        return error ? { error } : signOutAccount();
    });
}
