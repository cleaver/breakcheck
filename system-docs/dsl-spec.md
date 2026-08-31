# **Breakcheck Rules DSL - Design Proposal (Object-First Syntax, Lowercase)**

## **1. Overview**

The Breakcheck Rules DSL allows users to define how HTML documents should be processed _before_ they are compared. This enables ignoring expected dynamic changes (like cache busters, session IDs, timestamps) and focusing the comparison on relevant content and structural differences. It can also extract named regions so that layout sections are compared in a stable order even when their source order changes.
The DSL is primarily line-oriented for single actions, but uses do/end blocks for applying multiple actions to the same selector. Commands are case-insensitive but lowercase is preferred style.

## **2. Core Concepts**

- **Selectors:** Rules target parts of the DOM using the full selector syntax accepted by Cheerio, including spaces, combinators, groups, pseudo-classes, escaped identifiers, and quoted attribute values.
- **Actions:** Rules define actions to take on the selected parts: include, exclude, remove_attr, rewrite_attr, rewrite_content.
- **Named regions:** A selector can define a named region that is extracted after ordinary rules have run. When regions are configured, only those regions are compared.
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

**Named Region:**

```
css:[SELECTOR] do: region name:"[IDENTIFIER]"
```

**Comment:**

```
-- Comment text
```

### **3.2 Keywords & Components**

- **SELECTOR**: The CSS selector string defining the target element(s). It must remain on the same physical line as its `do:` or block `do` delimiter. Delimiter-like text inside selector quotes, brackets, or parentheses is treated as selector text.
- **do:**: Keyword indicating a single action follows for the preceding selector.
- **do / end**: Keywords defining a block where multiple actions apply to the preceding selector.
- **action**: The operation to perform on the selected element(s). Must appear after do: or within a do/end block. (Case-insensitive, lowercase preferred)
  - include: An intentional no-op retained for compatibility.
  - exclude: Specifies elements/attributes/content to remove entirely before comparison. Can also be used with content_regex modifier for conditional exclusion based on content.
  - remove_attr: Removes a specific attribute from selected elements. Requires attr: modifier.
  - rewrite_attr: Rewrites the value of a specific attribute in selected elements. Requires attr:, regex:, and replace: modifiers.
  - rewrite_content: Rewrites the text content of selected elements. Requires regex: and replace: modifiers.
  - region: Declares a named region. It must be the only action on its selector and requires the name: modifier.
- **MODIFIERS**: Provide additional parameters for the action.
  - name:"<identifier>": Names a region. Names must match `[A-Za-z_][A-Za-z0-9_]*` and must be unique within the ruleset.
  - attr:"<attribute_name>": Specifies the target attribute for remove_attr and rewrite_attr. (Required for these actions).
  - regex:"<pattern>": A regular expression pattern used for matching or capturing groups in rewrite_attr and rewrite_content.
  - replace:"<replacement>": The replacement string for rewrite_attr and rewrite_content. Can use capture groups like $1, $2 from the regex modifier.
  - content_regex:"<pattern>": (Used with exclude/include) Filters the action based on the element's text content matching the regex.

All modifier values are double-quoted. Within a value, `\"` decodes to `"` and `\\` decodes to `\`; other escapes, including `\d`, `\w`, and `\?`, are preserved. A block must contain at least one action. The block-header `do` terminates its line and may only be followed by whitespace or a comment.

The engine validates the complete ruleset eagerly, including selector and regex syntax, region names, action counts, and action-specific modifier keys. `rewrite_content` recursively rewrites individual descendant text nodes while preserving elements and attributes, and matches do not span element boundaries.

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
 remove_attr attr:"srcset"
 remove_attr attr:"sizes"
 rewrite_attr attr:"src" regex:"//cdn\d+\.example\.com/" replace:"//cdn.example.com/"
end

css:input[type='hidden'][name='csrf_token'] do: remove_attr attr:"value"

-- Normalize cache-busting parameters & CDN paths (can use blocks or separate lines)

css:link[rel=stylesheet] do: rewrite_attr attr:"href" regex:"(\?|&)v=\w+" replace:"?v=STATIC"
css:script do: rewrite_attr attr:"src" regex:"(\?|&)v=\w+" replace:"?v=STATIC"

-- Mask user IDs in profile links

css:a[href*='/user/'] do: rewrite_attr attr:"href" regex:"/user/\d+" replace:"/user/USER_ID/"

-- Rewrite dynamic content

css:.timestamp do: rewrite_content regex:"\d{2}/\d{2}/\d{4}" replace:"DATE_STAMP"
css:.view-count do: rewrite_content regex:"\d{1,3}(,\d{3})* views" replace:"VIEW_COUNT views"
```

### **4.2 Extracting Named Regions**

Named regions are processed in two stages:

1. All ordinary rules run in their declared order.
2. Region selectors match against that transformed DOM.

If at least one region is declared, content outside matched regions is omitted. Every matching element contributes its outer HTML. Regions are sorted by their exact, case-sensitive names, and repeated matches for one region retain document order. Missing matches produce no output and are not errors. Overlapping region declarations are emitted independently.

The result is serialized with a stable synthetic root and one wrapper per matched region:

```html
<breakcheck-regions>
  <region name="Section_A">...</region>
  <region name="Section_B">...</region>
</breakcheck-regions>
```

Because ordinary rules run first, a broad exclusion or rewrite can remove or alter content so that a region selector no longer matches. Output for non-matched sections is intentionally not included yet and is reserved for a future iteration.

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

  $STYLESHEETS do: rewrite_attr attr:"href" regex:"{$CACHE_BUSTER_REGEX}" replace:"?v=STATIC"

- **Importing Rule Sets:** Allow including common rules from other files or predefined sets.  
  import "common-rules.breakcheck"  
  import wordpress_defaults # Built-in set

- **Selector Validation:** The parser should provide clear errors for invalid CSS syntax.
- **Dry Run Feedback:** A CLI option (breakcheck compare --dry-run ...) that uses the rules to report _what_ would be excluded/included/transformed on each page, without actually performing the diff.
- **Conditional Rules (Advanced):** Potentially allow rules that only apply if certain conditions are met.

This DSL design provides a flexible foundation for Breakcheck's rule engine using the object-first syntax with lowercase commands, covering your core requirements while offering paths for future expansion.
