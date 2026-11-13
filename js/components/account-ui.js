/** Account screens share the local editor's dialogs without changing local profiles. */

let accountSignInPending = false;

function accountButton() {
    if (account.status == 'off')
        return '';
    if (account.status == 'signed-in' && account.profile) {
        const own = account.profile;
        return `<button class="sq account-button" popovertarget=amenu aria-label="${t('account')} · ${escapeHtml(own.display_name)}">${cubeIcon(own.color, own.secondary_color)}</button>${accountMenu()}`;
    }
    return `<button class="sq account-button" ${account.status == 'loading' ? 'disabled aria-busy=true' : 'data-act=asignin'} aria-label="${t(account.status == 'loading' ? 'accountLoading' : 'accountSignIn')}">${cubeIcon('#8a8fa3', '#d2d9ff')}</button>`;
}

function accountMenu() {
    const own = account.profile;
    const row = (act, icon, key) => `<button class=pma data-act=${act}>${icon}<span>${t(key)}</span></button>`;
    return `<div id=amenu class="pmenu amenu" popover><div class=account-head>${cubeIcon(own.color, own.secondary_color)}<div class=info><span class=nm>${escapeHtml(own.display_name)}</span><span class=by>${own.username ? '@' + escapeHtml(own.username) : t('accountChooseUsername')}</span></div></div>${row('aprofile', ICONS.person, 'accountProfile')}${row('aedit', ICONS.edit, 'pedit')}${row('ashare', ICONS.exp, 'shareProfile')}${row('asettings', ICONS.settings, 'accountSettings')}${row('asignout', ICONS.logout, 'accountSignOut')}</div>`;
}

function passwordField(id, labelKey, autocomplete) {
    return `<label for=${id}>${t(labelKey)}</label><div class=password-field><input id=${id} name=${id} type=password minlength=8 required autocomplete=${autocomplete}><button type=button data-act=apw aria-pressed=false aria-controls="${id}" aria-label="${t('accountShowPassword')}">${ICONS.eye}<span>${t('accountShow')}</span></button></div>`;
}

function authDialog(mode, note = '') {
    const titleKey = mode == 'signup' ? 'accountSignUp' : mode == 'reset' ? 'accountReset' : 'accountSignIn';
    const switcher = mode == 'reset' ? '' : `<div class=gdseg>${['signin', 'signup'].map(value => `<button type=button data-act=amode data-v=${value} aria-pressed=${mode == value}>${t(value == 'signin' ? 'accountSignIn' : 'accountSignUp')}</button>`).join('')}</div><div id=agoogle-slot></div>`;
    return `<div class="box sm account-dialog"><h2>${t(titleKey)}</h2>${switcher}<form id=af data-mode=${mode}>${mode == 'signup' ? `<label for=adisplay>${t('accountDisplayName')}</label><input id=adisplay name=adisplay required maxlength=40 autocomplete=nickname>` : ''}<label for=aemail>${t('accountEmail')}</label><input id=aemail name=aemail type=email required autocomplete=email>${mode == 'reset' ? '' : passwordField('apassword', 'accountPassword', mode == 'signin' ? 'current-password' : 'new-password')}${mode == 'signup' ? `<p class=by>${t('accountPasswordHint')}</p>` : ''}<p id=amsg class="gdm warn" role=alert tabindex=-1>${escapeHtml(note)}</p><div id=auth-forward></div><p class=dgb><button type=button data-act=close>${t('close')}</button><button class=pri type=submit>${t(titleKey)}</button></p></form><p><button type=button class=account-link data-act=amode data-v=${mode == 'signin' ? 'reset' : 'signin'}>${t(mode == 'signin' ? 'accountForgot' : 'accountBackSignIn')}</button></p></div>`;
}

function googleButton() {
    return `<button type=button class=gbtn data-act=agoogle><svg class=i viewBox="0 0 48 48" aria-hidden=true><path fill="#4285F4" d="M43.61 24.46c0-1.36-.12-2.66-.35-3.92H24v7.43h11a9.4 9.4 0 0 1-4.08 6.17v5h6.61c3.87-3.56 6.08-8.8 6.08-14.68Z"/><path fill="#34A853" d="M24 44c5.51 0 10.13-1.83 13.51-4.96l-6.61-5c-1.83 1.23-4.17 1.97-6.9 1.97-5.32 0-9.85-3.59-11.47-8.43H5.71v5.15A20.4 20.4 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.53 27.58A12 12 0 0 1 11.9 24c0-1.24.22-2.45.63-3.58v-5.15H5.71A20 20 0 0 0 3.5 24c0 3.22.77 6.27 2.21 8.73Z"/><path fill="#EA4335" d="M24 12c3 0 5.69 1.04 7.81 3.08l5.86-5.86C34.12 5.91 29.5 4 24 4A20.4 20.4 0 0 0 5.71 15.27l6.82 5.15C14.15 15.59 18.68 12 24 12Z"/></svg>${t('accountGoogle')}</button><div class=auth-divider>${t('accountOr')}</div>`;
}

function openAuthDialog(mode = 'signin', note = '') {
    openModal(authDialog(mode, note));
    const form = qs('#af'), slot = qs('#agoogle-slot');
    form.querySelector('input').focus();
    if (slot)
        googleSignInAvailable().then(available => {
            if (available && slot.isConnected)
                slot.innerHTML = googleButton();
        });
}

function accountMessage(root, selector, message) {
    const element = root.querySelector(selector);
    element.textContent = message;
    element.focus();
}

async function accountPending(button, key, action) {
    if (button.disabled)
        return;
    const markup = button.innerHTML;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = t(key);
    try {
        return await action();
    }
    finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.innerHTML = markup;
    }
}

function confirmationPanel(email) {
    return `<div class=account-confirmation><h3 tabindex=-1>${t('accountInbox')}</h3><p>${escapeHtml(t('accountConfirmationSent').replace('{email}', () => email))}</p><p id=amsg class="gdm warn" role=alert tabindex=-1></p><p class=dgb><button type=button data-act=aresend data-email="${escapeHtml(email)}">${t('accountResend')}</button><button class=pri type=button data-act=close>${t('close')}</button></p></div>`;
}

async function submitAuth(form) {
    const mode = form.dataset.mode, email = form.elements.aemail.value.trim();
    return accountPending(form.querySelector('[type=submit]'), mode == 'signin' ? 'accountSigningIn' : mode == 'signup' ? 'accountCreating' : 'accountSending', async () => {
        const result = mode == 'signin' ? await signInWithEmail(email, form.elements.apassword.value)
            : mode == 'signup' ? await signUpWithEmail(email, form.elements.apassword.value, form.elements.adisplay.value.trim())
                : await sendPasswordReset(email);
        if (!form.isConnected)
            return;
        if (mode == 'reset' && (!result.error || ['authExists', 'authBadLogin', 'authUnconfirmed'].includes(result.error))) {
            accountMessage(form, '#amsg', t('accountResetSent').replace('{email}', () => email));
            return;
        }
        if (result.error) {
            form.querySelector('#auth-forward').innerHTML = result.error == 'authUnconfirmed' ? `<button type=button data-act=aresend data-email="${escapeHtml(email)}">${t('accountResend')}</button>` : '';
            accountMessage(form, '#amsg', t(result.error));
            return;
        }
        if (result.needsConfirmation) {
            form.innerHTML = confirmationPanel(email);
            form.querySelector('h3').focus();
            return;
        }
        closeModal();
        accountSignInPending = true;
        finishAccountSignIn();
    });
}

function finishAccountSignIn() {
    if (accountSignInPending && account.status == 'signed-in' && account.profile) {
        accountSignInPending = false;
        showToast(t('accountSignedIn').replace('{name}', () => account.profile.display_name));
    }
}

async function continueWithGoogle(button) {
    const root = button.closest('.account-dialog');
    return accountPending(button, 'accountSigningIn', async () => {
        const result = await signInWithGoogle();
        if (result.error && root.isConnected)
            accountMessage(root, '#amsg', t(result.error));
    });
}

async function resendAccountEmail(button) {
    const root = button.closest('.account-dialog');
    return accountPending(button, 'accountSending', async () => {
        const result = await resendConfirmation(button.dataset.email);
        if (root.isConnected)
            accountMessage(root, '#amsg', t(result.error || 'accountConfirmationResent'));
    });
}

function toggleAccountPassword(button) {
    const input = qs('#' + button.getAttribute('aria-controls')), show = input.type == 'password';
    input.type = show ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(show));
    button.setAttribute('aria-label', t(show ? 'accountHidePassword' : 'accountShowPassword'));
    button.querySelector('span').textContent = t(show ? 'accountHide' : 'accountShow');
}

function passwordDialog() {
    openModal(`<div class="box sm account-dialog"><h2>${t('accountNewPassword')}</h2><form id=pwf>${passwordField('pnewpassword', 'accountNewPassword', 'new-password')}${passwordField('pconfirm', 'accountConfirmPassword', 'new-password')}<p class=by>${t('accountPasswordHint')}</p><div id=nonce-field hidden><label for=pnonce>${t('accountNonce')}</label><input id=pnonce name=pnonce pattern="[0-9]{6,10}" maxlength=10 minlength=6 inputmode=numeric autocomplete=one-time-code disabled></div><p id=pwmsg class="gdm warn" role=alert tabindex=-1></p><p class=dgb><button type=button data-act=close>${t('close')}</button><button class=pri type=submit>${t('save')}</button></p></form></div>`);
    qs('#pnewpassword').focus();
}

async function submitAccountPassword(form) {
    const password = form.elements.pnewpassword.value, confirmation = form.elements.pconfirm;
    confirmation.setCustomValidity(password == confirmation.value ? '' : t('accountPasswordMismatch'));
    if (!confirmation.reportValidity()) {
        accountMessage(form, '#pwmsg', t('accountPasswordMismatch'));
        return;
    }
    return accountPending(form.querySelector('[type=submit]'), 'accountSaving', async () => {
        const nonce = form.elements.pnonce, result = await updatePassword(password, nonce.disabled ? undefined : nonce.value);
        if (!form.isConnected)
            return;
        if (result.error)
            return accountMessage(form, '#pwmsg', t(result.error));
        if (result.needsNonce) {
            form.querySelector('#nonce-field').hidden = false;
            nonce.disabled = false;
            nonce.required = true;
            accountMessage(form, '#pwmsg', t('accountNonce'));
            nonce.focus();
            return;
        }
        closeModal();
        showToast(t('accountPasswordChanged'));
    });
}

function profileCard() {
    const own = account.profile, country = COUNTRY_CODES.includes(own.country) ? new Intl.DisplayNames([ui.lang], { type: 'region' }).of(own.country) : '';
    const date = new Date(own.created_at);
    return `<div class="box sm account-dialog profile-card">${cubeIcon(own.color, own.secondary_color)}<h2>${escapeHtml(own.display_name)}</h2><p class=by>${own.username ? '@' + escapeHtml(own.username) : t('accountNoUsername')}</p>${country ? `<p>${escapeHtml(country)}</p>` : ''}<p class=profile-bio>${escapeHtml(own.bio || '')}</p>${Number.isNaN(date.getTime()) ? '' : `<p class=by>${escapeHtml(t('accountMemberSince').replace('{date}', () => date.toLocaleDateString(ui.lang)))}</p>`}<p class=by>${t(own.is_public ? 'profilePublic' : 'profilePrivate')}${own.is_public && publicProfileLink(own.username) ? ` · <a href="${escapeHtml(publicProfileLink(own.username))}">${escapeHtml(publicProfileLink(own.username))}</a>` : ''}</p><p class=dgb><button data-act=ashare>${t('share')}</button><button class=pri data-act=aedit>${ICONS.edit}${t('pedit')}</button><button data-act=close>${t('close')}</button></p></div>`;
}

function accountProfileColors() {
    const own = account.profile;
    return { color: isHexColor(own.color) ? own.color : PROFILE_COLORS[0], secondaryColor: isHexColor(own.secondary_color) ? own.secondary_color : DEFAULT_SECONDARY_COLOR };
}

function profileForm() {
    const own = account.profile, names = new Intl.DisplayNames([ui.lang], { type: 'region' });
    const options = COUNTRY_CODES.map(code => ({ code, name: names.of(code) })).sort((a, b) => a.name.localeCompare(b.name, ui.lang));
    return `<div class="box sm account-dialog"><h2>${t('pedit')}</h2><form id=pf><label for=pdisplay>${t('accountDisplayName')}</label><input id=pdisplay name=pdisplay value="${escapeHtml(own.display_name)}" required maxlength=40 autocomplete=nickname><label for=pusername>${t('accountUsername')}</label><div class=username-field><span aria-hidden=true>@</span><input id=pusername name=pusername value="${escapeHtml(own.username || '')}" pattern="[a-z0-9_]{3,20}" maxlength=20 autocomplete=username autocapitalize=none spellcheck=false aria-describedby=username-hint></div><p id=username-hint class=by>${t('accountUsernameHint')}</p>${profileColorFields(accountProfileColors())}<label for=pbio>${t('accountBio')}</label><textarea id=pbio name=pbio maxlength=300 rows=4 aria-describedby=bio-count>${escapeHtml(own.bio || '')}</textarea><p id=bio-count class="by account-counter" aria-live=polite>${(own.bio || '').length} / 300</p><label for=pcountry>${t('accountCountry')}</label><select id=pcountry name=pcountry><option value="">${t('accountNotSet')}</option>${options.map(({ code, name }) => `<option value="${code}"${code == own.country ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select><p id=pmsg class="gdm warn" role=alert tabindex=-1></p><p class=dgb><button type=button data-act=close>${t('close')}</button><button class=pri type=submit>${t('save')}</button></p></form></div>`;
}

function openProfileForm() {
    openModal(profileForm());
    const form = qs('#pf');
    form.profileColors = accountProfileColors();
    bindProfileColors(form, form.profileColors);
    form.elements.pdisplay.focus();
}

function accountFormInput(input) {
    if (input.id == 'pusername') {
        input.value = input.value.toLowerCase();
        input.setCustomValidity('');
    }
    if (input.id == 'pbio')
        qs('#bio-count').textContent = input.value.length + ' / 300';
    if (input.form?.id == 'pwf')
        input.form.elements.pconfirm.setCustomValidity('');
}

async function submitAccountProfile(form) {
    const fields = form.elements;
    return accountPending(form.querySelector('[type=submit]'), 'accountSaving', async () => {
        const result = await saveOwnProfile({
            display_name: fields.pdisplay.value.trim(), username: fields.pusername.value.trim().toLowerCase() || null,
            color: form.profileColors.color, secondary_color: form.profileColors.secondaryColor,
            bio: fields.pbio.value.trim() || null, country: fields.pcountry.value || null
        });
        if (!form.isConnected)
            return;
        if (result.error == 'usernameTaken') {
            fields.pusername.setCustomValidity(t('usernameTaken'));
            fields.pusername.focus();
            fields.pusername.reportValidity();
            return;
        }
        if (result.error)
            return accountMessage(form, '#pmsg', t(result.error));
        closeModal();
        showToast(t('accountProfileSaved'));
    });
}

function settingsDialog() {
    openModal(`<div class="box sm account-dialog"><h2>${t('accountSettings')}</h2><p class=account-email>${escapeHtml(account.user.email || '')}</p><form id=ef><h3>${t('accountChangeEmail')}</h3><label for=enew>${t('accountNewEmail')}</label><input id=enew name=enew type=email required autocomplete=email><p id=emsg class="gdm warn" role=alert tabindex=-1></p><p class=dgb><button class=blue type=submit>${t('accountChangeEmail')}</button></p></form><h3>${t('accountPassword')}</h3><button data-act=apassword>${t(hasPasswordIdentity() ? 'accountChangePassword' : 'accountAddPassword')}</button><section class=account-danger><h3>${t('accountDelete')}</h3><p>${t('accountDeleteHint')}</p><button class=dg data-act=adelete>${ICONS.del}${t('accountDelete')}</button></section><p id=settings-msg class="gdm warn" role=alert tabindex=-1></p><p class=dgb><button data-act=close>${t('close')}</button></p></div>`);
    qs('#enew').focus();
}

async function submitAccountEmail(form) {
    return accountPending(form.querySelector('[type=submit]'), 'accountSaving', async () => {
        const result = await updateEmail(form.elements.enew.value.trim());
        if (form.isConnected)
            accountMessage(form, '#emsg', t(result.error || 'accountEmailChanged'));
    });
}

async function confirmAccountDeletion(button) {
    const email = account.user.email, ownerId = account.user.id;
    const answer = await showDialog({ title: t('accountDelete'), msg: t('accountDeleteHint'), danger: 1, input: 1, label: t('accountDeleteConfirm').replace('{email}', () => email) });
    if (answer == null)
        return;
    const root = button.closest('.account-dialog');
    if (answer.trim().toLowerCase() != email.toLowerCase())
        return accountMessage(root, '#settings-msg', t('accountEmailMismatch'));
    if (account.user?.id != ownerId)
        return;
    return accountPending(button, 'accountDeleting', async () => {
        const result = await deleteAccount();
        if (result.error) {
            if (root.isConnected)
                accountMessage(root, '#settings-msg', t(result.error));
            return;
        }
        closeModal();
        showToast(t('accountDeleted'));
    });
}

async function signOutFromMenu(button) {
    if (cloudSync.pending && !await showDialog({ title: t('accountSignOut'), msg: t(cloudSync.pending == 1 ? 'cloudSignOutOne' : 'cloudSignOut').replace('{n}', cloudSync.pending), danger: 1 }))
        return;
    const result = await accountPending(button, 'accountSigningOut', () => signOutAccount());
    if (!result)
        return;
    if (result.error)
        return showAlert(t(result.error));
    showToast(t('accountSignedOut'));
}

function publicProfileLink(username) {
    return typeof username == 'string' && username.length >= 3 && username.length <= 20 && !/[^a-z0-9_]/.test(username)
        ? location.origin + location.pathname + '?user=' + username : '';
}

function shareDialog() {
    const own = account.profile, link = publicProfileLink(own.username);
    const body = !link
        ? `<p>${t('shareNeedsUsername')}</p><p class=dgb><button class=pri data-act=aedit>${t('shareChooseUsername')}</button></p>`
        : `<p id=share-hint>${t('sharePublicHint')}</p><div class=gdseg role=group aria-label="${t('shareProfile')}" aria-describedby=share-hint>${[false, true].map(value => `<button type=button data-act=asharestate data-v=${value} aria-pressed=${!!own.is_public == value}>${t(value ? 'profilePublic' : 'profilePrivate')}</button>`).join('')}</div><p id=share-message class="gdm warn" role=alert tabindex=-1></p>${own.is_public ? `<label for=share-link>${t('shareProfileLink')}</label><input id=share-link readonly value="${escapeHtml(link)}"><p class=dgb><button data-act=acopy>${t('shareCopy')}</button><a class="lk share-open" href="${escapeHtml(link)}" target=_blank rel=noopener>${t('shareOpen')}</a></p>` : `<p>${t('sharePrivateHint')}</p>`}`;
    openModal(`<div id=share-dialog class="box sm account-dialog"><h2>${t('shareProfile')}</h2>${body}<p class=dgb><button data-act=close>${t('close')}</button></p></div>`);
}

async function setProfileVisibility(button) {
    const root = button.closest('#share-dialog'), buttons = [...root.querySelectorAll('[data-act=asharestate]')];
    if (buttons.some(control => control.disabled))
        return;
    const isPublic = button.dataset.v == 'true';
    buttons.forEach(control => control.disabled = true);
    root.setAttribute('aria-busy', 'true');
    root.querySelector('#share-message').textContent = t('accountSaving');
    try {
        const result = await saveOwnProfile({ is_public: isPublic });
        if (!root.isConnected)
            return;
        if (result.error) {
            accountMessage(root, '#share-message', t(result.error));
            return;
        }
        shareDialog();
        qs(`#share-dialog [data-v=${isPublic}]`)?.focus();
    }
    finally {
        buttons.forEach(control => control.disabled = false);
        root.removeAttribute('aria-busy');
    }
}

async function copyProfileLink() {
    const input = qs('#share-link');
    if (!input)
        return;
    try {
        await navigator.clipboard.writeText(input.value);
        showToast(t('shareCopied'));
    }
    catch {
        input.focus();
        input.select();
        showToast(t('shareCopyManual'));
    }
}
