/**
 * IEEE citation formatter
 */

import { CitationMetadata, Author } from "../types";

/**
 * Format authors for IEEE reference list
 * Format: A. B. Smith and C. D. Lee
 * For 7+ authors: First 6, then "et al."
 */
export function formatAuthorsIEEE(authors: Author[]): string {
  if (!authors || authors.length === 0) {
    return "[No author]";
  }
  
  const formatAuthor = (author: Author): string => {
    if (author.given && author.family) {
      // Format: First initials then last name (A. B. Smith)
      const initials = author.given
        .split(/\s+/)
        .map(name => name.charAt(0).toUpperCase() + ".")
        .join(" ");
      return `${initials} ${author.family}`;
    } else if (author.family) {
      return author.family;
    } else if (author.full) {
      return author.full;
    } else {
      return "[Unknown]";
    }
  };
  
  if (authors.length === 1) {
    return formatAuthor(authors[0]);
  } else if (authors.length === 2) {
    return `${formatAuthor(authors[0])} and ${formatAuthor(authors[1])}`;
  } else if (authors.length <= 6) {
    const allButLast = authors.slice(0, -1).map(formatAuthor).join(", ");
    const last = formatAuthor(authors[authors.length - 1]);
    return `${allButLast}, and ${last}`;
  } else {
    // 7+ authors: first 6 then et al.
    const first6 = authors.slice(0, 6).map(formatAuthor).join(", ");
    return `${first6}, et al.`;
  }
}

/**
 * Format a complete IEEE reference
 * 
 * Format:
 * [#] A. Author and B. Author, "Title of article," Journal Name, vol. X, no. Y, pp. Z-Z, Mon. Year, doi: xxxxx.
 */
export function formatReferenceIEEE(meta: CitationMetadata, refNumber: number = 1): string {
  const parts: string[] = [];
  
  // Reference number
  parts.push(`[${refNumber}]`);
  
  // Authors (or Editors for edited works)
  let authorPart = formatAuthorsIEEE(meta.authors);
  if (meta.isEditedWork) {
    // Add editor label for edited books
    const edLabel = meta.authors.length === 1 ? ", Ed." : ", Eds.";
    authorPart += edLabel;
  }
  parts.push(authorPart + ",");
  
  // Title - different formatting for books vs articles
  const title = meta.title.trim();
  if (meta.containerType === "book") {
    // Books: italicized title, no quotes
    parts.push(`<em>${title}</em>.`);
  } else {
    // Articles: title in quotes
    parts.push(`"${title},"`);
  }
  
  // Journal (italicized in IEEE)
  if (meta.journal) {
    let journalPart = `<em>${meta.journal}</em>`;
    
    // Volume
    if (meta.volume) {
      journalPart += `, vol. ${meta.volume}`;
    }
    
    // Issue
    if (meta.issue) {
      journalPart += `, no. ${meta.issue}`;
    }
    
    // Pages
    if (meta.pages) {
      journalPart += `, pp. ${meta.pages}`;
    }
    
    // Date - just year and month if available
    if (meta.year) {
      journalPart += `, ${meta.year}`;
    }
    
    parts.push(journalPart + ",");
  } else if (meta.containerType === "book") {
    // For books, add publisher and year
    if (meta.publisher && meta.year) {
      parts.push(`${meta.publisher}, ${meta.year}.`);
    } else if (meta.publisher) {
      parts.push(`${meta.publisher}.`);
    }
  }
  
  // DOI
  if (meta.doi) {
    parts.push(`doi: ${meta.doi}.`);
  } else if (meta.url) {
    parts.push(`[Online]. Available: ${meta.url}`);
  }
  
  return parts.join(" ");
}

/**
 * Format IEEE in-text citation (reference number)
 * Format: [1] or [1], [2] or [1-3]
 */
export function formatInTextIEEEParenthetical(refNumber: number = 1): string {
  return `[${refNumber}]`;
}

/**
 * Format IEEE in-text citation (narrative with reference number)
 * Format: Author et al. [1]
 */
export function formatInTextIEEENarrative(authors: Author[], refNumber: number = 1): string {
  if (!authors || authors.length === 0) {
    return `[No author] [${refNumber}]`;
  }
  
  const name = authors[0].family || authors[0].full || "Unknown";
  
  if (authors.length === 1) {
    return `${name} [${refNumber}]`;
  } else {
    return `${name} et al. [${refNumber}]`;
  }
}
