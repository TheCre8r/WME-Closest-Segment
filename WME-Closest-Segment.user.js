// ==UserScript==
// @name         	WME Closest Segment
// @description		Shows the closest segment to a place
// @version      	0.8
// @author			SAR85
// @copyright		SAR85
// @license		 	CC BY-NC-ND
// @grant		 	none
// @include			https://www.waze.com/editor/*
// @include			https://www.waze.com/*/editor/*
// @include			https://editor-beta.waze.com/*
// @namespace		https://greasyfork.org/users/9321
// ==/UserScript==

(function () {
	function inMapExtent(e) {
		"use strict";
		return W.map.getExtent().intersectsBounds(e.geometry.getBounds());
	}

	function clearLayerFeatures() {
		var layer = W.map.getLayersByName("Closest Segment")[0];
		return layer.features.length > 0 && layer.removeAllFeatures();
	}

	function drawLine(start, end) {
		"use strict";
		var lineFeature = new OL.Feature.Vector(new OL.Geometry.LineString([start, end]), {}, {
				strokeWidth : 2,
				strokeColor : '#00ece3'
			}),
		pointFeature = new OL.Feature.Vector(end, {}, {
				pointRadius : 6,
				fillColor : 'white',
				fillOpacity : 1,
				strokeColor : '#00ece3'
			});
		clearLayerFeatures();
		W.map.getLayersByName("Closest Segment")[0].addFeatures([lineFeature, pointFeature]);
	}

	function findNearestSegment() {
		"use strict";
		var i,
		s,
		minDistance = Infinity,
		distanceToSegment,
		segments,
		selectedItem,
		closestSegment = {};

		/* Zoom must be at least 4 in order to see streets */
		if (W.map.getZoom() < 4) {
			console.log('WME CS: Zoom too low.');
			return;
		}
		
		selectedItem = W.selectionManager.selectedItems.first();
		closestSegment.featureStop = selectedItem.model.isPoint() ? selectedItem.model.geometry : W.geometryEditing.activeEditor.navigationPoint.lonlat.toPoint();
		segments = W.model.segments.objects;
		for (i in segments) {
			s = W.model.segments.get(i);
			if (inMapExtent(s)) {
				if (selectedItem.model.isPoint()) {
					distanceToSegment = selectedItem.geometry.distanceTo(s.geometry, {
							details : true
						});
				} else {
					distanceToSegment = W.geometryEditing.activeEditor.navigationPoint.lonlat.toPoint().distanceTo(s.geometry, {
							details : true
						});
				}
				if (distanceToSegment.distance < minDistance) {
					minDistance = distanceToSegment.distance;
					closestSegment.seg = i;
					closestSegment.point = new OL.Geometry.Point(distanceToSegment.x1, distanceToSegment.y1);
				}
			}
		}
		/* console.log(minDistance, closestSegment); */
		drawLine(closestSegment.featureStop, closestSegment.point);
	}

	function checkSelection() {
		"use strict";
		var selectedItem,
		navPoint;

		//console.log("Selection change called.");

		if (W.selectionManager.hasSelectedItems()) {
			selectedItem = W.selectionManager.selectedItems[0];
			if ('venue' !== selectedItem.model.type) {
				//console.log('Selection is not a place.');
				return;
			}
		} else {
			//console.log('No item selected.');
			return clearLayerFeatures();
		}

		if (selectedItem.model.isPoint()) {
			//console.log('Selection is point venue.');
			findNearestSegment();
		} else {
			//console.log('Selection is area venue');
			navPoint = W.geometryEditing.activeEditor.navigationPoint;
			if (null !== typeof navPoint && 'undefined' !== typeof navPoint) {
				findNearestSegment();
				navPoint.events.register("drag", W.geometryEditing.activeEditor, findNearestSegment);
			}
		}
	}

	function init() {
		"use strict";
		var alertUpdate = true,
		closestVersion = "0.8",
		closestChanges = "WME Closest Segment has been updated to version " +
			closestVersion + ".\n" +
			"*First published version--beta" +
			"*";

		/* Check version and alert on update */
		if (alertUpdate && ('undefined' === window.localStorage.closestVersion ||
				closestVersion !== window.localStorage.closestVersion)) {
			alert(closestChanges);
			window.localStorage.closestVersion = closestVersion;
		}

		/* Event listeners */
		W.loginManager.events.register("afterloginchanged", this, init);
		W.model.actionManager.events.register("afterundoaction", this, clearLayerFeatures);
		W.selectionManager.events.register("selectionchanged", this, checkSelection);

		W.geometryEditing.editors.venue.dragControl.onDrag = function (e, t) {
			W.geometryEditing.activeEditor.dragVertex.apply(W.geometryEditing.activeEditor, [e, t]);
			findNearestSegment();
		};

		/* Add map layer */
		W.map.addLayer(new OL.Layer.Vector("Closest Segment"));
		console.log('WME CS: Initialized.');
	}

	function bootstrap() {
		var bGreasemonkeyServiceDefined = false;
		try {
			if ("object" === typeof Components.interfaces.gmIGreasemonkeyService) {
				bGreasemonkeyServiceDefined = true;
			}
		} catch (err) {
			/* Ignore. */
		}
		if ("undefined" === typeof unsafeWindow || !bGreasemonkeyServiceDefined) {
			unsafeWindow = (function () {
				var dummyElem = document.createElement('p');
				dummyElem.setAttribute('onclick', 'return window;');
				return dummyElem.onclick();
			})();
		}
		/* begin running the code! */
		if (('undefined' !== typeof W.loginManager.events.register) &&
			('undefined' !== typeof W.map)) {
			console.log('WME CS: Initializing...');
			window.setTimeout(init, 100);
		} else {
			console.log('WME CS: Bootstrap failed. Trying again...');
			window.setTimeout(function () {
				bootstrap();
			}, 1000);
		}
	}
	console.log('WME CS: Bootstrap...');
	window.setTimeout(bootstrap, 100);
})();
