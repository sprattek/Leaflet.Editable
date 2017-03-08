/*
08.03.2017 - Middlemarker fix
*/


'use strict';
L.Editable = L.Class.extend({

    includes: [L.Mixin.Events],

    statics: {
        FORWARD: 1,
        BACKWARD: -1
    },

    options: {
        zIndex: 1000,
        polygonClass: L.Polygon,
        polylineClass: L.Polyline,
        markerClass: L.Marker,
        rectangleClass: L.Rectangle,
        circleClass: L.Circle,
        drawingCSSClass: 'leaflet-editable-drawing',
        drawingCursor: 'crosshair'
    },

    initialize: function (map, options) {
        L.setOptions(this, options);
        this._lastZIndex = this.options.zIndex;
        this.map = map;
        this.editLayer = this.createEditLayer();
        this.featuresLayer = this.createFeaturesLayer();
        this.forwardLineGuide = this.createLineGuide();
        this.backwardLineGuide = this.createLineGuide();
    },

    fireAndForward: function (type, e) {
        e = e || {};
        e.editTools = this;
        this.fire(type, e);
        this.map.fire(type, e);
    },

    createLineGuide: function () {
        var options = L.extend({dashArray: '5,10', weight: 1, interactive: false}, this.options.lineGuideOptions);
        return L.polyline([], options);
    },

    createVertexIcon: function (options) {
        return L.Browser.touch ? new L.Editable.TouchVertexIcon(options) : new L.Editable.VertexIcon(options);
    },

    createEditLayer: function () {
        return this.options.editLayer || new L.LayerGroup().addTo(this.map);
    },

    createFeaturesLayer: function () {
        return this.options.featuresLayer || new L.LayerGroup().addTo(this.map);
    },

    moveForwardLineGuide: function (latlng) {
        if (this.forwardLineGuide._latlngs.length) {
            this.forwardLineGuide._latlngs[1] = latlng;
            this.forwardLineGuide._bounds.extend(latlng);
            this.forwardLineGuide.redraw();
        }
    },

    moveBackwardLineGuide: function (latlng) {
        if (this.backwardLineGuide._latlngs.length) {
            this.backwardLineGuide._latlngs[1] = latlng;
            this.backwardLineGuide._bounds.extend(latlng);
            this.backwardLineGuide.redraw();
        }
    },

    anchorForwardLineGuide: function (latlng) {
        this.forwardLineGuide._latlngs[0] = latlng;
        this.forwardLineGuide._bounds.extend(latlng);
        this.forwardLineGuide.redraw();
    },

    anchorBackwardLineGuide: function (latlng) {
        this.backwardLineGuide._latlngs[0] = latlng;
        this.backwardLineGuide._bounds.extend(latlng);
        this.backwardLineGuide.redraw();
    },

    attachForwardLineGuide: function () {
        this.editLayer.addLayer(this.forwardLineGuide);
    },

    attachBackwardLineGuide: function () {
        this.editLayer.addLayer(this.backwardLineGuide);
    },

    detachForwardLineGuide: function () {
        this.forwardLineGuide.setLatLngs([]);
        this.editLayer.removeLayer(this.forwardLineGuide);
    },

    detachBackwardLineGuide: function () {
        this.backwardLineGuide.setLatLngs([]);
        this.editLayer.removeLayer(this.backwardLineGuide);
    },

    blockEvents: function () {
        // Hack: force map not to listen to other layers events while drawing.
        if (!this._oldTargets) {
            this._oldTargets = this.map._targets;
            this.map._targets = {};
        }
    },

    unblockEvents: function () {
        if (this._oldTargets) {
            // Reset, but keep targets created while drawing.
            this.map._targets = L.extend(this.map._targets, this._oldTargets);
            delete this._oldTargets;
        }
    },

    registerForDrawing: function (editor) {
        if (this._drawingEditor) this.unregisterForDrawing(this._drawingEditor);
        this.map.on('mousemove touchmove', editor.onDrawingMouseMove, editor);
        this.blockEvents();
        this._drawingEditor = editor;
        this.map.on('mousedown', this.onMousedown, this);
        this.map.on('mouseup', this.onMouseup, this);
        L.DomUtil.addClass(this.map._container, this.options.drawingCSSClass);
        this.defaultMapCursor = this.map._container.style.cursor;
        this.map._container.style.cursor = this.options.drawingCursor;
    },

    unregisterForDrawing: function (editor) {
        this.unblockEvents();
        L.DomUtil.removeClass(this.map._container, this.options.drawingCSSClass);
        this.map._container.style.cursor = this.defaultMapCursor;
        editor = editor || this._drawingEditor;
        if (!editor) return;
        this.map.off('mousemove touchmove', editor.onDrawingMouseMove, editor);
        this.map.off('mousedown', this.onMousedown, this);
        this.map.off('mouseup', this.onMouseup, this);
        if (editor !== this._drawingEditor) return;
        delete this._drawingEditor;
        if (editor._drawing) editor.cancelDrawing();
    },

    onMousedown: function (e) {
        this._mouseDown = e;
        this._drawingEditor.onDrawingMouseDown(e);
    },

    onMouseup: function (e) {
        if (this._mouseDown) {
            var origin = L.point(this._mouseDown.originalEvent.clientX, this._mouseDown.originalEvent.clientY);
            var distance = L.point(e.originalEvent.clientX, e.originalEvent.clientY).distanceTo(origin);
            if (Math.abs(distance) < 9 * (window.devicePixelRatio || 1)) this._drawingEditor.onDrawingClick(e);
            else this._drawingEditor.onDrawingMouseUp(e);
        }
        this._mouseDown = null;
    },

    drawing: function () {
        return this._drawingEditor && this._drawingEditor.drawing();
    },

    stopDrawing: function () {
        this.unregisterForDrawing();
    },

    commitDrawing: function (e) {
        if (!this._drawingEditor) return;
        this._drawingEditor.commitDrawing(e);
    },

    connectCreatedToMap: function (layer) {
        return this.featuresLayer.addLayer(layer);
    },

    startPolyline: function (latlng, options) {
        var line = this.createPolyline([], options);
        line.enableEdit(this.map).newShape(latlng);
        return line;
    },

    startPolygon: function (latlng, options) {
        var polygon = this.createPolygon([], options);
        polygon.enableEdit(this.map).newShape(latlng);
        return polygon;
    },

    startMarker: function (latlng, options) {
        latlng = latlng || this.map.getCenter().clone();
        var marker = this.createMarker(latlng, options);
        marker.enableEdit(this.map).startDrawing();
        return marker;
    },

    startRectangle: function(latlng, options) {
        var corner = latlng || L.latLng([0, 0]);
        var bounds = new L.LatLngBounds(corner, corner);
        var rectangle = this.createRectangle(bounds, options);
        rectangle.enableEdit(this.map).startDrawing();
        return rectangle;
    },

    startCircle: function (latlng, options) {
        latlng = latlng || this.map.getCenter().clone();
        var circle = this.createCircle(latlng, options);
        circle.enableEdit(this.map).startDrawing();
        return circle;
    },

    startHole: function (editor, latlng) {
        editor.newHole(latlng);
    },

    createLayer: function (klass, latlngs, options) {
        options = L.Util.extend({editOptions: {editTools: this}}, options);
        var layer = new klass(latlngs, options);
        this.fireAndForward('editable:created', {layer: layer});
        return layer;
    },

    createPolyline: function (latlngs, options) {
        return this.createLayer(options && options.polylineClass || this.options.polylineClass, latlngs, options);
    },

    createPolygon: function (latlngs, options) {
        return this.createLayer(options && options.polygonClass || this.options.polygonClass, latlngs, options);
    },

    createMarker: function (latlng, options) {
        return this.createLayer(options && options.markerClass || this.options.markerClass, latlng, options);
    },

    createRectangle: function (bounds, options) {
        return this.createLayer(options && options.rectangleClass || this.options.rectangleClass, bounds, options);
    },

    createCircle: function (latlng, options) {
        return this.createLayer(options && options.circleClass || this.options.circleClass, latlng, options);
    }

});

L.extend(L.Editable, {

    makeCancellable: function (e) {
        e.cancel = function () {
            e._cancelled = true;
        };
    }

});

L.Map.mergeOptions({
    editToolsClass: L.Editable
});

L.Map.addInitHook(function () {

    this.whenReady(function () {
        if (this.options.editable) {
            this.editTools = new L.Editable(this, this.options.editOptions);
        }
    });

});

L.Editable.VertexIcon = L.DivIcon.extend({

    options: {
        iconSize: new L.Point(8, 8)
    }

});

L.Editable.TouchVertexIcon = L.Editable.VertexIcon.extend({

    options: {
        iconSize: new L.Point(20, 20)
    }

});


L.Editable.VertexMarker = L.Marker.extend({

    options: {
        draggable: true,
        className: 'leaflet-div-icon leaflet-vertex-icon'
    },

    initialize: function (latlng, latlngs, editor, options) {
        // We don't use this._latlng, because on drag Leaflet replace it while
        // we want to keep reference.
        this.latlng = latlng;
        this.latlngs = latlngs;
        this.editor = editor;
        L.Marker.prototype.initialize.call(this, latlng, options);
        this.options.icon = this.editor.tools.createVertexIcon({className: this.options.className});
        this.latlng.__vertex = this;
        this.editor.editLayer.addLayer(this);
        this.setZIndexOffset(editor.tools._lastZIndex + 1);
    },

    onAdd: function (map) {
        L.Marker.prototype.onAdd.call(this, map);
        this.on('drag', this.onDrag);
        this.on('dragstart', this.onDragStart);
        this.on('dragend', this.onDragEnd);
        this.on('mouseup', this.onMouseup);
        this.on('click', this.onClick);
        this.on('contextmenu', this.onContextMenu);
        this.on('mousedown touchstart', this.onMouseDown);
        this.addMiddleMarkers();
    },

    onRemove: function (map) {
        if (this.middleMarker) this.middleMarker.delete();
        delete this.latlng.__vertex;
        this.off('drag', this.onDrag);
        this.off('dragstart', this.onDragStart);
        this.off('dragend', this.onDragEnd);
        this.off('mouseup', this.onMouseup);
        this.off('click', this.onClick);
        this.off('contextmenu', this.onContextMenu);
        this.off('mousedown touchstart', this.onMouseDown);
        L.Marker.prototype.onRemove.call(this, map);
    },

    onDrag: function (e) {
        e.vertex = this;
        this.editor.onVertexMarkerDrag(e);
        var iconPos = L.DomUtil.getPosition(this._icon),
          latlng = this._map.layerPointToLatLng(iconPos);
        this.latlng.update(latlng);
        this._latlng = this.latlng;  // Push back to Leaflet our reference.
        this.editor.refresh();
        if (this.middleMarker) {
            this.middleMarker.updateLatLng();
        }
        var next = this.getNext();
        if (next && next.middleMarker) {
            next.middleMarker.updateLatLng();
        }
    },

    onDragStart: function (e) {
        e.vertex = this;
        this.editor.onVertexMarkerDragStart(e);
    },

    onDragEnd: function (e) {
        e.vertex = this;
        this.editor.onVertexMarkerDragEnd(e);
    },

    onClick: function (e) {
        e.vertex = this;
        this.editor.onVertexMarkerClick(e);
    },

    onMouseup: function (e) {
        L.DomEvent.stop(e);
        e.vertex = this;
        this.editor.map.fire('mouseup', e);
    },

    onContextMenu: function (e) {
        e.vertex = this;
        this.editor.onVertexMarkerContextMenu(e);
    },

    onMouseDown: function (e) {
        e.vertex = this;
        this.editor.onVertexMarkerMouseDown(e);
    },

    delete: function () {
        var next = this.getNext();  // Compute before changing latlng
        this.latlngs.splice(this.getIndex(), 1);
        this.editor.editLayer.removeLayer(this);
        this.editor.onVertexDeleted({latlng: this.latlng, vertex: this});
        if (!this.latlngs.length) this.editor.deleteShape(this.latlngs);
        if (next) next.resetMiddleMarker();
        this.editor.refresh();
    },

    getIndex: function () {
        return this.latlngs.indexOf(this.latlng);
    },

    getLastIndex: function () {
        return this.latlngs.length - 1;
    },

    getPrevious: function () {
        if (this.latlngs.length < 2) return;
        var index = this.getIndex(),
          previousIndex = index - 1;
        if (index === 0 && this.editor.CLOSED) previousIndex = this.getLastIndex();
        var previous = this.latlngs[previousIndex];
        if (previous) return previous.__vertex;
    },

    getNext: function () {
        if (this.latlngs.length < 2) return;
        var index = this.getIndex(),
          nextIndex = index + 1;
        if (index === this.getLastIndex() && this.editor.CLOSED) nextIndex = 0;
        var next = this.latlngs[nextIndex];
        if (next) return next.__vertex;
    },

    addMiddleMarker: function (previous) {
        if (!this.editor.hasMiddleMarkers()) return;
        previous = previous || this.getPrevious();
        if (previous && !this.middleMarker) this.middleMarker = this.editor.addMiddleMarker(previous, this, this.latlngs, this.editor);
    },

    addMiddleMarkers: function () {
        if (!this.editor.hasMiddleMarkers()) return;
        var previous = this.getPrevious();
        if (previous) {
            this.addMiddleMarker(previous);
        }
        var next = this.getNext();
        if (next) {
            next.resetMiddleMarker();
        }
    },

    resetMiddleMarker: function () {
        if (this.middleMarker) this.middleMarker.delete();
        this.addMiddleMarker();
    },

    split: function () {
        if (!this.editor.splitShape) return;  // Only for PolylineEditor
        this.editor.splitShape(this.latlngs, this.getIndex());
    },

    continue: function () {
        if (!this.editor.continueBackward) return;  // Only for PolylineEditor
        var index = this.getIndex();
        if (index === 0) this.editor.continueBackward(this.latlngs);
        else if (index === this.getLastIndex()) this.editor.continueForward(this.latlngs);
    }

});


L.Editable.mergeOptions({
    vertexMarkerClass: L.Editable.VertexMarker
});

L.Editable.MiddleMarker = L.Marker.extend({

    options: {
        opacity: 0.5,
        className: 'leaflet-div-icon leaflet-middle-icon'
    },

    initialize: function (left, right, latlngs, editor, options) {
        this.left = left;
        this.right = right;
        this.editor = editor;
        this.latlngs = latlngs;
        L.Marker.prototype.initialize.call(this, this.computeLatLng(), options);
        this._opacity = this.options.opacity;
        this.options.icon = this.editor.tools.createVertexIcon({className: this.options.className});
        this.editor.editLayer.addLayer(this);
        this.setVisibility();
    },

    setVisibility: function () {
        var leftPoint = this._map.latLngToContainerPoint(this.left.latlng),
          rightPoint = this._map.latLngToContainerPoint(this.right.latlng),
          size = L.point(this.options.icon.options.iconSize);
        if (leftPoint.distanceTo(rightPoint) < size.x * 3) {
            this.hide();
        } else {
            this.show();
        }
    },

    show: function () {
        this.setOpacity(this._opacity);
    },

    hide: function () {
        this.setOpacity(0);
    },

    updateLatLng: function () {
        this.setLatLng(this.computeLatLng());
        this.setVisibility();
    },

    computeLatLng: function () {
        var leftPoint = this.editor.map.latLngToContainerPoint(this.left.latlng),
          rightPoint = this.editor.map.latLngToContainerPoint(this.right.latlng),
          y = (leftPoint.y + rightPoint.y) / 2,
          x = (leftPoint.x + rightPoint.x) / 2;
        return this.editor.map.containerPointToLatLng([x, y]);
    },

    onAdd: function (map) {
        L.Marker.prototype.onAdd.call(this, map);
        this.on('mousedown touchstart', this.onMouseDown);
        map.on('zoomend', this.setVisibility, this);
    },

    onRemove: function (map) {
        delete this.right.middleMarker;
        this.off('mousedown touchstart', this.onMouseDown);
        map.off('zoomend', this.setVisibility, this);
        L.Marker.prototype.onRemove.call(this, map);
    },

    onMouseDown: function (e) {
        this.editor.onMiddleMarkerMouseDown(e, this);
        this.latlngs.splice(this.index(), 0, e.latlng);
        this.editor.refresh();
        var marker = this.editor.addVertexMarker(e.latlng, this.latlngs);
        marker.dragging._draggable._onDown(e.originalEvent);  // Transfer ongoing dragging to real marker
        this.delete();
    },

    delete: function () {
        this.editor.editLayer.removeLayer(this);
    },

    index: function () {
        return this.latlngs.indexOf(this.right.latlng);
    },

    _initInteraction: function () {
        L.Marker.prototype._initInteraction.call(this);
        L.DomEvent.on(this._icon, 'touchstart', function (e) {this._fireMouseEvent(e);}, this);
    }

});

L.Editable.mergeOptions({
    middleMarkerClass: L.Editable.MiddleMarker
});

L.Editable.BaseEditor = L.Class.extend({

    initialize: function (map, feature, options) {
        L.setOptions(this, options);
        this.map = map;
        this.feature = feature;
        this.feature.editor = this;
        this.editLayer = new L.LayerGroup();
        this.tools = this.options.editTools || map.editTools;
    },

    enable: function () {
        if (this._enabled) return this;
        if (this.isConnected()) this.tools.editLayer.addLayer(this.editLayer);
        this.onEnable();
        this._enabled = true;
        this.feature.on('remove', this.disable, this);
        return this;
    },

    disable: function () {
        this.feature.off('remove', this.disable, this);
        this.editLayer.clearLayers();
        this.tools.editLayer.removeLayer(this.editLayer);
        this.onDisable();
        delete this._enabled;
        if (this._drawing) this.cancelDrawing();
        return this;
    },

    drawing: function () {
        return !!this._drawing;
    },

    hasMiddleMarkers: function () {
        return !this.options.skipMiddleMarkers && !this.tools.options.skipMiddleMarkers;
    },

    fireAndForward: function (type, e) {
        e = e || {};
        e.layer = this.feature;
        this.feature.fire(type, e);
        this.tools.fireAndForward(type, e);
    },

    onEnable: function () {
        this.fireAndForward('editable:enable');
    },

    onDisable: function () {
        this.fireAndForward('editable:disable');
    },

    onEditing: function () {
        this.fireAndForward('editable:editing');
    },

    onStartDrawing: function () {
        this.fireAndForward('editable:drawing:start');
    },

    onEndDrawing: function () {
        this.fireAndForward('editable:drawing:end');
    },

    onCancelDrawing: function () {
        this.fireAndForward('editable:drawing:cancel');
    },

    onCommitDrawing: function (e) {
        this.fireAndForward('editable:drawing:commit', e);
    },

    onDrawingMouseDown: function (e) {
        this.fireAndForward('editable:drawing:mousedown', e);
    },

    onDrawingMouseUp: function (e) {
        this.fireAndForward('editable:drawing:mouseup', e);
    },

    startDrawing: function () {
        if (!this._drawing) this._drawing = L.Editable.FORWARD;
        this.tools.registerForDrawing(this);
        this.onStartDrawing();
    },

    commitDrawing: function (e) {
        this.onCommitDrawing(e);
        this.endDrawing();
    },

    cancelDrawing: function () {
        this.onCancelDrawing();
        this.endDrawing();
    },

    endDrawing: function () {
        this._drawing = false;
        this.tools.unregisterForDrawing(this);
        this.onEndDrawing();
    },

    onDrawingClick: function (e) {
        if (!this.drawing) return;
        L.Editable.makeCancellable(e);
        this.fireAndForward('editable:drawing:click', e);
        if (e._cancelled) return;
        if (!this.isConnected()) this.connect(e);
        this.processDrawingClick(e);
    },

    isConnected: function () {
        return this.map.hasLayer(this.feature);
    },

    connect: function (e) {
        this.tools.connectCreatedToMap(this.feature);
        this.tools.editLayer.addLayer(this.editLayer);
    },

    onMove: function (e) {
        this.fireAndForward('editable:drawing:move', e);
    },

    onDrawingMouseMove: function (e) {
        this.onMove(e);
    }

});

L.Editable.MarkerEditor = L.Editable.BaseEditor.extend({

    enable: function () {
        if (this._enabled) return this;
        L.Editable.BaseEditor.prototype.enable.call(this);
        this.feature.dragging.enable();
        this.feature.on('dragstart', this.onEditing, this);
        return this;
    },

    disable: function () {
        L.Editable.BaseEditor.prototype.disable.call(this);
        this.feature.dragging.disable();
        this.feature.off('dragstart', this.onEditing, this);
        return this;
    },

    onMouseMove: function (e) {
        if (this.drawing) {
            L.Editable.BaseEditor.prototype.onMouseMove.call(this, e);
            this.feature.setLatLng(e.latlng);
            this.tools.newClickHandler._bringToFront();
        }
    },

    onNewClickHandlerClicked: function (e) {
        if (!this.isNewClickValid(e.latlng)) return;
        // Send event before finishing drawing
        L.Editable.BaseEditor.prototype.onNewClickHandlerClicked.call(this, e);
        this.commitDrawing();
    }

});

L.Editable.PathEditor = L.Editable.BaseEditor.extend({

    CLOSED: false,
    MIN_VERTEX: 2,

    enable: function () {
        if (this._enabled) return this;
        L.Editable.BaseEditor.prototype.enable.call(this);
        if (this.feature) {
            this.initVertexMarkers();
        }
        return this;
    },

    disable: function () {
        return L.Editable.BaseEditor.prototype.disable.call(this);
    },

    initVertexMarkers: function () {
        // groups can be only latlngs (for polyline or symple polygon,
        // or latlngs plus many holes, in case of a complex polygon)
        var latLngGroups = this.getLatLngsGroups();
        for (var i = 0; i < latLngGroups.length; i++) {
            this.addVertexMarkers(latLngGroups[i]);
        }
    },

    getLatLngsGroups: function () {
        return [this.getLatLngs()];
    },

    getLatLngs: function () {
        return this.feature.getLatLngs();
    },

    reset: function () {
        this.editLayer.clearLayers();
        this.initVertexMarkers();
    },

    addVertexMarker: function (latlng, latlngs) {
        return new this.tools.options.vertexMarkerClass(latlng, latlngs, this);
    },

    addVertexMarkers: function (latlngs) {
        for (var i = 0; i < latlngs.length; i++) {
            this.addVertexMarker(latlngs[i], latlngs);
        }
    },

    addMiddleMarker: function (left, right, latlngs) {
        return new this.tools.options.middleMarkerClass(left, right, latlngs, this);
    },

    onVertexMarkerClick: function (e) {
        var index = e.vertex.getIndex();
        if (e.originalEvent.ctrlKey) {
            this.onVertexMarkerCtrlClick(e);
        } else if (e.originalEvent.altKey) {
            this.onVertexMarkerAltClick(e);
        } else if (e.originalEvent.shiftKey) {
            this.onVertexMarkerShiftClick(e);
        } else if (index >= this.MIN_VERTEX - 1 && index === e.vertex.getLastIndex() && this.drawing === L.Editable.FORWARD) {
            this.commitDrawing();
        } else if (index === 0 && this.drawing === L.Editable.BACKWARD && this._drawnLatLngs.length >= this.MIN_VERTEX) {
            this.commitDrawing();
        } else if (index === 0 && this.drawing === L.Editable.FORWARD && this._drawnLatLngs.length >= this.MIN_VERTEX && this.CLOSED) {
            this.commitDrawing();  // Allow to close on first point also for polygons
        } else {
            this.onVertexRawMarkerClick(e);
        }
    },

    onVertexRawMarkerClick: function (e) {
        if (!this.vertexCanBeDeleted(e.vertex)) return;
        e.vertex.delete();
        this.refresh();
    },

    vertexCanBeDeleted: function (vertex) {
        return vertex.latlngs.length > this.MIN_VERTEX;
    },

    onVertexDeleted: function (e) {
        this.fireAndForward('editable:vertex:deleted', e);
    },

    onVertexMarkerCtrlClick: function (e) {
        this.fireAndForward('editable:vertex:ctrlclick', e);
    },

    onVertexMarkerShiftClick: function (e) {
        this.fireAndForward('editable:vertex:shiftclick', e);
    },

    onVertexMarkerAltClick: function (e) {
        this.fireAndForward('editable:vertex:altclick', e);
    },

    onVertexMarkerContextMenu: function (e) {
        this.fireAndForward('editable:vertex:contextmenu', e);
    },

    onVertexMarkerMouseDown: function (e) {
        this.fireAndForward('editable:vertex:mousedown', e);
    },

    onMiddleMarkerMouseDown: function (e) {
        this.fireAndForward('editable:middlemarker:mousedown', e);
    },

    onVertexMarkerDrag: function (e) {
        this.fireAndForward('editable:vertex:drag', e);
    },

    onVertexMarkerDragStart: function (e) {
        this.fireAndForward('editable:vertex:dragstart', e);
    },

    onVertexMarkerDragEnd: function (e) {
        this.fireAndForward('editable:vertex:dragend', e);
    },

    startDrawing: function () {
        if (!this._drawnLatLngs) this._drawnLatLngs = this.getLatLngs();
        L.Editable.BaseEditor.prototype.startDrawing.call(this);
    },

    startDrawingForward: function () {
        this.startDrawing();
        this.tools.attachForwardLineGuide();
    },

    endDrawing: function () {
        L.Editable.BaseEditor.prototype.endDrawing.call(this);
        this.tools.detachForwardLineGuide();
        this.tools.detachBackwardLineGuide();
        delete this._drawnLatLngs;
    },

    addLatLng: function (latlng) {
        if (this.drawing === L.Editable.FORWARD) this._drawnLatLngs.push(latlng);
        else this._drawnLatLngs.unshift(latlng);
        this.refresh();
        this.addVertexMarker(latlng, this._drawnLatLngs);
    },

    newPointForward: function (latlng) {
        this.addLatLng(latlng);
        this.tools.anchorForwardLineGuide(latlng);
        if (!this.tools.backwardLineGuide._latlngs[0]) {
            this.tools.anchorBackwardLineGuide(latlng);
        }
    },

    newPointBackward: function (latlng) {
        this.addLatLng(latlng);
        this.tools.anchorBackwardLineGuide(latlng);
    },

    onNewClickHandlerClicked: function (e) {
        if (!this.isNewClickValid(e.latlng)) return;
        if (this.drawing === L.Editable.FORWARD) this.newPointForward(e.latlng);
        else this.newPointBackward(e.latlng);
        L.Editable.BaseEditor.prototype.onNewClickHandlerClicked.call(this, e);
    },

    onMouseMove: function (e) {
        if (this.drawing) {
            L.Editable.BaseEditor.prototype.onMouseMove.call(this, e);
            this.tools.moveForwardLineGuide(e.latlng);
            this.tools.moveBackwardLineGuide(e.latlng);
        }
    },

    refresh: function () {
        this.feature.redraw();
        this.onEditing();
    }

});

L.Editable.PolylineEditor = L.Editable.PathEditor.extend({

    startDrawingBackward: function () {
        this.drawing = L.Editable.BACKWARD;
        this.startDrawing();
        this.tools.attachBackwardLineGuide();
    },

    continueBackward: function () {
        this.tools.anchorBackwardLineGuide(this.getFirstLatLng());
        this.startDrawingBackward();
    },

    continueForward: function () {
        this.tools.anchorForwardLineGuide(this.getLastLatLng());
        this.startDrawingForward();
    },

    getLastLatLng: function () {
        return this.getLatLngs()[this.getLatLngs().length - 1];
    },

    getFirstLatLng: function () {
        return this.getLatLngs()[0];
    }

});

L.Editable.PolygonEditor = L.Editable.PathEditor.extend({

    CLOSED: true,
    MIN_VERTEX: 3,

    getLatLngsGroups: function () {
        var groups = L.Editable.PathEditor.prototype.getLatLngsGroups.call(this);
        if (this.feature._holes) {
            for (var i = 0; i < this.feature._holes.length; i++) {
                groups.push(this.feature._holes[i]);
            }
        }
        return groups;
    },

    startDrawingForward: function () {
        L.Editable.PathEditor.prototype.startDrawingForward.call(this);
        this.tools.attachBackwardLineGuide();
    },

    addNewEmptyHole: function () {
        var holes = Array();
        if (!this.feature._holes) {
            this.feature._holes = [];
        }
        this.feature._holes.push(holes);
        return holes;
    },

    newHole: function (latlng) {
        this._drawnLatLngs = this.addNewEmptyHole();
        this.startDrawingForward();
        if (latlng) this.newPointForward(latlng);
    },

    checkContains: function (latlng) {
        return this.feature._containsPoint(this.map.latLngToLayerPoint(latlng));
    },

    vertexCanBeDeleted: function (vertex) {
        if (vertex.latlngs === this.getLatLngs()) return L.Editable.PathEditor.prototype.vertexCanBeDeleted.call(this, vertex);
        else return true;  // Holes can be totally deleted without removing the layer itself
    },

    isNewClickValid: function (latlng) {
        if (this._drawnLatLngs !== this.getLatLngs()) return this.checkContains(latlng);
        return true;
    },

    onVertexDeleted: function (e) {
        L.Editable.PathEditor.prototype.onVertexDeleted.call(this, e);
        if (!e.vertex.latlngs.length && e.vertex.latlngs !== this.getLatLngs()) {
            this.feature._holes.splice(this.feature._holes.indexOf(e.vertex.latlngs), 1);
        }
    }

});

L.Editable.CircleEditor = L.Editable.PathEditor.extend({

    MIN_VERTEX: 2,

    options: {
        skipMiddleMarkers: true
    },

    initialize: function (map, feature, options) {
        L.Editable.PathEditor.prototype.initialize.call(this, map, feature, options);
        this._resizeLatLng = this.computeResizeLatLng();
    },

    computeResizeLatLng: function () {
        // While circle is not added to the map, _radius is not set.
        var delta = (this.feature._radius || this.feature._mRadius) * Math.cos(Math.PI / 4),
          point = this.map.project(this.feature._latlng);
        return this.map.unproject([point.x + delta, point.y - delta]);
    },

    updateResizeLatLng: function () {
        this._resizeLatLng.update(this.computeResizeLatLng());
        this._resizeLatLng.__vertex.update();
    },

    getLatLngs: function () {
        return [this.feature._latlng, this._resizeLatLng];
    },

    getDefaultLatLngs: function () {
        return this.getLatLngs();
    },

    onVertexMarkerDrag: function (e) {
        if (e.vertex.getIndex() === 1) this.resize(e);
        else this.updateResizeLatLng(e);
        L.Editable.PathEditor.prototype.onVertexMarkerDrag.call(this, e);
    },

    resize: function (e) {
        var radius = this.feature._latlng.distanceTo(e.target.latlng);
        this.feature.setRadius(radius);
    },

    onDrawingMouseDown: function (e) {
        L.Editable.PathEditor.prototype.onDrawingMouseDown.call(this, e);
        this._resizeLatLng.update(e.target.latlng);
        this.feature._latlng.update(e.target.latlng);
        this.connect();
        this.commitDrawing(e);
        // Stop dragging map.
        this.map.dragging._draggable._onUp(e.originalEvent);
        // Now transfer ongoing drag action to the radius handler.
        this._resizeLatLng.__vertex.dragging._draggable._onDown(e.originalEvent);
    },

    onDrawingMouseMove: function (e) {
        L.Editable.BaseEditor.prototype.onDrawingMouseMove.call(this, e);
        this.feature._latlng.update(e.target.latlng);
        this.feature._latlng.__vertex.update();
    }

});


L.Map.mergeOptions({
    polylineEditorClass: L.Editable.PolylineEditor
});

L.Map.mergeOptions({
    polygonEditorClass: L.Editable.PolygonEditor
});

L.Map.mergeOptions({
    markerEditorClass: L.Editable.MarkerEditor
});

L.Map.mergeOptions({
    circleEditorClass: L.Editable.CircleEditor
});

var EditableMixin = {

    createEditor: function (map) {
        map = map || this._map;
        var Klass = this.options.editorClass || this.getEditorClass(map);
        return new Klass(map, this, this.options.editOptions);
    },

    enableEdit: function () {
        if (!this.editor) this.createEditor();
        if (this.multi) this.multi.onEditEnabled();
        return this.editor.enable();
    },

    editEnabled: function () {
        return this.editor && this.editor._enabled;
    },

    disableEdit: function () {
        if (this.editor) {
            if (this.multi) this.multi.onEditDisabled();
            this.editor.disable();
            delete this.editor;
        }
    },

    toggleEdit: function () {
        if (this.editEnabled()) {
            this.disableEdit();
        } else {
            this.enableEdit();
        }
    }

};

L.Polyline.include(EditableMixin);
L.Polygon.include(EditableMixin);
L.Marker.include(EditableMixin);
L.Circle.include(EditableMixin);

L.Polyline.include({

    _containsPoint: function (p, closed) {  // Copy-pasted from Leaflet
        var i, j, k, len, len2, dist, part,
          w = this.options.weight / 2;

        if (L.Browser.touch) {
            w += 10; // polyline click tolerance on touch devices
        }

        for (i = 0, len = this._parts.length; i < len; i++) {
            part = this._parts[i];
            for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
                if (!closed && (j === 0)) {
                    continue;
                }

                dist = L.LineUtil.pointToSegmentDistance(p, part[k], part[j]);

                if (dist <= w) {
                    return true;
                }
            }
        }
        return false;
    },

    getEditorClass: function (map) {
        return map.options.polylineEditorClass;
    }

});
L.Polygon.include({

    _containsPoint: function (p) {  // Copy-pasted from Leaflet
        var inside = false,
          part, p1, p2,
          i, j, k,
          len, len2;

        // TODO optimization: check if within bounds first

        if (L.Polyline.prototype._containsPoint.call(this, p, true)) {
            // click on polygon border
            return true;
        }

        // ray casting algorithm for detecting if point is in polygon

        for (i = 0, len = this._parts.length; i < len; i++) {
            part = this._parts[i];

            for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
                p1 = part[j];
                p2 = part[k];

                if (((p1.y > p.y) !== (p2.y > p.y)) &&
                  (p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
                    inside = !inside;
                }
            }
        }

        return inside;
    },

    getEditorClass: function (map) {
        return map.options.polygonEditorClass;
    }

});

L.Marker.include({

    getEditorClass: function (map) {
        return map.options.markerEditorClass;
    }

});

L.Circle.include({

    getEditorClass: function (map) {
        return (map && map.options.circleEditorClass) ? map.options.circleEditorClass : L.Editable.CircleEditor;
    }

});

L.LatLng.prototype.update = function (latlng) {
    this.lat = latlng.lat;
    this.lng = latlng.lng;
};

var MultiEditableMixin = {

    enableEdit: function () {
        this.eachLayer(function(layer) {
            layer.multi = this;
            layer.enableEdit();
        }, this);
    },

    disableEdit: function () {
        this.eachLayer(function(layer) {
            layer.disableEdit();
        });
    },

    toggleEdit: function (e) {
        if (!e.layer.editor) {
            this.enableEdit(e);
        } else {
            this.disableEdit();
        }
    },

    onEditEnabled: function () {
        if (!this._editEnabled) {
            this._editEnabled = true;
            this.fire('editable:multi:edit:enabled');
        }
    },

    onEditDisabled: function () {
        if (this._editEnabled) {
            this._editEnabled = false;
            this.fire('editable:multi:edit:disabled');
        }
    },

    editEnabled: function () {
        return !!this._editEnabled;
    }

};
L.MultiPolygon.include(MultiEditableMixin);
L.MultiPolyline.include(MultiEditableMixin);
