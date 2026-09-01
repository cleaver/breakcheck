# **Breakcheck Intermediate JSON Specification**

## **1. Overview**

This document specifies the JSON format that represents the parsed rules from the Breakcheck DSL. This intermediate format serves as the input for the Breakcheck Rules Engine during the DOM processing phase. It's designed to be unambiguous and easy for both machines and humans to read.

## **2. Top-Level Structure**

The root of the JSON document is an object containing a list of ordinary rules and, optionally, named regions.

```json
{
  "rules": [
    // Array of Rule objects (see section 3)
  ],
  "regions": [
    // Array of Region objects (see section 5)
  ]
}
```

- **rules** (Array, Required): An ordered list of rule objects. The order matters as rules might be applied sequentially, and conflict resolution (e.g., "last rule wins") depends on this order.
- **regions** (Array, Optional): Named selectors to extract after all ordinary rules have run. If this array is present and non-empty, only matched regions are compared.

## **3. Rule Object Structure**

Each object within the rules array represents a single selector and the action(s) associated with it.

```json
{
  "selector": "string",
  "actions": [
    // Array of Action objects (see section 4)
  ]
}
```

- **selector** (Non-empty String, Required): Any selector accepted by the installed Cheerio selector engine. Tailwind class names containing colons must use CSS escaping when selected as a class. For example, the JSON representation of a selector for `prose-h1:font-bold` is:

  ```json
  "selector": ".prose-h1\\:font-bold"
  ```

  A class-token attribute selector such as `[class~="prose-h1:font-bold"]` avoids the CSS escape. The same rules apply to selectors in the optional `regions` array.

- **actions** (Array, Required): An ordered list containing one or more action objects to be applied to the elements matching the selector. For single-line do: rules in the DSL, this array will contain exactly one action object. For do/end blocks, it will contain multiple action objects.

## **4. Action Object Structure**

Each object within a rule's actions array represents a specific operation to perform.

```json
{
  "action": "include" | "exclude" | "remove_attr" | "rewrite_attr" | "rewrite_content",
  "modifiers": {
    // Optional modifier properties based on the action type
  }
}
```

- **action** (String, Required): The type of action to perform.
  - Value must be one of: "include", "exclude", "remove_attr", "rewrite_attr", "rewrite_content".
- **modifiers** (Object, Optional): Contains key-value pairs providing additional parameters needed for the specific action. The presence and requirement of keys within modifiers depend on the action value:
  - **If action is remove_attr:**
    - attr (String, Required): The name of the attribute to remove.
    - Example: `{ "action": "remove_attr", "modifiers": { "attr": "srcset" } }`
  - **If action is rewrite_attr:**
    - attr (String, Required): The name of the attribute to rewrite.
    - regex (String, Required): The regular expression pattern to match within the attribute value.
    - replace (String, Required): The replacement string (can use capture groups like $1).
    - Example: `{ "action": "rewrite_attr", "modifiers": { "attr": "href", "regex": "/user/\\d+", "replace": "/user/USER_ID" } }`
  - **If action is rewrite_content:**
    - regex (String, Required): The regular expression pattern to match within the element's text content.
    - replace (String, Required): The replacement string.
    - Example: `{ "action": "rewrite_content", "modifiers": { "regex": "\\d{2}/\\d{2}/\\d{4}", "replace": "DATE_STAMP" } }`
  - **If action is exclude or include and has content_regex:**
    - content_regex (String, Required): A regular expression pattern to filter the action based on the element's text content. The action only applies if the content matches.
    - Example: `{ "action": "exclude", "modifiers": { "content_regex": "Logged in: \\d+ minutes ago" } }`
  - **If action is exclude or include without content_regex:**
    - modifiers object may be empty or omitted.
    - Example: { "action": "exclude" } or { "action": "exclude", "modifiers": {} }

No other modifier keys are accepted, and modifiers cannot be borrowed from another action variant. Rules are validated and regular expressions compiled when the engine is created. The engine clones rules and regions at that boundary. Empty regex strings and replacement strings are valid; attribute names must be non-empty. `include` is an intentional compatibility no-op. `rewrite_content` applies separately to every descendant text node, preserving nested markup and preventing matches across element boundaries.

## **5. Examples of DSL to JSON Transformation**

**DSL Example 1 (Single Action):**
css:.ad-container do: exclude

**JSON Output 1:**

```json
{
  "selector": ".ad-container",
  "actions": [
    {
      "action": "exclude"
    }
  ]
}
```

**DSL Example 2 (Block Action):**

```
css:img do
  remove_attr attr:"srcset"
  rewrite_attr attr:"src" regex:"//cdn\d+\.example\.com/" replace:"//cdn.example.com/"
end
```

**JSON Output 2:**

```json
{
  "selector": "img",
  "actions": [
    {
      "action": "remove_attr",
      "modifiers": {
        "attr": "srcset"
      }
    },
    {
      "action": "rewrite_attr",
      "modifiers": {
        "attr": "src",
        "regex": "//cdn\\d+\\.example\\.com/",
        "replace": "//cdn.example.com/"
      }
    }
  ]
}
```

**DSL Example 3 (Content Regex):**

```
css:.important-note do: include content_regex:"Warning:"
```

**JSON Output 3:**

```json
{
  "selector": ".important-note",
  "actions": [
    {
      "action": "include",
      "modifiers": {
        "content_regex": "Warning:"
      }
    }
  ]
}
```

## **5. Region Object Structure**

Each object in the optional `regions` array identifies one named section of the processed DOM.

```json
{
  "selector": "#section-a",
  "name": "Section_A"
}
```

- **selector** (String, Required): The CSS selector used after ordinary rules have been applied. Tailwind class names containing colons must use CSS escaping when selected as a class; for example, `.prose-h1\\:font-bold` selects the class `prose-h1:font-bold` in JSON. Alternatively, use `[class~="prose-h1:font-bold"]`.
- **name** (String, Required): A unique, case-sensitive identifier matching `[A-Za-z_][A-Za-z0-9_]*`.

Regions are emitted by ascending exact name, with repeated matches retaining document order. Each matched element contributes its outer HTML inside a named wrapper under a stable synthetic root. Missing matches produce no output; overlapping declarations are emitted independently.

This specification provides a clear target format for the DSL parser and a well-defined input structure for the Rules Engine.
