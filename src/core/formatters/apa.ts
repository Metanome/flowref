/**
 * APA 7th Edition citation formatter
 */

import { CitationMetadata, Author } from "../types";
import { toSentenceCase, toTitleCase, formatInitials } from "../util";

/**
 * Format authors for APA reference list
 * Examples:
 * - 1 author: Smith, J. A.
 * - 2 authors: Smith, J. A., & Lee, B.
 * - 3-20 authors: Smith, J. A., Lee, B., & Jones, C.
 * - 21+ authors: Smith, J. A., Lee, B., ... Jones, C. (first 19, ellipsis, last)
 */
export function formatAuthorsAPA(authors: Author[]): string {
  if (!authors || authors.length === 0) {
    return "[No author]";
  }
  
  const formatAuthor = (author: Author): string => {
    if (author.family && author.given) {
      const initials = formatInitials(author.given);
      return `${author.family}, ${initials}`;
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
    return `${formatAuthor(authors[0])}, & ${formatAuthor(authors[1])}`;
  } else if (authors.length <= 20) {
    const formattedAuthors = authors.map(formatAuthor);
    const allButLast = formattedAuthors.slice(0, -1).join(", ");
    const last = formattedAuthors[formattedAuthors.length - 1];
    return `${allButLast}, & ${last}`;
  } else {
    // 21+ authors: list first 19, ellipsis, then final author
    const first19 = authors.slice(0, 19).map(formatAuthor).join(", ");
    const lastAuthor = formatAuthor(authors[authors.length - 1]);
    return `${first19}, ... ${lastAuthor}`;
  }
}

/**
 * Format a complete APA reference
 * 
 * General format:
 * Author(s). (Year). Title in sentence case. Journal in Title Case, volume(issue), pages. https://doi.org/xxx
 */
export function formatReferenceAPA(meta: CitationMetadata): string {
  const parts: string[] = [];
  
  // Authors (or Editors for edited works)
  let authorPart = formatAuthorsAPA(meta.authors);
  if (meta.isEditedWork) {
    // Add "(Eds.)" or "(Ed.)" after the names, keeping the final period
    // NOTE: formatAuthorsAPA returns names WITH trailing period (e.g., "Smith, J. A., & Doe, B. C.")
    // We need to insert the editor label before that period
    const edLabel = meta.authors.length === 1 ? " (Ed.)." : " (Eds.).";
    if (!authorPart.endsWith('.')) {
      authorPart += '.';
    }
    // Insert the editor label before the final period: "Name. " becomes "Name (Eds.)."
    authorPart = authorPart.slice(0, -1) + edLabel;
  }
  parts.push(authorPart);
  
  // Year
  if (meta.year) {
    parts.push(`(${meta.year}).`);
  } else {
    parts.push("(n.d.).");
  }
  
  // Title and container information - different formatting for books vs journals
  if (meta.containerType === "book") {
    // For books: title is italicized, book title goes after
    let title = toSentenceCase(meta.title);
    if (!/[.!?]$/.test(title)) {
      title += ".";
    }
    parts.push(`<em>${title}</em>`);
    
    // Publisher
    if (meta.publisher) {
      parts.push(`${meta.publisher}.`);
    }
  } else {
    // For articles: title is not italicized, journal/container is italicized
    let title = toSentenceCase(meta.title);
    if (!/[.!?]$/.test(title)) {
      title += ".";
    }
    parts.push(title);
    
    // Journal/Container and volume/issue information
    if (meta.journal) {
      // Journal name is italicized in APA
      let journalPart = `<em>${toTitleCase(meta.journal)}</em>`;
      
      // Volume (italicized)
      if (meta.volume) {
        journalPart += `, <em>${meta.volume}</em>`;
      }
      
      // Issue (not italicized)
      if (meta.issue) {
        journalPart += `(${meta.issue})`;
      }
      
      // Pages
      if (meta.pages) {
        journalPart += `, ${meta.pages}`;
      }
      
      journalPart += ".";
      parts.push(journalPart);
    }
  }
  
  // DOI or URL
  if (meta.doi) {
    parts.push(`https://doi.org/${meta.doi}`);
  } else if (meta.url) {
    parts.push(meta.url);
  }
  
  return parts.join(" ");
}

/**
 * Format APA in-text citation (parenthetical)
 * Examples:
 * - 1 author: (Smith, 2020)
 * - 2 authors: (Smith & Lee, 2020)
 * - 3+ authors: (Smith et al., 2020)
 */
export function formatInTextAPAParenthetical(authors: Author[], year?: string): string {
  if (!authors || authors.length === 0) {
    return year ? `([No author], ${year})` : "([No author], n.d.)";
  }
  
  const yearStr = year || "n.d.";
  
  if (authors.length === 1) {
    const name = authors[0].family || authors[0].full || "Unknown";
    return `(${name}, ${yearStr})`;
  } else if (authors.length === 2) {
    const name1 = authors[0].family || authors[0].full || "Unknown";
    const name2 = authors[1].family || authors[1].full || "Unknown";
    return `(${name1} & ${name2}, ${yearStr})`;
  } else {
    const name = authors[0].family || authors[0].full || "Unknown";
    return `(${name} et al., ${yearStr})`;
  }
}

/**
 * Format APA in-text citation (narrative)
 * Examples:
 * - 1 author: Smith (2020)
 * - 2 authors: Smith and Lee (2020)
 * - 3+ authors: Smith et al. (2020)
 */
export function formatInTextAPANarrative(authors: Author[], year?: string): string {
  if (!authors || authors.length === 0) {
    return year ? `[No author] (${year})` : "[No author] (n.d.)";
  }
  
  const yearStr = year || "n.d.";
  
  if (authors.length === 1) {
    const name = authors[0].family || authors[0].full || "Unknown";
    return `${name} (${yearStr})`;
  } else if (authors.length === 2) {
    const name1 = authors[0].family || authors[0].full || "Unknown";
    const name2 = authors[1].family || authors[1].full || "Unknown";
    return `${name1} and ${name2} (${yearStr})`;
  } else {
    const name = authors[0].family || authors[0].full || "Unknown";
    return `${name} et al. (${yearStr})`;
  }
}
