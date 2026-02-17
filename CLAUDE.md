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
$('#timelineWidget').bind({
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
widget-com-hub.js        # Core hub implementation
index.html               # Demo/documentation page
scores_widget.html       # Example widget
README.md                # Usage documentation
```

## Dependencies

**Other bFAN repos:**
- Consumed by: bFAN-Webviews, sa_site_v2, bFAN-StatsWidgets
- Used wherever multiple widgets need to communicate on the same page

**External libraries:**
- jQuery (required for DOM traversal and event binding)

## API / Interface

**Widget Requirements:**
- Must have `class="widget"`
- Must have unique `id` attribute
- Must declare listened events in `data-receives` attribute (space-separated)
- Must implement event handlers via `$('#widgetId').bind({ 'event_type': handler })`

**Event Structure:**
When emitting an event:
```javascript
{
  type: 'event_name',      // String: event type (matches data-receives)
  source: 'widgetId',      // String: ID of emitting widget
  data: { ... }            // Object: event payload
}
```

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

<!-- Ask: Are there tests? -->
<!-- Ask: How to test locally? -->
<!-- Ask: How to test multi-widget scenarios? -->
<!-- Ask: Example test pages? -->

## Gotchas

- **jQuery Dependency**: Widgets and hub both require jQuery to be loaded first
- **Unique Widget IDs**: Widget IDs must be unique on the page or broadcasting breaks
- **Event Name Matching**: Event type in `trigger()` must exactly match name in `data-receives`
- **Space-Separated Subscriptions**: `data-receives` uses spaces, not commas
- **No Namespacing**: Event types are global across all widgets — use descriptive names
- **Console Logging**: Debug logs are always on (see `/* debug start */` in code)
- **Self-Broadcasting Prevented**: Emitting widget never receives its own event
- **Synchronous Only**: No async event handling — events fire immediately

<!-- Ask: Common issues with event name mismatches? -->
<!-- Ask: How to debug missing events? -->
<!-- Ask: Performance with many widgets? -->
<!-- Ask: How to disable debug logging in production? -->