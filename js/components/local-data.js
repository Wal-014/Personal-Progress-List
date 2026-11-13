/** Local backup cards and the account migration preview. */

function localProfileCounts(p) {
    return t('localCounts').replace('{levels}', localDataCount('Levels', p.data?.levels?.length || 0)).replace('{wishlists}', localDataCount('Wishlists', p.data?.wishlists?.length || 0)).replace('{tags}', localDataCount('Tags', p.data?.tags?.length || 0));
}

function localProfileSummary(id, showActive = true) {
    const p = store.profs[id];
    return `${cubeIcon(p.color, p.secondaryColor)}<span class=info><span class=nm>${escapeHtml(p.name)}</span><span class=by>${localProfileCounts(p)}</span>${showActive && id == store.cur ? `<span class=by>${t('localActive')}</span>` : ''}</span>`;
}

function migrationDialog(selectedId) {
    const offers = localProfilesToOffer(cloudUser);
    if (selectedId && store.profs[selectedId] && !offers.includes(selectedId))
        offers.push(selectedId);
    const selected = offers.includes(selectedId) ? selectedId : offers.includes(store.cur) ? store.cur : offers[0];
    const warning = profile.levels.length || profile.wishlists.length
        ? `<p class=warn>${t('migrationWarning').replace('{levels}', localDataCount('Levels', profile.levels.length)).replace('{wishlists}', localDataCount('Wishlists', profile.wishlists.length))}</p>` : '';
    return `<div class="box sm migration" id=migration><h2>${t('migrationTitle')}</h2><p class=by>${t('migrationHint')}</p>
<fieldset><legend>${t('migrationChoose')}</legend>${offers.map(id => `<label class="obj local-choice"><input type=radio name=local-profile value="${escapeHtml(id)}"${id == selected ? ' checked' : ''}>${localProfileSummary(id)}</label>`).join('')}</fieldset>
${warning}<label class=local-identity><input type=checkbox id=migration-identity>${t('migrationIdentity')}</label>
<p class=dgb><button data-act=migrationbackup>${t('localBackup')}</button><button data-act=migrationlater>${t('notNow')}</button><button class=pri data-act=migrationconfirm>${t('migrationBring')}</button></p></div>`;
}

function localDataDialog() {
    const recorded = cloudUser ? migratedLocalProfiles()[cloudUser] || [] : [];
    const row = id => {
        const migrated = recorded.includes(id), eid = escapeHtml(id);
        return `<div class=local-profile><div class=obj>${localProfileSummary(id)}</div><div class=local-actions>
${!cloudUser && id != store.cur ? `<button data-act=localuse data-id="${eid}">${t('localUse')}</button>` : ''}
<button data-act=localbackup data-id="${eid}">${t('localBackup')}</button>
${cloudUser ? `<button data-act=localbring data-id="${eid}"${migrated || !cloudSession?.pulled ? ' disabled' : ''}>${t(migrated ? 'localAlready' : 'migrationBring')}</button>` : ''}
<button class=dg data-act=localdelete data-id="${eid}"${canDeleteLocalProfile(id) ? '' : ' disabled'}>${t('localDelete')}</button></div></div>`;
    };
    return `<div class="box sm local-data"><h2>${t('localData')}</h2><p class=by>${t('localBackupHint')}</p>${Object.keys(store.profs).map(row).join('')}<p class=dgb><button data-act=localimport>${t('localImport')}</button><button class=pri data-act=close>${t('close')}</button></p></div>`;
}
