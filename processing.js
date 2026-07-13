const { element, STORAGE_KEYS } = window.app || {};
const promptFlow = window.promptFlow || {};

const tagInput = element('tagInput');
const triggerInput = element('triggerInput');
const appendInput = element('appendInput');
const swapsInput = element('swapsInput');
const implicationsInput = element('implicationsInput');
const blacklistInput = element('blacklistInput');
const deduplicateToggle = element('deduplicateToggle');
const underscoreToggle = element('underscoreToggle');
const enableWeightingToggle = element('enableWeightingToggle');
const sortSelect = element('sortSelect');
const maxTagsInput = element('maxTagsInput');
const suggestionCountInput = element('suggestionCountInput');
const copyButton = element('copyButton');
const copyMessage = element('copyMessage');
const promptPreview = element('promptPreview');
const promptPreviewMeta = element('promptPreviewMeta');
const promptPreviewCopy = element('promptPreviewCopy');
const copyJsonButton = element('copyJsonButton');
const ratingSafe = element('rating-safe');
const ratingGeneral = element('rating-general');
const ratingQuestionable = element('rating-questionable');
const tagOutput = element('tagOutput');
const autocompleteBox = element('autocomplete-box');
const historyContainer = element('history-container');

const reduceMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const prefersReducedMotion = reduceMotionQuery ? reduceMotionQuery.matches : false;

function parseSwapEntries(raw) {
    if (!raw) return new Map();
    return new Map(
        raw
            .split(',')
            .map(entry => entry.split('->').map(piece => piece.trim()))
            .filter(parts => parts.length === 2 && parts[0])
            .map(([source, target]) => [source.toLowerCase().replace(/_/g, ' '), target])
    );
}

function parseImplicationEntries(raw) {
    if (!raw) return new Map();
    return new Map(
        raw
            .split(',')
            .map(entry => entry.split('=>').map(piece => piece.trim()))
            .filter(parts => parts.length === 2 && parts[0])
            .map(([source, implied]) => [
                source.toLowerCase().replace(/_/g, ' '),
                implied
                    .split(/\n|,/)
                    .map(tag => tag.trim())
                    .filter(Boolean)
            ])
    );
}

function parseBlacklistEntries(raw) {
    if (!raw) return new Set();
    return new Set(
        raw
            .replace(/[\n,]+/g, ',')
            .split(',')
            .map(tag => tag.trim().toLowerCase().replace(/_/g, ' '))
            .filter(Boolean)
    );
}

function splitTagInput(raw) {
    if (!raw) return [];
    return raw
        .replace(/[\n]+/g, ',')
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean);
}

function applySwaps(tags, swaps) {
    if (!swaps.size) return tags;
    return tags.map(tag => swaps.get(tag.toLowerCase().replace(/_/g, ' ')) || tag);
}

function applyImplications(tags, implications) {
    if (!implications.size) return tags;
    const result = [...tags];
    const additions = new Set();

    tags.forEach(tag => {
        const normalized = tag.toLowerCase().replace(/_/g, ' ');
        if (!implications.has(normalized)) return;
        implications.get(normalized).forEach(implication => {
            if (implication) additions.add(implication.trim());
        });
    });

    return [...result, ...Array.from(additions)];
}

function deduplicateTags(tags) {
    const seen = new Set();
    const deduped = [];

    tags.forEach(tag => {
        const key = tag.toLowerCase().replace(/_/g, ' ');
        if (seen.has(key)) return;
        seen.add(key);
        deduped.push(tag);
    });

    return deduped;
}

function filterBlacklisted(tags, blacklist) {
    if (!blacklist.size) return tags;
    return tags.filter(tag => !blacklist.has(tag.toLowerCase().replace(/_/g, ' ')));
}

function limitTags(tags) {
    const limit = parseInt(maxTagsInput?.value, 10) || 75;
    return tags.slice(0, limit);
}

function categorizeTag(tag, sortMode) {
    const categorizer = window.tagCategorizer;
    if (!categorizer) {
        return { category: 'Uncategorized', source: 'Fallback' };
    }

    if (sortMode === 'smart' && typeof categorizer.categorizeSmart === 'function') {
        return categorizer.categorizeSmart(tag);
    }

    return categorizer.categorize(tag);
}

function rebuildBaseTags(processedTags) {
    const ensureCategoryRegistered = window.ensureCategoryRegistered;
    const previousMeta = new Map(
        (window.baseTags || []).map(tag => [tag.original, {
            id: tag.id,
            weighted: tag.weighted,
            addedAt: tag.addedAt
        }])
    );

    const updated = processedTags.map(tag => {
        const sortMode = sortSelect?.value;
        const meta = categorizeTag(tag, sortMode);
        const oldMeta = previousMeta.get(tag);
        const category = meta?.category || 'Uncategorized';

        if (typeof ensureCategoryRegistered === 'function') {
            ensureCategoryRegistered(category);
        }

        return {
            original: tag,
            weighted: oldMeta ? oldMeta.weighted : tag,
            id: oldMeta ? oldMeta.id : `tag-${window.tagIdCounter++}`,
            category,
            categorySource: meta?.source || 'Fallback',
            addedAt: oldMeta?.addedAt || Date.now()
        };
    });

    if (!enableWeightingToggle?.checked) {
        updated.forEach(tag => { tag.weighted = tag.original; });
    }

    window.baseTags = updated;
}

function getActiveTags() {
    const hidden = window.hiddenCategories || new Set();
    return (window.baseTags || []).filter(tag => !hidden.has(tag.category || 'Uncategorized'));
}

function getProcessedTagElements() {
    return Array.from(tagOutput?.querySelectorAll('.tag-base') || []);
}

function getProcessedTagsForOutput() {
    return getProcessedTagElements().map(element => {
        const weighted = element.dataset.weightedTag || '';
        return underscoreToggle?.checked
            ? weighted.replace(/\s/g, '_')
            : weighted.replace(/_/g, ' ');
    });
}

function getPromptParts() {
    const prepend = (triggerInput?.value || '')
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean);

    const append = (appendInput?.value || '')
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean);

    const core = getProcessedTagsForOutput();
    return { prepend, core, append };
}

function buildFinalPrompt() {
    const { prepend, core, append } = getPromptParts();
    return [...prepend, ...core, ...append].join(', ');
}

function estimateTokenCount(text) {
    if (!text || !text.trim()) return 0;
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(words, Math.round(words * 1.3));
}

function updatePromptPreview() {
    if (!promptPreview) return;

    const prompt = buildFinalPrompt();
    promptPreview.value = prompt;

    const characters = prompt.length;
    const words = prompt.trim() ? prompt.trim().split(/\s+/).filter(Boolean).length : 0;
    const tokens = estimateTokenCount(prompt);

    if (promptPreviewMeta) {
        const [charsEl, wordsEl, tokensEl] = promptPreviewMeta.querySelectorAll('span');
        if (charsEl) charsEl.textContent = `Characters: ${characters}`;
        if (wordsEl) wordsEl.textContent = `Words: ${words}`;
        if (tokensEl) tokensEl.textContent = `Approx. tokens: ${tokens}`;
    }

    const isEmpty = prompt.length === 0;
    if (promptPreviewCopy) promptPreviewCopy.disabled = isEmpty;
    if (copyButton) copyButton.disabled = isEmpty;
    if (copyJsonButton) copyJsonButton.disabled = isEmpty;
}

function updateStats() {
    const activeTags = getActiveTags();
    const count = activeTags.length;
    const max = parseInt(maxTagsInput?.value, 10) || 75;
    const categoryCount = new Set(activeTags.map(tag => tag.category)).size;
    const historyCount = (window.copyHistory || []).length;

    element('tagCount').textContent = count;
    element('maxTagCount').textContent = max;
    element('categoryCount').textContent = categoryCount;
    element('historyCount').textContent = historyCount;
    element('processedTagCount').textContent = count;
    element('processedMaxTagCount').textContent = max;

    const tagCountEl = element('tagCount');
    const percentage = max ? (count / max) * 100 : 0;
    if (percentage > 90) {
        tagCountEl.style.color = '#ef4444';
    } else if (percentage > 75) {
        tagCountEl.style.color = '#f59e0b';
    } else {
        tagCountEl.style.color = 'var(--accent-color)';
    }
}

function animateTagGroups() {
    if (!window.gsap || prefersReducedMotion) return;

    window.gsap.killTweensOf('.tag-group');
    window.gsap.killTweensOf('.tag-group .tag-base');

    window.gsap.from('.tag-group', {
        opacity: 0,
        y: 24,
        duration: 0.45,
        ease: 'power2.out',
        stagger: 0.08,
        overwrite: 'auto'
    });

    window.gsap.from('.tag-group .tag-base', {
        opacity: 0,
        y: 12,
        duration: 0.3,
        ease: 'power1.out',
        stagger: 0.01,
        overwrite: 'auto'
    });
}

function createTagElement(tag) {
    const elementRoot = document.createElement('div');
    elementRoot.className = 'tag-base processed-tag';
    elementRoot.dataset.id = tag.id;
    elementRoot.dataset.weightedTag = tag.weighted;
    elementRoot.dataset.tagOriginal = tag.original;
    elementRoot.dataset.category = tag.category || 'Uncategorized';

    if ((window.selectedTagIds || new Set()).has(tag.id)) {
        elementRoot.classList.add('selected');
    }

    elementRoot.style.borderStyle = tag.categorySource !== 'Primary' ? 'dashed' : 'solid';
    elementRoot.title = `(${tag.categorySource}) ${tag.original}\nCategory: ${tag.category}\n\nCtrl+Click to multi-select.\nRight-click for options.`;

    const content = document.createElement('div');
    content.className = 'flex items-center gap-2';

    const favoriteBtn = document.createElement('button');
    favoriteBtn.type = 'button';
    favoriteBtn.className = 'tag-favorite-btn';
    favoriteBtn.dataset.tagOriginal = tag.original;

    const favorites = window.favoriteTags || new Map();
    const key = tag.original.toLowerCase().replace(/\s+/g, '_');
    if (favorites.has(key)) {
        favoriteBtn.classList.add('active');
        favoriteBtn.textContent = '★';
    } else {
        favoriteBtn.textContent = '☆';
    }

    favoriteBtn.addEventListener('click', event => {
        event.stopPropagation();
        window.toggleFavorite?.(tag.original);
    });

    content.appendChild(favoriteBtn);

    const controls = document.createElement('div');
    controls.className = 'flex items-center gap-1';
    const useUnderscores = !!underscoreToggle?.checked;
    const displayTag = useUnderscores
        ? tag.weighted.replace(/\s/g, '_')
        : tag.weighted.replace(/_/g, ' ');

    if (enableWeightingToggle?.checked) {
        const decreaseBtn = document.createElement('button');
        decreaseBtn.type = 'button';
        decreaseBtn.className = 'tag-weight-btn';
        decreaseBtn.textContent = '-';
        decreaseBtn.addEventListener('click', event => {
            event.stopPropagation();
            updateTagWeight(tag.id, 'decrease');
        });

        const tagLabel = document.createElement('span');
        tagLabel.className = 'tag-text px-1';
        tagLabel.textContent = displayTag;

        const increaseBtn = document.createElement('button');
        increaseBtn.type = 'button';
        increaseBtn.className = 'tag-weight-btn';
        increaseBtn.textContent = '+';
        increaseBtn.addEventListener('click', event => {
            event.stopPropagation();
            updateTagWeight(tag.id, 'increase');
        });

        controls.appendChild(decreaseBtn);
        controls.appendChild(tagLabel);
        controls.appendChild(increaseBtn);
    } else {
        const tagLabel = document.createElement('span');
        tagLabel.className = 'tag-text';
        tagLabel.textContent = displayTag;
        controls.appendChild(tagLabel);
    }

    content.appendChild(controls);

    const quickActions = document.createElement('div');
    quickActions.className = 'flex items-center gap-1';

    const categoryBtn = document.createElement('button');
    categoryBtn.type = 'button';
    categoryBtn.className = 'tag-category-btn';
    categoryBtn.title = 'Assign category';
    categoryBtn.setAttribute('aria-label', 'Assign category');
    categoryBtn.textContent = '🗂';
    categoryBtn.addEventListener('click', event => {
        event.stopPropagation();
        window.openCategoryPicker?.(tag.id);
    });

    quickActions.appendChild(categoryBtn);
    content.appendChild(quickActions);
    elementRoot.appendChild(content);

    elementRoot.addEventListener('click', event => handleTagClick(event, tag.id));
    elementRoot.addEventListener('contextmenu', event => {
        event.preventDefault();
        showCorrectionMenu(event, tag);
    });

    return elementRoot;
}

function renderCategoryGroups(visibleTags) {
    const categorizer = window.tagCategorizer;
    const knownCategories = window.knownCategories || new Set();
    const categoryOrder = [...new Set([...(categorizer?.categoryOrder || []), ...knownCategories, 'Uncategorized'])];

    const groups = visibleTags.reduce((acc, tag) => {
        const category = tag.category || 'Uncategorized';
        if (!acc[category]) acc[category] = [];
        acc[category].push(tag);
        return acc;
    }, {});

    categoryOrder.forEach(categoryName => {
        const tags = groups[categoryName];
        if (!tags || !tags.length) return;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'tag-group fade-in-up';
        groupDiv.innerHTML = `<h3 class="tag-group-title">${categoryName}</h3>`;

        const container = document.createElement('div');
        container.className = 'tag-group-container';
        container.dataset.groupName = categoryName;

        tags.forEach(tag => container.appendChild(createTagElement(tag)));
        groupDiv.appendChild(container);
        tagOutput.appendChild(groupDiv);
    });
}

function renderIllustriousGroups(visibleTags) {
    if (typeof promptFlow.sortTagsByIllustriousFlow !== 'function') return;

    const groups = promptFlow.sortTagsByIllustriousFlow(visibleTags);
    groups.forEach(({ phase, tags }) => {
        if (!tags.length) return;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'tag-group fade-in-up';

        const title = document.createElement('h3');
        title.className = 'tag-group-title';
        title.textContent = phase.label;
        groupDiv.appendChild(title);

        if (phase.description) {
            const description = document.createElement('p');
            description.className = 'text-xs text-gray-400 mb-3';
            description.textContent = phase.description;
            groupDiv.appendChild(description);
        }

        const container = document.createElement('div');
        container.className = 'tag-group-container';
        container.dataset.groupName = phase.label;

        tags.forEach(tag => container.appendChild(createTagElement(tag)));
        groupDiv.appendChild(container);
        tagOutput.appendChild(groupDiv);
    });
}

function renderSimpleList(visibleTags, sortMode) {
    const list = [...visibleTags];

    if (sortMode === 'az') {
        list.sort((a, b) => a.original.localeCompare(b.original));
    } else if (sortMode === 'za') {
        list.sort((a, b) => b.original.localeCompare(a.original));
    } else if (sortMode === 'recent') {
        list.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    }

    const container = document.createElement('div');
    container.className = 'tag-group-container';
    container.dataset.groupName = 'all';
    list.forEach(tag => container.appendChild(createTagElement(tag)));
    tagOutput.appendChild(container);
}

function displayTags() {
    if (!tagOutput) return;

    window.renderCategoryFilters?.();
    tagOutput.innerHTML = '';

    const visibleTags = getActiveTags();

    if (!(window.baseTags || []).length) {
        tagOutput.innerHTML = '<div class="text-gray-500 italic text-center py-12">Start typing or paste tags above to begin...</div>';
        window.updateHiddenCategoriesBanner?.();
        updateStats();
        updatePromptPreview();
        window.refreshFavoriteIndicators?.();
        destroySortableInstances();
        return;
    }

    if (!visibleTags.length) {
        tagOutput.innerHTML = '<div class="text-amber-300 text-center py-12">All categories are currently muted. Enable a category to see its tags.</div>';
        window.updateHiddenCategoriesBanner?.();
        updateStats();
        updatePromptPreview();
        window.refreshFavoriteIndicators?.();
        destroySortableInstances();
        return;
    }

    const sortMode = sortSelect?.value || 'danbooru';

    if (sortMode === 'danbooru' || sortMode === 'smart') {
        renderCategoryGroups(visibleTags);
    } else if (sortMode === 'illustrious') {
        renderIllustriousGroups(visibleTags);
    } else {
        renderSimpleList(visibleTags, sortMode);
    }

    if (['danbooru', 'smart', 'manual'].includes(sortMode)) {
        initSortable();
    } else {
        destroySortableInstances();
    }

    window.updateHiddenCategoriesBanner?.();
    updateStats();
    updatePromptPreview();
    window.refreshFavoriteIndicators?.();
    animateTagGroups();
}

function cycleIncreaseWeight(original, current) {
    if (current.startsWith('(((')) {
        return `(((${original})))`;
    }
    if (current.startsWith('((')) {
        return `(((${original})))`;
    }
    if (current.startsWith('(')) {
        return `((${original}))`;
    }
    if (current.startsWith('[')) {
        return original;
    }
    return `(${original})`;
}

function cycleDecreaseWeight(original, current) {
    if (current.startsWith('[[[')) {
        return `[[[${original}]]]`;
    }
    if (current.startsWith('[[')) {
        return `[[[${original}]]]`;
    }
    if (current.startsWith('[')) {
        return `[[${original}]]`;
    }
    if (current.startsWith('(')) {
        return original;
    }
    return `[${original}]`;
}

function updateTagWeight(id, action) {
    const tag = (window.baseTags || []).find(item => item.id === id);
    if (!tag) return;

    const original = tag.original;
    const current = tag.weighted || original;
    tag.weighted = action === 'increase'
        ? cycleIncreaseWeight(original, current)
        : cycleDecreaseWeight(original, current);

    displayTags();
}

function destroySortableInstances() {
    if (!window.sortableInstances || !window.sortableInstances.length) return;
    window.sortableInstances.forEach(instance => instance.destroy());
    window.sortableInstances = [];
}

function initSortable() {
    if (!window.Sortable || !tagOutput) return;

    const sortMode = sortSelect?.value;
    if (!['danbooru', 'smart', 'manual'].includes(sortMode)) {
        destroySortableInstances();
        return;
    }

    destroySortableInstances();
    const containers = tagOutput.querySelectorAll('.tag-group-container');
    containers.forEach(container => {
        const instance = new window.Sortable(container, {
            group: 'shared',
            animation: 150,
            ghostClass: 'opacity-50',
            fallbackOnBody: true,
            touchStartThreshold: 8,
            fallbackTolerance: 6,
            dragClass: 'opacity-70',
            onEnd: event => {
                const previousSort = sortSelect?.value;
                const movedTag = (window.baseTags || []).find(tag => tag.id === event.item.dataset.id);
                const newCategory = event.to.dataset.groupName;
                const sameContainer = event.from === event.to;

                if (movedTag && newCategory) {
                    movedTag.category = newCategory;
                    movedTag.categorySource = 'Manual';
                    window.ensureCategoryRegistered?.(newCategory);
                    window.tagCategorizer?.updateIndex?.(movedTag.original, newCategory);
                }

                if (previousSort === 'manual' || sameContainer) {
                    const ordered = Array.from(tagOutput.querySelectorAll('.tag-base'))
                        .map(el => (window.baseTags || []).find(tag => tag && tag.id === el.dataset.id))
                        .filter(Boolean);
                    window.baseTags = ordered;
                    if (sortSelect) sortSelect.value = 'manual';
                }

                displayTags();
                if (previousSort && previousSort !== 'manual' && !sameContainer && sortSelect) {
                    sortSelect.value = previousSort;
                }
            }
        });

        window.sortableInstances = window.sortableInstances || [];
        window.sortableInstances.push(instance);
    });
}

function handleTagClick(event, tagId) {
    const tagElement = event.currentTarget;
    window.selectedTagIds = window.selectedTagIds || new Set();

    if (event.ctrlKey || event.metaKey) {
        if (window.selectedTagIds.has(tagId)) {
            window.selectedTagIds.delete(tagId);
            tagElement.classList.remove('selected');
        } else {
            window.selectedTagIds.add(tagId);
            tagElement.classList.add('selected');
        }
    } else {
        document.querySelectorAll('.tag-base.selected').forEach(el => el.classList.remove('selected'));
        window.selectedTagIds.clear();
        window.selectedTagIds.add(tagId);
        tagElement.classList.add('selected');
    }
}

function showCorrectionMenu(event, clickedTag) {
    const menuId = 'correction-menu';
    document.getElementById(menuId)?.remove();

    window.selectedTagIds = window.selectedTagIds || new Set();
    if (window.selectedTagIds.size === 0 || !window.selectedTagIds.has(clickedTag.id)) {
        window.selectedTagIds.clear();
        document.querySelectorAll('.tag-base.selected').forEach(el => el.classList.remove('selected'));
        window.selectedTagIds.add(clickedTag.id);
        document.querySelector(`[data-id="${clickedTag.id}"]`)?.classList.add('selected');
    }

    const menu = document.createElement('div');
    menu.id = menuId;
    menu.className = 'absolute z-20 bg-gray-800 border border-gray-600 rounded-md shadow-lg py-1 text-sm';
    menu.style.left = `${event.pageX}px`;
    menu.style.top = `${event.pageY}px`;

    const title = window.selectedTagIds.size > 1
        ? `Correct ${window.selectedTagIds.size} Tags`
        : `Correct '${clickedTag.original}'`;

    let html = `<div class="px-3 py-1 text-gray-400 border-b border-gray-700">${title}</div>`;
    (window.tagCategorizer?.categories || []).forEach(category => {
        html += `<a href="#" class="block px-3 py-1 text-gray-200 hover:bg-indigo-600" onclick="submitCategoryUpdate(event,'${category}')">${category}</a>`;
    });

    menu.innerHTML = html;
    document.body.appendChild(menu);
    document.addEventListener('click', () => menu.remove(), { once: true });
}

async function submitCategoryUpdate(event, newCategory) {
    event.preventDefault();

    const selected = window.selectedTagIds || new Set();
    const targets = (window.baseTags || []).filter(tag => selected.has(tag.id));
    if (!targets.length) return;

    if (!window.gitHubPat) {
        window.gitHubPat = prompt('To save changes directly to GitHub, please enter your Personal Access Token (PAT) with `repo` or `public_repo` scope.', '');
        if (!window.gitHubPat) {
            if (copyMessage) {
                copyMessage.textContent = 'Update cancelled. No PAT provided.';
                setTimeout(() => { if (copyMessage) copyMessage.textContent = ''; }, 3000);
            }
            return;
        }
    }

    const apiUrl = `https://api.github.com/repos/${window.GITHUB_USER}/${window.GITHUB_REPO}/contents/tag_map.json`;
    const headers = {
        'Authorization': `Bearer ${window.gitHubPat}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
    };

    try {
        const response = await fetch(apiUrl, { headers });
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const file = await response.json();
        const currentContent = atob(file.content || '');
        const sha = file.sha;
        const tagMap = JSON.parse(currentContent || '{}');

        let changes = 0;
        targets.forEach(tag => {
            const key = tag.original.toLowerCase().replace(/ /g, '_');
            if (tagMap[key] !== newCategory) {
                tagMap[key] = newCategory;
                changes += 1;
            }
        });

        if (!changes) {
            if (copyMessage) {
                copyMessage.textContent = 'No changes needed.';
                setTimeout(() => { if (copyMessage) copyMessage.textContent = ''; }, 3000);
            }
            return;
        }

        const sorted = Object.fromEntries(Object.entries(tagMap).sort());
        const update = await fetch(apiUrl, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                message: `Update ${changes} tag(s) to '${newCategory}'`,
                content: btoa(JSON.stringify(sorted, null, 2)),
                sha
            })
        });

        if (!update.ok) {
            const data = await update.json();
            throw new Error(`GitHub API Error: ${data.message}`);
        }

        if (copyMessage) {
            copyMessage.textContent = `Success! Updated ${changes} tag(s).`;
        }

        targets.forEach(tag => {
            tag.category = newCategory;
            tag.categorySource = 'Primary';
            window.tagCategorizer?.updateIndex?.(tag.original, newCategory);
            window.ensureCategoryRegistered?.(newCategory);
        });

        selected.clear();
        displayTags();
    } catch (error) {
        console.error('Update failed:', error);
        if (copyMessage) {
            copyMessage.textContent = `Error: ${error.message}`;
        }
        if (error.message.includes('401')) {
            window.gitHubPat = null;
        }
    } finally {
        setTimeout(() => { if (copyMessage) copyMessage.textContent = ''; }, 5000);
    }
}

async function loadExternalData() {
    document.title = 'Danbooru Tag Helper (Loading...)';

    try {
        const timestamp = `t=${Date.now()}`;
        const [tagsResponse, mapResponse] = await Promise.all([
            fetch(`tags.json?${timestamp}`),
            fetch(`tag_map.json?${timestamp}`)
        ]);

        if (!tagsResponse.ok) throw new Error(`Failed to fetch tags.json: ${tagsResponse.statusText}`);
        if (!mapResponse.ok) throw new Error(`Failed to fetch tag_map.json: ${mapResponse.statusText}`);

        window.TAG_DATABASE = await tagsResponse.json();
        const tagMap = await mapResponse.json();

        const categoryOrder = [
            'Quality',
            'Composition',
            'Characters',
            'Subject & Creatures',
            'Face',
            'Eyes',
            'Hair',
            'Body Parts',
            'Attire',
            'Accessories',
            'Held Items & Objects',
            'Actions & Poses',
            'Setting & Environment',
            'Style & Meta'
        ];

        window.tagCategorizer = new window.SmartTagCategorizer(tagMap, window.TAG_DATABASE, categoryOrder);
        window.knownCategories = new Set([
            ...window.tagCategorizer.getCategories(),
            'Uncategorized'
        ]);

        document.title = 'Danbooru Tag Helper (Ready)';
    } catch (error) {
        console.error('FATAL ERROR loading data:', error);
        document.title = 'Danbooru Tag Helper (ERROR)';

        const panel = document.querySelector('.glass-panel');
        if (panel) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'p-4 mb-4 text-sm text-red-200 bg-red-800/50 rounded-lg';
            errorDiv.innerHTML = `<strong>Error loading core data:</strong> ${error.message}. The application cannot start. Please check the console (F12) for details and ensure 'tags.json' and 'tag_map.json' are available.`;
            panel.prepend(errorDiv);
        }
    }
}

function copyTagsToClipboard() {
    const prompt = buildFinalPrompt();
    if (!prompt) {
        if (copyMessage) {
            copyMessage.textContent = 'Nothing to copy yet!';
            setTimeout(() => { if (copyMessage) copyMessage.textContent = ''; }, 2000);
        }
        return;
    }

    navigator.clipboard.writeText(prompt).then(() => {
        if (copyMessage) {
            copyMessage.textContent = 'Tags copied!';
        }
        window.updateCopyHistory?.(prompt);
        updatePromptPreview();
        setTimeout(() => { if (copyMessage) copyMessage.textContent = ''; }, 2000);
    }).catch(error => {
        console.error('Clipboard write failed:', error);
        if (copyMessage) {
            copyMessage.textContent = 'Copy failed!';
        }
    });
}

function ensureAutocompleteState() {
    if (!window.autocomplete) {
        window.autocomplete = { active: false, index: -1, currentWord: '', suggestions: [] };
    }
    return window.autocomplete;
}

function handleAutocompleteInput() {
    if (!window.tagCategorizer || !tagInput) return;
    const state = ensureAutocompleteState();

    const text = tagInput.value;
    const cursor = tagInput.selectionStart || text.length;
    const lastComma = text.lastIndexOf(',', cursor - 1);
    state.currentWord = text.substring(lastComma + 1, cursor).trim();

    if (!state.currentWord) {
        hideAutocomplete();
        return;
    }

    const query = state.currentWord.replace(/ /g, '_');
    state.suggestions = (window.TAG_DATABASE || [])
        .filter(tag => tag.startsWith(query))
        .slice(0, 5);

    if (state.suggestions.length) {
        renderAutocomplete();
    } else {
        hideAutocomplete();
    }
}

function renderAutocomplete() {
    if (!autocompleteBox) return;
    const state = ensureAutocompleteState();

    autocompleteBox.innerHTML = state.suggestions
        .map(tag => `<div class="autocomplete-item p-2 cursor-pointer" data-tag="${tag}" onmousedown="selectAutocompleteItem('${tag}')">${tag.replace(/_/g, ' ')}</div>`)
        .join('');

    state.active = true;
    state.index = -1;
    autocompleteBox.style.display = 'block';
}

function hideAutocomplete() {
    if (!autocompleteBox) return;
    const state = ensureAutocompleteState();
    state.active = false;
    autocompleteBox.style.display = 'none';
}

function focusRelativeElement(element, backwards = false) {
    const selectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(document.querySelectorAll(selectors))
        .filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1 && (el.offsetParent !== null || el.getClientRects().length > 0));

    const index = focusable.indexOf(element);
    if (index === -1) return;

    let nextIndex = backwards ? index - 1 : index + 1;
    if (nextIndex < 0) nextIndex = focusable.length - 1;
    if (nextIndex >= focusable.length) nextIndex = 0;
    focusable[nextIndex].focus();
}

function handleAutocompleteKeydown(event) {
    const state = ensureAutocompleteState();

    if (event.key === 'Tab' && !state.active) {
        event.preventDefault();
        focusRelativeElement(tagInput, event.shiftKey);
        return;
    }

    if (!state.active) return;
    const items = autocompleteBox?.children || [];
    if (!items.length) return;

    if (event.key === 'Escape') {
        event.preventDefault();
        hideAutocomplete();
        return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (state.index >= 0) {
            items[state.index]?.classList.remove('selected');
        }

        if (state.index === -1) {
            state.index = event.key === 'ArrowDown' ? 0 : items.length - 1;
        } else if (event.key === 'ArrowDown') {
            state.index = (state.index + 1) % items.length;
        } else {
            state.index = (state.index - 1 + items.length) % items.length;
        }

        items[state.index]?.classList.add('selected');
    } else if (event.key === 'Enter' || event.key === 'Tab') {
        if (state.index === -1 && items[0]) state.index = 0;
        if (state.index > -1 && items[state.index]) {
            event.preventDefault();
            selectAutocompleteItem(items[state.index].dataset.tag);
            hideAutocomplete();
        }
    }
}

function selectAutocompleteItem(tag) {
    if (!tagInput) return;
    const text = tagInput.value;
    const cursor = tagInput.selectionStart || text.length;
    const lastComma = text.lastIndexOf(',', cursor - 1);
    const before = text.substring(0, lastComma + 1);

    tagInput.value = `${before} ${tag.replace(/_/g, ' ')}, ${text.substring(cursor)}`;
    hideAutocomplete();
    tagInput.focus();
    processAll();
}

function suggestCoherentTags() {
    if (!window.tagCategorizer || !window.TAG_DATABASE || !tagInput) return;

    const QUESTIONABLE = [
        'bikini', 'swimsuit', 'cleavage', 'breasts', 'ass', 'thighs', 'pantyhose',
        'leotard', 'garter_belt', 'panty_shot', 'sideboob', 'topless', 'bra',
        'panties', 'lingerie', 'seductive', 'bondage', 'shibari', 'partially_nude',
        'armpits', 'bottomless'
    ];

    const EXPLICIT = [
        'pussy', 'penis', 'sex', 'oral', 'ahegao', 'nude', 'naked', 'cum',
        'masturbation', 'fellatio', 'cunnilingus', 'prolapse'
    ];

    const desired = parseInt(suggestionCountInput?.value, 10) || 15;
    const existing = new Set((window.baseTags || []).map(tag => tag.original.toLowerCase().replace(/ /g, '_')));

    const isAllowed = tag => {
        if (EXPLICIT.some(keyword => tag.includes(keyword))) return false;
        if (!ratingQuestionable?.checked && QUESTIONABLE.some(keyword => tag.includes(keyword))) return false;
        if (!ratingGeneral?.checked && !ratingSafe?.checked && !ratingQuestionable?.checked) return false;
        return true;
    };

    const pools = {};
    window.TAG_DATABASE.forEach(tag => {
        const meta = window.tagCategorizer.categorize(tag);
        const category = meta?.category || 'Uncategorized';
        if (!pools[category]) pools[category] = [];
        if (!existing.has(tag) && isAllowed(tag)) {
            pools[category].push(tag);
        }
    });

    const distribution = (window.baseTags || []).reduce((acc, tag) => {
        acc[tag.category] = (acc[tag.category] || 0) + 1;
        return acc;
    }, {});

    const plan = (window.baseTags || []).length
        ? Object.entries(distribution).map(([name, count]) => ({ name, count }))
        : [
            { name: 'Quality', count: 1 },
            { name: 'Composition', count: 2 },
            { name: 'Characters', count: 1 },
            { name: 'Face', count: 2 },
            { name: 'Eyes', count: 1 },
            { name: 'Hair', count: 2 }
        ];

    const suggestions = new Set();
    let remaining = desired;

    while (remaining > 0) {
        let madeProgress = false;
        for (const entry of plan) {
            if (remaining <= 0) break;
            const pool = pools[entry.name] || [];
            for (let i = 0; i < entry.count && remaining > 0; i += 1) {
                if (!pool.length) break;
                const index = Math.floor(Math.random() * pool.length);
                const [candidate] = pool.splice(index, 1);
                if (candidate && !suggestions.has(candidate)) {
                    suggestions.add(candidate);
                    remaining -= 1;
                    madeProgress = true;
                }
            }
        }
        if (!madeProgress) break;
    }

    if (!suggestions.size) return;

    const existingInput = tagInput.value.trim();
    const separator = existingInput && !existingInput.endsWith(',') ? ', ' : '';
    tagInput.value = `${existingInput}${separator}${Array.from(suggestions).join(', ').replace(/_/g, ' ')}`;
    processAll();
}

function collectExportPayload() {
    return {
        tags: getProcessedTagsForOutput(),
        prompt: buildFinalPrompt(),
        settings: {
            prepend: triggerInput?.value || '',
            append: appendInput?.value || '',
            maxTags: maxTagsInput?.value || '75',
            sorting: sortSelect?.value || 'danbooru',
            deduplicate: !!deduplicateToggle?.checked,
            underscores: !!underscoreToggle?.checked,
            weighting: !!enableWeightingToggle?.checked
        },
        hiddenCategories: Array.from(window.hiddenCategories || []),
        timestamp: new Date().toISOString()
    };
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

function exportTags(format = 'json') {
    const payload = collectExportPayload();
    if (!payload.tags.length && !payload.prompt) {
        alert('Add some tags before exporting.');
        return;
    }

    const stamp = new Date().toISOString().split('T')[0];
    if (format === 'txt') {
        const text = payload.prompt || payload.tags.join(', ');
        downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `danbooru-tags-${stamp}.txt`);
    } else {
        downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `danbooru-tags-${stamp}.json`);
    }

    if (copyMessage) {
        copyMessage.textContent = `Exported ${format.toUpperCase()}!`;
        setTimeout(() => { if (copyMessage) copyMessage.textContent = ''; }, 2500);
    }
}

function copyPromptAsJson() {
    const payload = collectExportPayload();
    if (!payload.tags.length && !payload.prompt) {
        alert('Add some tags before copying export JSON.');
        return;
    }

    navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).then(() => {
        if (copyMessage) {
            copyMessage.textContent = 'Export JSON copied to clipboard!';
            setTimeout(() => { if (copyMessage) copyMessage.textContent = ''; }, 2500);
        }
    }).catch(() => alert('Unable to copy JSON to clipboard.'));
}

function importTags() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.txt';

    input.onchange = event => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = e => {
            try {
                const content = e.target?.result;
                if (typeof content !== 'string') return;

                if (file.name.endsWith('.json')) {
                    const data = JSON.parse(content);
                    if (data.prompt) tagInput.value = data.prompt;
                    else if (Array.isArray(data.tags)) tagInput.value = data.tags.join(', ');

                    if (data.settings) {
                        if (triggerInput && data.settings.prepend !== undefined) triggerInput.value = data.settings.prepend;
                        if (appendInput && data.settings.append !== undefined) appendInput.value = data.settings.append;
                        if (maxTagsInput && data.settings.maxTags !== undefined) maxTagsInput.value = data.settings.maxTags;
                        if (sortSelect && data.settings.sorting !== undefined) sortSelect.value = data.settings.sorting;
                        if (deduplicateToggle && data.settings.deduplicate !== undefined) deduplicateToggle.checked = data.settings.deduplicate;
                        if (underscoreToggle && data.settings.underscores !== undefined) underscoreToggle.checked = data.settings.underscores;
                        if (enableWeightingToggle && data.settings.weighting !== undefined) enableWeightingToggle.checked = data.settings.weighting;
                    }

                    if (Array.isArray(data.hiddenCategories)) {
                        window.hiddenCategories = new Set(data.hiddenCategories);
                        window.saveHiddenCategories?.();
                    }
                } else {
                    tagInput.value = content.trim().replace(/\n+/g, ', ');
                }

                processAll();
            } catch (error) {
                alert('Error importing file: ' + error.message);
            }
        };

        reader.readAsText(file);
    };

    input.click();
}

function exportSettings() {
    const settings = {
        theme: document.body.className.match(/theme-\w+/)?.[0] || 'theme-indigo',
        prepend: triggerInput?.value || '',
        append: appendInput?.value || '',
        swaps: swapsInput?.value || '',
        implications: implicationsInput?.value || '',
        blacklist: blacklistInput?.value || '',
        maxTags: maxTagsInput?.value || '75',
        sorting: sortSelect?.value || 'danbooru',
        deduplicate: !!deduplicateToggle?.checked,
        underscores: !!underscoreToggle?.checked,
        weighting: !!enableWeightingToggle?.checked,
        ratings: {
            safe: !!ratingSafe?.checked,
            general: !!ratingGeneral?.checked,
            questionable: !!ratingQuestionable?.checked
        }
    };

    downloadBlob(new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' }),
        `danbooru-helper-settings-${new Date().toISOString().split('T')[0]}.json`);
}

function importSettings(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const settings = JSON.parse(e.target?.result);
            if (settings.theme) window.applyTheme?.(settings.theme);
            if (triggerInput && settings.prepend !== undefined) triggerInput.value = settings.prepend;
            if (appendInput && settings.append !== undefined) appendInput.value = settings.append;
            if (swapsInput && settings.swaps !== undefined) swapsInput.value = settings.swaps;
            if (implicationsInput && settings.implications !== undefined) implicationsInput.value = settings.implications;
            if (blacklistInput && settings.blacklist !== undefined) blacklistInput.value = settings.blacklist;
            if (maxTagsInput && settings.maxTags !== undefined) maxTagsInput.value = settings.maxTags;
            if (sortSelect && settings.sorting !== undefined) sortSelect.value = settings.sorting;
            if (deduplicateToggle && settings.deduplicate !== undefined) deduplicateToggle.checked = settings.deduplicate;
            if (underscoreToggle && settings.underscores !== undefined) underscoreToggle.checked = settings.underscores;
            if (enableWeightingToggle && settings.weighting !== undefined) enableWeightingToggle.checked = settings.weighting;
            if (settings.ratings) {
                if (ratingSafe && settings.ratings.safe !== undefined) ratingSafe.checked = settings.ratings.safe;
                if (ratingGeneral && settings.ratings.general !== undefined) ratingGeneral.checked = settings.ratings.general;
                if (ratingQuestionable && settings.ratings.questionable !== undefined) ratingQuestionable.checked = settings.ratings.questionable;
            }

            window.toggleSettingsPanel?.();
            processAll();
            if (copyMessage) {
                copyMessage.textContent = 'Settings imported!';
                setTimeout(() => { if (copyMessage) copyMessage.textContent = ''; }, 3000);
            }
        } catch (error) {
            alert('Error importing settings: ' + error.message);
        }
    };

    reader.readAsText(file);
}

function resetToDefaults() {
    if (!confirm('Reset all settings to defaults?')) return;

    if (tagInput) tagInput.value = '';
    if (triggerInput) triggerInput.value = '';
    if (appendInput) appendInput.value = '';
    if (swapsInput) swapsInput.value = '';
    if (implicationsInput) implicationsInput.value = '';
    if (blacklistInput) blacklistInput.value = '';
    if (maxTagsInput) maxTagsInput.value = '75';
    if (sortSelect) sortSelect.value = 'danbooru';
    if (suggestionCountInput) suggestionCountInput.value = '15';
    if (deduplicateToggle) deduplicateToggle.checked = true;
    if (underscoreToggle) underscoreToggle.checked = false;
    if (enableWeightingToggle) enableWeightingToggle.checked = false;
    if (ratingSafe) ratingSafe.checked = true;
    if (ratingGeneral) ratingGeneral.checked = true;
    if (ratingQuestionable) ratingQuestionable.checked = false;

    window.applyTheme?.('theme-indigo');
    window.toggleSettingsPanel?.();
    processAll();
}

function clearAll() {
    if (!confirm('Clear all tags and settings?')) return;

    if (tagInput) tagInput.value = '';
    if (triggerInput) triggerInput.value = '';
    if (appendInput) appendInput.value = '';
    if (swapsInput) swapsInput.value = '';
    if (implicationsInput) implicationsInput.value = '';
    if (blacklistInput) blacklistInput.value = '';

    processAll();
}

function randomizeTags() {
    if (!window.baseTags || !window.baseTags.length) return;
    for (let i = window.baseTags.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [window.baseTags[i], window.baseTags[j]] = [window.baseTags[j], window.baseTags[i]];
    }
    displayTags();
}

function optimizeOrder() {
    if (!window.baseTags || !window.baseTags.length) return;

    const priority = {
        'Quality': 1,
        'Composition': 2,
        'Characters': 3,
        'Subject & Creatures': 4,
        'Face': 5,
        'Eyes': 6,
        'Hair': 7,
        'Body Parts': 8,
        'Attire': 9,
        'Accessories': 10,
        'Held Items & Objects': 11,
        'Actions & Poses': 12,
        'Setting & Environment': 13,
        'Style & Meta': 14
    };

    window.baseTags.sort((a, b) => {
        const aPriority = priority[a.category] || 99;
        const bPriority = priority[b.category] || 99;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.original.localeCompare(b.original);
    });

    displayTags();
    if (copyMessage) {
        copyMessage.textContent = 'Tags optimized!';
        setTimeout(() => { if (copyMessage) copyMessage.textContent = ''; }, 2000);
    }
}

function initializeToken() {
    const stored = localStorage.getItem(STORAGE_KEYS.GITHUB_PAT);
    if (stored) {
        window.gitHubPat = stored;
    }
}

function processAll() {
    if (!window.tagCategorizer) return;

    const swaps = parseSwapEntries(swapsInput?.value || '');
    const implications = parseImplicationEntries(implicationsInput?.value || '');
    const blacklist = parseBlacklistEntries(blacklistInput?.value || '');

    let tags = splitTagInput(tagInput?.value || '');
    tags = applySwaps(tags, swaps);
    tags = applyImplications(tags, implications);

    if (deduplicateToggle?.checked) {
        tags = deduplicateTags(tags);
    }

    tags = filterBlacklisted(tags, blacklist);
    tags = limitTags(tags);

    rebuildBaseTags(tags);
    window.renderCategoryFilters?.();
    displayTags();
}

window.processAll = processAll;
window.displayTags = displayTags;
window.updatePromptPreview = updatePromptPreview;
window.updateStats = updateStats;
window.copyTagsToClipboard = copyTagsToClipboard;
window.updateTagWeight = updateTagWeight;
window.destroySortableInstances = destroySortableInstances;
window.initSortable = initSortable;
window.handleAutocompleteInput = handleAutocompleteInput;
window.handleAutocompleteKeydown = handleAutocompleteKeydown;
window.renderAutocomplete = renderAutocomplete;
window.hideAutocomplete = hideAutocomplete;
window.selectAutocompleteItem = selectAutocompleteItem;
window.suggestCoherentTags = suggestCoherentTags;
window.loadExternalData = loadExternalData;
window.collectExportPayload = collectExportPayload;
window.exportTags = exportTags;
window.copyPromptAsJson = copyPromptAsJson;
window.importTags = importTags;
window.exportSettings = exportSettings;
window.importSettings = importSettings;
window.resetToDefaults = resetToDefaults;
window.clearAll = clearAll;
window.randomizeTags = randomizeTags;
window.optimizeOrder = optimizeOrder;
window.submitCategoryUpdate = submitCategoryUpdate;
window.initializeToken = initializeToken;
