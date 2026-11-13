/** In-memory RPC boundary for independent devices sharing one account. */
export class FakeSyncServer {
    constructor() {
        this.tables = Object.fromEntries(['user_settings', 'levels', 'level_notes', 'level_tags', 'list_orders', 'wishlists', 'wishlist_items', 'tags'].map(table => [table, new Map()]));
        this.profile = { id: 'owner', display_name: 'Player', username: null, color: '#123456', secondary_color: '#abcdef' };
        this.revision = 0;
        this.calls = [];
        this.failure = null;
        this.reject = () => null;
        this.before = null;
    }

    key(table, row) {
        const columns = { user_settings: [], levels: ['id'], level_notes: ['level_id'], level_tags: ['level_id', 'tag_name'], list_orders: ['kind'], wishlists: ['id'], wishlist_items: ['id'], tags: ['name'] }[table];
        return Object.fromEntries(columns.map(column => [column, row[column]]));
    }

    rows(table) { return [...this.tables[table].values()]; }

    remove(table, key) {
        const id = JSON.stringify(this.key(table, key)), row = this.tables[table].get(id);
        if (!row) return;
        this.tables[table].delete(id);
        this.revision++;
        const children = table === 'levels' ? ['level_notes', 'level_tags'] : table === 'wishlists' ? ['wishlist_items'] : table === 'tags' ? ['level_tags'] : [];
        for (const child of children) {
            for (const entry of this.rows(child)) {
                if (table === 'tags' ? entry.tag_name === row.name : table === 'wishlists' ? entry.wishlist_id === row.id : entry.level_id === row.id)
                    this.remove(child, this.key(child, entry));
            }
        }
    }

    async rpc(name, args) {
        this.calls.push({ name, ...structuredClone(args) });
        if (this.before) await this.before(name);
        if (this.failure === 'offline') throw new TypeError('Failed to fetch');
        if (this.failure) return { data: null, error: this.failure };
        if (name === 'sync_revision') return { data: String(this.revision), error: null };
        if (name === 'sync_pull') return { data: { profile: structuredClone(this.profile), ...Object.fromEntries(Object.keys(this.tables).map(table => [table, structuredClone(this.rows(table))])), revision: String(this.revision) }, error: null };
        if (name !== 'sync_push') throw Error('Unexpected RPC: ' + name);
        if (!Array.isArray(args.changes) || args.changes.length > 500)
            return { error: { code: '22023', message: 'batch_too_large' }, data: null };
        const result = { applied: [], conflicts: [], rejected: [], previous_revision: String(this.revision) };
        for (const change of args.changes) {
            const { table, key, version, row } = change;
            const id = JSON.stringify(this.key(table, key)), current = this.tables[table].get(id), message = this.reject(change);
            if (message) {
                result.rejected.push({ table, key, code: '23514', message });
                continue;
            }
            if ((row !== null && (version == null ? !!current : current?.version !== version)) || (row === null && current && current.version !== version)) {
                result.conflicts.push({ table, key, row: structuredClone(current || null) });
                continue;
            }
            if (row === null) {
                this.remove(table, key);
            }
            else {
                const stamp = new Date(Date.UTC(2026, 0, 1, 0, 0, ++this.revision)).toISOString();
                this.tables[table].set(id, { ...current, ...structuredClone(row), user_id: 'owner', version: (current?.version || 0) + 1, created_at: current?.created_at || stamp, updated_at: stamp });
            }
            result.applied.push({ table, key, version: row === null ? null : this.tables[table].get(id).version });
        }
        return { data: { ...result, revision: String(this.revision) }, error: null };
    }
}
