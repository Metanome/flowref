/**
 * PDF parsing utilities using PDF.js
 * Extract text and DOIs from PDF files
 */

import * as pdfjsLib from "pdfjs-dist";
import { detectDOIsFromText, normalizeDOI } from "./doi";

// Configure PDF.js worker
// Note: In browser extensions, we need to set the worker path
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdfjs/pdf.worker.min.js");
}

/**
 * Extract text content from a PDF file
 * @param pdfData - ArrayBuffer or Uint8Array of PDF file
 * @param maxPages - Maximum number of pages to extract (default: 5, for performance)
 * @returns Extracted text content
 */
export async function extractTextFromPDF(
  pdfData: ArrayBuffer | Uint8Array,
  maxPages: number = 5
): Promise<string> {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;
    
    const numPages = Math.min(pdf.numPages, maxPages);
    const textParts: string[] = [];
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Concatenate all text items
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(" ");
      
      textParts.push(pageText);
    }
    
    return textParts.join("\n\n");
  } catch (error) {
    console.error("Failed to extract PDF text:", error);
    throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Extract DOI from a PDF file
 * Searches the first few pages for DOI patterns
 * @param pdfData - ArrayBuffer or Uint8Array of PDF file
 * @returns DOI string or null if not found
 */
export async function extractDOIFromPDF(pdfData: ArrayBuffer | Uint8Array): Promise<string | null> {
  try {
    // Extract text from first 3 pages (DOIs are typically on first page)
    const text = await extractTextFromPDF(pdfData, 3);
    
    // Use existing DOI detection logic
    const dois = detectDOIsFromText(text);
    
    // Return first DOI found
    return dois.length > 0 ? dois[0] : null;
  } catch (error) {
    console.error("Failed to extract DOI from PDF:", error);
    return null;
  }
}

/**
 * Extract multiple DOIs from a PDF file
 * Useful for review papers or documents that cite multiple works
 * @param pdfData - ArrayBuffer or Uint8Array of PDF file
 * @param maxPages - Maximum pages to scan (default: 10)
 * @returns Array of DOI strings
 */
export async function extractAllDOIsFromPDF(
  pdfData: ArrayBuffer | Uint8Array,
  maxPages: number = 10
): Promise<string[]> {
  try {
    const text = await extractTextFromPDF(pdfData, maxPages);
    return detectDOIsFromText(text);
  } catch (error) {
    console.error("Failed to extract DOIs from PDF:", error);
    return [];
  }
}

/**
 * Read a file as ArrayBuffer
 * @param file - File object from input or drag-drop
 * @returns Promise<ArrayBuffer>
 */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file as ArrayBuffer"));
      }
    };
    
    reader.onerror = () => {
      reject(new Error("File reading failed"));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Process a PDF file and extract its DOI
 * @param file - PDF file from input or drag-drop
 * @returns Object with DOI and filename
 */
export async function processPDFFile(file: File): Promise<{
  doi: string | null;
  filename: string;
  error?: string;
}> {
  try {
    // Validate file type
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      return {
        doi: null,
        filename: file.name,
        error: "Not a PDF file"
      };
    }
    
    // Read file content
    const arrayBuffer = await readFileAsArrayBuffer(file);
    
    // Extract DOI
    const doi = await extractDOIFromPDF(arrayBuffer);
    
    return {
      doi,
      filename: file.name,
      error: doi ? undefined : "No DOI found in PDF"
    };
  } catch (error) {
    return {
      doi: null,
      filename: file.name,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Process multiple PDF files in batch
 * @param files - Array of PDF files
 * @param onProgress - Optional callback for progress updates
 * @returns Array of results with DOIs and filenames
 */
export async function processPDFBatch(
  files: File[],
  onProgress?: (current: number, total: number) => void
): Promise<Array<{
  doi: string | null;
  filename: string;
  error?: string;
}>> {
  const results = [];
  
  for (let i = 0; i < files.length; i++) {
    const result = await processPDFFile(files[i]);
    results.push(result);
    
    if (onProgress) {
      onProgress(i + 1, files.length);
    }
    
    // Add small delay to avoid overwhelming the system
    if (i < files.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}
