# widget-com-hub

## What This Is

Lightweight JavaScript framework for cross-widget communication. Enables independent widgets on a webpage to exchange data via a centralized event hub without direct coupling. Widgets declare which events they listen to via HTML data attributes, and the hub broadcasts events to interested subscribers. Used to coordinate multiple self-contained widgets (scores, timelines, player stats) on the same page.

## Tech Stack

- **Vanilla JavaScript** (ES5-compatible)
- **jQuery** (for DOM manipulation and event binding)
- **No build process** — simple script inclusion

## Quick Start

**Include in your HTML:**
```html
<script src="widget-com-hub.js"></script>
<div id="widgetComHub" style="display: none"></div>
```

**Initialize the hub:**
```javascript
var hub = new widgetComHub();
```

**Create a widget that listens:**
```html
<div class="widget" data-receives="score_event playerWidgetEvent" id="timelineWidget">
  <!-- Widget content -->
</div>

<script>
$('#timelineWidget').on({
  'score_event': function (event) {
    console.log('Received score event:', event.data);
    // Handle the event
  }
});
</script>
```

**Emit an event from another widget:**
```javascript
$('#scoreWidget').find('#someButton').click(function() {
  $("#widgetComHub").trigger({
    type: 'score_event',
    source: $('#scoreWidget').attr("id"),
    data: {
      teams: [
        { id: 1, name: "foo", score: 1 },
        { id: 2, name: "bar", score: 2 }
      ]
    }
  });
});
```

## Project Structure

```
widget-com-hub.js        # Core hub implementation (~51 lines)
index.html               # Demo page (WARNING: broken — see Known Bugs)
scores_widget.html       # Example widget fragment (not standalone HTML)
README.md                # Usage documentation
FINDINGS.md              # AI audit results (2026-02-17)
```

## Architecture

### Communication Flow

```
 Widget A (emitter)          Hub (#widgetComHub)         Widget B (receiver)
 ┌─────────────┐            ┌──────────────────┐        ┌─────────────────┐
 │ User action  │            │                  │        │                 │
 │ triggers     │──trigger──>│ widgetEventHandler│──each──>│ bound handler   │
 │ jQuery event │            │ - validates source│        │ processes event │
 │ on #hub      │            │ - adds timestamp  │        │                 │
 └─────────────┘            │ - broadcasts      │        └─────────────────┘
                            └──────────────────┘
```

### Event Lifecycle

1. **Setup** — On `new widgetComHub()`, the hub scans all `.widget` elements for `data-receives` attributes
2. **Registration** — Each unique event type found in `data-receives` is bound to the hub's `widgetEventHandler`
3. **Emission** — A widget triggers a jQuery event on `#widgetComHub` with `type`, `source`, and `data`
4. **Routing** — The hub finds all elements with matching `data-receives`, skips the source widget, and re-triggers the event on each receiver
5. **Enrichment** — The hub adds `hub_data.timestamp` to forwarded events
6. **Handling** — Each receiving widget's bound handler processes the event

### Key Design Decisions

- **DOM-based discovery** — No registration API; widgets declare subscriptions via `data-receives` HTML attributes
- **jQuery event system** — Leverages jQuery's event infrastructure rather than implementing custom pub/sub
- **Self-loop prevention** — Emitting widget is excluded from broadcast via `event.source` check
- **Single hub element** — All events route through one hidden `<div id="widgetComHub">`
- **Synchronous execution** — Events fire immediately, no async queue

## Dependencies

**Other bFAN repos that consume this:**
- `sa_site_v2` — Admin panel widgets (timeline_clips_list, video player, etc.)
- `bFAN-Webviews` — Mobile app webview widgets
- `bFAN-StatsWidgets` — Live statistics widgets

**External libraries:**
- jQuery (required — used for DOM traversal, event binding, selectors)

## API / Interface

**Widget Requirements:**
- Must have `class="widget"`
- Must have unique `id` attribute (duplicate IDs cause routing bugs)
- Must declare listened events in `data-receives` attribute (space-separated)
- Must implement event handlers via `$('#widgetId').on({ 'event_type': handler })`

**Event Structure:**
When emitting an event:
```javascript
{
  type: 'event_name',      // String: event type (matches data-receives)
  source: 'widgetId',      // String: ID of emitting widget
  data: { ... }            // Object: event payload
}
```

**IMPORTANT:** Use `source` and `data` — not `source_widget` or `widget_data`. The demo page (index.html) uses wrong property names. Follow the README and this doc.

When receiving an event:
```javascript
{
  type: 'event_name',      // String: event type
  source: 'widgetId',      // String: ID of emitting widget
  data: { ... },           // Object: event payload (copy)
  hub_data: {              // Object: hub metadata
    timestamp: 1234567890  // Number: event timestamp (Date.now())
  }
}
```

**Broadcasting Logic:**
- Hub broadcasts events to all widgets with `data-receives` containing the event type
- Events are NOT sent back to the emitting widget (prevents self-loops)
- Widgets that don't subscribe to an event type never receive it

## Key Patterns

- **Pub/Sub Pattern**: Widgets publish events, subscribers receive them
- **Decoupled Widgets**: Widgets don't know about each other, only event types
- **DOM-Based Discovery**: Hub auto-discovers widgets and their subscriptions via DOM traversal
- **Centralized Event Bus**: Single `#widgetComHub` DOM element acts as event dispatcher
- **Self-Initializing**: Hub setup runs on instantiation

## Embedding Pattern

To embed the hub in a page with widgets:

```html
<!-- 1. Load jQuery first -->
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>

<!-- 2. Load hub -->
<script src="widget-com-hub.js"></script>

<!-- 3. Hidden hub element (MUST exist before hub instantiation) -->
<div id="widgetComHub" style="display: none"></div>

<!-- 4. Widget HTML fragments with data-receives -->
<div class="widget" data-receives="score_event" id="myWidget">
  <!-- widget content -->
</div>

<!-- 5. Widget scripts bind handlers and emit events -->
<script>
$('#myWidget').on({
  'score_event': function(event) {
    // Always use .text() for rendering — NEVER .html() on event data
    $('#output').text(event.data.someValue);
  }
});

// 6. Instantiate hub AFTER all widget HTML is in the DOM
var hub = new widgetComHub();
</script>
```

**Order matters:** The hub scans the DOM on instantiation. All `.widget` elements with `data-receives` must exist before `new widgetComHub()` is called. For dynamically loaded widgets, re-instantiate the hub or call `hub.setup(hub)` after adding new widgets.

## Cross-Origin / iframe Considerations

This hub operates **within a single page context only**. It uses jQuery events on DOM elements, which do not cross iframe boundaries. If widgets are loaded in iframes:

- The hub cannot discover widgets inside iframes (different DOM trees)
- Events triggered on `#widgetComHub` do not propagate into iframes
- To bridge iframes, you would need `window.postMessage()` as an intermediary

**Current state:** No postMessage bridge exists. All consuming pages (sa_site_v2, webviews) load widgets as HTML fragments in the same DOM, not as iframes.

## Security Considerations

- **CSS selector injection (CRITICAL):** `widget-com-hub.js:13` concatenates `event.type` directly into a jQuery selector without sanitization. Crafted event types with CSS metacharacters can target unintended elements. See FINDINGS.md C1.
- **No event validation:** The hub forwards any data attached to events. Consumer widgets MUST validate received data defensively.
- **XSS prevention:** Always use `.text()` to render event data in the DOM. Never use `.html()`, `.append()` with unsanitized strings, or `innerHTML` on event payloads.
- **Debug logging:** Production hub logs all events to console including payloads. This may leak sensitive data visible in browser dev tools.
- **jQuery CVEs:** The demo loads jQuery 2.1.0 which has known XSS and prototype pollution vulnerabilities. Production consumers should use jQuery 3.7.x+.

## Environment

No special environment setup required. Works in any browser with jQuery.

<!-- Ask: What jQuery version is required? Minimum version? -->
<!-- Ask: Browser compatibility requirements? -->

## Deployment

**Static file hosting:**
- Copy `widget-com-hub.js` to S3 or CDN
- Include in pages that use inter-widget communication
<!-- Ask: Where is this deployed? Same S3 buckets as bFAN-Webviews? -->
<!-- Ask: Versioning strategy? -->

## Testing

**No automated tests exist.** The demo page (`index.html`) is the only test artifact, and it is currently broken due to naming mismatches (see Known Bugs).

To test manually:
1. Fix `index.html` naming issues (see Known Bugs)
2. Open `index.html` in a browser with dev tools console open
3. Click buttons and verify events appear in the console
4. Check that the score widget updates when "No Spoilers" is checked and a score event is sent

<!-- Ask: How to test multi-widget scenarios? -->

## Known Bugs

1. **Demo page uses wrong names (Critical):** `index.html` references `widgetHub`/`#widgetHub` but the library defines `widgetComHub`/`#widgetComHub`. The entire demo is non-functional.
2. **Demo uses wrong event properties:** `index.html` emits `source_widget` and `widget_data` but the hub reads `source` and `data`. Events are never routed correctly.
3. **Duplicate element ID:** `index.html` has two elements with `id="scoreWidget"` (lines 112 and 123). Invalid HTML causes unpredictable behavior.
4. **Substring selector matching:** The hub uses `*=` (substring match) instead of `~=` (word match) for `data-receives`. Event type `foo` incorrectly matches widgets subscribed to `foobar`.
5. **GitHub Actions backup triggers on `develop`** but default branch is `master`.

## Gotchas

- **jQuery Dependency**: Widgets and hub both require jQuery to be loaded first
- **Unique Widget IDs**: Widget IDs must be unique on the page or broadcasting breaks
- **Event Name Matching**: Event type in `trigger()` must exactly match name in `data-receives`
- **Space-Separated Subscriptions**: `data-receives` uses spaces, not commas
- **No Namespacing**: Event types are global across all widgets — use descriptive names
- **Console Logging**: Debug logs are always on (see `/* debug start */` in code) — leaks event data to console
- **Self-Broadcasting Prevented**: Emitting widget never receives its own event
- **Synchronous Only**: No async event handling — events fire immediately
- **No Cross-iframe Support**: Hub only works within a single DOM tree; iframes require a postMessage bridge (not implemented)
- **No Re-entrancy Protection**: Cross-widget event chains can cause infinite loops if Widget A triggers an event that Widget B handles by emitting an event that Widget A handles
- **Instantiation Timing**: Hub must be instantiated AFTER all widget elements exist in the DOM
- **Property Names**: Use `source` and `data` in events — the demo page uses `source_widget` and `widget_data` which are WRONG
- **Selector Injection**: Event type values with CSS metacharacters (`]`, `[`, `,`) can break the hub's jQuery selector
- **`.bind()` is deprecated**: Use `.on()` instead — `.bind()` is removed in jQuery 3.5+

## Modernization Roadmap

If this library is refactored:
1. **Fix bugs first** — naming mismatch, substring selector, property names
2. **Remove jQuery dependency** — use `querySelectorAll`, `addEventListener`, `CustomEvent`
3. **Add event validation** — type check `event.type`, `event.source`, sanitize selectors
4. **Add re-entrancy guard** — depth counter to prevent infinite event loops
5. **Conditional debug logging** — flag or environment-based
6. **Module pattern** — IIFE or ES module export
7. **Add postMessage bridge** — for cross-iframe widget communication if needed

<!-- Ask: Common issues with event name mismatches? -->
<!-- Ask: How to debug missing events? -->
<!-- Ask: Performance with many widgets? -->
<!-- Ask: How to disable debug logging in production? -->
