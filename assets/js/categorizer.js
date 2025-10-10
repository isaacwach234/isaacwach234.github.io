export class EnhancedTagCategorizer {
  constructor(tagMap, allTags, categoryOrder, tagMetadata = {}, tagCatalog = {}) {
    this.categoryOrder = Array.isArray(categoryOrder) ? categoryOrder : [];
    this.danbooruCategoryIdMap = { 0: 'general', 1: 'artist', 3: 'copyright', 4: 'character', 5: 'meta' };

    this.primaryIndex = this.buildPrimaryIndex(tagMap);
    this.metadataIndex = {};
    this.catalogIndex = {};
    this.patternIndex = { ends: {}, starts: {} };
    this.keywordIndex = {};

    this.ingestLegacyMetadata(tagMetadata);
    this.catalogIndex = this.buildCatalogIndex(tagCatalog);
    this.injectCatalogMetadata();
    this.deriveCatalogCooccurrenceHints();

    const metadataCategories = this.collectMetadataCategories();
    this.categories = [
      ...new Set([
        ...Object.values(this.primaryIndex),
        ...this.categoryOrder,
        ...metadataCategories,
        'Uncategorized',
      ].filter(Boolean)),
    ];

    this.buildHeuristicIndexes(Array.isArray(allTags) ? allTags : []);
    this.buildEnhancedHeuristics();
  }

  normalizeTagName(tag) {
    if (!tag && tag !== 0) return '';
    return tag
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
  }

  buildPrimaryIndex(tagMap = {}) {
    const normalized = {};
    Object.entries(tagMap || {}).forEach(([name, category]) => {
      if (!name || !category) return;
      const key = this.normalizeTagName(name);
      normalized[key] = category;
    });
    return normalized;
  }

  ingestLegacyMetadata(tagMetadata = {}) {
    Object.entries(tagMetadata || {}).forEach(([name, type]) => {
      const category = this.mapDanbooruCategory(type);
      if (!category) return;
      const key = this.normalizeTagName(name);
      this.addMetadataHint(key, category, 'Legacy Metadata', 0.9);
    });
  }

  buildCatalogIndex(tagCatalog = {}) {
    const catalog = {};
    Object.entries(tagCatalog || {}).forEach(([name, rawEntry]) => {
      if (!name) return;
      const key = this.normalizeTagName(name);
      if (!key) return;
      const entry = { ...rawEntry };
      entry.originalName = name;
      entry.post_count = Number(entry.post_count) || 0;
      if (typeof entry.category_id === 'string') {
        const parsed = parseInt(entry.category_id, 10);
        entry.category_id = Number.isNaN(parsed) ? undefined : parsed;
      }
      entry.is_deprecated = Boolean(entry.is_deprecated);
      entry.is_locked = Boolean(entry.is_locked);
      entry.tag_type = entry.tag_type == null || entry.tag_type === '' ? null : entry.tag_type;
      entry.category_name = entry.category_name == null || entry.category_name === '' ? null : entry.category_name;
      entry.category_hints = Array.isArray(entry.category_hints) ? entry.category_hints : [];
      entry.canonical_categories = Array.isArray(entry.canonical_categories) ? entry.canonical_categories : [];
      entry.related_tags = Array.isArray(entry.related_tags) ? entry.related_tags : [];
      entry.cooccurrence_hints = Array.isArray(entry.cooccurrence_hints) ? entry.cooccurrence_hints : [];
      catalog[key] = entry;
    });
    return catalog;
  }

  extractDirectCatalogCategories(entry) {
    const categories = new Set();
    (entry.canonical_categories || []).forEach(category => {
      if (category) categories.add(category);
    });
    const maybeAdd = hint => {
      const mapped = this.mapDanbooruCategory(hint);
      if (mapped) categories.add(mapped);
    };
    if (entry.category_name) maybeAdd(entry.category_name);
    if (typeof entry.category_id === 'number') maybeAdd(entry.category_id);
    if (entry.tag_type) maybeAdd(entry.tag_type);
    (entry.category_hints || []).forEach(hint => maybeAdd(hint));
    return Array.from(categories);
  }

  addMetadataHint(tag, category, source, confidence = 0.9) {
    if (!category) return;
    const normalizedTag = this.normalizeTagName(tag);
    if (!this.metadataIndex[normalizedTag]) this.metadataIndex[normalizedTag] = [];
    const hints = this.metadataIndex[normalizedTag];
    const existing = hints.find(entry => entry.category === category && entry.source === source);
    if (existing) {
      if (confidence && (!existing.confidence || confidence > existing.confidence)) existing.confidence = confidence;
      return;
    }
    hints.push({ category, source, confidence });
  }

  injectCatalogMetadata() {
    Object.entries(this.catalogIndex).forEach(([tag, entry]) => {
      entry.directCategories = this.extractDirectCatalogCategories(entry);
      entry.directCategories.forEach(category => this.addMetadataHint(tag, category, 'Danbooru Catalog (Type)', 0.95));
      (entry.cooccurrence_hints || []).forEach(hint => {
        if (!hint || !hint.category) return;
        this.addMetadataHint(tag, hint.category, 'Danbooru Co-occurrence', hint.confidence ?? 0.75);
      });
    });
  }

  deriveCatalogCooccurrenceHints() {
    Object.entries(this.catalogIndex).forEach(([tag, entry]) => {
      if (entry.cooccurrence_hints && entry.cooccurrence_hints.length > 0) return;
      const relatedList = Array.isArray(entry.related_tags) ? entry.related_tags : [];
      const counts = {};
      relatedList.slice(0, 12).forEach(related => {
        if (!related || !related.name) return;
        const relatedTag = this.normalizeTagName(related.name);
        if (!relatedTag) return;
        const weightRaw = related.score;
        const weight = typeof weightRaw === 'number' ? weightRaw : parseFloat(weightRaw);
        const safeWeight = Number.isFinite(weight) ? weight : 1;
        const relatedHints = this.metadataIndex[relatedTag] || [];
        const categorySet = new Set();
        relatedHints.forEach(hint => {
          if (hint && hint.category) categorySet.add(hint.category);
        });
        if (!categorySet.size && this.primaryIndex[relatedTag]) categorySet.add(this.primaryIndex[relatedTag]);
        categorySet.forEach(category => {
          if (!category) return;
          counts[category] = (counts[category] || 0) + safeWeight;
        });
      });
      entry.cooccurrence_hints = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, score]) => ({ category, score: Math.round(score * 1000) / 1000 }));
      const best = entry.cooccurrence_hints[0];
      if (best) {
        const confidence = Math.min(0.8, best.score / Math.max(1, relatedList.length || 1)) || 0.7;
        this.addMetadataHint(tag, best.category, 'Danbooru Co-occurrence', confidence);
      }
    });
  }

  collectMetadataCategories() {
    const categories = new Set();
    Object.values(this.metadataIndex).forEach(hints => {
      (hints || []).forEach(entry => {
        if (entry && entry.category) categories.add(entry.category);
      });
    });
    return Array.from(categories);
  }

  mapDanbooruCategory(value) {
    if (value === null || value === undefined) return null;
    let normalized = value;
    if (typeof normalized === 'number') normalized = this.danbooruCategoryIdMap[normalized] || null;
    if (!normalized) return null;
    normalized = normalized.toString().toLowerCase();
    if (normalized.startsWith('danbooru:')) normalized = normalized.split(':', 2)[1];
    const mapping = {
      artist: 'Artists',
      character: 'Characters',
      copyright: 'Subject & Creatures',
      meta: 'Style & Meta',
      general: null,
    };
    return mapping[normalized] || null;
  }

  buildHeuristicIndexes(allTags) {
    const keywordCategoryCounts = {};
    const suffixCategoryCounts = {};
    const prefixCategoryCounts = {};
    const COPYRIGHT_KEYWORDS = new Set(['(genshin_impact)', '(azur_lane)', '(touhou)', '(hololive)', '(fate/grand_order)']);

    allTags.forEach(rawTag => {
      const tag = this.normalizeTagName(rawTag);
      const base = this.resolveBaseCategory(tag);
      const category = base?.category || this.primaryIndex[tag];
      if (!category) return;
      const words = tag.split('_');
      if (words.length > 1) {
        words.forEach(word => {
          if (word.length < 4 || COPYRIGHT_KEYWORDS.has(word)) return;
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

    Object.entries(keywordCategoryCounts).forEach(([keyword, counts]) => {
      const total = Object.values(counts).reduce((s, c) => s + c, 0);
      const [mostLikelyCategory, categoryCount] = Object.entries(counts).reduce((a, b) => (a[1] > b[1] ? a : b));
      if (total > 5 && categoryCount / total > 0.8) this.keywordIndex[keyword] = mostLikelyCategory;
    });

    Object.entries(suffixCategoryCounts).forEach(([suffix, counts]) => {
      const total = Object.values(counts).reduce((s, c) => s + c, 0);
      const [mostLikelyCategory, categoryCount] = Object.entries(counts).reduce((a, b) => (a[1] > b[1] ? a : b));
      if (total > 10 && categoryCount / total > 0.75) this.patternIndex.ends[`_${suffix}`] = mostLikelyCategory;
    });

    Object.entries(prefixCategoryCounts).forEach(([prefix, counts]) => {
      const total = Object.values(counts).reduce((s, c) => s + c, 0);
      const [mostLikelyCategory, categoryCount] = Object.entries(counts).reduce((a, b) => (a[1] > b[1] ? a : b));
      if (total > 10 && categoryCount / total > 0.75) this.patternIndex.starts[`${prefix}_`] = mostLikelyCategory;
    });
  }

  buildEnhancedHeuristics() {
    this.characterPatterns = [/\([^)]+\)$/, /_\([^)]+\)$/, /^[a-z]+_[a-z]+_\([^)]+\)$/];
    this.qualityKeywords = new Set(['quality', 'masterpiece', 'best', 'high', 'ultra', 'super', 'extremely', 'detailed', 'resolution', 'res', '4k', '8k', 'hd', 'uhd', 'absurdres']);
    this.compositionKeywords = new Set(['shot', 'view', 'angle', 'perspective', 'focus', 'body', 'portrait', 'landscape', 'close-up', 'wide', 'cowboy', 'full', 'upper', 'lower']);
    this.bodyPartKeywords = new Set(['breasts', 'ass', 'butt', 'thighs', 'legs', 'arms', 'hands', 'feet', 'face', 'eyes', 'hair', 'skin', 'body', 'torso', 'chest', 'belly', 'navel', 'shoulders', 'back', 'neck', 'head', 'nose', 'lips', 'mouth']);
    this.clothingKeywords = new Set(['dress', 'shirt', 'pants', 'skirt', 'shorts', 'jacket', 'coat', 'bikini', 'swimsuit', 'underwear', 'bra', 'panties', 'socks', 'stockings', 'thighhighs', 'pantyhose', 'boots', 'shoes', 'gloves']);
    this.actionKeywords = new Set(['sitting', 'standing', 'lying', 'walking', 'running', 'jumping', 'dancing', 'singing', 'eating', 'drinking', 'sleeping', 'smiling', 'looking', 'holding', 'grabbing', 'touching', 'reaching']);
    this.settingKeywords = new Set(['background', 'outdoor', 'indoor', 'room', 'bedroom', 'bathroom', 'kitchen', 'school', 'office', 'beach', 'forest', 'city', 'sky', 'night', 'day', 'sunset', 'sunrise', 'moon', 'star', 'cloud']);
  }

  resolveMetadataCategory(tag) {
    const normalized = this.normalizeTagName(tag);
    const hints = this.metadataIndex[normalized];
    if (!Array.isArray(hints) || hints.length === 0) return null;
    return hints.reduce((best, current) => {
      if (!current || !current.category) return best;
      if (!best) return current;
      const bestConfidence = best.confidence ?? 0;
      const currentConfidence = current.confidence ?? 0;
      return currentConfidence > bestConfidence ? current : best;
    }, null);
  }

  resolveBaseCategory(tag) {
    const normalized = this.normalizeTagName(tag);
    const metadata = this.resolveMetadataCategory(normalized);
    const primaryCategory = this.primaryIndex[normalized];
    if (metadata) {
      if (primaryCategory && primaryCategory !== metadata.category) {
        return { category: primaryCategory, source: 'Primary', confidence: 1.0 };
      }
      return {
        category: metadata.category,
        source: metadata.source || 'Danbooru Metadata',
        confidence: metadata.confidence ?? 0.95,
      };
    }
    if (primaryCategory) {
      return { category: primaryCategory, source: 'Primary', confidence: 1.0 };
    }
    return null;
  }

  updateIndex(tag, newCategory) {
    const normalized = this.normalizeTagName(tag);
    this.primaryIndex[normalized] = newCategory;
    if (newCategory && !this.categories.includes(newCategory)) this.categories.push(newCategory);
  }

  categorizeEnhanced(tagString) {
    const tag = this.normalizeTagName(tagString);
    const base = this.resolveBaseCategory(tag);
    if (base) return base;

    for (const pattern of this.characterPatterns) {
      if (pattern.test(tag)) return { category: 'Characters', source: 'Smart (Character)', confidence: 0.95 };
    }

    const words = tag.split('_');
    const scores = {};
    words.forEach(word => {
      if (this.qualityKeywords.has(word)) scores['Quality'] = (scores['Quality'] || 0) + 0.8;
      if (this.compositionKeywords.has(word)) scores['Composition'] = (scores['Composition'] || 0) + 0.7;
      if (this.bodyPartKeywords.has(word)) scores['Body Parts'] = (scores['Body Parts'] || 0) + 0.9;
      if (this.clothingKeywords.has(word)) scores['Attire'] = (scores['Attire'] || 0) + 0.8;
      if (this.actionKeywords.has(word)) scores['Actions & Poses'] = (scores['Actions & Poses'] || 0) + 0.7;
      if (this.settingKeywords.has(word)) scores['Setting & Environment'] = (scores['Setting & Environment'] || 0) + 0.8;
    });

    const colorWords = ['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'orange', 'black', 'white', 'grey', 'gray', 'brown'];
    if (words.some(word => colorWords.includes(word))) {
      if (words.some(word => ['hair', 'eyes'].includes(word))) {
        scores['Hair'] = (scores['Hair'] || 0) + 0.6;
        scores['Eyes'] = (scores['Eyes'] || 0) + 0.6;
      } else if (words.some(word => this.clothingKeywords.has(word))) {
        scores['Attire'] = (scores['Attire'] || 0) + 0.5;
      }
    }

    if (Object.keys(scores).length > 0) {
      const bestCategory = Object.entries(scores).reduce((a, b) => (a[1] > b[1] ? a : b));
      return { category: bestCategory[0], source: 'Smart Heuristic', confidence: Math.min(bestCategory[1], 0.9) };
    }

    return this.categorizeOriginal(tagString);
  }

  categorizeOriginal(tagString) {
    const tag = this.normalizeTagName(tagString);
    const base = this.resolveBaseCategory(tag);
    if (base) return base;

    if (tag.includes('(') && tag.includes(')')) {
      const seriesMatch = tag.match(/\(([^)]+)\)/);
      if (seriesMatch) {
        const related = this.normalizeTagName(seriesMatch[1]);
        if (this.primaryIndex[related]) return { category: 'Characters', source: 'Heuristic (Series)' };
      }
      return { category: 'Characters', source: 'Heuristic (Pattern)' };
    }

    for (const prefix in this.patternIndex.starts) {
      if (tag.startsWith(prefix)) return { category: this.patternIndex.starts[prefix], source: 'Pattern (Prefix)' };
    }

    for (const suffix in this.patternIndex.ends) {
      if (tag.endsWith(suffix)) return { category: this.patternIndex.ends[suffix], source: 'Pattern (Suffix)' };
    }

    const words = tag.split('_');
    const categoryScores = {};
    words.forEach(word => {
      if (this.keywordIndex[word]) categoryScores[this.keywordIndex[word]] = (categoryScores[this.keywordIndex[word]] || 0) + 1;
    });
    if (Object.keys(categoryScores).length > 0) {
      const winningCategory = Object.keys(categoryScores).reduce((a, b) => (categoryScores[a] > categoryScores[b] ? a : b));
      return { category: winningCategory, source: 'Heuristic (Keywords)' };
    }
    return { category: 'Uncategorized', source: 'Fallback' };
  }

  categorize(tagString) {
    return this.categorizeOriginal(tagString);
  }

  categorizeSmart(tagString) {
    return this.categorizeEnhanced(tagString);
  }
}
