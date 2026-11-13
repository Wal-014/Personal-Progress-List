/** Local backups, account migration and migration offers. */

// Startup reuses the demo object for the first profile, so remember its IDs before that profile can be edited.
const localDemoData = (() => {
    const demo = typeof window == 'object' ? window.DEMO_PROFILE : null;
    const rows = value => Array.isArray(value) ? value : [];
    return {
        levels: new Set(rows(demo?.levels).map(level => level?.id)),
        items: new Set(rows(demo?.wishlists).flatMap(wishlist => rows(wishlist?.items).map(item => item?.id))),
        tags: new Set(rows(demo?.tags).map(tag => tag?.name))
    };
})();

function hasRealLocalData(p) {
    const data = p?.data, rows = value => Array.isArray(value) ? value : [];
    return rows(data?.levels).some(level => level && !localDemoData.levels.has(level.id))
        || rows(data?.wishlists).some(wishlist => rows(wishlist?.items).some(item => item && !localDemoData.items.has(item.id)))
        || rows(data?.tags).some(tag => tag && !localDemoData.tags.has(tag.name));
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

/** Counts fields changed on a copy; the original remains a downloadable backup. */
function cleanMigrationData(source, localId) {
    const data = JSON.parse(JSON.stringify(source));
    let adjusted = 0;
    const set = (entry, key, value) => {
        if (JSON.stringify(entry[key]) !== JSON.stringify(value)) {
            entry[key] = value;
            adjusted++;
        }
    };
    const cut = (text, limit) => Array.from(text).slice(0, limit).join('');
    const text = migrationText;
    const tagName = value => cut(text(value, Infinity).trim(), 40).trim();
    const clamp = (value, min, max) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Math.trunc(Number(value)))) : null;
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
    const named = entry => {
        set(entry, 'name', text(entry.name, 100) || t('name'));
        if (entry.creator != null)
            set(entry, 'creator', text(entry.creator, 100));
        if (entry.levelId != null && !/^\d{1,12}$/.test(String(entry.levelId)))
            set(entry, 'levelId', null);
        if (entry.diff != null && !['Auto', 'Easy', 'Normal', 'Hard', 'Harder', 'Insane', 'Easy Demon', 'Medium Demon', 'Hard Demon', 'Insane Demon', 'Extreme Demon'].includes(entry.diff))
            set(entry, 'diff', null);
        if (entry.rating != null && !['unrated', ...RATING_TIERS].includes(entry.rating))
            set(entry, 'rating', null);
    };
    const levelIds = new Set(data.levels.map(l => l.id).filter(id => typeof id == 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(id)));
    const usedLevels = new Set();
    data.levels.forEach((entry, index) => {
        const oldId = identify(entry, 'n', index, usedLevels);
        if (!ids.has(oldId))
            ids.set(oldId, entry.id);
        levelIds.add(entry.id);
        named(entry);
        if (!['classic', 'platform'].includes(entry.kind))
            set(entry, 'kind', 'classic');
        if (entry.notes != null)
            set(entry, 'notes', cut(String(entry.notes).replaceAll(String.fromCharCode(0), ''), 5000));
        if (entry.link != null)
            set(entry, 'link', safeUrl(entry.link) ? text(entry.link, 500) : '');
        for (const field of ['enj', 'lik', 'attN', 'attC', 'tN', 'tP', 'tPC']) {
            if (entry[field] != null)
                set(entry, field, clamp(entry[field], ['enj', 'lik'].includes(field) ? -10 : 0, ['enj', 'lik'].includes(field) ? 10 : 1000000000));
        }
        if (entry.deaths != null) {
            const deaths = cleanDeaths(entry.deaths);
            for (const percent of Object.keys(deaths))
                deaths[percent] = Math.min(deaths[percent], 10000000);
            set(entry, 'deaths', deaths);
        }
        if (entry.date) {
            const date = /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && Number.isFinite(Date.parse(entry.date)) && new Date(entry.date).toISOString().slice(0, 10) == entry.date;
            if (!date || entry.date.startsWith('0000'))
                set(entry, 'date', null);
        }
        if (entry.ar != null && (typeof entry.ar != 'object' || Array.isArray(entry.ar)))
            set(entry, 'ar', null);
        if (entry.ar != null) {
            if (!['r', 'n', 'p', null, undefined].includes(entry.ar.s))
                set(entry.ar, 's', null);
            if (entry.ar.p != null && (!Number.isInteger(entry.ar.p) || entry.ar.p < 1 || entry.ar.p > 100000))
                set(entry.ar, 'p', null);
        }
        if (entry.tags)
            set(entry, 'tags', [...new Set(entry.tags.map(tagName).filter(Boolean))].slice(0, 50));
    });
    for (const kind of ['classic', 'platform'])
        data.order[kind] = [...new Set(data.order[kind].map(id => ids.get(id)).filter(id => levelIds.has(id)))];
    const tags = new Map();
    for (const tag of data.tags || []) {
        set(tag, 'name', tagName(tag.name));
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
        set(wishlist, 'name', text(wishlist.name, 100) || t('wname'));
        wishlist.items.forEach((item, itemIndex) => {
            identify(item, `i${index}_`, itemIndex, itemIds);
            named(item);
            if (item.kind != null && !['classic', 'platform'].includes(item.kind))
                set(item, 'kind', null);
            if (!['todo', 'prog', 'done'].includes(item.status))
                set(item, 'status', item.done ? 'done' : 'todo');
            if (item.pct != null)
                set(item, 'pct', clamp(item.pct, 0, 100));
        });
    });
    return { data, adjusted };
}

const migrationText = (value, limit) => Array.from(String(value ?? '')).filter(c => {
    const code = c.codePointAt(0);
    return code >= 32 && (code < 127 || code > 159);
}).slice(0, limit).join('');

async function bringLocalProfile(localId, useIdentity) {
    if (!cloudBeta() || !cloudUser || !cloudSession?.pulled)
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
    for (const tag of data.tags) {
        if (profile.tags.some(current => current.name == tag.name))
            result.existing++;
        else {
            profile.tags.push(tag);
            result.tags++;
        }
    }
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
    save();
    try {
        const recorded = migratedLocalProfiles();
        recorded[userId] = [...new Set([...(recorded[userId] || []), localId])];
        localStorage.gmigrated = JSON.stringify(recorded);
    }
    catch {
        // The queued rows retain their IDs if browser storage cannot keep the migration marker.
    }
    let identityError;
    if (useIdentity) {
        const name = Array.from(migrationText(local.name, Infinity).trim()).slice(0, 40).join('') || account.profile?.display_name || t('name');
        const identity = await saveOwnProfile({ display_name: name,
            color: isHexColor(local.color) ? local.color : PROFILE_COLORS[0],
            secondary_color: isHexColor(local.secondaryColor) ? local.secondaryColor : DEFAULT_SECONDARY_COLOR });
        identityError = identity.error;
    }
    if (cloudUser != userId)
        return result;
    closeModal();
    render();
    const message = t('migrationAdded').replace('{levels}', localDataCount('Levels', result.levels)).replace('{wishlists}', localDataCount('Wishlists', result.wishlists)).replace('{tags}', localDataCount('Tags', result.tags))
        + (result.existing ? ' ' + t(result.existing == 1 ? 'migrationExistingOne' : 'migrationExisting').replace('{n}', result.existing) : '')
        + (result.adjusted ? ' ' + t(result.adjusted == 1 ? 'migrationAdjustedOne' : 'migrationAdjusted').replace('{n}', result.adjusted) : '');
    showToast(message);
    if (identityError)
        showAlert(t(identityError));
    return result;
}

const migrationDeferred = new Set();

function maybeOfferMigration() {
    if (!canEdit() || !cloudUser || !cloudBeta() || !cloudSession?.pulled || account.recovering || migrationDeferred.has(cloudUser)
        || cloudFormOpen() || !localProfilesToOffer(cloudUser).length)
        return;
    migrationDeferred.add(cloudUser);
    openModal(migrationDialog());
}

function deferMigration() {
    closeModal();
}

const localDataCount = (kind, count) => t('local' + kind + (count == 1 ? 'One' : '')).replace('{n}', count);
