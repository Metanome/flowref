/**
 * MLA 9th Edition citation formatter
 */

import { CitationMetadata, Author } from "../types";

/**
 * Format authors for MLA reference list
 * Format: Last, First Middle. and First Middle Last.
 * For 3+ authors: First author, et al.
 */
export function formatAuthorsMLA(authors: Author[]): string {
  if (!authors || authors.length === 0) {
    return "[No author]";
  }
  
  const formatFirstAuthor = (author: Author): string => {
    if (author.family && author.given) {
      return `${author.family}, ${author.given}`;
    } else if (author.family) {
      return author.family;
    } else if (author.full) {
      return author.full;
    } else {
      return "[Unknown]";
    }
  };
  
  const formatOtherAuthor = (author: Author): string => {
    if (author.given && author.family) {
      return `${author.given} ${author.family}`;
    } else if (author.family) {
      return author.family;
    } else if (author.full) {
      return author.full;
    } else {
      return "[Unknown]";
    }
  };
  
  if (authors.length === 1) {
    return formatFirstAuthor(authors[0]);
  } else if (authors.length === 2) {
    return `${formatFirstAuthor(authors[0])}, and ${formatOtherAuthor(authors[1])}`;
  } else {
    // 3+ authors: first author, et al.
    return `${formatFirstAuthor(authors[0])}, et al`;
  }
}

/**
 * Format a complete MLA reference
 * 
 * Format:
 * Author(s). "Title of Article." Journal Name, vol. X, no. Y, Year, pp. Z-Z. DOI or URL.
 */
export function formatReferenceMLA(meta: CitationMetadata): string {
  const parts: string[] = [];
  
  // Authors (or Editors for edited works)
  let authorPart = formatAuthorsMLA(meta.authors);
  if (meta.isEditedWork) {
    // Add editor label for edited books
    const edLabel = meta.authors.length === 1 ? ", editor" : ", editors";
    authorPart += edLabel;
  }
  parts.push(authorPart + ".");
  
  // Title - different formatting for books vs articles
  const title = meta.title.trim();
  if (meta.containerType === "book") {
    // Books: italicized title
    parts.push(`<em>${title}</em>.`);
  } else {
    // Articles: title in quotes
    parts.push(`"${title}."`);
  }
  
  // Journal (italicized)
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
    
    // Year
    if (meta.year) {
      journalPart += `, ${meta.year}`;
    }
    
    // Pages
    if (meta.pages) {
      journalPart += `, pp. ${meta.pages}`;
    }
    
    journalPart += ".";
    parts.push(journalPart);
  } else if (meta.containerType === "book" && meta.publisher) {
    // For books without journal, add publisher
    parts.push(`${meta.publisher}, ${meta.year || "n.d."}.`);
  }
  
  // DOI or URL
  if (meta.doi) {
    parts.push(`https://doi.org/${meta.doi}.`);
  } else if (meta.url) {
    parts.push(`${meta.url}.`);
  }
  
  return parts.join(" ");
}

/**
 * Format MLA in-text citation (parenthetical)
 * Format: (Author) or (Author and Author) or (Author et al.)
 * Note: Page numbers would be added by user, e.g., (Smith 45)
 */
export function formatInTextMLAParenthetical(authors: Author[]): string {
  if (!authors || authors.length === 0) {
    return "([No author])";
  }
  
  if (authors.length === 1) {
    const name = authors[0].family || authors[0].full || "Unknown";
    return `(${name})`;
  } else if (authors.length === 2) {
    const name1 = authors[0].family || authors[0].full || "Unknown";
    const name2 = authors[1].family || authors[1].full || "Unknown";
    return `(${name1} and ${name2})`;
  } else {
    const name = authors[0].family || authors[0].full || "Unknown";
    return `(${name} et al.)`;
  }
}

/**
 * Format MLA in-text citation (narrative)
 * Format: Author or Author and Author or Author et al.
 */
export function formatInTextMLANarrative(authors: Author[]): string {
  if (!authors || authors.length === 0) {
    return "[No author]";
  }
  
  if (authors.length === 1) {
    return authors[0].family || authors[0].full || "Unknown";
  } else if (authors.length === 2) {
    const name1 = authors[0].family || authors[0].full || "Unknown";
    const name2 = authors[1].family || authors[1].full || "Unknown";
    return `${name1} and ${name2}`;
  } else {
    const name = authors[0].family || authors[0].full || "Unknown";
    return `${name} et al.`;
  }
}
