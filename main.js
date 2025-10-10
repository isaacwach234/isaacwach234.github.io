// Constants and Configuration
const GITHUB_USER = 'isaacwach234';
const GITHUB_REPO = 'isaacwach234.github.io';

const STORAGE_KEYS = {
    HIDDEN_CATEGORIES: 'danbooru-muted-categories',
    FAVORITES: 'danbooru-tag-favorites',
    THEME: 'danbooru-tag-helper-theme',
    HISTORY: 'danbooru-tag-history',
    HOWTO_OPEN: 'danbooru-howto-open',
    GITHUB_PAT: 'github-pat',
    UNDERSCORE_ENABLED: 'danbooru-underscore-enabled'
};

// Global State
let TAG_DATABASE = [];
let gitHubPat = null;
let tagCategorizer;
let tagIdCounter = 0;
let baseTags = [];
let copyHistory = [];
let selectedTagIds = new Set();
let sortableInstances = [];
let autocomplete = { active: false, index: -1, currentWord: '', suggestions: [] };
let hiddenCategories = new Set();
let knownCategories = new Set();
let favoriteTags = new Map();

const reduceMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const prefersReducedMotion = reduceMotionQuery ? reduceMotionQuery.matches : false;

// Utility Functions
const element = (id) => document.getElementById(id);

function debounce(fn, wait = 300) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(context, args), wait);
    };
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
});

async function initializeApp() {
    initializeToken();
    await loadExternalData();
    
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'theme-indigo';
    applyTheme(savedTheme);
    
    // Load underscore preference (default to FALSE)
    const savedUnderscorePref = localStorage.getItem(STORAGE_KEYS.UNDERSCORE_ENABLED);
    const underscoreToggle = element('underscoreToggle');
    if (underscoreToggle) {
        underscoreToggle.checked = savedUnderscorePref === 'true' ? true : false;
    }
    
    runEntranceAnimations();
    initializeHowToPanel();
    loadHiddenCategories();
    loadFavorites();
    renderFavorites();
    renderCategoryFilters();
    updateHiddenCategoriesBanner();
    loadHistory();
    setupEventListeners();
    
    processAll();
    updateCopyHistory(null);
    updateTokenStatus();
}

function setupEventListeners() {
    // Theme buttons
    document.querySelectorAll('.theme-button').forEach(btn => 
        btn.addEventListener('click', () => applyTheme(btn.dataset.theme))
    );
    
    // Processing inputs
    const processingInputs = [
        'swapsInput', 'implicationsInput', 'blacklistInput', 
        'triggerInput', 'appendInput', 'maxTagsInput'
    ];
    processingInputs.forEach(id => {
        const input = element(id);
        if (input) input.addEventListener('input', processAll);
    });
    
    // Tag input with debounce
    const tagInput = element('tagInput');
    if (tagInput) {
        const debouncedProcessing = debounce(processAll, 300);
        tagInput.addEventListener('input', debouncedProcessing);
        tagInput.addEventListener('change', processAll);
        tagInput.addEventListener('input', handleAutocompleteInput);
        tagInput.addEventListener('keydown', handleAutocompleteKeydown);
        tagInput.addEventListener('blur', () => setTimeout(hideAutocomplete, 150));
    }
    
    // Display toggles
    const displayInputs = [
        'deduplicateToggle', 'underscoreToggle', 
        'enableWeightingToggle', 'sortSelect'
    ];
    displayInputs.forEach(id => {
        const input = element(id);
        if (input) input.addEventListener('change', displayTags);
    });
    
    // Save underscore preference
    const underscoreToggle = element('underscoreToggle');
    if (underscoreToggle) {
        underscoreToggle.addEventListener('change', () => {
            localStorage.setItem(STORAGE_KEYS.UNDERSCORE_ENABLED, underscoreToggle.checked);
            renderFavorites();
        });
    }
    
    // Buttons
    const copyButton = element('copyButton');
    if (copyButton) copyButton.addEventListener('click', copyTagsToClipboard);
    
    const promptPreviewCopy = element('promptPreviewCopy');
    if (promptPreviewCopy) promptPreviewCopy.addEventListener('click', copyTagsToClipboard);
    
    const clearFavoritesButton = element('clearFavoritesButton');
    if (clearFavoritesButton) clearFavoritesButton.addEventListener('click', clearFavorites);
    
    const suggestBtn = element('suggest-btn');
    if (suggestBtn) suggestBtn.addEventListener('click', suggestCoherentTags);
    
    // Category picker
    const categoryPickerSearch = element('categoryPickerSearch');
    if (categoryPickerSearch) {
        categoryPickerSearch.addEventListener('input', () => 
            renderCategoryPickerOptions(categoryPickerSearch.value)
        );
    }
    
    const categoryPickerBackdrop = element('categoryPickerBackdrop');
    if (categoryPickerBackdrop) {
        categoryPickerBackdrop.addEventListener('click', closeCategoryPicker);
    }
    
    const categoryPickerClose = element('categoryPickerClose');
    if (categoryPickerClose) {
        categoryPickerClose.addEventListener('click', closeCategoryPicker);
    }
    
    // Escape key handler
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            const categoryPickerModal = element('categoryPickerModal');
            if (categoryPickerModal?.classList.contains('active')) {
                closeCategoryPicker();
            }
        }
    });
}

function loadHistory() {
    const savedHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (savedHistory) {
        try {
            copyHistory = JSON.parse(savedHistory);
        } catch (error) {
            console.warn('Failed to load history:', error);
            copyHistory = [];
        }
    }
}

// Export for use in other modules
window.app = {
    element,
    debounce,
    STORAGE_KEYS,
    getState: () => ({
        TAG_DATABASE,
        tagCategorizer,
        baseTags,
        hiddenCategories,
        knownCategories,
        favoriteTags
    })
};
