/**
 * Popular CSL citation styles
 * Curated list of the most commonly used styles
 */

import { formatStyleName, enrichPopularStyles } from "./cslRepository";

export interface StyleInfo {
  id: string;
  name: string;
  category: string; // Auto-generated from field attribute
  citationFormat?: "author-date" | "numeric" | "note" | "label" | "author";
  field?: string; // CSL field attribute (e.g., "medicine", "psychology")
  isDependent?: boolean;
}

/**
 * Map CSL field values to user-friendly category names
 * Based on official CSL field categories from specification
 */
export function getCategory(field?: string): string {
  if (!field) return "General";
  
  const fieldMap: Record<string, string> = {
    // Life sciences
    "medicine": "Medical",
    "biology": "Life Sciences",
    "botany": "Life Sciences",
    "zoology": "Life Sciences",
    
    // Physical sciences
    "chemistry": "Chemistry",
    "physics": "Physics",
    "astronomy": "Physics",
    "geography": "Earth Sciences",
    "geology": "Earth Sciences",
    
    // Social sciences
    "psychology": "Psychology",
    "sociology": "Social Sciences",
    "anthropology": "Social Sciences",
    "political_science": "Social Sciences",
    "social_science": "Social Sciences",
    
    // Humanities
    "history": "Humanities",
    "philosophy": "Humanities",
    "literature": "Humanities",
    "linguistics": "Humanities",
    "theology": "Humanities",
    
    // Other
    "law": "Law",
    "engineering": "Engineering",
    "math": "Mathematics",
    "communications": "Social Sciences",
    "science": "General",
    "humanities": "Humanities",
    "generic-base": "General"
  };
  
  return fieldMap[field.toLowerCase()] || "General";
}

/**
 * Helper function to create style entries with auto-generated names
 * The name and category will be replaced with real CSL metadata during enrichment
 */
function style(id: string): StyleInfo {
  return {
    id,
    name: formatStyleName(id), // Auto-generated name, replaced during enrichment
    category: "General" // Default category, replaced during enrichment based on field
  };
}

/**
 * Curated list of popular citation styles
 * Names are auto-generated from IDs and will be replaced with official CSL titles when enriched
 * Organized by discipline for easy discovery
 */
export const POPULAR_STYLES: StyleInfo[] = [
  // General/Multidisciplinary (Most Popular)
  style("apa"),
  style("modern-language-association"),
  style("chicago-note-bibliography"),
  style("chicago-author-date"),
  style("harvard-cite-them-right"),
  style("vancouver"),
  style("ieee"),
  style("iso690-author-date-en"),
  style("iso690-numeric-en"),
  style("council-of-science-editors"),
  
  // Medical & Health Sciences
  style("american-medical-association"),
  style("the-lancet"),
  style("bmj"),
  style("jama"),
  style("new-england-journal-of-medicine"),
  style("annals-of-internal-medicine"),
  style("american-journal-of-epidemiology"),
  style("circulation"),
  style("journal-of-clinical-oncology"),
  style("diabetes-care"),
  style("plos-medicine"),
  style("american-journal-of-psychiatry"),
  style("cochrane"),
  style("international-committee-of-medical-journal-editors"),
  
  // Biology & Life Sciences
  style("cell"),
  style("plos"),
  style("nature"),
  style("nature-no-et-al"),
  style("science"),
  style("elsevier-harvard"),
  style("springer-basic-author-date"),
  style("biomed-central"),
  style("frontiers"),
  style("proceedings-of-the-national-academy-of-sciences"),
  style("molecular-biology-and-evolution"),
  style("embo-journal"),
  style("genome-biology"),
  style("trends-journals"),
  style("current-biology"),
  style("bioinformatics"),
  style("nucleic-acids-research"),
  style("ecology"),
  style("ecology-letters"),
  style("journal-of-ecology"),
  
  // Engineering & Technology
  style("acm-sig-proceedings"),
  style("association-for-computing-machinery"),
  style("springer-lecture-notes-in-computer-science"),
  style("institute-of-electrical-and-electronics-engineers"),
  style("elsevier-without-titles"),
  style("american-society-of-civil-engineers"),
  style("american-society-of-mechanical-engineers"),
  style("multidisciplinary-digital-publishing-institute"),
  style("sage-harvard"),
  style("spie-journals"),
  
  // Chemistry & Materials Science
  style("american-chemical-society"),
  style("royal-society-of-chemistry"),
  style("angewandte-chemie"),
  style("journal-of-the-american-chemical-society"),
  style("analytical-chemistry"),
  style("acs-nano"),
  
  // Physics & Astronomy
  style("american-physics-society"),
  style("american-institute-of-physics"),
  style("nature-physics"),
  style("physical-review-letters"),
  style("astronomy-and-astrophysics"),
  style("astrophysical-journal"),
  style("monthly-notices-of-the-royal-astronomical-society"),
  
  // Psychology & Cognitive Science
  style("american-psychological-association-6th-edition"),
  style("psychological-bulletin"),
  style("journal-of-experimental-psychology-general"),
  style("cognitive-psychology"),
  style("neuropsychologia"),
  
  // Social Sciences
  style("american-sociological-association"),
  style("american-political-science-association"),
  style("american-anthropological-association"),
  style("academy-of-management-review"),
  style("taylor-and-francis-harvard-x"),
  style("urban-studies"),
  
  // Economics & Business
  style("apa-with-abstract"),
  style("journal-of-finance"),
  style("american-economic-review"),
  style("econometrica"),
  style("journal-of-political-economy"),
  style("quarterly-journal-of-economics"),
  style("management-science"),
  
  // Humanities
  style("turabian-fullnote-bibliography"),
  style("chicago-fullnote-bibliography-16th-edition"),
  style("mhra"),
  style("oxford-university-press-note"),
  style("oxford-university-press-scirep"),
  style("modern-humanities-research-association"),
  
  // Law
  style("bluebook-law-review"),
  style("oscola"),
  style("new-zealand-law-style-guide"),
  style("australian-guide-to-legal-citation"),
  
  // Earth & Environmental Sciences
  style("copernicus-publications"),
  style("geological-society-of-america"),
  style("american-geophysical-union"),
  style("quaternary-science-reviews"),
  style("climate-of-the-past"),
  
  // Mathematics & Statistics
  style("american-mathematical-society"),
  style("siam"),
  style("biometrics"),
  style("statistical-science"),
  
  // Education
  style("american-educational-research-association"),
  style("journal-of-educational-psychology"),
  
  // Multidisciplinary Publishers
  style("springer-basic-brackets"),
  style("springer-basic-author-date-no-et-al"),
  style("elsevier-harvard2"),
  style("taylor-and-francis-national-library-of-medicine"),
  style("wiley-vch"),
  style("american-institute-of-aeronautics-and-astronautics"),
];

/**
 * Initialize popular styles with real CSL metadata
 * This should be called once when the extension loads
 * Runs asynchronously in background without blocking UI
 */
export function initializePopularStyles(): void {
  // Enrich in background (non-blocking)
  enrichPopularStyles(POPULAR_STYLES).catch(err => 
    console.warn("Failed to enrich popular styles:", err)
  );
}

/**
 * Get unique categories from popular styles
 */
export function getCategories(): string[] {
  const categories = new Set(POPULAR_STYLES.map(s => s.category));
  return Array.from(categories).sort();
}

/**
 * Filter styles by search term
 */
export function searchStyles(query: string): StyleInfo[] {
  if (!query || query.trim().length < 2) {
    return POPULAR_STYLES;
  }
  
  const lowerQuery = query.toLowerCase();
  return POPULAR_STYLES.filter(style => 
    style.name.toLowerCase().includes(lowerQuery) ||
    style.id.toLowerCase().includes(lowerQuery) ||
    style.category.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get styles by category
 */
export function getStylesByCategory(category: string): StyleInfo[] {
  return POPULAR_STYLES.filter(s => s.category === category);
}
