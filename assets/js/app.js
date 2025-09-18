(function (wp) {
    'use strict';

    if (!wp || !wp.element) {
        return;
    }

    const { createElement: el, render, useCallback, useEffect, useRef, useState } = wp.element;

    const DEFAULT_STRINGS = {
        appTitle: 'Wood House Designer',
        shapesHeading: 'Cottages',
        actionsHeading: 'Actions',
        exportButton: 'Export PNG',
        ready: 'Ready. Use the toolbox to add elements.',
        exportSuccess: 'Project exported successfully.',
        exportUnavailable: 'Unable to export the project right now.',
        errorKonva: 'The drawing library is not available. Please refresh the page.',
        cursorStatus: 'Cursor: %x% × %y% m',
        selectedStatus: 'Selected %name% - %width%m × %depth%m × %height%m',
        cottageLabel: 'Cottage %width%m × %depth%m × %height%m',
        noCottages: 'No cottages configured yet.',
        designCanvas: 'Design Canvas',
        toolbox: 'Toolbox',
        viewTop: 'Top View',
        viewIso: 'Isometric View',
        viewToggleLabel: 'View mode',
        isoViewStatus: 'Isometric view active.',
        customHeading: 'Create custom cottage',
        sidesLabel: 'Number of sides',
        widthLabel: 'Width / bounding width (m)',
        depthLabel: 'Depth / bounding depth (m)',
        heightLabel: 'Height (m)',
        addPolygonButton: 'Add polygon',
        invalidPolygon: 'Please provide valid values for sides and dimensions.',
        customAdded: 'Custom cottage added to toolbox.'
    };

    const ISO_ANGLE = Math.PI / 6;
    const ISO_COS = Math.cos(ISO_ANGLE);
    const ISO_SIN = Math.sin(ISO_ANGLE);

    function projectIsometric(x, y, z) {
        return {
            x: (x - y) * ISO_COS,
            y: (x + y) * ISO_SIN - z
        };
    }

    function buildIsometricRectangleGeometry(widthPx, depthPx, heightPx) {
        const corners = {
            backLeftBottom: projectIsometric(0, 0, 0),
            backRightBottom: projectIsometric(widthPx, 0, 0),
            frontLeftBottom: projectIsometric(0, depthPx, 0),
            frontRightBottom: projectIsometric(widthPx, depthPx, 0),
            backLeftTop: projectIsometric(0, 0, heightPx),
            backRightTop: projectIsometric(widthPx, 0, heightPx),
            frontLeftTop: projectIsometric(0, depthPx, heightPx),
            frontRightTop: projectIsometric(widthPx, depthPx, heightPx)
        };

        const shiftX = -corners.frontLeftBottom.x;
        const shiftY = -corners.frontLeftBottom.y;

        const shifted = {};
        Object.keys(corners).forEach(function (key) {
            shifted[key] = {
                x: corners[key].x + shiftX,
                y: corners[key].y + shiftY
            };
        });

        const minY = Math.min.apply(null, Object.keys(shifted).map(function (key) {
            return shifted[key].y;
        }));

        const extraY = minY < 0 ? -minY : 0;
        Object.keys(shifted).forEach(function (key) {
            shifted[key].y += extraY;
        });

        const baseY = shifted.frontLeftBottom.y;
        Object.keys(shifted).forEach(function (key) {
            shifted[key].y -= baseY;
        });

        return {
            top: [
                shifted.backLeftTop.x, shifted.backLeftTop.y,
                shifted.backRightTop.x, shifted.backRightTop.y,
                shifted.frontRightTop.x, shifted.frontRightTop.y,
                shifted.frontLeftTop.x, shifted.frontLeftTop.y
            ],
            left: [
                shifted.backLeftTop.x, shifted.backLeftTop.y,
                shifted.frontLeftTop.x, shifted.frontLeftTop.y,
                shifted.frontLeftBottom.x, shifted.frontLeftBottom.y,
                shifted.backLeftBottom.x, shifted.backLeftBottom.y
            ],
            right: [
                shifted.backRightTop.x, shifted.backRightTop.y,
                shifted.frontRightTop.x, shifted.frontRightTop.y,
                shifted.frontRightBottom.x, shifted.frontRightBottom.y,
                shifted.backRightBottom.x, shifted.backRightBottom.y
            ],
            outline: [
                shifted.backLeftTop.x, shifted.backLeftTop.y,
                shifted.backRightTop.x, shifted.backRightTop.y,
                shifted.frontRightTop.x, shifted.frontRightTop.y,
                shifted.frontRightBottom.x, shifted.frontRightBottom.y,
                shifted.frontLeftBottom.x, shifted.frontLeftBottom.y,
                shifted.frontLeftTop.x, shifted.frontLeftTop.y,
                shifted.backLeftTop.x, shifted.backLeftTop.y,
                shifted.backLeftBottom.x, shifted.backLeftBottom.y,
                shifted.backRightBottom.x, shifted.backRightBottom.y
            ]
        };
    }

    function buildRegularPolygonPoints(sides, widthPx, depthPx) {
        const count = Math.max(3, Math.round(sides));
        const centerX = widthPx / 2;
        const centerY = depthPx / 2;
        const radiusX = widthPx / 2;
        const radiusY = depthPx / 2;
        const startAngle = -Math.PI / 2;
        const points = [];

        for (let index = 0; index < count; index++) {
            const angle = startAngle + (index * 2 * Math.PI) / count;
            const x = centerX + radiusX * Math.cos(angle);
            const y = centerY + radiusY * Math.sin(angle);
            points.push(x, y);
        }

        return points;
    }

    function buildIsometricPolygonGeometry(points, heightPx) {
        if (!Array.isArray(points) || points.length < 6) {
            return { top: [], sides: [], outline: [] };
        }

        const count = points.length / 2;
        const basePoints = [];
        for (let index = 0; index < count; index++) {
            basePoints.push({
                x: points[index * 2],
                y: points[index * 2 + 1]
            });
        }

        const projectedTop = [];
        const projectedBottom = [];
        let minX = Infinity;
        let minY = Infinity;

        basePoints.forEach(function (point) {
            const topPoint = projectIsometric(point.x, point.y, heightPx);
            const bottomPoint = projectIsometric(point.x, point.y, 0);

            projectedTop.push(topPoint);
            projectedBottom.push(bottomPoint);

            minX = Math.min(minX, topPoint.x, bottomPoint.x);
            minY = Math.min(minY, topPoint.y, bottomPoint.y);
        });

        const shiftX = minX !== Infinity ? -minX : 0;
        const shiftY = minY !== Infinity ? -minY : 0;

        const adjustedTop = projectedTop.map(function (point) {
            return {
                x: point.x + shiftX,
                y: point.y + shiftY
            };
        });

        const adjustedBottom = projectedBottom.map(function (point) {
            return {
                x: point.x + shiftX,
                y: point.y + shiftY
            };
        });

        const top = [];
        adjustedTop.forEach(function (point) {
            top.push(point.x, point.y);
        });

        const sides = [];
        for (let index = 0; index < adjustedTop.length; index++) {
            const next = (index + 1) % adjustedTop.length;
            sides.push([
                adjustedTop[index].x,
                adjustedTop[index].y,
                adjustedTop[next].x,
                adjustedTop[next].y,
                adjustedBottom[next].x,
                adjustedBottom[next].y,
                adjustedBottom[index].x,
                adjustedBottom[index].y
            ]);
        }

        const outline = [];
        adjustedTop.forEach(function (point) {
            outline.push(point.x, point.y);
        });
        if (adjustedTop.length > 0) {
            outline.push(adjustedTop[0].x, adjustedTop[0].y);
        }
        adjustedTop.forEach(function (point, index) {
            outline.push(point.x, point.y, adjustedBottom[index].x, adjustedBottom[index].y);
        });

        return {
            top: top,
            sides: sides,
            outline: outline
        };
    }

    function applyViewModeToNode(node, mode) {
        if (!node || typeof node.findOne !== 'function') {
            return;
        }

        const topView = node.findOne('.whd-top-view');
        const isoView = node.findOne('.whd-iso-view');

        if (topView) {
            topView.visible(mode === 'top');
        }

        if (isoView) {
            isoView.visible(mode === 'iso');
        }
    }

    function updateIsometricGeometry(node, options) {
        if (!node || typeof node.findOne !== 'function') {
            return;
        }

        const config = options || {};
        const dimensions = node.getAttr('whdDimensions');
        if (!dimensions) {
            return;
        }

        const scaleRatio = config.scaleRatio && config.scaleRatio > 0 ? config.scaleRatio : 1;
        const pixelsPerMeter = (config.gridSize || 50) / scaleRatio;
        const widthPx = dimensions.widthMeters * pixelsPerMeter;
        const depthPx = dimensions.depthMeters * pixelsPerMeter;
        const heightPx = dimensions.heightMeters * pixelsPerMeter;

        const sides = node.getAttr('whdPolygonSides') || 4;

        refreshSolidGeometry(node, {
            sides: sides,
            widthPx: widthPx,
            depthPx: depthPx,
            heightPx: heightPx
        });
    }

    function refreshSolidGeometry(group, options) {
        if (!group) {
            return;
        }

        const normalized = options || {};
        const sides = normalized.sides && normalized.sides >= 3 ? Math.round(normalized.sides) : 4;
        const widthPx = normalized.widthPx || 0;
        const depthPx = normalized.depthPx || 0;
        const heightPx = normalized.heightPx || 0;

        group.setAttr('whdPixelSize', {
            widthPx: widthPx,
            depthPx: depthPx,
            heightPx: heightPx
        });

        const topView = group.findOne('.whd-top-view');
        if (topView) {
            topView.destroyChildren();

            if (sides === 4) {
                topView.add(
                    new Konva.Rect({
                        x: 0,
                        y: 0,
                        width: widthPx,
                        height: depthPx,
                        fill: 'rgba(66, 153, 225, 0.25)',
                        stroke: '#2b6cb0',
                        strokeWidth: 2,
                        name: 'whd-top-rect'
                    })
                );
            } else {
                topView.add(
                    new Konva.Line({
                        points: buildRegularPolygonPoints(sides, widthPx, depthPx),
                        closed: true,
                        fill: 'rgba(66, 153, 225, 0.25)',
                        stroke: '#2b6cb0',
                        strokeWidth: 2,
                        name: 'whd-top-polygon'
                    })
                );
            }
        }

        const isoGroup = group.findOne('.whd-iso-view');
        if (isoGroup) {
            isoGroup.destroyChildren();

            if (sides === 4) {
                const geometry = buildIsometricRectangleGeometry(widthPx, depthPx, heightPx);

                isoGroup.add(
                    new Konva.Line({
                        points: geometry.left,
                        closed: true,
                        fill: 'rgba(59, 130, 246, 0.35)',
                        stroke: '#1e3a8a',
                        strokeWidth: 1,
                        name: 'whd-iso-left'
                    })
                );

                isoGroup.add(
                    new Konva.Line({
                        points: geometry.right,
                        closed: true,
                        fill: 'rgba(37, 99, 235, 0.45)',
                        stroke: '#1e3a8a',
                        strokeWidth: 1,
                        name: 'whd-iso-right'
                    })
                );

                isoGroup.add(
                    new Konva.Line({
                        points: geometry.top,
                        closed: true,
                        fill: 'rgba(191, 219, 254, 0.55)',
                        stroke: '#1e3a8a',
                        strokeWidth: 1,
                        name: 'whd-iso-top'
                    })
                );

                isoGroup.add(
                    new Konva.Line({
                        points: geometry.outline,
                        closed: false,
                        stroke: '#1e3a8a',
                        strokeWidth: 1.5,
                        name: 'whd-iso-outline'
                    })
                );
            } else {
                const polygonPoints = buildRegularPolygonPoints(sides, widthPx, depthPx);
                const geometry = buildIsometricPolygonGeometry(polygonPoints, heightPx);

                isoGroup.add(
                    new Konva.Line({
                        points: geometry.top,
                        closed: true,
                        fill: 'rgba(191, 219, 254, 0.55)',
                        stroke: '#1e3a8a',
                        strokeWidth: 1,
                        name: 'whd-iso-top'
                    })
                );

                const sidesGroup = new Konva.Group({ name: 'whd-iso-sides' });
                geometry.sides.forEach(function (points, index) {
                    sidesGroup.add(
                        new Konva.Line({
                            points: points,
                            closed: true,
                            fill: index % 2 === 0 ? 'rgba(59, 130, 246, 0.35)' : 'rgba(37, 99, 235, 0.45)',
                            stroke: '#1e3a8a',
                            strokeWidth: 1
                        })
                    );
                });

                isoGroup.add(sidesGroup);

                isoGroup.add(
                    new Konva.Line({
                        points: geometry.outline,
                        closed: false,
                        stroke: '#1e3a8a',
                        strokeWidth: 1.5,
                        name: 'whd-iso-outline'
                    })
                );
            }
        }
    }

    function createCottageNode(options) {
        if (typeof Konva === 'undefined') {
            return null;
        }

        const normalized = options || {};
        const gridSize = normalized.gridSize || 50;
        const scaleRatio = normalized.scaleRatio && normalized.scaleRatio > 0 ? normalized.scaleRatio : 1;
        const pixelsPerMeter = gridSize / scaleRatio;
        const widthMeters = normalized.widthMeters;
        const depthMeters = normalized.depthMeters;
        const heightMeters = normalized.heightMeters;
        const polygonSides = normalized.sides && normalized.sides >= 3 ? Math.round(normalized.sides) : 4;

        const widthPx = widthMeters * pixelsPerMeter;
        const depthPx = depthMeters * pixelsPerMeter;
        const heightPx = heightMeters * pixelsPerMeter;

        const group = new Konva.Group({
            x: gridSize * 2,
            y: gridSize * 2,
            draggable: true,
            name: 'cottage whd-draggable'
        });

        group.setAttr('whdDimensions', {
            widthMeters: widthMeters,
            depthMeters: depthMeters,
            heightMeters: heightMeters
        });

        group.setAttr('whdPolygonSides', polygonSides);

        const topView = new Konva.Group({ name: 'whd-top-view' });
        group.add(topView);

        const isoGroup = new Konva.Group({
            name: 'whd-iso-view',
            visible: false
        });

        group.add(isoGroup);

        refreshSolidGeometry(group, {
            sides: polygonSides,
            widthPx: widthPx,
            depthPx: depthPx,
            heightPx: heightPx
        });

        return group;
    }

    function buildConfig(config) {
        const normalized = config || {};
        const strings = Object.assign({}, DEFAULT_STRINGS, normalized.strings || {});

        return {
            gridSize: normalized.gridSize && normalized.gridSize > 0 ? normalized.gridSize : 50,
            scaleRatio: normalized.scaleRatio && normalized.scaleRatio > 0 ? normalized.scaleRatio : 1,
            canvasWidth: normalized.canvasWidth || 0,
            canvasHeight: normalized.canvasHeight || 0,
            exportFileName: normalized.exportFileName || 'wood-house-project',
            exportDpi: normalized.exportDpi && normalized.exportDpi > 0 ? normalized.exportDpi : 150,
            casette: Array.isArray(normalized.casette) ? normalized.casette : [],
            appVersion: normalized.appVersion || '1.0.0',
            strings: strings
        };
    }

    function getCottagesConfig(config) {
        const templates = Array.isArray(config.casette) ? config.casette : [];
        const items = [];
        const labelTemplate = config.strings.cottageLabel || DEFAULT_STRINGS.cottageLabel;
        const gridSize = config.gridSize || 50;
        const scaleRatio = config.scaleRatio || 1;

        for (let index = 0; index < templates.length; index++) {
            const raw = templates[index] || {};
            const width = parseFloat(raw.width);
            const depth = parseFloat(raw.depth);
            const heightValue = parseFloat(raw.height);

            if (!width || width <= 0 || !depth || depth <= 0) {
                continue;
            }

            const heightMeters = heightValue && heightValue > 0 ? heightValue : 3;
            const replacements = {
                width: String(parseFloat(width.toFixed(2))),
                depth: String(parseFloat(depth.toFixed(2))),
                height: String(parseFloat(heightMeters.toFixed(2)))
            };

            items.push({
                id: 'cottage-' + index,
                label: formatTemplate(labelTemplate, replacements),
                factory: function (options) {
                    const currentGrid = options && options.gridSize ? options.gridSize : gridSize;
                    const currentScale = options && options.scaleRatio ? options.scaleRatio : scaleRatio;
                    return createCottageNode({
                        gridSize: currentGrid,
                        scaleRatio: currentScale,
                        widthMeters: width,
                        depthMeters: depth,
                        heightMeters: heightMeters
                    });
                }
            });
        }

        return items;
    }

    function drawGrid(layer, width, height, gridSize, scaleRatio, mode) {
        layer.destroyChildren();

        const elements = [];
        const majorEvery = 5;
        const majorColor = '#a0aec0';
        const minorColor = '#e2e8f0';

        if (mode === 'iso') {
            const tileWidth = gridSize;
            const tileHeight = gridSize * 0.5;
            const horizontalCount = Math.ceil(width / tileWidth) + Math.ceil(height / tileHeight);
            const verticalCount = horizontalCount;
            const centerX = width / 2;
            const offsetY = tileHeight * 2;

            for (let i = -horizontalCount; i <= horizontalCount; i++) {
                const isMajor = i % majorEvery === 0;
                const start = projectIsometric(i * tileWidth, -verticalCount * tileWidth, 0);
                const end = projectIsometric(i * tileWidth, verticalCount * tileWidth, 0);
                elements.push(new Konva.Line({
                    points: [start.x + centerX, start.y + offsetY, end.x + centerX, end.y + offsetY],
                    stroke: isMajor ? majorColor : minorColor,
                    strokeWidth: isMajor ? 1 : 0.5
                }));
            }

            for (let j = -verticalCount; j <= verticalCount; j++) {
                const isMajor = j % majorEvery === 0;
                const start = projectIsometric(-horizontalCount * tileWidth, j * tileWidth, 0);
                const end = projectIsometric(horizontalCount * tileWidth, j * tileWidth, 0);
                elements.push(new Konva.Line({
                    points: [start.x + centerX, start.y + offsetY, end.x + centerX, end.y + offsetY],
                    stroke: isMajor ? majorColor : minorColor,
                    strokeWidth: isMajor ? 1 : 0.5
                }));
            }

            for (let h = 0; h <= Math.ceil(height / tileHeight); h++) {
                const y = offsetY + h * tileHeight;
                elements.push(new Konva.Line({
                    points: [0, y, width, y],
                    stroke: h % majorEvery === 0 ? majorColor : minorColor,
                    strokeWidth: h % majorEvery === 0 ? 1 : 0.5
                }));
            }
        } else {
            for (let i = 0; i <= width / gridSize; i++) {
                const isMajor = i % majorEvery === 0;
                elements.push(new Konva.Line({
                    points: [i * gridSize, 0, i * gridSize, height],
                    stroke: isMajor ? majorColor : minorColor,
                    strokeWidth: isMajor ? 1 : 0.5
                }));

                if (isMajor && i > 0) {
                    elements.push(new Konva.Text({
                        x: i * gridSize + 4,
                        y: 4,
                        text: (i * scaleRatio).toFixed(2) + ' m',
                        fontSize: 10,
                        fill: '#4a5568'
                    }));
                }
            }

            for (let j = 0; j <= height / gridSize; j++) {
                const isMajor = j % majorEvery === 0;
                elements.push(new Konva.Line({
                    points: [0, j * gridSize, width, j * gridSize],
                    stroke: isMajor ? majorColor : minorColor,
                    strokeWidth: isMajor ? 1 : 0.5
                }));

                if (isMajor && j > 0) {
                    elements.push(new Konva.Text({
                        x: 4,
                        y: j * gridSize + 4,
                        text: (j * scaleRatio).toFixed(2) + ' m',
                        fontSize: 10,
                        fill: '#4a5568'
                    }));
                }
            }
        }

        for (let index = 0; index < elements.length; index++) {
            layer.add(elements[index]);
        }

        layer.draw();
    }

    function formatTemplate(template, replacements) {
        if (typeof template !== 'string') {
            return '';
        }

        return Object.keys(replacements).reduce(function (result, key) {
            const value = replacements[key];
            const pattern = new RegExp('%' + key + '%', 'g');
            return result.replace(pattern, value);
        }, template);
    }

    function getDimensions(node, config) {
        if (!node || typeof node.getClientRect !== 'function') {
            return '';
        }

        const gridSize = config.gridSize || 50;
        const scaleRatio = config.scaleRatio || 1;
        const dimensions = node.getAttr('whdDimensions');
        let widthMeters;
        let depthMeters;
        let heightMeters;

        if (dimensions) {
            widthMeters = dimensions.widthMeters.toFixed(2);
            depthMeters = dimensions.depthMeters.toFixed(2);
            heightMeters = dimensions.heightMeters.toFixed(2);
        } else {
            const box = node.getClientRect({ skipShadow: true, skipStroke: false });
            widthMeters = (box.width / gridSize * scaleRatio).toFixed(2);
            depthMeters = (box.height / gridSize * scaleRatio).toFixed(2);
            heightMeters = '0.00';
        }
        const rawName = typeof node.name === 'function' && node.name() ? node.name() : node.className || 'shape';
        const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

        return formatTemplate(config.strings.selectedStatus, {
            name: formattedName,
            width: widthMeters,
            depth: depthMeters,
            height: heightMeters
        });
    }

    function updateDimensionLabel(node, config) {
        if (!node || typeof node.name !== 'function' || node.name() !== 'dimension') {
            return;
        }

        const gridSize = config.gridSize || 50;
        const scaleRatio = config.scaleRatio || 1;
        const box = node.getClientRect({ skipShadow: true, skipStroke: false });
        const widthMeters = (box.width / gridSize * scaleRatio).toFixed(2);
        const textNode = node.findOne('Text');

        if (textNode) {
            textNode.text(widthMeters + ' m');
            textNode.offsetX(textNode.width() / 2);
        }
    }

    function WoodHouseDesignerApp(props) {
        const configRef = useRef(buildConfig(props.initialConfig));
        const config = configRef.current;
        const [cottages, setCottages] = useState(function () {
            return getCottagesConfig(config);
        });

        const stageContainerRef = useRef(null);
        const stageRef = useRef(null);
        const drawingLayerRef = useRef(null);
        const gridLayerRef = useRef(null);
        const transformerRef = useRef(null);
        const resizeTimerRef = useRef(null);
        const statusRef = useRef('');
        const viewModeRef = useRef('top');

        const [status, setStatus] = useState('');
        const [viewMode, setViewMode] = useState('top');
        const [customSides, setCustomSides] = useState('4');
        const [customWidth, setCustomWidth] = useState('');
        const [customDepth, setCustomDepth] = useState('');
        const [customHeight, setCustomHeight] = useState('');
        const [customError, setCustomError] = useState('');

        const updateStatus = useCallback(function (message) {
            if (statusRef.current === message) {
                return;
            }

            statusRef.current = message;
            setStatus(message);
        }, []);

        useEffect(function () {
            const container = stageContainerRef.current;
            if (!container) {
                return undefined;
            }

            if (typeof Konva === 'undefined') {
                updateStatus(config.strings.errorKonva);
                return undefined;
            }

            const width = config.canvasWidth || container.clientWidth || 1000;
            const height = config.canvasHeight || container.clientHeight || 600;

            container.style.minHeight = height + 'px';

            const stage = new Konva.Stage({
                container: container,
                width: width,
                height: height
            });
            stageRef.current = stage;

            const gridLayer = new Konva.Layer({ listening: false });
            const drawingLayer = new Konva.Layer();

            stage.add(gridLayer);
            stage.add(drawingLayer);

            gridLayerRef.current = gridLayer;
            drawingLayerRef.current = drawingLayer;

            const transformer = new Konva.Transformer({
                rotateEnabled: true,
                enabledAnchors: [
                    'top-left', 'top-center', 'top-right',
                    'middle-left', 'middle-right',
                    'bottom-left', 'bottom-center', 'bottom-right'
                ]
            });

            drawingLayer.add(transformer);
            transformerRef.current = transformer;

            function resizeStage() {
                const containerWidth = container.clientWidth || width;
                const containerHeight = container.clientHeight || height;
                stage.size({
                    width: containerWidth || width,
                    height: containerHeight || height
                });
                drawGrid(gridLayer, stage.width(), stage.height(), config.gridSize, config.scaleRatio, viewModeRef.current);
            }

            const handleResize = function () {
                if (resizeTimerRef.current) {
                    clearTimeout(resizeTimerRef.current);
                }
                resizeTimerRef.current = setTimeout(resizeStage, 150);
            };

            const handleStageClick = function (evt) {
                if (evt.target === stage) {
                    transformer.nodes([]);
                    updateStatus('');
                    return;
                }

                let target = evt.target;

                while (target && target !== stage && !target.draggable()) {
                    target = target.getParent();
                }

                if (!target || target === stage) {
                    transformer.nodes([]);
                    updateStatus('');
                    return;
                }

                transformer.nodes([target]);
                updateStatus(getDimensions(target, config));
            };

            const handleStageMouseMove = function () {
                const pointer = stage.getPointerPosition();
                if (!pointer) {
                    return;
                }

                if (transformer.nodes().length > 0) {
                    return;
                }

                if (viewModeRef.current !== 'top') {
                    return;
                }

                const scaledX = (pointer.x / config.gridSize * config.scaleRatio).toFixed(2);
                const scaledY = (pointer.y / config.gridSize * config.scaleRatio).toFixed(2);
                updateStatus(formatTemplate(config.strings.cursorStatus, {
                    x: scaledX,
                    y: scaledY
                }));
            };

            window.addEventListener('resize', handleResize);
            stage.on('click tap', handleStageClick);
            stage.on('mousemove', handleStageMouseMove);

            resizeStage();
            updateStatus(config.strings.ready);

            return function () {
                window.removeEventListener('resize', handleResize);
                stage.off('click tap', handleStageClick);
                stage.off('mousemove', handleStageMouseMove);

                if (resizeTimerRef.current) {
                    clearTimeout(resizeTimerRef.current);
                }

                if (transformerRef.current) {
                    transformerRef.current.destroy();
                    transformerRef.current = null;
                }

                if (gridLayerRef.current) {
                    gridLayerRef.current.destroy();
                    gridLayerRef.current = null;
                }

                if (drawingLayerRef.current) {
                    drawingLayerRef.current.destroy();
                    drawingLayerRef.current = null;
                }

                if (stageRef.current) {
                    stageRef.current.destroy();
                    stageRef.current = null;
                }
            };
        }, [config, updateStatus]);

        useEffect(function () {
            viewModeRef.current = viewMode;

            if (gridLayerRef.current && stageRef.current) {
                drawGrid(
                    gridLayerRef.current,
                    stageRef.current.width(),
                    stageRef.current.height(),
                    config.gridSize,
                    config.scaleRatio,
                    viewMode
                );
            }

            if (drawingLayerRef.current) {
                drawingLayerRef.current.getChildren().forEach(function (node) {
                    applyViewModeToNode(node, viewMode);
                });
                drawingLayerRef.current.batchDraw();
            }

            const transformer = transformerRef.current;
            if (transformer && transformer.nodes().length > 0) {
                updateStatus(getDimensions(transformer.nodes()[0], config));
            } else if (viewMode === 'iso') {
                updateStatus(config.strings.isoViewStatus);
            } else {
                updateStatus(config.strings.ready);
            }
        }, [config, updateStatus, viewMode]);

        const handleToolClick = useCallback(function (tool) {
            if (!drawingLayerRef.current || !transformerRef.current) {
                return;
            }

            const node = tool.factory({
                gridSize: config.gridSize,
                scaleRatio: config.scaleRatio
            });

            if (!node) {
                return;
            }

            updateIsometricGeometry(node, config);
            applyViewModeToNode(node, viewModeRef.current);

            node.on('dragmove transform', function () {
                updateDimensionLabel(node, config);
                if (transformerRef.current && transformerRef.current.nodes().includes(node)) {
                    updateStatus(getDimensions(node, config));
                }
            });

            node.on('transformend', function () {
                const dims = node.getAttr('whdDimensions');
                if (!dims) {
                    return;
                }

                const scaleX = node.scaleX() || 1;
                const scaleY = node.scaleY() || 1;
                const newDimensions = {
                    widthMeters: parseFloat((dims.widthMeters * scaleX).toFixed(2)),
                    depthMeters: parseFloat((dims.depthMeters * scaleY).toFixed(2)),
                    heightMeters: dims.heightMeters
                };

                node.setAttr('whdDimensions', newDimensions);
                node.scale({ x: 1, y: 1 });
                updateIsometricGeometry(node, config);
                updateStatus(getDimensions(node, config));
            });

            if (drawingLayerRef.current) {
                drawingLayerRef.current.add(node);
                drawingLayerRef.current.draw();
            }

            if (transformerRef.current) {
                transformerRef.current.nodes([node]);
            }

            updateDimensionLabel(node, config);
            updateStatus(getDimensions(node, config));
        }, [config, updateStatus]);

        const handleAddCustomPolygon = useCallback(
            function (event) {
                if (event && typeof event.preventDefault === 'function') {
                    event.preventDefault();
                }

                const sidesValue = parseInt(customSides, 10);
                const widthValue = parseFloat(customWidth);
                const depthValue = parseFloat(customDepth);
                const heightValue = parseFloat(customHeight);

                if (
                    !Number.isFinite(sidesValue) ||
                    sidesValue < 3 ||
                    !Number.isFinite(widthValue) ||
                    widthValue <= 0 ||
                    !Number.isFinite(depthValue) ||
                    depthValue <= 0 ||
                    !Number.isFinite(heightValue) ||
                    heightValue <= 0
                ) {
                    setCustomError(config.strings.invalidPolygon);
                    return;
                }

                setCustomError('');

                const widthMeters = parseFloat(widthValue.toFixed(2));
                const depthMeters = parseFloat(depthValue.toFixed(2));
                const heightMeters = parseFloat(heightValue.toFixed(2));
                const label = formatTemplate(config.strings.cottageLabel, {
                    width: String(widthMeters),
                    depth: String(depthMeters),
                    height: String(heightMeters)
                });

                const tool = {
                    id: 'custom-' + Date.now(),
                    label: label,
                    factory: function (options) {
                        const currentGrid = options && options.gridSize ? options.gridSize : config.gridSize;
                        const currentScale = options && options.scaleRatio ? options.scaleRatio : config.scaleRatio;
                        return createCottageNode({
                            gridSize: currentGrid,
                            scaleRatio: currentScale,
                            widthMeters: widthMeters,
                            depthMeters: depthMeters,
                            heightMeters: heightMeters,
                            sides: sidesValue
                        });
                    }
                };

                setCottages(function (previous) {
                    return previous.concat(tool);
                });
                setCustomWidth('');
                setCustomDepth('');
                setCustomHeight('');
                updateStatus(config.strings.customAdded);
            },
            [config, customDepth, customHeight, customSides, customWidth, updateStatus]
        );

        const handleExport = useCallback(function () {
            if (!stageRef.current) {
                updateStatus(config.strings.exportUnavailable);
                return;
            }

            const stage = stageRef.current;
            try {
                const dpi = config.exportDpi && config.exportDpi > 0 ? config.exportDpi : 150;
                const pixelRatio = Math.max(1, dpi / 96);
                const dataUrl = stage.toDataURL({ mimeType: 'image/png', pixelRatio: pixelRatio });
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = (config.exportFileName || 'wood-house-project') + '.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                updateStatus(config.strings.exportSuccess);
            } catch (error) {
                /* eslint-disable no-console */
                console.error(error);
                /* eslint-enable no-console */
                updateStatus(config.strings.exportUnavailable);
            }
        }, [config, updateStatus]);

        return el(
            'div',
            { className: 'whd-app', 'data-app-version': config.appVersion },
            el(
                'div',
                { className: 'whd-header' },
                el('h1', { className: 'whd-header__title' }, config.strings.appTitle),
                el(
                    'div',
                    { className: 'whd-view-toggle', role: 'group', 'aria-label': config.strings.viewToggleLabel },
                    el(
                        'button',
                        {
                            type: 'button',
                            className: 'whd-view-toggle__button' + (viewMode === 'top' ? ' whd-view-toggle__button--active' : ''),
                            onClick: function () {
                                setViewMode('top');
                            }
                        },
                        config.strings.viewTop
                    ),
                    el(
                        'button',
                        {
                            type: 'button',
                            className: 'whd-view-toggle__button' + (viewMode === 'iso' ? ' whd-view-toggle__button--active' : ''),
                            onClick: function () {
                                setViewMode('iso');
                            }
                        },
                        config.strings.viewIso
                    )
                )
            ),
            el(
                'div',
                { className: 'whd-body' },
                el(
                    'aside',
                    { className: 'whd-tools', 'aria-label': config.strings.toolbox },
                    el(
                        'div',
                        { className: 'whd-tools__section' },
                        el('h2', { className: 'whd-tools__title' }, config.strings.shapesHeading),
                        el(
                            'ul',
                            { className: 'whd-tools__list' },
                            cottages.length === 0
                                ? el('li', { className: 'whd-tools__empty', key: 'empty' }, config.strings.noCottages)
                                : cottages.map(function (tool) {
                                      return el(
                                          'li',
                                          { key: tool.id },
                                          el(
                                              'button',
                                              {
                                                  type: 'button',
                                                  className: 'whd-tool-button',
                                                  onClick: function () {
                                                      handleToolClick(tool);
                                                  }
                                              },
                                              tool.label
                                          )
                                      );
                                  })
                        )
                    ),
                    el(
                        'div',
                        { className: 'whd-tools__section' },
                        el('h3', { className: 'whd-tools__subtitle' }, config.strings.customHeading),
                        el(
                            'form',
                            {
                                className: 'whd-custom-form',
                                onSubmit: handleAddCustomPolygon
                            },
                            el(
                                'label',
                                { className: 'whd-field' },
                                el('span', { className: 'whd-field__label' }, config.strings.sidesLabel),
                                el('input', {
                                    className: 'whd-field__input',
                                    type: 'number',
                                    min: 3,
                                    value: customSides,
                                    onChange: function (event) {
                                        setCustomSides(event.target.value);
                                        setCustomError('');
                                    }
                                })
                            ),
                            el(
                                'label',
                                { className: 'whd-field' },
                                el('span', { className: 'whd-field__label' }, config.strings.widthLabel),
                                el('input', {
                                    className: 'whd-field__input',
                                    type: 'number',
                                    min: 0.1,
                                    step: 0.1,
                                    value: customWidth,
                                    onChange: function (event) {
                                        setCustomWidth(event.target.value);
                                        setCustomError('');
                                    }
                                })
                            ),
                            el(
                                'label',
                                { className: 'whd-field' },
                                el('span', { className: 'whd-field__label' }, config.strings.depthLabel),
                                el('input', {
                                    className: 'whd-field__input',
                                    type: 'number',
                                    min: 0.1,
                                    step: 0.1,
                                    value: customDepth,
                                    onChange: function (event) {
                                        setCustomDepth(event.target.value);
                                        setCustomError('');
                                    }
                                })
                            ),
                            el(
                                'label',
                                { className: 'whd-field' },
                                el('span', { className: 'whd-field__label' }, config.strings.heightLabel),
                                el('input', {
                                    className: 'whd-field__input',
                                    type: 'number',
                                    min: 0.1,
                                    step: 0.1,
                                    value: customHeight,
                                    onChange: function (event) {
                                        setCustomHeight(event.target.value);
                                        setCustomError('');
                                    }
                                })
                            ),
                            customError
                                ? el(
                                      'div',
                                      { className: 'whd-field__error', role: 'alert' },
                                      customError
                                  )
                                : null,
                            el(
                                'button',
                                {
                                    type: 'submit',
                                    className: 'button button-secondary whd-custom-form__button'
                                },
                                config.strings.addPolygonButton
                            )
                        )
                    ),
                    el(
                        'div',
                        { className: 'whd-tools__section' },
                        el('h2', { className: 'whd-tools__title' }, config.strings.actionsHeading),
                        el(
                            'button',
                            {
                                className: 'button button-primary',
                                type: 'button',
                                onClick: handleExport
                            },
                            config.strings.exportButton
                        )
                    )
                ),
                el(
                    'main',
                    { className: 'whd-canvas', 'aria-label': config.strings.designCanvas },
                    el('div', {
                        id: 'whd-stage-container',
                        className: 'whd-canvas__stage',
                        role: 'application',
                        'aria-live': 'polite',
                        ref: stageContainerRef
                    })
                )
            ),
            el(
                'footer',
                { className: 'whd-status', role: 'status', 'aria-live': 'polite' },
                el('span', null, status)
            )
        );
    }

    document.addEventListener('DOMContentLoaded', function () {
        const root = document.getElementById('whd-app-root');
        if (!root) {
            return;
        }

        render(el(WoodHouseDesignerApp, { initialConfig: window.WoodHouseDesignerConfig || {} }), root);
    });
})(window.wp);
