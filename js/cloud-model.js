/**
 * Pure profile and row conversions, snapshot differences and field merges for cloud sync.
 */

const CLOUD_LEVEL_FIELDS = {
    id: 'id', name: 'name', kind: 'kind', levelId: 'level_id', creator: 'creator',
    diff: 'difficulty', rating: 'rating', attN: 'attempts_normal', attC: 'attempts_copy',
    tN: 'time_normal', tP: 'time_practice', tPC: 'time_practice_copy', date: 'completed_on',
    link: 'video_url', enj: 'enjoyment', lik: 'liking'
};

function profileRows(data, settings) {
    const rows = new Map(), nullable = value => value === '' || value == null ? null : value;
    const add = (table, id, row) => rows.set(`${table}:${id}`, { table, row });
    for (const entry of data.levels) {
        add('levels', entry.id, {
            ...Object.fromEntries(Object.entries(CLOUD_LEVEL_FIELDS).map(([field, column]) => [column, nullable(entry[field])])),
            aredl_status: nullable(entry.ar?.s), aredl_position: nullable(entry.ar?.p),
            tags: entry.tags || [], deaths: entry.deaths || {}
        });
        if (entry.notes?.trim())
            add('level_notes', entry.id, { level_id: entry.id, notes: entry.notes });
    }
    for (const kind of ['classic', 'platform'])
        add('list_orders', kind, { kind, level_ids: data.order[kind] || [] });
    data.wishlists.forEach((wishlist, position) => {
        add('wishlists', wishlist.id, { id: wishlist.id, name: wishlist.name, position, item_ids: wishlist.items.map(entry => entry.id) });
        for (const entry of wishlist.items) {
            add('wishlist_items', entry.id, {
                id: entry.id, wishlist_id: wishlist.id, name: entry.name, level_id: nullable(entry.levelId),
                creator: nullable(entry.creator), difficulty: nullable(entry.diff), rating: nullable(entry.rating),
                kind: nullable(entry.kind), status: entry.status, progress: entry.pct ?? null, enrich_checked: !!entry.chk
            });
        }
    });
    data.tags.forEach((tag, position) => add('tags', tag.name, { name: tag.name, color: tag.color, position }));
    if (settings != null)
        add('user_settings', 'me', { lang: settings.lang, theme: settings.theme });
    return rows;
}

function rowsProfile(rows) {
    const tables = new Map();
    for (const { table, row } of rows.values?.() || rows) {
        if (!tables.has(table))
            tables.set(table, []);
        tables.get(table).push(row);
    }
    const get = table => tables.get(table) || [], compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
    const notes = new Map(get('level_notes').map(row => [row.level_id, row.notes]));
    const data = emptyProfile();
    data.levels = get('levels').sort((a, b) =>
        (a.created_at ? Date.parse(a.created_at) : 0) - (b.created_at ? Date.parse(b.created_at) : 0) || compare(a.id, b.id)
    ).map(row => ({
        ...Object.fromEntries(Object.entries(CLOUD_LEVEL_FIELDS).map(([field, column]) => [field, row[column] ?? null])),
        ar: { s: row.aredl_status ?? null, p: row.aredl_position ?? null },
        notes: notes.get(row.id) ?? '', tags: row.tags ?? [], deaths: row.deaths ?? {}
    }));
    for (const row of get('list_orders')) {
        if (row.kind == 'classic' || row.kind == 'platform')
            data.order[row.kind] = row.level_ids ?? [];
    }
    const items = new Map();
    for (const row of get('wishlist_items')) {
        if (!items.has(row.wishlist_id))
            items.set(row.wishlist_id, []);
        items.get(row.wishlist_id).push(row);
    }
    data.wishlists = get('wishlists').sort((a, b) => a.position - b.position || compare(a.id, b.id)).map(row => {
        const positions = new Map((row.item_ids || []).map((id, position) => [id, position]));
        return {
            id: row.id, name: row.name,
            items: (items.get(row.id) || []).sort((a, b) =>
                (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity) || compare(a.id, b.id)
            ).map(entry => ({
                id: entry.id, name: entry.name, levelId: entry.level_id ?? null, creator: entry.creator ?? null,
                diff: entry.difficulty ?? null, rating: entry.rating ?? null, status: entry.status,
                ...(entry.kind == null ? {} : { kind: entry.kind }),
                ...(entry.progress == null ? {} : { pct: entry.progress }), chk: entry.enrich_checked ? 1 : 0
            }))
        };
    });
    data.tags = get('tags').sort((a, b) => a.position - b.position || compare(a.name, b.name))
        .map(row => ({ name: row.name, color: row.color }));
    const settings = get('user_settings')[0];
    return { profile: data, settings: settings ? { lang: settings.lang, theme: settings.theme } : null };
}

function canonicalJson(value) {
    return JSON.stringify(value, (key, entry) => entry && typeof entry == 'object' && !Array.isArray(entry)
        ? Object.fromEntries(Object.keys(entry).sort().map(field => [field, entry[field]])) : entry);
}

function rowChanges(current, snapshot) {
    const changes = [];
    for (const [key, { table, row }] of current) {
        const previous = snapshot.get(key);
        if (!previous || canonicalJson(row) !== canonicalJson(previous.row))
            changes.push({ key, table, version: previous ? previous.version : null, row });
    }
    // Parent rows must exist before their notes or wishlist items are written.
    const priority = table => table == 'level_notes' || table == 'wishlist_items' ? 1 : 0;
    changes.sort((a, b) => priority(a.table) - priority(b.table));
    for (const [key, previous] of snapshot) {
        if (!current.has(key))
            changes.push({ key, table: key.slice(0, key.indexOf(':')), version: previous.version, row: null });
    }
    return changes;
}

function mergeRow(base, local, remote) {
    const server = new Set(['user_id', 'version', 'created_at', 'updated_at']);
    const clean = value => value == null ? null : Object.fromEntries(Object.entries(value).filter(([field]) => !server.has(field)));
    if (local == null || remote == null)
        return { row: clean(local ?? remote), conflicts: [] };
    const merged = [], conflicts = [];
    for (const field of new Set([...Object.keys(base || {}), ...Object.keys(local), ...Object.keys(remote)])) {
        if (server.has(field))
            continue;
        const original = canonicalJson(base?.[field]), mine = canonicalJson(local[field]), theirs = canonicalJson(remote[field]);
        let value;
        if (mine === original || mine === theirs)
            value = remote[field];
        else if (theirs === original)
            value = local[field];
        else {
            value = remote[field];
            conflicts.push(field);
        }
        if (value !== undefined)
            merged.push([field, value]);
    }
    return { row: Object.fromEntries(merged), conflicts };
}
