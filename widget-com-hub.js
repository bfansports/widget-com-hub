var widgetComHub = function () {
    // Handles an event coming from a widget
    this.widgetEventHandler = function (event) {
	
	/* debug start */
        console.log(event.type + " triggered !");
        console.log(event);
	/* debug end */
	
	var time = Date.now();
	// timestamp added to hub data for error checking

        $("[data-receives*="+ event.type+"]").each(function () {  // broadcast to all widgets with class==event.type
            if ($(this).attr("id") != event.source)
            {
		// send to all widgets that receive the type of event except for emmiter
		$(this).trigger({
                    type: event.type,
                    data: event.data, // copy of the data sent to hub
                    source: event.source,
                    hub_data: { // additional data from hub
			timestamp: time
                    }
		});
            }
        });
    }
    
    this.setup = function (hub) {
        var widgetEvents = []; // array of known events that widgets may care about
        $(".widget").each(function() {
            var receives = $(this).attr("data-receives");
            if (receives != undefined)
            {
                var events = receives.split(" ");
                events.forEach(function(event) {
                    console.log(event);
                    if (widgetEvents.indexOf(event) < 0)  // if event not in handleable events, add it
                        widgetEvents.push(event);
                });
            }
        });
        console.log(widgetEvents);
        widgetEvents.forEach(function (event) {
	    $("#widgetComHub").bind(event, hub.widgetEventHandler); // bind broadcasted events to hub
        });
	
    }
    
    this.setup(this);
}
