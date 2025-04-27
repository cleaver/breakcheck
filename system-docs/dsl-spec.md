# **Breakcheck Rules DSL \- Design Proposal (Object-First Syntax, Lowercase)**

## **1\. Overview**

The Breakcheck Rules DSL allows users to define how HTML documents should be processed *before* they are compared. This enables ignoring expected dynamic changes (like cache busters, session IDs, timestamps) and focusing the comparison on relevant content and structural differences.  
The DSL is primarily line-oriented for single actions, but uses do/end blocks for applying multiple actions to the same selector. Commands are case-insensitive but lowercase is preferred style.

## **2\. Core Concepts**

* **Modes:** The DSL operates in one of two modes:  
  * default\_include (Default): The entire document is included by default. Rules primarily exclude or transform (remove\_attr, rewrite\_attr, rewrite\_content) parts.  
  * explicit\_include: The entire document is excluded by default. Rules primarily include specific parts. Transformations can still be applied to the included parts.  
* **Selectors:** Rules target parts of the DOM using CSS selectors (default) or XPath expressions.  
* **Actions:** Rules define actions to take on the selected parts: include, exclude, remove\_attr, rewrite\_attr, rewrite\_content.  
* **Structure:** Rules start with the selector, followed by the do: keyword for a single action, or a do/end block for multiple actions.  
* **Nesting:** do/end blocks cannot be nested within other do/end blocks in this version.  
* **Matching:** Actions can be fine-tuned using regular expressions on attribute values or element text content.

## **3\. Syntax**

### **3.1 General Format**

**Single Action:**  
\[SELECTOR\_TYPE:\]\[SELECTOR\] do: action \[MODIFIERS...\]

**Multiple Actions:**  
\[SELECTOR\_TYPE:\]\[SELECTOR\] do  
  action \[MODIFIERS...\]  
  action \[MODIFIERS...\]  
  \# ... more actions  
end

**Mode Setting:**  
mode \<mode\_name\>

**Comment:**  
\# Comment text

### **3.2 Keywords & Components**

* **mode**: Sets the processing mode. (Case-insensitive, lowercase preferred)  
  * mode default\_include (This is the default if no mode line is present)  
  * mode explicit\_include  
* **SELECTOR\_TYPE**: (Optional)  
  * css:: Use a CSS selector (default if omitted).  
  * xpath:: Use an XPath expression.  
* **SELECTOR**: The CSS selector string or XPath expression defining the target element(s).  
* **do:**: Keyword indicating a single action follows for the preceding selector.  
* **do / end**: Keywords defining a block where multiple actions apply to the preceding selector.  
* **action**: The operation to perform on the selected element(s). Must appear after do: or within a do/end block. (Case-insensitive, lowercase preferred)  
  * include: (Used in explicit\_include mode) Specifies elements/attributes to keep for comparison.  
  * exclude: (Used in default\_include mode or within included blocks) Specifies elements/attributes/content to remove entirely before comparison. Can also be used with content\_regex modifier for conditional exclusion based on content.  
  * remove\_attr: Removes a specific attribute from selected elements. Requires attr: modifier.  
  * rewrite\_attr: Rewrites the value of a specific attribute in selected elements. Requires attr:, regex:, and replace: modifiers.  
  * rewrite\_content: Rewrites the text content of selected elements. Requires regex: and replace: modifiers.  
* **MODIFIERS**: Provide additional parameters for the action.  
  * attr:\<attribute\_name\>: Specifies the target attribute for remove\_attr and rewrite\_attr. (Required for these actions).  
  * regex:"\<pattern\>": A regular expression pattern used for matching or capturing groups in rewrite\_attr and rewrite\_content.  
  * replace:"\<replacement\>": The replacement string for rewrite\_attr and rewrite\_content. Can use capture groups like $1, $2 from the regex modifier.  
  * content\_regex:"\<pattern\>": (Used with exclude/include) Filters the action based on the element's text content matching the regex.

### **3.3 Comments**

Lines beginning with \# are ignored.

## **4\. Examples**

### **4.1 Default Include Mode (Ignoring Dynamic Parts)**

\# Breakcheck Rules \- Default Include Mode (Object-First, Lowercase)  
\# mode default\_include \<-- Optional line, as it's the default

\# Exclude common dynamic elements (single action)  
css:.ad-container do: exclude  
css:\#session-id-display do: exclude  
xpath://comment() do: exclude \# Exclude all HTML comments  
css:script\[src\*="third-party-tracker.js"\] do: exclude

\# Exclude elements based on content  
css:.last-login do: exclude content\_regex:"Logged in: \\d+ minutes ago"

\# Remove/Rewrite attributes using blocks for multiple actions on the same selector  
xpath://img do  
  remove\_attr attr:srcset  
  remove\_attr attr:sizes  
  rewrite\_attr attr:src regex://cdn\\d+\\.example\\.com/ replace://cdn.example.com/  
end

xpath://input\[@type='hidden'\]\[@name='csrf\_token'\] do: remove\_attr attr:value

\# Normalize cache-busting parameters & CDN paths (can use blocks or separate lines)  
css:link\[rel=stylesheet\] do: rewrite\_attr attr:href regex:(\\?|&)v=\\w+ replace:?v=STATIC  
css:script do: rewrite\_attr attr:src regex:(\\?|&)v=\\w+ replace:?v=STATIC

\# Mask user IDs in profile links  
xpath://a\[contains(@href, '/user/')\] do: rewrite\_attr attr:href regex:/user/\\d+/ replace:/user/USER\_ID/

\# Rewrite dynamic content  
css:.timestamp do: rewrite\_content regex:\\d{2}/\\d{2}/\\d{4} replace:DATE\_STAMP  
xpath://span\[@class='view-count'\]/text() do: rewrite\_content regex:\\d{1,3}(,\\d{3})\* views replace:VIEW\_COUNT views

### **4.2 Explicit Include Mode (Focusing on Specific Parts)**

\# Breakcheck Rules \- Explicit Include Mode (Object-First, Lowercase)  
mode explicit\_include

\# Only compare the main content area, title, and meta description  
css:\#main-content-wrapper do: include  
xpath://head/title do: include  
xpath://head/meta\[@name='description'\] do: include  
css:.article-header do: include

\# Even within included sections, we might need to normalize things.  
\# Exclusions apply \*after\* includes have defined the scope.  
css:\#main-content-wrapper .js-initialized do: exclude

\# Rewrite timestamps within the included article header  
css:.article-header .publish-date do: rewrite\_content regex:\\w+ \\d+, \\d+ replace:PUBLISH\_DATE

## **5\. Suggested Additional Features**

*(These remain largely the same as the previous version, but would be adapted to the object-first syntax if implemented)*

* **Global Options:** Introduce global settings affecting the entire process.  
  * option ignore\_whitespace true | false | selective  
  * option ignore\_html\_comments true | false (Default to false).  
  * option case\_sensitive\_selectors true | false.  
  * option default\_selector\_type css | xpath.  
* **Rule Ordering/Priority:** Clearly define how conflicting rules are resolved (e.g., last rule wins).  
* **Variables/Aliases:** Allow defining reusable patterns or selectors.  
  \# Hypothetical variable syntax adaptation  
  var CACHE\_BUSTER\_REGEX \= (\\?|&)v=\\w+  
  var CDN\_HOST\_REGEX \= //cdn\\d+\\.example\\.com/  
  var STYLESHEETS \= css:link\[rel=stylesheet\]

  $STYLESHEETS do: rewrite\_attr attr:href regex:{$CACHE\_BUSTER\_REGEX} replace:?v=STATIC

* **Importing Rule Sets:** Allow including common rules from other files or predefined sets.  
  import "common-rules.breakcheck"  
  import wordpress\_defaults \# Built-in set

* **Targeting Text Nodes:** Provide a more explicit way to target text nodes directly, perhaps via XPath (xpath://p/text()) combined with rewrite\_content or exclude.  
* **Selector Validation:** The parser should provide clear errors for invalid CSS or XPath syntax.  
* **Dry Run Feedback:** A CLI option (breakcheck compare \--dry-run ...) that uses the rules to report *what* would be excluded/included/transformed on each page, without actually performing the diff.  
* **Conditional Rules (Advanced):** Potentially allow rules that only apply if certain conditions are met.

This DSL design provides a flexible foundation for Breakcheck's rule engine using the object-first syntax with lowercase commands, covering your core requirements while offering paths for future expansion.