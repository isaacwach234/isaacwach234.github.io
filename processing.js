const { element, STORAGE_KEYS } = window.app;
const promptFlow = window.promptFlow;

const reduceMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const prefersReducedMotion = reduceMotionQuery ? reduceMotionQuery.matches : false;

const tagInput = element('tagInput');
const swapsInput = element('swapsInput');
const implicationsInput = element('implicationsInput');
const blacklistInput = element('blacklistInput');
const triggerInput = element('triggerInput');
const appendInput = element('appendInput');
const deduplicateToggle = element('deduplicateToggle');
const underscoreToggle = element('underscoreToggle');
const enableWeightingToggle = element('enableWeightingToggle');
const sortSelect = element('sortSelect');
const maxTagsInput = element('maxTagsInput');
const tagOutput = element('tagOutput');
const copyButton = element('copyButton');
const copyMessage = element('copyMessage');
const promptPreview = element('promptPreview');
const promptPreviewMeta = element('promptPreviewMeta');
const promptPreviewCopy = element('promptPreviewCopy');
const autocompleteBox = element('autocomplete-box');
const suggestionCountInput = element('suggestionCountInput');

const ratingSafe = element('rating-safe');
const ratingGeneral = element('rating-general');
const ratingQuestionable = element('rating-questionable');

const copyJsonButton = element('copyJsonButton');

function initializeToken() {
    const savedToken = localStorage.getItem(STORAGE_KEYS.GITHUB_PAT);
    if (savedToken) {
        window.gitHubPat = savedToken;
        console.log('GitHub token loaded from storage');
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

        if (!tagsResponse.ok) {
            throw new Error(`Failed to fetch tags.json: ${tagsResponse.statusText}`);
        }

        if (!mapResponse.ok) {
            throw new Error(`Failed to fetch tag_map.json: ${mapResponse.statusText}`);
        }

        window.TAG_DATABASE = await tagsResponse.json();
        const tagMap = await mapResponse.json();
        const categoryOrder = [
            'Quality', 'Composition', 'Characters', 'Subject & Creatures',
            'Face', 'Eyes', 'Hair', 'Body Parts', 'Attire', 'Accessories',
            'Held Items & Objects', 'Actions & Poses', 'Setting & Environment',
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

        const errorDiv = document.createElement('div');
        errorDiv.className = 'p-4 mb-4 text-sm text-red-200 bg-red-800/50 rounded-lg';
        errorDiv.innerHTML = `<strong>Error loading core data:</strong> ${error.message}. The application cannot start. Please check the console (F12) for details and ensure 'tags.json' and 'tag_map.json' are in the same directory as this page.`;

        document.querySelector('.glass-panel')?.prepend(errorDiv);
    }
}

function copyTagsToClipboard() {
    const finalString = buildFinalPrompt();
    if (!finalString) {
        if (copyMessage) {
            copyMessage.textContent = 'Nothing to copy yet!';
            setTimeout(() => {
                if (copyMessage?.textContent === 'Nothing to copy yet!') {
                    copyMessage.textContent = '';
                }
            }, 2000);
        }
        return;
    }

    navigator.clipboard.writeText(finalString).then(() => {
        if (copyMessage) {
            copyMessage.textContent = 'Tags copied!';
            setTimeout(() => {
                if (copyMessage?.textContent === 'Tags copied!') {
                    copyMessage.textContent = '';
                }
            }, 2000);
        }
        window.updateCopyHistory(finalString);
        updatePromptPreview();
    }).catch(err => {
        if (copyMessage) {
            copyMessage.textContent = 'Copy failed!';
        }
        console.error('Clipboard write failed:', err);
    });
}

function focusRelativeElement(element, backwards = false) {
    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(document.querySelectorAll(focusableSelectors))
        .filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1 && el.getAttribute('aria-hidden') !== 'true' && (el.offsetParent !== null || el.getClientRects().length > 0));

    const currentIndex = focusable.indexOf(element);
    if (currentIndex === -1) return;

    let nextIndex = backwards ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0) nextIndex = focusable.length - 1;
    if (nextIndex >= focusable.length) nextIndex = 0;
    focusable[nextIndex].focus();
}

function handleAutocompleteInput() {
    if (!window.tagCategorizer || !tagInput) return;

    const text = tagInput.value;
    const cursorPos = tagInput.selectionStart || text.length;
    const lastComma = text.lastIndexOf(',', cursorPos - 1);
    window.autocomplete.currentWord = text.substring(lastComma + 1, cursorPos).trim();

    if (!window.autocomplete.currentWord) {
        hideAutocomplete();
        return;
    }

    const query = window.autocomplete.currentWord.replace(/ /g, '_');
    window.autocomplete.suggestions = window.TAG_DATABASE
        .filter(t => t.startsWith(query))
        .slice(0, 5);

    if (window.autocomplete.suggestions.length > 0) {
        renderAutocomplete();
    } else {
        hideAutocomplete();
    }
}

function handleAutocompleteKeydown(e) {
    if (e.key === 'Tab' && !window.autocomplete.active) {
        if (tagInput) {
            e.preventDefault();
            focusRelativeElement(tagInput, e.shiftKey);
        }
        return;
    }

    if (!window.tagCategorizer) return;

    if (e.key === 'Escape') {
        if (window.autocomplete.active) {
            e.preventDefault();
            hideAutocomplete();
        }
        return;
    }

    if (!window.autocomplete.active || !autocompleteBox) return;

    const items = autocompleteBox.children;
    if (!items.length) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (window.autocomplete.index >= 0) {
            items[window.autocomplete.index]?.classList.remove('selected');
        }

        if (window.autocomplete.index === -1) {
            window.autocomplete.index = e.key === 'ArrowDown' ? 0 : items.length - 1;
        } else if (e.key === 'ArrowDown') {
            window.autocomplete.index = (window.autocomplete.index + 1) % items.length;
        } else {
            window.autocomplete.index = (window.autocomplete.index - 1 + items.length) % items.length;
        }

        items[window.autocomplete.index]?.classList.add('selected');
    } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (window.autocomplete.index === -1 && items[0]) {
            window.autocomplete.index = 0;
        }

        if (window.autocomplete.index > -1 && items[window.autocomplete.index]) {
            e.preventDefault();
            selectAutocompleteItem(items[window.autocomplete.index].dataset.tag);
            hideAutocomplete();
        }
    }
}

function renderAutocomplete() {
    if (!autocompleteBox) return;

    autocompleteBox.innerHTML = window.autocomplete.suggestions
        .map(s => `<div class="autocomplete-item p-2 cursor-pointer" data-tag="${s}" onmousedown="selectAutocompleteItem('${s}')">${s.replace(/_/g, ' ')}</div>`)
        .join('');

    window.autocomplete.active = true;
    window.autocomplete.index = -1;
    autocompleteBox.style.display = 'block';
}

function hideAutocomplete() {
    if (!autocompleteBox) return;
    window.autocomplete.active = false;
    autocompleteBox.style.display = 'none';
}

function selectAutocompleteItem(tag) {
    if (!tagInput) return;

    const text = tagInput.value;
    const cursorPos = tagInput.selectionStart || text.length;
    const lastComma = text.lastIndexOf(',', cursorPos - 1);
    const before = text.substring(0, lastComma + 1);
    const after = text.substring(cursorPos);
    const replacement = tag.replace(/_/g, ' ');

    tagInput.value = `${before} ${replacement}, ${after}`.replace(/\s+,/g, ',').trim();
    hideAutocomplete();
    tagInput.focus();
    processAll();
}

function updateStats() {
    const tagCountEl = element('tagCount');
    const maxTagCountEl = element('maxTagCount');
    const categoryCountEl = element('categoryCount');
    const historyCountEl = element('historyCount');
    const processedTagCountEl = element('processedTagCount');
    const processedMaxCountEl = element('processedMaxTagCount');

    const activeTags = getActiveTags();
    const tagCount = activeTags.length;
    const maxTags = parseInt(maxTagsInput?.value, 10) || 75;
    const categoryCount = new Set(activeTags.map(t => t.category)).size;
    const historyCount = window.copyHistory.length;

    if (tagCountEl) tagCountEl.textContent = tagCount;
    if (maxTagCountEl) maxTagCountEl.textContent = maxTags;
    if (categoryCountEl) categoryCountEl.textContent = categoryCount;
    if (historyCountEl) historyCountEl.textContent = historyCount;
    if (processedTagCountEl) processedTagCountEl.textContent = tagCount;
    if (processedMaxCountEl) processedMaxCountEl.textContent = maxTags;

    if (tagCountEl) {
        const percentage = maxTags ? (tagCount / maxTags) * 100 : 0;
        if (percentage > 90) {
            tagCountEl.style.color = '#ef4444';
        } else if (percentage > 75) {
            tagCountEl.style.color = '#f59e0b';
        } else {
            tagCountEl.style.color = 'var(--accent-color)';
        }
    }
}

function getProcessedTagElements() {
    if (!tagOutput) return [];
    return Array.from(tagOutput.querySelectorAll('.tag-base'));
}

function getActiveTags() {
    return window.baseTags.filter(tag => !window.hiddenCategories.has(tag.category || 'Uncategorized'));
}

function getProcessedTagsForOutput() {
    return getProcessedTagElements().map(el => {
        const weightedTag = el.dataset.weightedTag || '';
        return underscoreToggle?.checked ? weightedTag.replace(/\s/g, '_') : weightedTag.replace(/_/g, ' ');
    });
}

function getPromptParts() {
    const prepend = triggerInput?.value.split(',').map(t => t.trim()).filter(Boolean) || [];
    const append = appendInput?.value.split(',').map(t => t.trim()).filter(Boolean) || [];
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

    const finalString = buildFinalPrompt();
    promptPreview.value = finalString;

    const characters = finalString.length;
    const words = finalString.trim() ? finalString.trim().split(/\s+/).filter(Boolean).length : 0;
    const tokens = estimateTokenCount(finalString);

    if (promptPreviewMeta) {
        const [charEl, wordEl, tokenEl] = promptPreviewMeta.querySelectorAll('span');
        if (charEl) charEl.textContent = `Characters: ${characters}`;
        if (wordEl) wordEl.textContent = `Words: ${words}`;
        if (tokenEl) tokenEl.textContent = `Approx. tokens: ${tokens}`;
    }

    const isEmpty = finalString.length === 0;
    if (promptPreviewCopy) promptPreviewCopy.disabled = isEmpty;
    if (copyButton) copyButton.disabled = isEmpty;
    if (copyJsonButton) copyJsonButton.disabled = isEmpty;
}

function ensureWeightIntegrity(tag) {
    if (!enableWeightingToggle?.checked) {
        return tag.original;
    }
    return tag.weighted || tag.original;
}

function categorizeWithFallback(tag) {
    if (!window.tagCategorizer) {
        return { category: 'Uncategorized', source: 'Fallback', confidence: 0 };
    }

    const normalized = tag.toLowerCase().replace(/ /g, '_');
    const primary = window.tagCategorizer.primaryIndex?.[normalized];

    if (primary) {
        return { category: primary, source: 'Primary Index', confidence: 1 };
    }

    return window.tagCategorizer.categorize(tag);
}

function processAll() {
    if (!window.tagCategorizer || !tagInput) return;

    const swaps = new Map(
        (swapsInput?.value || '')
            .split(',')
            .map(s => s.split('->').map(p => p.trim()))
            .filter(parts => parts.length === 2 && parts[0])
    );

    const implications = new Map(
        (implicationsInput?.value || '')
            .split(',')
            .map(s => s.split('=>').map(p => p.trim()))
            .filter(parts => parts.length === 2 && parts[0])
    );

    const blacklist = new Set(
        (blacklistInput?.value || '')
            .replace(/[\n,]+/g, ',')
            .split(',')
            .map(word => word.trim().toLowerCase().replace(/_/g, ' '))
            .filter(Boolean)
    );

    let rawTags = (tagInput.value || '')
        .replace(/[\n]+/g, ',')
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

    rawTags = rawTags.map(tag => swaps.get(tag.toLowerCase().replace(/_/g, ' ')) || tag);

    const tagsToAdd = new Set();
    rawTags.forEach(tag => {
        const lower = tag.toLowerCase();
        if (implications.has(lower)) {
            implications.get(lower).split(',').forEach(imp => tagsToAdd.add(imp.trim()));
        }
    });

    rawTags = [...rawTags, ...tagsToAdd];

    if (deduplicateToggle?.checked) {
        const seen = new Set();
        rawTags = rawTags.filter(tag => {
            const lower = tag.toLowerCase().replace(/_/g, ' ');
            if (seen.has(lower)) return false;
            seen.add(lower);
            return true;
        });
    }

    let filteredTags = rawTags.filter(tag => !blacklist.has(tag.toLowerCase().replace(/_/g, ' ')));
    filteredTags = filteredTags.slice(0, parseInt(maxTagsInput?.value, 10) || 75);

    const newBaseTags = [];
    const oldTagsMeta = new Map(window.baseTags.map(t => [t.original, { id: t.id, weighted: t.weighted, addedAt: t.addedAt }]));

    const smartSortActive = ['smart', 'illustrious'].includes(sortSelect?.value);

    filteredTags.forEach(tag => {
        const categorization = smartSortActive ? window.tagCategorizer.categorize(tag) : categorizeWithFallback(tag);
        const assignedCategory = categorization.category || 'Uncategorized';
        window.ensureCategoryRegistered(assignedCategory);

        const oldMeta = oldTagsMeta.get(tag);
        newBaseTags.push({
            original: tag,
            weighted: oldMeta ? oldMeta.weighted : tag,
            id: oldMeta ? oldMeta.id : `tag-${window.tagIdCounter++}`,
            category: assignedCategory,
            categorySource: categorization.source || 'Unknown',
            confidence: categorization.confidence,
            addedAt: oldMeta && oldMeta.addedAt ? oldMeta.addedAt : Date.now()
        });
    });

    if (!enableWeightingToggle?.checked) {
        newBaseTags.forEach(tag => {
            tag.weighted = tag.original;
        });
    }

    window.baseTags = newBaseTags;

    window.renderCategoryFilters();
    displayTags();
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
    const el = document.createElement('div');
    el.className = 'tag-base processed-tag';
    el.dataset.id = tag.id;
    el.dataset.weightedTag = ensureWeightIntegrity(tag);
    el.dataset.tagOriginal = tag.original;
    el.dataset.category = tag.category || 'Uncategorized';

    if (window.selectedTagIds.has(tag.id)) {
        el.classList.add('selected');
    }

    el.style.borderStyle = tag.categorySource && !tag.categorySource.startsWith('Primary') ? 'dashed' : 'solid';
    el.title = `(${tag.categorySource}) ${tag.original}\nCategory: ${tag.category}\n\nCtrl+Click to multi-select.\nRight-click for options.`;

    const content = document.createElement('div');
    content.className = 'flex items-center gap-2';

    const favoriteBtn = document.createElement('button');
    favoriteBtn.type = 'button';
    favoriteBtn.className = 'tag-favorite-btn';
    favoriteBtn.dataset.tagOriginal = tag.original;
    const favoriteKey = (tag.original || '').toLowerCase().replace(/\s+/g, '_');
    const favoriteActive = window.favoriteTags.has(favoriteKey);
    if (favoriteActive) favoriteBtn.classList.add('active');
    favoriteBtn.textContent = favoriteActive ? '★' : '☆';
    favoriteBtn.addEventListener('click', event => {
        event.stopPropagation();
        window.toggleFavorite(tag.original);
    });
    content.appendChild(favoriteBtn);

    const controls = document.createElement('div');
    controls.className = 'flex items-center gap-1';
    const useUnderscores = underscoreToggle?.checked;
    const displayTag = useUnderscores ? tag.weighted.replace(/\s/g, '_') : tag.weighted.replace(/_/g, ' ');

    if (enableWeightingToggle?.checked) {
        const decreaseBtn = document.createElement('button');
        decreaseBtn.type = 'button';
        decreaseBtn.className = 'tag-weight-btn';
        decreaseBtn.textContent = '-';
        decreaseBtn.addEventListener('click', event => {
            event.stopPropagation();
            window.updateTagWeight(tag.id, 'decrease');
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
            window.updateTagWeight(tag.id, 'increase');
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
        window.openCategoryPicker(tag.id);
    });
    quickActions.appendChild(categoryBtn);
    content.appendChild(quickActions);

    el.appendChild(content);
    el.addEventListener('click', e => handleTagClick(e, tag.id));
    el.addEventListener('contextmenu', e => {
        e.preventDefault();
        showCorrectionMenu(e, tag);
    });

    return el;
}

function handleTagClick(event, tagId) {
    const tagElement = event.currentTarget;

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

    let menuHTML = `<div class="px-3 py-1 text-gray-400 border-b border-gray-700">${title}</div>`;
    window.tagCategorizer?.getCategories().forEach(cat => {
        menuHTML += `<a href="#" class="block px-3 py-1 text-gray-200 hover:bg-indigo-600" onclick="submitCategoryUpdate(event, '${cat}')">${cat}</a>`;
    });

    menu.innerHTML = menuHTML;
    document.body.appendChild(menu);
    document.addEventListener('click', () => menu.remove(), { once: true });
}

async function submitCategoryUpdate(event, newCategory) {
    event.preventDefault();

    if (!window.gitHubPat) {
        window.gitHubPat = prompt('To save changes directly to GitHub, please enter your Personal Access Token (PAT) with `repo` or `public_repo` scope.', '');
        if (!window.gitHubPat) {
            if (copyMessage) {
                copyMessage.textContent = 'Update cancelled. No PAT provided.';
                setTimeout(() => {
                    if (copyMessage?.textContent === 'Update cancelled. No PAT provided.') {
                        copyMessage.textContent = '';
                    }
                }, 3000);
            }
            return;
        }
    }

    const tagsToUpdate = window.baseTags.filter(t => window.selectedTagIds.has(t.id));
    if (tagsToUpdate.length === 0) return;

    if (copyMessage) copyMessage.textContent = `Updating ${tagsToUpdate.length} tag(s)...`;

    const apiUrl = `https://api.github.com/repos/${window.GITHUB_USER}/${window.GITHUB_REPO}/contents/tag_map.json`;
    const headers = {
        'Authorization': `Bearer ${window.gitHubPat}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
    };

    try {
        const getFileResponse = await fetch(apiUrl, { headers });
        if (!getFileResponse.ok) throw new Error(`Fetch failed: ${getFileResponse.status}`);

        const fileData = await getFileResponse.json();
        const currentContent = atob(fileData.content);
        const currentSha = fileData.sha;
        let currentTagMap = JSON.parse(currentContent);
        let changesCount = 0;

        tagsToUpdate.forEach(tag => {
            const normalizedTag = tag.original.toLowerCase().replace(/ /g, '_');
            if (currentTagMap[normalizedTag] !== newCategory) {
                currentTagMap[normalizedTag] = newCategory;
                changesCount++;
            }
        });

        if (changesCount === 0) {
            if (copyMessage) {
                copyMessage.textContent = 'No changes needed.';
                setTimeout(() => {
                    if (copyMessage?.textContent === 'No changes needed.') {
                        copyMessage.textContent = '';
                    }
                }, 3000);
            }
            return;
        }

        const sortedTagMap = Object.fromEntries(Object.entries(currentTagMap).sort());
        const newContent = JSON.stringify(sortedTagMap, null, 2);

        const updateResponse = await fetch(apiUrl, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                message: `Update ${changesCount} tag(s) to '${newCategory}'`,
                content: btoa(newContent),
                sha: currentSha
            })
        });

        if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            throw new Error(`GitHub API Error: ${errorData.message}`);
        }

        tagsToUpdate.forEach(tag => {
            window.tagCategorizer.updateIndex(tag.original, newCategory);
            tag.category = newCategory;
            tag.categorySource = 'Primary';
        });

        window.ensureCategoryRegistered(newCategory);
        window.selectedTagIds.clear();
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
        setTimeout(() => {
            if (copyMessage) copyMessage.textContent = '';
        }, 5000);
    }
}

function destroySortableInstances() {
    if (window.sortableInstances.length) {
        window.sortableInstances.forEach(instance => instance.destroy());
        window.sortableInstances = [];
    }
}

function initSortable() {
    if (!['danbooru', 'smart', 'manual'].includes(sortSelect?.value)) {
        destroySortableInstances();
        return;
    }

    destroySortableInstances();

    tagOutput?.querySelectorAll('.tag-group-container').forEach(container => {
        window.sortableInstances.push(new Sortable(container, {
            group: 'shared',
            animation: 150,
            ghostClass: 'opacity-50',
            fallbackOnBody: true,
            touchStartThreshold: 8,
            fallbackTolerance: 6,
            dragClass: 'opacity-70',
            onEnd: evt => {
                const previousSort = sortSelect.value;
                const movedTag = window.baseTags.find(t => t.id === evt.item.dataset.id);
                const newCategory = evt.to.dataset.groupName;
                const sameContainer = evt.from === evt.to;

                if (movedTag && newCategory) {
                    movedTag.category = newCategory;
                    movedTag.categorySource = 'Manual';
                    window.ensureCategoryRegistered(newCategory);
                    window.tagCategorizer?.updateIndex(movedTag.original, newCategory);
                }

                if (previousSort === 'manual' || sameContainer) {
                    const allTagElements = Array.from(tagOutput.querySelectorAll('.tag-base'));
                    window.baseTags = allTagElements
                        .map(el => window.baseTags.find(t => t && t.id === el.dataset.id))
                        .filter(Boolean);
                    sortSelect.value = 'manual';
                }

                displayTags();

                if (previousSort !== 'manual' && !sameContainer) {
                    sortSelect.value = previousSort;
                }
            }
        }));
    });
}

function sortTagsForDisplay(sortValue, visibleTags) {
    if (sortValue === 'illustrious' && promptFlow) {
        return promptFlow.sortTagsByIllustriousFlow(visibleTags);
    }

    if (sortValue === 'danbooru' || sortValue === 'smart') {
        const groups = visibleTags.reduce((acc, tag) => {
            const category = tag.category || 'Uncategorized';
            if (!acc[category]) acc[category] = [];
            acc[category].push(tag);
            return acc;
        }, {});

        const order = [...new Set([
            ...(window.tagCategorizer?.categoryOrder || []),
            ...window.knownCategories,
            'Uncategorized'
        ])];

        return order.map(category => ({ category, tags: groups[category] || [] }));
    }

    let tagsToDisplay = [...visibleTags];
    if (sortValue === 'az') tagsToDisplay.sort((a, b) => a.original.localeCompare(b.original));
    else if (sortValue === 'za') tagsToDisplay.sort((a, b) => b.original.localeCompare(a.original));
    else if (sortValue === 'recent') tagsToDisplay.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

    return tagsToDisplay;
}

function displayTags() {
    window.renderCategoryFilters();
    if (!tagOutput) return;

    tagOutput.innerHTML = '';
    const visibleTags = getActiveTags();

    if (window.baseTags.length === 0) {
        tagOutput.innerHTML = '<div class="text-gray-500 italic text-center py-12">Start typing or paste tags above to begin...</div>';
        window.updateHiddenCategoriesBanner();
        updateStats();
        updatePromptPreview();
        window.refreshFavoriteIndicators();
        destroySortableInstances();
        return;
    }

    if (visibleTags.length === 0) {
        tagOutput.innerHTML = '<div class="text-amber-300 text-center py-12">All categories are currently muted. Enable a category to see its tags.</div>';
        window.updateHiddenCategoriesBanner();
        updateStats();
        updatePromptPreview();
        window.refreshFavoriteIndicators();
        destroySortableInstances();
        return;
    }

    const sortValue = sortSelect?.value || 'danbooru';

    if (sortValue === 'illustrious' && promptFlow) {
        const flowGroups = promptFlow.sortTagsByIllustriousFlow(visibleTags);
        flowGroups.forEach(group => {
            if (!group.tags.length) return;

            const groupDiv = document.createElement('div');
            groupDiv.className = 'tag-group fade-in-up';

            const title = document.createElement('h3');
            title.className = 'tag-group-title';
            title.textContent = group.phase.label;
            groupDiv.appendChild(title);

            if (group.phase.description) {
                const description = document.createElement('p');
                description.className = 'text-xs text-gray-400 mb-3';
                description.textContent = group.phase.description;
                groupDiv.appendChild(description);
            }

            const container = document.createElement('div');
            container.className = 'tag-group-container';
            container.dataset.groupName = group.phase.label;
            group.tags.forEach(tag => container.appendChild(createTagElement(tag)));
            groupDiv.appendChild(container);
            tagOutput.appendChild(groupDiv);
        });
    } else if (sortValue === 'danbooru' || sortValue === 'smart') {
        const grouped = sortTagsForDisplay(sortValue, visibleTags);
        grouped.forEach(({ category, tags }) => {
            if (!tags || !tags.length) return;

            const groupDiv = document.createElement('div');
            groupDiv.className = 'tag-group fade-in-up';
            groupDiv.innerHTML = `<h3 class="tag-group-title">${category}</h3>`;

            const container = document.createElement('div');
            container.className = 'tag-group-container';
            container.dataset.groupName = category;
            tags.forEach(tag => container.appendChild(createTagElement(tag)));
            groupDiv.appendChild(container);
            tagOutput.appendChild(groupDiv);
        });
    } else {
        let tagsToDisplay = sortTagsForDisplay(sortValue, visibleTags);
        if (!Array.isArray(tagsToDisplay)) tagsToDisplay = visibleTags;

        const container = document.createElement('div');
        container.className = 'tag-group-container';
        container.dataset.groupName = 'all';
        tagsToDisplay.forEach(tag => container.appendChild(createTagElement(tag)));
        tagOutput.appendChild(container);
    }

    if (['danbooru', 'smart', 'manual'].includes(sortValue)) {
        initSortable();
    } else {
        destroySortableInstances();
    }

    window.updateHiddenCategoriesBanner();
    updateStats();
    updatePromptPreview();
    window.refreshFavoriteIndicators();
    animateTagGroups();
}

function collectExportPayload() {
    const tags = getProcessedTagsForOutput();
    return {
        tags,
        prompt: buildFinalPrompt(),
        settings: {
            prepend: triggerInput?.value,
            append: appendInput?.value,
            maxTags: maxTagsInput?.value,
            sorting: sortSelect?.value,
            deduplicate: deduplicateToggle?.checked,
            underscores: underscoreToggle?.checked,
            weighting: enableWeightingToggle?.checked
        },
        hiddenCategories: Array.from(window.hiddenCategories),
        timestamp: new Date().toISOString()
    };
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function exportTags(format = 'json') {
    const payload = collectExportPayload();

    if (!payload.tags.length && !payload.prompt) {
        alert('Add some tags before exporting.');
        return;
    }

    const dateStamp = new Date().toISOString().split('T')[0];
    if (format === 'txt') {
        const textContent = payload.prompt || payload.tags.join(', ');
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        downloadBlob(blob, `danbooru-tags-${dateStamp}.txt`);
    } else {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `danbooru-tags-${dateStamp}.json`);
    }

    if (copyMessage) {
        copyMessage.textContent = `Exported ${format.toUpperCase()}!`;
        setTimeout(() => {
            if (copyMessage?.textContent === `Exported ${format.toUpperCase()}!`) {
                copyMessage.textContent = '';
            }
        }, 2500);
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
            setTimeout(() => {
                if (copyMessage?.textContent === 'Export JSON copied to clipboard!') {
                    copyMessage.textContent = '';
                }
            }, 2500);
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
        reader.onload = re => {
            try {
                const content = re.target?.result;
                if (typeof content !== 'string') return;

                if (file.name.endsWith('.json')) {
                    const data = JSON.parse(content);
                    if (data.prompt) {
                        if (tagInput) tagInput.value = data.prompt;
                    } else if (Array.isArray(data.tags) && tagInput) {
                        tagInput.value = data.tags.join(', ');
                    }

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
                        window.saveHiddenCategories();
                    }
                } else if (tagInput) {
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
        prepend: triggerInput?.value,
        append: appendInput?.value,
        swaps: swapsInput?.value,
        implications: implicationsInput?.value,
        blacklist: blacklistInput?.value,
        maxTags: maxTagsInput?.value,
        sorting: sortSelect?.value,
        deduplicate: deduplicateToggle?.checked,
        underscores: underscoreToggle?.checked,
        weighting: enableWeightingToggle?.checked,
        ratings: {
            safe: ratingSafe?.checked,
            general: ratingGeneral?.checked,
            questionable: ratingQuestionable?.checked
        }
    };

    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `danbooru-helper-settings-${new Date().toISOString().split('T')[0]}.json`);
}

function importSettings(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const settings = JSON.parse(e.target?.result);
            if (settings.theme) window.applyTheme(settings.theme);
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

            window.toggleSettingsPanel();
            processAll();
            if (copyMessage) {
                copyMessage.textContent = 'Settings imported!';
                setTimeout(() => {
                    if (copyMessage?.textContent === 'Settings imported!') {
                        copyMessage.textContent = '';
                    }
                }, 3000);
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
    window.applyTheme('theme-indigo');
    window.toggleSettingsPanel();
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
    if (window.baseTags.length === 0) return;
    for (let i = window.baseTags.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [window.baseTags[i], window.baseTags[j]] = [window.baseTags[j], window.baseTags[i]];
    }
    displayTags();
}

function optimizeOrder() {
    const categoryPriority = {
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
        const aPriority = categoryPriority[a.category] || 99;
        const bPriority = categoryPriority[b.category] || 99;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.original.localeCompare(b.original);
    });

    displayTags();
    if (copyMessage) {
        copyMessage.textContent = 'Tags optimized!';
        setTimeout(() => {
            if (copyMessage?.textContent === 'Tags optimized!') {
                copyMessage.textContent = '';
            }
        }, 2000);
    }
}

function suggestCoherentTags() {
    if (!window.tagCategorizer || !suggestionCountInput) return;

    const QUESTIONABLE_KEYWORDS = ['bikini', 'swimsuit', 'cleavage', 'breasts', 'ass', 'thighs', 'pantyhose', 'leotard', 'garter_belt', 'panty_shot', 'sideboob', 'topless', 'bra', 'panties', 'lingerie', 'seductive', 'bondage', 'shibari', 'partially_nude', 'armpits', 'bottomless'];
    const EXPLICIT_KEYWORDS = ['pussy', 'penis', 'sex', 'oral', 'ahegao', 'nude', 'naked', 'cum', 'masturbation', 'fellatio', 'cunnilingus', 'prolapse'];

    const numToSuggest = parseInt(suggestionCountInput.value, 10) || 0;
    if (numToSuggest <= 0) return;

    const existingTags = new Set(window.baseTags.map(t => t.original.toLowerCase().replace(/ /g, '_')));

    const allowQuestionable = ratingQuestionable ? ratingQuestionable.checked : true;
    const allowGeneral = ratingGeneral ? ratingGeneral.checked : true;
    const allowSafe = ratingSafe ? ratingSafe.checked : true;

    const isAllowed = tag => {
        if (EXPLICIT_KEYWORDS.some(kw => tag.includes(kw))) return false;
        if (!allowQuestionable && QUESTIONABLE_KEYWORDS.some(kw => tag.includes(kw))) return false;
        if (!allowGeneral && !allowSafe && !allowQuestionable) return false;
        return true;
    };

    const suggestions = new Set();
    const categoryPools = {};

    window.TAG_DATABASE.forEach(tag => {
        const categorization = window.tagCategorizer.categorize(tag);
        const poolKey = categorization.category || 'Uncategorized';
        if (!categoryPools[poolKey]) categoryPools[poolKey] = [];
        if (!existingTags.has(tag) && isAllowed(tag)) {
            categoryPools[poolKey].push(tag);
        }
    });

    const plan = (existingTags.size === 0)
        ? [
            { name: 'Quality', count: 1 },
            { name: 'Composition', count: 2 },
            { name: 'Characters', count: 1 },
            { name: 'Face', count: 2 },
            { name: 'Eyes', count: 1 },
            { name: 'Hair', count: 2 }
        ]
        : Object.entries(
            window.baseTags.reduce((acc, tag) => {
                acc[tag.category] = (acc[tag.category] || 0) + 1;
                return acc;
            }, {})
        ).map(([name, count]) => ({ name, count }));

    let suggestionsNeeded = numToSuggest;
    while (suggestionsNeeded > 0) {
        let madeSuggestion = false;
        for (const p of plan) {
            if (suggestionsNeeded <= 0) break;
            const pool = categoryPools[p.name] || [];
            for (let i = 0; i < p.count; i++) {
                if (pool.length > 0) {
                    const [suggestion] = pool.splice(Math.floor(Math.random() * pool.length), 1);
                    if (suggestion && !suggestions.has(suggestion)) {
                        suggestions.add(suggestion);
                        suggestionsNeeded--;
                        madeSuggestion = true;
                    }
                }
            }
        }
        if (!madeSuggestion) break;
    }

    const suggestionsToAdd = [...suggestions];
    if (suggestionsToAdd.length > 0 && tagInput) {
        const separator = tagInput.value.trim().length > 0 && !tagInput.value.trim().endsWith(',') ? ', ' : '';
        tagInput.value += separator + suggestionsToAdd.join(', ').replace(/_/g, ' ');
        processAll();
    }
}

window.initializeToken = initializeToken;
window.loadExternalData = loadExternalData;
window.copyTagsToClipboard = copyTagsToClipboard;
window.handleAutocompleteInput = handleAutocompleteInput;
window.handleAutocompleteKeydown = handleAutocompleteKeydown;
window.hideAutocomplete = hideAutocomplete;
window.selectAutocompleteItem = selectAutocompleteItem;
window.updateStats = updateStats;
window.getProcessedTagElements = getProcessedTagElements;
window.getActiveTags = getActiveTags;
window.getProcessedTagsForOutput = getProcessedTagsForOutput;
window.getPromptParts = getPromptParts;
window.buildFinalPrompt = buildFinalPrompt;
window.updatePromptPreview = updatePromptPreview;
window.processAll = processAll;
window.displayTags = displayTags;
window.submitCategoryUpdate = submitCategoryUpdate;
window.destroySortableInstances = destroySortableInstances;
window.initSortable = initSortable;
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
window.suggestCoherentTags = suggestCoherentTags;
window.downloadBlob = downloadBlob;
window.focusRelativeElement = focusRelativeElement;

window.updateTagWeight = (id, action) => {
    const tag = window.baseTags.find(t => t.id === id);
    if (!tag) return;

    let current = tag.weighted;
    const original = tag.original;

    if (action === 'increase') {
        if (current.startsWith('((')) current = `(((${original})))`;
        else if (current.startsWith('(')) current = `((${original}))`;
        else if (current.startsWith('[')) current = original;
        else current = `(${original})`;
    } else {
        if (current.startsWith('[[')) current = `[[[${original}]]]`;
        else if (current.startsWith('[')) current = `[[${original}]]`;
        else if (current.startsWith('(')) current = original;
        else current = `[${original}]`;
    }

    tag.weighted = current;
    displayTags();
};
