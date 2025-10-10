const DEFAULT_BASE_URL = 'https://danbooru.donmai.us';
const CATEGORY_ID_MAP = { 0: 'general', 1: 'artist', 3: 'copyright', 4: 'character', 5: 'meta' };
const CANONICAL_CATEGORY_MAP = {
  'danbooru:artist': 'Artists',
  'danbooru:character': 'Characters',
  'danbooru:meta': 'Style & Meta',
  'danbooru:copyright': 'Subject & Creatures',
  'danbooru:general': null,
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function normalizeHint(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  return normalized.startsWith('danbooru:') ? normalized : `danbooru:${normalized}`;
}

function parseRelatedTags(rawRelated) {
  if (!rawRelated) return [];
  if (Array.isArray(rawRelated)) {
    return rawRelated
      .map(entry => {
        if (!entry) return null;
        const name = entry.name || entry.tag || entry[0];
        const scoreRaw = entry.score ?? entry[1];
        const score = Number.parseFloat(scoreRaw);
        return name ? { name, score: Number.isFinite(score) ? score : undefined } : null;
      })
      .filter(Boolean);
  }
  const text = String(rawRelated).trim();
  if (!text) return [];
  const parts = text.split(/\s+/);
  const related = [];
  for (let idx = 0; idx < parts.length; idx += 2) {
    const name = parts[idx];
    if (!name) continue;
    const scoreRaw = parts[idx + 1];
    const score = Number.parseFloat(scoreRaw);
    related.push({ name, score: Number.isFinite(score) ? score : undefined });
  }
  return related;
}

function extractCategoryHints(tag) {
  const hints = new Set();
  ['category_name', 'tag_type', 'type', 'category'].forEach(key => {
    const value = tag[key];
    if (value == null) return;
    if (typeof value === 'number') {
      const mapped = CATEGORY_ID_MAP[value];
      if (mapped != null) {
        const normalized = normalizeHint(mapped);
        if (normalized) hints.add(normalized);
      }
    } else {
      const normalized = normalizeHint(value);
      if (normalized) hints.add(normalized);
    }
  });
  if (Array.isArray(tag.category_hints)) {
    tag.category_hints.forEach(hint => {
      const normalized = normalizeHint(hint);
      if (normalized) hints.add(normalized);
    });
  }
  return Array.from(hints).sort();
}

function mapCanonicalCategories(hints) {
  const canonical = new Set();
  hints.forEach(hint => {
    const mapped = CANONICAL_CATEGORY_MAP[hint];
    if (mapped) canonical.add(mapped);
  });
  return Array.from(canonical).sort();
}

export class DanbooruCatalogBuilder {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    this.limit = options.limit ?? 5000;
    this.pageSize = Math.min(options.pageSize || 250, 1000);
    this.minPostCount = options.minPostCount || 0;
    this.order = options.order || 'count';
    this.username = options.username || null;
    this.apiKey = options.apiKey || null;
    this.onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
    this.retries = options.retries ?? 3;
    this.sleepMs = options.sleepMs ?? 1100;
  }

  buildAuthHeader() {
    if (!this.username || !this.apiKey) return null;
    return `Basic ${btoa(`${this.username}:${this.apiKey}`)}`;
  }

  buildFallbackUrls(url) {
    return [
      `https://r.jina.ai/${encodeURIComponent(url)}`,
      `https://r.jina.ai/${url}`,
    ];
  }

  async fetchJson(url, attempt = 0, { useFallback = false, fallbackIndex = 0 } = {}) {
    const headers = { Accept: 'application/json' };
    if (!useFallback) {
      const authHeader = this.buildAuthHeader();
      if (authHeader) headers.Authorization = authHeader;
    }
    const fallbackUrls = useFallback ? this.buildFallbackUrls(url) : null;
    const requestUrl = useFallback ? fallbackUrls[fallbackIndex] : url;
    if (!requestUrl) {
      throw new Error('Unable to construct a request URL for the Danbooru catalog.');
    }
    try {
      const response = await fetch(requestUrl, { headers, mode: 'cors' });
      if (response.status === 429) {
        throw new Error('Danbooru rate limited the request (HTTP 429). Try a lower limit or add an API key.');
      }
      if (response.status === 403) {
        throw new Error('Danbooru denied the request (HTTP 403). API key or login might be required.');
      }
      if (!response.ok) {
        throw new Error(`Danbooru responded with HTTP ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      if (useFallback && fallbackIndex < (fallbackUrls.length - 1)) {
        return this.fetchJson(url, attempt, { useFallback: true, fallbackIndex: fallbackIndex + 1 });
      }
      const canUseFallback = !useFallback && !this.username && !this.apiKey;
      if (canUseFallback) {
        return this.fetchJson(url, attempt, { useFallback: true, fallbackIndex: 0 });
      }
      if (attempt >= this.retries) throw error;
      await sleep(this.sleepMs * (attempt + 1));
      const retryFallbackIndex = useFallback ? 0 : fallbackIndex;
      return this.fetchJson(url, attempt + 1, { useFallback, fallbackIndex: retryFallbackIndex });
    }
  }

  transformTag(tag) {
    const categoryId = typeof tag.category_id === 'number' ? tag.category_id : typeof tag.category === 'number' ? tag.category : null;
    const tagTypeRaw = tag.tag_type ?? tag.type ?? null;
    const tagType = tagTypeRaw != null && tagTypeRaw !== '' ? String(tagTypeRaw) : null;
    const categoryNameRaw = tag.category_name ?? (categoryId != null ? CATEGORY_ID_MAP[categoryId] : null);
    const categoryName = categoryNameRaw != null ? String(categoryNameRaw) : null;
    const hints = extractCategoryHints({ ...tag, category: categoryId });
    const canonical = mapCanonicalCategories(hints);
    return {
      tag_type: tagType,
      category_id: categoryId,
      category_name: categoryName,
      post_count: Number.parseInt(tag.post_count ?? 0, 10) || 0,
      is_deprecated: Boolean(tag.is_deprecated),
      is_locked: Boolean(tag.is_locked),
      category_hints: hints,
      canonical_categories: canonical,
      related_tags: parseRelatedTags(tag.related_tags),
      cooccurrence_hints: [],
    };
  }

  computeCooccurrenceHints(catalog) {
    const canonicalLookup = {};
    Object.entries(catalog).forEach(([name, entry]) => {
      canonicalLookup[name] = entry.canonical_categories || [];
    });
    Object.values(catalog).forEach(entry => {
      const counts = new Map();
      (entry.related_tags || []).slice(0, 10).forEach(related => {
        if (!related || !related.name) return;
        const categories = canonicalLookup[related.name] || [];
        if (!categories.length) return;
        const score = Number.isFinite(related.score) ? related.score : 1;
        categories.forEach(category => {
          counts.set(category, (counts.get(category) || 0) + score);
        });
      });
      entry.cooccurrence_hints = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, score]) => ({ category, score: Math.round(score * 1000) / 1000 }));
    });
  }

  async build() {
    const catalog = {};
    let totalAdded = 0;
    let page = 1;
    while (totalAdded < this.limit) {
      const remaining = this.limit - totalAdded;
      const pageSize = Math.min(this.pageSize, remaining);
      const params = new URLSearchParams();
      params.set('search[order]', this.order);
      params.set('limit', String(pageSize));
      params.set('page', String(page));
      if (this.minPostCount) params.set('search[post_count_gte]', String(this.minPostCount));
      const url = `${this.baseUrl.replace(/\/$/, '')}/tags.json?${params.toString()}`;
      this.onProgress(`Requesting page ${page} (${Math.min(totalAdded + pageSize, this.limit)} / ${this.limit})…`);
      const pageData = await this.fetchJson(url);
      if (!Array.isArray(pageData) || pageData.length === 0) {
        break;
      }
      for (const tag of pageData) {
        if (!tag || !tag.name) continue;
        if (this.minPostCount && (tag.post_count ?? 0) < this.minPostCount) continue;
        catalog[tag.name] = this.transformTag(tag);
        totalAdded += 1;
        if (totalAdded >= this.limit) break;
      }
      this.onProgress(`Fetched ${totalAdded} tag${totalAdded === 1 ? '' : 's'} so far…`);
      if (pageData.length < pageSize) {
        break;
      }
      page += 1;
      if (totalAdded < this.limit) await sleep(this.sleepMs);
    }
    this.computeCooccurrenceHints(catalog);
    return { catalog, total: totalAdded };
  }
}

export function downloadCatalogFile(catalog, filenameSuffix = '') {
  if (!catalog || typeof catalog !== 'object') {
    throw new Error('No catalog data available to download.');
  }
  const payload = catalog && catalog.data ? catalog : { data: catalog };
  const timestamp = new Date().toISOString().split('T')[0];
  const suffix = filenameSuffix ? `-${filenameSuffix}` : '';
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `tag_catalog${suffix ? suffix : ''}-${timestamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
