// NOTE: This is the original JavaScript from your HTML file, refactored and enhanced.
// I have added comments with "// NEW:" to show the new features.

const GITHUB_USER = 'isaacwach234';
const GITHUB_REPO = 'isaacwach234.github.io';

let TAG_DATABASE = [], gitHubPat = null, tagCategorizer, tagIdCounter = 0;
let baseTags = [], copyHistory = [], selectedTagIds = new Set(), sortableInstances = [];
let autocomplete = { active: false, index: -1, currentWord: '', suggestions: [] };
let hiddenCategories = new Set(), knownCategories = new Set(), favoriteTags = new Map();
const reduceMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const prefersReducedMotion = reduceMotionQuery ? reduceMotionQuery.matches : false;

const element = (id) => document.getElementById(id);
const body = document.body, tagInput = element('tagInput'), swapsInput = element('swapsInput'), implicationsInput = element('implicationsInput'), blacklistInput = element('blacklistInput'), triggerInput = element('triggerInput'), appendInput = element('appendInput');
const deduplicateToggle = element('deduplicateToggle'), underscoreToggle = element('underscoreToggle'), enableWeightingToggle = element('enableWeightingToggle');
const sortSelect = element('sortSelect'), maxTagsInput = element('maxTagsInput'), tagOutput = element('tagOutput');
const copyButton = element('copyButton'), copyMessage = element('copyMessage'), historyContainer = element('history-container'), autocompleteBox = element('autocomplete-box');
const suggestBtn = element('suggest-btn'), themeButtons = document.querySelectorAll('.theme-button'), suggestionCountInput = element('suggestionCountInput');
const categoryToggleContainer = element('categoryToggleContainer'), hiddenCategoriesBanner = element('hiddenCategoriesBanner');
const favoritesContainer = element('favorites-container'), clearFavoritesButton = element('clearFavoritesButton');
const promptPreview = element('promptPreview'), promptPreviewMeta = element('promptPreviewMeta'), promptPreviewCopy = element('promptPreviewCopy');
const ratingSafe = element('rating-safe'), ratingGeneral = element('rating-general'), ratingQuestionable = element('rating-questionable');
const categoryPickerModal = element('categoryPickerModal'), categoryPickerList = element('categoryPickerList');
const categoryPickerTitle = element('categoryPickerTitle'), categoryPickerSearch = element('categoryPickerSearch');
const categoryPickerBackdrop = element('categoryPickerBackdrop'), categoryPickerClose = element('categoryPickerClose');

const HIDDEN_STORAGE_KEY = 'danbooru-muted-categories';
const FAVORITES_STORAGE_KEY = 'danbooru-tag-favorites';

// ... (All your existing constants and functions like PROMPT_FLOW_PHASES, etc. go here) ...
// Due to the character limit, I cannot include the entire original script here.
// I will continue the code below with the NEW features and a note on where to place the old code.

// --- START OF YOUR ORIGINAL JS CODE ---
// [PASTE ALL OF YOUR ORIGINAL JAVASCRIPT CODE HERE, from the line "const PROMPT_FLOW_PHASES = [" all the way to the end of the file.]
// --- END OF YOUR ORIGINAL JS CODE ---


// ===================================================================
// NEW FEATURES AND MODIFICATIONS ARE BELOW
// ===================================================================

// NEW: Debounce function to improve performance
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// NEW: Toggle "How to Use" section
function toggleHowToUse() {
    const content = element('how-to-use-content');
    const icon = element('how-to-use-icon');
    content.classList.toggle('hidden');
    icon.classList.toggle('fa-chevron-down');
    icon.classList.toggle('fa-chevron-up');
}

// MODIFIED: Wrap the main processTags call with the debounce function
// Find the line that looks like this in your original code:
// tagInput.addEventListener('input', processTags);
// And replace it with the following line:
tagInput.addEventListener('input', debounce(processTags, 300));


// MODIFIED: Enhanced exportSettings function
function exportSettings() {
    const format = document.querySelector('input[name="exportFormat"]:checked').value;
    let dataStr, dataFileName, dataType;

    if (format === 'txt') {
        // Export as plain text
        const finalTags = getFinalTagsForCopy();
        dataStr = finalTags.join(', ');
        dataFileName = 'danbooru-tags.txt';
        dataType = 'text/plain';
    } else {
        // Original JSON export logic
        const settings = {
            trigger: triggerInput.value,
            append: appendInput.value,
            swaps: swapsInput.value,
            implications: implicationsInput.value,
            blacklist: blacklistInput.value,
            deduplicate: deduplicateToggle.checked,
            underscores: underscoreToggle.checked,
            weighting: enableWeightingToggle.checked,
            sort: sortSelect.value,
            maxTags: maxTagsInput.value,
            hiddenCategories: Array.from(hiddenCategories),
            favorites: Array.from(favoriteTags.entries())
        };
        dataStr = JSON.stringify(settings, null, 2);
        dataFileName = 'danbooru-settings.json';
        dataType = 'application/json';
    }

    const dataBlob = new Blob([dataStr], { type: dataType });
    const url = URL.createObjectURL(dataBlob);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', url);
    linkElement.setAttribute('download', dataFileName);
    linkElement.click();
    URL.revokeObjectURL(url);
}

// MODIFIED: Enhanced importSettings function
function importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    const fileType = file.name.endsWith('.txt') ? 'txt' : 'json';

    reader.onload = function(e) {
        const content = e.target.result;
        if (fileType === 'txt') {
            // If it's a text file, treat it as a list of tags
            tagInput.value = content;
            processTags(); // Process the newly added tags
        } else {
            // Original JSON import logic
            try {
                const settings = JSON.parse(content);
                triggerInput.value = settings.trigger || '';
                appendInput.value = settings.append || '';
                swapsInput.value = settings.swaps || '';
                implicationsInput.value = settings.implications || '';
                blacklistInput.value = settings.blacklist || '';
                deduplicateToggle.checked = settings.deduplicate !== false;
                underscoreToggle.checked = settings.underscores !== false;
                enableWeightingToggle.checked = settings.weighting || false;
                sortSelect.value = settings.sort || 'danbooru';
                maxTagsInput.value = settings.maxTags || 75;
                hiddenCategories = new Set(settings.hiddenCategories || []);
                favoriteTags = new Map(settings.favorites || []);
                saveFavoritesToStorage();
                processTags();
            } catch (err) {
                alert('Failed to import settings. Please ensure the file is a valid JSON or TXT file.');
            }
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Clear the file input
}

// IMPORTANT: Make sure to call initializeApp() at the end of your script to start everything.
// If your original script already has an initialization block, you can merge this.
function initializeApp() {
    // ... (any other initial setup from your original script) ...
    loadFavoritesFromStorage();
    processTags();
}

// Start the application when the DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
      
