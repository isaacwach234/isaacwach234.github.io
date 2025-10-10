/**
 * Illustrious-style prompt ordering based on community best practices
 * Order: Artist/Style → Subject/Character → Pose/Action → Scene/Background → Effects → Quality
 */

const ILLUSTRIOUS_PROMPT_PHASES = [
    {
        key: 'artist_style',
        label: 'Artist & Style',
        description: 'Leading style directives, art medium, and artist references',
        priority: 100,
        categories: ['Style & Meta'],
        keywords: [
            'style', 'painting', 'sketch', 'anime', 'manga', 'realistic', 'semi-realistic',
            '90s anime', 'watercolor', 'oil painting', 'digital art', 'concept art',
            'pixiv', 'artist', 'drawn', 'illustrated'
        ],
        // Tags that should be weighted down
        suggestedWeights: {
            default: 0.7,
            strong: 1.0,
            subtle: 0.5
        }
    },
    {
        key: 'subject_character',
        label: 'Subject & Character',
        description: 'Character count, physical traits, hair, eyes, and outfit',
        priority: 90,
        categories: [
            'Quality', 'Characters', 'Subject & Creatures', 
            'Hair', 'Eyes', 'Face', 'Attire', 'Body Parts'
        ],
        keywords: [
            '1girl', '2girls', '1boy', '2boys', 'solo', 'duo', 'group',
            'hair', 'eyes', 'dress', 'uniform', 'outfit', 'clothing',
            'white hair', 'long hair', 'red eyes', 'blue eyes',
            'breasts', 'face', 'body'
        ]
    },
    {
        key: 'pose_action',
        label: 'Pose, Action & Expression',
        description: 'What the character is doing and their emotional state',
        priority: 70,
        categories: ['Actions & Poses', 'Face'],
        keywords: [
            'sitting', 'standing', 'running', 'jumping', 'lying', 'kneeling',
            'holding', 'looking at viewer', 'looking away', 'looking back',
            'smile', 'smiling', 'angry', 'sad', 'happy', 'surprised',
            'closed eyes', 'open mouth', 'blush', 'embarrassed',
            'peace sign', 'waving', 'pointing', 'hand on hip'
        ]
    },
    {
        key: 'scene_background',
        label: 'Scene & Background',
        description: 'Environment, location, time of day, and atmospheric conditions',
        priority: 50,
        categories: ['Setting & Environment', 'Background Elements', 'Weather & Atmosphere'],
        keywords: [
            'indoors', 'outdoors', 'cafe', 'bedroom', 'classroom', 'city',
            'day', 'night', 'sunset', 'sunrise', 'evening', 'noon',
            'forest', 'beach', 'mountain', 'sky', 'clouds', 'rain',
            'garden', 'room', 'street', 'background'
        ]
    },
    {
        key: 'effects_detail',
        label: 'Effects & Details',
        description: 'Visual effects, lighting, atmosphere, and artistic flourishes',
        priority: 30,
        categories: [
            'Lighting & Effects', 'Color & Lighting', 
            'Rendering', 'Post-processing', 'Composition'
        ],
        keywords: [
            'lighting', 'dramatic lighting', 'soft lighting', 'rim lighting',
            'bokeh', 'depth of field', 'motion blur', 'particle effects',
            'lens flare', 'sun rays', 'god rays', 'colorful', 'vibrant',
            'cinematic', 'atmospheric', 'bloom', 'chromatic aberration'
        ]
    },
    {
        key: 'quality',
        label: 'Quality Tags',
        description: 'Overall quality boosters applied to the entire composition',
        priority: 10,
        categories: ['Quality'],
        keywords: [
            'masterpiece', 'best quality', 'high quality', 'absurdres',
            'highres', 'ultra detailed', 'extremely detailed', 'detailed',
            '8k', '4k', 'hd', 'uhd'
        ]
    }
];

// Create lookup maps
const ILLUSTRIOUS_PHASE_BY_KEY = new Map();
const ILLUSTRIOUS_PHASE_BY_CATEGORY = new Map();

ILLUSTRIOUS_PROMPT_PHASES.forEach(phase => {
    ILLUSTRIOUS_PHASE_BY_KEY.set(phase.key, phase);
    phase.keywordMatchers = phase.keywords.map(k => k.toLowerCase());
    phase.categories.forEach(cat => {
        if (!ILLUSTRIOUS_PHASE_BY_CATEGORY.has(cat)) {
            ILLUSTRIOUS_PHASE_BY_CATEGORY.set(cat, phase.key);
        }
    });
});

/**
 * Determine which prompt phase a tag belongs to
 */
function determineIllustriousPhase(tag) {
    const categoryName = tag.category || 'Uncategorized';
    
    // First check category mapping
    if (ILLUSTRIOUS_PHASE_BY_CATEGORY.has(categoryName)) {
        return ILLUSTRIOUS_PHASE_BY_CATEGORY.get(categoryName);
    }
    
    // Then check keyword matching
    const normalized = normalizeTagText(tag.original);
    for (const phase of ILLUSTRIOUS_PROMPT_PHASES) {
        if (phase.keywordMatchers.some(keyword => normalized.includes(keyword))) {
            return phase.key;
        }
    }
    
    // Default to effects for uncategorized
    return 'effects_detail';
}

/**
 * Calculate score for a tag within its phase
 */
function computeIllustriousScore(tag, phaseKey) {
    const phase = ILLUSTRIOUS_PHASE_BY_KEY.get(phaseKey);
    if (!phase) return 0;
    
    const normalized = normalizeTagText(tag.weighted || tag.original);
    let score = 0;
    
    // Check keyword matches
    for (const keyword of phase.keywordMatchers) {
        if (normalized.includes(keyword)) {
            score += 10;
            // Exact match gets bonus
            if (normalized === keyword) score += 5;
        }
    }
    
    // Category source bonus
    if (tag.categorySource === 'Primary') score += 3;
    
    // Weight modifier
    const weightMatch = tag.weighted && tag.weighted.match(/:(\d+(?:\.\d+)?)/);
    if (weightMatch) {
        score += parseFloat(weightMatch[1]) * 2;
    }
    
    // Recency bonus (newer tags slightly preferred)
    if (tag.addedAt) {
        const age = Date.now() - tag.addedAt;
        const ageHours = age / (1000 * 60 * 60);
        if (ageHours < 1) score += 2;
    }
    
    return score;
}

/**
 * Sort tags by Illustrious prompt flow
 */
function sortTagsByIllustriousFlow(tags) {
    const groups = ILLUSTRIOUS_PROMPT_PHASES.map(phase => ({
        phase,
        tags: []
    }));
    
    // Assign each tag to its phase
    tags.forEach(tag => {
        const phaseKey = determineIllustriousPhase(tag);
        const targetGroup = groups.find(g => g.phase.key === phaseKey);
        if (targetGroup) {
            targetGroup.tags.push(tag);
        } else {
            // Fallback to effects
            const fallbackGroup = groups.find(g => g.phase.key === 'effects_detail');
            if (fallbackGroup) fallbackGroup.tags.push(tag);
        }
    });
    
    // Sort tags within each phase
    groups.forEach(group => {
        group.tags.sort((a, b) => {
            const scoreDiff = computeIllustriousScore(b, group.phase.key) - 
                            computeIllustriousScore(a, group.phase.key);
            if (scoreDiff !== 0) return scoreDiff;
            
            // If scores are equal, maintain insertion order
            const timeDiff = (a.addedAt || 0) - (b.addedAt || 0);
            if (timeDiff !== 0) return timeDiff;
            
            return a.original.localeCompare(b.original);
        });
    });
    
    return groups;
}

/**
 * Normalize tag text for comparison
 */
function normalizeTagText(tag) {
    return tag.toLowerCase().replace(/_/g, ' ').trim();
}

// Export functions
window.promptFlow = {
    ILLUSTRIOUS_PROMPT_PHASES,
    determineIllustriousPhase,
    computeIllustriousScore,
    sortTagsByIllustriousFlow,
    normalizeTagText
};
