export class EnhancedTagCategorizer {
  constructor(tagMap, allTags, categoryOrder) {
    this.primaryIndex = tagMap;
    this.categoryOrder = categoryOrder;
    this.categories = [...new Set([...Object.values(tagMap), ...categoryOrder, 'Uncategorized'])];
    this.patternIndex = { ends: {}, starts: {} };
    this.keywordIndex = {};
    this.buildHeuristicIndexes(allTags);
    this.buildEnhancedHeuristics();
  }

  buildHeuristicIndexes(allTags) {
    const keywordCategoryCounts = {};
    const suffixCategoryCounts = {};
    const prefixCategoryCounts = {};
    const COPYRIGHT_KEYWORDS = new Set(['(genshin_impact)', '(azur_lane)', '(touhou)', '(hololive)', '(fate/grand_order)']);
    allTags.forEach(tag => {
      const category = this.primaryIndex[tag];
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
    for (const keyword in keywordCategoryCounts) {
      const counts = keywordCategoryCounts[keyword];
      const total = Object.values(counts).reduce((s, c) => s + c, 0);
      const [mostLikelyCategory, categoryCount] = Object.entries(counts).reduce((a, b) => (a[1] > b[1] ? a : b));
      if (total > 5 && categoryCount / total > 0.8) this.keywordIndex[keyword] = mostLikelyCategory;
    }
    for (const suffix in suffixCategoryCounts) {
      const counts = suffixCategoryCounts[suffix];
      const total = Object.values(counts).reduce((s, c) => s + c, 0);
      const [mostLikelyCategory, categoryCount] = Object.entries(counts).reduce((a, b) => (a[1] > b[1] ? a : b));
      if (total > 10 && categoryCount / total > 0.75) this.patternIndex.ends[`_${suffix}`] = mostLikelyCategory;
    }
    for (const prefix in prefixCategoryCounts) {
      const counts = prefixCategoryCounts[prefix];
      const total = Object.values(counts).reduce((s, c) => s + c, 0);
      const [mostLikelyCategory, categoryCount] = Object.entries(counts).reduce((a, b) => (a[1] > b[1] ? a : b));
      if (total > 10 && categoryCount / total > 0.75) this.patternIndex.starts[`${prefix}_`] = mostLikelyCategory;
    }
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

  updateIndex(tag, newCategory) {
    this.primaryIndex[tag.toLowerCase().replace(/ /g, '_')] = newCategory;
  }

  categorizeEnhanced(tagString) {
    const tag = tagString.toLowerCase().replace(/ /g, '_');
    if (this.primaryIndex[tag]) {
      return { category: this.primaryIndex[tag], source: 'Primary', confidence: 1.0 };
    }
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
      return {
        category: Object.keys(categoryScores).reduce((a, b) => (categoryScores[a] > categoryScores[b] ? a : b)),
        source: 'Heuristic (Keywords)',
      };
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
