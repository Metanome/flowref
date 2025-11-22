/**
 * Chicago 17th Edition citation formatter (Notes-Bibliography style)
 */

import { CitationMetadata, Author } from "../types";

/**
 * Format authors for Chicago reference list
 * Format: Last, First, and First Last.
 * All authors listed (no et al. in bibliography)
 */
export function formatAuthorsChicago(authors: Author[]): string {
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
  } else if (authors.length <= 10) {
    const first = formatFirstAuthor(authors[0]);
    const middle = authors.slice(1, -1).map(formatOtherAuthor).join(", ");
    const last = formatOtherAuthor(authors[authors.length - 1]);
    return `${first}, ${middle}, and ${last}`;
  } else {
    // 11+ authors: list first 7, then et al.
    const first7 = [formatFirstAuthor(authors[0])].concat(
      authors.slice(1, 7).map(formatOtherAuthor)
    ).join(", ");
    return `${first7}, et al`;
  }
}

/**
 * Format a complete Chicago reference
 * 
 * Format:
 * Author(s). "Title of Article." Journal Name vol. X, no. Y (Year): pages. https://doi.org/xxxxx.
 */
export function formatReferenceChicago(meta: CitationMetadata): string {
  const parts: string[] = [];
  
  // Authors (or Editors for edited works)
  let authorPart = formatAuthorsChicago(meta.authors);
  if (meta.isEditedWork) {
    // Add editor label for edited books
    const edLabel = meta.authors.length === 1 ? ", ed" : ", eds";
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
      journalPart += ` ${meta.volume}`;
    }
    
    // Issue
    if (meta.issue) {
      journalPart += `, no. ${meta.issue}`;
    }
    
    // Year (in parentheses)
    if (meta.year) {
      journalPart += ` (${meta.year})`;
    }
    
    // Pages (with colon)
    if (meta.pages) {
      journalPart += `: ${meta.pages}`;
    }
    
    journalPart += ".";
    parts.push(journalPart);
  } else if (meta.containerType === "book") {
    // For books, add publisher and year
    if (meta.publisher && meta.year) {
      parts.push(`${meta.publisher}, ${meta.year}.`);
    } else if (meta.publisher) {
      parts.push(`${meta.publisher}.`);
    }
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
 * Format Chicago in-text citation (superscript note number)
 * Chicago uses footnotes/endnotes, so this returns a superscript number
 * Format: ^1 or ^2 (user would format as superscript in their document)
 */
export function formatInTextChicagoParenthetical(noteNumber: number = 1): string {
  return `[${noteNumber}]`;
}

/**
 * Format Chicago in-text citation (narrative with note)
 * For narrative citations in Chicago, typically author name followed by note number
 */
export function formatInTextChicagoNarrative(authors: Author[], noteNumber: number = 1): string {
  if (!authors || authors.length === 0) {
    return `[No author][${noteNumber}]`;
  }
  
  const name = authors[0].family || authors[0].full || "Unknown";
  return `${name}[${noteNumber}]`;
}
