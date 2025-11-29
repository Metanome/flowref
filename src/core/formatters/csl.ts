/**
 * CSL formatter using citation-js
 * Replaces the 5 custom formatters (APA, MLA, Chicago, IEEE, Vancouver)
 */

import { Cite } from "@citation-js/core";
import "@citation-js/plugin-csl";
import { CitationMetadata, CitationStyle } from "../types";

/**
 * Map legacy style names to CSL template IDs
 * For backward compatibility with existing code
 */
const LEGACY_STYLE_MAP: Record<string, string> = {
  apa: "apa",
  mla: "modern-language-association",
  chicago: "chicago-note-bibliography",
  vancouver: "vancouver",
  ieee: "ieee",
};

/**
 * Get CSL template ID from style name
 * Handles both legacy names and direct CSL IDs
 */
function getTemplateId(style: CitationStyle): string {
  // Check if it's a legacy style name
  if (LEGACY_STYLE_MAP[style]) {
    return LEGACY_STYLE_MAP[style];
  }
  // Otherwise assume it's already a CSL style ID
  return style;
}

/**
 * Convert our CitationMetadata to CSL-JSON format
 */
function toCslJson(metadata: CitationMetadata): any {
  const cslItem: any = {
    id: metadata.doi || "item1",
    type: mapContainerTypeToCsl(metadata.containerType || "other"),
    title: metadata.title,
  };

  // Authors
  if (metadata.authors && metadata.authors.length > 0) {
    cslItem.author = metadata.authors.map((author) => ({
      family: author.family || "",
      given: author.given || "",
    }));
  }

  // Year
  if (metadata.year) {
    cslItem.issued = {
      "date-parts": [[parseInt(metadata.year)]],
    };
  }

  // Container (journal/book title)
  if (metadata.journal) {
    if (metadata.containerType === "journal") {
      cslItem["container-title"] = metadata.journal;
    } else if (metadata.containerType === "book") {
      cslItem["container-title"] = metadata.journal;
    } else if (metadata.containerType === "conference") {
      cslItem["event-title"] = metadata.journal;
    }
  }

  // Volume, Issue, Pages
  if (metadata.volume) {
    cslItem.volume = metadata.volume;
  }
  if (metadata.issue) {
    cslItem.issue = metadata.issue;
  }
  if (metadata.pages) {
    cslItem.page = metadata.pages;
  }

  // Publisher
  if (metadata.publisher) {
    cslItem.publisher = metadata.publisher;
  }

  // DOI
  if (metadata.doi) {
    cslItem.DOI = metadata.doi;
  }

  // URL
  if (metadata.url) {
    cslItem.URL = metadata.url;
  }

  return cslItem;
}

/**
 * Map our container type to CSL type
 */
function mapContainerTypeToCsl(
  containerType: string
): string {
  switch (containerType) {
    case "journal":
      return "article-journal";
    case "book":
      return "book";
    case "conference":
      return "paper-conference";
    case "preprint":
      return "article";
    default:
      return "article";
  }
}

/**
 * Format a reference using CSL
 * @param metadata Citation metadata
 * @param style Citation style (apa, mla, chicago, vancouver, ieee)
 * @param index Optional index for numbered styles (Vancouver, IEEE)
 * @returns Formatted reference as HTML string
 */
export function formatReference(
  metadata: CitationMetadata,
  style: CitationStyle,
  index: number = 1
): string {
  try {
    const cslData = toCslJson(metadata);
    const cite = new Cite(cslData);

    const template = getTemplateId(style);

    // Format bibliography
    const html = cite.format("bibliography", {
      format: "html",
      template: template,
      lang: "en-US",
    });

    // Extract the citation from the HTML wrapper
    // citation-js wraps output in div tags (csl-bib-body -> csl-entry)
    // We want the inner content of the entry to avoid block-level elements in the output
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const entry = doc.querySelector('.csl-entry');
    let citation = entry ? entry.innerHTML.trim() : html.trim();
    
    // Fallback for cases where DOMParser might not find the class (e.g. different output format)
    if (!entry) {
      const match = html.match(/<div[^>]*>(.*?)<\/div>/s);
      if (match) {
        citation = match[1].trim();
      }
    }

    // For numbered styles (Vancouver, IEEE), prepend the number
    if ((style === "vancouver" || style === "ieee") && index) {
      citation = `${index}. ${citation}`;
    }

    return citation;
  } catch (error) {
    console.error("Error formatting citation with citation-js:", error);
    // Fallback to basic formatting
    const authors = metadata.authors
      .map((a) => `${a.family}, ${a.given?.charAt(0)}.`)
      .join(", ");
    return `${authors} (${metadata.year}). ${metadata.title}. <em>${metadata.journal}</em>.`;
  }
}

/**
 * Format in-text citation (parenthetical)
 * @param metadata Citation metadata
 * @param style Citation style
 * @param index Optional index for numbered styles
 * @returns Formatted in-text citation
 */
export function formatInTextParenthetical(
  metadata: CitationMetadata,
  style: CitationStyle,
  index: number = 1
): string {
  try {
    const cslData = toCslJson(metadata);
    const cite = new Cite(cslData);

    const template = getTemplateId(style);

    // For numbered styles, just return the number
    if (style === "vancouver" || style === "ieee") {
      return `[${index}]`;
    }

    // For author-year styles, use citation format
    const citation = cite.format("citation", {
      format: "text",
      template: template,
      lang: "en-US",
    });

    // Clean up any HTML tags that might have leaked through
    return citation.replace(/<[^>]*>/g, "").trim();
  } catch (error) {
    console.error("Error formatting in-text citation:", error);
    // Fallback
    if (style === "vancouver" || style === "ieee") {
      return `[${index}]`;
    }
    const firstAuthor = metadata.authors[0];
    const authorName = firstAuthor?.family || "Unknown";
    return `(${authorName}, ${metadata.year})`;
  }
}

/**
 * Format in-text citation (narrative)
 * @param metadata Citation metadata
 * @param style Citation style
 * @param index Optional index for numbered styles
 * @returns Formatted narrative citation
 */
export function formatInTextNarrative(
  metadata: CitationMetadata,
  style: CitationStyle,
  index: number = 1
): string {
  try {
    // For numbered styles, narrative is same as parenthetical
    if (style === "vancouver" || style === "ieee") {
      return formatInTextParenthetical(metadata, style, index);
    }

    // For author-year styles, format as "Author (Year)"
    const firstAuthor = metadata.authors[0];
    const authorName = firstAuthor?.family || "Unknown";

    if (style === "apa") {
      return `${authorName} (${metadata.year})`;
    } else if (style === "mla") {
      return `${authorName}`;
    } else if (style === "chicago") {
      return `${authorName} [${index}]`;
    }

    return `${authorName} (${metadata.year})`;
  } catch (error) {
    console.error("Error formatting narrative citation:", error);
    const firstAuthor = metadata.authors[0];
    const authorName = firstAuthor?.family || "Unknown";
    return `${authorName} (${metadata.year})`;
  }
}
