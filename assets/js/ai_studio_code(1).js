const GITHUB_USER = 'isaacwach24';
const GITHUB_REPO = 'isaacwach24.github.io';

let TAG_DATABASE = [], gitHubPat = null, tagCategorizer, tagIdCounter = 0;
let TAG_POPULARITY = {}; // For the optional popularity data
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
const howToPanel = element('howToPanel');
const copyJsonButton = element('copyJsonButton');

const HIDDEN_STORAGE_KEY = 'danbooru-muted-categories';
const FAVORITES_STORAGE_KEY = 'danbooru-tag-favorites';

const PROMPT_FLOW_PHASES = [
    { key: 'quality', label: 'Rendering & Quality', description: 'Lead with fidelity, rendering engines, lighting and post-processing cues.', categories: ['Quality', 'Style & Meta', 'Lighting & Effects', 'Rendering', 'Color & Lighting', 'Post-processing'], keywords: ['quality', 'masterpiece', 'best', 'render', 'lighting', 'hdr', 'ultra', 'detailed', 'cinematic', 'studio'] },
    { key: 'composition', label: 'Framing & Composition', description: 'Establish the shot, camera angle, framing and focus hierarchy.', categories: ['Composition', 'Camera & Perspective', 'Focus & Depth'], keywords: ['angle', 'shot', 'view', 'perspective', 'framing', 'focus', 'zoom', 'bokeh'] },
    { key: 'subjects', label: 'Primary Subjects', description: 'Identify the core characters or creatures the prompt should feature.', categories: ['Characters', 'Subject & Creatures'], keywords: ['girl', 'boy', 'woman', 'man', 'character', 'solo', 'duo', 'group', 'monster', 'animal'] },
    { key: 'features', label: 'Distinctive Features', description: 'Call out defining traits, anatomy and facial details.', categories: ['Face', 'Eyes', 'Hair', 'Body Parts'], keywords: ['eyes', 'hair', 'face', 'expression', 'smile', 'pose', 'body', 'figure', 'physique'] },
    { key: 'wardrobe', label: 'Wardrobe & Props', description: 'Describe outfits, accessories and notable equipment.', categories: ['Attire', 'Accessories', 'Held Items & Objects'], keywords: ['outfit', 'uniform', 'dress', 'armor', 'suit', 'clothing', 'accessory', 'weapon', 'holding', 'prop'] },
    { key: 'action', label: 'Action & Interaction', description: 'Capture the motion, pose or interaction taking place.', categories: ['Actions & Poses', 'Interaction'], keywords: ['standing', 'sitting', 'running', 'jumping', 'dancing', 'gesturing', 'hugging', 'fighting', 'pose'] },
    { key: 'environment', label: 'Environment & Atmosphere', description: 'Set the scene, background, weather and ambient mood.', categories: ['Setting & Environment', 'Background Elements', 'Weather & Atmosphere'], keywords: ['background', 'landscape', 'indoors', 'outdoors', 'city', 'forest', 'room', 'sky', 'sunset', 'night', 'rain', 'storm'] },
    { key: 'extras', label: 'Finishing Touches', description: 'Add final stylistic or catch-all descriptors.', categories: ['Uncategorized', 'Meta'], keywords: ['signature', 'watermark', 'text', 'border', 'frame'] }
];
const FLOW_PHASE_PRIORITY_KEYWORDS = {
    quality: [['masterpiece', 8], ['best quality', 7], ['ultra detailed', 6], ['cinematic lighting', 5], ['dramatic lighting', 4], ['8k', 3], ['4k', 3], ['hdr', 2]],
    composition: [['dynamic angle', 4], ['wide shot', 3], ['close-up', 3], ['looking at viewer', 2], ['from below', 2], ['from above', 2]],
    subjects: [['solo', 5], ['duo', 4], ['group', 3], ['portrait', 3], ['full body', 2], ['character focus', 4]],
    features: [['expression', 4], ['smile', 3], ['eye contact', 3], ['detailed eyes', 4], ['hair', 2], ['body', 2]],
    wardrobe: [['uniform', 4], ['dress', 4], ['armor', 4], ['outfit', 3], ['accessories', 2], ['weapon', 3], ['holding', 2]],
    action: [['dynamic pose', 4], ['action', 3], ['jumping', 3], ['running', 3], ['dancing', 2], ['gesturing', 2], ['standing', 1], ['sitting', 1]],
    environment: [['dramatic sky', 4], ['sunset', 4], ['night', 3], ['rain', 3], ['forest', 3], ['city', 3], ['indoors', 2], ['outdoors', 2], ['background', 2]],
    extras: [['clean background', 2], ['no text', 2], ['signature', -3], ['watermark', -4]]
};
const ILLUSTRIOUS_PROMPT_PHASES = [
    { key: 'artistStyle', label: 'Artist & Style', description: 'Optionally begin with artist tags or stylistic influences (use weights to blend as needed).', categories: ['Artists', 'Style & Meta', 'Rendering'], keywords: ['style', 'artist', 'redrop', 'semi-realistic', 'illustration', 'inspired', '90s anime', 'artstyle', 'digital painting'] },
    { key: 'subject', label: 'Subjects & Traits', description: 'Describe character counts, core traits, hair, eyes and wardrobe details.', categories: ['Characters', 'Subject & Creatures', 'Face', 'Eyes', 'Hair', 'Body Parts', 'Attire', 'Accessories'], keywords: ['1girl', '1boy', 'character', 'girl', 'boy', 'woman', 'man', 'hair', 'eyes', 'uniform', 'dress', 'maid', 'armor'] },
    { key: 'pose', label: 'Pose, Action & Expression', description: 'Add motions, gestures and expressions that define what is happening.', categories: ['Actions & Poses', 'Interaction', 'Emotion & Expression', 'Camera & Perspective'], keywords: ['pose', 'standing', 'sitting', 'running', 'jumping', 'holding', 'gesture', 'smile', 'angry', 'expression', 'middle finger', 'peace sign'] },
    { key: 'scene', label: 'Scene & Background', description: 'Outline the setting, time of day and environmental context.', categories: ['Setting & Environment', 'Background Elements', 'Weather & Atmosphere'], keywords: ['background', 'indoors', 'outdoors', 'cafe', 'forest', 'city', 'sunset', 'daytime', 'night', 'sky', 'landscape'] },
    { key: 'effects', label: 'Effects & Aesthetic Detail', description: 'Finish descriptive details with lighting, particles or stylistic flourishes.', categories: ['Lighting & Effects', 'Post-processing', 'Color & Lighting', 'Meta'], keywords: ['dramatic lighting', 'bokeh', 'glow', 'particles', 'effect', 'aesthetic', 'watercolor', 'film grain'] },
    { key: 'quality', label: 'Quality Boosters', description: 'Close with global quality tags to reinforce rendering fidelity.', categories: ['Quality'], keywords: ['masterpiece', 'best quality', 'ultra detailed', 'highres', '8k', '4k', 'hdr'] }
];
const ILLUSTRIOUS_PHASE_PRIORITY_KEYWORDS = {
    artistStyle: [['style', 4], ['artist', 4], ['redrop', 3], ['semi-realistic', 3], ['illustration', 2], ['90s anime', 2], ['artstyle', 2], ['digital painting', 2]],
    subject: [['girl', 4], ['boy', 3], ['character', 4], ['hair', 3], ['eyes', 3], ['uniform', 2], ['dress', 2], ['maid', 2], ['armor', 2]],
    pose: [['pose', 4], ['standing', 3], ['sitting', 3], ['running', 3], ['holding', 2], ['gesture', 2], ['smile', 2], ['angry', 2], ['expression', 3]],
    scene: [['background', 4], ['cafe', 3], ['forest', 3], ['city', 3], ['indoors', 2], ['outdoors', 2], ['sunset', 3], ['daytime', 2], ['night', 2], ['sky', 2]],
    effects: [['lighting', 4], ['dramatic', 3], ['bokeh', 3], ['glow', 3], ['particles', 2], ['watercolor', 2], ['effect', 2], ['film grain', 2]],
    quality: [['masterpiece', 8], ['best quality', 7], ['ultra detailed', 6], ['highres', 5], ['8k', 4], ['4k', 3], ['hdr', 3]]
};

function createPromptFlowConfig(phases, priorityKeywords, fallbackKey) { const processedPhases = phases.map(phase => ({ ...phase, keywordMatchers: (phase.keywords || []).map(keyword => keyword.toLowerCase()) })); const categoryMap = new Map(); processedPhases.forEach(phase => { (phase.categories || []).forEach(categoryName => categoryMap.set(categoryName, phase.key)); }); return { phases: processedPhases, priorityKeywords, fallbackKey: fallbackKey || (processedPhases[processedPhases.length - 1] || {}).key, categoryMap }; }
const PROMPT_FLOW_CONFIG = createPromptFlowConfig(PROMPT_FLOW_PHASES, FLOW_PHASE_PRIORITY_KEYWORDS, 'extras');
const ILLUSTRIOUS_FLOW_CONFIG = createPromptFlowConfig(ILLUSTRIOUS_PROMPT_PHASES, ILLUSTRIOUS_PHASE_PRIORITY_KEYWORDS, 'quality');
const categoryPickerState = { tagId: null };
function debounce(fn, wait = 300) { let timeout; return function(...args) { const context = this; clearTimeout(timeout); timeout = setTimeout(() => fn.apply(context, args), wait); }; }

class EnhancedTagCategorizer {
    constructor(tagMap, allTags, categoryOrder) { this.primaryIndex = tagMap; this.categoryOrder = categoryOrder; this.categories = [...new Set([...Object.values(tagMap), ...categoryOrder, 'Uncategorized'])]; this.patternIndex = { ends: {}, starts: {} }; this.keywordIndex = {}; this.buildHeuristicIndexes(allTags); this.buildEnhancedHeuristics(); }
    buildHeuristicIndexes(allTags) { const keywordCategoryCounts = {}; const suffixCategoryCounts = {}; const prefixCategoryCounts = {}; const COPYRIGHT_KEYWORDS = new Set(['(genshin_impact)', '(azur_lane)', '(touhou)', '(hololive)', '(fate/grand_order)']); allTags.forEach(tag => { const category = this.primaryIndex[tag]; if (!category) return; const words = tag.split('_'); if (words.length > 1) { words.forEach(word => { if (word.length < 4 || COPYRIGHT_KEYWORDS.has(word)) return; if (!keywordCategoryCounts[word]) keywordCategoryCounts[word] = {}; keywordCategoryCounts[word][category] = (keywordCategoryCounts[word][category] || 0) + 1; }); const suffix = words[words.length - 1]; if (!suffixCategoryCounts[suffix]) suffixCategoryCounts[suffix] = {}; suffixCategoryCounts[suffix][category] = (suffixCategoryCounts[suffix][category] || 0) + 1; const prefix = words[0]; if (!prefixCategoryCounts[prefix]) prefixCategoryCounts[prefix] = {}; prefixCategoryCounts[prefix][category] = (prefixCategoryCounts[prefix][category] || 0) + 1; } }); for (const keyword in keywordCategoryCounts) { const counts = keywordCategoryCounts[keyword]; const total = Object.values(counts).reduce((s, c) => s + c, 0); const [mostLikelyCategory, categoryCount] = Object.entries(counts).reduce((a, b) => a[1] > b[1] ? a : b); if (total > 5 && (categoryCount / total) > 0.8) this.keywordIndex[keyword] = mostLikelyCategory; } for (const suffix in suffixCategoryCounts) { const counts = suffixCategoryCounts[suffix]; const total = Object.values(counts).reduce((s, c) => s + c, 0); const [mostLikelyCategory, categoryCount] = Object.entries(counts).reduce((a, b) => a[1] > b[1] ? a : b); if (total > 10 && (categoryCount / total) > 0.75) this.patternIndex.ends[`_${suffix}`] = mostLikelyCategory; } for (const prefix in prefixCategoryCounts) { const counts = prefixCategoryCounts[prefix]; const total = Object.values(counts).reduce((s, c) => s + c, 0); const [mostLikelyCategory, categoryCount] = Object.entries(counts).reduce((a, b) => a[1] > b[1] ? a : b); if (total > 10 && (categoryCount / total) > 0.75) this.patternIndex.starts[`${prefix}_`] = mostLikelyCategory; } }
    buildEnhancedHeuristics() { this.characterPatterns = [ /\([^)]+\)$/, /_\([^)]+\)$/, /^[a-z]+_[a-z]+_\([^)]+\)$/ ]; this.qualityKeywords = new Set(['quality', 'masterpiece', 'best', 'high', 'ultra', 'super', 'extremely', 'detailed', 'resolution', 'res', '4k', '8k', 'hd', 'uhd', 'absurdres']); this.compositionKeywords = new Set(['shot', 'view', 'angl