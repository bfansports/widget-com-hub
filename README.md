# What is it?

This is a small Javascript framework for allowing inter-communication between independatn element of a webpage. 

Imagine you have a bunch of widgets that are self-contained. If you want to exchange information between them you need to establish a communiation channel and a protocol. 

This Communication hub create the communication channel for you elements. You just have to come up with a protocol:
- Widget name
- Event name
- Data to be exchanged
- Who listen to what?
- Who submit what?

# Usage

In the page containing your widgets, include widget-com-hub.js (only once) and the following HTML:
```
    <div id="widgetComHub" style="display: none"></div>
```
This element is used to get a hold of the DOM and listen JS events.

On ready create your hub:
```
    var hub = new widgetComHub();
```

This will run all setup to support the current list of loaded widgets and 
the events they expect to receive data FROM. Events emitted will be caught only by other widgets listening for this type of events, otherwise, the events will be ignored.

## Widgets structure
The HTML for the widgets should be self contained in a small HTML file along with the JS needed for it. 

Each widget must have the class 'widget' (class="widget") and should have a unique id.

Each widget must implement it's own callback functions when receiving events. Same for triggering events. See bellow.

# Emitting Events

Add JS events to button that will trigger new HUB events:
```
    $('#someButton').click(function() {
        $("#widgetComHub").trigger({
              type: 'score_event',
              source: $(this).attr("id"),
              data: {
                 teams: [{
                   id: 1,
                   name: "foo",
                   score: 1
                 }, {
                   id: 2,
                   name: "bar",
                   score: 2
                 }],
               }
           });
    });
```

This example will send a new event of type "score_event", from source `$(this).attr("id")` and containing some JSON data.

Be sure to have at least 3 pieces of information when sending a new event:
- type: Type of event (must match names for received widgetEvents)
- source: You can write $(this).attr("id") which will be your widget id
- data: Include a JSON object will the data appropriate for that type of
event

# Receiving EVENTS

To receive an event, insert the following JS code somewhere in your widget HTML:
```
    $('#timelineWidget').bind({
             'score_event': function (event) {
                // your code here
    	        console.log(event.type);
                console.log(event);
             }
    });
```

In this example we have a widget "timelineWidget" that will listen for a "score_event" event. If we catch one, then we execute the function associated. We can then act accoridngly on our timelineWidget.
