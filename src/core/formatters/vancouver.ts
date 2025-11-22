/**
 * Vancouver citation style formatter
 */

import { CitationMetadata, Author } from "../types";

/**
 * Format authors for Vancouver reference list
 * Format: Last AB, Last CD.
 * For 7+ authors: first 6, then et al.
 */
export function formatAuthorsVancouver(authors: Author[]): string {
  if (!authors || authors.length === 0) {
    return "[No author]";
  }
  
  const formatAuthor = (author: Author): string => {
    if (author.family && author.given) {
      // Format: Last AB (initials without periods or spaces)
      const initials = author.given
        .split(/\s+/)
        .map(name => name.charAt(0).toUpperCase())
        .join("");
      return `${author.family} ${initials}`;
    } else if (author.family) {
      return author.family;
    } else if (author.full) {
      return author.full;
    } else {
      return "[Unknown]";
    }
  };
  
  if (authors.length <= 6) {
    return authors.map(formatAuthor).join(", ");
  } else {
    // 7+ authors: first 6, then et al.
    const first6 = authors.slice(0, 6).map(formatAuthor).join(", ");
    return `${first6}, et al`;
  }
}

/**
 * Format a complete Vancouver reference
 * 
 * Format:
 * #. Author(s). Title of article. Journal Abbrev. Year;volume(issue):pages. doi: xxxxx
 */
export function formatReferenceVancouver(meta: CitationMetadata, refNumber: number = 1): string {
  const parts: string[] = [];
  
  // Reference number
  parts.push(`${refNumber}.`);
  
  // Authors (or Editors for edited works)
  let authorPart = formatAuthorsVancouver(meta.authors);
  if (meta.isEditedWork) {
    // Add editor label for edited books
    authorPart += ", editors";
  }
  parts.push(authorPart + ".");
  
  // Title (sentence case, no quotes)
  const title = meta.title.trim();
  parts.push(title + ".");
  
  // Journal abbreviation (Vancouver uses abbreviated journal names, but we'll use full name)
  if (meta.journal) {
    let journalPart = meta.journal;
    
    // Year
    if (meta.year) {
      journalPart += `. ${meta.year}`;
    }
    
    // Volume
    if (meta.volume) {
      journalPart += `;${meta.volume}`;
    }
    
    // Issue (in parentheses)
    if (meta.issue) {
      journalPart += `(${meta.issue})`;
    }
    
    // Pages (with colon)
    if (meta.pages) {
      journalPart += `:${meta.pages}`;
    }
    
    journalPart += "."
    parts.push(journalPart);
  } else if (meta.containerType === "book") {
    // For books, add publisher and year
    if (meta.publisher && meta.year) {
      parts.push(`${meta.publisher}; ${meta.year}.`);
    } else if (meta.publisher) {
      parts.push(`${meta.publisher}.`);
    }
  }
  
  // DOI
  if (meta.doi) {
    parts.push(`doi: ${meta.doi}`);
  } else if (meta.url) {
    parts.push(`Available from: ${meta.url}`);
  }
  
  return parts.join(" ");
}

/**
 * Format Vancouver in-text citation (reference number)
 * Format: (1) or (1,2) or (1-3)
 */
export function formatInTextVancouverParenthetical(refNumber: number = 1): string {
  return `(${refNumber})`;
}

/**
 * Format Vancouver in-text citation (narrative with reference number)
 * Format: Author et al. (1)
 */
export function formatInTextVancouverNarrative(authors: Author[], refNumber: number = 1): string {
  if (!authors || authors.length === 0) {
    return `[No author] (${refNumber})`;
  }
  
  const name = authors[0].family || authors[0].full || "Unknown";
  
  if (authors.length === 1) {
    return `${name} (${refNumber})`;
  } else {
    return `${name} et al. (${refNumber})`;
  }
}
