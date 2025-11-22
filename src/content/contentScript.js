/**
 * Content script for FlowRef - Standalone version
 * Runs on all web pages to detect DOIs
 */

// DOI detection and normalization
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

const DOI_REGEX = /\b(10\.\d{4,9}\/[^\s"'<>]+)/gi;

function normalizeDOI(doi) {
  if (!doi) return null;
  
  let normalized = doi.trim();
  
  // Remove all whitespace (spaces, tabs, newlines) from DOIs
  normalized = normalized.replace(/\s+/g, "");
  
  normalized = normalized.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  normalized = normalized.replace(/^doi:\s*/i, "");
  normalized = normalized.replace(/[.,;)\]}>]+$/, "");
  
  if (!/^10\.\d{4,9}\/.+/.test(normalized)) {
    return null;
  }
  
  return normalized;
}

function detectDOIsFromMetaTags(document) {
  const dois = [];
  
  for (const tagName of DOI_META_TAGS) {
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

function detectDOIsFromText(text) {
  const dois = [];
  const matches = text.matchAll(DOI_REGEX);
  
  for (const match of matches) {
    const normalized = normalizeDOI(match[1]);
    if (normalized && !dois.includes(normalized)) {
      dois.push(normalized);
    }
  }
  
  return dois;
}

function isPDFUrl(url) {
  if (!url) return false;
  
  const lowerUrl = url.toLowerCase();
  return lowerUrl.endsWith(".pdf") || 
         lowerUrl.includes(".pdf?") || 
         lowerUrl.includes(".pdf#") ||
         lowerUrl.includes("/pdf/");
}

function isPDFPage() {
  return isPDFUrl(window.location.href) || 
         document.contentType === "application/pdf" ||
         document.querySelector("embed[type='application/pdf']") !== null;
}

/**
 * Extract text from PDF embedded in web page
 * 
 * NOTE: This works for PDFs embedded in web pages (e.g., https://example.com/article.pdf)
 * but NOT for:
 * - Local file:// URLs (browser security blocks content scripts)
 * - Firefox's built-in PDF viewer on some URLs (sandboxed environment)
 * 
 * For those cases, the popup uses fetch() + PDF.js to parse PDFs directly.
 */
function extractPDFText() {
  try {
    // Method 1: Try Firefox's built-in PDF viewer text layer
    const textLayer = document.querySelector(".textLayer");
    if (textLayer) {
      const text = textLayer.textContent || "";
      if (text.trim().length > 0) {
        return text;
      }
    }
    
    // Method 2: Try all text layer divs
    const textLayerDivs = document.querySelectorAll(".textLayer > div, .textLayer > span");
    if (textLayerDivs.length > 0) {
      return Array.from(textLayerDivs).map(div => div.textContent).join(" ");
    }
    
    // Method 3: Try spans with role="presentation" (alternative PDF viewer)
    const textSpans = document.querySelectorAll('span[role="presentation"]');
    if (textSpans.length > 0) {
      return Array.from(textSpans).map(span => span.textContent).join(" ");
    }
    
    // Method 4: Try page divs (PDF.js structure)
    const pageContent = document.querySelectorAll('.page [role="document"], .page .textLayer');
    if (pageContent.length > 0) {
      return Array.from(pageContent).map(el => el.textContent).join(" ");
    }
    
    // Method 5: Try annotation layer (sometimes contains text)
    const annotationLayer = document.querySelector(".annotationLayer");
    if (annotationLayer) {
      const text = annotationLayer.textContent || "";
      if (text.trim().length > 0) {
        return text;
      }
    }
    
    // Method 6: Fallback to body text
    return document.body.innerText || "";
  } catch (error) {
    console.error("Failed to extract PDF text:", error);
    return "";
  }
}

function detectDOIFromPDFText(text) {
  // Search in the first ~10000 characters (increased from 5000 for better coverage)
  const searchText = text.slice(0, 10000);
  const dois = detectDOIsFromText(searchText);
  
  return dois.length > 0 ? dois[0] : null;
}

function detectDOIs() {
  // First, try to detect DOI from URL itself (works for proxy sites, Sci-Hub, etc.)
  const urlDOIs = detectDOIsFromText(window.location.href);
  if (urlDOIs.length > 0) {
    console.log("FlowRef: Found DOI in URL:", urlDOIs);
    return {
      dois: urlDOIs,
      source: "url"
    };
  }
  
  if (isPDFPage()) {
    const pdfText = extractPDFText();
    
    // If no text extracted, might be loading - try waiting a bit
    if (!pdfText || pdfText.trim().length < 50) {
      console.log("FlowRef: PDF text not ready, will retry when requested");
      // Return empty for now, popup will trigger a retry
      return {
        dois: [],
        source: "pdf",
        pendingPDF: true
      };
    }
    
    const doi = detectDOIFromPDFText(pdfText);
    
    return {
      dois: doi ? [doi] : [],
      source: "pdf"
    };
  }
  
  const metaDOIs = detectDOIsFromMetaTags(document);
  if (metaDOIs.length > 0) {
    return {
      dois: metaDOIs,
      source: "meta-tag"
    };
  }
  
  const bodyText = document.body?.innerText || "";
  const textDOIs = detectDOIsFromText(bodyText);
  
  return {
    dois: textDOIs,
    source: "regex"
  };
}

// Message listener
const browserAPI = (typeof browser !== "undefined") ? browser : chrome;

browserAPI.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    console.log("FlowRef: Received message:", message.type);
    
    if (message.type === "DETECT_DOI") {
      try {
        console.log("FlowRef: Starting DOI detection...");
        console.log("FlowRef: URL:", window.location.href);
        console.log("FlowRef: Content type:", document.contentType);
        console.log("FlowRef: Is PDF page:", isPDFPage());
        
        const result = detectDOIs();
        console.log("FlowRef: Detection result:", result);
        
        sendResponse({
          type: "DETECT_DOI_RESPONSE",
          payload: result
        });
        
        return true; // Keep channel open for async response
      } catch (error) {
        console.error("FlowRef: Error detecting DOI:", error);
        sendResponse({
          type: "DETECT_DOI_RESPONSE",
          payload: {
            dois: [],
            source: "regex",
            error: error instanceof Error ? error.message : "Unknown error"
          }
        });
        
        return true;
      }
    }
    
    return false;
  }
);

console.log("FlowRef content script loaded on:", window.location.href);
