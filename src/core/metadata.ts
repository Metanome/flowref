/**
 * Metadata fetching and normalization from citation APIs
 */

import { CitationMetadata, Author, MetadataResult, ContainerType } from "./types";

/**
 * Utility function to sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get retry settings from storage
 */
async function getRetrySettings(): Promise<{ maxRetries: number; initialDelay: number; rateLimitDelay: number }> {
  try {
    const browserAPI = (typeof browser !== "undefined") ? browser : chrome;
    const result = await browserAPI.storage.local.get(["maxRetries", "initialRetryDelay", "rateLimitDelay"]);
    return {
      maxRetries: result.maxRetries !== undefined ? result.maxRetries : 3,
      initialDelay: result.initialRetryDelay || 1,
      rateLimitDelay: result.rateLimitDelay || 4
    };
  } catch (error) {
    console.error("Error reading retry settings:", error);
    return { maxRetries: 3, initialDelay: 1, rateLimitDelay: 4 };
  }
}

/**
 * Fetch with retry logic and exponential backoff
 * Retries on network errors and 5xx server errors
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries?: number
): Promise<Response> {
  // Get settings from storage if not provided
  const settings = await getRetrySettings();
  const retries = maxRetries !== undefined ? maxRetries : settings.maxRetries;
  const initialDelay = settings.initialDelay * 1000; // Convert to ms
  const rateLimitDelay = settings.rateLimitDelay * 1000; // Convert to ms
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Success - return immediately
      if (response.ok) {
        return response;
      }
      
      // Rate limit (429) - retry with longer backoff
      if (response.status === 429 && attempt < retries) {
        const delay = Math.pow(2, attempt) * rateLimitDelay; // User-configured base delay
        console.log(`Rate limited (429), retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
        await sleep(delay);
        continue;
      }
      
      // Server error (5xx) - retry with backoff
      if (response.status >= 500 && attempt < retries) {
        const delay = Math.pow(2, attempt) * initialDelay; // User-configured base delay
        console.log(`Server error ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
        await sleep(delay);
        continue;
      }
      
      // Permanent failure (404, 400, etc.) or max retries for 429/5xx
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Network error - retry with backoff
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * initialDelay; // User-configured base delay
        console.log(`Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${retries}):`, error);
        await sleep(delay);
        continue;
      }
    }
  }
  
  throw lastError || new Error("Max retries exceeded");
}

/**
 * Fetch metadata from CrossRef API
 */
async function fetchFromCrossRef(doi: string): Promise<CitationMetadata | null> {
  try {
    const response = await fetchWithRetry(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      {
        headers: {
          "Accept": "application/json",
          "User-Agent": "FlowRef/0.2.0 (https://github.com/Metanome/flowref; mailto:metanome@proton.me)"
        }
      }
    );
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    const work = data.message;
    
    if (!work) {
      return null;
    }
    
    // Normalize authors (or editors for books with no authors)
    const hasAuthors = work.author && work.author.length > 0;
    const hasEditors = work.editor && work.editor.length > 0;
    const isEditedWork = !hasAuthors && hasEditors;
    
    let authorList = work.author || work.editor || [];
    
    const authors: Author[] = authorList.map((author: any) => ({
      given: author.given,
      family: author.family,
      full: author.given && author.family 
        ? `${author.given} ${author.family}` 
        : author.family || author.given || ""
    }));
    
    // Extract publication year
    const year = work.published?.["date-parts"]?.[0]?.[0]?.toString() || 
                 work["published-print"]?.["date-parts"]?.[0]?.[0]?.toString() ||
                 work["published-online"]?.["date-parts"]?.[0]?.[0]?.toString();
    
    // Determine container type
    let containerType: ContainerType = "other";
    const type = work.type?.toLowerCase() || "";
    if (type.includes("journal")) {
      containerType = "journal";
    } else if (type.includes("book")) {
      containerType = "book";
    } else if (type.includes("conference") || type.includes("proceedings")) {
      containerType = "conference";
    } else if (type.includes("posted-content") || type.includes("preprint")) {
      containerType = "preprint";
    }
    
    // Extract journal/container name
    const journal = work["container-title"]?.[0] || work["container-title"] || undefined;
    
    // Extract pages
    let pages: string | undefined;
    if (work.page) {
      pages = work.page;
    } else if (work["article-number"]) {
      pages = work["article-number"];
    }
    
    // Clean up publisher - sometimes it includes location without space
    let publisher = work.publisher;
    if (publisher && typeof publisher === 'string') {
      // Add space before capital letters that follow lowercase (e.g., "PressNew" -> "Press New")
      publisher = publisher.replace(/([a-z])([A-Z])/g, '$1 $2');
    }
    
    // Build metadata object
    const metadata: CitationMetadata = {
      doi: work.DOI || doi,
      title: Array.isArray(work.title) ? work.title[0] : work.title || "Untitled",
      authors: authors,
      year: year,
      journal: journal,
      volume: work.volume,
      issue: work.issue,
      pages: pages,
      url: work.URL || `https://doi.org/${doi}`,
      publisher: publisher,
      containerType: containerType,
      isEditedWork: isEditedWork
    };
    
    return metadata;
  } catch (error) {
    console.error("CrossRef API error:", error);
    return null;
  }
}

/**
 * Fetch metadata from DataCite API (fallback)
 */
async function fetchFromDataCite(doi: string): Promise<CitationMetadata | null> {
  try {
    const response = await fetchWithRetry(
      `https://api.datacite.org/dois/${encodeURIComponent(doi)}`,
      {
        headers: {
          "Accept": "application/json",
          "User-Agent": "FlowRef/0.2.0 (https://github.com/Metanome/flowref; mailto:metanome@proton.me)"
        }
      }
    );
    
    if (!response.ok) {
      return null;
    }
    
    const result = await response.json();
    const data = result.data?.attributes;
    
    if (!data) {
      return null;
    }
    
    // Normalize authors
    const authors: Author[] = (data.creators || []).map((creator: any) => {
      if (creator.givenName && creator.familyName) {
        return {
          given: creator.givenName,
          family: creator.familyName,
          full: `${creator.givenName} ${creator.familyName}`
        };
      } else if (creator.name) {
        // Try to split name
        const parts = creator.name.split(/\s+/);
        if (parts.length > 1) {
          return {
            given: parts.slice(0, -1).join(" "),
            family: parts[parts.length - 1],
            full: creator.name
          };
        } else {
          return {
            family: creator.name,
            full: creator.name
          };
        }
      }
      return { full: "Unknown" };
    });
    
    // Extract publication year
    const year = data.publicationYear?.toString() || 
                 data.published?.toString().slice(0, 4);
    
    // Determine container type
    let containerType: ContainerType = "other";
    const resourceType = data.types?.resourceType?.toLowerCase() || "";
    if (resourceType.includes("journal")) {
      containerType = "journal";
    } else if (resourceType.includes("book")) {
      containerType = "book";
    } else if (resourceType.includes("conference")) {
      containerType = "conference";
    } else if (resourceType.includes("preprint")) {
      containerType = "preprint";
    }
    
    const metadata: CitationMetadata = {
      doi: data.doi || doi,
      title: data.titles?.[0]?.title || "Untitled",
      authors: authors,
      year: year,
      journal: data.container?.title,
      publisher: data.publisher,
      url: data.url || `https://doi.org/${doi}`,
      containerType: containerType
    };
    
    return metadata;
  } catch (error) {
    console.error("DataCite API error:", error);
    return null;
  }
}

/**
 * Cache configuration
 */
const CACHE_PREFIX = "doi_cache_";

/**
 * Get cache settings from storage
 */
async function getCacheSettings(): Promise<{ enabled: boolean; durationMs: number }> {
  try {
    const browserAPI = (typeof browser !== "undefined") ? browser : chrome;
    const result = await browserAPI.storage.local.get(["enableCaching", "cacheDurationHours"]);
    return {
      enabled: result.enableCaching !== undefined ? result.enableCaching : true,
      durationMs: (result.cacheDurationHours || 24) * 60 * 60 * 1000
    };
  } catch (error) {
    console.error("Error reading cache settings:", error);
    return { enabled: true, durationMs: 24 * 60 * 60 * 1000 };
  }
}

/**
 * Get cached metadata for a DOI
 */
async function getCachedMetadata(doi: string): Promise<CitationMetadata | null> {
  try {
    const cacheSettings = await getCacheSettings();
    
    // If caching is disabled, return null immediately
    if (!cacheSettings.enabled) {
      return null;
    }
    
    const browserAPI = (typeof browser !== "undefined") ? browser : chrome;
    const cacheKey = CACHE_PREFIX + doi;
    const result = await browserAPI.storage.local.get(cacheKey);
    
    if (result[cacheKey]) {
      const cached = result[cacheKey];
      const age = Date.now() - cached.timestamp;
      
      // Check if cache is still valid (using user-configured duration)
      if (age < cacheSettings.durationMs) {
        console.log(`Cache hit for ${doi} (age: ${Math.round(age / 1000 / 60)}min)`);
        return cached.metadata;
      } else {
        // Cache expired, remove it
        console.log(`Cache expired for ${doi}`);
        await browserAPI.storage.local.remove(cacheKey);
      }
    }
  } catch (error) {
    console.error("Cache read error:", error);
  }
  
  return null;
}

/**
 * Set cached metadata for a DOI
 */
async function setCachedMetadata(doi: string, metadata: CitationMetadata): Promise<void> {
  try {
    const cacheSettings = await getCacheSettings();
    
    // If caching is disabled, don't cache
    if (!cacheSettings.enabled) {
      return;
    }
    
    const browserAPI = (typeof browser !== "undefined") ? browser : chrome;
    const cacheKey = CACHE_PREFIX + doi;
    
    await browserAPI.storage.local.set({
      [cacheKey]: {
        metadata: metadata,
        timestamp: Date.now()
      }
    });
    
    console.log(`Cached metadata for ${doi}`);
  } catch (error) {
    console.error("Cache write error:", error);
  }
}

/**
 * Fetch metadata for a DOI
 * Tries multiple sources in order: Cache, CrossRef, DataCite
 */
export async function fetchMetadata(doi: string): Promise<MetadataResult> {
  if (!doi) {
    return {
      success: false,
      error: "No DOI provided"
    };
  }
  
  // Check cache first
  const cached = await getCachedMetadata(doi);
  if (cached) {
    return {
      success: true,
      data: cached,
      source: "crossref" // Keep source as original API
    };
  }
  
  // Try CrossRef first
  let metadata = await fetchFromCrossRef(doi);
  if (metadata) {
    await setCachedMetadata(doi, metadata);
    return {
      success: true,
      data: metadata,
      source: "crossref"
    };
  }
  
  // Try DataCite as fallback
  metadata = await fetchFromDataCite(doi);
  if (metadata) {
    await setCachedMetadata(doi, metadata);
    return {
      success: true,
      data: metadata,
      source: "datacite"
    };
  }
  
  // All sources failed
  return {
    success: false,
    error: "Unable to fetch metadata from any source. The DOI may be invalid or the APIs may be unavailable."
  };
}

/**
 * Fetch metadata for multiple DOIs (batch mode)
 * Returns results in the same order as input
 */
export async function fetchMetadataBatch(dois: string[]): Promise<MetadataResult[]> {
  const results: MetadataResult[] = [];
  
  for (const doi of dois) {
    const result = await fetchMetadata(doi);
    results.push(result);
    
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}
