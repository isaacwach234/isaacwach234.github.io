(function(global) {
    'use strict';

    class EnhancedTagCategorizer {
        constructor(tagMap, allTags, categoryOrder, taxonomy = {}) {
            this.taxonomy = taxonomy || {};
            this.primaryIndex = {};
            Object.entries(tagMap || {}).forEach(([tag, category]) => {
                if (!tag) return;
                const normalized = tag.toLowerCase().replace(/ /g, '_');
                this.primaryIndex[normalized] = category;
            });
            const configuredOrder = (this.taxonomy.categoryOrder || []).filter(Boolean);
            this.categoryOrder = configuredOrder.length ? configuredOrder : (categoryOrder || []);
            this.categories = [...new Set([...Object.values(this.primaryIndex), ...this.categoryOrder, 'Uncategorized'])];
            this.patternIndex = { ends: {}, starts: {} };
            this.keywordIndex = {};
            this.semanticRules = this.buildSemanticRules(this.taxonomy.semanticRules || []);
            this.e621CategoryMap = this.buildE621CategoryMap(this.taxonomy.e621Categories);
            this.e621KeywordMapping = this.buildKeywordMapping(this.taxonomy.e621KeywordMapping);
            this.speciesKeywords = new Set(this.normalizeList(this.taxonomy.speciesKeywords || []));
            this.emotionKeywords = new Set(this.normalizeList(this.taxonomy.emotionKeywords || []));
            this.interactionKeywords = new Set(this.normalizeList(this.taxonomy.interactionKeywords || []));
            this.backgroundKeywords = new Set(this.normalizeList(this.taxonomy.backgroundKeywords || []));
            this.effectKeywords = new Set(this.normalizeList(this.taxonomy.effectKeywords || []));
            this.metaKeywords = new Set(this.normalizeList(this.taxonomy.metaKeywords || []));
            this.qualityKeywords = new Set(this.normalizeList(this.taxonomy.qualityKeywords || []));
            this.styleKeywords = new Set(this.normalizeList(this.taxonomy.styleKeywords || []));
            this.buildHeuristicIndexes(allTags || []);
            this.buildEnhancedHeuristics();
        }

        normalizeList(list = []) {
            return list.map(item => item.toLowerCase());
        }

        buildKeywordMapping(mapping = {}) {
            const normalizedMapping = {};
            Object.entries(mapping || {}).forEach(([key, value]) => {
                if (!value) return;
                normalizedMapping[key.toLowerCase()] = value;
            });
            return normalizedMapping;
        }

        buildE621CategoryMap(customMap = {}) {
            const defaults = {
                artist: 'Artists',
                character: 'Characters',
                copyright: 'Copyright & Franchise',
                species: 'Species & Race',
                meta: 'Meta',
                lore: 'Meta',
                general: null
            };
            return { ...defaults, ...(customMap || {}) };
        }

        buildSemanticRules(rules = []) {
            return rules.map(rule => ({
                category: rule.category || 'Uncategorized',
                priority: rule.priority || 1,
                keywords: this.normalizeList(rule.keywords || []),
                prefixes: this.normalizeList(rule.prefixes || []),
                suffixes: this.normalizeList(rule.suffixes || []),
                regexes: (rule.patterns || []).map(pattern => {
                    try {
                        return new RegExp(pattern, 'i');
                    } catch (error) {
                        console.warn('Invalid taxonomy pattern:', pattern, error);
                        return null;
                    }
                }).filter(Boolean)
            }));
        }

        buildHeuristicIndexes(allTags) {
            const keywordCategoryCounts = {};
            const suffixCategoryCounts = {};
            const prefixCategoryCounts = {};
            allTags.forEach(tag => {
                const normalized = tag.toLowerCase().replace(/ /g, '_');
                const category = this.primaryIndex[normalized];
                if (!category) return;
                const words = normalized.split('_');
                if (words.length > 1) {
                    words.forEach(word => {
                        if (word.length < 3) return;
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
                const [mostLikelyCategory, categoryCount] = Object.entries(counts).reduce((a, b) => (a[1] > b[1] ? a : b));
                if (total > 4 && (categoryCount / total) > 0.7) this.keywordIndex[keyword] = mostLikelyCategory;
            }
            for (const suffix in suffixCategoryCounts) {
                const counts = suffixCategoryCounts[suffix];
                const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
                const [mostLikelyCategory, categoryCount] = Object.entries(counts).reduce((a, b) => (a[1] > b[1] ? a : b));
                if (total > 8 && (categoryCount / total) > 0.7) this.patternIndex.ends[`_${suffix}`] = mostLikelyCategory;
            }
            for (const prefix in prefixCategoryCounts) {
                const counts = prefixCategoryCounts[prefix];
                const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
                const [mostLikelyCategory, categoryCount] = Object.entries(counts).reduce((a, b) => (a[1] > b[1] ? a : b));
                if (total > 8 && (categoryCount / total) > 0.7) this.patternIndex.starts[`${prefix}_`] = mostLikelyCategory;
            }
        }

        buildEnhancedHeuristics() {
            const addAll = (targetSet, values) => values.forEach(value => targetSet.add(value));
            this.characterPatterns = [/\([^)]+\)$/, /_\([^)]+\)$/, /^[a-z]+_[a-z]+_\([^)]+\)$/];
            const defaultQuality = ['quality', 'masterpiece', 'best', 'high', 'ultra', 'super', 'detailed', 'resolution', 'res', '4k', '8k', 'hd', 'uhd', 'absurdres'];
            const defaultComposition = ['shot', 'view', 'angle', 'perspective', 'focus', 'body', 'portrait', 'landscape', 'close-up', 'wide', 'cowboy', 'full', 'upper', 'lower', 'dynamic', 'framing'];
            const defaultBodyParts = ['breasts', 'ass', 'butt', 'thighs', 'legs', 'arms', 'hands', 'feet', 'face', 'eyes', 'hair', 'skin', 'body', 'torso', 'chest', 'belly', 'navel', 'shoulders', 'back', 'neck', 'head', 'nose', 'lips', 'mouth'];
            const defaultClothing = ['dress', 'shirt', 'pants', 'skirt', 'shorts', 'jacket', 'coat', 'bikini', 'swimsuit', 'underwear', 'bra', 'panties', 'socks', 'stockings', 'thighhighs', 'pantyhose', 'boots', 'shoes', 'gloves', 'uniform'];
            const defaultActions = ['sitting', 'standing', 'lying', 'walking', 'running', 'jumping', 'dancing', 'singing', 'eating', 'drinking', 'sleeping', 'smiling', 'looking', 'holding', 'grabbing', 'touching', 'reaching', 'posing', 'gesture'];
            const defaultSettings = ['background', 'outdoor', 'indoor', 'room', 'bedroom', 'bathroom', 'kitchen', 'school', 'office', 'beach', 'forest', 'city', 'sky', 'night', 'day', 'sunset', 'sunrise', 'moon', 'star', 'cloud', 'cafe', 'garden', 'mountain'];
            const defaultCamera = ['pov', 'camera', 'fov', 'fisheye', 'panorama', 'wide-angle', 'closeup', 'macro'];
            this.compositionKeywords = new Set(defaultComposition);
            this.bodyPartKeywords = new Set(defaultBodyParts);
            this.clothingKeywords = new Set(defaultClothing);
            this.actionKeywords = new Set(defaultActions);
            this.settingKeywords = new Set(defaultSettings);
            this.cameraKeywords = new Set(defaultCamera);
            addAll(this.qualityKeywords, defaultQuality);
            addAll(this.emotionKeywords, ['smile', 'laugh', 'cry', 'blush', 'angry', 'frown', 'wink', 'tears', 'grin', 'surprised']);
            addAll(this.interactionKeywords, ['duo', 'trio', 'group', 'together']);
            addAll(this.backgroundKeywords, ['landscape', 'scenery']);
        }

        updateIndex(tag, newCategory) {
            const normalized = tag.toLowerCase().replace(/ /g, '_');
            this.primaryIndex[normalized] = newCategory;
            if (newCategory && !this.categories.includes(newCategory)) {
                this.categories.push(newCategory);
            }
        }

        categorize(tagString) {
            return this.categorizeEnhanced(tagString);
        }

        categorizeSmart(tagString) {
            return this.categorizeEnhanced(tagString);
        }

        categorizeEnhanced(tagString) {
            const normalized = tagString.toLowerCase().replace(/ /g, '_');
            if (this.primaryIndex[normalized]) {
                return { category: this.primaryIndex[normalized], source: 'Primary', confidence: 1.0 };
            }
            const words = normalized.split('_').filter(Boolean);
            const e621Result = this.categorizeE621(normalized, words);
            if (e621Result) return e621Result;
            if (this.characterPatterns.some(pattern => pattern.test(normalized))) {
                return { category: 'Characters', source: 'Heuristic (Character)', confidence: 0.95 };
            }
            const semanticResult = this.applySemanticRules(normalized, words);
            if (semanticResult) return semanticResult;
            const heuristicResult = this.applyKeywordHeuristics(normalized, words);
            if (heuristicResult) return heuristicResult;
            return this.categorizeOriginal(normalized);
        }

        categorizeOriginal(input) {
            const normalized = input.toLowerCase();
            if (this.primaryIndex[normalized]) {
                return { category: this.primaryIndex[normalized], source: 'Primary' };
            }
            for (const prefix in this.patternIndex.starts) {
                if (normalized.startsWith(prefix)) {
                    return { category: this.patternIndex.starts[prefix], source: 'Pattern (Prefix)' };
                }
            }
            for (const suffix in this.patternIndex.ends) {
                if (normalized.endsWith(suffix)) {
                    return { category: this.patternIndex.ends[suffix], source: 'Pattern (Suffix)' };
                }
            }
            const words = normalized.split('_');
            const scores = {};
            words.forEach(word => {
                if (this.keywordIndex[word]) {
                    scores[this.keywordIndex[word]] = (scores[this.keywordIndex[word]] || 0) + 1;
                }
            });
            if (Object.keys(scores).length) {
                const [bestCategory] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
                return { category: bestCategory, source: 'Heuristic (Keywords)' };
            }
            return { category: 'Uncategorized', source: 'Fallback' };
        }

        categorizeE621(normalized, words) {
            if (normalized.includes(':')) {
                const [prefix, remainder] = normalized.split(':', 2);
                const mappedCategory = this.e621CategoryMap[prefix];
                if (mappedCategory) {
                    return { category: mappedCategory, source: 'E621 Prefix', confidence: 0.95 };
                }
                if (mappedCategory === null) {
                    normalized = remainder || normalized;
                }
            }
            for (const keyword of words) {
                if (this.e621KeywordMapping[keyword]) {
                    return { category: this.e621KeywordMapping[keyword], source: 'E621 Keyword', confidence: 0.9 };
                }
            }
            return null;
        }

        applySemanticRules(normalized, words) {
            if (!this.semanticRules.length) return null;
            let bestMatch = null;
            this.semanticRules.forEach(rule => {
                let score = rule.priority;
                if (rule.prefixes.some(prefix => normalized.startsWith(prefix))) score += 3;
                if (rule.suffixes.some(suffix => normalized.endsWith(suffix))) score += 2;
                const keywordHits = rule.keywords.filter(keyword => normalized.includes(keyword));
                score += keywordHits.length * 1.5;
                const wordHits = rule.keywords.filter(keyword => words.includes(keyword));
                score += wordHits.length;
                if (rule.regexes.some(regex => regex.test(normalized))) score += 2;
                if (score > rule.priority) {
                    if (!bestMatch || score > bestMatch.score) {
                        bestMatch = { category: rule.category, score };
                    }
                }
            });
            if (bestMatch) {
                return {
                    category: bestMatch.category,
                    source: 'Semantic Rule',
                    confidence: Math.min(0.95, 0.45 + (bestMatch.score / 12))
                };
            }
            return null;
        }

        applyKeywordHeuristics(normalized, words) {
            const scores = {};
            const addScore = (category, amount) => {
                if (!category) return;
                scores[category] = (scores[category] || 0) + amount;
            };
            const colorWords = new Set(['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'orange', 'black', 'white', 'grey', 'gray', 'brown', 'silver', 'gold']);
            words.forEach((word, index) => {
                if (this.keywordIndex[word]) addScore(this.keywordIndex[word], 1.25);
                if (this.speciesKeywords.has(word)) addScore('Species & Race', 1.1);
                if (this.emotionKeywords.has(word)) addScore('Emotion & Expression', 1.05);
                if (this.interactionKeywords.has(word)) addScore('Interaction', 1.05);
                if (this.backgroundKeywords.has(word)) addScore('Setting & Environment', 1.0);
                if (this.effectKeywords.has(word)) addScore('Lighting & Effects', 1.05);
                if (this.metaKeywords.has(word)) addScore('Meta', 0.9);
                if (this.qualityKeywords.has(word)) addScore('Quality', 1.3);
                if (this.styleKeywords.has(word)) addScore('Style & Meta', 1.1);
                if (this.bodyPartKeywords.has(word)) addScore('Body Parts', 1.05);
                if (this.clothingKeywords.has(word)) addScore('Attire', 1.0);
                if (this.actionKeywords.has(word)) addScore('Actions & Poses', 1.0);
                if (this.settingKeywords.has(word)) addScore('Setting & Environment', 0.9);
                if (this.compositionKeywords.has(word)) addScore('Composition', 0.9);
                if (this.cameraKeywords.has(word)) addScore('Camera & Perspective', 0.9);
                if (word === 'eyes' || word === 'eyed') addScore('Eyes', 0.8);
                if (word === 'hair' || word === 'hairstyle') addScore('Hair', 0.8);
                if (colorWords.has(word) && (words[index + 1] === 'eyes' || words[index + 1] === 'eye')) addScore('Eyes', 0.7);
                if (colorWords.has(word) && (words[index + 1] === 'hair')) addScore('Hair', 0.7);
                if (word === 'smile' && words[index + 1] === 'with') addScore('Emotion & Expression', 0.4);
            });
            for (const prefix in this.patternIndex.starts) {
                if (normalized.startsWith(prefix)) addScore(this.patternIndex.starts[prefix], 1.2);
            }
            for (const suffix in this.patternIndex.ends) {
                if (normalized.endsWith(suffix)) addScore(this.patternIndex.ends[suffix], 1.2);
            }
            if (normalized.includes('(') && normalized.includes(')')) {
                addScore('Characters', 0.85);
                addScore('Copyright & Franchise', 0.5);
            }
            if (!Object.keys(scores).length) return null;
            const [bestCategory, score] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
            return {
                category: bestCategory,
                source: 'Heuristic',
                confidence: Math.min(0.9, 0.45 + (score / 6))
            };
        }
    }

    global.EnhancedTagCategorizer = EnhancedTagCategorizer;
})(typeof window !== 'undefined' ? window : this);
