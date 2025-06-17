/**
 * Type definitions for Breakcheck JSON Rules
 * Based on the JSON Rules Specification
 */

/**
 * The type of action to perform
 */
export type ActionType =
  | "include"
  | "exclude"
  | "remove_attr"
  | "rewrite_attr"
  | "rewrite_content";

/**
 * Base interface for action modifiers
 */
interface BaseActionModifiers {
  content_regex?: string;
}

/**
 * Modifiers for remove_attr action
 */
interface RemoveAttrModifiers extends BaseActionModifiers {
  attr: string;
}

/**
 * Modifiers for rewrite_attr action
 */
interface RewriteAttrModifiers extends BaseActionModifiers {
  attr: string;
  regex: string;
  replace: string;
}

/**
 * Modifiers for rewrite_content action
 */
interface RewriteContentModifiers extends BaseActionModifiers {
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
  | BaseActionModifiers;

/**
 * Represents a single action to be performed
 */
export interface Action {
  action: ActionType;
  modifiers?: ActionModifiers;
}

/**
 * Represents a single rule with a selector and its actions
 */
export interface Rule {
  selector: string;
  actions: Action[];
}

/**
 * The root structure of the JSON rules document
 */
export interface Ruleset {
  name: string;
  rules: Rule[];
}
