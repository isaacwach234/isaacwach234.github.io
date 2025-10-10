#!/usr/bin/env node
/**
 * Quick manual check that EnhancedTagCategorizer auto-assigns reasonable
 * categories for tags that may not exist in tag_map.json.
 *
 * Usage:
 *   node scripts/check_tag_categories.mjs tag_one tag_two
 *
 * If no tags are provided the script samples a few entries from the generated
 * tag catalog.  Combine with the build_tag_catalog.py script to sanity-check new
 * tags after refreshing metadata from Danbooru.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EnhancedTagCategorizer } from '../assets/js/categorizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function loadJson(relativePath) {
  const fullPath = path.resolve(ROOT, relativePath);
  const raw = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(raw);
}

const defaultCategoryOrder = [
  'Artists',
  'Quality',
  'Composition',
  'Characters',
  'Subject & Creatures',
  'Face',
  'Eyes',
  'Hair',
  'Body Parts',
  'Attire',
  'Accessories',
  'Held Items & Objects',
  'Actions & Poses',
  'Setting & Environment',
  'Style & Meta',
];

const tagMap = loadJson('tag_map.json');
const allTags = loadJson('tags.json');
const tagMetadata = loadJson('data/tag_metadata.json');
let tagCatalog = {};
try {
  tagCatalog = loadJson('generated/tag_catalog.json');
} catch (error) {
  console.warn('Warning: generated/tag_catalog.json missing or invalid. Proceeding with empty catalog.');
}

const categorizer = new EnhancedTagCategorizer(tagMap, allTags, defaultCategoryOrder, tagMetadata, tagCatalog);

const inputTags = process.argv.slice(2);
const sample = inputTags.length > 0 ? inputTags : Object.keys(tagCatalog).slice(0, 10);

if (sample.length === 0) {
  console.error('No tags provided and catalog is empty. Run scripts/build_tag_catalog.py first.');
  process.exit(1);
}

sample.forEach(tag => {
  const smart = categorizer.categorizeSmart(tag);
  const basic = categorizer.categorize(tag);
  const smartConfidence = typeof smart?.confidence === 'number' ? smart.confidence.toFixed(2) : 'n/a';
  console.log(`${tag} -> smart: ${smart.category} [${smart.source}, confidence=${smartConfidence}] | basic: ${basic.category} [${basic.source}]`);
});
