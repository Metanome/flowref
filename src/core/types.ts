/**
 * Core type definitions for FlowRef
 */

/**
 * Represents an author in a citation
 */
export interface Author {
  /** Given name (first name) */
  given?: string;
  /** Family name (last name) */
  family?: string;
  /** Full name (optional convenience field) */
  full?: string;
}

/**
 * Container type for the cited work
 */
export type ContainerType = "journal" | "book" | "conference" | "preprint" | "other";

/**
 * Supported citation styles
 */
export type CitationStyle = "apa" | "mla" | "chicago" | "vancouver" | "ieee";

/**
 * Variant for in-text citations
 */
export type InTextVariant = "parenthetical" | "narrative";

/**
 * Normalized citation metadata
 * This is the canonical format used by all formatters
 */
export interface CitationMetadata {
  /** Digital Object Identifier */
  doi: string;
  /** Title of the work */
  title: string;
  /** List of authors */
  authors: Author[];
  /** Publication year */
  year?: string;
  /** Journal or publication name */
  journal?: string;
  /** Volume number */
  volume?: string;
  /** Issue number */
  issue?: string;
  /** Page range (e.g., "123-145") */
  pages?: string;
  /** URL to the work */
  url?: string;
  /** Publisher name */
  publisher?: string;
  /** Type of container */
  containerType?: ContainerType;
  /** Whether authors are actually editors (for edited books) */
  isEditedWork?: boolean;
}

/**
 * Result from DOI detection
 */
export interface DOIDetectionResult {
  /** List of detected DOIs */
  dois: string[];
  /** Source of detection (meta-tag, regex, pdf) */
  source: "meta-tag" | "regex" | "pdf" | "manual";
}

/**
 * Result from metadata fetching
 */
export interface MetadataResult {
  /** Success flag */
  success: boolean;
  /** Citation metadata (if successful) */
  data?: CitationMetadata;
  /** Error message (if failed) */
  error?: string;
  /** API source used */
  source?: "crossref" | "datacite" | "doi.org";
}

/**
 * Message types for extension communication
 */
export enum MessageType {
  DETECT_DOI = "DETECT_DOI",
  DETECT_DOI_RESPONSE = "DETECT_DOI_RESPONSE",
  FETCH_METADATA = "FETCH_METADATA",
  FETCH_METADATA_RESPONSE = "FETCH_METADATA_RESPONSE",
}

/**
 * Generic message structure
 */
export interface ExtensionMessage<T = any> {
  type: MessageType;
  payload?: T;
}

/**
 * Batch citation entry
 */
export interface BatchEntry {
  /** Input identifier (DOI or filename) */
  input: string;
  /** Processing status */
  status: "pending" | "processing" | "success" | "error";
  /** Citation metadata (if successful) */
  metadata?: CitationMetadata;
  /** Error message (if failed) */
  error?: string;
  /** Formatted citation */
  citation?: string;
}
