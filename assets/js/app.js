const GITHUB_USER = 'isaacwach234';
const GITHUB_REPO = 'isaacwach234.github.io';

let TAG_DATABASES = {}, TAG_DATABASE = [], gitHubPat = null, tagCategorizer, tagIdCounter = 0;
let baseTags = [], copyHistory = [], selectedTagIds = new Set(), sortableInstances = [];
let autocomplete = { active: false, index: -1, currentWord: '', suggestions: [] };
let hiddenCategories = new Set(), knownCategories = new Set(), favoriteTags = new Map();
const reduceMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const prefersReducedMotion = reduceMotionQuery ? reduceMotionQuery.matches : false;

const element = (id) => document.getElementById(id);
const body = document.body, tagInput = element('tagInput'), swapsInput = element('swapsInput'), implicationsInput = element('implicationsInput'), blacklistInput = element('blacklistInput'), triggerInput = element('triggerInput'), appendInput = element('appendInput');
const deduplicateToggle = element('deduplicateToggle'), underscoreToggle = element('underscoreToggle'), enableWeightingToggle = element('enableWeightingToggle');
const sortSelect = element('sortSelect'), maxTagsInput = element('maxTagsInput'), tagOutput = element('tagOutput');
const tagDialectSelect = element('tagDialectSelect');
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
        categories: ['Characters', 'Subject & Creatures', 'Franchise & Lore'],
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
        categories: ['Uncategorized', 'Meta', 'Franchise & Lore', 'Rating & Safety'],
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
        categories: ['Characters', 'Subject & Creatures', 'Franchise & Lore', 'Face', 'Eyes', 'Hair', 'Body Parts', 'Attire', 'Accessories'],
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

const E621_PROMPT_PHASES = [
    {
        key: 'rating',
        label: 'Rating & Safety',
        description: 'Declare safety level or ratings before content-specific tags.',
        categories: ['Rating & Safety'],
        keywords: ['rating:s', 'rating:q', 'rating:e', 'safe', 'explicit', 'suggestive', 'questionable']
    },
    {
        key: 'species',
        label: 'Species & Forms',
        description: 'Outline species, body plans, and anthro versus feral silhouettes.',
        categories: ['Species & Body', 'Subject & Creatures', 'Anatomy & Detail'],
        keywords: ['species', 'anthro', 'feral', 'taur', 'hybrid', 'protogen', 'sergal', 'canine', 'feline', 'dragon']
    },
    {
        key: 'identity',
        label: 'Identity & Cast',
        description: 'List characters, gender descriptors, canon notes, or artist credits.',
        categories: ['Characters', 'Gender & Identity', 'Artists', 'Meta & Lore'],
        keywords: ['character', 'male', 'female', 'futa', 'herm', 'oc', 'original_character', 'artist', 'canon', 'lore']
    },
    {
        key: 'anatomy',
        label: 'Anatomy & Detail',
        description: 'Capture anatomy specifics, genital tags, and fluid descriptors.',
        categories: ['Anatomy & Detail', 'Genitals & Fluids'],
        keywords: ['muzzle', 'fur', 'paws', 'claws', 'sheath', 'knot', 'slit', 'barbed', 'dripping', 'cum', 'ejaculation']
    },
    {
        key: 'kinks',
        label: 'Kinks, Gear & Wardrobe',
        description: 'Add toys, wardrobe elements, and kink modifiers.',
        categories: ['Kinks & Themes', 'Wardrobe & Accessories', 'Props & Gear'],
        keywords: ['bondage', 'bdsm', 'harness', 'collar', 'leash', 'restraint', 'toy', 'vibrator', 'latex', 'lingerie']
    },
    {
        key: 'action',
        label: 'Actions & Interaction',
        description: 'Describe poses, interactions, and emotional beats.',
        categories: ['Actions & Interaction', 'Actions & Poses', 'Emotion & Expression'],
        keywords: ['hug', 'kiss', 'lick', 'snuggle', 'dominant', 'submissive', 'mounting', 'posing', 'smile', 'blush']
    },
    {
        key: 'scene',
        label: 'Scene & Atmosphere',
        description: 'Paint the environment, weather, and lighting cues.',
        categories: ['Scene & Setting', 'Lighting & Effects', 'Style & Meta'],
        keywords: ['bedroom', 'forest', 'dungeon', 'stage', 'night', 'rain', 'neon', 'lighting', 'background', 'spotlight']
    },
    {
        key: 'quality',
        label: 'Quality & Output',
        description: 'Close with render fidelity and resolution boosters.',
        categories: ['Quality'],
        keywords: ['masterpiece', 'best quality', 'ultra detailed', 'highres', '4k', '8k', 'hdr', 'rendered', 'cinematic']
    }
];

const E621_PHASE_PRIORITY_KEYWORDS = {
    rating: [['rating:s', 5], ['rating:e', 5], ['rating:q', 4], ['explicit', 4], ['safe', 3], ['questionable', 3]],
    species: [['anthro', 4], ['feral', 4], ['taur', 3], ['protogen', 3], ['dragon', 3], ['canine', 2]],
    identity: [['male', 3], ['female', 3], ['futa', 3], ['herm', 3], ['oc', 3], ['artist', 2], ['character', 2]],
    anatomy: [['sheath', 4], ['knot', 4], ['barbed', 3], ['slit', 3], ['dripping', 2], ['muzzle', 2]],
    kinks: [['bondage', 4], ['bdsm', 4], ['collar', 3], ['harness', 3], ['leash', 3], ['latex', 3], ['toy', 2], ['vibrator', 2]],
    action: [['hug', 3], ['kiss', 3], ['lick', 3], ['snuggle', 2], ['mounting', 3], ['dominant', 2], ['submissive', 2]],
    scene: [['bedroom', 3], ['forest', 3], ['dungeon', 3], ['neon', 2], ['night', 2], ['rain', 2], ['stage', 2]],
    quality: [['masterpiece', 5], ['best quality', 5], ['ultra detailed', 4], ['highres', 3], ['8k', 3], ['hdr', 3]]
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
const E621_FLOW_CONFIG = createPromptFlowConfig(E621_PROMPT_PHASES, E621_PHASE_PRIORITY_KEYWORDS, 'quality');

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
    constructor(tagMapsBySource, tagListsBySource, categoryOrderBySource, options = {}) {
        this.sourceMaps = {};
        Object.entries(tagMapsBySource || {}).forEach(([source, map]) => {
            this.sourceMaps[source] = { ...(map || {}) };
        });
        this.tagListsBySource = tagListsBySource || {};
        this.categoryOrderBySource = categoryOrderBySource || {};
        this.e621TaxonomyData = options.e621Taxonomy || null;
        this.ontologyData = options.ontology || null;
        this.metadataCatalogs = options.metadataCatalogs || {};
        const availableSources = Object.keys(this.sourceMaps);
        this.activeSource = options.initialSource && availableSources.includes(options.initialSource)
            ? options.initialSource
            : (availableSources[0] || 'danbooru');
        this.categories = [];
        this.categorySet = new Set();
        this.categoryOrder = [];
        this.applySource(this.activeSource);
    }

    applySource(source) {
        if (!this.sourceMaps[source]) {
            console.warn(`Unknown tag source '${source}', falling back to default.`);
            source = Object.keys(this.sourceMaps)[0] || 'danbooru';
        }
        this.activeSource = source;
        this.primaryIndex = this.sourceMaps[source] || {};
        this.categoryOrder = [...(this.categoryOrderBySource[source] || this.categoryOrderBySource.default || [])];
        this.categorySet = new Set([...this.categoryOrder, ...Object.values(this.primaryIndex || {}), 'Uncategorized']);
        this.patternIndex = { ends: {}, starts: {} };
        this.keywordIndex = {};
        this.e621CategoryMap = {};
        this.e621KeywordHints = {};
        this.e621SuffixHints = {};
        this.ontologyKeywordMap = {};
        this.ontologyRegexRules = [];
        this.ontologyComboRules = [];
        this.metadataCatalog = null;
        this.metadataTypeDefaults = {};
        this.metadataCategoryAliasMap = {};
        this.metadataTagIndex = {};
        this.metadataAliasIndex = {};
        this.metadataPrefixRules = [];
        this.metadataSuffixRules = [];
        this.metadataKeywordRules = [];
        this.metadataRegexRules = [];
        this.metadataFallbackCategory = 'Uncategorized';
        const metadataCatalog = this.metadataCatalogs[source] || null;
        this.applyMetadataCatalog(metadataCatalog, source);
        if (source === 'e621' && this.e621TaxonomyData) {
            this.integrateE621Taxonomy(this.e621TaxonomyData);
        }
        if (this.ontologyData) {
            this.applyOntology(this.ontologyData);
        }
        this.buildEnhancedHeuristics(source);
        this.buildHeuristicIndexes(this.tagListsBySource[source] || []);
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

    resolveMetadataCategory(category) {
        if (!category) return null;
        const aliasMap = this.metadataCategoryAliasMap || {};
        let resolved = category;
        const visited = new Set();
        while (resolved && aliasMap[resolved] && !visited.has(resolved)) {
            visited.add(resolved);
            resolved = aliasMap[resolved];
        }
        return resolved || category;
    }

    resolveDescriptor(descriptor, defaultSource, options = {}) {
        const allowNull = Boolean(options.allowNull);
        const skipConfidenceClamp = Boolean(options.skipConfidenceClamp);
        const skipCategoryAlias = Boolean(options.skipCategoryAlias);
        const base = typeof descriptor === 'string' ? { category: descriptor } : { ...(descriptor || {}) };
        const type = base.type;
        let category = base.category;
        if (category && !skipCategoryAlias) {
            category = this.resolveMetadataCategory(category);
        }
        if (!category && type && this.metadataTypeDefaults[type]) {
            category = this.metadataTypeDefaults[type].category;
        }
        if (!category && base.fallback_type && this.metadataTypeDefaults[base.fallback_type]) {
            category = this.metadataTypeDefaults[base.fallback_type].category;
        }
        if (!category && base.fallback_category) {
            category = skipCategoryAlias ? base.fallback_category : this.resolveMetadataCategory(base.fallback_category);
        }
        if (!category && !allowNull) {
            category = this.metadataFallbackCategory;
        }
        const defaultConfidence = type && this.metadataTypeDefaults[type]
            ? this.metadataTypeDefaults[type].confidence
            : 0.72;
        let confidence = base.confidence || defaultConfidence;
        if (!skipConfidenceClamp) {
            confidence = Math.max(0.25, Math.min(0.99, confidence));
        }
        const source = base.source || defaultSource || (type ? `Metadata (${type})` : 'Metadata');
        return { category, confidence, source, type };
    }

    applyMetadataCatalog(catalog, source) {
        if (!catalog) {
            this.metadataCatalog = null;
            return;
        }
        this.metadataCatalog = catalog;
        this.metadataCategoryAliasMap = { ...(catalog.category_aliases || {}) };
        if (catalog.fallback_category) {
            const resolvedFallback = this.resolveMetadataCategory(catalog.fallback_category);
            if (resolvedFallback) this.metadataFallbackCategory = resolvedFallback;
        }
        const typeDefaults = catalog.type_defaults || {};
        Object.entries(typeDefaults).forEach(([type, descriptor]) => {
            const normalized = typeof descriptor === 'string' ? { category: descriptor } : { ...descriptor };
            const resolvedCategory = this.resolveMetadataCategory(normalized.category);
            if (resolvedCategory) {
                this.addCategory(resolvedCategory);
            }
            this.metadataTypeDefaults[type] = {
                category: resolvedCategory || normalized.category || null,
                confidence: normalized.confidence || 0.8,
                source: normalized.source || `Metadata (${type})`
            };
        });
        Object.entries(catalog.direct || {}).forEach(([tag, descriptor]) => {
            const normalizedTag = tag.toLowerCase().replace(/ /g, '_');
            const resolved = this.resolveDescriptor(descriptor, (descriptor && descriptor.source) || 'Metadata (Direct)', { allowNull: true });
            if (resolved.category) this.addCategory(resolved.category);
            this.metadataTagIndex[normalizedTag] = { ...(typeof descriptor === 'object' ? descriptor : { category: descriptor }), ...resolved };
        });
        Object.entries(catalog.aliases || {}).forEach(([alias, descriptor]) => {
            const normalizedAlias = alias.toLowerCase().replace(/ /g, '_');
            this.metadataAliasIndex[normalizedAlias] = descriptor;
        });
        this.metadataPrefixRules = (catalog.prefix_rules || []).map(rule => ({
            ...rule,
            prefix: (rule.prefix || '').toLowerCase()
        })).filter(rule => rule.prefix);
        this.metadataSuffixRules = (catalog.suffix_rules || []).map(rule => ({
            ...rule,
            suffix: (rule.suffix || '').toLowerCase()
        })).filter(rule => rule.suffix);
        this.metadataKeywordRules = (catalog.keyword_rules || []).map(rule => ({
            ...rule,
            keyword: (rule.keyword || '').toLowerCase()
        })).filter(rule => rule.keyword);
        this.metadataRegexRules = (catalog.regex_rules || []).map(rule => {
            if (!rule.pattern) return null;
            try {
                return { ...rule, regex: new RegExp(rule.pattern, 'i') };
            } catch (error) {
                console.warn(`Invalid metadata regex for source '${source}': ${rule.pattern}`, error);
                return null;
            }
        }).filter(Boolean);
        if (Array.isArray(catalog.additional_categories)) {
            catalog.additional_categories.forEach(category => this.addCategory(this.resolveMetadataCategory(category) || category));
        }
    }

    getDirectMetadata(tagString) {
        if (!this.metadataCatalog) return null;
        const normalizedTag = tagString.toLowerCase().replace(/ /g, '_');
        const direct = this.metadataTagIndex[normalizedTag];
        if (direct) {
            const info = this.resolveDescriptor(direct, direct.source || 'Metadata (Direct)');
            if (info.category && info.category !== 'Uncategorized') {
                this.addCategory(info.category);
                return { category: info.category, source: info.source, confidence: info.confidence, type: info.type };
            }
        }
        const aliasDescriptor = this.metadataAliasIndex[normalizedTag];
        if (!aliasDescriptor) return null;
        if (typeof aliasDescriptor === 'string') {
            const canonical = aliasDescriptor.toLowerCase().replace(/ /g, '_');
            const canonicalMeta = this.metadataTagIndex[canonical];
            if (canonicalMeta) {
                const info = this.resolveDescriptor(canonicalMeta, canonicalMeta.source || 'Metadata (Alias)');
                if (info.category && info.category !== 'Uncategorized') {
                    this.addCategory(info.category);
                    return { category: info.category, source: info.source, confidence: info.confidence, type: info.type };
                }
            }
            if (this.metadataTypeDefaults[aliasDescriptor]) {
                const info = this.resolveDescriptor({ type: aliasDescriptor }, 'Metadata (Alias)', { allowNull: true });
                if (info.category && info.category !== 'Uncategorized') {
                    this.addCategory(info.category);
                    return { category: info.category, source: info.source, confidence: info.confidence, type: info.type };
                }
            }
            return null;
        }
        const aliasCopy = { ...aliasDescriptor };
        const defaultSource = aliasCopy.source || 'Metadata (Alias)';
        if (aliasCopy.name) {
            const canonical = aliasCopy.name.toLowerCase().replace(/ /g, '_');
            const canonicalMeta = this.metadataTagIndex[canonical];
            if (canonicalMeta) {
                const info = this.resolveDescriptor(canonicalMeta, canonicalMeta.source || defaultSource);
                if (info.category && info.category !== 'Uncategorized') {
                    this.addCategory(info.category);
                    return { category: info.category, source: info.source, confidence: info.confidence, type: info.type };
                }
            }
            delete aliasCopy.name;
        }
        const info = this.resolveDescriptor(aliasCopy, defaultSource, { allowNull: true });
        if (info.category && info.category !== 'Uncategorized') {
            this.addCategory(info.category);
            return { category: info.category, source: info.source, confidence: info.confidence, type: info.type };
        }
        return null;
    }

    applyMetadataHints(normalizedTag, words, addScore) {
        if (!this.metadataCatalog) return;
        this.metadataPrefixRules.forEach(rule => {
            if (normalizedTag.startsWith(rule.prefix)) {
                const info = this.resolveDescriptor(rule, rule.source || 'Metadata (Prefix)', { allowNull: true });
                if (info.category && info.category !== 'Uncategorized') {
                    addScore(info.category, Math.max(0.6, info.confidence || 0.75), info.source);
                }
            }
        });
        this.metadataSuffixRules.forEach(rule => {
            if (normalizedTag.endsWith(rule.suffix)) {
                const info = this.resolveDescriptor(rule, rule.source || 'Metadata (Suffix)', { allowNull: true });
                if (info.category && info.category !== 'Uncategorized') {
                    addScore(info.category, Math.max(0.6, info.confidence || 0.75), info.source);
                }
            }
        });
        this.metadataKeywordRules.forEach(rule => {
            const keyword = rule.keyword;
            if (!keyword) return;
            const matches = keyword.includes(':') ? normalizedTag.includes(keyword) : words.includes(keyword);
            if (matches) {
                const info = this.resolveDescriptor(rule, rule.source || 'Metadata (Keyword)', { allowNull: true });
                if (info.category && info.category !== 'Uncategorized') {
                    addScore(info.category, Math.max(0.5, info.confidence || 0.7), info.source);
                }
            }
        });
        this.metadataRegexRules.forEach(rule => {
            if (!rule.regex) return;
            if (rule.regex.test(normalizedTag)) {
                const info = this.resolveDescriptor(rule, rule.source || 'Metadata (Pattern)', { allowNull: true });
                if (info.category && info.category !== 'Uncategorized') {
                    addScore(info.category, Math.max(0.65, info.confidence || 0.75), info.source);
                }
            }
        });
    }

    integrateE621Taxonomy(taxonomy) {
        const categoryMap = taxonomy?.category_map || {};
        const keywordHints = taxonomy?.keyword_hints || {};
        const suffixHints = taxonomy?.suffix_hints || {};
        this.e621CategoryMap = Object.fromEntries(Object.entries(categoryMap).map(([key, value]) => [key, value || 'Uncategorized']));
        this.e621KeywordHints = Object.fromEntries(Object.entries(keywordHints).map(([key, keywords]) => [key, (keywords || []).map(kw => kw.toLowerCase())]));
        this.e621SuffixHints = Object.fromEntries(Object.entries(suffixHints).map(([suffix, category]) => [suffix.toLowerCase(), category]));
        Object.values(this.e621CategoryMap).forEach(category => this.addCategory(category));
        if (Array.isArray(taxonomy?.additional_categories)) {
            taxonomy.additional_categories.forEach(category => this.addCategory(category));
        }
    }

    applyOntology(ontology) {
        this.ontologyKeywordMap = {};
        this.ontologyRegexRules = [];
        this.ontologyComboRules = [];
        if (ontology?.category_keywords) {
            Object.entries(ontology.category_keywords).forEach(([category, keywords]) => {
                this.ontologyKeywordMap[category] = (keywords || []).map(keyword => keyword.toLowerCase());
                this.addCategory(category);
            });
        }
        if (Array.isArray(ontology?.pattern_rules)) {
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
        this.keywordIndex = {};
        this.patternIndex = { ends: {}, starts: {} };
        const keywordCategoryCounts = {};
        const suffixCategoryCounts = {};
        const prefixCategoryCounts = {};
        const COPYRIGHT_KEYWORDS = new Set(['(genshin_impact)', '(azur_lane)', '(touhou)', '(hololive)', '(fate/grand_order)']);
        (allTags || []).forEach(tag => {
            const category = this.primaryIndex[tag] || (this.metadataTagIndex && this.metadataTagIndex[tag]?.category);
            if (!category) return;
            const words = tag.split(/[_:]/).filter(Boolean);
            if (words.length > 1) {
                words.forEach(word => {
                    if (word.length < 3 || COPYRIGHT_KEYWORDS.has(word)) return;
                    if (!keywordCategoryCounts[word]) keywordCategoryCounts[word] = {};
                    keywordCategoryCounts[word][category] = (keywordCategoryCounts[word][category] || 0) + 1;
                });
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
            if (total > 8 && (categoryCount / total) > 0.7) this.patternIndex.ends[`_${suffix}`] = mostLikelyCategory;
        }
        for (const prefix in prefixCategoryCounts) {
            const counts = prefixCategoryCounts[prefix];
            const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
            const [mostLikelyCategory, categoryCount] = Object.entries(counts).reduce((a, b) => a[1] > b[1] ? a : b);
            if (total > 8 && (categoryCount / total) > 0.7) this.patternIndex.starts[`${prefix}_`] = mostLikelyCategory;
        }
    }

    buildEnhancedHeuristics(source) {
        this.characterPatterns = [/\([^)]+\)$/, /_\([^)]+\)$/, /^[a-z]+_[a-z]+_\([^)]+\)$/];
        this.qualityKeywords = new Set(['quality', 'masterpiece', 'best', 'high', 'ultra', 'super', 'extremely', 'detailed', 'resolution', 'res', '4k', '8k', 'hd', 'uhd', 'absurdres']);
        this.compositionKeywords = new Set(['shot', 'view', 'angle', 'perspective', 'focus', 'body', 'portrait', 'landscape', 'close-up', 'wide', 'cowboy', 'full', 'upper', 'lower']);
        this.bodyPartKeywords = new Set(['breasts', 'ass', 'butt', 'thighs', 'legs', 'arms', 'hands', 'feet', 'face', 'eyes', 'hair', 'skin', 'body', 'torso', 'chest', 'belly', 'navel', 'shoulders', 'back', 'neck', 'head', 'nose', 'lips', 'mouth']);
        this.clothingKeywords = new Set(['dress', 'shirt', 'pants', 'skirt', 'shorts', 'jacket', 'coat', 'bikini', 'swimsuit', 'underwear', 'bra', 'panties', 'socks', 'stockings', 'thighhighs', 'pantyhose', 'boots', 'shoes', 'gloves', 'hoodie', 'kimono', 'uniform']);
        this.actionKeywords = new Set(['sitting', 'standing', 'lying', 'walking', 'running', 'jumping', 'dancing', 'singing', 'eating', 'drinking', 'sleeping', 'smiling', 'looking', 'holding', 'grabbing', 'touching', 'reaching', 'posing', 'gesture']);
        this.settingKeywords = new Set(['background', 'outdoor', 'indoor', 'room', 'bedroom', 'bathroom', 'kitchen', 'school', 'office', 'beach', 'forest', 'city', 'sky', 'night', 'day', 'sunset', 'sunrise', 'moon', 'star', 'cloud', 'rain', 'snow', 'weather']);
        this.speciesKeywords = new Set(['canine', 'feline', 'dragon', 'avian', 'lupine', 'vulpine', 'kitsune', 'bovine', 'equine', 'reptile', 'lizard', 'wolf', 'fox', 'cat', 'dog', 'bird', 'lion', 'tiger', 'bunny', 'rabbit']);
        this.categoryAliases = {
            body: source === 'e621' ? 'Anatomy & Detail' : 'Body Parts',
            species: source === 'e621' ? 'Species & Body' : 'Subject & Creatures',
            action: source === 'e621' ? 'Actions & Interaction' : 'Actions & Poses',
            setting: source === 'e621' ? 'Scene & Setting' : 'Setting & Environment',
            clothing: source === 'e621' ? 'Wardrobe & Accessories' : 'Attire'
        };
        this.emotionKeywords = new Set(['smile', 'smiling', 'angry', 'anger', 'blush', 'crying', 'tears', 'joy', 'sad', 'determined', 'focused', 'surprised', 'wink', 'laughing']);
        this.genderKeywords = new Set();
        this.genitalKeywords = new Set();
        this.kinkKeywords = new Set();
        this.ratingKeywords = new Set();
        this.loreKeywords = new Set();
        this.fluidKeywords = new Set();
        this.propKeywords = new Set();
        if (source === 'e621') {
            this.genderKeywords = new Set(['male', 'female', 'intersex', 'trans', 'futa', 'herm', 'cuntboy', 'dickgirl', 'gynomorph', 'andromorph', 'mtf', 'ftm']);
            this.genitalKeywords = new Set(['sheath', 'knot', 'penis', 'cock', 'shaft', 'vulva', 'cloaca', 'labia', 'balls', 'testicles', 'scrotum', 'cum', 'ejaculation', 'semen', 'pussy', 'anus']);
            this.kinkKeywords = new Set(['bondage', 'bdsm', 'tentacle', 'latex', 'inflation', 'vore', 'transformation', 'lingerie', 'toy', 'vibrator', 'strapon', 'dominant', 'submission', 'petplay', 'watersports', 'hypnosis', 'milking']);
            this.ratingKeywords = new Set(['rating:s', 'rating:q', 'rating:e', 'safe', 'explicit', 'questionable', 'suggestive']);
            this.loreKeywords = new Set(['lore', 'worldbuilding', 'canon', 'species:custom', 'setting:original', 'story']);
            this.fluidKeywords = new Set(['cum', 'ejaculation', 'drool', 'saliva', 'milk', 'sweat', 'wet', 'goo', 'slime', 'lube', 'fluid']);
            this.propKeywords = new Set(['collar', 'harness', 'gag', 'blindfold', 'rope', 'chain', 'leash', 'strap', 'toy', 'vibrator', 'plug', 'restraint', 'gear', 'armor', 'weapon']);
            this.speciesKeywords = new Set([...this.speciesKeywords, 'taur', 'sergal', 'protogen', 'hybrid', 'gryphon', 'otter', 'shark', 'mammal', 'fish', 'avian', 'reptilian', 'bug', 'arthropod']);
        }
    }

    updateIndex(tag, newCategory) {
        const normalized = tag.toLowerCase().replace(/ /g, '_');
        const activeMap = this.sourceMaps[this.activeSource];
        activeMap[normalized] = newCategory;
        this.primaryIndex = activeMap;
        this.addCategory(newCategory);
    }

    categorizeEnhanced(tagString) {
        const normalizedTag = tagString.toLowerCase().replace(/ /g, '_');
        if (this.primaryIndex[normalizedTag]) {
            return { category: this.primaryIndex[normalizedTag], source: 'Primary', confidence: 1.0 };
        }
        const metadataDirect = this.getDirectMetadata(tagString);
        if (metadataDirect) {
            return metadataDirect;
        }
        const words = normalizedTag.split(/[_:]/).filter(Boolean);
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
        this.applyMetadataHints(normalizedTag, words, addScore);
        for (const pattern of this.characterPatterns) {
            if (pattern.test(normalizedTag)) addScore('Characters', 1.2, 'Character pattern');
        }
        if (normalizedTag.startsWith('rating:') || this.ratingKeywords.has(normalizedTag)) {
            addScore('Rating & Safety', 1.4, 'Rating indicator');
        }
        words.forEach(word => {
            if (this.keywordIndex[word]) addScore(this.keywordIndex[word], 1.1, `Known keyword '${word}'`);
            if (this.qualityKeywords.has(word)) addScore('Quality', 0.9, `Quality keyword '${word}'`);
            if (this.compositionKeywords.has(word)) addScore('Composition', 0.85, `Composition keyword '${word}'`);
            if (this.bodyPartKeywords.has(word)) addScore(this.categoryAliases.body || 'Body Parts', 1.0, `Anatomy keyword '${word}'`);
            if (this.clothingKeywords.has(word)) addScore(this.categoryAliases.clothing || 'Attire', 0.95, `Wardrobe keyword '${word}'`);
            if (this.actionKeywords.has(word)) addScore(this.categoryAliases.action || 'Actions & Poses', 0.9, `Action keyword '${word}'`);
            if (this.settingKeywords.has(word)) addScore(this.categoryAliases.setting || 'Setting & Environment', 0.9, `Setting keyword '${word}'`);
            if (this.speciesKeywords.has(word)) addScore(this.categoryAliases.species || 'Subject & Creatures', 1.05, `Species keyword '${word}'`);
            if (this.emotionKeywords.has(word)) addScore('Emotion & Expression', 0.9, `Expression keyword '${word}'`);
            if (this.genderKeywords.has(word)) addScore('Gender & Identity', 1.05, `Gender keyword '${word}'`);
            if (this.genitalKeywords.has(word)) addScore('Genitals & Fluids', 1.1, `Anatomy detail '${word}'`);
            if (this.kinkKeywords.has(word)) addScore('Kinks & Themes', 0.95, `Theme keyword '${word}'`);
            if (this.propKeywords.has(word)) addScore('Props & Gear', 0.9, `Gear keyword '${word}'`);
            if (this.loreKeywords.has(word)) addScore('Meta & Lore', 0.8, `Lore keyword '${word}'`);
            if (this.fluidKeywords.has(word)) addScore('Genitals & Fluids', 0.85, `Fluid keyword '${word}'`);
        });
        Object.entries(this.e621KeywordHints).forEach(([e621Category, keywords]) => {
            const mappedCategory = this.e621CategoryMap[e621Category];
            if (!mappedCategory) return;
            keywords.forEach(keyword => {
                if (normalizedTag.includes(keyword)) addScore(mappedCategory, 0.85, `E621 hint '${keyword}'`);
            });
        });
        Object.entries(this.e621SuffixHints).forEach(([suffix, mappedCategory]) => {
            if (normalizedTag.endsWith(suffix)) addScore(mappedCategory, 0.8, `E621 suffix '${suffix}'`);
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
        const words = tag.split(/[_:]/).filter(Boolean);
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

    categorize(tagString, options = {}) {
        const hybrid = this.categorizeEnhanced(tagString);
        if (hybrid.category && hybrid.category !== 'Uncategorized') {
            return hybrid;
        }
        if (options.allowFallback === false) {
            return hybrid;
        }
        const fallback = this.categorizeOriginal(tagString);
        if (fallback.category && fallback.category !== hybrid.category && fallback.category !== 'Uncategorized') {
            return { ...fallback, source: `${hybrid.source || 'Hybrid'} → ${fallback.source}` };
        }
        return hybrid;
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

function determinePromptFlowPhase(tag, config = PROMPT_FLOW_CONFIG) {
    const categoryName = tag.category || 'Uncategorized';
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

function computePromptFlowScore(tag, phaseKey, config = PROMPT_FLOW_CONFIG) {
    const normalized = normalizeTagText(tag.weighted || tag.original);
    const priorities = config.priorityKeywords[phaseKey] || [];
    let score = 0;
    for (const [keyword, weight] of priorities) {
        if (normalized.includes(keyword)) score += weight;
    }
    if (tag.categorySource === 'Primary') score += 0.5;
    const weightMatch = tag.weighted && tag.weighted.match(/:(\d+(?:\.\d+)?)/);
    if (weightMatch) score += parseFloat(weightMatch[1]) / 10;
    return score;
}

function sortTagsByPromptFlow(tags, config = PROMPT_FLOW_CONFIG) {
    const groups = config.phases.map(phase => ({ phase, tags: [] }));
    const groupMap = new Map(groups.map(group => [group.phase.key, group]));
    const fallbackGroup = groupMap.get(config.fallbackKey) || groups[groups.length - 1];
    tags.forEach(tag => {
        const key = determinePromptFlowPhase(tag, config);
        const targetGroup = groupMap.get(key) || fallbackGroup;
        targetGroup.tags.push(tag);
    });
    groups.forEach(group => {
        group.tags.sort((a, b) => {
            const scoreDiff = computePromptFlowScore(b, group.phase.key, config) - computePromptFlowScore(a, group.phase.key, config);
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
        displayTags();
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
    return baseTags.filter(tag => !hiddenCategories.has(tag.category || 'Uncategorized'));
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
        const { category, source } = tagCategorizer.categorize(tag, { allowFallback: true });
        const oldMeta = oldTagsMeta.get(tag);
        const assignedCategory = category || 'Uncategorized';
        ensureCategoryRegistered(assignedCategory);
        newBaseTags.push({
            original: tag,
            weighted: oldMeta ? oldMeta.weighted : tag,
            id: oldMeta ? oldMeta.id : `tag-${tagIdCounter++}`,
            category: assignedCategory,
            categorySource: source,
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
    if (sortValue === 'danbooru') {
        const groups = visibleTags.reduce((acc, tag) => {
            const c = tag.category || 'Uncategorized';
            if (!acc[c]) acc[c] = [];
            acc[c].push(tag);
            return acc;
        }, {});
        const sortedCategoryOrder = [...new Set([...tagCategorizer.categoryOrder, ...knownCategories, 'Uncategorized'])];
        sortedCategoryOrder.forEach(categoryName => {
            const tagsForCategory = groups[categoryName];
            if (!tagsForCategory || tagsForCategory.length === 0) return;
            const groupDiv = document.createElement('div');
            groupDiv.className = 'tag-group fade-in-up';
            groupDiv.innerHTML = `<h3 class="tag-group-title">${categoryName}</h3>`;
            const container = document.createElement('div');
            container.className = 'tag-group-container';
            container.dataset.groupName = categoryName;
            tagsForCategory.forEach(tag => container.appendChild(createTagElement(tag)));
            groupDiv.appendChild(container);
            tagOutput.appendChild(groupDiv);
        });
    } else if (['flow', 'illustrious', 'e621'].includes(sortValue)) {
        const flowConfig = sortValue === 'illustrious' ? ILLUSTRIOUS_FLOW_CONFIG : (sortValue === 'e621' ? E621_FLOW_CONFIG : PROMPT_FLOW_CONFIG);
        const flowGroups = sortTagsByPromptFlow(visibleTags, flowConfig);
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
        container.dataset.groupName = 'all';
        tagsToDisplay.forEach(tag => container.appendChild(createTagElement(tag)));
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

function createTagElement(tag) {
    const el = document.createElement('div');
    el.className = 'tag-base processed-tag';
    el.dataset.id = tag.id;
    el.dataset.weightedTag = tag.weighted;
    el.dataset.tagOriginal = tag.original;
    el.dataset.category = tag.category || 'Uncategorized';
    if (selectedTagIds.has(tag.id)) el.classList.add('selected');
    el.style.borderStyle = tag.categorySource !== 'Primary' ? 'dashed' : 'solid';
    el.title = `(${tag.categorySource}) ${tag.original}\nCategory: ${tag.category}\n\nCtrl+Click to multi-select.\nRight-click for options.`;

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
        tagsToUpdate.forEach(tag => { tagCategorizer.updateIndex(tag.original, newCategory); tag.category = newCategory; tag.categorySource = 'Primary'; });
        ensureCategoryRegistered(newCategory);
        selectedTagIds.clear(); displayTags();
    } catch (error) { console.error("Update failed:", error); copyMessage.textContent = `Error: ${error.message}`; if (error.message.includes("401")) gitHubPat = null;  } 
    finally { setTimeout(() => copyMessage.textContent = '', 5000); }
}

async function loadExternalData() {
    document.title = 'Danbooru Tag Helper (Loading...)';
    try {
        const timestamp = `t=${Date.now()}`;
        const [tagsResponse, mapResponse, e621Response, ontologyResponse, e621MapResponse, e621TagsResponse, danbooruMetadataResponse, e621MetadataResponse] = await Promise.all([
            fetch(`data/tags.json?${timestamp}`),
            fetch(`data/tag_map.json?${timestamp}`),
            fetch(`data/e621_taxonomy.json?${timestamp}`).catch(() => null),
            fetch(`data/tag_ontology.json?${timestamp}`).catch(() => null),
            fetch(`data/e621_tag_map.json?${timestamp}`).catch(() => null),
            fetch(`data/e621_tags.json?${timestamp}`).catch(() => null),
            fetch(`data/danbooru_metadata.json?${timestamp}`).catch(() => null),
            fetch(`data/e621_metadata.json?${timestamp}`).catch(() => null)
        ]);
        if (!tagsResponse.ok) throw new Error(`Failed to fetch data/tags.json: ${tagsResponse.statusText}`);
        if (!mapResponse.ok) throw new Error(`Failed to fetch data/tag_map.json: ${mapResponse.statusText}`);
        const danbooruTags = await tagsResponse.json();
        const tagMap = await mapResponse.json();
        TAG_DATABASES = { danbooru: danbooruTags };
        TAG_DATABASE = danbooruTags;
        let e621Taxonomy = null;
        if (e621Response && e621Response.ok) {
            e621Taxonomy = await e621Response.json();
        }
        let ontology = null;
        if (ontologyResponse && ontologyResponse.ok) {
            ontology = await ontologyResponse.json();
        }
        let e621TagMap = {};
        if (e621MapResponse && e621MapResponse.ok) {
            e621TagMap = await e621MapResponse.json();
        }
        let e621Tags = [];
        if (e621TagsResponse && e621TagsResponse.ok) {
            e621Tags = await e621TagsResponse.json();
        }
        let danbooruMetadata = null;
        if (danbooruMetadataResponse && danbooruMetadataResponse.ok) {
            danbooruMetadata = await danbooruMetadataResponse.json();
        }
        let e621Metadata = null;
        if (e621MetadataResponse && e621MetadataResponse.ok) {
            e621Metadata = await e621MetadataResponse.json();
        }
        TAG_DATABASES.e621 = e621Tags;
        const categoryOrderBySource = {
            default: [
                'Quality',
                'Rating & Safety',
                'Artists',
                'Composition',
                'Characters',
                'Franchise & Lore',
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
                'Weather & Atmosphere',
                'Lighting & Effects',
                'Style & Meta'
            ],
            danbooru: [
                'Quality',
                'Rating & Safety',
                'Artists',
                'Composition',
                'Characters',
                'Franchise & Lore',
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
                'Weather & Atmosphere',
                'Lighting & Effects',
                'Style & Meta'
            ],
            e621: [
                'Rating & Safety',
                'Gender & Identity',
                'Artists',
                'Characters',
                'Species & Body',
                'Anatomy & Detail',
                'Genitals & Fluids',
                'Kinks & Themes',
                'Wardrobe & Accessories',
                'Props & Gear',
                'Actions & Interaction',
                'Scene & Setting',
                'Lighting & Effects',
                'Meta & Lore',
                'Quality'
            ]
        };
        tagCategorizer = new EnhancedTagCategorizer({
            danbooru: tagMap,
            e621: e621TagMap
        }, TAG_DATABASES, categoryOrderBySource, {
            e621Taxonomy,
            ontology,
            initialSource: 'danbooru',
            metadataCatalogs: {
                danbooru: danbooruMetadata,
                e621: e621Metadata
            }
        });
        knownCategories = new Set([...tagCategorizer.categories, 'Uncategorized']);
        if (tagDialectSelect) {
            tagDialectSelect.value = tagCategorizer.activeSource;
        }
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

function handleTagDialectChange() {
    if (!tagCategorizer || !tagDialectSelect) return;
    const selectedSource = tagDialectSelect.value || 'danbooru';
    tagCategorizer.applySource(selectedSource);
    knownCategories = new Set([...tagCategorizer.categories, 'Uncategorized']);
    TAG_DATABASE = TAG_DATABASES[selectedSource] || [];
    if (selectedSource === 'e621' && sortSelect.value === 'danbooru') {
        sortSelect.value = 'e621';
    } else if (selectedSource !== 'e621' && sortSelect.value === 'e621') {
        sortSelect.value = 'danbooru';
    }
    processAll();
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
function suggestCoherentTags() {
    if (!tagCategorizer) return;
    const QUESTIONABLE_KEYWORDS = ['bikini', 'swimsuit', 'cleavage', 'breasts', 'ass', 'thighs', 'pantyhose', 'leotard', 'garter_belt', 'panty_shot', 'sideboob', 'topless', 'bra', 'panties', 'lingerie', 'seductive', 'bondage', 'shibari', 'partially_nude', 'armpits', 'bottomless'];
    const EXPLICIT_KEYWORDS = ['pussy', 'penis', 'sex', 'oral', 'ahegao', 'nude', 'naked', 'cum', 'masturbation', 'fellatio', 'cunnilingus', 'prolapse'];
    const numToSuggest = parseInt(suggestionCountInput.value, 10);
    const existingTags = new Set(baseTags.map(t => t.original.toLowerCase().replace(/ /g, '_')));
    const usingE621 = tagCategorizer.activeSource === 'e621';
    const isAllowed = (tag) => {
        if (EXPLICIT_KEYWORDS.some(kw => tag.includes(kw)) && !usingE621) return false;
        if (!ratingQuestionable.checked && QUESTIONABLE_KEYWORDS.some(kw => tag.includes(kw))) return false;
        if (!ratingGeneral.checked && !ratingSafe.checked && !ratingQuestionable.checked) return false;
        return true;
    };
    const suggestions = new Set();
    const categoryPools = {};
    TAG_DATABASE.forEach(tag => {
        const { category } = tagCategorizer.categorize(tag);
        if (!categoryPools[category]) categoryPools[category] = [];
        if (!existingTags.has(tag) && isAllowed(tag)) categoryPools[category].push(tag);
    });
    const defaultPlan = usingE621
        ? [
            { name: 'Rating & Safety', count: 1 },
            { name: 'Species & Body', count: 2 },
            { name: 'Gender & Identity', count: 1 },
            { name: 'Anatomy & Detail', count: 2 },
            { name: 'Kinks & Themes', count: 1 },
            { name: 'Actions & Interaction', count: 2 },
            { name: 'Scene & Setting', count: 2 },
            { name: 'Quality', count: 1 }
        ]
        : [
            { name: 'Quality', count: 1 },
            { name: 'Composition', count: 2 },
            { name: 'Characters', count: 1 },
            { name: 'Face', count: 2 },
            { name: 'Eyes', count: 1 },
            { name: 'Hair', count: 2 }
        ];
    const plan = (existingTags.size === 0)
        ? defaultPlan
        : Object.entries(baseTags.reduce((acc, tag) => {
            acc[tag.category] = (acc[tag.category] || 0) + 1;
            return acc;
        }, {})).map(([name, count]) => ({ name, count }));
    let suggestionsNeeded = numToSuggest;
    while (suggestionsNeeded > 0) {
        let madeSuggestion = false;
        for (const p of plan) {
            if (suggestionsNeeded <= 0) break;
            const pool = categoryPools[p.name] || [];
            for (let i = 0; i < p.count; ++i) {
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
    if (suggestionsToAdd.length > 0) {
        const separator = tagInput.value.trim().length > 0 && !tagInput.value.trim().endsWith(',') ? ', ' : '';
        tagInput.value += separator + suggestionsToAdd.join(', ').replace(/_/g, ' ');
        processAll();
    }
}

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
function exportSettings() { const settings = { theme: document.body.className.match(/theme-\w+/)?.[0] || 'theme-indigo', prepend: triggerInput.value, append: appendInput.value, swaps: swapsInput.value, implications: implicationsInput.value, blacklist: blacklistInput.value, maxTags: maxTagsInput.value, sorting: sortSelect.value, source: tagDialectSelect ? tagDialectSelect.value : 'danbooru', deduplicate: deduplicateToggle.checked, underscores: underscoreToggle.checked, weighting: enableWeightingToggle.checked, ratings: { safe: ratingSafe.checked, general: ratingGeneral.checked, questionable: ratingQuestionable.checked } }; const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `danbooru-helper-settings-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(a.href); }
function importSettings(event) { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { try { const settings = JSON.parse(e.target.result); if (settings.theme) applyTheme(settings.theme); if (settings.prepend !== undefined) triggerInput.value = settings.prepend; if (settings.append !== undefined) appendInput.value = settings.append; if (settings.swaps !== undefined) swapsInput.value = settings.swaps; if (settings.implications !== undefined) implicationsInput.value = settings.implications; if (settings.blacklist !== undefined) blacklistInput.value = settings.blacklist; if (settings.maxTags !== undefined) maxTagsInput.value = settings.maxTags; if (settings.sorting !== undefined) sortSelect.value = settings.sorting; if (settings.source !== undefined && tagDialectSelect) tagDialectSelect.value = settings.source; if (settings.deduplicate !== undefined) deduplicateToggle.checked = settings.deduplicate; if (settings.underscores !== undefined) underscoreToggle.checked = settings.underscores; if (settings.weighting !== undefined) enableWeightingToggle.checked = settings.weighting; if (settings.ratings) { if (settings.ratings.safe !== undefined) ratingSafe.checked = settings.ratings.safe; if (settings.ratings.general !== undefined) ratingGeneral.checked = settings.ratings.general; if (settings.ratings.questionable !== undefined) ratingQuestionable.checked = settings.ratings.questionable; } toggleSettingsPanel(); handleTagDialectChange(); copyMessage.textContent = 'Settings imported!'; setTimeout(() => copyMessage.textContent = '', 3000); } catch (error) { alert('Error importing settings: ' + error.message); } }; reader.readAsText(file); }
function resetToDefaults() { if (confirm('Reset all settings to defaults?')) { tagInput.value = ''; triggerInput.value = ''; appendInput.value = ''; swapsInput.value = ''; implicationsInput.value = ''; blacklistInput.value = ''; maxTagsInput.value = '75'; sortSelect.value = 'danbooru'; suggestionCountInput.value = '15'; deduplicateToggle.checked = true; underscoreToggle.checked = false; enableWeightingToggle.checked = false; ratingSafe.checked = true; ratingGeneral.checked = true; ratingQuestionable.checked = false; if (tagDialectSelect) { tagDialectSelect.value = 'danbooru'; } applyTheme('theme-indigo'); toggleSettingsPanel(); handleTagDialectChange(); } }
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
    const categoryCount = new Set(activeTags.map(t => t.category)).size;
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
    if (tagDialectSelect) tagDialectSelect.addEventListener('change', handleTagDialectChange);
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
