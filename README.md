# How to use the HUB, Widget writing guide

In the hub page include widget_hub.js (only once) and the following HTML:
    <div id="widgetHub" style="display: none"></div>

On ready create your hub:
    var hub = new widgetHub();

This will run all setup to support the current list of loaded widgets and 
the events they expect to receive data FROM. Events emitted but never
received by other widgets will be ignored.

# Emitting Events

Add JS events that will trigger HUB events:
    $('#someWidget').click(function() {
        $("#widgetHub").trigger({
               type: 'score_event',
               source_widget: $(this).attr("id"),
              widget_data: {
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

Be sure to have at least 3 pieces of information:
- type: Type of event (must match names for received widgetEvents)
- source_widget: You can write $(this).attr("id") which will be your own id
- widget_data: Include a JSON object will the data appropriate for that type of
event

# Receiving EVENTS

To receive an event, insert behavior as follows:
    $('#scoreWidget').bind({
             'score_event': function (event) {
               // your code here
    	       console.log(event.type);
               console.log(event);
             }
    });


The HTML for the widget should be self contained in a small HTML file along with the JS needed for it
Make the widget have the class widget
