/**
 * In-text citation formatter
 * Supports multiple citation styles
 */

import { Author, InTextVariant } from "./types";
import { formatInTextAPAParenthetical, formatInTextAPANarrative } from "./formatters/apa";
import { formatInTextMLAParenthetical, formatInTextMLANarrative } from "./formatters/mla";
import { formatInTextChicagoParenthetical, formatInTextChicagoNarrative } from "./formatters/chicago";
import { formatInTextIEEEParenthetical, formatInTextIEEENarrative } from "./formatters/ieee";
import { formatInTextVancouverParenthetical, formatInTextVancouverNarrative } from "./formatters/vancouver";

/**
 * Format an in-text citation in APA style
 */
export function formatInTextAPA(
  authors: Author[], 
  year?: string, 
  variant: InTextVariant = "parenthetical"
): string {
  if (variant === "narrative") {
    return formatInTextAPANarrative(authors, year);
  } else {
    return formatInTextAPAParenthetical(authors, year);
  }
}

/**
 * Format an in-text citation in MLA style
 */
export function formatInTextMLA(
  authors: Author[],
  variant: InTextVariant = "parenthetical"
): string {
  if (variant === "narrative") {
    return formatInTextMLANarrative(authors);
  } else {
    return formatInTextMLAParenthetical(authors);
  }
}

/**
 * Format an in-text citation in Chicago style
 * Chicago uses footnotes/endnotes with superscript numbers
 */
export function formatInTextChicago(
  authors: Author[],
  noteNumber: number = 1,
  variant: InTextVariant = "parenthetical"
): string {
  if (variant === "narrative") {
    return formatInTextChicagoNarrative(authors, noteNumber);
  } else {
    return formatInTextChicagoParenthetical(noteNumber);
  }
}

/**
 * Format an in-text citation in IEEE style
 * IEEE uses reference numbers in brackets
 */
export function formatInTextIEEE(
  authors: Author[],
  refNumber: number = 1,
  variant: InTextVariant = "parenthetical"
): string {
  if (variant === "narrative") {
    return formatInTextIEEENarrative(authors, refNumber);
  } else {
    return formatInTextIEEEParenthetical(refNumber);
  }
}

/**
 * Format an in-text citation in Vancouver style
 * Vancouver uses reference numbers in parentheses
 */
export function formatInTextVancouver(
  authors: Author[],
  refNumber: number = 1,
  variant: InTextVariant = "parenthetical"
): string {
  if (variant === "narrative") {
    return formatInTextVancouverNarrative(authors, refNumber);
  } else {
    return formatInTextVancouverParenthetical(refNumber);
  }
}

/**
 * Format an in-text citation (general function that dispatches to style-specific formatters)
 */
export function formatInText(
  style: "apa" | "mla" | "chicago" | "vancouver" | "ieee",
  authors: Author[],
  year?: string,
  variant: InTextVariant = "parenthetical"
): string {
  switch (style) {
    case "apa":
      return formatInTextAPA(authors, year, variant);
    // Future styles can be added here
    default:
      return formatInTextAPA(authors, year, variant);
  }
}
