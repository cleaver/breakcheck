# **Breakcheck Rules DSL - Design Proposal (Object-First Syntax, Lowercase)**

## **1. Overview**

The Breakcheck Rules DSL allows users to define how HTML documents should be processed _before_ they are compared. This enables ignoring expected dynamic changes (like cache busters, session IDs, timestamps) and focusing the comparison on relevant content and structural differences.  
The DSL is primarily line-oriented for single actions, but uses do/end blocks for applying multiple actions to the same selector. Commands are case-insensitive but lowercase is preferred style.

## **2. Core Concepts**

- **Selectors:** Rules target parts of the DOM using CSS selectors.
- **Actions:** Rules define actions to take on the selected parts: include, exclude, remove_attr, rewrite_attr, rewrite_content.
- **Structure:** Rules start with the selector, followed by the do: keyword for a single action, or a do/end block for multiple actions.
- **Nesting:** do/end blocks cannot be nested within other do/end blocks in this version.
- **Matching:** Actions can be fine-tuned using regular expressions on attribute values or element text content.

## **3. Syntax**

### **3.1 General Format**

**Single Action:**

```
css:[SELECTOR] do: action [MODIFIERS...]
```

**Multiple Actions:**

```
css:[SELECTOR] do
 action [MODIFIERS...]
 action [MODIFIERS...]

-- ... more actions

end
```

**Comment:**

```
-- Comment text
```

### **3.2 Keywords & Components**

- **SELECTOR**: The CSS selector string defining the target element(s).
- **do:**: Keyword indicating a single action follows for the preceding selector.
- **do / end**: Keywords defining a block where multiple actions apply to the preceding selector.
- **action**: The operation to perform on the selected element(s). Must appear after do: or within a do/end block. (Case-insensitive, lowercase preferred)
  - include: Specifies elements/attributes to keep for comparison.
  - exclude: Specifies elements/attributes/content to remove entirely before comparison. Can also be used with content_regex modifier for conditional exclusion based on content.
  - remove_attr: Removes a specific attribute from selected elements. Requires attr: modifier.
  - rewrite_attr: Rewrites the value of a specific attribute in selected elements. Requires attr:, regex:, and replace: modifiers.
  - rewrite_content: Rewrites the text content of selected elements. Requires regex: and replace: modifiers.
- **MODIFIERS**: Provide additional parameters for the action.
  - attr:<attribute_name>: Specifies the target attribute for remove_attr and rewrite_attr. (Required for these actions).
  - regex:"<pattern>": A regular expression pattern used for matching or capturing groups in rewrite_attr and rewrite_content.
  - replace:"<replacement>": The replacement string for rewrite_attr and rewrite_content. Can use capture groups like $1, $2 from the regex modifier.
  - content_regex:"<pattern>": (Used with exclude/include) Filters the action based on the element's text content matching the regex.

### **3.3 Comments**

Lines beginning with -- are ignored.

## **4. Examples**

### **4.1 Ignoring Dynamic Parts**

```
-- Breakcheck Rules (Object-First, Lowercase)

-- Exclude common dynamic elements (single action)

css:.ad-container do: exclude
css:#session-id-display do: exclude
css:script[src*="third-party-tracker.js"] do: exclude

-- Exclude elements based on content

css:.last-login do: exclude content_regex:"Logged in: \d+ minutes ago"

-- Remove/Rewrite attributes using blocks for multiple actions on the same selector

css:img do
 remove_attr attr:srcset
 remove_attr attr:sizes
 rewrite_attr attr:src regex://cdn\d+\.example\.com/ replace://cdn.example.com/
end

css:input[type='hidden'][name='csrf_token'] do: remove_attr attr:value

-- Normalize cache-busting parameters & CDN paths (can use blocks or separate lines)

css:link[rel=stylesheet] do: rewrite_attr attr:href regex:(\?|&)v=\w+ replace:?v=STATIC
css:script do: rewrite_attr attr:src regex:(\?|&)v=\w+ replace:?v=STATIC

-- Mask user IDs in profile links

css:a[href*='/user/'] do: rewrite_attr attr:href regex:/user/\d+/ replace:/user/USER_ID/

-- Rewrite dynamic content

css:.timestamp do: rewrite_content regex:\d{2}/\d{2}/\d{4} replace:DATE_STAMP
css:.view-count do: rewrite_content regex:\d{1,3}(,\d{3})\* views replace:VIEW_COUNT views
```

## **5. Suggested Additional Features**

_(These remain largely the same as the previous version, but would be adapted to the object-first syntax if implemented)_

- **Global Options:** Introduce global settings affecting the entire process.
  - option ignore_whitespace true | false | selective
  - option ignore_html_comments true | false (Default to false).
  - option case_sensitive_selectors true | false.
- **Rule Ordering/Priority:** Clearly define how conflicting rules are resolved (e.g., last rule wins).
- **Variables/Aliases:** Allow defining reusable patterns or selectors.

  # Hypothetical variable syntax adaptation

  var CACHE_BUSTER_REGEX = (\?|&)v=\w+  
  var CDN_HOST_REGEX = //cdn\d+\.example\.com/  
  var STYLESHEETS = css:link[rel=stylesheet]

  $STYLESHEETS do: rewrite_attr attr:href regex:{$CACHE_BUSTER_REGEX} replace:?v=STATIC

- **Importing Rule Sets:** Allow including common rules from other files or predefined sets.  
  import "common-rules.breakcheck"  
  import wordpress_defaults # Built-in set

- **Selector Validation:** The parser should provide clear errors for invalid CSS syntax.
- **Dry Run Feedback:** A CLI option (breakcheck compare --dry-run ...) that uses the rules to report _what_ would be excluded/included/transformed on each page, without actually performing the diff.
- **Conditional Rules (Advanced):** Potentially allow rules that only apply if certain conditions are met.

This DSL design provides a flexible foundation for Breakcheck's rule engine using the object-first syntax with lowercase commands, covering your core requirements while offering paths for future expansion.
