# AI Audit: widget-com-hub

**Date:** 2026-02-17  
**Auditor:** Frontend Developer (AI)  
**Scope:** iframe/postMessage security, XSS, widget embedding, cross-origin communication, performance  
**Repo:** bfansports/widget-com-hub  
**Branch:** master  

---

## Critical

### C1. CSS Selector Injection via Unsanitized Event Type

**File:** `widget-com-hub.js:13`  
**Code:**
```javascript
$('[data-receives*='+ event.type+']').each(function () {
```

**Issue:** The `event.type` value is concatenated directly into a jQuery attribute selector without sanitization or quoting. Any widget emitting an event with a crafted `type` value containing CSS selector metacharacters (e.g., `]`, `[`, `,`, `:`) can break the selector or target unintended DOM elements.

For example, an event type like `foo] .secret-widget,[data-receives*=bar` would cause the selector to match elements that were never intended to receive the event, potentially leaking data to unsubscribed widgets.

Because the hub runs in the same page as consumer widgets (admin panel, webviews), any compromised or malicious widget can abuse this to broadcast to arbitrary DOM elements.

**Recommendation:**  
Quote and escape the attribute value:
```javascript
var safeType = event.type.replace(/[\\"]/g, '\\$&');
$('[data-receives~="' + safeType + '"]').each(function () {
```
Using `~=` (word match) instead of `*=` (substring match) is also more correct — see finding H1.

---

### C2. Demo Page Uses `widgetHub` but Library Defines `widgetComHub`

**File:** `index.html:13,19,38,71,121`  
**Code:**
```javascript
var hub = new widgetHub();       // index.html:13 — WRONG constructor name
$("#widgetHub").trigger({...});   // index.html:19,38,71 — WRONG element ID
<div id="widgetHub" ...>          // index.html:121 — WRONG element ID
```

**vs. library:**
```javascript
var widgetComHub = function () {  // widget-com-hub.js:1 — actual constructor
$("#widgetComHub").bind(...)      // widget-com-hub.js:45 — actual element ID
```

**Issue:** The demo/test page `index.html` references `widgetHub` and `#widgetHub` throughout, but the actual library constructor is `widgetComHub` and it binds to `#widgetComHub`. The demo page is **completely non-functional** — the hub never receives events and never broadcasts. This means there is no working test page to verify hub behavior.

The README and CLAUDE.md document the correct names (`widgetComHub`, `#widgetComHub`), so consumers (sa_site_v2) likely work correctly, but the demo page has been broken since inception.

**Recommendation:**  
Fix index.html to use `widgetComHub` and `#widgetComHub` consistently, or rename the library to match. Also fix the event property names (see H2).

---

## High

### H1. Substring Selector `*=` Causes False-Positive Event Routing

**File:** `widget-com-hub.js:13`  
**Code:**
```javascript
$('[data-receives*='+ event.type+']')
```

**Issue:** The `*=` CSS attribute selector matches substrings. If a widget subscribes to `score_event_final` via `data-receives="score_event_final"`, it will also incorrectly receive `score_event` because `"score_event"` is a substring of `"score_event_final"`. Similarly, `data-receives="my_score_event"` matches too.

This creates subtle, hard-to-debug routing bugs as the number of event types grows. In production (sa_site_v2), there are many event types (`timeline_event`, `play_event`, `clip_event`, etc.) and substring collisions are likely.

**Recommendation:**  
Use `~=` (whitespace-separated word selector) which matches exact words:
```javascript
$('[data-receives~="' + safeType + '"]')
```

---

### H2. Event Property Name Mismatch Between Demo and Library

**File:** `index.html` vs `widget-com-hub.js`  

| Property | index.html uses | widget-com-hub.js expects |
|----------|----------------|---------------------------|
| Source   | `source_widget` | `source` |
| Payload  | `widget_data`   | `data` |

**Issue:** The demo page emits events with `source_widget` and `widget_data`, but `widget-com-hub.js` reads `event.source` and forwards `event.data`. The self-loop prevention (`event.source`) never works because the field is always `undefined`. The forwarded `data` is always `undefined` too.

The `scores_widget.html` event handler reads `event.widget_data` which would also be `undefined` when received through the hub (the hub forwards as `event.data`).

**Recommendation:**  
Standardize on `source` and `data` everywhere. Update index.html and scores_widget.html to match the library's API.

---

### H3. No Event Payload Validation or Schema Enforcement

**File:** `widget-com-hub.js:17-24`  

**Issue:** The hub blindly forwards whatever data is attached to the event. There is no validation that:
- `event.type` is a string
- `event.source` is a valid widget ID
- `event.data` is a plain object (not a function, DOM node, or circular reference)

In a same-origin environment where any script can trigger events on `#widgetComHub`, this means any code on the page can broadcast arbitrary data to all widgets. If a consumer widget uses received data in a dangerous way (e.g., `.html()` instead of `.text()`), this becomes a DOM XSS vector.

**Recommendation:**  
Add basic validation in `widgetEventHandler`:
```javascript
if (typeof event.type !== 'string' || !event.type) return;
if (typeof event.source !== 'string') return;
```
Document that widgets MUST use `.text()` (not `.html()`) when rendering event data.

---

### H4. Deprecated jQuery `.bind()` API

**Files:** `widget-com-hub.js:45`, `index.html:48,54,64,98`, `scores_widget.html:7`  

**Issue:** `.bind()` was deprecated in jQuery 3.0 (2016) and removed in later versions. The codebase also loads jQuery 2.1.0 which is severely outdated (released 2014) and has known security vulnerabilities (CVE-2015-9251 XSS via `$.ajax`, CVE-2019-11358 prototype pollution, CVE-2020-11022/11023 `.html()` XSS).

**Recommendation:**  
- Replace `.bind()` with `.on()` throughout
- Upgrade jQuery to 3.7.x or migrate to vanilla JS (`addEventListener`)

---

## Medium

### M1. Duplicate Widget ID in Demo Page

**File:** `index.html:112,123`  

```html
<section id="scoreWidget" data-receives="score_event" class="widget">   <!-- line 112 -->
...
<div class="widget" data-receives="playerWidgetEvent scoreWidgetEvent" id="scoreWidget">  <!-- line 123 -->
```

**Issue:** Two elements share `id="scoreWidget"`. This is invalid HTML and causes unpredictable behavior — jQuery `$('#scoreWidget')` will only find the first one, and event binding may target the wrong element. The hub's `.each()` iteration may also behave unexpectedly.

**Recommendation:**  
Rename one element (e.g., the `<section>` to `scoreDisplayWidget` and the `<div>` to `scoreButtonWidget`).

---

### M2. No Error Handling for Missing Event Properties

**File:** `scores_widget.html:11-14`, `index.html:102-105`  

```javascript
$('#scoreTeam1').text(event.widget_data.teams[0].name);
```

**Issue:** If `widget_data`, `teams`, or `teams[0]` is undefined, this throws an uncaught TypeError and halts JavaScript execution. There is no defensive coding for missing or malformed event data.

**Recommendation:**  
Add guards:
```javascript
var teams = event.data && event.data.teams;
if (teams && teams[0]) {
  $('#scoreTeam1').text(teams[0].name);
}
```

---

### M3. Always-On Debug Logging in Production Code

**File:** `widget-com-hub.js:5-8,37,43`  

```javascript
/* debug start */
console.log(event.type + " triggered !");
console.log(event);
/* debug end */
...
console.log(event);     // line 37
console.log(widgetEvents);  // line 43
```

**Issue:** Debug `console.log` statements run unconditionally in production. This:
- Leaks event data (including potentially sensitive fan/team info) to browser console
- Causes performance overhead with high event frequency
- Pollutes the console for developers debugging other issues

**Recommendation:**  
Add a debug flag or remove entirely:
```javascript
var DEBUG = false;
if (DEBUG) console.log(event.type + ' triggered!');
```
Or use a logger that respects environment.

---

### M4. No Protection Against Event Storms or Infinite Loops

**File:** `widget-com-hub.js:17`  

**Issue:** If Widget A emits event X, and Widget B's handler for event X emits event Y, and Widget A listens for event Y, this creates a potential infinite event loop. The hub has no:
- Re-entrancy guard
- Max event depth
- Rate limiting
- Circuit breaker

The only protection is the self-loop prevention (source widget check), but that only prevents the *same* widget from receiving its own event — not cross-widget loops.

**Recommendation:**  
Add a re-entrancy depth counter:
```javascript
var _depth = 0;
this.widgetEventHandler = function(event) {
  if (++_depth > 10) { console.warn('Event depth exceeded'); _depth--; return; }
  // ... existing logic ...
  _depth--;
};
```

---

### M5. GitHub Actions Workflow Triggers on Wrong Branch

**File:** `.github/workflows/github-backup.yml:4`  

```yaml
on:
  push:
    branches:
      - develop
```

**Issue:** The default branch is `master`, but the backup workflow triggers on `develop`. If the team uses `master` as the primary branch (confirmed by repo settings), pushes to `master` are never backed up to S3.

**Recommendation:**  
Change to `master` or add both:
```yaml
branches:
  - master
  - develop
```

---

### M6. Protocol-Relative jQuery URL

**File:** `index.html:7`  

```html
<script type='text/javascript' src='//code.jquery.com/jquery-2.1.0.js'></script>
```

**Issue:** Protocol-relative URLs (`//`) are deprecated as a best practice. If the page is opened via `file://` (local development), this resolves to `file://code.jquery.com/...` which fails silently. Also, loading jQuery from a CDN without an integrity hash (`integrity="sha256-..."`) allows CDN compromise to inject malicious code.

**Recommendation:**  
Use explicit HTTPS with SRI:
```html
<script src="https://code.jquery.com/jquery-3.7.1.min.js"
  integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo="
  crossorigin="anonymous"></script>
```

---

## Low

### L1. Constructor Uses Global Variable, No Module Pattern

**File:** `widget-com-hub.js:1`  

```javascript
var widgetComHub = function () {
```

**Issue:** The constructor is a global variable. In a page with many scripts, name collisions are possible. There is no IIFE, no module pattern, no UMD wrapper. This is fine for the current use case (single script on a controlled page) but limits reusability.

**Recommendation:**  
Wrap in an IIFE and expose on `window` explicitly, or convert to ES module for future use:
```javascript
(function(global) {
  'use strict';
  var widgetComHub = function() { /* ... */ };
  global.widgetComHub = widgetComHub;
})(window);
```

---

### L2. `<script language="JavaScript">` is Obsolete

**File:** `index.html:96`, `scores_widget.html:4`  

**Issue:** The `language` attribute on `<script>` tags is deprecated since HTML4. It should be `type="text/javascript"` or simply `<script>` (which defaults to JavaScript in HTML5).

---

### L3. No `<!DOCTYPE>`, `<html>`, or `<head>` in scores_widget.html

**File:** `scores_widget.html`  

**Issue:** `scores_widget.html` is a fragment, not a complete HTML document. This is by design (it's embedded in a parent page), but it should be documented that widget files are HTML fragments, not standalone pages.

---

### L4. Missing `<meta charset>` and `<meta viewport>` in Demo Page

**File:** `index.html`  

**Issue:** Uses the older `http-equiv` charset declaration. Missing viewport meta tag means the demo is not mobile-friendly. Minor for a demo page.

---

### L5. Inconsistent Event Naming Convention

Across the codebase, event names use two different conventions:
- `snake_case`: `score_event`
- `camelCase`: `scoreWidgetEvent`, `playerWidgetEvent`

**Recommendation:**  
Standardize on one convention. `snake_case` is recommended since sa_site_v2 consumers already use it (`timeline_event`, `play_event`, `clip_event`).

---

## Agent Skill Improvements

### AS1. CLAUDE.md Improvements Delivered

The following additions were made to CLAUDE.md as part of this audit:
- **Architecture section** — widget communication flow, hub-element-discovery pattern, event lifecycle
- **Security considerations** — CSS selector injection, event validation, debug logging
- **Known bugs** — demo page naming mismatch, property name inconsistency
- **Cross-repo integration** — how sa_site_v2 and other consumers use the hub
- **Embedding pattern** — correct HTML structure for widget-in-page usage
- **Modernization roadmap** — jQuery migration path, module pattern

### AS2. Recommended Additional Skills

- A `widget-security` rule in `.claude/rules/` would help catch XSS patterns in widget repos (`.html()` usage, unsanitized selectors, missing SRI)
- The `frontend-dev` skill should include a checklist for jQuery security (`.text()` over `.html()`, SRI hashes, version audits)

---

## Positive Observations

1. **Good architectural pattern.** The pub/sub event hub is a solid, well-understood pattern for decoupled widget communication. The design is simple, easy to understand, and effective.

2. **Self-loop prevention.** The hub correctly prevents emitting widgets from receiving their own events (line 14), which avoids the most common infinite-loop scenario.

3. **DOM-based auto-discovery.** Using `data-receives` attributes for declarative event subscription is elegant — widgets don't need to call registration APIs, the hub discovers them automatically.

4. **Minimal footprint.** The entire hub is 51 lines of JavaScript. This is appropriate for an event bus — it does one thing with minimal overhead.

5. **Hub metadata enrichment.** Adding `hub_data.timestamp` to forwarded events provides useful debugging and ordering information without modifying the original payload.

6. **`.text()` for rendering.** The score widget examples use `.text()` (not `.html()`) to render event data, which is the correct XSS-safe approach. This should be documented as a mandatory pattern.

7. **Good README and CLAUDE.md.** Documentation clearly explains the protocol (event structure, widget requirements, emitting and receiving). The CLAUDE.md correctly identifies the API contract.
