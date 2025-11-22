/**
 * Background script for FlowRef
 */

const browserAPI = (typeof browser !== "undefined") ? browser : chrome;

/**
 * Create context menu
 */
function createContextMenu() {
  // Remove existing menu items first to avoid duplicates
  browserAPI.contextMenus.removeAll(() => {
    // Create context menu for text selection and links
    browserAPI.contextMenus.create({
      id: "generate-citation",
      title: "Generate Citation from DOI",
      contexts: ["selection", "link"]
    });
    console.log("Context menu created");
  });
}

/**
 * Create context menu on installation and startup
 */
browserAPI.runtime.onInstalled.addListener(() => {
  console.log("FlowRef extension installed");
  createContextMenu();
});

// Also create context menu when background script starts
browserAPI.runtime.onStartup.addListener(() => {
  console.log("FlowRef extension started");
  createContextMenu();
});

/**
 * Extract DOI from a URL
 */
function extractDOIFromURL(url: string): string | null {
  try {
    // Match doi.org URLs: https://doi.org/10.xxxx/xxxxx
    const doiOrgMatch = url.match(/(?:dx\.)?doi\.org\/(.+?)(?:[?#]|$)/i);
    if (doiOrgMatch) {
      // Decode URI component to handle encoded characters
      let doi = decodeURIComponent(doiOrgMatch[1]);
      // Remove trailing slash if present
      doi = doi.replace(/\/$/, '');
      return doi;
    }
  } catch (e) {
    console.error("Error extracting DOI from URL:", e);
  }
  
  return null;
}

/**
 * Handle context menu clicks
 */
browserAPI.contextMenus.onClicked.addListener((info: any, tab: any) => {
  if (info.menuItemId === "generate-citation") {
    let doiText = "";
    
    // If text is selected, use that
    if (info.selectionText) {
      doiText = info.selectionText.trim();
    }
    // If it's a link, try to extract DOI from the URL
    else if (info.linkUrl) {
      const extractedDOI = extractDOIFromURL(info.linkUrl);
      if (extractedDOI) {
        doiText = extractedDOI;
      } else {
        // If not a DOI link, use the URL as-is (user might have other plans)
        doiText = info.linkUrl;
      }
    }
    
    if (doiText) {
      // Store the DOI in storage for the popup to retrieve
      browserAPI.storage.local.set({ pendingDOI: doiText }).then(() => {
        // Open the popup - try Firefox method first, fall back to opening in new tab
        if (browserAPI.action.openPopup) {
          browserAPI.action.openPopup().catch(() => {
            // If popup fails, open as a new tab/window
            browserAPI.tabs.create({ url: browserAPI.runtime.getURL("popup/popup.html") });
          });
        } else {
          // Chrome doesn't support openPopup(), so open as new tab
          browserAPI.tabs.create({ url: browserAPI.runtime.getURL("popup/popup.html") });
        }
      });
    }
  }
});

browserAPI.runtime.onMessage.addListener((message: any, sender: any, sendResponse: (response: any) => void) => {
  return false;
});
