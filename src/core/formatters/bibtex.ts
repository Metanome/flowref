/**
 * BibTeX citation formatter
 */

import { CitationMetadata, Author } from "../types";

/**
 * Generate a BibTeX key from metadata
 * Format: firstauthor_year (e.g., smith_2020)
 */
function generateBibTeXKey(meta: CitationMetadata): string {
  const firstAuthor = meta.authors[0];
  const authorPart = firstAuthor?.family?.toLowerCase() || 
                     firstAuthor?.full?.toLowerCase().replace(/\s+/g, "") || 
                     "unknown";
  const yearPart = meta.year || "nd";
  
  return `${authorPart}_${yearPart}`;
}

/**
 * Escape special BibTeX characters
 */
function escapeBibTeX(text: string): string {
  if (!text) return "";
  
  // Ensure text is a string
  if (typeof text !== 'string') {
    text = String(text);
  }
  
  return text
    .replace(/\\/g, "\\textbackslash ")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}");
}

/**
 * Format authors for BibTeX
 * Format: "Family1, Given1 and Family2, Given2 and Family3, Given3"
 */
function formatAuthorsBibTeX(meta: CitationMetadata): string {
  if (!meta.authors || meta.authors.length === 0) {
    return "";
  }
  
  const formattedAuthors = meta.authors.map((author: Author) => {
    if (author.family && author.given) {
      return `${author.family}, ${author.given}`;
    } else if (author.family) {
      return author.family;
    } else if (author.full) {
      return author.full;
    } else {
      return "Unknown";
    }
  });
  
  return formattedAuthors.join(" and ");
}

/**
 * Determine BibTeX entry type from metadata
 */
function getBibTeXType(meta: CitationMetadata): string {
  if (meta.containerType === "journal") {
    return "article";
  } else if (meta.containerType === "book") {
    return "book";
  } else if (meta.containerType === "conference") {
    return "inproceedings";
  } else if (meta.containerType === "preprint") {
    return "misc";
  } else {
    return "article"; // Default to article
  }
}

/**
 * Format a complete BibTeX entry
 */
export function formatBibTeX(meta: CitationMetadata): string {
  const key = generateBibTeXKey(meta);
  const type = getBibTeXType(meta);
  
  const lines: string[] = [];
  lines.push(`@${type}{${key},`);
  
  // Required/common fields
  const authors = formatAuthorsBibTeX(meta);
  if (authors) {
    lines.push(`  author = {${escapeBibTeX(authors)}},`);
  }
  
  if (meta.title) {
    lines.push(`  title = {${escapeBibTeX(meta.title)}},`);
  }
  
  if (meta.journal) {
    lines.push(`  journal = {${escapeBibTeX(meta.journal)}},`);
  }
  
  if (meta.year) {
    lines.push(`  year = {${meta.year}},`);
  }
  
  // Optional fields
  if (meta.volume) {
    lines.push(`  volume = {${meta.volume}},`);
  }
  
  if (meta.issue) {
    lines.push(`  number = {${meta.issue}},`);
  }
  
  if (meta.pages) {
    lines.push(`  pages = {${meta.pages}},`);
  }
  
  if (meta.publisher) {
    lines.push(`  publisher = {${escapeBibTeX(meta.publisher)}},`);
  }
  
  if (meta.doi) {
    lines.push(`  doi = {${meta.doi}},`);
  }
  
  if (meta.url) {
    lines.push(`  url = {${meta.url}},`);
  }
  
  lines.push("}");
  
  return lines.join("\n");
}
