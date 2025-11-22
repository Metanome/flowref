/**
 * DOI detection and normalization utilities
 */

import { DOIDetectionResult } from "./types";

/**
 * List of meta tag names that commonly contain DOIs
 */
const DOI_META_TAGS = [
  "citation_doi",
  "dc.identifier",
  "dc.Identifier",
  "DC.identifier",
  "DC.Identifier",
  "prism.doi",
  "bepress_citation_doi",
  "rft.id"
];

/**
 * Regex pattern for detecting DOIs
 * Matches the standard DOI format: 10.xxxx/...
 */
const DOI_REGEX = /\b(10\.\d{4,9}\/[^\s"'<>]+)/gi;

/**
 * Normalize a DOI string
 * - Remove common prefixes (https://doi.org/, http://dx.doi.org/, doi:)
 * - Clean up trailing punctuation
 * - Remove whitespace and line breaks
 * - Validate format
 */
export function normalizeDOI(doi: string): string | null {
  if (!doi) return null;
  
  // Remove common prefixes and trim
  let normalized = doi.trim();
  
  // Handle URLs containing DOIs (e.g., https://www.pnas.org/doi/full/10.1073/pnas.xxx)
  // Extract DOI pattern from any URL
  const urlDoiMatch = normalized.match(/(?:doi\.org\/|\/doi\/(?:full\/|abs\/)?)(10\.\d{4,9}\/[^\s?#]+)/i);
  if (urlDoiMatch) {
    normalized = urlDoiMatch[1]; // Extract just the DOI part
  } else {
    // Not a URL with DOI, try standard prefixes
    normalized = normalized.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
    normalized = normalized.replace(/^doi:\s*/i, "");
  }
  
  // Remove ALL whitespace (spaces, tabs, newlines) - critical for PDFs
  // Do this BEFORE other cleaning to handle line-wrapped DOIs
  normalized = normalized.replace(/\s+/g, "");
  
  // Remove everything after common URL patterns that might be concatenated
  // (PDF text extraction often concatenates DOI with following URL)
  normalized = normalized.replace(/www\..*/i, "");
  normalized = normalized.replace(/https?:\/\/.*/i, "");
  
  // Remove trailing punctuation that's not part of the DOI
  normalized = normalized.replace(/[.,;)\]}>]+$/, "");
  
  // Remove leading punctuation
  normalized = normalized.replace(/^[.,;(\[{<]+/, "");
  
  // Validate format (should start with 10.xxxx/ and have content after /)
  // Require at least 15 characters total to avoid incomplete DOIs like "10.1016/S1"
  // Most valid DOIs are much longer (e.g., "10.1016/j.neuron.2010.09.025")
  if (!/^10\.\d{4,9}\/.{5,}/.test(normalized) || normalized.length < 15) {
    return null;
  }
  
  return normalized;
}

/**
 * Detect DOIs from meta tags in the document
 */
export function detectDOIsFromMetaTags(document: Document): string[] {
  const dois: string[] = [];
  
  for (const tagName of DOI_META_TAGS) {
    // Try name attribute
    const metaElements = document.querySelectorAll(`meta[name="${tagName}"]`);
    metaElements.forEach(meta => {
      const content = meta.getAttribute("content");
      if (content) {
        const normalized = normalizeDOI(content);
        if (normalized && !dois.includes(normalized)) {
          dois.push(normalized);
        }
      }
    });
    
    // Try property attribute (for Open Graph and similar)
    const propertyElements = document.querySelectorAll(`meta[property="${tagName}"]`);
    propertyElements.forEach(meta => {
      const content = meta.getAttribute("content");
      if (content) {
        const normalized = normalizeDOI(content);
        if (normalized && !dois.includes(normalized)) {
          dois.push(normalized);
        }
      }
    });
  }
  
  return dois;
}

/**
 * Detect DOIs using regex pattern matching on text content
 */
export function detectDOIsFromText(text: string): string[] {
  const dois: string[] = [];
  
  // First, try standard pattern (no spaces)
  const matches = text.matchAll(DOI_REGEX);
  for (const match of matches) {
    const normalized = normalizeDOI(match[1]);
    if (normalized && !dois.includes(normalized)) {
      dois.push(normalized);
    }
  }
  
  // Also try aggressive pattern for DOIs with spaces (common in PDFs)
  // This matches more liberally and relies on normalizeDOI to validate
  // Matches: optional "doi:" + 10.xxxx/ + any combination of word chars, hyphens, dots, parens, slashes, and spaces
  const aggressivePattern = /(?:doi:\s*)?10\.\d{4,9}\/[\w\-\.\(\)\/\s]{3,100}/gi;
  const aggressiveMatches = text.matchAll(aggressivePattern);
  
  for (const match of aggressiveMatches) {
    const normalized = normalizeDOI(match[0]);
    // Check if DOI is already in list (case-insensitive)
    if (normalized && !dois.some(d => d.toLowerCase() === normalized.toLowerCase())) {
      dois.push(normalized);
    }
  }
  
  return dois;
}

/**
 * Detect DOIs from the current document
 * Priority:
 * 1. Meta tags
 * 2. Page text (if no meta tags found)
 */
export function detectDOIsFromDocument(document: Document): DOIDetectionResult {
  // Try meta tags first
  const metaDOIs = detectDOIsFromMetaTags(document);
  if (metaDOIs.length > 0) {
    return {
      dois: metaDOIs,
      source: "meta-tag"
    };
  }
  
  // Fall back to regex on body text
  const bodyText = document.body?.innerText || "";
  const textDOIs = detectDOIsFromText(bodyText);
  
  return {
    dois: textDOIs,
    source: "regex"
  };
}

/**
 * Check if a URL points to a PDF file
 */
export function isPDFUrl(url: string): boolean {
  if (!url) return false;
  
  const lowerUrl = url.toLowerCase();
  return lowerUrl.endsWith(".pdf") || 
         lowerUrl.includes(".pdf?") || 
         lowerUrl.includes(".pdf#") ||
         lowerUrl.includes("/pdf/");
}

/**
 * Extract DOI from PDF text content
 * This is a simple implementation that searches the beginning of the PDF
 */
export function detectDOIFromPDFText(text: string): string | null {
  // Search in the first ~5000 characters (typically covers first page)
  const searchText = text.slice(0, 5000);
  const dois = detectDOIsFromText(searchText);
  
  // Return the first DOI found
  return dois.length > 0 ? dois[0] : null;
}

/**
 * Validate a DOI format
 */
export function isValidDOI(doi: string): boolean {
  if (!doi) return false;
  const normalized = normalizeDOI(doi);
  return normalized !== null;
}
