/** Schedules external ranking downloads and applies their results to the active profile. */

const rankingProviders = ['aredl', 'gdl'];
const rankingSync = {
    running: false,
    due: [],
    aredl: { status: null, failed: null, retryAt: 0 },
    gdl: { status: null, retryAt: 0 }
};
let rankingPromise = null;
let rankingSyncStarted = false;

const rankingOwner = () => cloudUser ? 'cloud:' + cloudUser : 'local:' + store.cur;
const rankingProfileReady = () => canEdit() && !(cloudSession && cloudSession.revision == null);

function readRankingTimes() {
    try {
        const times = JSON.parse(localStorage.granks || 'null');
        return times && typeof times == 'object' && !Array.isArray(times) ? times : {};
    }
    catch {
        return {};
    }
}

function rankingTimestamp(times, owner, provider) {
    const value = times[owner]?.[provider];
    return Number.isFinite(value) && !Number.isNaN(new Date(value).getTime()) ? value : null;
}

function recordRankingResults(due, owner) {
    const now = Date.now(), successful = [];
    for (const provider of due) {
        const result = rankingSync[provider];
        if (result.status == 'ok')
            successful.push(provider);
        result.retryAt = result.status == 'ok' ? 0 : now + RANKING_RETRY_DELAY;
    }
    if (owner == null || !successful.length)
        return;
    try {
        const times = readRankingTimes();
        const updated = {};
        for (const provider of rankingProviders) {
            const value = successful.includes(provider) ? now : rankingTimestamp(times, owner, provider);
            if (value != null)
                updated[provider] = value;
        }
        times[owner] = updated;
        localStorage.granks = JSON.stringify(times);
    }
    catch {
    }
}

function rankingMetadataDrafts(target, refreshed) {
    const draft = (item, kind) => {
        const before = { ...item }, data = { ...item };
        if (refreshed[kind])
            fillAredlMetadata(data);
        return { item, before, data, kind };
    };
    return [
        ...target.levels.map(level => draft(level, aredlKind(level))),
        ...target.wishlists.flatMap(w => w.items.map(item => draft(item)))
    ];
}

async function enrichRankingMetadata(refreshed) {
    let target = profile, drafts = [];
    try {
        drafts = rankingMetadataDrafts(target, refreshed);
        if (drafts.some(({ data }) => needsSheetFields(data))) {
            await loadSheetLevels();
            if (!rankingProfileReady())
                return null;
            if (profile !== target) {
                target = profile;
                drafts = rankingMetadataDrafts(target, refreshed);
            }
            drafts.forEach(({ data, kind }) => fillFromSheet(data, kind));
        }
        await fillRatings(drafts.map(({ data }) => data));
    }
    catch {
    }
    return { target, drafts };
}

function applyRankingMetadata(metadata) {
    if (metadata?.target !== profile)
        return;
    // A cloud pull can replace the profile, and an edit can change a level while its ratings load.
    for (const { item, before, data } of metadata.drafts) {
        if (item.name !== before.name || item.levelId !== before.levelId || item.kind !== before.kind)
            continue;
        for (const field of sheetFillFields) {
            if (data[field] !== before[field] && item[field] === before[field])
                item[field] = data[field];
        }
    }
}

const rankingSnapshot = () => JSON.stringify([profile.levels, profile.wishlists]);

async function runRankingSync(due) {
    const [aredl, gdl] = await Promise.allSettled([
        due.includes('aredl') ? loadAredlList(true) : null,
        due.includes('gdl') ? loadDemonlist(true) : null
    ]);
    const refreshed = aredl.value, aredlChanged = refreshed && (refreshed.d || refreshed.p);
    const gdlSucceeded = due.includes('gdl') && gdl.status == 'fulfilled';
    if (due.includes('aredl')) {
        rankingSync.aredl.status = aredlChanged ? (refreshed.d && refreshed.p ? 'ok' : 'partial') : 'error';
        rankingSync.aredl.failed = rankingSync.aredl.status == 'partial' ? (refreshed.d ? 'AREPL' : 'AREDL') : null;
    }
    if (due.includes('gdl'))
        rankingSync.gdl.status = gdlSucceeded ? 'ok' : 'error';

    const metadata = aredlChanged && rankingProfileReady() ? await enrichRankingMetadata(refreshed) : null;
    if (!rankingProfileReady()) {
        recordRankingResults(due, null);
        return;
    }
    const before = rankingSnapshot();
    applyRankingMetadata(metadata);
    if (aredlChanged)
        matchWithAredl(profile.levels, refreshed);
    if (gdlSucceeded)
        matchWithDemonlist(profile.levels);
    recordRankingResults(due, rankingOwner());
    if (rankingSnapshot() !== before)
        save();
}

function syncRankings({ force = false } = {}) {
    if (rankingPromise)
        return rankingPromise;
    if (!rankingProfileReady() || (!force && navigator.onLine === false))
        return Promise.resolve();
    const owner = rankingOwner(), times = readRankingTimes(), now = Date.now();
    const due = rankingProviders.filter(provider => {
        const last = rankingTimestamp(times, owner, provider);
        return force || (now >= rankingSync[provider].retryAt && (last == null || now - last > RANKING_MAX_AGE));
    });
    if (!due.length)
        return Promise.resolve();

    rankingSync.running = true;
    rankingSync.due = due;
    rankingPromise = Promise.resolve().then(() => runRankingSync(due)).finally(() => {
        rankingPromise = null;
        rankingSync.running = false;
        rankingSync.due = [];
        if (canEdit() && !qs('form, dialog[open], .ms[open], .sortable-chosen'))
            render();
        renderRankingStatus();
        if (rankingProfileReady() && rankingOwner() !== owner)
            autoSyncRankings();
    });
    renderRankingStatus();
    return rankingPromise;
}

function autoSyncRankings() {
    return syncRankings();
}

function startRankingSync() {
    if (rankingSyncStarted)
        return;
    rankingSyncStarted = true;
    autoSyncRankings();
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState == 'visible')
            autoSyncRankings();
    });
    window.addEventListener('online', autoSyncRankings);
    setInterval(autoSyncRankings, RANKING_CHECK_INTERVAL);
}
