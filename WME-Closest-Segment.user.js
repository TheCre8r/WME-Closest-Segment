// ==UserScript==
// @name         	WME Closest Segment
// @description		Shows the closest segment to a place
// @version      	0.9
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
	var alertUpdate = true,
	closestVersion = "0.9",
	closestChanges = "WME Closest Segment has been updated to version " +
		closestVersion + ".\n" +
		"* Lots of performance optimizations \n" +
		"",
	closestLayerName = "WME Closest Segment",
	segmentsInExtent = {};

	function getSegmentsInExtent() {
		"use strict";
		var i,
		s,
		segments,
		mapExtent;
		
		if (!checkConditions()) return;
		
		console.log("WME CS: Getting segments in map extent.");
		
		segments = W.model.segments.objects;
		mapExtent = W.map.getExtent();
		segmentsInExtent = {};

		for (i in segments) {
			if (!segments.hasOwnProperty(i)) {
				continue;
			}
			s = W.model.segments.get(i);
			if (mapExtent.intersectsBounds(s.geometry.getBounds())) {
				segmentsInExtent[i] = s;
			}
		}
		return segmentsInExtent;
	}

	function clearLayerFeatures() {
		var layer = W.map.getLayersByName(closestLayerName)[0];
		return layer.features.length > 0 && layer.removeAllFeatures();
	}

	function checkConditions() {
		"use strict";
		var a = W.map.getZoom() > 3,
			b = W.map.landmarkLayer.getVisibility(),
			c = W.map.getLayersByName(closestLayerName)[0].getVisibility(),		
			navPoint = W.geometryEditing.editors.venue.navigationPoint;
		
		if (a && b && c) {
			W.geometryEditing.editors.venue.dragControl.onDrag = function (e, t) {
				W.geometryEditing.editors.venue.dragVertex.apply(W.geometryEditing.editors.venue, [e, t]);
				findNearestSegment();
			};
			/* console.log('WME CS: Enabled'); */
			return true;
		} else {
			W.geometryEditing.editors.venue.dragControl.onDrag = function (e, t) {
				W.geometryEditing.editors.venue.dragVertex.apply(W.geometryEditing.editors.venue, [e, t]);
			};
			if (null !== typeof navPoint && 'undefined' !== typeof navPoint) {
				try {
					navPoint.events.unregister("drag", W.geometryEditing.editors.venue, findNearestSegment);
				} catch (err) {}
			}
			clearLayerFeatures();
			/* console.log('WME CS: Disabled'); */
			return false;
		}
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
		W.map.getLayersByName(closestLayerName)[0].addFeatures([lineFeature, pointFeature]);
	}

	function findNearestSegment() {
		"use strict";
		var s,
		minDistance = Infinity,
		distanceToSegment,
		segments,
		selectedItem,
		closestSegment = {};

		selectedItem = W.selectionManager.selectedItems.first();
		closestSegment.featureStop = selectedItem.model.isPoint() ?
			selectedItem.model.geometry : W.geometryEditing.editors.venue.navigationPoint.lonlat.toPoint();
		segmentsInExtent = jQuery.isEmptyObject(segmentsInExtent) ? getSegmentsInExtent() : segmentsInExtent;
		
		for (s in segmentsInExtent) {
			if (!segmentsInExtent.hasOwnProperty(s))
				continue;
			if (selectedItem.model.isPoint()) {
				distanceToSegment = selectedItem.geometry.distanceTo(segmentsInExtent[s].geometry, {
						details : true
					});
			} else {
				distanceToSegment = W.geometryEditing.editors.venue.navigationPoint.lonlat.toPoint().distanceTo(
						segmentsInExtent[s].geometry, {
						details : true
					});
			}
			if (distanceToSegment.distance < minDistance) {
				minDistance = distanceToSegment.distance;
				closestSegment.seg = s;
				closestSegment.point = new OL.Geometry.Point(distanceToSegment.x1, distanceToSegment.y1);
			}
		}
		
		clearLayerFeatures();
		drawLine(closestSegment.featureStop, closestSegment.point);
	}

	function checkSelection() {
		"use strict";
		var selectedItem,
		navPoint;

		/* console.log("WME CS: Selection change called."); */

		if (!checkConditions()) return;
		
		if (W.selectionManager.hasSelectedItems()) {
			selectedItem = W.selectionManager.selectedItems[0];
			if ('venue' !== selectedItem.model.type) {
				/* console.log('WME CS: Selection is not a place.'); */
				return clearLayerFeatures();
			}
		} else {
			/* console.log('WME CS: No item selected.'); */
			return clearLayerFeatures();
		}
		
		if (selectedItem.model.isPoint()) {
			/* console.log('WME CS: Selection is point venue.'); */
			findNearestSegment();
		} else {
			/* console.log('WME CS: Selection is area venue'); */
			navPoint = W.geometryEditing.editors.venue.navigationPoint;
			if (null !== typeof navPoint && 'undefined' !== typeof navPoint) {
				findNearestSegment();
				navPoint.events.register("drag", W.geometryEditing.editors.venue, findNearestSegment);
			}
		}
	}

	function init() {
		"use strict";
		var closestLayer;

		/* Check version and alert on update */
		if (alertUpdate && ('undefined' === window.localStorage.closestVersion ||
				closestVersion !== window.localStorage.closestVersion)) {
			alert(closestChanges);
			window.localStorage.closestVersion = closestVersion;
		}

		/* Add map layer */
		closestLayer = new OL.Layer.Vector(closestLayerName);
		closestLayer.events.register("visibilitychanged", closestLayer, checkSelection);
		W.map.addLayer(closestLayer);

		/* Event listeners */
		W.loginManager.events.register("afterloginchanged", this, init);
		W.map.events.register("moveend", this, getSegmentsInExtent);
		W.model.actionManager.events.register("afterundoaction", this, checkSelection);
		W.model.actionManager.events.register("afteraction", this, checkSelection);
		W.selectionManager.events.register("selectionchanged", this, checkSelection);

		getSegmentsInExtent();
		checkSelection();

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
