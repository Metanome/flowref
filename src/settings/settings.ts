/**
 * Settings page for FlowRef extension
 */

const storageAPI = (typeof (window as any).browser !== "undefined") ? (window as any).browser : chrome;

// DOM Elements
const defaultStyleSelect = document.getElementById("default-style") as HTMLSelectElement;
const autoDetectCheckbox = document.getElementById("auto-detect-doi") as HTMLInputElement;
const cacheDurationInput = document.getElementById("cache-duration") as HTMLInputElement;
const enableCachingCheckbox = document.getElementById("enable-caching") as HTMLInputElement;
const clearCacheBtn = document.getElementById("clear-cache-btn") as HTMLButtonElement;
const maxRetriesInput = document.getElementById("max-retries") as HTMLInputElement;
const initialDelayInput = document.getElementById("initial-delay") as HTMLInputElement;
const rateLimitDelayInput = document.getElementById("rate-limit-delay") as HTMLInputElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
const resetBtn = document.getElementById("reset-btn") as HTMLButtonElement;
const notification = document.getElementById("notification") as HTMLDivElement;

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
  defaultStyleSelect.value = currentSettings.citationStyle;
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
      citationStyle: defaultStyleSelect.value,
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
 * Clear cache
 */
async function clearCache(): Promise<void> {
  if (confirm("Are you sure you want to clear all cached metadata?")) {
    try {
      const allData = await storageAPI.storage.local.get(null);
      const cacheKeys = Object.keys(allData).filter(key => key.startsWith("doi_cache_"));
      
      if (cacheKeys.length > 0) {
        await storageAPI.storage.local.remove(cacheKeys);
        showNotification(`Cleared ${cacheKeys.length} cached entries`, "success");
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
 * Show notification
 */
function showNotification(message: string, type: "success" | "error" | "info" = "info"): void {
  notification.textContent = message;
  notification.className = `notification notification-${type} show`;
  
  setTimeout(() => {
    notification.classList.remove("show");
  }, 3000);
}

// Event listeners
saveBtn.addEventListener("click", saveSettings);
resetBtn.addEventListener("click", resetSettings);
clearCacheBtn.addEventListener("click", clearCache);

// Load settings on page load
loadSettings();
