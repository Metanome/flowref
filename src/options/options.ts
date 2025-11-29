/**
 * Options page (Batch mode) for FlowRef
 */

import { normalizeDOI, isValidDOI, isURL, fetchDOIFromURL } from "../core/doi";
import { fetchMetadata } from "../core/metadata";
import { formatReference } from "../core/formatters/csl";
import { formatBibTeX } from "../core/formatters/bibtex";
import { copyToClipboard, showNotification } from "../core/clipboard";
import { BatchEntry, CitationStyle } from "../core/types";
import { processPDFFile } from "../core/pdf";
import { StylePicker } from "../core/stylePicker";
import { initializePopularStyles } from "../core/styles";

// Initialize popular styles with real CSL metadata (async, non-blocking)
initializePopularStyles();

// DOM elements
const doiListInput = document.getElementById("doi-list") as HTMLTextAreaElement;
let batchStylePicker: StylePicker;
const processBtn = document.getElementById("process-btn") as HTMLButtonElement;
const loading = document.getElementById("loading") as HTMLDivElement;
const resultsSection = document.getElementById("results-section") as HTMLElement;
const resultsContainer = document.getElementById("results-container") as HTMLDivElement;
const copyAllBtn = document.getElementById("copy-all-btn") as HTMLButtonElement;
const downloadBibBtn = document.getElementById("download-bib-btn") as HTMLButtonElement;
const retryFailedBtn = document.getElementById("retry-failed-btn") as HTMLButtonElement;
const clearAllBtn = document.getElementById("clear-all-btn") as HTMLButtonElement;
const cancelBtn = document.getElementById("cancel-btn") as HTMLButtonElement;
const resultsCount = document.getElementById("results-count") as HTMLSpanElement;

// Tab elements
const tabTextBtn = document.getElementById("tab-text") as HTMLButtonElement;
const tabPdfBtn = document.getElementById("tab-pdf") as HTMLButtonElement;
const textInputTab = document.getElementById("text-input-tab") as HTMLDivElement;
const pdfUploadTab = document.getElementById("pdf-upload-tab") as HTMLDivElement;
const uploadArea = document.getElementById("upload-area") as HTMLDivElement;
const pdfInput = document.getElementById("pdf-input") as HTMLInputElement;
const pdfList = document.getElementById("pdf-list") as HTMLDivElement;
const settingsLink = document.getElementById("settings-link") as HTMLAnchorElement;

// State
let batchEntries: BatchEntry[] = [];
let pdfFiles: File[] = [];
let activeTab: "text" | "pdf" = "text";
let abortController: AbortController | null = null;
/**
 * Show loading indicator
 */
function showLoading(): void {
  loading.classList.remove("hidden");
  processBtn.disabled = true;
}

/**
 * Hide loading indicator
 */
function hideLoading(): void {
  loading.classList.add("hidden");
  processBtn.disabled = false;
}

/**
 * Parse DOI list from textarea
 */
function parseDOIList(text: string): string[] {
  return text
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

/**
 * Check for duplicate DOIs in the list
 * Returns object with unique DOIs and duplicate info
 */
function checkDuplicates(dois: string[]): { 
  unique: string[]; 
  duplicates: Array<{ doi: string; lines: number[] }> 
} {
  const normalized = dois.map(doi => normalizeDOI(doi) || doi);
  const seen = new Map<string, number[]>();
  const duplicates: Array<{ doi: string; lines: number[] }> = [];
  
  normalized.forEach((doi, idx) => {
    const key = doi.toLowerCase();
    if (seen.has(key)) {
      seen.get(key)!.push(idx + 1);
    } else {
      seen.set(key, [idx + 1]);
    }
  });
  
  // Find duplicates
  seen.forEach((lines, key) => {
    if (lines.length > 1) {
      // Use the first occurrence's original DOI for display
      const originalDoi = normalized[lines[0] - 1];
      duplicates.push({ doi: originalDoi, lines });
    }
  });
  
  // Return unique DOIs (first occurrence)
  const unique: string[] = [];
  const seenSet = new Set<string>();
  
  normalized.forEach((doi, idx) => {
    const key = doi.toLowerCase();
    if (!seenSet.has(key)) {
      unique.push(dois[idx]);
      seenSet.add(key);
    }
  });
  
  return { unique, duplicates };
}

/**
 * Create a result card for a batch entry
 */
function createResultCard(entry: BatchEntry, index: number): HTMLElement {
  const card = document.createElement("div");
  card.className = "result-item";
  
  if (entry.status === "success") {
    card.classList.add("success");
  } else if (entry.status === "error") {
    card.classList.add("error");
  }
  
  // Content container
  const content = document.createElement("div");
  
  if (entry.status === "success" && entry.citation) {
    const citation = document.createElement("div");
    citation.className = "citation-text";
    citation.innerHTML = entry.citation;
    content.appendChild(citation);
  } else if (entry.status === "error" && entry.error) {
    const error = document.createElement("div");
    error.className = "citation-text";
    error.style.color = "var(--error-color)";
    error.textContent = entry.error;
    content.appendChild(error);
  } else {
    const processing = document.createElement("div");
    processing.className = "citation-text";
    processing.style.color = "var(--text-secondary)";
    processing.style.fontStyle = "italic";
    processing.textContent = "Processing...";
    content.appendChild(processing);
  }
  
  // Meta info
  const meta = document.createElement("div");
  meta.className = "citation-meta";
  
  const number = document.createElement("span");
  number.textContent = `#${index + 1}`;
  meta.appendChild(number);
  
  const doi = document.createElement("span");
  doi.textContent = entry.input;
  meta.appendChild(doi);
  
  content.appendChild(meta);
  card.appendChild(content);
  
  // Copy button (only for success)
  if (entry.status === "success" && entry.citation) {
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    copyBtn.title = "Copy citation";
    copyBtn.onclick = async () => {
      if (entry.citation) {
        await copyToClipboard(entry.citation);
        showNotification("Citation copied");
      }
    };
    card.appendChild(copyBtn);
  }
  
  return card;
}

/**
 * Update results display
 */
function updateResultsDisplay(): void {
  resultsContainer.innerHTML = "";
  
  batchEntries.forEach((entry, index) => {
    const card = createResultCard(entry, index);
    resultsContainer.appendChild(card);
  });
  
  const successCount = batchEntries.filter(e => e.status === "success").length;
  const errorCount = batchEntries.filter(e => e.status === "error").length;
  
  resultsCount.textContent = `${successCount} successful, ${errorCount} failed`;
  
  // Show/hide Retry Failed button based on whether there are failed entries
  if (errorCount > 0) {
    retryFailedBtn.style.display = "inline-block";
  } else {
    retryFailedBtn.style.display = "none";
  }
}

/**
 * Process batch of DOIs
 */
async function processBatch(): Promise<void> {
  // Create new abort controller for this batch
  abortController = new AbortController();
  
  try {
    if (activeTab === "text") {
      await processBatchText();
    } else {
      await processBatchPDF();
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Operation cancelled") {
      // Mark all pending/processing entries as cancelled
      batchEntries.forEach(entry => {
        if (entry.status === "pending" || entry.status === "processing") {
          entry.status = "error";
          entry.error = "Cancelled by user";
        }
      });
      updateResultsDisplay();
      showNotification("Processing cancelled");
    } else {
      console.error("Batch processing error:", error);
    }
  } finally {
    abortController = null;
    hideLoading();
  }
}

/**
 * Process batch from text input
 */
async function processBatchText(): Promise<void> {
  const doiList = parseDOIList(doiListInput.value);
  
  if (doiList.length === 0) {
    showNotification("Please enter at least one DOI");
    return;
  }
  
  // Check for duplicates
  const { unique, duplicates } = checkDuplicates(doiList);
  
  if (duplicates.length > 0) {
    const dupMsg = duplicates.map(d => 
      `${d.doi} (lines ${d.lines.join(", ")})`
    ).join("\n");
    
    const proceed = confirm(
      `Found ${duplicates.length} duplicate DOI(s):\n\n${dupMsg}\n\n` +
      `Only the first occurrence of each will be processed.\n\nContinue?`
    );
    
    if (!proceed) {
      return;
    }
  }
  
  // Use unique DOIs only
  const uniqueDois = duplicates.length > 0 ? unique : doiList;
  
  // Initialize batch entries
  batchEntries = uniqueDois.map(doi => ({
    input: doi,
    status: "pending" as const
  }));
  
  resultsSection.classList.remove("hidden");
  updateResultsDisplay();
  showLoading();
  
  // Process each DOI/URL
  for (let i = 0; i < batchEntries.length; i++) {
    // Check if cancelled
    if (abortController?.signal.aborted) {
      throw new Error("Operation cancelled");
    }
    
    const entry = batchEntries[i];
    entry.status = "processing";
    updateResultsDisplay();
    
    let normalizedDOI: string | null = null;
    
    // Check if input is a URL
    if (isURL(entry.input)) {
      try {
        normalizedDOI = await fetchDOIFromURL(entry.input);
        if (!normalizedDOI) {
          entry.status = "error";
          entry.error = "Could not extract DOI from URL";
          updateResultsDisplay();
          continue;
        }
      } catch (error) {
        entry.status = "error";
        entry.error = "Failed to fetch URL";
        updateResultsDisplay();
        continue;
      }
    } else {
      normalizedDOI = normalizeDOI(entry.input);
    }
    
    if (!normalizedDOI || !isValidDOI(normalizedDOI)) {
      entry.status = "error";
      entry.error = "Invalid DOI format";
      updateResultsDisplay();
      continue;
    }
    
    await processEntryWithDOI(entry, normalizedDOI, i);
    updateResultsDisplay();
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  hideLoading();
  showNotification(`Processed ${batchEntries.length} citations`);
}

/**
 * Process batch from PDF files
 */
async function processBatchPDF(): Promise<void> {
  if (pdfFiles.length === 0) {
    showNotification("Please upload at least one PDF file");
    return;
  }
  
  // Initialize batch entries
  batchEntries = pdfFiles.map(file => ({
    input: file.name,
    status: "pending" as const
  }));
  
  resultsSection.classList.remove("hidden");
  updateResultsDisplay();
  showLoading();
  
  // Track seen DOIs to detect duplicates during processing
  const seenDOIs = new Set<string>();
  
  // Process each PDF
  for (let i = 0; i < pdfFiles.length; i++) {
    // Check if cancelled
    if (abortController?.signal.aborted) {
      throw new Error("Operation cancelled");
    }
    
    const entry = batchEntries[i];
    const file = pdfFiles[i];
    
    entry.status = "processing";
    updateResultsDisplay();
    
    try {
      const result = await processPDFFile(file);
      
      if (result.doi) {
        const normalized = normalizeDOI(result.doi);
        if (normalized && isValidDOI(normalized)) {
          const normalizedLower = normalized.toLowerCase();
          // Check for duplicate DOI
          if (seenDOIs.has(normalizedLower)) {
            entry.status = "error";
            entry.error = `Duplicate DOI: ${normalized} (already processed)`;
          } else {
            seenDOIs.add(normalizedLower);
            await processEntryWithDOI(entry, normalized, i);
          }
        } else {
          entry.status = "error";
          entry.error = "Invalid DOI format extracted from PDF";
        }
      } else {
        entry.status = "error";
        entry.error = result.error || "No DOI found in PDF";
      }
    } catch (error) {
      entry.status = "error";
      entry.error = error instanceof Error ? error.message : "Failed to process PDF";
    }
    
    updateResultsDisplay();
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  hideLoading();
  showNotification(`Processed ${batchEntries.length} PDFs`);
}

/**
 * Process a single entry with a DOI
 */
async function processEntryWithDOI(entry: BatchEntry, doi: string, index: number): Promise<void> {
  try {
    const result = await fetchMetadata(doi);
    
    if (result.success && result.data) {
      entry.status = "success";
      entry.metadata = result.data;
      
      // Format citation using CSL
      const style = batchStylePicker.getSelectedStyle() as CitationStyle;
      entry.citation = formatReference(result.data, style, index + 1);
    } else {
      entry.status = "error";
      entry.error = result.error || "Failed to fetch metadata";
    }
  } catch (error) {
    entry.status = "error";
    entry.error = error instanceof Error ? error.message : "Unknown error";
  }
}

/**
 * Extract first author's last name for sorting
 */
function extractFirstAuthor(metadata: any): string {
  if (!metadata || !metadata.authors || metadata.authors.length === 0) {
    return ""; // No author, sort to beginning
  }
  
  const firstAuthor = metadata.authors[0];
  // Return family name (last name) in lowercase for case-insensitive sorting
  return (firstAuthor.family || "").toLowerCase();
}

/**
 * Copy all successful citations
 */
async function copyAllCitations(): Promise<void> {
  const style = batchStylePicker.getSelectedStyle() as CitationStyle;
  let entries = batchEntries.filter(e => e.status === "success" && e.citation);
  
  if (entries.length === 0) {
    showNotification("No citations to copy");
    return;
  }
  
  // Sort alphabetically by author last name for APA/MLA/Chicago
  if (style === "apa" || style === "mla" || style === "chicago") {
    entries = entries.sort((a, b) => {
      const authorA = extractFirstAuthor(a.metadata);
      const authorB = extractFirstAuthor(b.metadata);
      return authorA.localeCompare(authorB);
    });
  }
  // For Vancouver/IEEE, keep original order (order of appearance in text)
  
  // Apply style-specific spacing
  const separator = (style === "vancouver" || style === "ieee") ? "\n" : "\n\n";
  const citations = entries.map(e => e.citation).join(separator);
  
  if (citations) {
    await copyToClipboard(citations);
    showNotification("All citations copied");
  }
}

/**
 * Download all as BibTeX
 */
function downloadBibTeX(): void {
  const bibtexEntries = batchEntries
    .filter(e => e.status === "success" && e.metadata)
    .map(e => formatBibTeX(e.metadata!))
    .join("\n\n");
  
  if (!bibtexEntries) {
    showNotification("No successful citations to export");
    return;
  }
  
  const blob = new Blob([bibtexEntries], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "citations.bib";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showNotification("BibTeX file downloaded");
}

/**
 * Clear all entries and reset the form
 */
function clearAllEntries(): void {
  if (!confirm("Clear all entries and results? This cannot be undone.")) {
    return;
  }
  
  // Reset state
  batchEntries = [];
  pdfFiles = [];
  
  // Clear UI
  doiListInput.value = "";
  resultsContainer.innerHTML = "";
  resultsSection.classList.add("hidden");
  updatePDFList();
  
  showNotification("All entries cleared");
}

/**
 * Cancel ongoing batch operation
 */
function cancelOperation(): void {
  if (abortController) {
    abortController.abort();
  }
}

/**
 * Retry all failed entries
 */
async function retryFailed(): Promise<void> {
  const failedEntries = batchEntries.filter(e => e.status === "error");
  
  if (failedEntries.length === 0) {
    showNotification("No failed entries to retry");
    return;
  }
  
  // Create new abort controller for this retry
  abortController = new AbortController();
  
  showLoading();
  
  // Track seen DOIs from successful entries to prevent duplicates
  const seenDOIs = new Set<string>();
  batchEntries.forEach(entry => {
    if (entry.status === "success" && entry.metadata && entry.metadata.doi) {
      const normalized = normalizeDOI(entry.metadata.doi);
      if (normalized) {
        seenDOIs.add(normalized.toLowerCase());
      }
    }
  });
  
  try {
    // Reset failed entries to pending
    failedEntries.forEach(entry => {
      entry.status = "pending";
      entry.error = undefined;
    });
    updateResultsDisplay();
    
    // Re-process failed entries
    for (let i = 0; i < batchEntries.length; i++) {
      const entry = batchEntries[i];
      
      // Skip non-failed entries
      if (entry.status !== "pending") {
        continue;
      }
      
      // Check if cancelled
      if (abortController?.signal.aborted) {
        throw new Error("Operation cancelled");
      }
      
      entry.status = "processing";
      updateResultsDisplay();
      
      // For text mode - entry.input is DOI
      if (activeTab === "text") {
        const normalized = normalizeDOI(entry.input);
        if (normalized && isValidDOI(normalized)) {
          const normalizedLower = normalized.toLowerCase();
          // Check for duplicate DOI
          if (seenDOIs.has(normalizedLower)) {
            entry.status = "error";
            entry.error = `Duplicate DOI: ${normalized} (already processed)`;
          } else {
            seenDOIs.add(normalizedLower);
            await processEntryWithDOI(entry, normalized, i);
          }
        } else {
          entry.status = "error";
          entry.error = "Invalid DOI format";
        }
      } 
      // For PDF mode - need to re-extract DOI from file
      else {
        const fileIndex = batchEntries.indexOf(entry);
        if (fileIndex >= 0 && fileIndex < pdfFiles.length) {
          const file = pdfFiles[fileIndex];
          
          try {
            const result = await processPDFFile(file);
            
            if (result.doi) {
              const normalized = normalizeDOI(result.doi);
              if (normalized && isValidDOI(normalized)) {
                const normalizedLower = normalized.toLowerCase();
                // Check for duplicate DOI
                if (seenDOIs.has(normalizedLower)) {
                  entry.status = "error";
                  entry.error = `Duplicate DOI: ${normalized} (already processed)`;
                } else {
                  seenDOIs.add(normalizedLower);
                  await processEntryWithDOI(entry, normalized, i);
                }
              } else {
                entry.status = "error";
                entry.error = "Invalid DOI format extracted from PDF";
              }
            } else {
              entry.status = "error";
              entry.error = result.error || "No DOI found in PDF";
            }
          } catch (error) {
            entry.status = "error";
            entry.error = error instanceof Error ? error.message : "Failed to process PDF";
          }
        }
      }
      
      updateResultsDisplay();
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    const retriedCount = failedEntries.length;
    const successCount = failedEntries.filter(e => e.status === "success").length;
    showNotification(`Retried ${retriedCount} entries: ${successCount} succeeded`);
  } catch (error) {
    if (error instanceof Error && error.message === "Operation cancelled") {
      // Mark still-pending entries as cancelled
      batchEntries.forEach(entry => {
        if (entry.status === "pending" || entry.status === "processing") {
          entry.status = "error";
          entry.error = "Cancelled by user";
        }
      });
      updateResultsDisplay();
      showNotification("Retry cancelled");
    } else {
      console.error("Retry error:", error);
    }
  } finally {
    abortController = null;
    hideLoading();
  }
}

/**
 * Switch tab between text and PDF input
 */
function switchTab(tab: "text" | "pdf"): void {
  activeTab = tab;
  
  if (tab === "text") {
    tabTextBtn.classList.add("active");
    tabPdfBtn.classList.remove("active");
    textInputTab.classList.add("active");
    textInputTab.classList.remove("hidden");
    pdfUploadTab.classList.remove("active");
    pdfUploadTab.classList.add("hidden");
  } else {
    tabTextBtn.classList.remove("active");
    tabPdfBtn.classList.add("active");
    textInputTab.classList.remove("active");
    textInputTab.classList.add("hidden");
    pdfUploadTab.classList.add("active");
    pdfUploadTab.classList.remove("hidden");
  }
}

/**
 * Handle file input change
 */
function handleFileInput(files: FileList | null): void {
  if (!files || files.length === 0) return;
  
  // Filter for PDF files only
  const newFiles = Array.from(files).filter(file => 
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
  
  if (newFiles.length === 0) {
    showNotification("Please select PDF files only");
    return;
  }
  
  // Add to PDF files list
  pdfFiles = [...pdfFiles, ...newFiles];
  updatePDFList();
}

/**
 * Update PDF files list display
 */
function updatePDFList(): void {
  pdfList.innerHTML = "";
  
  if (pdfFiles.length === 0) {
    return;
  }
  
  pdfFiles.forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "pdf-item";
    
    const icon = document.createElement("div");
    icon.className = "pdf-icon";
    icon.textContent = "PDF";
    
    const info = document.createElement("div");
    info.className = "pdf-info";
    
    const name = document.createElement("div");
    name.className = "pdf-name";
    name.textContent = file.name;
    
    const size = document.createElement("div");
    size.className = "pdf-size";
    size.textContent = formatFileSize(file.size);
    
    info.appendChild(name);
    info.appendChild(size);
    
    const removeBtn = document.createElement("button");
    removeBtn.className = "pdf-remove";
    removeBtn.textContent = "✕";
    removeBtn.onclick = () => removePDFFile(index);
    
    item.appendChild(icon);
    item.appendChild(info);
    item.appendChild(removeBtn);
    
    pdfList.appendChild(item);
  });
}

/**
 * Remove PDF file from list
 */
function removePDFFile(index: number): void {
  pdfFiles.splice(index, 1);
  updatePDFList();
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

/**
 * Handle drag over event
 */
function handleDragOver(e: DragEvent): void {
  e.preventDefault();
  e.stopPropagation();
  uploadArea.classList.add("drag-over");
}

/**
 * Handle drag leave event
 */
function handleDragLeave(e: DragEvent): void {
  e.preventDefault();
  e.stopPropagation();
  uploadArea.classList.remove("drag-over");
}

/**
 * Handle drop event
 */
function handleDrop(e: DragEvent): void {
  e.preventDefault();
  e.stopPropagation();
  uploadArea.classList.remove("drag-over");
  
  if (e.dataTransfer?.files) {
    handleFileInput(e.dataTransfer.files);
  }
}

// Event listeners - Tabs
tabTextBtn.addEventListener("click", () => switchTab("text"));
tabPdfBtn.addEventListener("click", () => switchTab("pdf"));

// Event listeners - PDF upload
uploadArea.addEventListener("click", () => pdfInput.click());
uploadArea.addEventListener("dragover", handleDragOver);
uploadArea.addEventListener("dragleave", handleDragLeave);
uploadArea.addEventListener("drop", handleDrop);
pdfInput.addEventListener("change", () => handleFileInput(pdfInput.files));

// Event listeners - Batch processing
processBtn.addEventListener("click", processBatch);
copyAllBtn.addEventListener("click", copyAllCitations);
downloadBibBtn.addEventListener("click", downloadBibTeX);
retryFailedBtn.addEventListener("click", retryFailed);
clearAllBtn.addEventListener("click", clearAllEntries);
cancelBtn.addEventListener("click", cancelOperation);

settingsLink.addEventListener("click", (e) => {
  e.preventDefault();
  const browserAPI = (typeof browser !== "undefined") ? browser : chrome;
  browserAPI.tabs.create({ url: browserAPI.runtime.getURL("settings/settings.html") });
});

// Initialize StylePicker
const browserAPI = (typeof browser !== "undefined") ? browser : chrome;
batchStylePicker = new StylePicker("batch-style", "apa");

// Load saved style preference
browserAPI.storage.local.get("citationStyle").then((result: any) => {
  if (result.citationStyle) {
    batchStylePicker.setSelectedStyle(result.citationStyle);
  }
});

batchStylePicker.onChange((styleId) => {
  browserAPI.storage.local.set({ citationStyle: styleId });
});
