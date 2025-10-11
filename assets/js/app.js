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
const howToPanel = element('howToPanel');
const copyJsonButton = element('copyJsonButton');

const HIDDEN_STORAGE_KEY = 'danbooru-muted-categories';
const FAVORITES_STORAGE_KEY = 'danbooru-tag-favorites';

const PROMPT_FLOW_PHASES = [
    {
        key: 'quality',
        label: 'Rendering & Quality',
        description: 'Lead with fidelity, rendering engines, lighting and post-processing cues.',
        categories: ['Quality', 'Style & Meta', 'Lighting & Effects', 'Rendering', 'Color & Lighting', 'Post-processing'],
        keywords: ['quality', 'masterpiece', 'best', 'render', 'lighting', 'hdr', 'ultra', 'detailed', 'cinematic', 'studio']
    },
    {
        key: 'composition',
        label: 'Framing & Composition',
        description: 'Establish the shot, camera angle, framing and focus hierarchy.',
        categories: ['Composition', 'Camera & Perspective', 'Focus & Depth'],
        keywords: ['angle', 'shot', 'view', 'perspective', 'framing', 'focus', 'zoom', 'bokeh']
    },
    {
        key: 'subjects',
        label: 'Primary Subjects',
        description: 'Identify the core characters or creatures the prompt should feature.',
        categories: ['Characters', 'Subject & Creatures'],
        keywords: ['girl', 'boy', 'woman', 'man', 'character', 'solo', 'duo', 'group', 'monster', 'animal']
    },
    {
        key: 'features',
        label: 'Distinctive Features',
        description: 'Call out defining traits, anatomy and facial details.',
        categories: ['Face', 'Eyes', 'Hair', 'Body Parts'],
        keywords: ['eyes', 'hair', 'face', 'expression', 'smile', 'pose', 'body', 'figure', 'physique']
    },
    {
        key: 'wardrobe',
        label: 'Wardrobe & Props',
        description: 'Describe outfits, accessories and notable equipment.',
        categories: ['Attire', 'Accessories', 'Held Items & Objects'],
        keywords: ['outfit', 'uniform', 'dress', 'armor', 'suit', 'clothing', 'accessory', 'weapon', 'holding', 'prop']
    },
    {
        key: 'action',
        label: 'Action & Interaction',
        description: 'Capture the motion, pose or interaction taking place.',
        categories: ['Actions & Poses', 'Interaction'],
        keywords: ['standing', 'sitting', 'running', 'jumping', 'dancing', 'gesturing', 'hugging', 'fighting', 'pose']
    },
    {
        key: 'environment',
        label: 'Environment & Atmosphere',
        description: 'Set the scene, background, weather and ambient mood.',
        categories: ['Setting & Environment', 'Background Elements', 'Weather & Atmosphere'],
        keywords: ['background', 'landscape', 'indoors', 'outdoors', 'city', 'forest', 'room', 'sky', 'sunset', 'night', 'rain', 'storm']
    },
    {
        key: 'extras',
        label: 'Finishing Touches',
        description: 'Add final stylistic or catch-all descriptors.',
        categories: ['Uncategorized', 'Meta'],
        keywords: ['signature', 'watermark', 'text', 'border', 'frame']
    }
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
    {
        key: 'artistStyle',
        label: 'Artist & Style',
        description: 'Optionally begin with artist tags or stylistic influences (use weights to blend as needed).',
        categories: ['Artists', 'Style & Meta', 'Rendering'],
        keywords: ['style', 'artist', 'redrop', 'semi-realistic', 'illustration', 'inspired', '90s anime', 'artstyle', 'digital painting']
    },
    {
        key: 'subject',
        label: 'Subjects & Traits',
        description: 'Describe character counts, core traits, hair, eyes and wardrobe details.',
        categories: ['Characters', 'Subject & Creatures', 'Face', 'Eyes', 'Hair', 'Body Parts', 'Attire', 'Accessories'],
        keywords: ['1girl', '1boy', 'character', 'girl', 'boy', 'woman', 'man', 'hair', 'eyes', 'uniform', 'dress', 'maid', 'armor']
    },
    {
        key: 'pose',
        label: 'Pose, Action & Expression',
        description: 'Add motions, gestures and expressions that define what is happening.',
        categories: ['Actions & Poses', 'Interaction', 'Emotion & Expression', 'Camera & Perspective'],
        keywords: ['pose', 'standing', 'sitting', 'running', 'jumping', 'holding', 'gesture', 'smile', 'angry', 'expression', 'middle finger', 'peace sign']
    },
    {
        key: 'scene',
        label: 'Scene & Background',
        description: 'Outline the setting, time of day and environmental context.',
        categories: ['Setting & Environment', 'Background Elements', 'Weather & Atmosphere'],
        keywords: ['background', 'indoors', 'outdoors', 'cafe', 'forest', 'city', 'sunset', 'daytime', 'night', 'sky', 'landscape']
    },
    {
        key: 'effects',
        label: 'Effects & Aesthetic Detail',
        description: 'Finish descriptive details with lighting, particles or stylistic flourishes.',
        categories: ['Lighting & Effects', 'Post-processing', 'Color & Lighting', 'Meta'],
        keywords: ['dramatic lighting', 'bokeh', 'glow', 'particles', 'effect', 'aesthetic', 'watercolor', 'film grain']
    },
    {
        key: 'quality',
        label: 'Quality Boosters',
        description: 'Close with global quality tags to reinforce rendering fidelity.',
        categories: ['Quality'],
        keywords: ['masterpiece', 'best quality', 'ultra detailed', 'highres', '8k', '4k', 'hdr']
    }
];

const ILLUSTRIOUS_PHASE_PRIORITY_KEYWORDS = {
    artistStyle: [['style', 4], ['artist', 4], ['redrop', 3], ['semi-realistic', 3], ['illustration', 2], ['90s anime', 2], ['artstyle', 2], ['digital painting', 2]],
    subject: [['girl', 4], ['boy', 3], ['character', 4], ['hair', 3], ['eyes', 3], ['uniform', 2], ['dress', 2], ['maid', 2], ['armor', 2]],
    pose: [['pose', 4], ['standing', 3], ['sitting', 3], ['running', 3], ['holding', 2], ['gesture', 2], ['smile', 2], ['angry', 2], ['expression', 3]],
    scene: [['background', 4], ['cafe', 3], ['forest', 3], ['city', 3], ['indoors', 2], ['outdoors', 2], ['sunset', 3], ['daytime', 2], ['night', 2], ['sky', 2]],
    effects: [['lighting', 4], ['dramatic', 3], ['bokeh', 3], ['glow', 3], ['particles', 2], ['watercolor', 2], ['effect', 2], ['film grain', 2]],
    quality: [['masterpiece', 8], ['best quality', 7], ['ultra detailed', 6], ['highres', 5], ['8k', 4], ['4k', 3], ['hdr', 3]]
};

function createPromptFlowConfig(phases, priorityKeywords, fallbackKey) {
    const processedPhases = phases.map(phase => ({
        ...phase,
        keywordMatchers: (phase.keywords || []).map(keyword => keyword.toLowerCase())
    }));
    const categoryMap = new Map();
    processedPhases.forEach(phase => {
        (phase.categories || []).forEach(categoryName => categoryMap.set(categoryName, phase.key));
    });
    return {
        phases: processedPhases,
        priorityKeywords,
        fallbackKey: fallbackKey || (processedPhases[processedPhases.length - 1] || {}).key,
        categoryMap
    };
}

const PROMPT_FLOW_CONFIG = createPromptFlowConfig(PROMPT_FLOW_PHASES, FLOW_PHASE_PRIORITY_KEYWORDS, 'extras');
const ILLUSTRIOUS_FLOW_CONFIG = createPromptFlowConfig(ILLUSTRIOUS_PROMPT_PHASES, ILLUSTRIOUS_PHASE_PRIORITY_KEYWORDS, 'quality');

const DEFAULT_E621_PROMPT_PHASES = [
    {
        key: 'safety',
        label: 'Ratings & Content Flags',
        description: 'Start by declaring the safety level or moderation target for the render.',
        categories: ['E621 · Safety & Ratings'],
        keywords: ['safe', 'suggestive', 'questionable', 'explicit', 'rating']
    },
    {
        key: 'identity',
        label: 'Characters & Counts',
        description: 'Summarize how many characters appear and any identifying qualifiers.',
        categories: ['E621 · Identity & Counts', 'E621 · Creator Credit'],
        keywords: ['solo', 'duo', 'group', 'male', 'female', 'herm', 'artist']
    },
    {
        key: 'species',
        label: 'Species & Body Plan',
        description: 'Describe the species, hybrid forms, and silhouette-level body plan.',
        categories: ['E621 · Species & Body'],
        keywords: ['anthro', 'feral', 'dragon', 'taur', 'alien', 'robotic']
    },
    {
        key: 'traits',
        label: 'Anatomy & Visual Traits',
        description: 'Call out anatomy, markings, fashion, and other visual traits.',
        categories: ['E621 · Anatomy & Traits', 'E621 · Descriptors & Style'],
        keywords: ['tail', 'ears', 'markings', 'horn', 'wing', 'fur', 'scales', 'style']
    },
    {
        key: 'action',
        label: 'Poses & Interactions',
        description: 'Outline the pose, activity, or interpersonal interactions.',
        categories: ['E621 · Actions & Interaction'],
        keywords: ['standing', 'flying', 'hugging', 'combat', 'posing', 'gesture']
    },
    {
        key: 'props',
        label: 'Gear & Accessories',
        description: 'List equipment, outfits, or notable props.',
        categories: ['E621 · Props & Gear'],
        keywords: ['armor', 'weapon', 'collar', 'instrument', 'uniform']
    },
    {
        key: 'setting',
        label: 'Setting & Atmosphere',
        description: 'Frame the location, weather, and time of day.',
        categories: ['E621 · Setting & Atmosphere', 'E621 · Franchise & Lore'],
        keywords: ['forest', 'city', 'space', 'indoors', 'outdoors', 'castle', 'canon']
    },
    {
        key: 'effects',
        label: 'Effects & Energy',
        description: 'Describe magical, elemental, or cinematic effects.',
        categories: ['E621 · Effects & Lighting'],
        keywords: ['magic', 'glow', 'spark', 'energy', 'aura', 'particles']
    },
    {
        key: 'quality',
        label: 'Quality & Output',
        description: 'Close with render fidelity, post-processing, or metadata cues.',
        categories: ['E621 · Quality & Output', 'E621 · Technical & Meta'],
        keywords: ['highres', 'dynamic', 'detail', 'render', 'signature', 'watermark']
    }
];

const DEFAULT_E621_PRIORITY_KEYWORDS = {
    safety: [['explicit', 5], ['questionable', 4], ['suggestive', 3], ['safe', 2]],
    identity: [['solo', 5], ['duo', 4], ['group', 3], ['male', 2], ['female', 2], ['artist', 2]],
    species: [['anthro', 4], ['feral', 4], ['dragon', 4], ['taur', 3], ['alien', 3], ['robotic', 3]],
    traits: [['markings', 3], ['tail', 3], ['horn', 2], ['wing', 2], ['fur', 2], ['scales', 2], ['style', 2]],
    action: [['flying', 4], ['combat', 4], ['hugging', 3], ['posing', 3], ['gesture', 2]],
    props: [['weapon', 4], ['armor', 4], ['collar', 2], ['instrument', 2], ['uniform', 2]],
    setting: [['forest', 3], ['city', 3], ['space', 3], ['indoors', 2], ['outdoors', 2], ['canon', 2]],
    effects: [['magic', 4], ['glow', 4], ['spark', 3], ['energy', 3], ['particles', 2]],
    quality: [['highres', 4], ['dynamic', 3], ['detail', 3], ['render', 3], ['signature', -2], ['watermark', -3]]
};

let E621_FLOW_CONFIG = createPromptFlowConfig(DEFAULT_E621_PROMPT_PHASES, DEFAULT_E621_PRIORITY_KEYWORDS, 'quality');

const categoryPickerState = { tagId: null };

function debounce(fn, wait = 300) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(context, args), wait);
    };
}

function getActiveProfile() {
    const value = sortSelect?.value || 'danbooru';
    return value === 'e621' ? 'e621' : 'danbooru';
}

function getTagProfileEntry(tag, profile = 'danbooru') {
    if (!tag) return null;
    if (!profile || profile === 'danbooru') {
        return { category: tag.category || 'Uncategorized', source: tag.categorySource || 'Hybrid', confidence: tag.confidence };
    }
    if (tag.profileCategories && tag.profileCategories[profile]) {
        return tag.profileCategories[profile];
    }
    return null;
}

function getTagCategoryForProfile(tag, profile = 'danbooru') {
    const entry = getTagProfileEntry(tag, profile);
    return (entry && entry.category) || 'Uncategorized';
}

function getTagSourceForProfile(tag, profile = 'danbooru') {
    const entry = getTagProfileEntry(tag, profile);
    return (entry && entry.source) || tag.categorySource || 'Hybrid';
}

class EnhancedTagCategorizer {
    constructor(tagMap, allTags, categoryOrder, options = {}) {
        this.primaryIndex = { ...(tagMap || {}) };
        this.categoryOrder = Array.isArray(categoryOrder) ? [...categoryOrder] : [];
        this.categorySet = new Set([...Object.values(this.primaryIndex), ...this.categoryOrder, 'Uncategorized']);
        this.refreshCategoryList();
        this.patternIndex = { ends: {}, starts: {} };
        this.keywordIndex = {};
        this.e621CategoryMap = {};
        this.e621KeywordHints = {};
        this.e621SuffixHints = {};
        this.e621PrefixHints = {};
        this.e621CompositeHints = [];
        this.e621DirectMap = {};
        this.e621CategoryOrder = [];
        this.e621FallbackCategory = 'E621 · Uncategorized';
        this.ontologyKeywordMap = {};
        this.ontologyRegexRules = [];
        this.ontologyComboRules = [];
        this.comboKeywordIndex = {};
        this.profileCategoryOrder = { danbooru: [...this.categoryOrder], e621: [] };
        if (!this.profileCategoryOrder.danbooru.includes('Uncategorized')) {
            this.profileCategoryOrder.danbooru.push('Uncategorized');
        }
        this.profileCategorySet = { danbooru: new Set(this.categoryOrder), e621: new Set() };
        this.profileCategorySet.danbooru.add('Uncategorized');
        this.registerProfileCategory('e621', this.e621FallbackCategory);
        this.danbooruToE621Map = {
            'Quality': 'E621 · Quality & Output',
            'Artists': 'E621 · Creator Credit',
            'Composition': 'E621 · Descriptors & Style',
            'Characters': 'E621 · Identity & Counts',
            'Subject & Creatures': 'E621 · Species & Body',
            'Emotion & Expression': 'E621 · Descriptors & Style',
            'Face': 'E621 · Anatomy & Traits',
            'Eyes': 'E621 · Anatomy & Traits',
            'Hair': 'E621 · Anatomy & Traits',
            'Body Parts': 'E621 · Anatomy & Traits',
            'Attire': 'E621 · Props & Gear',
            'Accessories': 'E621 · Props & Gear',
            'Held Items & Objects': 'E621 · Props & Gear',
            'Actions & Poses': 'E621 · Actions & Interaction',
            'Interaction': 'E621 · Actions & Interaction',
            'Setting & Environment': 'E621 · Setting & Atmosphere',
            'Lighting & Effects': 'E621 · Effects & Lighting',
            'Rendering': 'E621 · Quality & Output',
            'Style & Meta': 'E621 · Descriptors & Style',
            'Meta': 'E621 · Technical & Meta'
        };
        this.e621ToDanbooruMap = {
            'E621 · Species & Body': 'Subject & Creatures',
            'E621 · Identity & Counts': 'Characters',
            'E621 · Anatomy & Traits': 'Body Parts',
            'E621 · Props & Gear': 'Held Items & Objects',
            'E621 · Actions & Interaction': 'Actions & Poses',
            'E621 · Setting & Atmosphere': 'Setting & Environment',
            'E621 · Effects & Lighting': 'Lighting & Effects',
            'E621 · Quality & Output': 'Quality',
            'E621 · Descriptors & Style': 'Style & Meta',
            'E621 · Technical & Meta': 'Style & Meta',
            'E621 · Franchise & Lore': 'Style & Meta',
            'E621 · Creator Credit': 'Artists',
            'E621 · Safety & Ratings': 'Quality',
            'E621 · Uncategorized': 'Uncategorized'
        };
        this.buildHeuristicIndexes(allTags || []);
        this.buildEnhancedHeuristics();
        if (options.e621Taxonomy) {
            this.integrateE621Taxonomy(options.e621Taxonomy);
        }
        if (options.ontology) {
            this.applyOntology(options.ontology);
        }
        this.refreshCategoryList();
    }

    refreshCategoryList() {
        this.categories = Array.from(this.categorySet).filter(Boolean);
    }

    addCategory(category) {
        if (!category) return;
        if (!this.categorySet.has(category)) {
            this.categorySet.add(category);
            this.refreshCategoryList();
        }
    }

    registerProfileCategory(profile, category) {
        if (!profile || !category) return;
        this.addCategory(category);
        if (!this.profileCategorySet[profile]) {
            this.profileCategorySet[profile] = new Set();
        }
        this.profileCategorySet[profile].add(category);
    }

    getProfileCategoryOrder(profile = 'danbooru') {
        if (profile === 'danbooru') return this.profileCategoryOrder.danbooru || this.categoryOrder;
        if (!this.profileCategoryOrder[profile] || this.profileCategoryOrder[profile].length === 0) {
            const categories = Array.from(this.profileCategorySet[profile] || []);
            categories.sort((a, b) => a.localeCompare(b));
            this.profileCategoryOrder[profile] = categories;
        }
        return this.profileCategoryOrder[profile];
    }

    integrateE621Taxonomy(taxonomy) {
        const categoryMap = taxonomy.category_map || {};
        const keywordHints = taxonomy.keyword_hints || {};
        const suffixHints = taxonomy.suffix_hints || {};
        const prefixHints = taxonomy.prefix_hints || {};
        const compositeHints = Array.isArray(taxonomy.composite_hints) ? taxonomy.composite_hints : [];
        const tagMap = taxonomy.tag_map || {};
        this.e621CategoryMap = {};
        Object.entries(categoryMap).forEach(([key, value]) => {
            const mapped = value || this.e621FallbackCategory;
            this.e621CategoryMap[key] = mapped;
            this.registerProfileCategory('e621', mapped);
        });
        this.e621KeywordHints = {};
        Object.entries(keywordHints).forEach(([key, keywords]) => {
            const mappedCategory = this.e621CategoryMap[key] || key;
            this.registerProfileCategory('e621', mappedCategory);
            const normalizedKeywords = new Set((keywords || []).map(kw => kw.toLowerCase()));
            this.e621KeywordHints[mappedCategory] = Array.from(new Set([...(this.e621KeywordHints[mappedCategory] || []), ...normalizedKeywords]));
        });
        this.e621SuffixHints = Object.fromEntries(Object.entries(suffixHints).map(([suffix, category]) => {
            const mappedCategory = this.e621CategoryMap[category] || category;
            this.registerProfileCategory('e621', mappedCategory);
            return [suffix.toLowerCase(), mappedCategory];
        }));
        this.e621PrefixHints = Object.fromEntries(Object.entries(prefixHints).map(([prefix, category]) => {
            const mappedCategory = this.e621CategoryMap[category] || category;
            this.registerProfileCategory('e621', mappedCategory);
            return [prefix.toLowerCase(), mappedCategory];
        }));
        this.e621CompositeHints = compositeHints.map(rule => ({
            contains: (rule.contains || []).map(token => token.toLowerCase()),
            category: this.e621CategoryMap[rule.category] || rule.category || this.e621FallbackCategory,
            weight: rule.weight || 1,
            reason: rule.reason || 'Composite'
        }));
        this.e621DirectMap = Object.fromEntries(Object.entries(tagMap).map(([tag, category]) => {
            const mappedCategory = this.e621CategoryMap[category] || category;
            this.registerProfileCategory('e621', mappedCategory);
            return [tag.toLowerCase(), mappedCategory];
        }));
        if (Array.isArray(taxonomy.additional_categories)) {
            taxonomy.additional_categories.forEach(category => this.registerProfileCategory('e621', category));
        }
        if (Array.isArray(taxonomy.category_order) && taxonomy.category_order.length) {
            this.e621CategoryOrder = taxonomy.category_order;
            this.profileCategoryOrder.e621 = [...taxonomy.category_order];
            this.profileCategoryOrder.e621.forEach(category => this.registerProfileCategory('e621', category));
        }
        if (taxonomy.fallback_category) {
            this.e621FallbackCategory = taxonomy.fallback_category;
        }
    }

    applyOntology(ontology) {
        if (ontology.category_keywords) {
            Object.entries(ontology.category_keywords).forEach(([category, keywords]) => {
                this.ontologyKeywordMap[category] = (keywords || []).map(keyword => keyword.toLowerCase());
                this.addCategory(category);
            });
        }
        if (Array.isArray(ontology.pattern_rules)) {
            this.ontologyRegexRules = ontology.pattern_rules
                .filter(rule => rule.regex)
                .map(rule => ({
                    regex: new RegExp(rule.regex, 'i'),
                    category: rule.category,
                    weight: rule.weight || 1,
                    reason: rule.reason || 'Pattern'
                }));
            this.ontologyComboRules = ontology.pattern_rules
                .filter(rule => Array.isArray(rule.contains) && !rule.regex)
                .map(rule => ({
                    contains: rule.contains.map(item => item.toLowerCase()),
                    category: rule.category,
                    weight: rule.weight || 1,
                    reason: rule.reason || 'Phrase'
                }));
            this.ontologyRegexRules.forEach(rule => this.addCategory(rule.category));
            this.ontologyComboRules.forEach(rule => this.addCategory(rule.category));
        }
    }

    buildHeuristicIndexes(allTags) {
        const keywordCategoryCounts = {};
        const suffixCategoryCounts = {};
        const prefixCategoryCounts = {};
        const comboCategoryCounts = {};
        const COPYRIGHT_KEYWORDS = new Set(['(genshin_impact)', '(azur_lane)', '(touhou)', '(hololive)', '(fate/grand_order)']);
        (allTags || []).forEach(tag => {
            const category = this.primaryIndex[tag];
            if (!category) return;
            const words = tag.split('_');
            if (words.length > 1) {
                words.forEach(word => {
                    if (word.length < 4 || COPYRIGHT_KEYWORDS.has(word)) return;
                    if (!keywordCategoryCounts[word]) keywordCategoryCounts[word] = {};
                    keywordCategoryCounts[word][category] = (keywordCategoryCounts[word][category] || 0) + 1;
                });
                for (let i = 0; i < words.length - 1; i += 1) {
                    const combo = `${words[i]}_${words[i + 1]}`;
                    if (!comboCategoryCounts[combo]) comboCategoryCounts[combo] = {};
                    comboCategoryCounts[combo][category] = (comboCategoryCounts[combo][category] || 0) + 1;
                }
                const suffix = words[words.length - 1];
                if (!suffixCategoryCounts[suffix]) suffixCategoryCounts[suffix] = {};
                suffixCategoryCounts[suffix][category] = (suffixCategoryCounts[suffix][category] || 0) + 1;
                const prefix = words[0];
                if (!prefixCategoryCounts[prefix]) prefixCategoryCounts[prefix] = {};
                prefixCategoryCounts[prefix][category] = (prefixCategoryCounts[prefix][category] || 0) + 1;
            }
        });
        for (const keyword in keywordCategoryCounts) {
            const counts = keywordCategoryCounts[keyword];
            const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
            const [mostLikelyCategory, categoryCount] = Object.entries(counts).reduce((a, b) => a[1] > b[1] ? a : b);
            if (total > 5 && (categoryCount / total) > 0.8) this.keywordIndex[keyword] = mostLikelyCategory;
        }
        for (const suffix in suffixCategoryCounts) {
            const counts = suffixCategoryCounts[suffix];
            const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
            const [mostLikelyCategory, categoryCount] = Object.entries(counts).reduce((a, b) => a[1] > b[1] ? a : b);
            if (total > 10 && (categoryCount / total) > 0.75) this.patternIndex.ends[`_${suffix}`] = mostLikelyCategory;
        }
        for (const prefix in prefixCategoryCounts) {
            const counts = prefixCategoryCounts[prefix];
            const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
            const [mostLikelyCategory, categoryCount] = Object.entries(counts).reduce((a, b) => a[1] > b[1] ? a : b);
            if (total > 10 && (categoryCount / total) > 0.75) this.patternIndex.starts[`${prefix}_`] = mostLikelyCategory;
        }
        for (const combo in comboCategoryCounts) {
            const counts = comboCategoryCounts[combo];
            const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
            const [mostLikelyCategory, categoryCount] = Object.entries(counts).reduce((a, b) => a[1] > b[1] ? a : b);
            if (total > 4 && (categoryCount / total) > 0.8) this.comboKeywordIndex[combo] = mostLikelyCategory;
        }
    }

    buildEnhancedHeuristics() {
        this.characterPatterns = [/\([^)]+\)$/, /_\([^)]+\)$/, /^[a-z]+_[a-z]+_\([^)]+\)$/];
        this.qualityKeywords = new Set(['quality', 'masterpiece', 'best', 'high', 'ultra', 'super', 'extremely', 'detailed', 'resolution', 'res', '4k', '8k', 'hd', 'uhd', 'absurdres']);
        this.compositionKeywords = new Set(['shot', 'view', 'angle', 'perspective', 'focus', 'body', 'portrait', 'landscape', 'close-up', 'wide', 'cowboy', 'full', 'upper', 'lower']);
        this.bodyPartKeywords = new Set(['breasts', 'ass', 'butt', 'thighs', 'legs', 'arms', 'hands', 'feet', 'face', 'eyes', 'hair', 'skin', 'body', 'torso', 'chest', 'belly', 'navel', 'shoulders', 'back', 'neck', 'head', 'nose', 'lips', 'mouth']);
        this.clothingKeywords = new Set(['dress', 'shirt', 'pants', 'skirt', 'shorts', 'jacket', 'coat', 'bikini', 'swimsuit', 'underwear', 'bra', 'panties', 'socks', 'stockings', 'thighhighs', 'pantyhose', 'boots', 'shoes', 'gloves', 'hoodie', 'kimono', 'uniform']);
        this.actionKeywords = new Set(['sitting', 'standing', 'lying', 'walking', 'running', 'jumping', 'dancing', 'singing', 'eating', 'drinking', 'sleeping', 'smiling', 'looking', 'holding', 'grabbing', 'touching', 'reaching', 'posing', 'gesture']);
        this.settingKeywords = new Set(['background', 'outdoor', 'indoor', 'room', 'bedroom', 'bathroom', 'kitchen', 'school', 'office', 'beach', 'forest', 'city', 'sky', 'night', 'day', 'sunset', 'sunrise', 'moon', 'star', 'cloud', 'rain', 'snow', 'weather']);
        this.speciesKeywords = new Set(['canine', 'feline', 'dragon', 'avian', 'lupine', 'vulpine', 'kitsune', 'bovine', 'equine', 'reptile', 'lizard', 'wolf', 'fox', 'cat', 'dog', 'bird', 'lion', 'tiger', 'bunny', 'rabbit']);
        this.emotionKeywords = new Set(['smile', 'smiling', 'angry', 'anger', 'blush', 'crying', 'tears', 'joy', 'sad', 'determined', 'focused', 'surprised', 'wink', 'laughing']);
        this.descriptorKeywords = new Set(['stylized', 'cartoon', 'monochrome', 'painterly', 'cel', 'futuristic', 'retro', 'cute', 'gritty', 'noir', 'dramatic']);
        this.metaKeywords = new Set(['signature', 'watermark', 'translated', 'ui', 'interface', 'caption', 'text', 'panel', 'scan', 'sketch', 'rough']);
        this.ratingKeywords = new Set(['sfw', 'nsfw', 'safe', 'suggestive', 'questionable', 'explicit', 'rating']);
        this.loreKeywords = new Set(['canon', 'official', 'lore', 'timeline', 'universe', 'series', 'franchise', 'crossover']);
        this.creatorKeywords = new Set(['artist', 'commission', 'credited', 'by', 'source']);
    }

    updateIndex(tag, newCategory) {
        const normalized = tag.toLowerCase().replace(/ /g, '_');
        this.primaryIndex[normalized] = newCategory;
        this.addCategory(newCategory);
    }

    categorizeEnhanced(tagString) {
        const normalizedTag = tagString.toLowerCase().replace(/ /g, '_');
        if (this.primaryIndex[normalizedTag]) {
            return { category: this.primaryIndex[normalizedTag], source: 'Primary', confidence: 1.0 };
        }
        const words = normalizedTag.split('_').filter(Boolean);
        const scoreMap = new Map();
        const reasonMap = new Map();
        const addScore = (category, amount, reason) => {
            if (!category || !amount) return;
            const current = scoreMap.get(category) || 0;
            scoreMap.set(category, current + amount);
            if (!reasonMap.has(category)) reasonMap.set(category, new Set());
            if (reason) reasonMap.get(category).add(reason);
            this.addCategory(category);
        };
        for (const pattern of this.characterPatterns) {
            if (pattern.test(normalizedTag)) addScore('Characters', 1.2, 'Character pattern');
        }
        words.forEach(word => {
            if (this.keywordIndex[word]) addScore(this.keywordIndex[word], 1.1, `Known keyword '${word}'`);
            if (this.qualityKeywords.has(word)) addScore('Quality', 0.9, `Quality keyword '${word}'`);
            if (this.compositionKeywords.has(word)) addScore('Composition', 0.85, `Composition keyword '${word}'`);
            if (this.bodyPartKeywords.has(word)) addScore('Body Parts', 1.0, `Anatomy keyword '${word}'`);
            if (this.clothingKeywords.has(word)) addScore('Attire', 0.95, `Wardrobe keyword '${word}'`);
            if (this.actionKeywords.has(word)) addScore('Actions & Poses', 0.9, `Action keyword '${word}'`);
            if (this.settingKeywords.has(word)) addScore('Setting & Environment', 0.9, `Setting keyword '${word}'`);
            if (this.speciesKeywords.has(word)) addScore('Subject & Creatures', 1.05, `Species keyword '${word}'`);
            if (this.emotionKeywords.has(word)) addScore('Emotion & Expression', 0.9, `Expression keyword '${word}'`);
            if (this.descriptorKeywords.has(word)) addScore('Style & Meta', 0.85, `Descriptor keyword '${word}'`);
            if (this.metaKeywords.has(word)) addScore('Style & Meta', 0.9, `Meta keyword '${word}'`);
            if (this.ratingKeywords.has(word)) addScore('Quality', 0.8, `Rating keyword '${word}'`);
            if (this.loreKeywords.has(word)) addScore('Style & Meta', 0.9, `Lore keyword '${word}'`);
            if (this.creatorKeywords.has(word)) addScore('Artists', 1.0, `Creator keyword '${word}'`);
        });
        for (let i = 0; i < words.length - 1; i += 1) {
            const combo = `${words[i]}_${words[i + 1]}`;
            if (this.comboKeywordIndex[combo]) addScore(this.comboKeywordIndex[combo], 1.15, `Combo '${combo}'`);
        }
        Object.entries(this.e621KeywordHints).forEach(([mappedCategory, keywords]) => {
            const bridged = this.e621ToDanbooruMap[mappedCategory];
            if (!bridged) return;
            keywords.forEach(keyword => {
                if (normalizedTag.includes(keyword)) addScore(bridged, 0.75, `E621 hint '${keyword}'`);
            });
        });
        Object.entries(this.e621SuffixHints).forEach(([suffix, mappedCategory]) => {
            const bridged = this.e621ToDanbooruMap[mappedCategory];
            if (bridged && normalizedTag.endsWith(suffix)) addScore(bridged, 0.7, `E621 suffix '${suffix}'`);
        });
        Object.entries(this.e621PrefixHints).forEach(([prefix, mappedCategory]) => {
            const bridged = this.e621ToDanbooruMap[mappedCategory];
            if (bridged && normalizedTag.startsWith(prefix)) addScore(bridged, 0.7, `E621 prefix '${prefix}'`);
        });
        Object.entries(this.ontologyKeywordMap).forEach(([category, keywords]) => {
            keywords.forEach(keyword => {
                if (words.includes(keyword)) addScore(category, 0.9, `Ontology keyword '${keyword}'`);
            });
        });
        this.ontologyRegexRules.forEach(rule => {
            if (rule.regex.test(normalizedTag)) addScore(rule.category, rule.weight, rule.reason);
        });
        this.ontologyComboRules.forEach(rule => {
            if (rule.contains.every(token => normalizedTag.includes(token))) addScore(rule.category, rule.weight, rule.reason);
        });
        for (const prefix in this.patternIndex.starts) {
            if (normalizedTag.startsWith(prefix)) addScore(this.patternIndex.starts[prefix], 1.0, `Prefix '${prefix}'`);
        }
        for (const suffix in this.patternIndex.ends) {
            if (normalizedTag.endsWith(suffix)) addScore(this.patternIndex.ends[suffix], 1.0, `Suffix '${suffix}'`);
        }
        if (scoreMap.size === 0) {
            return this.categorizeOriginal(tagString);
        }
        const sorted = [...scoreMap.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        const [bestCategory, bestScore] = sorted[0];
        const reasons = reasonMap.get(bestCategory) ? Array.from(reasonMap.get(bestCategory)).join(', ') : 'Hybrid Heuristic';
        const confidence = Math.max(0.4, Math.min(0.99, bestScore / (2 + words.length * 0.1)));
        return { category: bestCategory, source: `Hybrid: ${reasons}`, confidence };
    }

    categorizeOriginal(tagString) {
        const tag = tagString.toLowerCase().replace(/ /g, '_');
        if (this.primaryIndex[tag]) return { category: this.primaryIndex[tag], source: 'Primary' };
        if (tag.includes('(') && tag.includes(')')) {
            const seriesMatch = tag.match(/\(([^)]+)\)/);
            if (seriesMatch && this.primaryIndex[seriesMatch[1]]) return { category: 'Characters', source: 'Heuristic (Series)' };
            return { category: 'Characters', source: 'Heuristic (Pattern)' };
        }
        for (const prefix in this.patternIndex.starts) if (tag.startsWith(prefix)) return { category: this.patternIndex.starts[prefix], source: 'Pattern (Prefix)' };
        for (const suffix in this.patternIndex.ends) if (tag.endsWith(suffix)) return { category: this.patternIndex.ends[suffix], source: 'Pattern (Suffix)' };
        const words = tag.split('_');
        const categoryScores = {};
        words.forEach(word => {
            if (this.keywordIndex[word]) categoryScores[this.keywordIndex[word]] = (categoryScores[this.keywordIndex[word]] || 0) + 1;
        });
        if (Object.keys(categoryScores).length > 0) {
            const category = Object.keys(categoryScores).reduce((a, b) => categoryScores[a] > categoryScores[b] ? a : b);
            return { category, source: 'Heuristic (Keywords)' };
        }
        return { category: 'Uncategorized', source: 'Fallback' };
    }

    categorizeE621(tagString, baseResult = null) {
        const normalizedTag = tagString.toLowerCase().replace(/ /g, '_');
        if (!normalizedTag) return { category: this.e621FallbackCategory, source: 'E621 Fallback', confidence: 0.3 };
        if (this.e621DirectMap[normalizedTag]) {
            const directCategory = this.e621DirectMap[normalizedTag];
            this.registerProfileCategory('e621', directCategory);
            return { category: directCategory, source: 'E621 Map', confidence: 0.99 };
        }
        const words = normalizedTag.split('_').filter(Boolean);
        const scoreMap = new Map();
        const reasonMap = new Map();
        const addScore = (category, amount, reason) => {
            if (!category || !amount) return;
            this.registerProfileCategory('e621', category);
            const current = scoreMap.get(category) || 0;
            scoreMap.set(category, current + amount);
            if (!reasonMap.has(category)) reasonMap.set(category, new Set());
            if (reason) reasonMap.get(category).add(reason);
        };
        Object.entries(this.e621PrefixHints).forEach(([prefix, category]) => {
            if (normalizedTag.startsWith(prefix)) addScore(category, 1.0, `Prefix '${prefix}'`);
        });
        Object.entries(this.e621SuffixHints).forEach(([suffix, category]) => {
            if (normalizedTag.endsWith(suffix)) addScore(category, 0.95, `Suffix '${suffix}'`);
        });
        Object.entries(this.e621KeywordHints).forEach(([category, keywords]) => {
            keywords.forEach(keyword => {
                if (normalizedTag.includes(keyword)) addScore(category, 0.9, `Keyword '${keyword}'`);
            });
        });
        this.e621CompositeHints.forEach(rule => {
            if (rule.contains.every(token => normalizedTag.includes(token))) addScore(rule.category, rule.weight, rule.reason);
        });
        words.forEach(word => {
            if (this.speciesKeywords.has(word)) addScore('E621 · Species & Body', 1.25, `Species keyword '${word}'`);
            if (this.bodyPartKeywords.has(word)) addScore('E621 · Anatomy & Traits', 1.1, `Anatomy keyword '${word}'`);
            if (this.clothingKeywords.has(word)) addScore('E621 · Props & Gear', 1.05, `Wardrobe keyword '${word}'`);
            if (this.actionKeywords.has(word)) addScore('E621 · Actions & Interaction', 1.0, `Action keyword '${word}'`);
            if (this.settingKeywords.has(word)) addScore('E621 · Setting & Atmosphere', 1.0, `Setting keyword '${word}'`);
            if (this.qualityKeywords.has(word)) addScore('E621 · Quality & Output', 0.95, `Quality keyword '${word}'`);
            if (this.descriptorKeywords.has(word) || this.emotionKeywords.has(word)) addScore('E621 · Descriptors & Style', 0.95, `Descriptor keyword '${word}'`);
            if (this.metaKeywords.has(word)) addScore('E621 · Technical & Meta', 0.9, `Meta keyword '${word}'`);
            if (this.ratingKeywords.has(word)) addScore('E621 · Safety & Ratings', 0.95, `Rating keyword '${word}'`);
            if (this.loreKeywords.has(word)) addScore('E621 · Franchise & Lore', 0.9, `Lore keyword '${word}'`);
            if (this.creatorKeywords.has(word)) addScore('E621 · Creator Credit', 1.0, `Creator keyword '${word}'`);
            if (this.keywordIndex[word]) {
                const mapped = this.danbooruToE621Map[this.keywordIndex[word]];
                if (mapped) addScore(mapped, 0.85, `Bridge keyword '${word}'`);
            }
        });
        for (let i = 0; i < words.length - 1; i += 1) {
            const combo = `${words[i]}_${words[i + 1]}`;
            if (this.comboKeywordIndex[combo]) {
                const mapped = this.danbooruToE621Map[this.comboKeywordIndex[combo]];
                if (mapped) addScore(mapped, 1.05, `Combo '${combo}'`);
            }
        }
        if (baseResult && baseResult.category) {
            const mapped = this.danbooruToE621Map[baseResult.category];
            if (mapped) addScore(mapped, 1.1, `Mapped from ${baseResult.category}`);
        }
        if (scoreMap.size === 0) {
            return { category: this.e621FallbackCategory, source: 'E621 Fallback', confidence: 0.35 };
        }
        const sorted = [...scoreMap.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        const [category, score] = sorted[0];
        const reasons = reasonMap.get(category) ? Array.from(reasonMap.get(category)).join(', ') : 'Hybrid';
        const confidence = Math.max(0.4, Math.min(0.98, score / (2 + words.length * 0.1)));
        return { category, source: `E621 Hybrid: ${reasons}`, confidence };
    }

    categorize(tagString, options = {}) {
        const hybrid = this.categorizeEnhanced(tagString);
        let resolved = { ...hybrid };
        if ((!resolved.category || resolved.category === 'Uncategorized') && options.allowFallback !== false) {
            const fallback = this.categorizeOriginal(tagString);
            if (fallback.category && fallback.category !== 'Uncategorized' && fallback.category !== hybrid.category) {
                resolved = { ...fallback, confidence: fallback.confidence ?? hybrid.confidence, source: `${hybrid.source || 'Hybrid'} → ${fallback.source}` };
            }
        }
        if (!resolved.category) {
            resolved.category = 'Uncategorized';
        }
        if (resolved.confidence === undefined) {
            resolved.confidence = hybrid.confidence ?? 0.6;
        }
        const e621Result = this.categorizeE621(tagString, resolved);
        const profileCategories = {
            danbooru: {
                category: resolved.category,
                source: resolved.source || 'Hybrid',
                confidence: resolved.confidence
            }
        };
        if (e621Result && e621Result.category) {
            profileCategories.e621 = e621Result;
        }
        return { ...resolved, profileCategories };
    }
}


const getFavoriteKey = (tag) => tag.toLowerCase().replace(/\s+/g, '_');

function loadHiddenCategories() {
    try {
        const stored = JSON.parse(localStorage.getItem(HIDDEN_STORAGE_KEY) || '[]');
        hiddenCategories = new Set(stored);
    } catch (error) {
        console.warn('Failed to load muted categories from storage', error);
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

const normalizeTagText = (tag) => tag.toLowerCase().replace(/_/g, ' ').trim();

function stripWeightSyntax(token) {
    if (!token) return '';
    let cleaned = token.trim();
    if (!cleaned) return '';
    const weightPattern = /:(\d+(?:\.\d+)?)(?=[)\]]*$)/;
    cleaned = cleaned.replace(weightPattern, '');
    let guard = 0;
    while (cleaned.length > 1 && guard < 5) {
        const wrappedInParens = cleaned.startsWith('(') && cleaned.endsWith(')');
        const wrappedInBrackets = cleaned.startsWith('[') && cleaned.endsWith(']');
        if (!wrappedInParens && !wrappedInBrackets) break;
        cleaned = cleaned.slice(1, -1).trim();
        guard += 1;
    }
    cleaned = cleaned.replace(/\s+/g, '_');
    return cleaned;
}

function determinePromptFlowPhase(tag, config = PROMPT_FLOW_CONFIG, options = {}) {
    const profile = options.profile || 'danbooru';
    const categoryName = getTagCategoryForProfile(tag, profile) || 'Uncategorized';
    if (config.categoryMap.has(categoryName)) {
        return config.categoryMap.get(categoryName);
    }
    const normalized = normalizeTagText(tag.original);
    for (const phase of config.phases) {
        if (phase.keywordMatchers.some(keyword => normalized.includes(keyword))) {
            return phase.key;
        }
    }
    return config.fallbackKey;
}

function computePromptFlowScore(tag, phaseKey, config = PROMPT_FLOW_CONFIG, options = {}) {
    const profile = options.profile || 'danbooru';
    const normalized = normalizeTagText(tag.weighted || tag.original);
    const priorities = config.priorityKeywords[phaseKey] || [];
    let score = 0;
    for (const [keyword, weight] of priorities) {
        if (normalized.includes(keyword)) score += weight;
    }
    const source = getTagSourceForProfile(tag, profile);
    if (source === 'Primary') score += 0.5;
    const weightMatch = tag.weighted && tag.weighted.match(/:(\d+(?:\.\d+)?)/);
    if (weightMatch) score += parseFloat(weightMatch[1]) / 10;
    return score;
}

function sortTagsByPromptFlow(tags, config = PROMPT_FLOW_CONFIG, options = {}) {
    const groups = config.phases.map(phase => ({ phase, tags: [] }));
    const groupMap = new Map(groups.map(group => [group.phase.key, group]));
    const fallbackGroup = groupMap.get(config.fallbackKey) || groups[groups.length - 1];
    tags.forEach(tag => {
        const key = determinePromptFlowPhase(tag, config, options);
        const targetGroup = groupMap.get(key) || fallbackGroup;
        targetGroup.tags.push(tag);
    });
    groups.forEach(group => {
        group.tags.sort((a, b) => {
            const scoreDiff = computePromptFlowScore(b, group.phase.key, config, options) - computePromptFlowScore(a, group.phase.key, config, options);
            if (scoreDiff !== 0) return scoreDiff;
            const timeDiff = (a.addedAt || 0) - (b.addedAt || 0);
            if (timeDiff !== 0) return timeDiff;
            return a.original.localeCompare(b.original);
        });
    });
    return groups;
}

function getAllKnownCategories() {
    const categories = new Set([...tagCategorizer?.categoryOrder || [], ...knownCategories, 'Uncategorized']);
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
    tag.confidence = 0.99;
    tag.profileCategories = tag.profileCategories || {};
    tag.profileCategories.danbooru = { category, source: 'Manual', confidence: tag.confidence };
    ensureCategoryRegistered(category);
    if (tagCategorizer) {
        tagCategorizer.updateIndex(tag.original, category);
    }
    closeCategoryPicker();
    if (sortSelect.value === 'manual') {
        displayTags();
    } else {
        displayTags();
    }
}

function renderCategoryFilters() {
    if (!categoryToggleContainer) return;
    const activeProfile = getActiveProfile();
    let categories;
    if (activeProfile === 'danbooru') {
        const ordered = tagCategorizer?.getProfileCategoryOrder ? tagCategorizer.getProfileCategoryOrder('danbooru') : null;
        categories = Array.from(ordered || knownCategories);
        if (!categories.includes('Uncategorized')) categories.push('Uncategorized');
    } else {
        const ordered = tagCategorizer?.getProfileCategoryOrder ? tagCategorizer.getProfileCategoryOrder('e621') : [];
        const categorySet = new Set(ordered);
        baseTags.forEach(tag => categorySet.add(getTagCategoryForProfile(tag, activeProfile)));
        categories = Array.from(categorySet).filter(Boolean);
        if (!categories.includes('Uncategorized')) categories.push('Uncategorized');
    }
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
        displayTags();
    });
    categoryToggleContainer.appendChild(resetButton);
    categories.forEach(category => {
        const count = baseTags.filter(tag => getTagCategoryForProfile(tag, activeProfile) === category).length;
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
    if (hiddenCategories.has(category)) hiddenCategories.delete(category);
    else hiddenCategories.add(category);
    saveHiddenCategories();
    displayTags();
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

function loadFavorites() {
    try {
        const stored = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || '[]');
        favoriteTags = new Map(stored.map(tag => [getFavoriteKey(tag), tag]));
    } catch (error) {
        console.warn('Failed to load favorites from storage', error);
        favoriteTags = new Map();
    }
}

function saveFavorites() {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favoriteTags.values())));
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
        text.textContent = underscoreToggle.checked ? tag.replace(/\s/g, '_') : tag.replace(/_/g, ' ');
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
    if (clearFavoritesButton) clearFavoritesButton.disabled = favoriteTags.size === 0;
}

function insertFavoriteTag(tag) {
    const existing = tagInput.value.trim();
    const normalizedTag = tag.replace(/_/g, ' ');
    const separator = existing && !existing.endsWith(',') ? ', ' : '';
    const candidate = `${existing}${separator}${normalizedTag}`.trim();
    tagInput.value = candidate;
    processAll();
}

function getProcessedTagElements() {
    return Array.from(tagOutput.querySelectorAll('.tag-base'));
}

function getActiveTags() {
    const profile = getActiveProfile();
    return baseTags.filter(tag => !hiddenCategories.has(getTagCategoryForProfile(tag, profile)));
}

function getProcessedTagsForOutput() {
    const elements = getProcessedTagElements();
    return elements.map(el => {
        const weightedTag = el.dataset.weightedTag;
        return underscoreToggle.checked ? weightedTag.replace(/\s/g, '_') : weightedTag.replace(/_/g, ' ');
    });
}

function getPromptParts() {
    const prepend = triggerInput.value.split(',').map(t => t.trim()).filter(Boolean);
    const append = appendInput.value.split(',').map(t => t.trim()).filter(Boolean);
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
    if (promptPreviewCopy) {
        promptPreviewCopy.disabled = isEmpty;
    }
    if (copyButton) {
        copyButton.disabled = isEmpty;
    }
    if (copyJsonButton) {
        copyJsonButton.disabled = isEmpty;
    }
}

function processAll() {
    if (!tagCategorizer) return;
    const swaps = new Map(swapsInput.value.split(',').map(s => s.split('->').map(p => p.trim())).filter(p => p.length === 2 && p[0]));
    const implications = new Map(implicationsInput.value.split(',').map(s => s.split('=>').map(p => p.trim())).filter(p => p.length === 2 && p[0]));
    const blacklist = new Set(blacklistInput.value.replace(/[\n,]+/g, ',').split(',').map(w => w.trim().toLowerCase().replace(/_/g, ' ')).filter(Boolean));
    let rawTags = tagInput.value.replace(/[\n]+/g, ',').split(',').map(t => t.trim()).filter(Boolean);
    rawTags = rawTags.map(tag => swaps.get(tag.toLowerCase().replace(/_/g, ' ')) || tag);
    const tagsToAdd = new Set();
    rawTags.forEach(tag => { const lowerTag = tag.toLowerCase(); if (implications.has(lowerTag)) implications.get(lowerTag).split(',').forEach(imp => tagsToAdd.add(imp.trim())); });
    rawTags = [...rawTags, ...tagsToAdd];
    if (deduplicateToggle.checked) {
        const seen = new Set();
        rawTags = rawTags.filter(tag => { const lower = tag.toLowerCase().replace(/_/g, ' '); if (seen.has(lower)) return false; seen.add(lower); return true; });
    }
    let filteredTags = rawTags.filter(tag => !blacklist.has(tag.toLowerCase().replace(/_/g, ' ')));
    filteredTags = filteredTags.slice(0, parseInt(maxTagsInput.value, 10) || 75);
    const newBaseTags = [];
    const oldTagsMeta = new Map(baseTags.map(t => [t.original, { id: t.id, weighted: t.weighted, addedAt: t.addedAt }]));
    for (const tag of filteredTags) {
        const categorization = tagCategorizer.categorize(tag, { allowFallback: true });
        const profileCategories = categorization.profileCategories || {};
        const danbooruProfile = profileCategories.danbooru || {
            category: categorization.category,
            source: categorization.source,
            confidence: categorization.confidence
        };
        const { category, source, confidence } = danbooruProfile;
        const oldMeta = oldTagsMeta.get(tag);
        const assignedCategory = category || categorization.category || 'Uncategorized';
        const assignedSource = source || categorization.source || 'Hybrid';
        const assignedConfidence = confidence ?? categorization.confidence ?? 0.6;
        ensureCategoryRegistered(assignedCategory);
        newBaseTags.push({
            original: tag,
            weighted: oldMeta ? oldMeta.weighted : tag,
            id: oldMeta ? oldMeta.id : `tag-${tagIdCounter++}`,
            category: assignedCategory,
            categorySource: assignedSource,
            confidence: assignedConfidence,
            profileCategories,
            addedAt: oldMeta && oldMeta.addedAt ? oldMeta.addedAt : Date.now()
        });
    }
    if (!enableWeightingToggle.checked) newBaseTags.forEach(t => t.weighted = t.original);
    baseTags = newBaseTags;
    renderCategoryFilters();
    displayTags();
}

function animateTagGroups() {
    if (!window.gsap || prefersReducedMotion) return;
    gsap.killTweensOf('.tag-group');
    gsap.killTweensOf('.tag-group .tag-base');
    gsap.from('.tag-group', { opacity: 0, y: 24, duration: 0.45, ease: 'power2.out', stagger: 0.08, overwrite: 'auto' });
    gsap.from('.tag-group .tag-base', { opacity: 0, y: 12, duration: 0.3, ease: 'power1.out', stagger: 0.01, overwrite: 'auto' });
}

function displayTags() {
    renderCategoryFilters();
    tagOutput.innerHTML = '';
    const visibleTags = getActiveTags();

    if (baseTags.length === 0) {
        tagOutput.innerHTML = '<div class="text-gray-500 italic text-center py-12">Start typing or paste tags above to begin...</div>';
        updateHiddenCategoriesBanner();
        updateStats();
        updatePromptPreview();
        refreshFavoriteIndicators();
        destroySortableInstances();
        return;
    }

    if (visibleTags.length === 0) {
        tagOutput.innerHTML = '<div class="text-amber-300 text-center py-12">All categories are currently muted. Enable a category to see its tags.</div>';
        updateHiddenCategoriesBanner();
        updateStats();
        updatePromptPreview();
        refreshFavoriteIndicators();
        destroySortableInstances();
        return;
    }

    const sortValue = sortSelect.value;
    const activeProfile = getActiveProfile();
    if (sortValue === 'danbooru') {
        const groups = visibleTags.reduce((acc, tag) => {
            const c = getTagCategoryForProfile(tag, 'danbooru');
            if (!acc[c]) acc[c] = [];
            acc[c].push(tag);
            return acc;
        }, {});
        const baseOrder = tagCategorizer?.getProfileCategoryOrder ? tagCategorizer.getProfileCategoryOrder('danbooru') : tagCategorizer.categoryOrder;
        const sortedCategoryOrder = [...new Set([...(baseOrder || []), ...knownCategories, 'Uncategorized'])];
        sortedCategoryOrder.forEach(categoryName => {
            const tagsForCategory = groups[categoryName];
            if (!tagsForCategory || tagsForCategory.length === 0) return;
            const groupDiv = document.createElement('div');
            groupDiv.className = 'tag-group fade-in-up';
            groupDiv.innerHTML = `<h3 class="tag-group-title">${categoryName}</h3>`;
            const container = document.createElement('div');
            container.className = 'tag-group-container';
            container.dataset.groupName = categoryName;
            tagsForCategory.forEach(tag => container.appendChild(createTagElement(tag, 'danbooru')));
            groupDiv.appendChild(container);
            tagOutput.appendChild(groupDiv);
        });
    } else if (sortValue === 'e621') {
        const flowConfig = E621_FLOW_CONFIG;
        const flowGroups = sortTagsByPromptFlow(visibleTags, flowConfig, { profile: 'e621' });
        flowGroups.forEach(({ phase, tags }) => {
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
            tags.forEach(tag => container.appendChild(createTagElement(tag, 'e621')));
            groupDiv.appendChild(container);
            tagOutput.appendChild(groupDiv);
        });
    } else if (sortValue === 'flow' || sortValue === 'illustrious') {
        const flowConfig = sortValue === 'illustrious' ? ILLUSTRIOUS_FLOW_CONFIG : PROMPT_FLOW_CONFIG;
        const flowGroups = sortTagsByPromptFlow(visibleTags, flowConfig, { profile: 'danbooru' });
        flowGroups.forEach(({ phase, tags }) => {
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
            tags.forEach(tag => container.appendChild(createTagElement(tag, 'danbooru')));
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
        container.dataset.groupName = 'all';
        tagsToDisplay.forEach(tag => container.appendChild(createTagElement(tag, activeProfile)));
        tagOutput.appendChild(container);
    }

    if (['danbooru', 'manual'].includes(sortValue)) {
        initSortable();
    } else {
        destroySortableInstances();
    }

    updateHiddenCategoriesBanner();
    updateStats();
    updatePromptPreview();
    refreshFavoriteIndicators();
    animateTagGroups();
}

function createTagElement(tag, profile = 'danbooru') {
    const el = document.createElement('div');
    el.className = 'tag-base processed-tag';
    el.dataset.id = tag.id;
    el.dataset.weightedTag = tag.weighted;
    el.dataset.tagOriginal = tag.original;
    const displayCategory = getTagCategoryForProfile(tag, profile);
    const displaySource = getTagSourceForProfile(tag, profile);
    el.dataset.category = displayCategory;
    el.dataset.profile = profile;
    if (selectedTagIds.has(tag.id)) el.classList.add('selected');
    el.style.borderStyle = displaySource !== 'Primary' ? 'dashed' : 'solid';
    el.title = `(${displaySource}) ${tag.original}\nCategory: ${displayCategory}${profile !== 'danbooru' ? ` [${profile}]` : ''}\n\nCtrl+Click to multi-select.\nRight-click for options.`;

    const content = document.createElement('div');
    content.className = 'flex items-center gap-2';

    const favoriteBtn = document.createElement('button');
    favoriteBtn.type = 'button';
    favoriteBtn.className = 'tag-favorite-btn';
    favoriteBtn.dataset.tagOriginal = tag.original;
    const isFavorite = favoriteTags.has(getFavoriteKey(tag.original));
    if (isFavorite) favoriteBtn.classList.add('active');
    favoriteBtn.textContent = isFavorite ? '★' : '☆';
    favoriteBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleFavorite(tag.original);
    });
    content.appendChild(favoriteBtn);

    const controls = document.createElement('div');
    controls.className = 'flex items-center gap-1';
    const useUnderscores = underscoreToggle.checked;
    const displayTag = useUnderscores ? tag.weighted.replace(/\s/g, '_') : tag.weighted.replace(/_/g, ' ');

    if (enableWeightingToggle.checked) {
        const decreaseBtn = document.createElement('button');
        decreaseBtn.type = 'button';
        decreaseBtn.className = 'tag-weight-btn';
        decreaseBtn.textContent = '-';
        decreaseBtn.addEventListener('click', (event) => {
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
        increaseBtn.addEventListener('click', (event) => {
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
    categoryBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        openCategoryPicker(tag.id);
    });
    quickActions.appendChild(categoryBtn);
    content.appendChild(quickActions);
    el.appendChild(content);

    el.addEventListener('click', (e) => handleTagClick(e, tag.id));
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); showCorrectionMenu(e, tag); });
    return el;
}
function handleTagClick(event, tagId) { const tagElement = event.currentTarget; if (event.ctrlKey || event.metaKey) { if (selectedTagIds.has(tagId)) { selectedTagIds.delete(tagId); tagElement.classList.remove('selected'); } else { selectedTagIds.add(tagId); tagElement.classList.add('selected'); } } else { document.querySelectorAll('.tag-base.selected').forEach(el => el.classList.remove('selected')); selectedTagIds.clear(); selectedTagIds.add(tagId); tagElement.classList.add('selected'); } }
function showCorrectionMenu(event, clickedTag) { const menuId = 'correction-menu'; document.getElementById(menuId)?.remove(); if (selectedTagIds.size === 0 || !selectedTagIds.has(clickedTag.id)) { selectedTagIds.clear(); document.querySelectorAll('.tag-base.selected').forEach(el => el.classList.remove('selected')); selectedTagIds.add(clickedTag.id); document.querySelector(`[data-id="${clickedTag.id}"]`)?.classList.add('selected'); } const menu = document.createElement('div'); menu.id = menuId; menu.className = 'absolute z-20 bg-gray-800 border border-gray-600 rounded-md shadow-lg py-1 text-sm'; menu.style.left = `${event.pageX}px`; menu.style.top = `${event.pageY}px`; let title = selectedTagIds.size > 1 ? `Correct ${selectedTagIds.size} Tags` : `Correct '${clickedTag.original}'`; let menuHTML = `<div class="px-3 py-1 text-gray-400 border-b border-gray-700">${title}</div>`; tagCategorizer.categories.forEach(cat => { menuHTML += `<a href="#" class="block px-3 py-1 text-gray-200 hover:bg-indigo-600" onclick="submitCategoryUpdate(event,'${cat}')">${cat}</a>`; }); menu.innerHTML = menuHTML; document.body.appendChild(menu); document.addEventListener('click', () => menu.remove(), { once: true }); }

async function submitCategoryUpdate(event, newCategory) {
    event.preventDefault();
    if (!gitHubPat) { gitHubPat = prompt("To save changes directly to GitHub, please enter your Personal Access Token (PAT) with `repo` or `public_repo` scope.", ""); if (!gitHubPat) { copyMessage.textContent = 'Update cancelled. No PAT provided.'; setTimeout(() => copyMessage.textContent = '', 3000); return; } }
    const tagsToUpdate = baseTags.filter(t => selectedTagIds.has(t.id)); if (tagsToUpdate.length === 0) return;
    copyMessage.textContent = `Updating ${tagsToUpdate.length} tag(s)...`;
    const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/data/tag_map.json`;
    const headers = { 'Authorization': `Bearer ${gitHubPat}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' };
    try {
        const getFileResponse = await fetch(apiUrl, { headers }); if (!getFileResponse.ok) throw new Error(`Fetch failed: ${getFileResponse.status}`);
        const fileData = await getFileResponse.json(); const currentContent = atob(fileData.content); const currentSha = fileData.sha;
        let currentTagMap = JSON.parse(currentContent); let changesCount = 0;
        tagsToUpdate.forEach(tag => { const normalizedTag = tag.original.toLowerCase().replace(/ /g, '_'); if (currentTagMap[normalizedTag] !== newCategory) { currentTagMap[normalizedTag] = newCategory; changesCount++; } });
        if (changesCount === 0) { copyMessage.textContent = 'No changes needed.'; setTimeout(() => copyMessage.textContent = '', 3000); return; }
        const sortedTagMap = Object.fromEntries(Object.entries(currentTagMap).sort()); const newContent = JSON.stringify(sortedTagMap, null, 2);
        const updateResponse = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify({ message: `Update ${changesCount} tag(s) to '${newCategory}'`, content: btoa(newContent), sha: currentSha }) });
        if (!updateResponse.ok) { const errorData = await updateResponse.json(); throw new Error(`GitHub API Error: ${errorData.message}`); }
        copyMessage.textContent = `Success! Updated ${changesCount} tag(s).`;
        tagsToUpdate.forEach(tag => {
            tagCategorizer.updateIndex(tag.original, newCategory);
            tag.category = newCategory;
            tag.categorySource = 'Primary';
            tag.confidence = 0.99;
            tag.profileCategories = tag.profileCategories || {};
            tag.profileCategories.danbooru = { category: newCategory, source: 'Primary', confidence: tag.confidence };
        });
        ensureCategoryRegistered(newCategory);
        selectedTagIds.clear(); displayTags();
    } catch (error) { console.error("Update failed:", error); copyMessage.textContent = `Error: ${error.message}`; if (error.message.includes("401")) gitHubPat = null;  } 
    finally { setTimeout(() => copyMessage.textContent = '', 5000); }
}

async function loadExternalData() {
    document.title = 'Danbooru Tag Helper (Loading...)';
    try {
        const timestamp = `t=${Date.now()}`;
        const [tagsResponse, mapResponse, e621Response, ontologyResponse] = await Promise.all([
            fetch(`data/tags.json?${timestamp}`),
            fetch(`data/tag_map.json?${timestamp}`),
            fetch(`data/e621_taxonomy.json?${timestamp}`).catch(() => null),
            fetch(`data/tag_ontology.json?${timestamp}`).catch(() => null)
        ]);
        if (!tagsResponse.ok) throw new Error(`Failed to fetch data/tags.json: ${tagsResponse.statusText}`);
        if (!mapResponse.ok) throw new Error(`Failed to fetch data/tag_map.json: ${mapResponse.statusText}`);
        TAG_DATABASE = await tagsResponse.json();
        const tagMap = await mapResponse.json();
        let e621Taxonomy = null;
        if (e621Response && e621Response.ok) {
            e621Taxonomy = await e621Response.json();
        }
        let ontology = null;
        if (ontologyResponse && ontologyResponse.ok) {
            ontology = await ontologyResponse.json();
        }
        if (e621Taxonomy && e621Taxonomy.prompt_phases) {
            try {
                E621_FLOW_CONFIG = createPromptFlowConfig(
                    e621Taxonomy.prompt_phases,
                    e621Taxonomy.prompt_priority || DEFAULT_E621_PRIORITY_KEYWORDS,
                    e621Taxonomy.fallback_phase || 'quality'
                );
            } catch (error) {
                console.warn('Failed to apply e621 prompt flow config, falling back to defaults', error);
                E621_FLOW_CONFIG = createPromptFlowConfig(DEFAULT_E621_PROMPT_PHASES, DEFAULT_E621_PRIORITY_KEYWORDS, 'quality');
            }
        } else {
            E621_FLOW_CONFIG = createPromptFlowConfig(DEFAULT_E621_PROMPT_PHASES, DEFAULT_E621_PRIORITY_KEYWORDS, 'quality');
        }
        const categoryOrder = [
            'Quality',
            'Artists',
            'Composition',
            'Characters',
            'Subject & Creatures',
            'Emotion & Expression',
            'Face',
            'Eyes',
            'Hair',
            'Body Parts',
            'Attire',
            'Accessories',
            'Held Items & Objects',
            'Actions & Poses',
            'Setting & Environment',
            'Lighting & Effects',
            'Style & Meta'
        ];
        tagCategorizer = new EnhancedTagCategorizer(tagMap, TAG_DATABASE, categoryOrder, {
            e621Taxonomy,
            ontology
        });
        knownCategories = new Set([...tagCategorizer.categories, 'Uncategorized']);
        document.title = 'Danbooru Tag Helper (Ready)';
    } catch (error) {
        console.error('FATAL ERROR loading data:', error);
        document.title = 'Danbooru Tag Helper (ERROR)';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'p-4 mb-4 text-sm text-red-200 bg-red-800/50 rounded-lg';
        errorDiv.innerHTML = `<strong>Error loading core data:</strong> ${error.message}. The application cannot start. Please check the console (F12) for details and ensure the JSON files exist in the /data directory.`;
        const container = document.querySelector('.glass-panel');
        if (container) container.prepend(errorDiv);
    }
}

function copyTagsToClipboard() {
    const finalString = buildFinalPrompt();
    if (!finalString) {
        copyMessage.textContent = 'Nothing to copy yet!';
        setTimeout(() => copyMessage.textContent = '', 2000);
        return;
    }
    navigator.clipboard.writeText(finalString).then(() => {
        copyMessage.textContent = 'Tags copied!';
        updateCopyHistory(finalString);
        updatePromptPreview();
        setTimeout(() => copyMessage.textContent = '', 2000);
    }).catch(err => {
        copyMessage.textContent = 'Copy failed!';
        console.error('Clipboard write failed: ', err);
    });
}

window.updateTagWeight = (id, action) => { const tag = baseTags.find(t => t.id === id); if (!tag) return; let current = tag.weighted, original = tag.original; if (action === 'increase') { if (current.startsWith('((')) current = `(((${original})))`; else if (current.startsWith('(')) current = `((${original}))`; else if (current.startsWith('[')) current = original; else current = `(${original})`; } else { if (current.startsWith('[[')) current = `[[[${original}]]]`; else if (current.startsWith('[')) current = `[[${original}]]`; else if (current.startsWith('(')) current = original; else current = `[${original}]`; } tag.weighted = current; displayTags(); };
function destroySortableInstances() {
    if (sortableInstances.length) {
        sortableInstances.forEach(instance => instance.destroy());
        sortableInstances = [];
    }
}

function initSortable() {
    if (!['danbooru', 'manual'].includes(sortSelect.value)) {
        destroySortableInstances();
        return;
    }
    destroySortableInstances();
    tagOutput.querySelectorAll('.tag-group-container').forEach(container => {
        sortableInstances.push(new Sortable(container, {
            group: 'shared',
            animation: 150,
            ghostClass: 'opacity-50',
            fallbackOnBody: true,
            touchStartThreshold: 8,
            fallbackTolerance: 6,
            dragClass: 'opacity-70',
            onEnd: (evt) => {
                const previousSort = sortSelect.value;
                const movedTag = baseTags.find(t => t.id === evt.item.dataset.id);
                const newCategory = evt.to.dataset.groupName;
                const sameContainer = evt.from === evt.to;
                if (movedTag && newCategory) {
                    movedTag.category = newCategory;
                    movedTag.categorySource = 'Manual';
                    movedTag.confidence = 0.99;
                    movedTag.profileCategories = movedTag.profileCategories || {};
                    movedTag.profileCategories.danbooru = { category: newCategory, source: 'Manual', confidence: movedTag.confidence };
                    ensureCategoryRegistered(newCategory);
                    if (tagCategorizer) {
                        tagCategorizer.updateIndex(movedTag.original, newCategory);
                    }
                }
                if (previousSort === 'manual' || sameContainer) {
                    const allTagElements = Array.from(tagOutput.querySelectorAll('.tag-base'));
                    baseTags = allTagElements.map(el => baseTags.find(t => t && t.id === el.dataset.id)).filter(Boolean);
                    sortSelect.value = 'manual';
                }
                displayTags();
                if (previousSort !== 'manual' && !sameContainer) {
                    sortSelect.value = previousSort;
                }
            },
        }));
    });
}
function handleAutocompleteInput() {
    if (!tagCategorizer) return;
    const text = tagInput.value;
    const cursorPos = tagInput.selectionStart || text.length;
    const lastComma = text.lastIndexOf(',', cursorPos - 1);
    autocomplete.currentWord = text.substring(lastComma + 1, cursorPos).trim();
    if (!autocomplete.currentWord) {
        hideAutocomplete();
        return;
    }
    const query = autocomplete.currentWord.replace(/ /g, '_');
    autocomplete.suggestions = TAG_DATABASE.filter(t => t.startsWith(query)).slice(0, 5);
    if (autocomplete.suggestions.length > 0) {
        renderAutocomplete();
    } else {
        hideAutocomplete();
    }
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

function handleAutocompleteKeydown(e) {
    if (e.key === 'Tab' && !autocomplete.active) {
        e.preventDefault();
        focusRelativeElement(tagInput, e.shiftKey);
        return;
    }
    if (!tagCategorizer) return;
    if (e.key === 'Escape') {
        if (autocomplete.active) {
            e.preventDefault();
            hideAutocomplete();
        }
        return;
    }
    if (!autocomplete.active) return;
    const items = autocompleteBox.children;
    if (!items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (autocomplete.index >= 0) items[autocomplete.index]?.classList.remove('selected');
        if (autocomplete.index === -1) {
            autocomplete.index = e.key === 'ArrowDown' ? 0 : items.length - 1;
        } else if (e.key === 'ArrowDown') {
            autocomplete.index = (autocomplete.index + 1) % items.length;
        } else {
            autocomplete.index = (autocomplete.index - 1 + items.length) % items.length;
        }
        items[autocomplete.index]?.classList.add('selected');
    } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (autocomplete.index === -1 && items[0]) autocomplete.index = 0;
        if (autocomplete.index > -1 && items[autocomplete.index]) {
            e.preventDefault();
            selectAutocompleteItem(items[autocomplete.index].dataset.tag);
            hideAutocomplete();
        }
    }
}
function renderAutocomplete() { autocompleteBox.innerHTML = autocomplete.suggestions.map((s) => `<div class="autocomplete-item p-2 cursor-pointer" data-tag="${s}" onmousedown="selectAutocompleteItem('${s}')">${s.replace(/_/g, ' ')}</div>`).join(''); autocomplete.active = true; autocomplete.index = -1; autocompleteBox.style.display = 'block'; }
window.selectAutocompleteItem = (tag) => { const text = tagInput.value, cursorPos = tagInput.selectionStart; const lastComma = text.lastIndexOf(',', cursorPos - 1); const before = text.substring(0, lastComma + 1); tagInput.value = `${before} ${tag.replace(/_/g, ' ')}, ${text.substring(cursorPos)}`; hideAutocomplete(); tagInput.focus(); processAll(); };
function hideAutocomplete() { autocomplete.active = false; autocompleteBox.style.display = 'none'; }
function updateCopyHistory(text) { if(text){ copyHistory.unshift(text); if (copyHistory.length > 10) copyHistory.pop(); localStorage.setItem('danbooru-tag-history', JSON.stringify(copyHistory)); } historyContainer.innerHTML = ''; if (copyHistory.length === 0) { historyContainer.innerHTML = `<p class="text-sm text-gray-500 italic">No history yet.</p>`; } else { copyHistory.forEach(item => { const el = document.createElement('div'); el.className = 'history-item p-2 rounded-md flex items-center justify-between gap-2'; el.innerHTML = `<span class="history-item-text text-gray-400 text-xs flex-grow overflow-hidden whitespace-nowrap text-ellipsis">${item}</span><button class="copy-btn-sm p-1 rounded" onclick="navigator.clipboard.writeText(\`${item.replace(/`/g, '\\`')}\`)"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-300"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>`; historyContainer.appendChild(el); }); } updateStats(); }
function suggestCoherentTags() { if (!tagCategorizer) return; const QUESTIONABLE_KEYWORDS = ['bikini', 'swimsuit', 'cleavage', 'breasts', 'ass', 'thighs', 'pantyhose', 'leotard', 'garter_belt', 'panty_shot', 'sideboob', 'topless', 'bra', 'panties', 'lingerie', 'seductive', 'bondage', 'shibari', 'partially_nude', 'armpits', 'bottomless']; const EXPLICIT_KEYWORDS = ['pussy', 'penis', 'sex', 'oral', 'ahegao', 'nude', 'naked', 'cum', 'masturbation', 'fellatio', 'cunnilingus', 'prolapse']; const numToSuggest = parseInt(suggestionCountInput.value, 10); const existingTags = new Set(baseTags.map(t => t.original.toLowerCase().replace(/ /g, '_'))); const isAllowed = (tag) => { if (EXPLICIT_KEYWORDS.some(kw => tag.includes(kw))) return false; if (!ratingQuestionable.checked && QUESTIONABLE_KEYWORDS.some(kw => tag.includes(kw))) return false; if (!ratingGeneral.checked && !ratingSafe.checked && !ratingQuestionable.checked) return false; return true; }; const suggestions = new Set(), categoryPools = {}; TAG_DATABASE.forEach(tag => { const { category } = tagCategorizer.categorize(tag); if (!categoryPools[category]) categoryPools[category] = []; if (!existingTags.has(tag) && isAllowed(tag)) categoryPools[category].push(tag); }); const plan = (existingTags.size === 0) ? [ { name: 'Quality', count: 1 }, { name: 'Composition', count: 2 }, { name: 'Characters', count: 1 }, { name: 'Face', count: 2 }, { name: 'Eyes', count: 1 }, { name: 'Hair', count: 2 } ] : Object.entries(baseTags.reduce((acc, tag) => { acc[tag.category] = (acc[tag.category] || 0) + 1; return acc; }, {})).map(([name, count]) => ({name, count})); let suggestionsNeeded = numToSuggest; while(suggestionsNeeded > 0) { let madeSuggestion = false; for(const p of plan) { if(suggestionsNeeded <= 0) break; const pool = categoryPools[p.name] || []; for(let i=0; i < p.count; ++i) { if(pool.length > 0) { const [suggestion] = pool.splice(Math.floor(Math.random() * pool.length), 1); if(suggestion && !suggestions.has(suggestion)) { suggestions.add(suggestion); suggestionsNeeded--; madeSuggestion = true; } } } } if(!madeSuggestion) break; } const suggestionsToAdd = [...suggestions]; if (suggestionsToAdd.length > 0) { const separator = tagInput.value.trim().length > 0 && !tagInput.value.trim().endsWith(',') ? ', ' : ''; tagInput.value += separator + suggestionsToAdd.join(', ').replace(/_/g, ' '); processAll(); } }

function showTokenSettings() { const panel = element('tokenPanel'); const input = element('githubTokenInput'); const checkbox = element('rememberToken'); const savedToken = localStorage.getItem('github-pat'); if (savedToken) { input.value = savedToken; checkbox.checked = true; gitHubPat = savedToken; } updateTokenStatus(); panel.classList.remove('hidden'); }
function hideTokenSettings() { element('tokenPanel').classList.add('hidden'); }
function saveToken() { const token = element('githubTokenInput').value.trim(); const remember = element('rememberToken').checked; if (!token) { alert('Please enter a valid GitHub token'); return; } gitHubPat = token; if (remember) { localStorage.setItem('github-pat', token); } else { localStorage.removeItem('github-pat'); } updateTokenStatus(); hideTokenSettings(); element('copyMessage').textContent = 'Token saved!'; setTimeout(() => element('copyMessage').textContent = '', 3000); }
function testToken() { const token = element('githubTokenInput').value.trim(); if (!token) { alert('Please enter a token first'); return; } fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}`, { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' } }).then(response => { const statusEl = element('tokenStatus'); if (response.ok) { statusEl.innerHTML = '<span class="text-green-400">✓ Token is valid and has access</span>'; } else if (response.status === 401) { statusEl.innerHTML = '<span class="text-red-400">✗ Invalid token</span>'; } else if (response.status === 403) { statusEl.innerHTML = '<span class="text-yellow-400">⚠ Token valid but insufficient permissions</span>'; } else { statusEl.innerHTML = '<span class="text-red-400">✗ Connection failed</span>'; } }).catch(error => { element('tokenStatus').innerHTML = '<span class="text-red-400">✗ Connection error</span>'; }); }
function updateTokenStatus() { const statusEl = element('tokenStatus'); if (gitHubPat || localStorage.getItem('github-pat')) { statusEl.innerHTML = '<span class="text-green-400">✓ Token configured</span>'; } else { statusEl.innerHTML = '<span class="text-gray-400">No token configured</span>'; } }
function initializeToken() { const savedToken = localStorage.getItem('github-pat'); if (savedToken) { gitHubPat = savedToken; console.log('GitHub token loaded from storage'); } }
function toggleSettingsPanel() { element('settingsPanel').classList.toggle('hidden'); }
function clearAll() { if (confirm('Clear all tags and settings?')) { element('tagInput').value = ''; element('triggerInput').value = ''; element('appendInput').value = ''; element('swapsInput').value = ''; element('implicationsInput').value = ''; element('blacklistInput').value = ''; processAll(); } }
function randomizeTags() {
    if (baseTags.length === 0) return;
    for (let i = baseTags.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [baseTags[i], baseTags[j]] = [baseTags[j], baseTags[i]];
    }
    displayTags();
    if (copyMessage) {
        copyMessage.textContent = 'Tags shuffled!';
        setTimeout(() => copyMessage.textContent = '', 2000);
    }
}

function stripWeights() {
    const rawValue = tagInput.value;
    const tokens = rawValue.split(',').map(token => token.trim()).filter(Boolean);
    if (tokens.length === 0 && baseTags.length === 0) {
        if (copyMessage) {
            copyMessage.textContent = 'No weighted tags detected.';
            setTimeout(() => copyMessage.textContent = '', 2000);
        }
        return;
    }
    const cleanedTokens = tokens.map(stripWeightSyntax).filter(Boolean);
    const originalJoined = tokens.join(', ');
    const newJoined = cleanedTokens.join(', ');
    tagInput.value = newJoined;
    processAll();
    baseTags.forEach(tag => {
        const normalized = stripWeightSyntax(tag.original);
        tag.original = normalized;
        tag.weighted = normalized;
    });
    displayTags();
    if (copyMessage) {
        copyMessage.textContent = originalJoined !== newJoined ? 'Removed weight syntax from tags.' : 'Weights were already clean.';
        setTimeout(() => copyMessage.textContent = '', 2500);
    }
}

function optimizeOrder() {
    const categoryPriority = {
        'Quality': 1,
        'Artists': 1.5,
        'Composition': 2,
        'Characters': 3,
        'Subject & Creatures': 4,
        'Emotion & Expression': 4.5,
        'Face': 5,
        'Eyes': 6,
        'Hair': 7,
        'Body Parts': 8,
        'Attire': 9,
        'Accessories': 10,
        'Held Items & Objects': 11,
        'Actions & Poses': 12,
        'Setting & Environment': 13,
        'Lighting & Effects': 13.5,
        'Style & Meta': 14
    };
    baseTags.sort((a, b) => {
        const aPriority = categoryPriority[a.category] ?? 99;
        const bPriority = categoryPriority[b.category] ?? 99;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.original.localeCompare(b.original);
    });
    displayTags();
    if (copyMessage) {
        copyMessage.textContent = 'Tags optimized!';
        setTimeout(() => copyMessage.textContent = '', 2000);
    }
}

function collectExportPayload() {
    const tags = getProcessedTagsForOutput();
    const payload = {
        tags,
        prompt: buildFinalPrompt(),
        settings: {
            prepend: triggerInput.value,
            append: appendInput.value,
            maxTags: maxTagsInput.value,
            sorting: sortSelect.value,
            deduplicate: deduplicateToggle.checked,
            underscores: underscoreToggle.checked,
            weighting: enableWeightingToggle.checked
        },
        hiddenCategories: Array.from(hiddenCategories),
        timestamp: new Date().toISOString()
    };
    return payload;
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
        setTimeout(() => copyMessage.textContent = '', 2500);
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
            setTimeout(() => copyMessage.textContent = '', 2500);
        }
    }).catch(() => alert('Unable to copy JSON to clipboard.'));
}

function importTags() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.txt';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (re) => {
            try {
                const content = re.target.result;
                if (file.name.endsWith('.json')) {
                    const data = JSON.parse(content);
                    if (data.prompt) {
                        tagInput.value = data.prompt;
                    } else if (Array.isArray(data.tags)) {
                        tagInput.value = data.tags.join(', ');
                    }
                    if (data.settings) {
                        if (data.settings.prepend !== undefined) triggerInput.value = data.settings.prepend;
                        if (data.settings.append !== undefined) appendInput.value = data.settings.append;
                        if (data.settings.maxTags !== undefined) maxTagsInput.value = data.settings.maxTags;
                        if (data.settings.sorting !== undefined) sortSelect.value = data.settings.sorting;
                        if (data.settings.deduplicate !== undefined) deduplicateToggle.checked = data.settings.deduplicate;
                        if (data.settings.underscores !== undefined) underscoreToggle.checked = data.settings.underscores;
                        if (data.settings.weighting !== undefined) enableWeightingToggle.checked = data.settings.weighting;
                    }
                    if (Array.isArray(data.hiddenCategories)) {
                        hiddenCategories = new Set(data.hiddenCategories);
                        saveHiddenCategories();
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
function exportSettings() { const settings = { theme: document.body.className.match(/theme-\w+/)?.[0] || 'theme-indigo', prepend: triggerInput.value, append: appendInput.value, swaps: swapsInput.value, implications: implicationsInput.value, blacklist: blacklistInput.value, maxTags: maxTagsInput.value, sorting: sortSelect.value, deduplicate: deduplicateToggle.checked, underscores: underscoreToggle.checked, weighting: enableWeightingToggle.checked, ratings: { safe: ratingSafe.checked, general: ratingGeneral.checked, questionable: ratingQuestionable.checked } }; const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `danbooru-helper-settings-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(a.href); }
function importSettings(event) { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { try { const settings = JSON.parse(e.target.result); if (settings.theme) applyTheme(settings.theme); if (settings.prepend !== undefined) triggerInput.value = settings.prepend; if (settings.append !== undefined) appendInput.value = settings.append; if (settings.swaps !== undefined) swapsInput.value = settings.swaps; if (settings.implications !== undefined) implicationsInput.value = settings.implications; if (settings.blacklist !== undefined) blacklistInput.value = settings.blacklist; if (settings.maxTags !== undefined) maxTagsInput.value = settings.maxTags; if (settings.sorting !== undefined) sortSelect.value = settings.sorting; if (settings.deduplicate !== undefined) deduplicateToggle.checked = settings.deduplicate; if (settings.underscores !== undefined) underscoreToggle.checked = settings.underscores; if (settings.weighting !== undefined) enableWeightingToggle.checked = settings.weighting; if (settings.ratings) { if (settings.ratings.safe !== undefined) ratingSafe.checked = settings.ratings.safe; if (settings.ratings.general !== undefined) ratingGeneral.checked = settings.ratings.general; if (settings.ratings.questionable !== undefined) ratingQuestionable.checked = settings.ratings.questionable; } toggleSettingsPanel(); processAll(); copyMessage.textContent = 'Settings imported!'; setTimeout(() => copyMessage.textContent = '', 3000); } catch (error) { alert('Error importing settings: ' + error.message); } }; reader.readAsText(file); }
function resetToDefaults() { if (confirm('Reset all settings to defaults?')) { tagInput.value = ''; triggerInput.value = ''; appendInput.value = ''; swapsInput.value = ''; implicationsInput.value = ''; blacklistInput.value = ''; maxTagsInput.value = '75'; sortSelect.value = 'danbooru'; suggestionCountInput.value = '15'; deduplicateToggle.checked = true; underscoreToggle.checked = false; enableWeightingToggle.checked = false; ratingSafe.checked = true; ratingGeneral.checked = true; ratingQuestionable.checked = false; applyTheme('theme-indigo'); toggleSettingsPanel(); processAll(); } }
function applyTheme(theme) {
    const selectedTheme = theme || 'theme-indigo';
    document.documentElement.className = 'dark';
    document.body.className = `p-4 md:p-6 lg:p-8 ${selectedTheme}`;
    document.querySelectorAll('.theme-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === selectedTheme);
    });
    localStorage.setItem('danbooru-tag-helper-theme', selectedTheme);
    if (window.gsap && !prefersReducedMotion) {
        gsap.fromTo('body', { filter: 'brightness(0.85)' }, { filter: 'brightness(1)', duration: 0.6, ease: 'power2.out', onComplete: () => gsap.set('body', { clearProps: 'filter' }) });
    }
}
function updateStats() {
    const activeTags = getActiveTags();
    const tagCount = activeTags.length;
    const maxTags = parseInt(maxTagsInput.value, 10) || 75;
    const profile = getActiveProfile();
    const categoryCount = new Set(activeTags.map(t => getTagCategoryForProfile(t, profile))).size;
    const historyCount = copyHistory.length;
    element('tagCount').textContent = tagCount;
    element('maxTagCount').textContent = maxTags;
    element('categoryCount').textContent = categoryCount;
    element('historyCount').textContent = historyCount;
    element('processedTagCount').textContent = tagCount;
    element('processedMaxTagCount').textContent = maxTags;
    const tagCountEl = element('tagCount');
    const percentage = maxTags ? (tagCount / maxTags) * 100 : 0;
    if (percentage > 90) {
        tagCountEl.style.color = '#ef4444';
    } else if (percentage > 75) {
        tagCountEl.style.color = '#f59e0b';
    } else {
        tagCountEl.style.color = 'var(--accent-color)';
    }
}

function runEntranceAnimations() {
    if (!window.gsap || prefersReducedMotion) return;
    gsap.from('.floating-panel', { opacity: 0, y: -24, duration: 0.6, ease: 'power3.out' });
    gsap.from('.glass-panel', { opacity: 0, y: 32, duration: 0.8, ease: 'power3.out', delay: 0.15 });
}

document.addEventListener('DOMContentLoaded', async () => {
    initializeToken();
    await loadExternalData();
    const savedTheme = localStorage.getItem('danbooru-tag-helper-theme') || 'theme-indigo';
    applyTheme(savedTheme);
    runEntranceAnimations();
    if (howToPanel) {
        const storedState = localStorage.getItem('danbooru-howto-open');
        if (storedState === 'true') {
            howToPanel.setAttribute('open', '');
        } else if (storedState === 'false') {
            howToPanel.removeAttribute('open');
        }
        howToPanel.addEventListener('toggle', () => {
            localStorage.setItem('danbooru-howto-open', howToPanel.open);
        });
    }
    loadHiddenCategories();
    loadFavorites();
    renderFavorites();
    renderCategoryFilters();
    updateHiddenCategoriesBanner();
    const savedHistory = localStorage.getItem('danbooru-tag-history');
    if (savedHistory) { copyHistory = JSON.parse(savedHistory); }
    document.querySelectorAll('.theme-button').forEach(btn => btn.addEventListener('click', () => applyTheme(btn.dataset.theme)));
    const debouncedTagProcessing = debounce(processAll, 300);
    const inputsForProcessing = [swapsInput, implicationsInput, blacklistInput, triggerInput, appendInput, maxTagsInput];
    inputsForProcessing.forEach(input => input && input.addEventListener('input', processAll));
    if (tagInput) {
        tagInput.addEventListener('input', debouncedTagProcessing);
        tagInput.addEventListener('change', processAll);
    }
    const inputsForDisplay = [deduplicateToggle, underscoreToggle, enableWeightingToggle, sortSelect];
    inputsForDisplay.forEach(input => input.addEventListener('change', displayTags));
    underscoreToggle.addEventListener('change', renderFavorites);
    if (tagInput) {
        tagInput.addEventListener('input', handleAutocompleteInput);
        tagInput.addEventListener('keydown', handleAutocompleteKeydown);
        tagInput.addEventListener('blur', () => setTimeout(hideAutocomplete, 150));
    }
    copyButton.addEventListener('click', copyTagsToClipboard);
    if (promptPreviewCopy) promptPreviewCopy.addEventListener('click', copyTagsToClipboard);
    if (clearFavoritesButton) clearFavoritesButton.addEventListener('click', clearFavorites);
    if (categoryPickerSearch) categoryPickerSearch.addEventListener('input', () => renderCategoryPickerOptions(categoryPickerSearch.value));
    if (categoryPickerBackdrop) categoryPickerBackdrop.addEventListener('click', closeCategoryPicker);
    if (categoryPickerClose) categoryPickerClose.addEventListener('click', closeCategoryPicker);
    suggestBtn.addEventListener('click', suggestCoherentTags);
    processAll();
    updateCopyHistory(null);
    updateTokenStatus();
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && categoryPickerModal?.classList.contains('active')) {
        closeCategoryPicker();
    }
});
