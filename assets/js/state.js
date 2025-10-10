const element = (id) => document.getElementById(id);

export const GITHUB_USER = 'isaacwach234';
export const GITHUB_REPO = 'isaacwach234.github.io';

export const state = {
  TAG_DATABASE: [],
  gitHubPat: null,
  tagCategorizer: null,
  tagCatalog: {},
  tagMap: {},
  tagMetadata: {},
  categoryOrder: [],
  catalogCacheInfo: null,
  latestCatalogPayload: null,
  tagIdCounter: 0,
  baseTags: [],
  copyHistory: [],
  selectedTagIds: new Set(),
  sortableInstances: [],
  autocomplete: { active: false, index: -1, currentWord: '', suggestions: [] },
  hiddenCategories: new Set(),
  knownCategories: new Set(),
  favoriteTags: new Map(),
};

export const reduceMotionQuery = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;
export const prefersReducedMotion = !!(reduceMotionQuery && reduceMotionQuery.matches);

export const elements = {
  element,
  body: document.body,
  tagInput: element('tagInput'),
  swapsInput: element('swapsInput'),
  implicationsInput: element('implicationsInput'),
  blacklistInput: element('blacklistInput'),
  triggerInput: element('triggerInput'),
  appendInput: element('appendInput'),
  deduplicateToggle: element('deduplicateToggle'),
  underscoreToggle: element('underscoreToggle'),
  enableWeightingToggle: element('enableWeightingToggle'),
  clearWeightsButton: element('clearWeightsButton'),
  sortSelect: element('sortSelect'),
  maxTagsInput: element('maxTagsInput'),
  tagOutput: element('tagOutput'),
  copyButton: element('copyButton'),
  copyMessage: element('copyMessage'),
  historyContainer: element('history-container'),
  autocompleteBox: element('autocomplete-box'),
  suggestBtn: element('suggest-btn'),
  themeButtons: document.querySelectorAll('.theme-button'),
  suggestionCountInput: element('suggestionCountInput'),
  categoryToggleContainer: element('categoryToggleContainer'),
  hiddenCategoriesBanner: element('hiddenCategoriesBanner'),
  favoritesContainer: element('favorites-container'),
  clearFavoritesButton: element('clearFavoritesButton'),
  promptPreview: element('promptPreview'),
  promptPreviewMeta: element('promptPreviewMeta'),
  promptPreviewCopy: element('promptPreviewCopy'),
  ratingSafe: element('rating-safe'),
  ratingGeneral: element('rating-general'),
  ratingQuestionable: element('rating-questionable'),
  catalogRefreshButton: element('catalogRefreshButton'),
  catalogLimitInput: element('catalogLimitInput'),
  catalogStatus: element('catalogStatus'),
  catalogUsernameInput: element('catalogUsernameInput'),
  catalogApiKeyInput: element('catalogApiKeyInput'),
  catalogDownloadButton: element('catalogDownloadButton'),
  categoryPickerModal: element('categoryPickerModal'),
  categoryPickerList: element('categoryPickerList'),
  categoryPickerTitle: element('categoryPickerTitle'),
  categoryPickerSearch: element('categoryPickerSearch'),
  categoryPickerBackdrop: element('categoryPickerBackdrop'),
  categoryPickerClose: element('categoryPickerClose'),
  howToPanel: element('howToPanel'),
  copyJsonButton: element('copyJsonButton'),
  settingsPanel: element('settingsPanel'),
  tokenPanel: element('tokenPanel'),
  githubTokenInput: element('githubTokenInput'),
  rememberToken: element('rememberToken'),
  tokenStatus: element('tokenStatus'),
  processedTagCount: element('processedTagCount'),
  processedMaxTagCount: element('processedMaxTagCount'),
  tagCount: element('tagCount'),
  maxTagCount: element('maxTagCount'),
  categoryCount: element('categoryCount'),
  historyCount: element('historyCount'),
};

export const STORAGE_KEYS = {
  hiddenCategories: 'danbooru-muted-categories',
  favorites: 'danbooru-tag-favorites',
  theme: 'danbooru-tag-helper-theme',
  howTo: 'danbooru-howto-open',
  history: 'danbooru-tag-history',
  githubPat: 'github-pat',
  tagCatalog: 'danbooru-tag-catalog-cache',
};

export const categoryPickerState = { tagId: null };

export { element };
