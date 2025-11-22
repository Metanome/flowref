/**
 * Popup script for FlowRef
 */

import { normalizeDOI, isValidDOI, detectDOIsFromText } from "../core/doi";
import { fetchMetadata } from "../core/metadata";
import { formatReferenceAPA } from "../core/formatters/apa";
import { formatReferenceMLA } from "../core/formatters/mla";
import { formatReferenceChicago } from "../core/formatters/chicago";
import { formatReferenceVancouver } from "../core/formatters/vancouver";
import { formatReferenceIEEE } from "../core/formatters/ieee";
import { formatInTextAPA, formatInTextMLA, formatInTextChicago, formatInTextIEEE, formatInTextVancouver } from "../core/inText";
import { formatBibTeX } from "../core/formatters/bibtex";
import { copyToClipboard, showNotification } from "../core/clipboard";
import { MessageType, ExtensionMessage, DOIDetectionResult, CitationMetadata, CitationStyle } from "../core/types";
import { extractDOIFromPDF } from "../core/pdf";

// DOM elements
const doiSelect = document.getElementById("doi-select") as HTMLSelectElement;
const doiInput = document.getElementById("doi-input") as HTMLInputElement;
const detectBtn = document.getElementById("detect-btn") as HTMLButtonElement;
const validationFeedback = document.getElementById("validation-feedback") as HTMLDivElement;
const detectionStatus = document.getElementById("detection-status") as HTMLDivElement;
const styleSelect = document.getElementById("style-select") as HTMLSelectElement;
const generateBtn = document.getElementById("generate-btn") as HTMLButtonElement;
const loading = document.getElementById("loading") as HTMLDivElement;
const errorDiv = document.getElementById("error") as HTMLDivElement;
const outputSection = document.getElementById("output-section") as HTMLElement;
const batchModeLink = document.getElementById("batch-mode-link") as HTMLAnchorElement;
const settingsLink = document.getElementById("settings-link") as HTMLAnchorElement;

// Output elements
const referenceOutput = document.getElementById("reference-output") as HTMLDivElement;
const intextParensOutput = document.getElementById("intext-parens-output") as HTMLDivElement;
const intextNarrativeOutput = document.getElementById("intext-narrative-output") as HTMLDivElement;
const bibtexOutput = document.getElementById("bibtex-output") as HTMLDivElement;

// State
let detectedDOIs: string[] = [];
let currentMetadata: CitationMetadata | null = null;
let currentCitations: {
  reference: string;
  intextParens: string;
  intextNarrative: string;
  bibtex: string;
} | null = null;

/**
 * Load saved citation style preference
 */
async function loadStylePreference(): Promise<void> {
  try {
    const browserAPI = (typeof browser !== "undefined") ? browser : chrome;
    const result = await browserAPI.storage.local.get("citationStyle");
    if (result.citationStyle) {
      styleSelect.value = result.citationStyle;
    }
  } catch (error) {
    console.error("Failed to load style preference:", error);
  }
}

/**
 * Save citation style preference
 */
async function saveStylePreference(style: string): Promise<void> {
  try {
    const browserAPI = (typeof browser !== "undefined") ? browser : chrome;
    await browserAPI.storage.local.set({ citationStyle: style });
  } catch (error) {
    console.error("Failed to save style preference:", error);
  }
}

/**
 * Show error message
 */
function showError(message: string): void {
  errorDiv.textContent = message;
  errorDiv.classList.remove("hidden");
  outputSection.classList.add("hidden");
}

/**
 * Hide error message
 */
function hideError(): void {
  errorDiv.classList.add("hidden");
}

/**
 * Show loading indicator
 */
function showLoading(): void {
  loading.classList.remove("hidden");
  generateBtn.disabled = true;
}

/**
 * Hide loading indicator
 */
function hideLoading(): void {
  loading.classList.add("hidden");
  generateBtn.disabled = false;
}

/**
 * Detect DOIs from the active tab
 */
async function detectDOIsFromTab(): Promise<void> {
  try {
    detectionStatus.textContent = "Detecting DOI...";
    detectionStatus.className = "status-message status-info";
    
    // Cross-browser API compatibility
    const browserAPI = (typeof browser !== "undefined") ? browser : chrome;
    
    // Get active tab
    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    
    if (!tab.id) {
      throw new Error("No active tab found");
    }
    
    // Check if it's a PDF URL
    const isPDF = tab.url && (
      tab.url.toLowerCase().endsWith('.pdf') ||
      tab.url.toLowerCase().includes('.pdf?') ||
      tab.url.toLowerCase().includes('.pdf#') ||
      tab.url.toLowerCase().includes('/pdf/')
    );
    
    if (isPDF) {
      // For PDFs, try content script first (works for embedded PDFs on web pages)
      // Then fall back to fetch + PDF.js (works for direct PDF URLs)
      detectionStatus.textContent = "Detected PDF, attempting to extract DOI...";
      detectionStatus.className = "status-message status-info";
      
      try {
        // Try content script first (works for embedded PDFs like https://example.com/article.pdf)
        console.log("Attempting to contact content script on PDF...");
        let contentScriptWorked = false;
        
        try {
          const response = await browserAPI.tabs.sendMessage(tab.id, {
            type: MessageType.DETECT_DOI
          }, { frameId: 0 });
          
          const result = response.payload;
          console.log("PDF content script result:", result);
          contentScriptWorked = true;
          
          // If content script found DOI, use it
          if (result && result.dois && result.dois.length > 0) {
            console.log("Found DOI via content script:", result.dois);
            processDetectionResult(result);
            return;
          }
          
          // If content script returned pendingPDF, wait longer and retry
          if (result && (result as any).pendingPDF) {
            detectionStatus.textContent = "Loading PDF... (retrying)";
            await new Promise(resolve => setTimeout(resolve, 2500)); // Increased wait time
            
            const retryResponse = await browserAPI.tabs.sendMessage(tab.id, {
              type: MessageType.DETECT_DOI
            }, { frameId: 0 });
            
            console.log("Retry result:", retryResponse.payload);
            
            if (retryResponse.payload && retryResponse.payload.dois.length > 0) {
              processDetectionResult(retryResponse.payload);
              return;
            }
            
            // If still no DOI after retry, the PDF text layer might not be accessible
            console.log("PDF text still not ready after retry, trying fetch fallback");
          }
        } catch (contentScriptError) {
          console.log("Content script not available on PDF page:", contentScriptError);
          contentScriptWorked = false;
        }
        
        // Content script didn't work, try fetch + PDF.js
        console.log("Trying fetch + PDF.js fallback...");
        await detectDOIFromPDFUrl(tab.url!);
        return;
      } catch (pdfError) {
        console.error("PDF DOI extraction failed:", pdfError);
        
        // Provide more specific error message
        const errorMsg = pdfError instanceof Error ? pdfError.message : "Unknown error";
        if (errorMsg.includes("HTTP") || errorMsg.includes("fetch")) {
          detectionStatus.textContent = "Cannot access PDF (try: Upload in Batch Mode instead)";
        } else if (errorMsg.includes("file://")) {
          detectionStatus.textContent = "Local PDFs blocked by browser (use Batch Mode → PDF Upload)";
        } else {
          detectionStatus.textContent = "Could not extract DOI from PDF (try manual entry)";
        }
        detectionStatus.className = "status-message status-warning";
        return;
      }
    }
    
    console.log("FlowRef popup: Sending message to tab", tab.id, tab.url);
    
    // Send message to content script for non-PDF pages
    // Note: This sends to ALL frames, but we want the MAIN frame's result
    let response: ExtensionMessage<DOIDetectionResult>;
    
    try {
      // Send message to main frame only (frameId: 0)
      response = await browserAPI.tabs.sendMessage(tab.id, {
        type: MessageType.DETECT_DOI
      }, { frameId: 0 });
      console.log("FlowRef popup: Received response:", response);
    } catch (error) {
      console.error("FlowRef popup: Message failed:", error);
      detectionStatus.textContent = "Content script not loaded (try refreshing page)";
      detectionStatus.className = "status-message status-error";
      return;
    }
    
    const result = response.payload;
    
    // If PDF is pending (text layer not loaded), retry after delay
    if (result && (result as any).pendingPDF) {
      detectionStatus.textContent = "Loading PDF... (retrying)";
      detectionStatus.className = "status-message status-info";
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      try {
        const retryResponse: ExtensionMessage<DOIDetectionResult> = await browserAPI.tabs.sendMessage(tab.id, {
          type: MessageType.DETECT_DOI
        }, { frameId: 0 });
        
        const retryResult = retryResponse.payload;
        
        if (!retryResult || retryResult.dois.length === 0) {
          detectionStatus.textContent = "No DOI found in PDF";
          detectionStatus.className = "status-message status-warning";
          detectedDOIs = [];
          doiInput.value = "";
          return;
        }
        
        // Use retry result
        processDetectionResult(retryResult);
        return;
      } catch (retryError) {
        console.error("FlowRef popup: Retry failed:", retryError);
        detectionStatus.textContent = "Failed to extract DOI from PDF";
        detectionStatus.className = "status-message status-error";
        return;
      }
    }
    
    if (!result || result.dois.length === 0) {
      detectionStatus.textContent = "No DOI found on this page";
      detectionStatus.className = "status-message status-warning";
      detectedDOIs = [];
      doiInput.value = "";
      return;
    }
    
    processDetectionResult(result);
  } catch (error) {
    console.error("Failed to detect DOI:", error);
    detectionStatus.textContent = `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
    detectionStatus.className = "status-message status-error";
  }
}

/**
 * Detect DOI from PDF URL by fetching and parsing
 */
async function detectDOIFromPDFUrl(url: string): Promise<void> {
  try {
    // Check if it's a local file URL
    if (url.startsWith("file://")) {
      throw new Error("file:// URLs cannot be fetched due to browser security");
    }
    
    // Fetch the PDF
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Cannot access PDF`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    detectionStatus.textContent = "Extracting text from PDF...";
    
    // Extract DOI using PDF.js
    const doi = await extractDOIFromPDF(arrayBuffer);
    
    if (doi) {
      // Normalize to remove any spaces that might have been extracted
      const normalized = normalizeDOI(doi);
      if (normalized) {
        detectedDOIs = [normalized];
        doiInput.value = normalized;
        detectionStatus.textContent = "DOI extracted from PDF";
        detectionStatus.className = "status-message status-success";
        doiSelect.classList.add("hidden");
        doiInput.classList.remove("hidden");
      } else {
        detectionStatus.textContent = "Invalid DOI format in PDF (try manual entry)";
        detectionStatus.className = "status-message status-warning";
      }
    } else {
      detectionStatus.textContent = "No DOI found in PDF (try manual entry)";
      detectionStatus.className = "status-message status-warning";
      detectedDOIs = [];
      doiInput.value = "";
    }
  } catch (error) {
    console.error("PDF fetch/parse error:", error);
    throw error;
  }
}

/**
 * Process detection result and update UI
 */
function processDetectionResult(result: DOIDetectionResult): void {
  detectedDOIs = result.dois;
  
  if (detectedDOIs.length === 1) {
    // Single DOI: populate input directly
    doiInput.value = detectedDOIs[0];
    detectionStatus.textContent = `DOI detected (${result.source})`;
    detectionStatus.className = "status-message status-success";
    doiSelect.classList.add("hidden");
    doiInput.classList.remove("hidden");
  } else {
    // Multiple DOIs: show dropdown
    doiSelect.innerHTML = '<option value="">Select a DOI...</option>';
    detectedDOIs.forEach(doi => {
      const option = document.createElement("option");
      option.value = doi;
      option.textContent = doi;
      doiSelect.appendChild(option);
    });
    
    doiSelect.classList.remove("hidden");
    doiInput.classList.add("hidden");
    detectionStatus.textContent = `${detectedDOIs.length} DOIs found`;
    detectionStatus.className = "status-message status-success";
  }
}

/**
 * Get the current DOI (from input or select)
 */
function getCurrentDOI(): string | null {
  if (!doiSelect.classList.contains("hidden")) {
    return doiSelect.value || null;
  } else {
    return doiInput.value.trim() || null;
  }
}

/**
 * Generate citation from DOI
 */
async function generateCitation(): Promise<void> {
  hideError();
  
  const doi = getCurrentDOI();
  if (!doi) {
    showError("Please enter or detect a DOI");
    return;
  }
  
  // Normalize and validate DOI
  const normalizedDOI = normalizeDOI(doi);
  if (!normalizedDOI || !isValidDOI(normalizedDOI)) {
    showError("Invalid DOI format. Please check and try again.");
    return;
  }
  
  showLoading();
  
  try {
    // Fetch metadata
    const result = await fetchMetadata(normalizedDOI);
    
    if (!result.success || !result.data) {
      showError(result.error || "Failed to fetch metadata");
      hideLoading();
      return;
    }
    
    currentMetadata = result.data;
    
    // Get selected style
    const style = styleSelect.value as CitationStyle;
    
    // Format citations based on selected style
    let reference: string;
    
    switch (style) {
      case "mla":
        reference = formatReferenceMLA(currentMetadata);
        break;
      case "chicago":
        reference = formatReferenceChicago(currentMetadata);
        break;
      case "vancouver":
        reference = formatReferenceVancouver(currentMetadata, 1);
        break;
      case "ieee":
        reference = formatReferenceIEEE(currentMetadata, 1);
        break;
      case "apa":
      default:
        reference = formatReferenceAPA(currentMetadata);
        break;
    }
    
    // In-text citations for all styles
    let intextParens = "";
    let intextNarrative = "";
    
    if (style === "apa") {
      intextParens = formatInTextAPA(currentMetadata.authors, currentMetadata.year, "parenthetical");
      intextNarrative = formatInTextAPA(currentMetadata.authors, currentMetadata.year, "narrative");
    } else if (style === "mla") {
      intextParens = formatInTextMLA(currentMetadata.authors, "parenthetical");
      intextNarrative = formatInTextMLA(currentMetadata.authors, "narrative");
    } else if (style === "chicago") {
      intextParens = formatInTextChicago(currentMetadata.authors, 1, "parenthetical");
      intextNarrative = formatInTextChicago(currentMetadata.authors, 1, "narrative");
    } else if (style === "ieee") {
      intextParens = formatInTextIEEE(currentMetadata.authors, 1, "parenthetical");
      intextNarrative = formatInTextIEEE(currentMetadata.authors, 1, "narrative");
    } else if (style === "vancouver") {
      intextParens = formatInTextVancouver(currentMetadata.authors, 1, "parenthetical");
      intextNarrative = formatInTextVancouver(currentMetadata.authors, 1, "narrative");
    }
    
    const bibtex = formatBibTeX(currentMetadata);
    
    currentCitations = {
      reference,
      intextParens,
      intextNarrative,
      bibtex
    };
    
    // Display citations (using innerHTML to render HTML formatting)
    referenceOutput.innerHTML = reference;
    intextParensOutput.innerHTML = intextParens;
    intextNarrativeOutput.innerHTML = intextNarrative;
    bibtexOutput.textContent = bibtex; // BibTeX stays as plain text
    
    // Show in-text citations for all styles now
    const intextGroups = document.querySelectorAll(".output-group");
    // Always show in-text sections (indices 1 and 2)
    if (intextGroups[1]) (intextGroups[1] as HTMLElement).style.display = "block";
    if (intextGroups[2]) (intextGroups[2] as HTMLElement).style.display = "block";
    
    // Show output section
    outputSection.classList.remove("hidden");
    
    // Auto-copy full reference to clipboard
    await copyToClipboard(reference);
    showNotification("Citation copied to clipboard");
    
    hideLoading();
  } catch (error) {
    console.error("Failed to generate citation:", error);
    showError("An unexpected error occurred. Please try again.");
    hideLoading();
  }
}

/**
 * Handle copy button clicks
 */
function setupCopyButtons(): void {
  document.querySelectorAll(".btn-copy").forEach(button => {
    button.addEventListener("click", async () => {
      const target = (button as HTMLElement).getAttribute("data-target");
      
      if (!currentCitations) return;
      
      let text = "";
      let label = "";
      
      switch (target) {
        case "reference":
          text = currentCitations.reference;
          label = "Reference";
          break;
        case "intext-parens":
          text = currentCitations.intextParens;
          label = "In-text citation";
          break;
        case "intext-narrative":
          text = currentCitations.intextNarrative;
          label = "In-text citation";
          break;
        case "bibtex":
          text = currentCitations.bibtex;
          label = "BibTeX";
          break;
      }
      
      if (text) {
        await copyToClipboard(text);
        showNotification(`${label} copied`);
      }
    });
  });
}

/**
 * Handle DOI select change
 */
doiSelect.addEventListener("change", () => {
  if (doiSelect.value) {
    // User selected a DOI from dropdown
    hideError();
  }
});

/**
 * Handle detect button click
 */
detectBtn.addEventListener("click", detectDOIsFromTab);

/**
 * Handle generate button click
 */
generateBtn.addEventListener("click", generateCitation);

/**
 * Handle style change
 */
styleSelect.addEventListener("change", () => {
  saveStylePreference(styleSelect.value);
  
  // If we have metadata, regenerate citation in new style
  if (currentMetadata) {
    generateCitation();
  }
});

/**
 * Handle batch mode link
 */
batchModeLink.addEventListener("click", (e) => {
  e.preventDefault();
  const browserAPI = (typeof browser !== "undefined") ? browser : chrome;
  browserAPI.runtime.openOptionsPage();
});

settingsLink.addEventListener("click", (e) => {
  e.preventDefault();
  const browserAPI = (typeof browser !== "undefined") ? browser : chrome;
  browserAPI.tabs.create({ url: browserAPI.runtime.getURL("settings/settings.html") });
});

/**
 * Handle Enter key in DOI input
 */
doiInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    generateCitation();
  }
});

/**
 * Validate DOI input and show real-time feedback
 */
function validateDOIInput(): void {
  const value = doiInput.value.trim();
  
  // Clear feedback if empty
  if (!value) {
    doiInput.classList.remove("valid", "invalid");
    validationFeedback.textContent = "";
    validationFeedback.className = "validation-feedback";
    return;
  }
  
  // Don't validate if too short
  if (value.length < 5) {
    doiInput.classList.remove("valid", "invalid");
    validationFeedback.textContent = "";
    validationFeedback.className = "validation-feedback";
    return;
  }
  
  // Normalize and validate
  const normalized = normalizeDOI(value);
  
  if (normalized && isValidDOI(normalized)) {
    doiInput.classList.remove("invalid");
    doiInput.classList.add("valid");
    validationFeedback.textContent = "✓ Valid DOI format";
    validationFeedback.className = "validation-feedback success";
  } else {
    doiInput.classList.remove("valid");
    doiInput.classList.add("invalid");
    validationFeedback.textContent = "Invalid DOI format (should be 10.xxxx/...)";
    validationFeedback.className = "validation-feedback error";
  }
}

/**
 * Handle DOI input changes for real-time validation
 */
doiInput.addEventListener("input", validateDOIInput);

/**
 * Initialize popup
 */
async function init(): Promise<void> {
  await loadStylePreference();
  setupCopyButtons();
  
  // Add DOI select change handler
  doiSelect.addEventListener("change", () => {
    if (doiSelect.value) {
      doiInput.value = doiSelect.value;
    }
  });
  
  // Check for pending DOI from context menu
  const browserAPI = (typeof browser !== "undefined") ? browser : chrome;
  const result = await browserAPI.storage.local.get("pendingDOI");
  
  if (result.pendingDOI) {
    // Clear the pending DOI and populate input
    await browserAPI.storage.local.remove("pendingDOI");
    doiInput.value = result.pendingDOI;
    validateDOIInput(); // Validate the input
    
    // Auto-generate citation if it's a valid DOI
    const normalized = normalizeDOI(result.pendingDOI);
    if (normalized && isValidDOI(normalized)) {
      generateCitation();
    }
  } else {
    // Check if auto-detect is enabled in settings
    const autoDetectResult = await browserAPI.storage.local.get("autoDetectDOI");
    const autoDetectEnabled = autoDetectResult.autoDetectDOI !== undefined ? autoDetectResult.autoDetectDOI : true;
    
    if (autoDetectEnabled) {
      // Auto-detect DOI on load (normal flow)
      detectDOIsFromTab();
    }
  }
}

// Run initialization
init();
