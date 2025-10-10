/**
 * Enhanced Tag Categorization System
 * Uses multiple strategies for more accurate automatic categorization
 */

class SmartTagCategorizer {
    constructor(tagMap, allTags, categoryOrder) {
        this.primaryIndex = tagMap;
        this.categoryOrder = categoryOrder;
        this.categories = [...new Set([
            ...Object.values(tagMap),
            ...categoryOrder,
            'Uncategorized'
        ])];
        
        // Build advanced indexes
        this.patternIndex = { ends: {}, starts: {}, contains: {} };
        this.keywordIndex = {};
        this.ngramIndex = new Map();
        this.semanticRules = this.buildSemanticRules();
        
        this.buildHeuristicIndexes(allTags);
        this.buildNGramIndex(allTags);
    }
    
    /**
     * Define semantic rules for categorization
     */
    buildSemanticRules() {
        return [
            // Character identification rules
            {
                test: (tag) => /\([^)]+\)$/.test(tag) || /_\([^)]+\)$/.test(tag),
                category: 'Characters',
                confidence: 0.95,
                reason: 'Character naming pattern'
            },
            
            // Color + body part = specific category
            {
                test: (tag) => {
                    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'pink', 
                                  'orange', 'black', 'white', 'grey', 'gray', 'brown'];
                    const hairWords = ['hair', 'hairband', 'hairstyle'];
                    return colors.some(c => tag.includes(c)) && 
                           hairWords.some(h => tag.includes(h));
                },
                category: 'Hair',
                confidence: 0.9,
                reason: 'Color + hair combination'
            },
            
            {
                test: (tag) => {
                    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'pink',
                                  'orange', 'black', 'white', 'grey', 'gray', 'brown'];
                    const eyeWords = ['eyes', 'eyed', 'eye color'];
                    return colors.some(c => tag.includes(c)) && 
                           eyeWords.some(e => tag.includes(e));
                },
                category: 'Eyes',
                confidence: 0.9,
                reason: 'Color + eyes combination'
            },
            
            // Clothing rules
            {
                test: (tag) => {
                    const clothingWords = ['dress', 'shirt', 'pants', 'skirt', 'shorts',
                                         'jacket', 'coat', 'suit', 'uniform', 'outfit'];
                    return clothingWords.some(w => tag.includes(w));
                },
                category: 'Attire',
                confidence: 0.85,
                reason: 'Clothing keyword'
            },
            
            // Action/pose rules
            {
                test: (tag) => {
                    const actionWords = ['ing', 'ed']; // gerunds and past participles
                    const actionVerbs = ['sitting', 'standing', 'running', 'walking',
                                       'jumping', 'lying', 'kneeling', 'holding',
                                       'looking', 'smiling', 'crying', 'sleeping'];
                    return actionVerbs.some(v => tag.includes(v)) ||
                           (actionWords.some(ending => tag.endsWith(ending)) && 
                            tag.split('_').length <= 2);
                },
                category: 'Actions & Poses',
                confidence: 0.8,
                reason: 'Action verb pattern'
            },
            
            // Body part rules
            {
                test: (tag) => {
                    const bodyParts = ['breast', 'chest', 'ass', 'butt', 'thigh',
                                     'leg', 'arm', 'hand', 'foot', 'feet', 'finger',
                                     'toe', 'torso', 'waist', 'hip', 'shoulder'];
                    return bodyParts.some(part => tag.includes(part));
                },
                category: 'Body Parts',
                confidence: 0.85,
                reason: 'Body part keyword'
            },
            
            // Quality tags
            {
                test: (tag) => {
                    const qualityWords = ['quality', 'masterpiece', 'best', 'high',
                                        'detailed', 'absurdres', 'highres', '4k', '8k'];
                    return qualityWords.some(q => tag.includes(q));
                },
                category: 'Quality',
                confidence: 0.95,
                reason: 'Quality indicator'
            },
            
            // Setting/environment
            {
                test: (tag) => {
                    const placeWords = ['room', 'outdoor', 'indoor', 'background',
                                      'sky', 'forest', 'city', 'beach', 'school'];
                    return placeWords.some(p => tag.includes(p));
                },
                category: 'Setting & Environment',
                confidence: 0.8,
                reason: 'Location keyword'
            }
        ];
    }
    
    /**
     * Build statistical indexes from known tags
     */
    buildHeuristicIndexes(allTags) {
        const keywordCategoryCounts = {};
        const suffixCategoryCounts = {};
        const prefixCategoryCounts = {};
        const containsCategoryCounts = {};
        
        const COPYRIGHT_KEYWORDS = new Set([
            '(genshin_impact)', '(azur_lane)', '(touhou)', 
            '(hololive)', '(fate/grand_order)'
        ]);
        
        allTags.forEach(tag => {
            const category = this.primaryIndex[tag];
            if (!category) return;
            
            const words = tag.split('_');
            
            // Word-level analysis
            if (words.length > 1) {
                words.forEach(word => {
                    if (word.length < 3 || COPYRIGHT_KEYWORDS.has(word)) return;
                    
                    if (!keywordCategoryCounts[word]) {
                        keywordCategoryCounts[word] = {};
                    }
                    keywordCategoryCounts[word][category] = 
                        (keywordCategoryCounts[word][category] || 0) + 1;
                });
                
                // Suffix analysis
                const suffix = words[words.length - 1];
                if (suffix.length >= 3) {
                    if (!suffixCategoryCounts[suffix]) {
                        suffixCategoryCounts[suffix] = {};
                    }
                    suffixCategoryCounts[suffix][category] = 
                        (suffixCategoryCounts[suffix][category] || 0) + 1;
                }
                
                // Prefix analysis
                const prefix = words[0];
                if (prefix.length >= 3) {
                    if (!prefixCategoryCounts[prefix]) {
                        prefixCategoryCounts[prefix] = {};
                    }
                    prefixCategoryCounts[prefix][category] = 
                        (prefixCategoryCounts[prefix][category] || 0) + 1;
                }
            }
            
            // Substring analysis for common patterns
            for (let i = 0; i < tag.length - 2; i++) {
                const substr = tag.substring(i, i + 3);
                if (!containsCategoryCounts[substr]) {
                    containsCategoryCounts[substr] = {};
                }
                containsCategoryCounts[substr][category] = 
                    (containsCategoryCounts[substr][category] || 0) + 1;
            }
        });
        
        // Build indexes from counts
        this.buildIndexFromCounts(keywordCategoryCounts, this.keywordIndex, 5, 0.75);
        this.buildIndexFromCounts(suffixCategoryCounts, this.patternIndex.ends, 10, 0.7, '_');
        this.buildIndexFromCounts(prefixCategoryCounts, this.patternIndex.starts, 10, 0.7, '', '_');
        this.buildIndexFromCounts(containsCategoryCounts, this.patternIndex.contains, 20, 0.65);
    }
    
    buildIndexFromCounts(counts, targetIndex, minTotal, minRatio, prefix = '', suffix = '') {
        for (const key in counts) {
            const categoryCounts = counts[key];
            const total = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
            
            if (total < minTotal) continue;
            
            const sortedCategories = Object.entries(categoryCounts)
                .sort((a, b) => b[1] - a[1]);
            
            const [topCategory, topCount] = sortedCategories[0];
            const ratio = topCount / total;
            
            if (ratio >= minRatio) {
                const indexKey = prefix + key + suffix;
                targetIndex[indexKey] = topCategory;
            }
        }
    }
    
    /**
     * Build n-gram index for similarity matching
     */
    buildNGramIndex(allTags) {
        allTags.forEach(tag => {
            const category = this.primaryIndex[tag];
            if (!category) return;
            
            // Create 2-grams and 3-grams
            const words = tag.split('_');
            for (let n = 2; n <= 3 && n <= words.length; n++) {
                for (let i = 0; i <= words.length - n; i++) {
                    const ngram = words.slice(i, i + n).join('_');
                    if (!this.ngramIndex.has(ngram)) {
                        this.ngramIndex.set(ngram, {});
                    }
                    const ngramCats = this.ngramIndex.get(ngram);
                    ngramCats[category] = (ngramCats[category] || 0) + 1;
                }
            }
        });
    }
    
    /**
     * Main categorization method with multiple strategies
     */
    categorize(tagString) {
        const tag = tagString.toLowerCase().replace(/ /g, '_');
        
        // Strategy 1: Exact match in primary index
        if (this.primaryIndex[tag]) {
            return {
                category: this.primaryIndex[tag],
                source: 'Primary Index',
                confidence: 1.0
            };
        }
        
        // Strategy 2: Semantic rules
        for (const rule of this.semanticRules) {
            if (rule.test(tag)) {
                return {
                    category: rule.category,
                    source: `Semantic Rule: ${rule.reason}`,
                    confidence: rule.confidence
                };
            }
        }
        
        // Strategy 3: Pattern matching
        const patternResult = this.matchPatterns(tag);
        if (patternResult) return patternResult;
        
        // Strategy 4: N-gram similarity
        const ngramResult = this.matchNGrams(tag);
        if (ngramResult) return ngramResult;
        
        // Strategy 5: Keyword voting
        const keywordResult = this.matchKeywords(tag);
        if (keywordResult) return keywordResult;
        
        // Fallback
        return {
            category: 'Uncategorized',
            source: 'Fallback',
            confidence: 0.0
        };
    }
    
    matchPatterns(tag) {
        // Check prefix
        for (const [prefix, category] of Object.entries(this.patternIndex.starts)) {
            if (tag.startsWith(prefix)) {
                return {
                    category,
                    source: 'Prefix Pattern',
                    confidence: 0.75
                };
            }
        }
        
        // Check suffix
        for (const [suffix, category] of Object.entries(this.patternIndex.ends)) {
            if (tag.endsWith(suffix)) {
                return {
                    category,
                    source: 'Suffix Pattern',
                    confidence: 0.75
                };
            }
        }
        
        return null;
    }
    
    matchNGrams(tag) {
        const words = tag.split('_');
        const scores = {};
        
        // Check all n-grams
        for (let n = 2; n <= 3 && n <= words.length; n++) {
            for (let i = 0; i <= words.length - n; i++) {
                const ngram = words.slice(i, i + n).join('_');
                const ngramCats = this.ngramIndex.get(ngram);
                
                if (ngramCats) {
                    for (const [cat, count] of Object.entries(ngramCats)) {
                        scores[cat] = (scores[cat] || 0) + count * n; // Weight by n-gram size
                    }
                }
            }
        }
        
        if (Object.keys(scores).length > 0) {
            const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
            const [topCat, topScore] = sortedScores[0];
            const totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0);
            const confidence = Math.min(topScore / totalScore, 0.85);
            
            return {
                category: topCat,
                source: 'N-gram Similarity',
                confidence
            };
        }
        
        return null;
    }
    
    matchKeywords(tag) {
        const words = tag.split('_');
        const scores = {};
        
        words.forEach(word => {
            if (this.keywordIndex[word]) {
                const category = this.keywordIndex[word];
                scores[category] = (scores[category] || 0) + 1;
            }
        });
        
        if (Object.keys(scores).length > 0) {
            const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
            const [topCat, topScore] = sortedScores[0];
            const confidence = Math.min((topScore / words.length) * 0.8, 0.8);
            
            return {
                category: topCat,
                source: 'Keyword Voting',
                confidence
            };
        }
        
        return null;
    }
    
    /**
     * Update the index with a new tag mapping
     */
    updateIndex(tag, newCategory) {
        const normalizedTag = tag.toLowerCase().replace(/ /g, '_');
        this.primaryIndex[normalizedTag] = newCategory;
    }
    
    /**
     * Get all known categories
     */
    getCategories() {
        return [...this.categories];
    }
}

// Export
window.SmartTagCategorizer = SmartTagCategorizer;