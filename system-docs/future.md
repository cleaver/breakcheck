# Features for the future:

- `breakcheck clean snapshot|comparison` - delete snapshot|comparison
  - `--name` option for name of snapshot|comparison to delete
  - `--all` to nuke everything
  - omit name for interactive
  - add `--force` to skip confirmation
- `breakcheck list/ls` - list snapshots
  - [x] show name, date, number of pages, number of errors
  - [ ] in future, maybe add list diffs?
- `breakcheck snapshot --url-file` - to use the url list text file.
- `breakcheck init` - to initialize a new project
- `breakcheck new rule <name>` - to create a new rule file.
- store and read config files
- interactive config files
- ability to set a snapshot as baseline
- [ ] extract the file, directory, compression stuff to util modules
- [ ] extract the mocks, especially in `compare` tests.

# Things to check:

- [q] ~~Does `CompareConfig` have too many options. `normalizeHtml` will probably be done elsewhere.~~

# **Feature Idea: Conditional Rule Application by URL**

## Summary

This feature introduces the ability to make a rule apply only to pages with a matching URL path, or to exclude a rule from applying to pages with a matching URL path. The condition is specified directly in the rule definition, before the `do` keyword. This groups all targeting and conditioning logic together, leaving the `do`/`end` blocks to focus exclusively on the transformation actions.

## Goal

To allow users to create more targeted and context-aware rules within a single file, reducing the need for multiple rule files for different sections of a site. This increases the power and flexibility of the DSL.

## Proposed Syntax

The syntax introduces two new optional modifiers, `on_url` and `not_on_url`, which are placed between the selector and the `do` keyword.

### Single Action:

```
[SELECTOR] [URL_MODIFIER] do: action [MODIFIERS...]
```

### Multiple Actions:

```
[SELECTOR] [URL_MODIFIER] do
  action [MODIFIERS...]
  action [MODIFIERS...]
end
```

### New Keywords

- `on_url:"<pattern>"`: The rule will only be processed if the page's URL path matches the provided pattern.
- `not_on_url:"<pattern>"`: The rule will be skipped if the page's URL path matches the provided pattern.
- **Pattern Matching**: The `"<pattern>"` string should support glob-style wildcard matching (e.g., `/blog/posts/*` to match all posts, or `/user/*/profile` to match all user profiles).

---

## Detailed Examples

### 1. Apply a rule only on specific pages

- **Goal**: Rewrite a dynamic version parameter on CSS links, but only for pages in the `/store/` section of the site.
- **Rule**:
  ```
  css:link[rel=stylesheet] on_url:"/store/*" do: rewrite_attr attr:href regex:(\?|&)v=\w+ replace:?v=STATIC
  ```
- **Explanation**: The `rewrite_attr` action will only be considered for pages whose paths begin with `/store/`. On a page like `/about-us`, this entire rule is ignored.

### 2. Exclude a rule from a specific section

- **Goal**: Exclude all HTML comments across the entire site, _except_ for pages in the `/admin/` section, where they might be important for debugging.
- **Rule**:
  ```
  xpath://comment() not_on_url:"/admin/*" do: exclude
  ```
- **Explanation**: This `exclude` rule runs on every page. However, if the page path starts with `/admin/`, the `not_on_url` condition is met, and the rule is skipped for that page.

### 3. Use with a `do/end` block

- **Goal**: On product pages, remove several dynamic attributes from images to stabilize the comparison.
- **Rule**:
  ```
  xpath://img on_url:"/products/*" do
    remove_attr attr:srcset
    remove_attr attr:sizes
    rewrite_attr attr:src regex://cdn\d+\.example\.com/ replace://cdn.example.com/
  end
  ```
- **Explanation**: The `on_url:"/products/*"` condition is checked first. If the page is not a product page, the parser skips the entire `do/end` block. If it _is_ a product page, it proceeds to apply all three actions within the block to the selected `<img>` elements.
