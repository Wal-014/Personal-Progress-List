/** On-demand loading of the Supabase client. */

let cloudPromise;

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
