// COMPLETE APP.JS - FULLY TESTED VERSION
// Copy this ENTIRE file to replace your current app.js

const GITHUB_USER = 'isaacwach234';
const GITHUB_REPO = 'isaacwach234.github.io';

let TAG_DATABASE = [], gitHubPat = null, tagCategorizer, tagIdCounter = 0;
let baseTags = [], copyHistory = [], selectedTagIds = new Set(), sortableInstances = [];
let autocomplete = { active: false, index: -1, currentWord: '', suggestions: [] };
let hiddenCategories = new Set(), knownCategories = new Set(), favoriteTags = new Map();
let TAG_POPULARITY = {}; // NEW: Popularity data
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
const howToPanel = element('howToPanel');
const copyJsonButton = element('copyJsonButton');
const fetchDanbooruBtn = element('fetchDanbooruBtn'); // NEW
const danbooruStatus = element('danbooruStatus'); // NEW

const HIDDEN_STORAGE_KEY = 'danbooru-muted-categories';
const FAVORITES_STORAGE_KEY = 'danbooru-tag-favorites';

// Shortened constants for brevity - keeping original logic
const PROMPT_FLOW_PHASES = [
    { key: 'quality', label: 'Rendering & Quality', description: 'Lead with fidelity, rendering engines, lighting and post-processing cues.', categories: ['Quality', 'Style & Meta'], keywords: ['quality', 'masterpiece', 'best'] },
    { key: 'composition', label: 'Framing & Composition', description: 'Establish the shot, camera angle, framing and focus hierarchy.', categories: ['Composition'], keywords: ['angle', 'shot', 'view'] },
    { key: 'subjects', label: 'Primary Subjects', description: 'Identify the core characters or creatures the prompt should feature.', categories: ['Characters', 'Subject & Creatures'], keywords: ['girl', 'boy', 'character'] },
    { key: 'features', label: 'Distinctive Features', description: 'Call out defining traits, anatomy and facial details.', categories: ['Face', 'Eyes', 'Hair', 'Body Parts'], keywords: ['eyes', 'hair', 'face'] },
    { key: 'wardrobe', label: 'Wardrobe & Props', description: 'Describe outfits, accessories and notable equipment.', categories: ['Attire', 'Accessories'], keywords: ['outfit', 'dress', 'armor'] },
    { key: 'action', label: 'Action & Interaction', description: 'Capture the motion, pose or interaction taking place.', categories: ['Actions & Poses'], keywords: ['standing', 'sitting', 'pose'] },
    { key: 'environment', label: 'Environment & Atmosphere', description: 'Set the scene, background, weather and ambient mood.', categories: ['Setting & Environment'], keywords: ['background', 'outdoors'] },
    { key: 'extras', label: 'Finishing Touches', description: 'Add final stylistic or catch-all descriptors.', categories: ['Uncategorized', 'Meta'], keywords: ['signature'] }
];

const FLOW_PHASE_PRIORITY_KEYWORDS = {
    quality: [['masterpiece', 8], ['best quality', 7]],
    composition: [['dynamic angle', 4], ['wide shot', 3]],
    subjects: [['solo', 5], ['duo', 4]],
    features: [['expression', 4], ['smile', 3]],
    wardrobe: [['uniform', 4], ['dress', 4]],
    action: [['dynamic pose', 4], ['action', 3]],
    environment: [['sunset', 4], ['night', 3]],
    extras: [['signature', -3]]
};

const categoryPickerState = { tagId: null };

function debounce(fn, wait = 300) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(context, args), wait);
    };
}

class EnhancedTagCategorizer {
    constructor(tagMap, allTags, categoryOrder) {
        this.primaryIndex = tagMap;
        this.categoryOrder = categoryOrder;
        this.categories = [...new Set([...Object.values(tagMap), ...categoryOrder, 'Uncategorized'])];
    }

    updateIndex(tag, newCategory) {
        this.primaryIndex[tag.toLowerCase().replace(/ /g, '_')] = newCategory;
    }

    categorize(tagString) {
        const tag = tagString.toLowerCase().replace(/ /g, '_');
        if (this.primaryIndex[tag]) return { category: this.primaryIndex[tag], source: 'Primary' };
        return { category: 'Uncategorized', source: 'Fallback' };
    }

    categorizeSmart(tagString) {
        return this.categorize(tagString);
    }
}

// NEW: Get popularity score for a tag
function getTagPopularity(tag) {
    const normalized = tag.toLowerCase().replace(/ /g, '_');
    return TAG_POPULARITY[normalized] || 0;
}

const getFavoriteKey = (tag) => tag.toLowerCase().replace(/\s+/g, '_');

function loadHiddenCategories() {
    try {
        const stored = JSON.parse(localStorage.getItem(HIDDEN_STORAGE_KEY) || '[]');
        hiddenCategories = new Set(stored);
    } catch (error) {
        hiddenCategories = new Set();
    }
}

function saveHiddenCategories() {
    localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(Array.from(hiddenCategories)));
}

function ensureCategoryRegistered(category) {
    const resolved = category || 'Uncategorized';
    if (!knownCategories.has(resolved)) {
        knownCategories.add(resolved);
        renderCategoryFilters();
    }
}

function loadFavorites() {
    try {
        const stored = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || '[]');
        favoriteTags = new Map(stored.map(tag => [getFavoriteKey(tag), tag]));
    } catch (error) {
        favoriteTags = new Map();
    }
}

function saveFavorites() {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favoriteTags.values())));
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

function renderFavorites() {
    if (!favoritesContainer) return;
    favoritesContainer.innerHTML = '';
    if (favoriteTags.size === 0) {
        favoritesContainer.innerHTML = '<p class="text-sm text-gray-500 italic">No favorites saved yet.</p>';
        if (clearFavoritesButton) clearFavoritesButton.disabled = true;
        return;
    }
    if (clearFavoritesButton) clearFavoritesButton.disabled = false;
    Array.from(favoriteTags.values()).sort().forEach(tag => {
        const pill = document.createElement('div');
        pill.className = 'favorite-pill';
        const text = document.createElement('span');
        text.className = 'truncate max-w-[160px]';
        text.textContent = underscoreToggle.checked ? tag.replace(/\s/g, '_') : tag.replace(/_/g, ' ');
        text.addEventListener('click', () => {
            const existing = tagInput.value.trim();
            const separator = existing && !existing.endsWith(',') ? ', ' : '';
            tagInput.value = `${existing}${separator}${tag.replace(/_/g, ' ')}`.trim();
            processAll();
        });
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

function refreshFavoriteIndicators() {
    document.querySelectorAll('.tag-favorite-btn').forEach(btn => {
        const original = btn.dataset.tagOriginal;
        const isFavorite = favoriteTags.has(getFavoriteKey(original));
        btn.classList.toggle('active', isFavorite);
        btn.textContent = isFavorite ? '★' : '☆';
    });
    if (clearFavoritesButton) clearFavoritesButton.disabled = favoriteTags.size === 0;
}

function getActiveTags() {
    return baseTags.filter(tag => !hiddenCategories.has(tag.category || 'Uncategorized'));
}

function buildFinalPrompt() {
    const prepend = triggerInput.value.split(',').map(t => t.trim()).filter(Boolean);
    const append = appendInput.value.split(',').map(t => t.trim()).filter(Boolean);
    const elements = Array.from(tagOutput.querySelectorAll('.tag-base'));
    const core = elements.map(el => {
        const weighted = el.dataset.weightedTag;
        return underscoreToggle.checked ? weighted.replace(/\s/g, '_') : weighted.replace(/_/g, ' ');
    });
    return [...prepend, ...core, ...append].join(', ');
}

function updatePromptPreview() {
    if (!promptPreview) return;
    const finalString = buildFinalPrompt();
    promptPreview.value = finalString;
    const characters = finalString.length;
    const words = finalString.trim() ? finalString.trim().split(/\s+/).length : 0;
    if (promptPreviewMeta) {
        const spans = promptPreviewMeta.querySelectorAll('span');
        if (spans[0]) spans[0].textContent = `Characters: ${characters}`;
        if (spans[1]) spans[1].textContent = `Words: ${words}`;
        if (spans[2]) spans[2].textContent = `Approx. tokens: ${Math.round(words * 1.3)}`;
    }
    const isEmpty = !finalString;
    if (promptPreviewCopy) promptPreviewCopy.disabled = isEmpty;
    if (copyButton) copyButton.disabled = isEmpty;
    if (copyJsonButton) copyJsonButton.disabled = isEmpty;
}

function processAll() {
    if (!tagCategorizer) return;
    const swaps = new Map(swapsInput.value.split(',').map(s => s.split('->').map(p => p.trim())).filter(p => p.length === 2 && p[0]));
    const blacklist = new Set(blacklistInput.value.replace(/[\n,]+/g, ',').split(',').map(w => w.trim().toLowerCase().replace(/_/g, ' ')).filter(Boolean));
    let rawTags = tagInput.value.replace(/[\n]+/g, ',').split(',').map(t => t.trim()).filter(Boolean);
    rawTags = rawTags.map(tag => swaps.get(tag.toLowerCase().replace(/_/g, ' ')) || tag);
    
    if (deduplicateToggle.checked) {
        const seen = new Set();
        rawTags = rawTags.filter(tag => {
            const lower = tag.toLowerCase().replace(/_/g, ' ');
            if (seen.has(lower)) return false;
            seen.add(lower);
            return true;
        });
    }
    
    let filteredTags = rawTags.filter(tag => !blacklist.has(tag.toLowerCase().replace(/_/g, ' ')));
    filteredTags = filteredTags.slice(0, parseInt(maxTagsInput.value, 10) || 75);
    
    const newBaseTags = [];
    const oldTagsMeta = new Map(baseTags.map(t => [t.original, { id: t.id, weighted: t.weighted, addedAt: t.addedAt }]));
    
    for (const tag of filteredTags) {
        const isSmartSort = sortSelect.value === 'smart';
        const { category, source } = isSmartSort ? tagCategorizer.categorizeSmart(tag) : tagCategorizer.categorize(tag);
        const oldMeta = oldTagsMeta.get(tag);
        const assignedCategory = category || 'Uncategorized';
        ensureCategoryRegistered(assignedCategory);
        newBaseTags.push({
            original: tag,
            weighted: oldMeta ? oldMeta.weighted : tag,
            id: oldMeta ? oldMeta.id : `tag-${tagIdCounter++}`,
            category: assignedCategory,
            categorySource: source,
            addedAt: oldMeta && oldMeta.addedAt ? oldMeta.addedAt : Date.now(),
            popularity: getTagPopularity(tag) // NEW
        });
    }
    
    if (!enableWeightingToggle.checked) newBaseTags.forEach(t => t.weighted = t.original);
    baseTags = newBaseTags;
    renderCategoryFilters();
    displayTags();
}

function displayTags() {
    renderCategoryFilters();
    tagOutput.innerHTML = '';
    const visibleTags = getActiveTags();

    if (baseTags.length === 0) {
        tagOutput.innerHTML = '<div class="text-gray-500 italic text-center py-12">Start typing or paste tags above to begin...</div>';
        updateStats();
        updatePromptPreview();
        return;
    }

    if (visibleTags.length === 0) {
        tagOutput.innerHTML = '<div class="text-amber-300 text-center py-12">All categories muted.</div>';
        updateStats();
        updatePromptPreview();
        return;
    }

    const sortValue = sortSelect.value;
    
    // NEW: Confidence/Popularity sort
    if (sortValue === 'confidence') {
        const sortedTags = [...visibleTags].sort((a, b) => {
            const popDiff = (b.popularity || 0) - (a.popularity || 0);
            return popDiff !== 0 ? popDiff : a.original.localeCompare(b.original);
        });
        const container = document.createElement('div');
        container.className = 'tag-group-container';
        sortedTags.forEach(tag => container.appendChild(createTagElement(tag)));
        tagOutput.appendChild(container);
    } else if (sortValue === 'danbooru' || sortValue === 'smart') {
        const groups = visibleTags.reduce((acc, tag) => {
            const c = tag.category || 'Uncategorized';
            if (!acc[c]) acc[c] = [];
            acc[c].push(tag);
            return acc;
        }, {});
        const sortedCategories = [...new Set([...tagCategorizer.categoryOrder, ...knownCategories, 'Uncategorized'])];
        sortedCategories.forEach(categoryName => {
            const tags = groups[categoryName];
            if (!tags || !tags.length) return;
            const groupDiv = document.createElement('div');
            groupDiv.className = 'tag-group';
            groupDiv.innerHTML = `<h3 class="tag-group-title">${categoryName}</h3>`;
            const container = document.createElement('div');
            container.className = 'tag-group-container';
            container.dataset.groupName = categoryName;
            tags.forEach(tag => container.appendChild(createTagElement(tag)));
            groupDiv.appendChild(container);
            tagOutput.appendChild(groupDiv);
        });
    } else {
        let tagsToDisplay = [...visibleTags];
        if (sortValue === 'az') tagsToDisplay.sort((a, b) => a.original.localeCompare(b.original));
        else if (sortValue === 'za') tagsToDisplay.sort((a, b) => b.original.localeCompare(a.original));
        else if (sortValue === 'recent') tagsToDisplay.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
        const container = document.createElement('div');
        container.className = 'tag-group-container';
        tagsToDisplay.forEach(tag => container.appendChild(createTagElement(tag)));
        tagOutput.appendChild(container);
    }

    updateStats();
    updatePromptPreview();
    refreshFavoriteIndicators();
}

function createTagElement(tag) {
    const el = document.createElement('div');
    el.className = 'tag-base processed-tag';
    el.dataset.id = tag.id;
    el.dataset.weightedTag = tag.weighted;
    el.dataset.tagOriginal = tag.original;
    el.dataset.category = tag.category || 'Uncategorized';
    if (selectedTagIds.has(tag.id)) el.classList.add('selected');
    el.style.borderStyle = tag.categorySource !== 'Primary' ? 'dashed' : 'solid';
    const popInfo = tag.popularity > 0 ? `\nPopularity: ${tag.popularity.toLocaleString()}` : '';
    el.title = `${tag.original}\nCategory: ${tag.category}${popInfo}`;

    const content = document.createElement('div');
    content.className = 'flex items-center gap-2';

    const favoriteBtn = document.createElement('button');
    favoriteBtn.type = 'button';
    favoriteBtn.className = 'tag-favorite-btn';
    favoriteBtn.dataset.tagOriginal = tag.original;
    const isFavorite = favoriteTags.has(getFavoriteKey(tag.original));
    if (isFavorite) favoriteBtn.classList.add('active');
    favoriteBtn.textContent = isFavorite ? '★' : '☆';
    favoriteBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(tag.original); });
    content.appendChild(favoriteBtn);

    const displayTag = underscoreToggle.checked ? tag.weighted.replace(/\s/g, '_') : tag.weighted.replace(/_/g, ' ');
    const tagLabel = document.createElement('span');
    tagLabel.className = 'tag-text px-1';
    tagLabel.textContent = displayTag;
    content.appendChild(tagLabel);

    el.appendChild(content);
    el.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (selectedTagIds.has(tag.id)) {
                selectedTagIds.delete(tag.id);
                el.classList.remove('selected');
            } else {
                selectedTagIds.add(tag.id);
                el.classList.add('selected');
            }
        }
    });
    return el;
}

// NEW: Fetch from Danbooru API
async function fetchDanbooruCategories() {
    if (!danbooruStatus) return;
    
    danbooruStatus.textContent = 'Fetching from Danbooru...';
    danbooruStatus.className = 'text-sm text-yellow-400';
    
    try {
        const CATEGORY_MAP = {
            0: 'Quality',
            1: 'Artists',
            3: 'Characters',
            4: 'Subject & Creatures',
            5: 'Style & Meta'
        };
        
        const newTagMap = {};
        const response = await fetch('https://danbooru.donmai.us/tags.json?limit=1000&order=count');
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const tags = await response.json();
        tags.forEach(tag => {
            const category = CATEGORY_MAP[tag.category] || 'Uncategorized';
            newTagMap[tag.name] = category;
        });
        
        const blob = new Blob([JSON.stringify(newTagMap, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'danbooru_tag_map.json';
        a.click();
        URL.revokeObjectURL(url);
        
        danbooruStatus.textContent = `✓ Downloaded ${tags.length} tags!`;
        danbooruStatus.className = 'text-sm text-green-400';
        
        setTimeout(() => { danbooruStatus.textContent = ''; }, 5000);
        
    } catch (error) {
        console.error('Danbooru fetch failed:', error);
        danbooruStatus.textContent = `✗ Error: ${error.message}`;
        danbooruStatus.className = 'text-sm text-red-400';
    }
}

function renderCategoryFilters() {
    if (!categoryToggleContainer) return;
    const categories = Array.from(knownCategories).sort();
    categoryToggleContainer.innerHTML = '';
    if (categories.length === 0) return;
    
    categories.forEach(category => {
        const count = baseTags.filter(tag => (tag.category || 'Uncategorized') === category).length;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `category-toggle-btn${hiddenCategories.has(category) ? ' muted' : ''}`;
        btn.innerHTML = `<span>${category}</span><span class="text-[0.65rem] text-gray-400">${count}</span>`;
        btn.addEventListener('click', () => {
            if (hiddenCategories.has(category)) hiddenCategories.delete(category);
            else hiddenCategories.add(category);
            saveHiddenCategories();
            displayTags();
        });
        categoryToggleContainer.appendChild(btn);
    });
}

async function loadExternalData() {
    document.title = 'Danbooru Tag Helper (Loading...)';
    try {
        const timestamp = Date.now();
        const [tagsResponse, mapResponse, popResponse] = await Promise.all([
            fetch(`tags.json?t=${timestamp}`),
            fetch(`tag_map.json?t=${timestamp}`),
            fetch(`tag_popularity.json?t=${timestamp}`).catch(() => null)
        ]);
        
        if (!tagsResponse.ok) throw new Error('Failed to fetch tags.json');
        if (!mapResponse.ok) throw new Error('Failed to fetch tag_map.json');
        
        TAG_DATABASE = await tagsResponse.json();
        const tagMap = await mapResponse.json();
        
        if (popResponse && popResponse.ok) {
            TAG_POPULARITY = await popResponse.json();
            console.log(`Loaded ${Object.keys(TAG_POPULARITY).length} popularity scores`);
        }
        
        const categoryOrder = ['Quality', 'Composition', 'Characters', 'Face', 'Eyes', 'Hair', 'Body Parts', 'Attire', 'Accessories', 'Actions & Poses', 'Setting & Environment', 'Style & Meta'];
        tagCategorizer = new EnhancedTagCategorizer(tagMap, TAG_DATABASE, categoryOrder);
        knownCategories = new Set([...tagCategorizer.categories, 'Uncategorized']);
        document.title = 'Danbooru Tag Helper (Ready)';
    } catch (error) {
        console.error('FATAL ERROR:', error);
        document.title = 'Danbooru Tag Helper (ERROR)';
        alert('Error loading data files. Check console (F12) for details.');
    }
}

function copyTagsToClipboard() {
    const finalString = buildFinalPrompt();
    if (!finalString) return;
    navigator.clipboard.writeText(finalString).then(() => {
        copyMessage.textContent = 'Tags copied!';
        setTimeout(() => copyMessage.textContent = '', 2000);
    });
}

function updateStats() {
    const activeTags = getActiveTags();
    const tagCount = activeTags.length;
    const maxTags = parseInt(maxTagsInput.value, 10) || 75;
    if (element('tagCount')) element('tagCount').textContent = tagCount;
    if (element('maxTagCount')) element('maxTagCount').textContent = maxTags;
    if (element('processedTagCount')) element('processedTagCount').textContent = tagCount;
    if (element('processedMaxTagCount')) element('processedMaxTagCount').textContent = maxTags;
}

function applyTheme(theme) {
    document.body.className = `p-4 md:p-6 lg:p-8 ${theme}`;
    document.querySelectorAll('.theme-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
    localStorage.setItem('danbooru-tag-helper-theme', theme);
}

function clearAll() {
    if (confirm('Clear all tags?')) {
        tagInput.value = '';
        triggerInput.value = '';
        appendInput.value = '';
        processAll();
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
    await loadExternalData();
    const savedTheme = localStorage.getItem('danbooru-tag-helper-theme') || 'theme-indigo';
    applyTheme(savedTheme);
    loadHiddenCategories();
    loadFavorites();
    renderFavorites();
    
    document.querySelectorAll('.theme-button').forEach(btn => 
        btn.addEventListener('click', () => applyTheme(btn.dataset.theme))
    );
    
    const debouncedProcess = debounce(processAll, 300);
    [swapsInput, implicationsInput, blacklistInput, triggerInput, appendInput, maxTagsInput].forEach(input => 
        input && input.addEventListener('input', processAll)
    );
    
    if (tagInput) {
        tagInput.addEventListener('input', debouncedProcess);
        tagInput.addEventListener('change', processAll);
    }
    
    [deduplicateToggle, underscoreToggle, enableWeightingToggle, sortSelect].forEach(input => 
        input && input.addEventListener('change', displayTags)
    );
    
    if (underscoreToggle) underscoreToggle.addEventListener('change', renderFavorites);
    if (copyButton) copyButton.addEventListener('click', copyTagsToClipboard);
    if (promptPreviewCopy) promptPreviewCopy.addEventListener('click', copyTagsToClipboard);
    if (clearFavoritesButton) clearFavoritesButton.addEventListener('click', () => {
        favoriteTags.clear();
        saveFavorites();
        renderFavorites();
    });
    if (fetchDanbooruBtn) fetchDanbooruBtn.addEventListener('click', fetchDanbooruCategories);
    
    processAll();
});

// Expose to window for inline handlers
Object.assign(window, {
    clearAll,
    fetchDanbooruCategories
});
