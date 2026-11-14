/** Device cache, versioned account saves and reconciliation with other devices. */

let cloudSync = { status: 'saved', pending: 0, error: '' };
let cloudSession = null;
const CLOUD_KEYS = {
    levels: ['id'], level_notes: ['level_id'], level_tags: ['level_id', 'tag_name'],
    list_orders: ['kind'], wishlists: ['id'], wishlist_items: ['id'], tags: ['name'], user_settings: []
};

const currentSettings = () => ({ lang: ui.lang, theme: ui.theme });
const cloudRowKey = (table, row) => Object.fromEntries(CLOUD_KEYS[table].map(column => [column, row[column]]));
const cloudMapKey = (table, row) => table + ':' + (table == 'user_settings' ? 'me' : CLOUD_KEYS[table].map(column => row[column]).join('/'));
const cleanCloudRow = row => row == null ? null : Object.fromEntries(Object.entries(row).filter(([column]) => !['user_id', 'version', 'created_at', 'updated_at'].includes(column)));
const cloudFormOpen = () => !!qs('form, dialog[open], .ms[open]');

function readCloudCache(userId) {
    try {
        const cached = JSON.parse(localStorage['gcloud:' + userId] || 'null');
        return cached && isValidProfileData(cached.profile) ? cached : null;
    }
    catch {
        return null;
    }
}

function clearCloudCaches(keepUser = null) {
    try {
        for (const key of Object.keys(localStorage)) {
            if (key.startsWith('gcloud:') && (keepUser == null || key != 'gcloud:' + keepUser))
                localStorage.removeItem(key);
        }
    }
    catch {
    }
}

function writeCloudCache() {
    if (!cloudSession)
        return;
    try {
        localStorage['gcloud:' + cloudUser] = JSON.stringify({
            profile, settings: currentSettings(), accountProfile: account.profile || cloudSession.accountProfile,
            snapshot: Object.fromEntries(cloudSession.snapshot), revision: cloudSession.revision,
            rejected: Object.fromEntries(cloudSession.rejected)
        });
    }
    catch {
        setCloudStatus('error', t('cloudStorage'));
    }
}

function applyCloudSettings(settings) {
    if (!settings)
        return;
    for (const [field, key] of [['lang', 'gl'], ['theme', 'gt']]) {
        if (settings[field] == null)
            continue;
        ui[field] = settings[field];
        try {
            localStorage[key] = settings[field];
        }
        catch {
        }
    }
}

function setCloudStatus(status, error = '') {
    cloudSync.status = status;
    cloudSync.error = error;
    renderCloudStatus();
}

function cloudStatusSentence() {
    if (cloudSync.status == 'offline')
        return t(cloudSync.pending == 1 ? 'cloudOfflineOne' : 'cloudOffline').replace('{n}', cloudSync.pending);
    if (cloudSync.status == 'error')
        return t('cloudError').replace('{reason}', () => cloudSync.error);
    return t(cloudSync.status == 'saving' ? 'cloudSaving' : 'cloudSaved');
}

function cloudStatus() {
    const icon = cloudSync.status == 'saved' ? ICONS.check : cloudSync.status == 'saving' ? ICONS.sync : ICONS.warning;
    return `<span id=cloudst class="cloudst ${cloudSync.status}" role=status aria-atomic=true>${icon}<span class=cloudtxt>${escapeHtml(cloudStatusSentence())}</span>${cloudRetryButton(true)}</span>`;
}

function cloudRetryButton(header = false) {
    const label = header ? cloudStatusSentence() + ' · ' + t('cloudRetry') : t('cloudRetry');
    return ['offline', 'error'].includes(cloudSync.status)
        ? `<button data-act=csync class="xs-txt cloudretry" aria-label="${escapeHtml(label)}">${ICONS.retry}${header ? `<span class=cloudwarn>${ICONS.warning}</span>` : ''}<span class=retrytxt>${t('cloudRetry')}</span></button>` : '';
}

function renderCloudStatus() {
    const chip = qs('#cloudst');
    if (chip)
        chip.outerHTML = cloudStatus();
    const accountCard = qs('[data-cloud-status]');
    if (accountCard)
        accountCard.textContent = cloudStatusSentence();
    const retry = qs('[data-cloud-retry]');
    if (retry)
        retry.innerHTML = cloudRetryButton();
}

/** The diff is the durable queue; rejected rows remain pending but do not loop. */
function pendingCloudChanges(includeRejected = false) {
    if (!cloudSession)
        return [];
    const changes = rowChanges(profileRows(profile, currentSettings()), cloudSession.snapshot);
    cloudSync.pending = changes.length;
    return includeRejected ? changes : changes.filter(change => cloudSession.rejected.get(change.key) !== canonicalJson(change.row));
}

function settleCloudStatus() {
    const pending = pendingCloudChanges(true), refused = pending.some(change => cloudSession.rejected.get(change.key) === canonicalJson(change.row));
    setCloudStatus(refused ? 'error' : pending.length ? 'saving' : 'saved', refused ? cloudSession.rejectionError : '');
}

/** Cached data is usable before auth finishes, but cannot reach the server yet. */
function restoreCloudSync() {
    if (!canEdit())
        return;
    const user = readStoredCloudUser();
    if (!user)
        return;
    const cached = readCloudCache(user.id);
    if (!cached?.accountProfile)
        return;
    useCloudCache(user, cached.accountProfile, cached);
    account.user = user;
    account.profile = cached.accountProfile;
    account.status = 'signed-in';
}

function useCloudCache(user, accountProfile, cached) {
    clearCloudCaches(user.id);
    cloudUser = user.id;
    cloudSession = {
        snapshot: new Map(Object.entries(cached?.snapshot || {})), rejected: new Map(Object.entries(cached?.rejected || {})),
        revision: cached?.revision ?? null, accountProfile, retry: 0, retryAt: 0, limitedUntil: 0,
        started: false, pulled: false, timer: null, poll: null, pushing: null, pulling: null, checking: null, rejectionError: t('cloudInvalid')
    };
    cloudSync = { status: navigator.onLine === false ? 'offline' : 'saving', pending: 0, error: '' };
    profile = cached?.profile || emptyProfile();
    ensureProfileDefaults();
    applyCloudSettings(cached?.settings);
    pendingCloudChanges();
}

/** Timers belong to a confirmed session so late responses cannot revive a signed-out cache. */
async function startCloudSync(user, accountProfile) {
    if (!canEdit())
        return;
    if (cloudUser && cloudUser != user.id)
        stopCloudSync(true);
    if (!cloudSession) {
        useCloudCache(user, accountProfile, readCloudCache(user.id));
        render();
    }
    cloudSession.accountProfile = accountProfile;
    if (cloudSession.started)
        return;
    cloudSession.started = true;
    window.addEventListener('online', cloudOnline);
    document.addEventListener('visibilitychange', cloudVisibilityChanged);
    scheduleCloudPoll();
    await pullCloud();
}

function stopCloudSync(clearCache) {
    if (!canEdit())
        return;
    if (clearCache)
        clearCloudCaches();
    if (!cloudSession)
        return;
    clearTimeout(cloudSession.timer);
    clearTimeout(cloudSession.poll);
    window.removeEventListener('online', cloudOnline);
    document.removeEventListener('visibilitychange', cloudVisibilityChanged);
    cloudSession = null;
    cloudUser = null;
    profile = store.profs[store.cur].data;
    ui.sel = null;
    ui.wl = null;
    cloudSync = { status: 'saved', pending: 0, error: '' };
    render();
}

function saveCloud() {
    pendingCloudChanges();
    setCloudStatus(cloudSync.status == 'offline' ? 'offline' : 'saving');
    writeCloudCache();
    if (!cloudSession.started)
        return;
    clearTimeout(cloudSession.timer);
    cloudSession.timer = setTimeout(pushCloud, Math.max(1000, cloudSession.retryAt - Date.now()));
}

function scheduleCloudPoll() {
    const session = cloudSession;
    if (!session)
        return;
    session.poll = setTimeout(async () => {
        if (document.visibilityState == 'visible')
            await checkCloudRevision();
        if (session === cloudSession)
            scheduleCloudPoll();
    }, 60000);
}

function cloudVisibilityChanged() {
    if (document.visibilityState == 'visible')
        return checkCloudRevision();
}

async function cloudOnline() {
    await checkCloudRevision();
    return pushCloud();
}

async function retryCloudSync() {
    const session = cloudSession;
    if (!session)
        return;
    if (session.started)
        return pullCloud();
    clearTimeout(session.timer);
    try {
        const client = await loadCloud();
        if (session !== cloudSession)
            return;
        const { data, error } = await client.auth.refreshSession();
        if (session !== cloudSession)
            return;
        if (error)
            throw error;
        if (data?.session)
            await applyAccountSession('TOKEN_REFRESHED', data.session);
    }
    catch (error) {
        if (session === cloudSession)
            cloudFailed(error, session);
    }
}

/** Failed pulls retry too: reconnecting must refresh remote data before sending. */
function cloudFailed(error, session) {
    const offline = authErrorKey(error) == 'authOffline';
    const limited = error?.status == 429 || error?.code == 'PT429';
    setCloudStatus(offline ? 'offline' : 'error', t(limited ? 'cloudWait' : 'cloudFailed'));
    clearTimeout(session.timer);
    session.timer = null;
    if (offline || limited) {
        const delay = limited ? 60000 : [5000, 15000, 60000, 300000][Math.min(session.retry++, 3)];
        session.retryAt = Date.now() + delay;
        if (limited)
            session.limitedUntil = session.retryAt;
        session.timer = setTimeout(retryCloudSync, delay);
    }
    else {
        session.retryAt = session.limitedUntil;
        console.error(error);
    }
    writeCloudCache();
}

function cloudRowName(table, row, rows) {
    return row?.name || (row?.level_id && rows.get('levels:' + row.level_id)?.row.name)
        || row?.tag_name || t(table == 'user_settings' ? 'accountSettings' : table == 'list_orders' ? row?.kind || 'lists' : 'lists');
}

function notifyCloudChanges(names) {
    const unique = [...new Set(names)];
    if (unique.length)
        showToast(t('cloudChanged').replace('{names}', () => unique.slice(0, 3).join(', ')
            + (unique.length > 3 ? t('cloudMore').replace('{n}', unique.length - 3) : '')));
}

/** Only snapshot metadata is sent back into the converter; it never enters diffs. */
function rebuildCloudProfile(rows) {
    const ordered = new Map([...rows].map(([key, entry]) => [key, {
        table: entry.table, row: { ...entry.row, created_at: cloudSession.snapshot.get(key)?.createdAt }
    }]));
    const rebuilt = rowsProfile(ordered);
    profile = rebuilt.profile;
    ensureProfileDefaults();
    if (!profile.levels.some(entry => entry.id == ui.sel))
        ui.sel = null;
    if (!profile.wishlists.some(entry => entry.id == ui.wl))
        ui.wl = null;
    applyCloudSettings(rebuilt.settings);
}

function rememberCloudRow(session, key, row) {
    if (row == null)
        session.snapshot.delete(key);
    else
        session.snapshot.set(key, { version: row.version, row: cleanCloudRow(row), createdAt: row.created_at });
}

/** A deleted row wins against a stale edit; a stale deletion restores the server row. */
function mergeCloudRow(key, table, remote, rows, names, alwaysNotify = false) {
    const base = cloudSession.snapshot.get(key)?.row || null, mine = rows.get(key)?.row || null;
    const theirs = cleanCloudRow(remote), changedHere = canonicalJson(mine) !== canonicalJson(base);
    if (theirs == null) {
        rows.delete(key);
        if (changedHere || alwaysNotify)
            names.push(cloudRowName(table, mine || base, rows));
    }
    else if (mine == null && base != null) {
        rows.set(key, { table, row: theirs });
        names.push(cloudRowName(table, theirs, rows));
    }
    else {
        const merged = changedHere ? mergeRow(base, mine, theirs) : { row: theirs, conflicts: [] };
        rows.set(key, { table, row: merged.row });
        if (merged.conflicts.length || alwaysNotify)
            names.push(cloudRowName(table, theirs, rows));
    }
    rememberCloudRow(cloudSession, key, remote);
    cloudSession.rejected.delete(key);
}

function pushCloud() {
    const session = cloudSession;
    if (!session?.started)
        return Promise.resolve();
    if (session.pulling)
        return session.pulling.then(pushCloud);
    if (session.pushing)
        return session.pushing;
    if (Date.now() < session.retryAt)
        return Promise.resolve();
    clearTimeout(session.timer);
    session.pushing = Promise.resolve().then(async () => {
        let remoteChanged = false;
        try {
            const client = await loadCloud();
            while (session === cloudSession) {
                const batch = JSON.parse(JSON.stringify(pendingCloudChanges().slice(0, 500)));
                if (!batch.length)
                    break;
                if (cloudSync.status != 'offline')
                    setCloudStatus('saving');
                const changes = batch.map(change => ({ table: change.table,
                    key: cloudRowKey(change.table, change.row || session.snapshot.get(change.key).row), version: change.version, row: change.row }));
                const submitted = new Map(batch.map((change, index) => [cloudMapKey(change.table, changes[index].key), change]));
                const previousRevision = session.revision;
                const { data, error } = await client.rpc('sync_push', { changes });
                if (session !== cloudSession)
                    return;
                if (error)
                    throw error;
                remoteChanged ||= data.previous_revision !== previousRevision;
                for (const applied of data.applied) {
                    const key = cloudMapKey(applied.table, applied.key), sent = submitted.get(key);
                    if (sent.row == null)
                        session.snapshot.delete(key);
                    else
                        session.snapshot.set(key, { version: applied.version, row: sent.row, createdAt: session.snapshot.get(key)?.createdAt ?? null });
                    session.rejected.delete(key);
                }
                for (const refused of data.rejected) {
                    const key = cloudMapKey(refused.table, refused.key);
                    session.rejected.set(key, canonicalJson(submitted.get(key).row));
                    session.rejectionError = t(/limit|cap|budget/i.test(refused.message) ? 'cloudLimit' : /23503/.test(refused.code) ? 'cloudReference' : 'cloudInvalid');
                }
                if (data.conflicts.length) {
                    const rows = profileRows(profile, currentSettings()), names = [];
                    for (const conflict of data.conflicts)
                        mergeCloudRow(cloudMapKey(conflict.table, conflict.key), conflict.table, conflict.row, rows, names, true);
                    rebuildCloudProfile(rows);
                    if (!cloudFormOpen())
                        render();
                    notifyCloudChanges(names);
                }
                session.revision = data.revision;
                session.retry = 0;
                session.retryAt = 0;
                session.limitedUntil = 0;
                writeCloudCache();
            }
            if (session === cloudSession)
                settleCloudStatus();
            return remoteChanged;
        }
        catch (error) {
            if (session === cloudSession)
                cloudFailed(error, session);
        }
    }).then(remoteChanged => {
        session.pushing = null;
        return remoteChanged && session === cloudSession ? pullCloud() : undefined;
    });
    return session.pushing;
}

function pullCloud() {
    const session = cloudSession;
    if (!session?.started)
        return Promise.resolve();
    if (session.pushing)
        return session.pushing.then(pullCloud);
    if (session.pulling)
        return session.pulling;
    session.pulling = Promise.resolve().then(async () => {
        const hadRevision = session.revision != null;
        try {
            const client = await loadCloud(), { data, error } = await client.rpc('sync_pull');
            if (session !== cloudSession)
                return false;
            if (error)
                throw error;
            const rows = profileRows(profile, currentSettings()), remote = new Map(), names = [];
            for (const table of Object.keys(CLOUD_KEYS)) {
                for (const row of data[table])
                    remote.set(cloudMapKey(table, row), { table, row });
            }
            for (const [key, { table, row }] of remote) {
                if (session.snapshot.get(key)?.version !== row.version)
                    mergeCloudRow(key, table, row, rows, names);
                else
                    rememberCloudRow(session, key, row);
            }
            for (const [key] of session.snapshot) {
                if (!remote.has(key))
                    mergeCloudRow(key, key.slice(0, key.indexOf(':')), null, rows, names);
            }
            rebuildCloudProfile(rows);
            session.revision = data.revision;
            session.accountProfile = data.profile;
            session.pulled = true;
            if (data.profile)
                account.profile = data.profile;
            session.retryAt = session.limitedUntil;
            pendingCloudChanges();
            if (!cloudSync.pending)
                session.retry = 0;
            writeCloudCache();
            if (!cloudFormOpen())
                render();
            if (hadRevision)
                notifyCloudChanges(names);
            maybeOfferMigration();
            return true;
        }
        catch (error) {
            if (session === cloudSession)
                cloudFailed(error, session);
            return false;
        }
    }).then(success => {
        session.pulling = null;
        return success && session === cloudSession ? pushCloud() : undefined;
    });
    return session.pulling;
}

function checkCloudRevision() {
    const session = cloudSession;
    if (!session?.started)
        return Promise.resolve();
    if (session.checking)
        return session.checking;
    session.checking = Promise.resolve().then(async () => {
        try {
            const client = await loadCloud(), { data, error } = await client.rpc('sync_revision');
            if (session !== cloudSession)
                return;
            if (error)
                throw error;
            if (data !== session.revision || cloudSync.status == 'offline')
                await pullCloud();
        }
        catch (error) {
            if (session === cloudSession)
                cloudFailed(error, session);
        }
    }).finally(() => { session.checking = null; });
    return session.checking;
}

function reloadCloudCache() {
    if (!cloudSession || cloudFormOpen())
        return;
    const cached = readCloudCache(cloudUser);
    if (!cached)
        return;
    profile = cached.profile;
    cloudSession.snapshot = new Map(Object.entries(cached.snapshot || {}));
    cloudSession.rejected = new Map(Object.entries(cached.rejected || {}));
    cloudSession.revision = cached.revision;
    if (cached.accountProfile)
        account.profile = cached.accountProfile;
    ensureProfileDefaults();
    applyCloudSettings(cached.settings);
    settleCloudStatus();
    render();
    if (cloudSync.pending)
        saveCloud();
}
