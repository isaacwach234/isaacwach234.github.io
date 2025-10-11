const { element, STORAGE_KEYS } = window.app;

const reduceMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const prefersReducedMotion = reduceMotionQuery ? reduceMotionQuery.matches : false;

const howToPanel = element('howToPanel');
const categoryToggleContainer = element('categoryToggleContainer');
const hiddenCategoriesBanner = element('hiddenCategoriesBanner');
const favoritesContainer = element('favorites-container');
const clearFavoritesButton = element('clearFavoritesButton');
const historyContainer = element('history-container');
const underscoreToggle = element('underscoreToggle');
const categoryPickerModal = element('categoryPickerModal');
const categoryPickerList = element('categoryPickerList');
const categoryPickerTitle = element('categoryPickerTitle');
const categoryPickerSearch = element('categoryPickerSearch');
const tagInput = element('tagInput');
const copyMessage = element('copyMessage');

const categoryPickerState = { tagId: null };

function applyTheme(theme) {
    const selectedTheme = theme || 'theme-indigo';
    document.documentElement.className = 'dark';
    document.body.className = `p-4 md:p-6 lg:p-8 ${selectedTheme}`;

    document.querySelectorAll('.theme-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === selectedTheme);
    });

    localStorage.setItem(STORAGE_KEYS.THEME, selectedTheme);

    if (window.gsap && !prefersReducedMotion) {
        gsap.fromTo(
            'body',
            { filter: 'brightness(0.85)' },
            {
                filter: 'brightness(1)',
                duration: 0.6,
                ease: 'power2.out',
                onComplete: () => gsap.set('body', { clearProps: 'filter' })
            }
        );
    }
}

function runEntranceAnimations() {
    if (!window.gsap || prefersReducedMotion) return;

    gsap.from('.floating-panel', {
        opacity: 0,
        y: -24,
        duration: 0.6,
        ease: 'power3.out'
    });

    gsap.from('.glass-panel', {
        opacity: 0,
        y: 32,
        duration: 0.8,
        ease: 'power3.out',
        delay: 0.15
    });
}

function initializeHowToPanel() {
    if (!howToPanel) return;

    const storedState = localStorage.getItem(STORAGE_KEYS.HOWTO_OPEN);
    if (storedState === 'true') {
        howToPanel.setAttribute('open', '');
    } else if (storedState === 'false') {
        howToPanel.removeAttribute('open');
    }

    howToPanel.addEventListener('toggle', () => {
        localStorage.setItem(STORAGE_KEYS.HOWTO_OPEN, howToPanel.open);
    });
}

function loadHiddenCategories() {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.HIDDEN_CATEGORIES) || '[]');
        hiddenCategories = new Set(stored);
    } catch (error) {
        console.warn('Failed to load muted categories from storage', error);
        hiddenCategories = new Set();
    }
}

function saveHiddenCategories() {
    localStorage.setItem(
        STORAGE_KEYS.HIDDEN_CATEGORIES,
        JSON.stringify(Array.from(hiddenCategories))
    );
}

function ensureCategoryRegistered(category) {
    const resolved = category || 'Uncategorized';
    if (!knownCategories.has(resolved)) {
        knownCategories.add(resolved);
        renderCategoryFilters();
    }
}

function renderCategoryFilters() {
    if (!categoryToggleContainer) return;

    const categories = Array.from(knownCategories);
    if (!categories.includes('Uncategorized')) categories.push('Uncategorized');
    categories.sort((a, b) => a.localeCompare(b));

    categoryToggleContainer.innerHTML = '';

    if (categories.length === 0) {
        const placeholder = document.createElement('p');
        placeholder.className = 'text-xs text-gray-500';
        placeholder.textContent = 'Categories will appear after your first processing run.';
        categoryToggleContainer.appendChild(placeholder);
        return;
    }

    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = `category-toggle-btn${hiddenCategories.size === 0 ? ' opacity-60 cursor-not-allowed' : ''}`;
    resetButton.textContent = 'Show all';
    resetButton.disabled = hiddenCategories.size === 0;
    resetButton.addEventListener('click', () => {
        hiddenCategories.clear();
        saveHiddenCategories();
        if (window.displayTags) window.displayTags();
    });
    categoryToggleContainer.appendChild(resetButton);

    categories.forEach(category => {
        const count = baseTags.filter(tag => (tag.category || 'Uncategorized') === category).length;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `category-toggle-btn${hiddenCategories.has(category) ? ' muted' : ''}`;
        btn.dataset.category = category;
        btn.innerHTML = `<span>${category}</span><span class="text-[0.65rem] text-gray-400">${count}</span>`;
        btn.addEventListener('click', () => toggleCategoryMute(category));
        categoryToggleContainer.appendChild(btn);
    });

    updateHiddenCategoriesBanner();
}

function toggleCategoryMute(category) {
    if (hiddenCategories.has(category)) {
        hiddenCategories.delete(category);
    } else {
        hiddenCategories.add(category);
    }

    saveHiddenCategories();
    if (window.displayTags) window.displayTags();
}

function updateHiddenCategoriesBanner() {
    if (!hiddenCategoriesBanner) return;

    if (hiddenCategories.size === 0) {
        hiddenCategoriesBanner.classList.add('hidden');
    } else {
        hiddenCategoriesBanner.classList.remove('hidden');
        hiddenCategoriesBanner.textContent = `Muted categories (${hiddenCategories.size}): ${Array.from(hiddenCategories).join(', ')}`;
    }
}

const getFavoriteKey = (tag) => tag.toLowerCase().replace(/\s+/g, '_');

function loadFavorites() {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES) || '[]');
        favoriteTags = new Map(stored.map(tag => [getFavoriteKey(tag), tag]));
    } catch (error) {
        console.warn('Failed to load favorites from storage', error);
        favoriteTags = new Map();
    }
}

function saveFavorites() {
    localStorage.setItem(
        STORAGE_KEYS.FAVORITES,
        JSON.stringify(Array.from(favoriteTags.values()))
    );
}

function clearFavorites() {
    favoriteTags.clear();
    saveFavorites();
    renderFavorites();
    refreshFavoriteIndicators();
}

function renderFavorites() {
    if (!favoritesContainer) return;

    favoritesContainer.innerHTML = '';

    if (favoriteTags.size === 0) {
        favoritesContainer.innerHTML = '<p class="text-sm text-gray-500 italic">No favorites saved yet. Click the star on a tag to pin it here.</p>';
        if (clearFavoritesButton) clearFavoritesButton.disabled = true;
        return;
    }

    if (clearFavoritesButton) clearFavoritesButton.disabled = false;

    const list = Array.from(favoriteTags.values()).sort((a, b) => a.localeCompare(b));
    list.forEach(tag => {
        const pill = document.createElement('div');
        pill.className = 'favorite-pill';
        pill.title = 'Click to insert this tag into the prompt';

        const text = document.createElement('span');
        text.className = 'truncate max-w-[160px]';
        text.textContent = underscoreToggle?.checked ? tag.replace(/\s/g, '_') : tag.replace(/_/g, ' ');
        text.addEventListener('click', () => insertFavoriteTag(tag));
        pill.appendChild(text);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.innerHTML = '&times;';
        removeBtn.addEventListener('click', () => {
            favoriteTags.delete(getFavoriteKey(tag));
            saveFavorites();
            renderFavorites();
            refreshFavoriteIndicators();
        });
        pill.appendChild(removeBtn);

        favoritesContainer.appendChild(pill);
    });
}

function toggleFavorite(tagOriginal) {
    const key = getFavoriteKey(tagOriginal);
    if (favoriteTags.has(key)) {
        favoriteTags.delete(key);
    } else {
        favoriteTags.set(key, tagOriginal);
    }

    saveFavorites();
    renderFavorites();
    refreshFavoriteIndicators();
}

function refreshFavoriteIndicators() {
    document.querySelectorAll('.tag-favorite-btn').forEach(btn => {
        const original = btn.dataset.tagOriginal;
        const isFavorite = favoriteTags.has(getFavoriteKey(original));
        btn.classList.toggle('active', isFavorite);
        btn.textContent = isFavorite ? '★' : '☆';
    });

    if (clearFavoritesButton) {
        clearFavoritesButton.disabled = favoriteTags.size === 0;
    }
}

function insertFavoriteTag(tag) {
    if (!tagInput) return;

    const existing = tagInput.value.trim();
    const normalized = tag.replace(/_/g, ' ');
    const separator = existing && !existing.endsWith(',') ? ', ' : '';
    const candidate = `${existing}${separator}${normalized}`.trim();
    tagInput.value = candidate;

    if (window.processAll) window.processAll();
}

function updateCopyHistory(text) {
    if (text) {
    copyHistory.unshift(text);
    if (copyHistory.length > 10) copyHistory.pop();
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(copyHistory));
    }

    if (!historyContainer) return;

    historyContainer.innerHTML = '';

    if (copyHistory.length === 0) {
        historyContainer.innerHTML = '<p class="text-sm text-gray-500 italic">No history yet.</p>';
    } else {
        copyHistory.forEach(entry => {
            const el = document.createElement('div');
            el.className = 'history-item p-2 rounded-md flex items-center justify-between gap-2';
            el.innerHTML = `
                <span class="history-item-text text-gray-400 text-xs flex-grow overflow-hidden whitespace-nowrap text-ellipsis">${entry}</span>
                <button class="copy-btn-sm p-1 rounded" title="Copy to clipboard">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-300">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                </button>`;

            const button = el.querySelector('button');
            button?.addEventListener('click', () => {
                navigator.clipboard.writeText(entry).catch(() => {
                    alert('Unable to copy history item.');
                });
            });

            historyContainer.appendChild(el);
        });
    }

    if (window.updateStats) window.updateStats();
}

function getAllKnownCategories() {
    const categories = new Set([
        ...(tagCategorizer?.categoryOrder || []),
        ...knownCategories,
        'Uncategorized'
    ]);

    return Array.from(categories).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function renderCategoryPickerOptions(query = '') {
    if (!categoryPickerList) return;

    const search = query.trim().toLowerCase();
    const categories = getAllKnownCategories().filter(category => !search || category.toLowerCase().includes(search));
    const tag = baseTags.find(item => item.id === categoryPickerState.tagId);

    categoryPickerList.innerHTML = '';

    if (categories.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'category-picker-empty';
        empty.textContent = 'No categories matched your search.';
        categoryPickerList.appendChild(empty);
        return;
    }

    categories.forEach(category => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'category-list-btn';
        btn.textContent = category;
        if (tag && tag.category === category) btn.classList.add('active');
        btn.addEventListener('click', () => assignCategoryToTag(category));
        categoryPickerList.appendChild(btn);
    });
}

function openCategoryPicker(tagId) {
    const tag = baseTags.find(item => item.id === tagId);
    if (!tag || !categoryPickerModal) return;

    categoryPickerState.tagId = tagId;

    if (categoryPickerTitle) {
        categoryPickerTitle.textContent = tag.original.replace(/_/g, ' ');
    }

    if (categoryPickerSearch) {
        categoryPickerSearch.value = '';
    }

    renderCategoryPickerOptions('');

    categoryPickerModal.classList.add('active');

    if (categoryPickerSearch) {
        setTimeout(() => categoryPickerSearch.focus(), 50);
    }
}

function closeCategoryPicker() {
    if (!categoryPickerModal) return;
    categoryPickerModal.classList.remove('active');
    categoryPickerState.tagId = null;
}

function assignCategoryToTag(category) {
    if (!categoryPickerState.tagId) return;
    const tag = baseTags.find(item => item.id === categoryPickerState.tagId);
    if (!tag) return;

    tag.category = category;
    tag.categorySource = 'Manual';
    ensureCategoryRegistered(category);

    if (tagCategorizer) {
        tagCategorizer.updateIndex(tag.original, category);
    }

    closeCategoryPicker();
    if (window.displayTags) window.displayTags();
}

function showTokenSettings() {
    const panel = element('tokenPanel');
    const input = element('githubTokenInput');
    const checkbox = element('rememberToken');

    if (!panel || !input || !checkbox) return;

    const savedToken = localStorage.getItem(STORAGE_KEYS.GITHUB_PAT);
    if (savedToken) {
        input.value = savedToken;
        checkbox.checked = true;
        gitHubPat = savedToken;
    }

    updateTokenStatus();
    panel.classList.remove('hidden');
}

function hideTokenSettings() {
    const panel = element('tokenPanel');
    panel?.classList.add('hidden');
}

function saveToken() {
    const input = element('githubTokenInput');
    const remember = element('rememberToken');

    if (!input || !remember) return;

    const token = input.value.trim();
    if (!token) {
        alert('Please enter a valid GitHub token');
        return;
    }

    gitHubPat = token;

    if (remember.checked) {
        localStorage.setItem(STORAGE_KEYS.GITHUB_PAT, token);
    } else {
        localStorage.removeItem(STORAGE_KEYS.GITHUB_PAT);
    }

    updateTokenStatus();
    hideTokenSettings();

    if (copyMessage) {
        copyMessage.textContent = 'Token saved!';
        setTimeout(() => {
            if (copyMessage.textContent === 'Token saved!') {
                copyMessage.textContent = '';
            }
        }, 3000);
    }
}

function testToken() {
    const input = element('githubTokenInput');
    if (!input) return;

    const token = input.value.trim();
    if (!token) {
        alert('Please enter a token first');
        return;
    }

    fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json'
        }
    })
        .then(response => {
            const statusEl = element('tokenStatus');
            if (!statusEl) return;

            if (response.ok) {
                statusEl.innerHTML = '<span class="text-green-400">✓ Token is valid and has access</span>';
            } else if (response.status === 401) {
                statusEl.innerHTML = '<span class="text-red-400">✗ Invalid token</span>';
            } else if (response.status === 403) {
                statusEl.innerHTML = '<span class="text-yellow-400">⚠ Token valid but insufficient permissions</span>';
            } else {
                statusEl.innerHTML = '<span class="text-red-400">✗ Connection failed</span>';
            }
        })
        .catch(() => {
            const statusEl = element('tokenStatus');
            if (statusEl) {
                statusEl.innerHTML = '<span class="text-red-400">✗ Connection error</span>';
            }
        });
}

function updateTokenStatus() {
    const statusEl = element('tokenStatus');
    if (!statusEl) return;

    if (gitHubPat || localStorage.getItem(STORAGE_KEYS.GITHUB_PAT)) {
        statusEl.innerHTML = '<span class="text-green-400">✓ Token configured</span>';
    } else {
        statusEl.innerHTML = '<span class="text-gray-400">No token configured</span>';
    }
}

function toggleSettingsPanel() {
    const panel = element('settingsPanel');
    panel?.classList.toggle('hidden');
}

window.applyTheme = applyTheme;
window.runEntranceAnimations = runEntranceAnimations;
window.initializeHowToPanel = initializeHowToPanel;
window.loadHiddenCategories = loadHiddenCategories;
window.saveHiddenCategories = saveHiddenCategories;
window.ensureCategoryRegistered = ensureCategoryRegistered;
window.renderCategoryFilters = renderCategoryFilters;
window.toggleCategoryMute = toggleCategoryMute;
window.updateHiddenCategoriesBanner = updateHiddenCategoriesBanner;
window.loadFavorites = loadFavorites;
window.saveFavorites = saveFavorites;
window.clearFavorites = clearFavorites;
window.renderFavorites = renderFavorites;
window.toggleFavorite = toggleFavorite;
window.refreshFavoriteIndicators = refreshFavoriteIndicators;
window.insertFavoriteTag = insertFavoriteTag;
window.updateCopyHistory = updateCopyHistory;
window.renderCategoryPickerOptions = renderCategoryPickerOptions;
window.openCategoryPicker = openCategoryPicker;
window.closeCategoryPicker = closeCategoryPicker;
window.assignCategoryToTag = assignCategoryToTag;
window.showTokenSettings = showTokenSettings;
window.hideTokenSettings = hideTokenSettings;
window.saveToken = saveToken;
window.testToken = testToken;
window.updateTokenStatus = updateTokenStatus;
window.toggleSettingsPanel = toggleSettingsPanel;
