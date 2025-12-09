/**
 * Popup script for FlowRef
 */

import { normalizeDOI, isValidDOI, detectDOIsFromText, isURL, fetchDOIFromURL } from "../core/doi";
import { fetchMetadata } from "../core/metadata";
import { formatReference, formatInTextParenthetical, formatInTextNarrative } from "../core/formatters/csl";
import { formatBibTeX } from "../core/formatters/bibtex";
import { copyToClipboard, showNotification } from "../core/clipboard";
import { MessageType, ExtensionMessage, DOIDetectionResult, CitationMetadata, CitationStyle } from "../core/types";
import { extractDOIFromPDF } from "../core/pdf";
import { StylePicker } from "../core/stylePicker";
import { initializePopularStyles } from "../core/styles";

// Initialize popular styles with real CSL metadata (async, non-blocking)
initializePopularStyles();

// DOM elements
const doiSelect = document.getElementById("doi-select") as HTMLSelectElement;
const doiInput = document.getElementById("doi-input") as HTMLInputElement;
const detectBtn = document.getElementById("detect-btn") as HTMLButtonElement;
const statusBar = document.getElementById("status-bar") as HTMLDivElement;
const statusMessage = document.getElementById("status-message") as HTMLSpanElement;
const stylePickerContainer = document.getElementById("style-picker") as HTMLDivElement;
const generateBtn = document.getElementById("generate-btn") as HTMLButtonElement;
const loading = document.getElementById("loading") as HTMLDivElement;
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
let stylePicker: StylePicker;

/**
 * Load saved citation style preference
 */
async function loadStylePreference(): Promise<void> {
  try {
    const browserAPI = (typeof browser !== "undefined") ? browser : chrome;
    const result = await browserAPI.storage.local.get("citationStyle");
    if (result.citationStyle) {
      stylePicker.setSelectedStyle(result.citationStyle);
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
 * Update the unified status bar
 */
function updateStatus(message: string, type: 'info' | 'success' | 'warning' | 'error' | 'hidden'): void {
  if (type === 'hidden') {
    statusBar.classList.add('hidden');
    return;
  }
  
  statusBar.classList.remove('hidden', 'info', 'success', 'warning', 'error');
  statusBar.classList.add(type);
  statusMessage.textContent = message;
}

/**
 * Set visual feedback on a specific element
 */
function setVisualFeedback(target: 'input' | 'button', status: 'success' | 'warning' | 'error' | 'neutral'): void {
  // Reset both first to ensure exclusivity
  doiInput.classList.remove('valid', 'invalid');
  detectBtn.classList.remove('success', 'warning', 'error');

  if (status === 'neutral') return;

  if (target === 'input') {
    if (status === 'success') doiInput.classList.add('valid');
    if (status === 'error') doiInput.classList.add('invalid');
  } else if (target === 'button') {
    detectBtn.classList.add(status);
  }
}

/**
 * Show error message
 */
function showError(message: string): void {
  updateStatus(message, 'error');
  outputSection.classList.add("hidden");
}

/**
 * Hide error message
 */
function hideError(): void {
  updateStatus('', 'hidden');
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
    updateStatus("Scanning page for DOI...", "info");
    
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
      updateStatus("PDF detected - extracting DOI...", "info");
      
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
            updateStatus("Loading PDF content...", "info");
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
          updateStatus("Cannot access PDF (try Batch Mode upload)", "warning");
          setVisualFeedback('button', 'warning');
        } else if (errorMsg.includes("file://")) {
          updateStatus("Local PDF access restricted (use Batch Mode)", "warning");
          setVisualFeedback('button', 'warning');
        } else {
          updateStatus("DOI not found in PDF (enter manually)", "warning");
          setVisualFeedback('button', 'warning');
        }
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
      updateStatus("Connection failed (please refresh page)", "error");
      setVisualFeedback('button', 'error');
      return;
    }
    
    const result = response.payload;
    
    // If PDF is pending (text layer not loaded), retry after delay
    if (result && (result as any).pendingPDF) {
      updateStatus("Loading PDF content...", "info");
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      try {
        const retryResponse: ExtensionMessage<DOIDetectionResult> = await browserAPI.tabs.sendMessage(tab.id, {
          type: MessageType.DETECT_DOI
        }, { frameId: 0 });
        
        const retryResult = retryResponse.payload;
        
        if (!retryResult || retryResult.dois.length === 0) {
          updateStatus("No DOI found in PDF document", "warning");
          setVisualFeedback('button', 'warning');
          detectedDOIs = [];
          doiInput.value = "";
          return;
        }
        
        // Use retry result
        processDetectionResult(retryResult);
        return;
      } catch (retryError) {
        console.error("FlowRef popup: Retry failed:", retryError);
        updateStatus("PDF extraction failed", "error");
        setVisualFeedback('button', 'error');
        return;
      }
    }
    
    if (!result || result.dois.length === 0) {
      updateStatus("No DOI found on page", "warning");
      setVisualFeedback('button', 'warning');
      detectedDOIs = [];
      doiInput.value = "";
      return;
    }
    
    processDetectionResult(result);
  } catch (error) {
    console.error("Failed to detect DOI:", error);
    updateStatus(`Error: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
    setVisualFeedback('button', 'error');
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
    
    updateStatus("Analyzing PDF text...", "info");
    
    // Extract DOI using PDF.js
    const doi = await extractDOIFromPDF(arrayBuffer);
    
    if (doi) {
      // Normalize to remove any spaces that might have been extracted
      const normalized = normalizeDOI(doi);
      if (normalized) {
        detectedDOIs = [normalized];
        doiInput.value = normalized;
        updateStatus("DOI successfully extracted from PDF", "success");
        setVisualFeedback('button', 'success');
        doiSelect.classList.add("hidden");
        doiInput.classList.remove("hidden");
      } else {
        updateStatus("Invalid DOI format in PDF", "warning");
        setVisualFeedback('button', 'warning');
      }
    } else {
      updateStatus("No DOI found in PDF", "warning");
      setVisualFeedback('button', 'warning');
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
    updateStatus(`DOI detected via ${result.source}`, "success");
    setVisualFeedback('button', 'success');
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
    
    // Add "Enter manually" option
    const manualOption = document.createElement("option");
    manualOption.value = "manual";
    manualOption.textContent = "-- Enter manually --";
    doiSelect.appendChild(manualOption);
    
    doiSelect.classList.remove("hidden");
    doiInput.classList.add("hidden");
    updateStatus(`${detectedDOIs.length} DOIs detected`, "success");
    setVisualFeedback('button', 'success');
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
 * Generate citation from DOI or URL
 */
async function generateCitation(): Promise<void> {
  hideError();
  
  const input = getCurrentDOI();
  if (!input) {
    showError("Enter a DOI or article URL");
    return;
  }
  
  showLoading();
  
  let normalizedDOI: string | null = null;
  
  // Check if input is a URL
  if (isURL(input)) {
    try {
      // Fetch DOI from URL
      normalizedDOI = await fetchDOIFromURL(input);
      if (!normalizedDOI) {
        showError("Could not extract DOI from URL");
        hideLoading();
        return;
      }
    } catch (error) {
      showError("URL fetch failed (check connection)");
      hideLoading();
      return;
    }
  } else {
    // Normalize and validate as DOI
    normalizedDOI = normalizeDOI(input);
    if (!normalizedDOI || !isValidDOI(normalizedDOI)) {
      showError("Invalid DOI format");
      hideLoading();
      return;
    }
  }
  
  try {
    // Fetch metadata
    const result = await fetchMetadata(normalizedDOI);
    
    if (!result.success || !result.data) {
      showError(result.error || "Metadata retrieval failed");
      hideLoading();
      return;
    }
    
    currentMetadata = result.data;
    
    // Get selected style
    const style = stylePicker.getSelectedStyle() as CitationStyle;
    
    // Format citations using CSL
    const reference = formatReference(currentMetadata, style, 1);
    const intextParens = formatInTextParenthetical(currentMetadata, style, 1);
    const intextNarrative = formatInTextNarrative(currentMetadata, style, 1);
    
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
    showError("An unexpected error occurred");
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
  if (doiSelect.value === "manual") {
    // Switch to manual entry mode
    doiSelect.classList.add("hidden");
    doiInput.classList.remove("hidden");
    doiInput.value = "";
    doiInput.focus();
    updateStatus("", "hidden");
    setVisualFeedback('input', 'neutral');
  } else if (doiSelect.value) {
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
 * Initialize style picker
 */
function initializeStylePicker(): void {
  stylePicker = new StylePicker("style-picker", "apa");
  
  // Load saved preference
  loadStylePreference();
  
  // Save preference on change
  stylePicker.onChange((styleId) => {
    saveStylePreference(styleId);
    
    // If we have metadata, regenerate citation in new style
    if (currentMetadata) {
      generateCitation();
    }
  });
}

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
 * Supports both DOIs and URLs
 */
function validateDOIInput(): void {
  const value = doiInput.value.trim();
  
  // Clear feedback if empty
  if (!value) {
    updateStatus("", "hidden");
    setVisualFeedback('input', 'neutral');
    return;
  }
  
  // Don't validate if too short
  if (value.length < 5) {
    updateStatus("", "hidden");
    setVisualFeedback('input', 'neutral');
    return;
  }
  
  // Check if it's a URL
  if (isURL(value)) {
    // Show info that we'll fetch it
    updateStatus("URL detected - ready to extract DOI", "success");
    setVisualFeedback('input', 'success');
  } else {
    // Normalize and validate as DOI
    const normalized = normalizeDOI(value);
    
    if (normalized && isValidDOI(normalized)) {
      updateStatus("Valid DOI format", "success");
      setVisualFeedback('input', 'success');
    } else {
      updateStatus("Invalid DOI format (expected 10.xxxx/...)", "error");
      setVisualFeedback('input', 'error');
    }
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
  // Note: The main change handler is already attached above
  
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
initializeStylePicker();
init();
