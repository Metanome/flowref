/**
 * Settings page for FlowRef extension
 */

import { StylePicker } from "../core/stylePicker";
import { initializePopularStyles } from "../core/styles";

const storageAPI = (typeof (window as any).browser !== "undefined") ? (window as any).browser : chrome;

// Initialize popular styles with real CSL metadata (async, non-blocking)
initializePopularStyles();

// DOM Elements
let defaultStylePicker: StylePicker;
const autoDetectCheckbox = document.getElementById("auto-detect-doi") as HTMLInputElement;
const cacheDurationInput = document.getElementById("cache-duration") as HTMLInputElement;
const enableCachingCheckbox = document.getElementById("enable-caching") as HTMLInputElement;
const clearCacheBtn = document.getElementById("clear-cache-btn") as HTMLButtonElement;
const cacheStatsEl = document.getElementById("cache-stats") as HTMLParagraphElement;
const maxRetriesInput = document.getElementById("max-retries") as HTMLInputElement;
const initialDelayInput = document.getElementById("initial-delay") as HTMLInputElement;
const rateLimitDelayInput = document.getElementById("rate-limit-delay") as HTMLInputElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
const resetBtn = document.getElementById("reset-btn") as HTMLButtonElement;
const notification = document.getElementById("notification") as HTMLDivElement;
const advancedHeader = document.getElementById("advanced-header") as HTMLDivElement;
const advancedBody = document.getElementById("advanced-body") as HTMLDivElement;

/**
 * Default settings
 */
const DEFAULT_SETTINGS = {
  citationStyle: "apa",
  autoDetectDOI: true,
  cacheDurationHours: 24,
  enableCaching: true,
  maxRetries: 3,
  initialRetryDelay: 1,
  rateLimitDelay: 4
};

/**
 * Validate and show feedback for number input
 */
function validateInput(input: HTMLInputElement, min: number, max: number): boolean {
  const value = parseFloat(input.value);
  const validationIcon = document.getElementById(`${input.id}-validation`) as HTMLSpanElement;
  
  if (isNaN(value) || value < min || value > max) {
    input.classList.add("invalid");
    input.classList.remove("valid");
    if (validationIcon) {
      validationIcon.classList.add("invalid");
      validationIcon.classList.remove("valid");
    }
    return false;
  } else {
    input.classList.add("valid");
    input.classList.remove("invalid");
    if (validationIcon) {
      validationIcon.classList.add("valid");
      validationIcon.classList.remove("invalid");
    }
    return true;
  }
}

/**
 * Current settings
 */
interface Settings {
  citationStyle: string;
  autoDetectDOI: boolean;
  cacheDurationHours: number;
  enableCaching: boolean;
  maxRetries: number;
  initialRetryDelay: number;
  rateLimitDelay: number;
}

let currentSettings: Settings = { ...DEFAULT_SETTINGS };

/**
 * Load settings from storage
 */
async function loadSettings(): Promise<void> {
  try {
    const result = await storageAPI.storage.local.get([
      "citationStyle",
      "autoDetectDOI",
      "cacheDurationHours",
      "enableCaching",
      "maxRetries",
      "initialRetryDelay",
      "rateLimitDelay"
    ]);

    currentSettings = {
      citationStyle: result.citationStyle || DEFAULT_SETTINGS.citationStyle,
      autoDetectDOI: result.autoDetectDOI !== undefined ? result.autoDetectDOI : DEFAULT_SETTINGS.autoDetectDOI,
      cacheDurationHours: result.cacheDurationHours || DEFAULT_SETTINGS.cacheDurationHours,
      enableCaching: result.enableCaching !== undefined ? result.enableCaching : DEFAULT_SETTINGS.enableCaching,
      maxRetries: result.maxRetries !== undefined ? result.maxRetries : DEFAULT_SETTINGS.maxRetries,
      initialRetryDelay: result.initialRetryDelay || DEFAULT_SETTINGS.initialRetryDelay,
      rateLimitDelay: result.rateLimitDelay || DEFAULT_SETTINGS.rateLimitDelay
    };

    updateUI();
  } catch (error) {
    console.error("Error loading settings:", error);
    showNotification("Error loading settings", "error");
  }
}

/**
 * Update UI with current settings
 */
function updateUI(): void {
  if (!defaultStylePicker) {
    defaultStylePicker = new StylePicker("default-style", currentSettings.citationStyle);
  } else {
    defaultStylePicker.setSelectedStyle(currentSettings.citationStyle);
  }
  autoDetectCheckbox.checked = currentSettings.autoDetectDOI;
  cacheDurationInput.value = currentSettings.cacheDurationHours.toString();
  enableCachingCheckbox.checked = currentSettings.enableCaching;
  maxRetriesInput.value = currentSettings.maxRetries.toString();
  initialDelayInput.value = currentSettings.initialRetryDelay.toString();
  rateLimitDelayInput.value = currentSettings.rateLimitDelay.toString();
}

/**
 * Save settings to storage
 */
async function saveSettings(): Promise<void> {
  try {
    // Validate inputs
    const cacheDuration = parseInt(cacheDurationInput.value, 10);
    const maxRetries = parseInt(maxRetriesInput.value, 10);
    const initialDelay = parseFloat(initialDelayInput.value);
    const rateLimitDelay = parseFloat(rateLimitDelayInput.value);

    if (cacheDuration < 1 || cacheDuration > 168) {
      showNotification("Cache duration must be between 1 and 168 hours", "error");
      return;
    }

    if (maxRetries < 0 || maxRetries > 10) {
      showNotification("Max retries must be between 0 and 10", "error");
      return;
    }

    if (initialDelay < 1 || initialDelay > 10) {
      showNotification("Initial delay must be between 1 and 10 seconds", "error");
      return;
    }

    if (rateLimitDelay < 1 || rateLimitDelay > 30) {
      showNotification("Rate limit delay must be between 1 and 30 seconds", "error");
      return;
    }

    currentSettings = {
      citationStyle: defaultStylePicker.getSelectedStyle(),
      autoDetectDOI: autoDetectCheckbox.checked,
      cacheDurationHours: cacheDuration,
      enableCaching: enableCachingCheckbox.checked,
      maxRetries: maxRetries,
      initialRetryDelay: initialDelay,
      rateLimitDelay: rateLimitDelay
    };

    await storageAPI.storage.local.set(currentSettings);
    showNotification("Settings saved successfully", "success");
  } catch (error) {
    console.error("Error saving settings:", error);
    showNotification("Error saving settings", "error");
  }
}

/**
 * Reset settings to defaults
 */
async function resetSettings(): Promise<void> {
  if (confirm("Are you sure you want to reset all settings to defaults?")) {
    try {
      currentSettings = { ...DEFAULT_SETTINGS };
      await storageAPI.storage.local.set(currentSettings);
      updateUI();
      showNotification("Settings reset to defaults", "success");
    } catch (error) {
      console.error("Error resetting settings:", error);
      showNotification("Error resetting settings", "error");
    }
  }
}

/**
 * Update cache statistics display
 */
async function updateCacheStats(): Promise<void> {
  try {
    const allData = await storageAPI.storage.local.get(null);
    const cacheKeys = Object.keys(allData).filter(key => 
      key.startsWith("doi_cache_") || 
      key.startsWith("csl_") ||
      key.includes("styles") ||
      key.includes("enriched")
    );
    
    if (cacheKeys.length > 0) {
      cacheStatsEl.textContent = `${cacheKeys.length} cached entries stored`;
      cacheStatsEl.style.color = "#5f6368";
    } else {
      cacheStatsEl.textContent = "No cached data";
      cacheStatsEl.style.color = "#9aa0a6";
    }
  } catch (error) {
    console.error("Error reading cache stats:", error);
    cacheStatsEl.textContent = "Unable to read cache statistics";
  }
}

/**
 * Clear cache
 */
async function clearCache(): Promise<void> {
  if (confirm("Are you sure you want to clear all cached data (DOI metadata, CSL styles, and enriched metadata)?")) {
    try {
      const allData = await storageAPI.storage.local.get(null);
      // Include DOI cache, CSL styles cache, and enriched metadata cache
      const cacheKeys = Object.keys(allData).filter(key => 
        key.startsWith("doi_cache_") || 
        key.startsWith("csl_") ||
        key.includes("styles") ||
        key.includes("enriched")
      );
      
      if (cacheKeys.length > 0) {
        await storageAPI.storage.local.remove(cacheKeys);
        await updateCacheStats(); // Update stats after clearing
        showNotification(`Cleared ${cacheKeys.length} cached entries (DOI + CSL styles)`, "success");
      } else {
        showNotification("No cached entries found", "info");
      }
    } catch (error) {
      console.error("Error clearing cache:", error);
      showNotification("Error clearing cache", "error");
    }
  }
}

/**
 * Toggle advanced settings section
 */
function toggleAdvancedSettings(): void {
  const isCollapsed = advancedBody.classList.contains("collapsed");
  
  if (isCollapsed) {
    advancedBody.classList.remove("collapsed");
    advancedHeader.classList.add("expanded");
  } else {
    advancedBody.classList.add("collapsed");
    advancedHeader.classList.remove("expanded");
  }
}

/**
 * Show notification
 */
function showNotification(message: string, type: "success" | "error" | "info" = "info"): void {
  notification.textContent = message;
  notification.className = `notification notification-${type} show`;
  
  setTimeout(() => {
    notification.classList.remove("show");
  }, 3000);
}

// Input validation listeners
cacheDurationInput.addEventListener("input", () => validateInput(cacheDurationInput, 1, 168));
maxRetriesInput.addEventListener("input", () => validateInput(maxRetriesInput, 0, 10));
initialDelayInput.addEventListener("input", () => validateInput(initialDelayInput, 1, 10));
rateLimitDelayInput.addEventListener("input", () => validateInput(rateLimitDelayInput, 1, 30));

// Validate on blur to ensure final value is valid
cacheDurationInput.addEventListener("blur", () => {
  if (!validateInput(cacheDurationInput, 1, 168)) {
    cacheDurationInput.value = String(DEFAULT_SETTINGS.cacheDurationHours);
    validateInput(cacheDurationInput, 1, 168);
  }
});

maxRetriesInput.addEventListener("blur", () => {
  if (!validateInput(maxRetriesInput, 0, 10)) {
    maxRetriesInput.value = String(DEFAULT_SETTINGS.maxRetries);
    validateInput(maxRetriesInput, 0, 10);
  }
});

initialDelayInput.addEventListener("blur", () => {
  if (!validateInput(initialDelayInput, 1, 10)) {
    initialDelayInput.value = String(DEFAULT_SETTINGS.initialRetryDelay);
    validateInput(initialDelayInput, 1, 10);
  }
});

rateLimitDelayInput.addEventListener("blur", () => {
  if (!validateInput(rateLimitDelayInput, 1, 30)) {
    rateLimitDelayInput.value = String(DEFAULT_SETTINGS.rateLimitDelay);
    validateInput(rateLimitDelayInput, 1, 30);
  }
});

// Event listeners
saveBtn.addEventListener("click", saveSettings);
resetBtn.addEventListener("click", resetSettings);
clearCacheBtn.addEventListener("click", clearCache);
advancedHeader.addEventListener("click", toggleAdvancedSettings);

// Load settings and cache stats on page load
loadSettings();
updateCacheStats();
