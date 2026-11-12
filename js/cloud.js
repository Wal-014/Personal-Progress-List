/** Beta opt-in and on-demand loading of the Supabase client. */

let cloudBetaEnabled, cloudPromise;

/** Applies the URL's beta switch once and caches the stored opt-in for this page. */
function cloudBeta() {
    if (cloudBetaEnabled !== undefined)
        return cloudBetaEnabled;
    const url = new URL(location.href), beta = url.searchParams.get('beta');
    try {
        if (beta == 'cloud')
            localStorage.gbeta = 'cloud';
        else if (beta == 'off')
            localStorage.removeItem('gbeta');
        cloudBetaEnabled = localStorage.gbeta == 'cloud';
    }
    catch {
        cloudBetaEnabled = false;
    }
    if (url.searchParams.has('beta')) {
        url.searchParams.delete('beta');
        history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }
    return cloudBetaEnabled;
}

/** Shares one client-loading promise, allowing a fresh attempt after a failed load. */
function loadCloud() {
    if (!cloudPromise) {
        const script = document.createElement('script');
        cloudPromise = new Promise((resolve, reject) => {
            script.src = 'vendor/supabase.js';
            script.onload = () => {
                try {
                    resolve(supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
                        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
                    }));
                }
                catch (error) {
                    reject(error);
                }
            };
            script.onerror = () => reject(new TypeError('Failed to fetch Supabase client'));
            document.head.appendChild(script);
        }).catch(error => {
            cloudPromise = null;
            script.remove();
            throw error;
        });
    }
    return cloudPromise;
}

/** Checks for a saved session without loading the client. */
function hasCloudSession() {
    try {
        const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
        return !!localStorage['sb-' + ref + '-auth-token'];
    }
    catch {
        return false;
    }
}
