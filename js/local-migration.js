/** Local backups, account migration and migration offers. */

// Older browsers still store the demo profile that used to be preloaded.
const legacyDemoData = {
    levels: new Set([
        'demo0', 'demo1', 'demo2', 'demo3', 'demo4', 'demo5', 'demo6', 'demo7', 'demo8',
        'demop1', 'demop2'
    ]),
    items: new Set(['i1', 'i2', 'i3']),
    tags: new Set(['Rebeated', 'Fluked', 'Pre-Extremes'])
};

function hasRealLocalData(p) {
    const data = p?.data, rows = value => Array.isArray(value) ? value : [];
    return rows(data?.levels).some(level => level && !legacyDemoData.levels.has(level.id))
        || rows(data?.wishlists).some(wishlist => rows(wishlist?.items).some(item => item && !legacyDemoData.items.has(item.id)))
        || rows(data?.tags).some(tag => tag && !legacyDemoData.tags.has(tag.name));
}

function migratedLocalProfiles() {
    try {
        const value = JSON.parse(localStorage.gmigrated || '{}');
        return value && typeof value == 'object' && !Array.isArray(value)
            ? Object.fromEntries(Object.entries(value).filter(([, ids]) => Array.isArray(ids)).map(([id, ids]) => [id, ids.filter(x => typeof x == 'string')])) : {};
    }
    catch {
        return {};
    }
}

function localProfilesToOffer(userId) {
    const recorded = migratedLocalProfiles()[userId] || [];
    return Object.keys(store.profs).filter(id => hasRealLocalData(store.profs[id]) && !recorded.includes(id));
}

const migrationText = (value, limit) => Array.from(String(value ?? '')).filter(c => {
    const code = c.codePointAt(0);
    return code >= 32 && (code < 127 || code > 159);
}).slice(0, limit).join('');
const migrationCut = (text, limit) => Array.from(text).slice(0, limit).join('');
const migrationTagName = value => migrationCut(migrationText(value, Infinity).trim(), 40).trim();
const migrationClamp = (value, min, max) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Math.trunc(Number(value)))) : null;

function cleanMigrationName(entry, set) {
    set(entry, 'name', migrationText(entry.name, 100) || t('name'));
    if (entry.creator != null)
        set(entry, 'creator', migrationText(entry.creator, 100));
    if (entry.levelId != null && !/^\d{1,12}$/.test(String(entry.levelId)))
        set(entry, 'levelId', null);
    if (entry.diff != null && !DIFFICULTIES.includes(entry.diff))
        set(entry, 'diff', null);
    if (entry.rating != null && !['unrated', ...RATING_TIERS].includes(entry.rating))
        set(entry, 'rating', null);
}

function cleanMigrationLevel(entry, set) {
    cleanMigrationName(entry, set);
    if (!['classic', 'platform'].includes(entry.kind))
        set(entry, 'kind', 'classic');
    if (entry.gdl != null && (entry.kind == 'platform' || !Number.isInteger(entry.gdl) || entry.gdl < 1 || entry.gdl > 100000))
        set(entry, 'gdl', null);
    if (entry.notes != null)
        set(entry, 'notes', migrationCut(String(entry.notes).replaceAll(String.fromCharCode(0), ''), NOTES_LIMIT));
    if (entry.link != null)
        set(entry, 'link', safeUrl(entry.link) ? migrationText(entry.link, 500) : '');
    cleanMigrationStats(entry, set);
    cleanMigrationDate(entry, set);
    cleanMigrationAredl(entry, set);
    if (entry.tags)
        set(entry, 'tags', [...new Set(entry.tags.map(migrationTagName).filter(Boolean))].slice(0, 50));
}

function cleanMigrationStats(entry, set) {
    for (const field of ['enj', 'lik', 'attN', 'attC', 'tN', 'tP', 'tPC']) {
        if (entry[field] != null)
            set(entry, field, ['enj', 'lik'].includes(field) ? (Number.isFinite(Number(entry[field])) ? Math.round(Math.max(0, Math.min(10, Number(entry[field]))) * 10) / 10 : null) : migrationClamp(entry[field], 0, 1000000000));
    }
    if (entry.deaths != null) {
        const deaths = cleanDeaths(entry.deaths);
        for (const percent of Object.keys(deaths))
            deaths[percent] = Math.min(deaths[percent], 10000000);
        set(entry, 'deaths', deaths);
    }
}

function cleanMigrationDate(entry, set) {
    if (entry.date) {
        const date = /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && Number.isFinite(Date.parse(entry.date)) && new Date(entry.date).toISOString().slice(0, 10) == entry.date;
        if (!date || entry.date.startsWith('0000'))
            set(entry, 'date', null);
    }
}

function cleanMigrationAredl(entry, set) {
    if (entry.ar != null && (typeof entry.ar != 'object' || Array.isArray(entry.ar)))
        set(entry, 'ar', null);
    if (entry.ar != null) {
        if (!['r', 'n', 'p', null, undefined].includes(entry.ar.s))
            set(entry.ar, 's', null);
        if (entry.ar.p != null && (!Number.isInteger(entry.ar.p) || entry.ar.p < 1 || entry.ar.p > 100000))
            set(entry.ar, 'p', null);
    }
}

function cleanMigrationItem(item, set) {
    if (item.kind != null && !['classic', 'platform'].includes(item.kind))
        set(item, 'kind', null);
    if (!['todo', 'prog', 'done'].includes(item.status))
        set(item, 'status', item.done ? 'done' : 'todo');
    if (item.pct != null)
        set(item, 'pct', migrationClamp(item.pct, 0, 100));
}

/** Counts fields changed on a copy; the original remains a downloadable backup. */
function cleanMigrationData(source, localId) {
    const data = JSON.parse(JSON.stringify(source));
    migrateRatingScale(data);
    retireFirstStepsTag(data);
    let adjusted = 0;
    const set = (entry, key, value) => {
        if (JSON.stringify(entry[key]) !== JSON.stringify(value)) {
            entry[key] = value;
            adjusted++;
        }
    };
    const ids = new Map();
    const identify = (entry, prefix, index, seen) => {
        const original = entry.id;
        if (typeof original != 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(original)) {
            // Stable replacement IDs keep hand-edited backups safe to retry even if the marker cannot be saved.
            let hash = 2166136261;
            for (const c of String(localId))
                hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
            let id = `m${(hash >>> 0).toString(36)}_${prefix}${index}`;
            while (seen.has(id))
                id += '_';
            set(entry, 'id', id);
        }
        seen.add(entry.id);
        return original;
    };
    const levelIds = new Set(data.levels.map(l => l.id).filter(id => typeof id == 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(id)));
    const usedLevels = new Set();
    data.levels.forEach((entry, index) => {
        const oldId = identify(entry, 'n', index, usedLevels);
        if (!ids.has(oldId))
            ids.set(oldId, entry.id);
        levelIds.add(entry.id);
        cleanMigrationLevel(entry, set);
    });
    for (const kind of ['classic', 'platform'])
        data.order[kind] = [...new Set(data.order[kind].map(id => ids.get(id)).filter(id => levelIds.has(id)))];
    const tags = new Map();
    for (const tag of data.tags || []) {
        set(tag, 'name', migrationTagName(tag.name));
        if (!tag.name || tags.has(tag.name)) {
            adjusted++;
            continue;
        }
        if (!isHexColor(tag.color))
            set(tag, 'color', PROFILE_COLORS[0]);
        tags.set(tag.name, tag);
    }
    for (const entry of data.levels) {
        for (const name of entry.tags || []) {
            if (!tags.has(name))
                tags.set(name, { name, color: PROFILE_COLORS[0] });
        }
    }
    data.tags = [...tags.values()];
    data.wishlists ||= [];
    const wishlistIds = new Set(), itemIds = new Set();
    data.wishlists.forEach((wishlist, index) => {
        identify(wishlist, 'w', index, wishlistIds);
        set(wishlist, 'name', migrationText(wishlist.name, 100) || t('wname'));
        wishlist.items.forEach((item, itemIndex) => {
            identify(item, `i${index}_`, itemIndex, itemIds);
            cleanMigrationName(item, set);
            cleanMigrationItem(item, set);
        });
    });
    return { data, adjusted };
}

async function bringLocalProfile(localId, useIdentity) {
    if (!cloudUser || !cloudSession?.pulled)
        return;
    const local = store.profs[localId], userId = cloudUser;
    let cleaned;
    try {
        const copy = JSON.parse(JSON.stringify(local?.data));
        if (!isValidProfileData(copy))
            throw Error('Invalid local profile');
        cleaned = cleanMigrationData(copy, localId);
    }
    catch {
        return showAlert(t('migrationUnreadable'));
    }
    const result = { levels: 0, wishlists: 0, tags: 0, existing: 0, adjusted: cleaned.adjusted }, data = cleaned.data;
    addMigratedLevels(data, result);
    addMigratedTags(data, result);
    addMigratedWishlists(data, result);
    save();
    rememberMigratedProfile(userId, localId);
    const identityError = useIdentity ? await saveMigratedIdentity(local) : undefined;
    if (cloudUser != userId)
        return result;
    closeModal();
    render();
    showToast(migrationSummary(result));
    if (identityError)
        showAlert(t(identityError));
    return result;
}

function addMigratedLevels(data, result) {
    const added = new Set();
    for (const entry of data.levels) {
        const duplicate = profile.levels.some(current => current.id == entry.id || (current.kind == entry.kind
            && (current.levelId && entry.levelId ? String(current.levelId) == String(entry.levelId) : normalizeName(current.name) == normalizeName(entry.name))));
        if (duplicate) {
            result.existing++;
            continue;
        }
        profile.levels.push(entry);
        added.add(entry.id);
        result.levels++;
    }
    for (const kind of ['classic', 'platform'])
        profile.order[kind].push(...data.order[kind].filter(id => added.has(id) && profile.levels.some(l => l.id == id && l.kind == kind) && !profile.order[kind].includes(id)));
}

function addMigratedTags(data, result) {
    for (const tag of data.tags) {
        if (profile.tags.some(current => current.name == tag.name))
            result.existing++;
        else {
            profile.tags.push(tag);
            result.tags++;
        }
    }
}

function addMigratedWishlists(data, result) {
    const itemIds = new Set(profile.wishlists.flatMap(w => w.items.map(item => item.id)));
    for (const wishlist of data.wishlists) {
        const existing = profile.wishlists.find(current => current.id == wishlist.id);
        const items = wishlist.items.filter(item => {
            if (itemIds.has(item.id)) {
                result.existing++;
                return false;
            }
            itemIds.add(item.id);
            return true;
        });
        if (existing) {
            existing.items.push(...items);
            if (items.length)
                result.wishlists++;
        }
        else {
            profile.wishlists.push({ ...wishlist, items });
            result.wishlists++;
        }
    }
}

function rememberMigratedProfile(userId, localId) {
    try {
        const recorded = migratedLocalProfiles();
        recorded[userId] = [...new Set([...(recorded[userId] || []), localId])];
        localStorage.gmigrated = JSON.stringify(recorded);
    }
    catch {
        // The queued rows retain their IDs if browser storage cannot keep the migration marker.
    }
}

async function saveMigratedIdentity(local) {
    const name = Array.from(migrationText(local.name, Infinity).trim()).slice(0, 40).join('') || account.profile?.display_name || t('name');
    const fields = {
        display_name: name,
        color: isHexColor(local.color) ? local.color : PROFILE_COLORS[0],
        secondary_color: isHexColor(local.secondaryColor) ? local.secondaryColor : DEFAULT_SECONDARY_COLOR
    };
    if (validCubeId(local.cubeId))
        fields.cube_id = local.cubeId;
    const identity = await saveOwnProfile(fields);
    return identity.error;
}

function migrationSummary(result) {
    return t('migrationAdded').replace('{levels}', localDataCount('Levels', result.levels)).replace('{wishlists}', localDataCount('Wishlists', result.wishlists)).replace('{tags}', localDataCount('Tags', result.tags))
        + (result.existing ? ' ' + t(result.existing == 1 ? 'migrationExistingOne' : 'migrationExisting').replace('{n}', result.existing) : '')
        + (result.adjusted ? ' ' + t(result.adjusted == 1 ? 'migrationAdjustedOne' : 'migrationAdjusted').replace('{n}', result.adjusted) : '');
}

const localDataCount = (kind, count) => t('local' + kind + (count == 1 ? 'One' : '')).replace('{n}', count);
