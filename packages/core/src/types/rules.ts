/**
 * Type definitions for Breakcheck JSON Rules
 * Based on the JSON Rules Specification
 */

/**
 * The type of action to perform
 */
export type ActionType =
  "include" | "exclude" | "remove_attr" | "rewrite_attr" | "rewrite_content";

/**
 * Valid names for named regions in a ruleset.
 */
export const REGION_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Base interface for action modifiers
 */
export interface ContentFilterModifiers {
  content_regex?: string;
}

/**
 * Modifiers for remove_attr action
 */
export interface RemoveAttrModifiers {
  attr: string;
}

/**
 * Modifiers for rewrite_attr action
 */
export interface RewriteAttrModifiers {
  attr: string;
  regex: string;
  replace: string;
}

/**
 * Modifiers for rewrite_content action
 */
export interface RewriteContentModifiers {
  regex: string;
  replace: string;
}

/**
 * Union type for all possible action modifiers
 */
export type ActionModifiers =
  | RemoveAttrModifiers
  | RewriteAttrModifiers
  | RewriteContentModifiers
  | ContentFilterModifiers;

/**
 * Represents a single action to be performed
 */
export type Action =
  | { action: "include" | "exclude"; modifiers?: ContentFilterModifiers }
  | { action: "remove_attr"; modifiers: RemoveAttrModifiers }
  | { action: "rewrite_attr"; modifiers: RewriteAttrModifiers }
  | { action: "rewrite_content"; modifiers: RewriteContentModifiers };

/**
 * Represents a single rule with a selector and its actions
 */
export interface Rule {
  selector: string;
  actions: Action[];
}

/**
 * A named section of the processed document to include in a comparison.
 */
export interface Region {
  selector: string;
  name: string;
}

/**
 * The root structure of the JSON rules document
 */
export interface Ruleset {
  name: string;
  rules: Rule[];
  /** Named regions are optional for backwards-compatible inline rulesets. */
  regions?: Region[];
}
