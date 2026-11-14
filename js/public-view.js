/** Public profile loading never replaces the visitor's stored progress. */

const publicUsername = new URL(location.href).searchParams.get('user');
const publicUsernameValid = publicUsername !== null && /^[a-z0-9_]{3,20}$/.test(publicUsername);
if (publicUsername !== null)
    viewing = { username: publicUsername, identity: null };
let publicViewMessage = 'publicLoading';

async function initPublicView() {
    profile = emptyProfile();
    if (!publicUsernameValid) {
        publicViewMessage = 'publicMissing';
        render();
        return;
    }
    render();
    try {
        const client = await loadCloud();
        const { data, error } = await client.rpc('public_profile', { target_username: viewing.username });
        if (error)
            throw error;
        if (!data) {
            publicViewMessage = 'publicMissing';
        }
        else {
            const rows = ['levels', 'level_tags', 'list_orders', 'wishlists', 'wishlist_items', 'tags']
                .flatMap(table => (data[table] || []).map(row => ({ table, row })));
            profile = rowsProfile(rows).profile;
            ensureProfileDefaults();
            viewing.identity = data.profile;
        }
    }
    catch {
        publicViewMessage = 'publicFailed';
    }
    render();
}

function publicViewScreen() {
    return `<div class="box sm"><p role=status>${t(publicViewMessage)}</p><p class=dgb><button class=pri data-act=myprogress>${t('publicGoBack')}</button></p></div>`;
}

function backToMyProgress() {
    const url = new URL(location.href);
    url.searchParams.delete('user');
    location.assign(url.pathname + url.search + url.hash);
}

function publicIdentityCard() {
    const identity = viewing.identity;
    const country = COUNTRY_CODES.includes(identity.country) ? new Intl.DisplayNames([ui.lang], { type: 'region' }).of(identity.country) : '';
    return `<div class="box profile-card">${cubeIcon(identity.color, identity.secondary_color)}<h2>${escapeHtml(identity.display_name)}</h2><p class=by>@${escapeHtml(viewing.username)}</p>${country ? `<p>${escapeHtml(country)}</p>` : ''}<p class=profile-bio>${escapeHtml(identity.bio || '')}</p></div>`;
}
