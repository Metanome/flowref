/**
 * Utility functions for FlowRef
 */

/**
 * Convert a string to sentence case (capitalize first letter, lowercase the rest)
 * Preserves acronyms and proper nouns when possible
 */
export function toSentenceCase(text: string): string {
  if (!text) return "";
  
  // Ensure text is a string
  if (typeof text !== 'string') {
    text = String(text);
  }
  
  text = text.trim();
  if (text.length === 0) return "";
  
  // Split into words
  const words = text.split(/\s+/);
  const result = words.map((word, index) => {
    // Preserve all-caps acronyms (2+ letters, all uppercase)
    if (word.length >= 2 && word === word.toUpperCase() && /^[A-Z]+$/.test(word)) {
      return word;
    }
    
    // First word: capitalize first letter, lowercase rest (unless it's an acronym)
    if (index === 0) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    
    // Other words: lowercase
    return word.toLowerCase();
  });
  
  return result.join(" ");
}

/**
 * Convert a string to title case (capitalize first letter of each major word)
 * Minor words (articles, prepositions, conjunctions) remain lowercase unless first/last
 */
export function toTitleCase(text: string): string {
  if (!text) return "";
  
  // Ensure text is a string
  if (typeof text !== 'string') {
    text = String(text);
  }
  
  text = text.trim();
  if (text.length === 0) return "";
  
  // Minor words that should be lowercase in title case (unless first or last)
  const minorWords = new Set([
    "a", "an", "and", "as", "at", "but", "by", "for", "in", 
    "nor", "of", "on", "or", "the", "to", "up", "yet"
  ]);
  
  const words = text.split(/\s+/);
  const result = words.map((word, index) => {
    const lowerWord = word.toLowerCase();
    
    // Always capitalize first and last words
    if (index === 0 || index === words.length - 1) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    
    // Check if it's a minor word
    if (minorWords.has(lowerWord)) {
      return lowerWord;
    }
    
    // Capitalize major words
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
  
  return result.join(" ");
}

/**
 * Format author initials from a given name
 * Example: "John" -> "J.", "John Paul" -> "J. P."
 */
export function formatInitials(givenName: string): string {
  if (!givenName) return "";
  
  return givenName
    .split(/\s+/)
    .map(name => {
      // Remove any existing periods first
      const cleaned = name.replace(/\./g, '');
      if (cleaned.length === 0) return '';
      return cleaned.charAt(0).toUpperCase() + ".";
    })
    .filter(initial => initial.length > 0)
    .join(" ");
}

/**
 * Clean and normalize whitespace in a string
 */
export function cleanWhitespace(text: string): string {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Sleep for a given number of milliseconds (useful for rate limiting)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Deep clone an object (simple implementation for plain objects)
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
