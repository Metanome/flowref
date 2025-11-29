/**
 * CSL Repository Integration
 * Fetches the full list of 9,000+ CSL citation styles from the official repository
 * Uses Git Tree API to avoid GitHub's 1,000 file directory listing limit
 */

import { StyleInfo } from "./styles";

// Use Git Tree API to get ALL files (not limited to 1,000)
// Note: Using v1.0.2 branch as recommended by CSL project for stable distribution
const CSL_TREE_API = "https://api.github.com/repos/citation-style-language/styles/git/trees/v1.0.2?recursive=1";
const CACHE_KEY = "csl_all_styles";
const CACHE_EXPIRY_KEY = "csl_all_styles_expiry";
const ENRICHED_CACHE_KEY = "csl_enriched_metadata";
const ENRICHED_CACHE_EXPIRY_KEY = "csl_enriched_metadata_expiry";

export interface AllStylesResult {
  styles: StyleInfo[];
  cached: boolean;
  totalCount: number;
}

interface CSLMetadata {
  title?: string;
  citationFormat?: "author-date" | "numeric" | "label" | "note" | "author";
  field?: string;
  isDependent?: boolean;
}

/**
 * Fetch all CSL styles from the repository
 * Uses caching to avoid repeated network requests
 */
export async function fetchAllStyles(): Promise<AllStylesResult> {
  // Get cache settings
  const settings = await getSettings();
  
  // Check cache first (if caching is enabled)
  if (settings.enableCaching) {
    const cached = await getCachedStyles(settings.cacheDurationHours);
    if (cached) {
      // Try to load enriched metadata from cache
      await loadEnrichedMetadata(cached, settings.cacheDurationHours);
      
      return {
        styles: cached,
        cached: true,
        totalCount: cached.length
      };
    }
  }

  // Fetch from GitHub Git Tree API (can handle 9,000+ files)
  try {
    const response = await fetch(CSL_TREE_API);
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Check if tree was truncated (shouldn't happen with Git Tree API, but check anyway)
    if (data.truncated) {
      console.warn("CSL repository tree was truncated. Some styles may be missing.");
    }

    // Filter for .csl files (include both independent and dependent styles)
    // Independent styles: root level files (e.g., "apa.csl")
    // Dependent styles: in dependent/ folder (e.g., "dependent/nature-neuroscience.csl")
    // Exclude: test files, build files, documentation, etc.
    const styleFiles = data.tree.filter((file: any) => {
      if (file.type !== "blob") return false;
      if (!file.path.endsWith(".csl")) return false;
      
      const path = file.path.toLowerCase();
      
      // Exclude test files and other non-style files
      if (path.includes("test")) return false;
      if (path.includes("spec")) return false;
      if (path.includes("example")) return false;
      if (path.includes("template")) return false;
      
      // Include only:
      // 1. Root level independent styles (e.g., "apa.csl")
      // 2. Styles in dependent/ folder (e.g., "dependent/nature.csl")
      const isRootLevel = !file.path.includes("/");
      const isDependent = file.path.startsWith("dependent/") && 
                         file.path.split("/").length === 2; // Only direct children of dependent/
      
      return isRootLevel || isDependent;
    });

    // Convert to StyleInfo format
    const styles: StyleInfo[] = styleFiles.map((file: any) => {
      // file.path can be:
      // - "apa.csl" (independent style)
      // - "dependent/nature-neuroscience.csl" (dependent style)
      const filename = file.path.split('/').pop(); // Get just the filename
      const id = filename.replace(".csl", "");
      const name = formatStyleName(id);
      const isDependent = file.path.startsWith("dependent/");
      
      return {
        id: isDependent ? `dependent/${id}` : id, // Preserve path for dependent styles
        name,
        category: "All Styles",
        isDependent
      };
    });

    // Fetch metadata for popular independent styles (async, non-blocking)
    // This enriches the display without slowing down the initial load
    enrichStylesWithMetadata(styles).catch((err: Error) => 
      console.warn("Failed to enrich styles with metadata:", err)
    );

    // Sort alphabetically
    styles.sort((a, b) => a.name.localeCompare(b.name));

    // Count independent vs dependent styles
    const independentCount = styles.filter(s => !s.id.startsWith("dependent/")).length;
    const dependentCount = styles.filter(s => s.id.startsWith("dependent/")).length;
    
    console.log(`✓ Fetched ${styles.length} CSL styles from repository`);
    console.log(`  - ${independentCount} independent styles`);
    console.log(`  - ${dependentCount} dependent styles`);

    // Cache the results (if caching is enabled)
    if (settings.enableCaching) {
      await cacheStyles(styles, settings.cacheDurationHours);
    }

    return {
      styles,
      cached: false,
      totalCount: styles.length
    };

  } catch (error) {
    console.error("Failed to fetch CSL styles:", error);
    throw new Error("Could not load style list. Please try again.");
  }
}

/**
 * Fetch CSL metadata from raw file
 * Parses XML to extract title, citation-format, and field
 */
async function fetchStyleMetadata(path: string): Promise<CSLMetadata> {
  try {
    const rawUrl = `https://raw.githubusercontent.com/citation-style-language/styles/v1.0.2/${path}`;
    const response = await fetch(rawUrl);
    if (!response.ok) return {};
    
    const xml = await response.text();
    
    // Parse XML for metadata (simple string parsing to avoid heavy XML parser)
    const metadata: CSLMetadata = {};
    
    // Check if dependent style
    metadata.isDependent = xml.includes('<link href=') && xml.includes('rel="independent-parent"');
    
    // Extract title
    const titleMatch = xml.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      metadata.title = titleMatch[1].trim();
    }
    
    // Extract citation-format
    const formatMatch = xml.match(/citation-format="([^"]+)"/);
    if (formatMatch) {
      metadata.citationFormat = formatMatch[1] as any;
    }
    
    // Extract field
    const fieldMatch = xml.match(/<category[^>]+field="([^"]+)"/);
    if (fieldMatch) {
      metadata.field = fieldMatch[1];
    }
    
    return metadata;
  } catch (error) {
    console.warn(`Failed to fetch metadata for ${path}:`, error);
    return {};
  }
}

/**
 * Enrich popular styles with metadata (async, non-blocking)
 * Only enriches styles that are in the POPULAR_STYLES list
 */
async function enrichStylesWithMetadata(styles: StyleInfo[]): Promise<void> {
  // Import POPULAR_STYLES to get the list of IDs we care about
  const { POPULAR_STYLES } = await import("./styles");
  const popularStyleIds = new Set(POPULAR_STYLES.map(s => s.id));
  
  // Filter to only styles that are in our popular list
  const stylesToEnrich = styles.filter(s => popularStyleIds.has(s.id));
  
  console.log(`Fetching metadata for ${stylesToEnrich.length} popular styles in browse list...`);
  
  // Import category helper
  const { getCategory } = await import("./styles");
  
  // Fetch metadata in parallel (limit to avoid rate limiting)
  const batchSize = 10;
  for (let i = 0; i < stylesToEnrich.length; i += batchSize) {
    const batch = stylesToEnrich.slice(i, i + batchSize);
    await Promise.all(batch.map(async (style) => {
      const path = style.id + ".csl";
      const metadata = await fetchStyleMetadata(path);
      
      // Update style object
      if (metadata.title) style.name = metadata.title;
      if (metadata.citationFormat) style.citationFormat = metadata.citationFormat;
      if (metadata.field) {
        style.field = metadata.field;
        style.category = getCategory(metadata.field); // Auto-generate category
      }
    }));
    
    // Small delay between batches to be respectful to GitHub
    if (i + batchSize < stylesToEnrich.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`✓ Enriched ${stylesToEnrich.length} popular styles with metadata`);
  
  // Cache enriched metadata
  await cacheEnrichedMetadata(stylesToEnrich);
}

/**
 * Enrich popular styles with real CSL metadata
 * This ensures popular styles show the same names as when browsing all styles
 */
export async function enrichPopularStyles(styles: StyleInfo[]): Promise<void> {
  console.log(`Fetching metadata for ${styles.length} popular styles...`);
  
  // Import category helper
  const { getCategory } = await import("./styles");
  
  const batchSize = 10;
  for (let i = 0; i < styles.length; i += batchSize) {
    const batch = styles.slice(i, i + batchSize);
    await Promise.all(batch.map(async (style) => {
      const path = style.id + ".csl";
      const metadata = await fetchStyleMetadata(path);
      
      // Update style object with real CSL title and auto-generated category
      if (metadata.title) style.name = metadata.title;
      if (metadata.citationFormat) style.citationFormat = metadata.citationFormat;
      if (metadata.field) {
        style.field = metadata.field;
        style.category = getCategory(metadata.field); // Auto-generate category
      }
    }));
    
    // Small delay between batches
    if (i + batchSize < styles.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`✓ Enriched ${styles.length} popular styles with CSL metadata`);
  
  // Cache enriched metadata
  await cacheEnrichedMetadata(styles);
}

/**
 * Cache enriched metadata for styles
 */
async function cacheEnrichedMetadata(styles: StyleInfo[]): Promise<void> {
  try {
    const browserAPI = (typeof browser !== "undefined") ? browser : chrome;
    const settings = await getSettings();
    
    if (!settings.enableCaching) return;
    
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + settings.cacheDurationHours);
    
    // Store only enriched metadata (id -> metadata)
    const enrichedData: Record<string, { name?: string; citationFormat?: string; field?: string; category?: string }> = {};
    styles.forEach(style => {
      if (style.citationFormat || style.field) {
        enrichedData[style.id] = {
          name: style.name,
          citationFormat: style.citationFormat,
          field: style.field,
          category: style.category // Include auto-generated category
        };
      }
    });
    
    await browserAPI.storage.local.set({
      [ENRICHED_CACHE_KEY]: enrichedData,
      [ENRICHED_CACHE_EXPIRY_KEY]: expiry.toISOString()
    });
  } catch (error) {
    console.error("Error caching enriched metadata:", error);
  }
}

/**
 * Load cached enriched metadata and apply to styles
 */
async function loadEnrichedMetadata(styles: StyleInfo[], cacheDurationHours: number): Promise<void> {
  try {
    const browserAPI = (typeof browser !== "undefined") ? browser : chrome;
    const result = await browserAPI.storage.local.get([ENRICHED_CACHE_KEY, ENRICHED_CACHE_EXPIRY_KEY]);
    
    if (!result[ENRICHED_CACHE_KEY] || !result[ENRICHED_CACHE_EXPIRY_KEY]) {
      return;
    }
    
    const expiry = new Date(result[ENRICHED_CACHE_EXPIRY_KEY]);
    if (expiry < new Date()) {
      return; // Cache expired
    }
    
    const enrichedData = result[ENRICHED_CACHE_KEY];
    let enrichedCount = 0;
    
    // Apply cached metadata to matching styles
    styles.forEach(style => {
      const cached = enrichedData[style.id];
      if (cached) {
        if (cached.name) style.name = cached.name;
        if (cached.citationFormat) style.citationFormat = cached.citationFormat;
        if (cached.field) style.field = cached.field;
        if (cached.category) style.category = cached.category; // Apply cached category
        enrichedCount++;
      }
    });
    
    if (enrichedCount > 0) {
      console.log(`✓ Loaded ${enrichedCount} enriched styles from cache`);
    }
  } catch (error) {
    console.error("Error loading enriched metadata:", error);
  }
}

/**
 * Format style ID into readable name
 * Converts kebab-case to Title Case
 */
export function formatStyleName(id: string): string {
  return id
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Get settings from storage
 */
async function getSettings(): Promise<{ enableCaching: boolean; cacheDurationHours: number }> {
  try {
    const browserAPI = (typeof browser !== "undefined") ? browser : chrome;
    const result = await browserAPI.storage.sync.get(["enableCaching", "cacheDurationHours"]);
    return {
      enableCaching: result.enableCaching ?? true,
      cacheDurationHours: result.cacheDurationHours ?? 24
    };
  } catch (error) {
    console.error("Error reading settings:", error);
    return { enableCaching: true, cacheDurationHours: 24 };
  }
}

/**
 * Get cached styles from browser storage
 */
async function getCachedStyles(cacheDurationHours: number): Promise<StyleInfo[] | null> {
  try {
    const browserAPI = (typeof browser !== "undefined") ? browser : chrome;
    const result = await browserAPI.storage.local.get([CACHE_KEY, CACHE_EXPIRY_KEY]);
    
    if (!result[CACHE_KEY] || !result[CACHE_EXPIRY_KEY]) {
      return null;
    }

    const expiry = new Date(result[CACHE_EXPIRY_KEY]);
    if (expiry < new Date()) {
      // Cache expired
      return null;
    }

    return result[CACHE_KEY];
  } catch (error) {
    console.error("Error reading cache:", error);
    return null;
  }
}

/**
 * Cache styles in browser storage
 */
async function cacheStyles(styles: StyleInfo[], cacheDurationHours: number): Promise<void> {
  try {
    const browserAPI = (typeof browser !== "undefined") ? browser : chrome;
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + cacheDurationHours);

    await browserAPI.storage.local.set({
      [CACHE_KEY]: styles,
      [CACHE_EXPIRY_KEY]: expiry.toISOString()
    });
  } catch (error) {
    console.error("Error caching styles:", error);
    // Non-fatal, continue without caching
  }
}

/**
 * Clear cached styles (for testing or manual refresh)
 */
export async function clearStylesCache(): Promise<void> {
  try {
    const browserAPI = (typeof browser !== "undefined") ? browser : chrome;
    await browserAPI.storage.local.remove([CACHE_KEY, CACHE_EXPIRY_KEY]);
  } catch (error) {
    console.error("Error clearing cache:", error);
  }
}

/**
 * Search through all styles
 */
export function searchAllStyles(styles: StyleInfo[], query: string): StyleInfo[] {
  if (!query || query.trim().length < 2) {
    return styles;
  }

  const lowerQuery = query.toLowerCase();
  return styles.filter(style =>
    style.name.toLowerCase().includes(lowerQuery) ||
    style.id.toLowerCase().includes(lowerQuery)
  );
}
