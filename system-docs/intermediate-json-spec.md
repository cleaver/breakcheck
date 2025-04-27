# **Breakcheck Intermediate JSON Specification**

## **1\. Overview**

This document specifies the JSON format that represents the parsed rules from the Breakcheck DSL. This intermediate format serves as the input for the Breakcheck Rules Engine during the DOM processing phase. It's designed to be unambiguous and easy for both machines and humans to read.

## **2\. Top-Level Structure**

The root of the JSON document is an object containing the overall configuration mode and a list of rules.  
{  
  "mode": "default\_include" | "explicit\_include",  
  "rules": \[  
    // Array of Rule objects (see section 3\)  
  \]  
}

* **mode** (String, Required): Specifies the overall processing mode.  
  * Value must be either "default\_include" or "explicit\_include".  
  * Defaults to "default\_include" if omitted by the parser (though the parser should ideally always include it).  
* **rules** (Array, Required): An ordered list of rule objects. The order matters as rules might be applied sequentially, and conflict resolution (e.g., "last rule wins") depends on this order.

## **3\. Rule Object Structure**

Each object within the rules array represents a single selector and the action(s) associated with it.  
{  
  "selector\_type": "css" | "xpath",  
  "selector": "string",  
  "actions": \[  
    // Array of Action objects (see section 4\)  
  \]  
}

* **selector\_type** (String, Required): Specifies the type of selector used.  
  * Value must be either "css" or "xpath".  
* **selector** (String, Required): The actual CSS selector or XPath expression string.  
* **actions** (Array, Required): An ordered list containing one or more action objects to be applied to the elements matching the selector. For single-line do: rules in the DSL, this array will contain exactly one action object. For do/end blocks, it will contain multiple action objects.

## **4\. Action Object Structure**

Each object within a rule's actions array represents a specific operation to perform.  
{  
  "action": "include" | "exclude" | "remove\_attr" | "rewrite\_attr" | "rewrite\_content",  
  "modifiers": {  
    // Optional modifier properties based on the action type  
  }  
}

* **action** (String, Required): The type of action to perform.  
  * Value must be one of: "include", "exclude", "remove\_attr", "rewrite\_attr", "rewrite\_content".  
* **modifiers** (Object, Optional): Contains key-value pairs providing additional parameters needed for the specific action. The presence and requirement of keys within modifiers depend on the action value:  
  * **If action is remove\_attr:**  
    * attr (String, Required): The name of the attribute to remove.  
    * Example: { "action": "remove\_attr", "modifiers": { "attr": "srcset" } }  
  * **If action is rewrite\_attr:**  
    * attr (String, Required): The name of the attribute to rewrite.  
    * regex (String, Required): The regular expression pattern to match within the attribute value.  
    * replace (String, Required): The replacement string (can use capture groups like $1).  
    * Example: { "action": "rewrite\_attr", "modifiers": { "attr": "href", "regex": "/user/\\\\d+", "replace": "/user/USER\_ID" } } (Note: Backslashes in regex need escaping in JSON strings)  
  * **If action is rewrite\_content:**  
    * regex (String, Required): The regular expression pattern to match within the element's text content.  
    * replace (String, Required): The replacement string.  
    * Example: { "action": "rewrite\_content", "modifiers": { "regex": "\\\\d{2}/\\\\d{2}/\\\\d{4}", "replace": "DATE\_STAMP" } }  
  * **If action is exclude or include and has content\_regex:**  
    * content\_regex (String, Required): A regular expression pattern to filter the action based on the element's text content. The action only applies if the content matches.  
    * Example: { "action": "exclude", "modifiers": { "content\_regex": "Logged in: \\\\d+ minutes ago" } }  
  * **If action is exclude or include without content\_regex:**  
    * modifiers object may be empty or omitted.  
    * Example: { "action": "exclude" } or { "action": "exclude", "modifiers": {} }

## **5\. Examples of DSL to JSON Transformation**

**DSL Example 1 (Single Action):**  
css:.ad-container do: exclude

**JSON Output 1:**  
{  
  "selector\_type": "css",  
  "selector": ".ad-container",  
  "actions": \[  
    {  
      "action": "exclude"  
    }  
  \]  
}

**DSL Example 2 (Block Action):**  
xpath://img do  
  remove\_attr attr:srcset  
  rewrite\_attr attr:src regex://cdn\\d+\\.example\\.com/ replace://cdn.example.com/  
end

**JSON Output 2:**  
{  
  "selector\_type": "xpath",  
  "selector": "//img",  
  "actions": \[  
    {  
      "action": "remove\_attr",  
      "modifiers": {  
        "attr": "srcset"  
      }  
    },  
    {  
      "action": "rewrite\_attr",  
      "modifiers": {  
        "attr": "src",  
        "regex": "//cdn\\\\d+\\\\.example\\\\.com/",  
        "replace": "//cdn.example.com/"  
      }  
    }  
  \]  
}

**DSL Example 3 (Mode and Content Regex):**  
mode explicit\_include  
css:.important-note do: include content\_regex:"Warning:"

**JSON Output 3 (Partial \- showing only the rule):**  
// Assuming this rule is within the main JSON structure like:  
// { "mode": "explicit\_include", "rules": \[ ... \] }  
{  
  "selector\_type": "css",  
  "selector": ".important-note",  
  "actions": \[  
    {  
      "action": "include",  
      "modifiers": {  
        "content\_regex": "Warning:"  
      }  
    }  
  \]  
}

This specification provides a clear target format for the DSL parser and a well-defined input structure for the Rules Engine.