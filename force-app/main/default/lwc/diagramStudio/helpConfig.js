export function getHelpConfigurationOpen(section) {
    return section === 'configuration';
}

export function getHelpUserManualOpen(section) {
    return section === 'manual';
}

export function getHelpConfigurationClass(section) {
    return getHelpConfigurationOpen(section) ? 'help-nav-item help-nav-item-active' : 'help-nav-item';
}

export function getHelpUserManualClass(section) {
    return getHelpUserManualOpen(section) ? 'help-nav-item help-nav-item-active' : 'help-nav-item';
}

export function applyHelpManualSearch(root, rawQuery) {
    const query = (rawQuery || '').trim().toLowerCase();
    if (!root) return query;
    root.querySelectorAll('.help-manual-section').forEach((section) => {
        const haystack = ((section.dataset.search || '') + ' ' + (section.textContent || '')).toLowerCase();
        section.hidden = !!query && !haystack.includes(query);
    });
    return query;
}

export function clearHelpManualSearch(root) {
    if (!root) return;
    const input = root.querySelector('.help-manual-search');
    if (input) input.value = '';
    root.querySelectorAll('.help-manual-section').forEach((section) => {
        section.hidden = false;
    });
}
