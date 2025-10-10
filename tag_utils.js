/**
 * Tag Manipulation Utilities
 * Functions for processing, formatting, and transforming tags
 */

const TagUtils = {
    /**
     * Remove all weight markers from a tag string
     * Handles: (tag), ((tag)), [tag], [[tag]], (tag:1.2), etc.
     */
    removeWeights(tagString) {
        // Remove outer parentheses/brackets with optional weights
        let cleaned = tagString.trim();
        
        // Remove weighted syntax like (tag:1.2) or (tag:0.8)
        cleaned = cleaned.replace(/^\(([^:)]+):[0-9.]+\)$/, '$1');
        
        // Remove emphasis parentheses: (((tag))) -> tag
        while (/^\(+([^()]+)\)+$/.test(cleaned) || /^\[+([^\[\]]+)\]+$/.test(cleaned)) {
            cleaned = cleaned.replace(/^\(+([^()]+)\)+$/, '$1');
            cleaned = cleaned.replace(/^\[+([^\[\]]+)\]+$/, '$1');
        }
        
        return cleaned.trim();
    },
    
    /**
     * Remove weights from all tags in an array
     */
    removeWeightsFromArray(tags) {
        return tags.map(tag => this.removeWeights(tag));
    },
    
    /**
     * Remove weights from a comma-separated tag string
     */
    removeWeightsFromString(tagString) {
        const tags = tagString.split(',').map(t => t.trim()).filter(Boolean);
        const cleaned = tags.map(tag => this.removeWeights(tag));
        return cleaned.join(', ');
    },
    
    /**
     * Apply weight to a tag
     */
    applyWeight(tag, weight) {
        // Remove existing weights first
        const clean = this.removeWeights(tag);
        
        if (weight === 1.0 || weight === 0) {
            return clean;
        } else if (weight > 1.0) {
            // Emphasis with parentheses
            const strength = Math.min(Math.floor(weight), 3);
            return '('.repeat(strength) + clean + ')'.repeat(strength);
        } else if (weight < 1.0 && weight > 0) {
            // De-emphasis with brackets
            const strength = Math.min(Math.floor(1 / weight), 3);
            return '['.repeat(strength) + clean + ']'.repeat(strength);
        }
        
        return clean;
    },
    
    /**
     * Apply numeric weight syntax
     */
    applyNumericWeight(tag, weight) {
        const clean = this.removeWeights(tag);
        if (weight === 1.0) return clean;
        return `(${clean}:${weight.toFixed(1)})`;
    },
    
    /**
     * Parse weight from a tag
     */
    parseWeight(tag) {
        // Check for numeric weight: (tag:1.2)
        const numericMatch = tag.match(/^\(([^:)]+):([0-9.]+)\)$/);
        if (numericMatch) {
            return {
                tag: numericMatch[1],
                weight: parseFloat(numericMatch[2])
            };
        }
        
        // Count parentheses for emphasis
        const parenMatch = tag.match(/^\(+([^()]+)\)+$/);
        if (parenMatch) {
            const depth = (tag.match(/^\(+/) || [''])[0].length;
            return {
                tag: parenMatch[1],
                weight: 1.0 + (depth * 0.1)
            };
        }
        
        // Count brackets for de-emphasis
        const bracketMatch = tag.match(/^\[+([^\[\]]+)\]+$/);
        if (bracketMatch) {
            const depth = (tag.match(/^\[+/) || [''])[0].length;
            return {
                tag: bracketMatch[1],
                weight: 1.0 - (depth * 0.1)
            };
        }
        
        return { tag, weight: 1.0 };
    },
    
    /**
     * Convert between underscore and space format
     */
    toggleUnderscores(tag, useUnderscores) {
        return useUnderscores ? 
            tag.replace(/\s+/g, '_') : 
            tag.replace(/_/g, ' ');
    },
    
    /**
     * Normalize tag for comparison
     */
    normalize(tag) {
        return this.removeWeights(tag)
            .toLowerCase()
            .replace(/\s+/g, '_')
            .trim();
    },
    
    /**
     * Check if two tags are equivalent (ignoring weights and formatting)
     */
    areEquivalent(tag1, tag2) {
        return this.normalize(tag1) === this.normalize(tag2);
    },
    
    /**
     * Deduplicate tags while preserving the first occurrence's weight
     */
    deduplicate(tags) {
        const seen = new Map();
        const result = [];
        
        tags.forEach(tag => {
            const normalized = this.normalize(tag);
            if (!seen.has(normalized)) {
                seen.set(normalized, true);
                result.push(tag);
            }
        });
        
        return result;
    },
    
    /**
     * Sort tags alphabetically (ignoring weights)
     */
    sortAlphabetically(tags, ascending = true) {
        return [...tags].sort((a, b) => {
            const cleanA = this.normalize(a);
            const cleanB = this.normalize(b);
            return ascending ? 
                cleanA.localeCompare(cleanB) : 
                cleanB.localeCompare(cleanA);
        });
    },
    
    /**
     * Extract all unique words from tags
     */
    extractWords(tags) {
        const words = new Set();
        tags.forEach(tag => {
            const clean = this.removeWeights(tag);
            clean.split(/[_\s]+/).forEach(word => {
                if (word.length > 0) words.add(word.toLowerCase());
            });
        });
        return Array.from(words);
    },
    
    /**
     * Find tags containing a search term
     */
    search(tags, searchTerm) {
        const term = searchTerm.toLowerCase();
        return tags.filter(tag => {
            const normalized = this.normalize(tag);
            return normalized.includes(term);
        });
    },
    
    /**
     * Validate tag format
     */
    isValid(tag) {
        if (!tag || typeof tag !== 'string') return false;
        const cleaned = tag.trim();
        if (cleaned.length === 0) return false;
        
        // Check for mismatched parentheses/brackets
        const openParen = (cleaned.match(/\(/g) || []).length;
        const closeParen = (cleaned.match(/\)/g) || []).length;
        const openBracket = (cleaned.match(/\[/g) || []).length;
        const closeBracket = (cleaned.match(/\]/g) || []).length;
        
        return openParen === closeParen && openBracket === closeBracket;
    },
    
    /**
     * Fix common tag formatting issues
     */
    fix(tag) {
        let fixed = tag.trim();
        
        // Remove multiple spaces
        fixed = fixed.replace(/\s+/g, ' ');
        
        // Fix unmatched parentheses (simple approach)
        const openParen = (fixed.match(/\(/g) || []).length;
        const closeParen = (fixed.match(/\)/g) || []).length;
        if (openParen > closeParen) {
            fixed += ')'.repeat(openParen - closeParen);
        } else if (closeParen > openParen) {
            fixed = '('.repeat(closeParen - openParen) + fixed;
        }
        
        // Fix unmatched brackets
        const openBracket = (fixed.match(/\[/g) || []).length;
        const closeBracket = (fixed.match(/\]/g) || []).length;
        if (openBracket > closeBracket) {
            fixed += ']'.repeat(openBracket - closeBracket);
        } else if (closeBracket > openBracket) {
            fixed = '['.repeat(closeBracket - openBracket) + fixed;
        }
        
        return fixed;
    },
    
    /**
     * Calculate prompt token estimate (rough approximation)
     */
    estimateTokens(tagString) {
        if (!tagString || !tagString.trim()) return 0;
        
        // Split by commas and count
        const tags = tagString.split(',').filter(t => t.trim());
        
        // Average ~1.3 tokens per tag (accounting for multi-word tags)
        const baseTokens = tags.length * 1.3;
        
        // Add tokens for long tags
        const longTagBonus = tags.reduce((sum, tag) => {
            const words = tag.trim().split(/[\s_]+/).length;
            return sum + Math.max(0, words - 1) * 0.5;
        }, 0);
        
        return Math.round(baseTokens + longTagBonus);
    },
    
    /**
     * Batch operations
     */
    batch: {
        /**
         * Remove weights from all tags in a batch
         */
        removeWeights(tagObjects) {
            return tagObjects.map(obj => ({
                ...obj,
                weighted: TagUtils.removeWeights(obj.weighted || obj.original),
                original: TagUtils.removeWeights(obj.original)
            }));
        },
        
        /**
         * Toggle underscores for all tags
         */
        toggleUnderscores(tagObjects, useUnderscores) {
            return tagObjects.map(obj => ({
                ...obj,
                weighted: TagUtils.toggleUnderscores(obj.weighted, useUnderscores),
                original: TagUtils.toggleUnderscores(obj.original, useUnderscores)
            }));
        }
    }
};

// Add global button handler for removing weights
window.removeAllWeights = function() {
    const tagInput = document.getElementById('tagInput');
    if (!tagInput) return;
    
    const cleaned = TagUtils.removeWeightsFromString(tagInput.value);
    tagInput.value = cleaned;
    
    // Also clear weights from existing tags
    if (window.app && window.app.getState) {
        const state = window.app.getState();
        if (state.baseTags) {
            state.baseTags.forEach(tag => {
                tag.weighted = TagUtils.removeWeights(tag.original);
            });
        }
    }
    
    // Trigger reprocessing
    if (window.processAll) window.processAll();
    
    // Show feedback
    const copyMessage = document.getElementById('copyMessage');
    if (copyMessage) {
        copyMessage.textContent = 'All weights removed!';
        setTimeout(() => copyMessage.textContent = '', 2000);
    }
};

// Export
window.TagUtils = TagUtils;
