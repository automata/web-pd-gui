$(document).ready(function() {
    // chrome fix (jsPlumb)
    document.onselectstart = function () { return false; };

    // count the current number of 'Graphical PD Objects'
    countGPdObjects = 0;
    GPdObjects = [];

    // there are two types of endpoints (inlets): control and signal
    // TODO: the style should just use CSS
    // TODO: use images to fillStyle
    var controlEndpoint = {
        endpoint: new jsPlumb.Endpoints.Dot({radius:7}),
	style: { width:10, height:10, fillStyle: '#444'},
	isSource: true,
	isTarget: true,
	scope: 'controlEndpoint',
        connector: new jsPlumb.Connectors.Bezier(50),
        //connector : new jsPlumb.Connectors.Straight(),
	connectorStyle : {
	    gradient:{ stops:[[0, '#000'], [0.5, '#ff0000'], [1, '#000']]},
	    lineWidth: 2,
	    strokeStyle: '#000',
	},
        maxConnections:50,
	//reattach:true,
	//anchor:"TopLeft",
    };

    var signalEndpoint = {
        endpoint: new jsPlumb.Endpoints.Dot({radius:9}),
	style: { width:10, height:10, fillStyle: '#666'},
	isSource: true,
	isTarget: true,
        // TODO: we need to have more scopes: signalendpoint inlet, signalendpoint outlet, ...
        // because we can't connect inlets to outlets, just outlets to inlets!
	scope: 'signalEndpoint',
        connector: new jsPlumb.Connectors.Bezier(50),
	//connector : new jsPlumb.Connectors.Straight(),
	connectorStyle : {
	    gradient: {stops: [[0, '#000'], [0.5, '#09098e'], [1, '#000']]},
	    lineWidth: 4,
	    strokeStyle: '#fff',
	},
        maxConnections:50,
	//reattach:true,
    };

    var addGPdObject = function(idNumber, x, y, str) {
        // create a DOM id
        var DOMId = 'GPdObject-' + idNumber.toString();
        // TODO: set left/top attr on e.style
        var x = x.toString();
        var y = y.toString();

        // call the pd.parse to create the PD object
        var pdline = '#X obj ' + x + ' ' + y + ' ' + str + '';
        pd.parse(pdline + ';\n');

        // create and add the DOM element
        // TODO: specify a root DOM element to append children
        var e = document.createElement('div');
        e.setAttribute('id', DOMId);
        e.setAttribute('class', 'GPdObject');
        e.innerHTML = str;
        document.body.appendChild(e);

        // starts the 'parsing' (partialy stolen from pd.parse :-D)
        // TODO: do we need to parse really? is there a better way to integrate jsPlumb and webPd?
	var tokens = pdline.split(/ |\r\n?|\n/);
        if (tokens[0] == '#X') {
            if (tokens[1] == 'obj') {
                var proto = tokens[4];
                var args = tokens.slice(5);


                // TODO: making pd.PdObjects would be useful (maybe add some metainformation: number of inlets, ...)
                if (proto == 'dac~') {
                    // TODO: for now I'm using anchor position to identify wich inlet it correspond to
                    // inlet-1 (top left) x:0 y:0 (the other args are orientation)
                    jsPlumb.addEndpoint(DOMId, $.extend({ anchor: [0, 0, 0, 0]}, signalEndpoint));
                    // inlet-2 (top right) x:1 y:0 (position is normalized)
                    jsPlumb.addEndpoint(DOMId, $.extend({ anchor: [1, 0, 0, 0]}, signalEndpoint));

                    // we need a place to store information about endpoints, anchors and other things
                    GPdObjects[countGPdObjects] = {'proto': proto, 'args': args, 'inlets': [[0,0,0,0], [1,0,0,0]]};
                } else if (proto == 'osc~') {
                    jsPlumb.addEndpoint(DOMId, $.extend({ anchor: [0,0,0,0]}, signalEndpoint));
                    jsPlumb.addEndpoint(DOMId, $.extend({ anchor: [1,0,0,0]}, controlEndpoint));
                    jsPlumb.addEndpoint(DOMId, $.extend({ anchor: [0,1,0,0]}, signalEndpoint));

                    GPdObjects[countGPdObjects] = {'proto': proto, 'args': args, 
                                                   'inlets': [[0,0,0,0], [1,0,0,0]],
                                                   'outlets': [[0,1,0,0]]};
                }
                console.log('proto', proto, 'args', args, 'length args', args.length);
            }
        }
        // set the DOMId element draggable
        jsPlumb.draggable($('#' + DOMId));
        countGPdObjects++;
    }

    // elements of class .window will be draggable
    //jsPlumb.draggable($(".window"));

    // DEBUG
    var showConnections = function() {
        console.log(pd._graph.objects);
        var c = jsPlumb.getConnections();

        for (var i in c) {
            var l = c[i];
            if (l && l.length > 0) {
		for (var j = 0; j < l.length; j++) {
                    console.log(l[j].sourceId, l[j].targetId);
		}
	    }
	}
    };

    // connection listener
    jsPlumb.addListener(["jsPlumbConnection","jsPlumbConnectionDetached"], {
	jsPlumbConnection : function(p) { 
            showConnections();

            // TODO: unify on the same addPdObject?!
            var sourceId = p.sourceId.split('-');
            var sourceN = sourceId[1];
            var targetId = p.targetId.split('-');
            var targetN = targetId[1];

            // wich inlet?!
            var sourceAnchorX = p.sourceEndpoint.anchor.x;
            var sourceAnchorY = p.sourceEndpoint.anchor.y;
            var targetAnchorX = p.targetEndpoint.anchor.x;
            var targetAnchorY = p.targetEndpoint.anchor.y;
            var targetInlet, sourceOutlet;

            // let's search the target inlet based on the targetEndpoint anchor position (ma'an!)
            var targetInlets = GPdObjects[parseInt(targetN)]['inlets'];

            for (var i=0; i<targetInlets.length; i++) {
                if ((targetAnchorX == targetInlets[i][0]) && 
                    (targetAnchorY == targetInlets[i][1])) {
                    // we found the target inlet i on the determined position x,y
                    targetInlet = i;
                }
            }

            // do the same to the source outlet
            var sourceOutlets = GPdObjects[parseInt(sourceN)]['outlets'];

            for (var i=0; i<sourceOutlets.length; i++) {
                if ((sourceAnchorX == sourceOutlets[i][0]) &&
                    (sourceAnchorY == sourceOutlets[i][1])) {
                    sourceOutlet = i;
                }
            }
            
            console.log('connection created from PD obj:', sourceN, 'outlet:', sourceOutlet, 
                       'to PD obj:', targetN, 'inlet:', targetInlet);

            pd.parse('#X connect ' + 
                     sourceN  + ' ' + sourceOutlet.toString() + ' ' + 
                     targetN + ' ' + targetInlet.toString() + ';\n');
        },
	jsPlumbConnectionDetached : function(p) { showConnections(); }
    });

    /* some notes

    // we can add end points on each element id, one-by-one
    // jsPlumb.addEndpoint('window1', $.extend({ anchor: 'TopLeft'}, exampleEndpoint));
    // or we can add end points on each element of a class!
    
    $(".window").addEndpoint(exampleEndpoint);

    // TODO: useful to detach and other operations by UI

    $(".hide").click(function() {
	jsPlumb.toggle($(this).attr("rel"));
    });

    $(".drag").click(function() {
	var s = jsPlumb.toggleDraggable($(this).attr("rel"));
	$(this).html(s ? 'disable dragging' : 'enable dragging');
	if (!s) $("#" + $(this).attr("rel")).addClass('drag-locked'); else $("#" + $(this).attr("rel")).removeClass('drag-locked');
	$("#" + $(this).attr("rel")).css("cursor", s ? "pointer" : "default");
    });

    $(".detach").click(function() {
	jsPlumb.detachAll($(this).attr("rel"));
    });

    $("#clear").click(function() { jsPlumb.detachEverything(); showConnections(); });
    */

    // 'public' interface
    createGPdObject = function(str) {
        addGPdObject(countGPdObjects, 100, 100, str);
    }

    // init

    // creating a instance of PureData
    pd = new Pd(44100, 256);
    pd.loadcallback = function() { };

    pd.parse('#N canvas 637 62 450 300 10;\n')
});
