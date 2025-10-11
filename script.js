// Global vars
let tagMap = {};
let baseTags = [];
let copyHistory = [];
let hiddenCategories = new Set();
let favorites = new Set();
let gitHubPat = '';
const GITHUB_USER = 'isaacwach234';
const GITHUB_REPO = 'danbooru-tag-helper';

// e621 mappings (small hardcoded from research; expand to JSON)
const e621Mappings = {
  'feral': 'animal',
  'anthro': 'humanoid',
  // Add more as needed
};

// Implications (basic from Danbooru wiki)
const implications = {
  '1girl': ['solo'],
  'blonde_hair': ['hair'], // Example
  // Add more
};

// Levenshtein distance for fuzzy mapping
function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function similarity(a, b) {
  const longer = Math.max(a.length, b.length);
  return (longer - levenshtein(a, b)) / longer;
}

// Element getter
function element(id) {
  return document.getElementById(id);
}

// Load tag map
async function loadTagMap() {
  try {
    const response = await fetch('tag_map.json');
    tagMap = await response.json();
    // Apply hierarchical structure if missing (for backward compat)
    Object.keys(tagMap).forEach(key => {
      if (typeof tagMap[key] === 'string') {
        tagMap[key] = { booru_type: 'general', subcategory: tagMap[key] };
      }
    });
  } catch (err) {
    console.error('Failed to load tag_map.json:', err);
  }
}

// Categorize tag with advanced mapping
function categorizeTag(tag) {
  let mapping = tagMap[tag];
  if (mapping) return mapping;

  // Fuzzy search
  let bestMatch = null;
  let bestScore = 0;
  for (let knownTag in tagMap) {
    const score = similarity(tag, knownTag);
    if (score > 0.8 && score > bestScore) {
      bestScore = score;
      bestMatch = tagMap[knownTag];
    }
  }
  if (bestMatch) {
    mapping = { ...bestMatch, fuzzy: true };
    tagMap[tag] = mapping; // Cache
    return mapping;
  }

  // Keyword fallback
  const keywords = {
    hair: { booru_type: 'general', subcategory: 'Hair' },
    eye: { booru_type: 'general', subcategory: 'Eyes' },
    // Add more keywords
  };
  for (let kw in keywords) {
    if (tag.includes(kw)) return keywords[kw];
  }

  return { booru_type: 'general', subcategory: 'Uncategorized' };
}

// e621 mode adjustments
function applyE621Mode(tags) {
  if (!element('e621ModeToggle').checked) return tags;
  return tags.map(tag => {
    const alias = e621Mappings[tag];
    return alias || `species:${tag}`;
  });
}

// Process tags
function processTags(inputTags) {
  let tags = inputTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

  // Remove weights if toggle on
  if (element('removeWeightsToggle').checked) {
    tags = tags.map(tag => tag.replace(/\([^)]*:?\d*\.?\d*\)/g, '').trim()).filter(Boolean);
  }

  // Blacklist
  const blacklist = element('blacklistInput').value.split(',').map(t => t.trim().toLowerCase());
  tags = tags.filter(tag => !blacklist.some(b => tag.includes(b)));

  // Deduplicate
  if (element('deduplicateToggle').checked) {
    tags = [...new Set(tags)];
  }

  // Underscores
  if (element('underscoreToggle').checked) {
    tags = tags.map(tag => tag.replace(/ /g, '_'));
  }

  // Categorize
  baseTags = tags.map(tag => ({ original: tag, ...categorizeTag(tag) }));

  // Implications (basic)
  baseTags.forEach(t => {
    const implied = implications[t.original];
    if (implied) {
      implied.forEach(i => {
        if (!baseTags.some(bt => bt.original === i)) {
          baseTags.push({ original: i, ...categorizeTag(i), implied: true });
        }
      });
    }
  });

  // Limit
  const max = parseInt(element('maxTagsInput').value) || 75;
  baseTags = baseTags.slice(0, max);

  // e621
  baseTags = applyE621Mode(baseTags.map(t => t.original)).map((t, i) => ({ ...baseTags[i], original: t }));

  updateOverTagWarning(baseTags.length);
  return baseTags;
}

// Illustrious ordering buckets mapping
const illustriousBuckets = {
  'artist_style': ['Style & Meta', 'Characters'], // Artist/Style
  'subject_char': ['Quality', 'Characters', 'Subject & Creatures', 'Body Parts', 'Hair', 'Eyes'], // Subject/Character
  'pose_action': ['Actions & Poses', 'Face'], // Pose/Action/Expression
  'scene_bg': ['Setting & Environment', 'Composition'], // Scene/Background
  'effects_detail': ['Style & Meta'], // Effects (filter non-quality meta)
  'quality': ['Quality'] // Quality
};

function sortIllustrious(tags) {
  const buckets = {};
  Object.keys(illustriousBuckets).forEach(bucket => {
    buckets[bucket] = tags.filter(t => illustriousBuckets[bucket].includes(t.subcategory));
  });
  return Object.values(buckets).flat();
}

// Display tags
function displayTags() {
  const sort = element('sortSelect').value;
  let sorted = [...baseTags];

  if (sort === 'alpha-asc') sorted.sort((a, b) => a.original.localeCompare(b.original));
  else if (sort === 'alpha-desc') sorted.sort((a, b) => b.original.localeCompare(a.original));
  else if (sort === 'illustrious') sorted = sortIllustrious(sorted);
  // danbooru: original order

  // Render containers
  renderTagContainer('triggersContainer', element('triggerInput').value.split(',').map(t => ({ original: t.trim() })));
  renderTagContainer('processedTagsContainer', sorted, true);
  renderTagContainer('appendsContainer', element('appendInput').value.split(',').map(t => ({ original: t.trim() })));

  updatePromptPreview();
  updateStats();
}

// Render tag container
function renderTagContainer(containerId, tags, isProcessed = false) {
  const container = element(containerId);
  container.innerHTML = '';
  tags.forEach(tag => {
    const el = document.createElement('div');
    el.className = 'tag-base';
    el.textContent = tag.original;
    if (isProcessed && tag.implied) el.classList.add('opacity-50');
    container.appendChild(el);
  });
}

// Update prompt preview
function updatePromptPreview() {
  const prepend = element('triggerInput').value;
  const processed = baseTags.map(t => t.original).join(', ');
  const append = element('appendInput').value;
  element('promptPreview').value = [prepend, processed, append].filter(Boolean).join(', ');
}

// Copy to clipboard
function copyTagsToClipboard() {
  const prompt = element('promptPreview').value;
  navigator.clipboard.writeText(prompt).then(() => {
    element('copyMessage').textContent = 'Copied!';
    setTimeout(() => element('copyMessage').textContent = '', 2000);
  });
  // Add to history
  copyHistory.unshift(prompt);
  if (copyHistory.length > 50) copyHistory.pop();
  localStorage.setItem('danbooru-tag-history', JSON.stringify(copyHistory));
}

// Update over-tag warning
function updateOverTagWarning(count) {
  const warning = element('overTagWarning');
  warning.classList.toggle('hidden', count <= 75);
}

// Update stats
function updateStats() {
  const activeTags = baseTags.length;
  const maxTags = parseInt(element('maxTagsInput').value, 10) || 75;
  const categoryCount = new Set(baseTags.map(t => t.subcategory)).size;
  const historyCount = copyHistory.length;

  element('tagCount').textContent = activeTags;
  element('maxTagCount').textContent = maxTags;
  element('categoryCount').textContent = categoryCount;
  element('historyCount').textContent = historyCount;
  element('processedTagCount').textContent = activeTags;
  element('processedTagCountInline').textContent = activeTags;

  const tagCountEl = element('tagCount');
  const percentage = maxTags ? (activeTags / maxTags) * 100 : 0;
  tagCountEl.style.color = percentage > 90 ? '#ef4444' : percentage > 75 ? '#f59e0b' : 'var(--accent-color)';
}

// Debounce
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// Main process
const debouncedProcess = debounce(() => {
  const input = element('tagInput').value;
  baseTags = processTags(input);
  displayTags();
}, 300);

function processAll() {
  debouncedProcess();
}

// Event listeners setup
function initEventListeners() {
  // Inputs
  element('tagInput').addEventListener('input', processAll);
  [element('triggerInput'), element('appendInput'), element('blacklistInput'), element('maxTagsInput')].forEach(el => {
    if (el) el.addEventListener('input', processAll);
  });
  [element('deduplicateToggle'), element('underscoreToggle'), element('removeWeightsToggle'), element('e621ModeToggle'), element('sortSelect')].forEach(el => {
    if (el) el.addEventListener('change', () => { processAll(); displayTags(); });
  });

  // Buttons
  element('copyButton').addEventListener('click', copyTagsToClipboard);
  element('promptPreviewCopy').addEventListener('click', copyTagsToClipboard);
  element('suggestBtn').addEventListener('click', () => { /* Suggest logic placeholder */ alert('Suggest coming soon!'); });
  element('exportSettingsBtn').addEventListener('click', exportSettings);
  element('importSettingsBtn').addEventListener('click', () => element('importSettingsInput').click());
  element('resetDefaultsBtn').addEventListener('click', resetToDefaults);
  element('importSettingsInput').addEventListener('change', importSettings);

  // Settings toggle
  // Add button for settings if needed
}

// Settings functions (adapted)
function exportSettings() {
  const settings = {
    // ... (as in original)
  };
  const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `settings.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importSettings(e) {
  // ... (as in original, adapted for new toggles)
  element('underscoreToggle').checked = false; // Ensure false
}

function resetToDefaults() {
  if (confirm('Reset?')) {
    element('tagInput').value = '';
    element('triggerInput').value = '';
    element('appendInput').value = '';
    element('blacklistInput').value = '';
    element('maxTagsInput').value = '75';
    element('sortSelect').value = 'danbooru';
    element('deduplicateToggle').checked = true;
    element('underscoreToggle').checked = false; // Key change
    element('removeWeightsToggle').checked = false;
    element('e621ModeToggle').checked = false;
    processAll();
  }
}

// Theme (kept minimal)
function applyTheme(theme) {
  document.body.className = `p-4 md:p-6 lg:p-8 ${theme}`;
  localStorage.setItem('danbooru-tag-helper-theme', theme);
}

// Init
async function init() {
  await loadTagMap();
  const savedTheme = localStorage.getItem('danbooru-tag-helper-theme') || 'theme-indigo';
  applyTheme(savedTheme);
  initEventListeners();
  resetToDefaults(); // Sets underscore false
  const savedHistory = localStorage.getItem('danbooru-tag-history');
  if (savedHistory) copyHistory = JSON.parse(savedHistory);
  processAll();
}

document.addEventListener('DOMContentLoaded', init);

// GSAP entrance (if !reduced motion)
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!prefersReducedMotion && window.gsap) {
  gsap.from('.glass-panel', { opacity: 0, y: 32, duration: 0.8, stagger: 0.1, ease: 'power3.out' });
    }
