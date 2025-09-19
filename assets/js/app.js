(function (wp) {
    'use strict';

    if (!wp || !wp.element) {
        return;
    }

    const {
        createElement: el,
        render,
        useCallback,
        useEffect,
        useMemo,
        useRef,
        useState,
        Fragment
    } = wp.element;

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
        wallThicknessLabel: 'Wall thickness (mm)',
        addPolygonButton: 'Add polygon',
        invalidPolygon: 'Please provide valid values for sides and dimensions.',
        customAdded: 'Custom cottage added to toolbox.',
        placementBlocked: 'Unable to place cottage without intersections.',
        adminCottagesTitle: 'Catalog cottages',
        userCottagesTitle: 'Your cottages',
        toolsMenuTitle: 'Cottage tools',
        toolsDimensionsLabel: 'Dimensions',
        toolsPositionLabel: 'Grid position',
        toolsDelete: 'Delete cottage',
        toolsClose: 'Close',
        toolsRemoved: 'Cottage removed.'
    };

    const ISO_ANGLE = Math.PI / 6;
    const ISO_COS = Math.cos(ISO_ANGLE);
    const ISO_SIN = Math.sin(ISO_ANGLE);
    const ISO_INV_COS = ISO_COS === 0 ? 0 : 1 / ISO_COS;
    const ISO_INV_SIN = ISO_SIN === 0 ? 0 : 1 / ISO_SIN;
    const CONTROL_BUTTON_SIZE = 24;
    const DEFAULT_WALL_THICKNESS_METERS = 0.045;

    function hasValidWallThickness(wallThicknessPx, widthPx, depthPx) {
        const normalizedThickness = wallThicknessPx > 0 ? wallThicknessPx : 0;
        return (
            normalizedThickness > 0 &&
            normalizedThickness * 2 < widthPx &&
            normalizedThickness * 2 < depthPx
        );
    }

    function drawPolygonPath(context, points) {
        if (!Array.isArray(points) || points.length < 6) {
            return;
        }

        context.moveTo(points[0], points[1]);
        for (let index = 2; index < points.length; index += 2) {
            context.lineTo(points[index], points[index + 1]);
        }
        context.closePath();
    }

    function createRingShape(outerPoints, innerPoints, attrs) {
        const hasInner = Array.isArray(innerPoints) && innerPoints.length >= 6;
        const config = attrs || {};

        return new Konva.Shape(
            Object.assign(
                {
                    sceneFunc: function (context, shape) {
                        context.beginPath();
                        drawPolygonPath(context, outerPoints);

                        if (hasInner) {
                            drawPolygonPath(context, innerPoints);
                        }

                        context.fillStrokeShape(shape);
                    },
                    fillRule: hasInner ? 'evenodd' : 'nonzero'
                },
                config
            )
        );
    }

    function snapPosition(position, gridSize) {
        const size = gridSize > 0 ? gridSize : 1;
        return {
            x: Math.round(position.x / size) * size,
            y: Math.round(position.y / size) * size
        };
    }

    function computeIsoOffset(width, height, gridSize) {
        const safeWidth = Number.isFinite(width) && width > 0 ? width : 0;
        const safeHeight = Number.isFinite(height) && height > 0 ? height : 0;
        const margin = gridSize && gridSize > 0 ? gridSize : 0;

        const isoWidth = (safeWidth + safeHeight) * ISO_COS;
        const isoHeight = (safeWidth + safeHeight) * ISO_SIN;
        const horizontalSpace = Math.max(safeWidth - isoWidth, 0);
        const verticalSpace = Math.max(safeHeight - isoHeight, 0);

        const clampedMarginX = Math.min(margin, safeWidth / 2);
        const clampedMarginY = Math.min(margin, safeHeight / 2);

        const baseOffsetX = clampedMarginX + horizontalSpace / 2;
        const baseOffsetY = clampedMarginY + verticalSpace / 2;

        const maxOffsetX = safeWidth - clampedMarginX;
        const maxOffsetY = safeHeight - clampedMarginY;

        const offsetX = Math.max(clampedMarginX, Math.min(baseOffsetX, maxOffsetX));
        const offsetY = Math.max(clampedMarginY, Math.min(baseOffsetY, maxOffsetY));

        return { x: offsetX, y: offsetY };
    }

    function worldToViewPosition(world, mode, options) {
        const normalized = world || { x: 0, y: 0 };
        if (mode === 'iso') {
            const isoOptions = options || {};
            const isoOffset = isoOptions.isoOffset || { x: 0, y: 0 };

            return {
                x: (normalized.x - normalized.y) * ISO_COS + isoOffset.x,
                y: (normalized.x + normalized.y) * ISO_SIN + isoOffset.y
            };
        }

        return { x: normalized.x, y: normalized.y };
    }

    function viewToWorldPosition(view, mode, options) {
        const normalized = view || { x: 0, y: 0 };
        if (mode === 'iso') {
            const isoOptions = options || {};
            const isoOffset = isoOptions.isoOffset || { x: 0, y: 0 };
            const adjustedX = normalized.x - isoOffset.x;
            const adjustedY = normalized.y - isoOffset.y;

            return {
                x: (adjustedX * ISO_INV_COS + adjustedY * ISO_INV_SIN) / 2,
                y: (adjustedY * ISO_INV_SIN - adjustedX * ISO_INV_COS) / 2
            };
        }

        return { x: normalized.x, y: normalized.y };
    }

    function computeBoundsFromPoints(points) {
        if (!Array.isArray(points) || points.length < 2) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (let index = 0; index < points.length; index += 2) {
            const x = points[index];
            const y = points[index + 1];

            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }

        return {
            minX: minX === Infinity ? 0 : minX,
            minY: minY === Infinity ? 0 : minY,
            maxX: maxX === -Infinity ? 0 : maxX,
            maxY: maxY === -Infinity ? 0 : maxY
        };
    }

    function rectanglesOverlap(first, second) {
        if (!first || !second) {
            return false;
        }

        const firstWidth = Number.isFinite(first.width) ? first.width : 0;
        const firstHeight = Number.isFinite(first.height) ? first.height : 0;
        const secondWidth = Number.isFinite(second.width) ? second.width : 0;
        const secondHeight = Number.isFinite(second.height) ? second.height : 0;

        if (firstWidth <= 0 || firstHeight <= 0 || secondWidth <= 0 || secondHeight <= 0) {
            return false;
        }

        return (
            first.x < second.x + secondWidth &&
            first.x + firstWidth > second.x &&
            first.y < second.y + secondHeight &&
            first.y + firstHeight > second.y
        );
    }

    function ensureControlButton(group, parent, view) {
        if (!parent || typeof parent.add !== 'function') {
            return null;
        }

        const className = 'whd-control-button-' + view;
        const existing = parent.findOne('.' + className);
        if (existing) {
            return existing;
        }

        const button = new Konva.Group({
            name: 'whd-control-button ' + className,
            listening: true
        });

        const background = new Konva.Rect({
            width: CONTROL_BUTTON_SIZE,
            height: CONTROL_BUTTON_SIZE,
            cornerRadius: 6,
            fill: 'rgba(30, 41, 59, 0.92)'
        });

        const icon = new Konva.Text({
            text: '⋮',
            fontSize: 16,
            fontStyle: 'bold',
            fill: '#ffffff',
            width: CONTROL_BUTTON_SIZE,
            align: 'center'
        });
        icon.y((CONTROL_BUTTON_SIZE - icon.height()) / 2 - 1);

        button.add(background);
        button.add(icon);

        button.on('click tap', function (evt) {
            evt.cancelBubble = true;
            group.fire('whd:open-tools', { target: group });
        });

        button.on('mousedown touchstart', function (evt) {
            evt.cancelBubble = true;
        });

        button.on('mouseenter', function () {
            const stage = group.getStage();
            if (stage && stage.container()) {
                stage.container().style.cursor = 'pointer';
            }
        });

        button.on('mouseleave', function () {
            const stage = group.getStage();
            if (stage && stage.container()) {
                stage.container().style.cursor = '';
            }
        });

        parent.add(button);
        button.moveToTop();

        return button;
    }

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

        const shiftX = -corners.backLeftBottom.x;
        const shiftY = -corners.backLeftBottom.y;

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

        const baseY = shifted.backLeftBottom.y;
        Object.keys(shifted).forEach(function (key) {
            shifted[key].y -= baseY;
        });

        const outline = [
            shifted.backLeftTop.x, shifted.backLeftTop.y,
            shifted.backRightTop.x, shifted.backRightTop.y,
            shifted.frontRightTop.x, shifted.frontRightTop.y,
            shifted.frontRightBottom.x, shifted.frontRightBottom.y,
            shifted.frontLeftBottom.x, shifted.frontLeftBottom.y,
            shifted.frontLeftTop.x, shifted.frontLeftTop.y,
            shifted.backLeftTop.x, shifted.backLeftTop.y,
            shifted.backLeftBottom.x, shifted.backLeftBottom.y,
            shifted.backRightBottom.x, shifted.backRightBottom.y
        ];

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
            outline: outline,
            bounds: computeBoundsFromPoints(outline)
        };
    }

    function buildIsometricShellRectangleGeometry(widthPx, depthPx, heightPx, wallThicknessPx) {
        const innerWidth = widthPx - wallThicknessPx * 2;
        const innerDepth = depthPx - wallThicknessPx * 2;

        if (innerWidth <= 0 || innerDepth <= 0) {
            return {
                solid: true,
                geometry: buildIsometricRectangleGeometry(widthPx, depthPx, heightPx)
            };
        }

        const outerCorners = {
            backLeftBottom: projectIsometric(0, 0, 0),
            backRightBottom: projectIsometric(widthPx, 0, 0),
            frontLeftBottom: projectIsometric(0, depthPx, 0),
            frontRightBottom: projectIsometric(widthPx, depthPx, 0),
            backLeftTop: projectIsometric(0, 0, heightPx),
            backRightTop: projectIsometric(widthPx, 0, heightPx),
            frontLeftTop: projectIsometric(0, depthPx, heightPx),
            frontRightTop: projectIsometric(widthPx, depthPx, heightPx)
        };

        const innerCorners = {
            backLeftBottom: projectIsometric(wallThicknessPx, wallThicknessPx, 0),
            backRightBottom: projectIsometric(wallThicknessPx + innerWidth, wallThicknessPx, 0),
            frontLeftBottom: projectIsometric(wallThicknessPx, wallThicknessPx + innerDepth, 0),
            frontRightBottom: projectIsometric(wallThicknessPx + innerWidth, wallThicknessPx + innerDepth, 0),
            backLeftTop: projectIsometric(wallThicknessPx, wallThicknessPx, heightPx),
            backRightTop: projectIsometric(wallThicknessPx + innerWidth, wallThicknessPx, heightPx),
            frontLeftTop: projectIsometric(wallThicknessPx, wallThicknessPx + innerDepth, heightPx),
            frontRightTop: projectIsometric(wallThicknessPx + innerWidth, wallThicknessPx + innerDepth, heightPx)
        };

        const shiftX = -outerCorners.backLeftBottom.x;
        const shiftY = -outerCorners.backLeftBottom.y;

        function shiftPoints(source) {
            const result = {};
            Object.keys(source).forEach(function (key) {
                result[key] = {
                    x: source[key].x + shiftX,
                    y: source[key].y + shiftY
                };
            });
            return result;
        }

        const outerShifted = shiftPoints(outerCorners);
        const innerShifted = shiftPoints(innerCorners);

        let minY = Infinity;
        Object.keys(outerShifted).forEach(function (key) {
            minY = Math.min(minY, outerShifted[key].y);
        });
        Object.keys(innerShifted).forEach(function (key) {
            minY = Math.min(minY, innerShifted[key].y);
        });

        const extraY = minY < 0 ? -minY : 0;
        Object.keys(outerShifted).forEach(function (key) {
            outerShifted[key].y += extraY;
        });
        Object.keys(innerShifted).forEach(function (key) {
            innerShifted[key].y += extraY;
        });

        const baseY = outerShifted.backLeftBottom.y;
        Object.keys(outerShifted).forEach(function (key) {
            outerShifted[key].y -= baseY;
        });
        Object.keys(innerShifted).forEach(function (key) {
            innerShifted[key].y -= baseY;
        });

        function flatten(pointsArray) {
            const result = [];
            pointsArray.forEach(function (point) {
                result.push(point.x, point.y);
            });
            return result;
        }

        const topOuter = flatten([
            outerShifted.backLeftTop,
            outerShifted.backRightTop,
            outerShifted.frontRightTop,
            outerShifted.frontLeftTop
        ]);
        const topInner = flatten([
            innerShifted.backLeftTop,
            innerShifted.backRightTop,
            innerShifted.frontRightTop,
            innerShifted.frontLeftTop
        ]);

        const leftOuter = flatten([
            outerShifted.backLeftTop,
            outerShifted.frontLeftTop,
            outerShifted.frontLeftBottom,
            outerShifted.backLeftBottom
        ]);
        const leftInner = flatten([
            innerShifted.backLeftTop,
            innerShifted.frontLeftTop,
            innerShifted.frontLeftBottom,
            innerShifted.backLeftBottom
        ]);

        const rightOuter = flatten([
            outerShifted.backRightTop,
            outerShifted.frontRightTop,
            outerShifted.frontRightBottom,
            outerShifted.backRightBottom
        ]);
        const rightInner = flatten([
            innerShifted.backRightTop,
            innerShifted.frontRightTop,
            innerShifted.frontRightBottom,
            innerShifted.backRightBottom
        ]);

        const outlineOuter = [
            outerShifted.backLeftTop.x,
            outerShifted.backLeftTop.y,
            outerShifted.backRightTop.x,
            outerShifted.backRightTop.y,
            outerShifted.frontRightTop.x,
            outerShifted.frontRightTop.y,
            outerShifted.frontRightBottom.x,
            outerShifted.frontRightBottom.y,
            outerShifted.frontLeftBottom.x,
            outerShifted.frontLeftBottom.y,
            outerShifted.frontLeftTop.x,
            outerShifted.frontLeftTop.y,
            outerShifted.backLeftTop.x,
            outerShifted.backLeftTop.y,
            outerShifted.backLeftBottom.x,
            outerShifted.backLeftBottom.y,
            outerShifted.backRightBottom.x,
            outerShifted.backRightBottom.y
        ];

        const outlineInner = flatten([
            innerShifted.backLeftTop,
            innerShifted.backRightTop,
            innerShifted.frontRightTop,
            innerShifted.frontLeftTop,
            innerShifted.backLeftTop
        ]);

        return {
            solid: false,
            top: {
                outer: topOuter,
                inner: topInner
            },
            left: {
                outer: leftOuter,
                inner: leftInner
            },
            right: {
                outer: rightOuter,
                inner: rightInner
            },
            outline: {
                outer: outlineOuter,
                inner: outlineInner
            },
            bounds: computeBoundsFromPoints(outlineOuter)
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
        let minBaseX = Infinity;
        let minBaseY = Infinity;

        basePoints.forEach(function (point) {
            minBaseX = Math.min(minBaseX, point.x);
            minBaseY = Math.min(minBaseY, point.y);

            const topPoint = projectIsometric(point.x, point.y, heightPx);
            const bottomPoint = projectIsometric(point.x, point.y, 0);

            projectedTop.push(topPoint);
            projectedBottom.push(bottomPoint);
        });

        const origin =
            minBaseX !== Infinity && minBaseY !== Infinity
                ? projectIsometric(minBaseX, minBaseY, 0)
                : { x: 0, y: 0 };

        const adjustedTop = projectedTop.map(function (point) {
            return {
                x: point.x - origin.x,
                y: point.y - origin.y
            };
        });

        const adjustedBottom = projectedBottom.map(function (point) {
            return {
                x: point.x - origin.x,
                y: point.y - origin.y
            };
        });

        const baseOffsetY = adjustedBottom.reduce(function (min, point) {
            return Math.min(min, point.y);
        }, Infinity);

        if (baseOffsetY !== Infinity && baseOffsetY !== 0) {
            for (let index = 0; index < adjustedTop.length; index++) {
                adjustedTop[index].y -= baseOffsetY;
            }

            for (let index = 0; index < adjustedBottom.length; index++) {
                adjustedBottom[index].y -= baseOffsetY;
            }
        }

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
            outline: outline,
            bounds: computeBoundsFromPoints(outline)
        };
    }

    function applyViewModeToNode(node, mode, options) {
        if (!node || typeof node.findOne !== 'function') {
            return;
        }

        const viewOptions = options || {};
        const isoOffset = viewOptions.isoOffset || { x: 0, y: 0 };
        const gridSize = viewOptions.gridSize && viewOptions.gridSize > 0 ? viewOptions.gridSize : 1;
        const customDragBound = typeof viewOptions.dragBoundFunc === 'function' ? viewOptions.dragBoundFunc : null;
        let worldPosition = node.getAttr('whdWorldPosition');

        if (!worldPosition) {
            const currentPosition = node.position();
            const assumedWorld =
                mode === 'iso'
                    ? viewToWorldPosition(currentPosition, 'iso', { isoOffset: isoOffset })
                    : { x: currentPosition.x, y: currentPosition.y };
            worldPosition = { x: assumedWorld.x, y: assumedWorld.y };
            node.setAttr('whdWorldPosition', worldPosition);
        }

        if (worldPosition) {
            const nextPosition = worldToViewPosition(worldPosition, mode, { isoOffset: isoOffset });
            node.position(nextPosition);
        }

        const topView = node.findOne('.whd-top-view');
        const isoView = node.findOne('.whd-iso-view');

        if (topView) {
            topView.visible(mode === 'top');
        }

        if (isoView) {
            isoView.visible(mode === 'iso');
        }

        if (typeof node.dragBoundFunc === 'function' && typeof node.draggable === 'function' && node.draggable()) {
            node.dragBoundFunc(function (pos) {
                const isoOptions = { isoOffset: isoOffset, gridSize: gridSize };
                if (customDragBound) {
                    return customDragBound(node, pos, mode, isoOptions);
                }

                const world = viewToWorldPosition(pos, mode, isoOptions);
                const snapped = snapPosition(world, gridSize);
                return worldToViewPosition(snapped, mode, isoOptions);
            });
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
        const wallThicknessMeters =
            dimensions.wallThicknessMeters && dimensions.wallThicknessMeters > 0
                ? dimensions.wallThicknessMeters
                : DEFAULT_WALL_THICKNESS_METERS;
        const wallThicknessPx = wallThicknessMeters * pixelsPerMeter;

        const sides = node.getAttr('whdPolygonSides') || 4;

        refreshSolidGeometry(node, {
            sides: sides,
            widthPx: widthPx,
            depthPx: depthPx,
            heightPx: heightPx,
            wallThicknessPx: wallThicknessPx
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
        const wallThicknessPx = normalized.wallThicknessPx || 0;
        const shellEnabled = hasValidWallThickness(wallThicknessPx, widthPx, depthPx);

        group.setAttr('whdPixelSize', {
            widthPx: widthPx,
            depthPx: depthPx,
            heightPx: heightPx,
            wallThicknessPx: wallThicknessPx
        });

        const topView = group.findOne('.whd-top-view');
        if (topView) {
            topView.destroyChildren();

            if (sides === 4) {
                if (shellEnabled) {
                    const outerPoints = [
                        0,
                        0,
                        widthPx,
                        0,
                        widthPx,
                        depthPx,
                        0,
                        depthPx
                    ];
                    const innerPoints = [
                        wallThicknessPx,
                        wallThicknessPx,
                        widthPx - wallThicknessPx,
                        wallThicknessPx,
                        widthPx - wallThicknessPx,
                        depthPx - wallThicknessPx,
                        wallThicknessPx,
                        depthPx - wallThicknessPx
                    ];

                    topView.add(
                        createRingShape(outerPoints, innerPoints, {
                            fill: 'rgba(66, 153, 225, 0.25)',
                            stroke: '#2b6cb0',
                            strokeWidth: 2,
                            name: 'whd-top-rect'
                        })
                    );
                } else {
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
                }
            } else {
                const outerPoints = buildRegularPolygonPoints(sides, widthPx, depthPx);
                if (shellEnabled) {
                    const centerX = widthPx / 2;
                    const centerY = depthPx / 2;
                    const scaleX = widthPx > 0 ? Math.max((widthPx - wallThicknessPx * 2) / widthPx, 0) : 0;
                    const scaleY = depthPx > 0 ? Math.max((depthPx - wallThicknessPx * 2) / depthPx, 0) : 0;
                    const innerPoints = [];

                    for (let index = 0; index < outerPoints.length; index += 2) {
                        const dx = outerPoints[index] - centerX;
                        const dy = outerPoints[index + 1] - centerY;
                        innerPoints.push(centerX + dx * scaleX, centerY + dy * scaleY);
                    }

                    topView.add(
                        createRingShape(outerPoints, innerPoints, {
                            fill: 'rgba(66, 153, 225, 0.25)',
                            stroke: '#2b6cb0',
                            strokeWidth: 2,
                            name: 'whd-top-polygon'
                        })
                    );
                } else {
                    topView.add(
                        new Konva.Line({
                            points: outerPoints,
                            closed: true,
                            fill: 'rgba(66, 153, 225, 0.25)',
                            stroke: '#2b6cb0',
                            strokeWidth: 2,
                            name: 'whd-top-polygon'
                        })
                    );
                }
            }

            const topButton = ensureControlButton(group, topView, 'top');
            if (topButton) {
                const buttonX = Math.max(4, widthPx - CONTROL_BUTTON_SIZE - 4);
                topButton.position({
                    x: buttonX,
                    y: 4
                });
                topButton.moveToTop();
            }
        }

        const isoGroup = group.findOne('.whd-iso-view');
        if (isoGroup) {
            isoGroup.destroyChildren();
            let isoBounds = null;

            if (sides === 4) {
                if (shellEnabled) {
                    const shellGeometry = buildIsometricShellRectangleGeometry(
                        widthPx,
                        depthPx,
                        heightPx,
                        wallThicknessPx
                    );

                    if (shellGeometry.solid) {
                        const geometry = shellGeometry.geometry;
                        isoBounds = geometry.bounds;

                        const topFace = new Konva.Line({
                            points: geometry.top,
                            closed: true,
                            fill: 'rgba(191, 219, 254, 0.55)',
                            stroke: '#1e3a8a',
                            strokeWidth: 1,
                            name: 'whd-iso-top'
                        });

                        const leftFace = new Konva.Line({
                            points: geometry.left,
                            closed: true,
                            fill: 'rgba(59, 130, 246, 0.35)',
                            stroke: '#1e3a8a',
                            strokeWidth: 1,
                            name: 'whd-iso-left'
                        });

                        const rightFace = new Konva.Line({
                            points: geometry.right,
                            closed: true,
                            fill: 'rgba(37, 99, 235, 0.45)',
                            stroke: '#1e3a8a',
                            strokeWidth: 1,
                            name: 'whd-iso-right'
                        });

                        isoGroup.add(topFace);
                        isoGroup.add(leftFace);
                        isoGroup.add(rightFace);

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
                        isoBounds = shellGeometry.bounds;

                        isoGroup.add(
                            createRingShape(shellGeometry.top.outer, shellGeometry.top.inner, {
                                fill: 'rgba(191, 219, 254, 0.55)',
                                stroke: '#1e3a8a',
                                strokeWidth: 1,
                                name: 'whd-iso-top'
                            })
                        );

                        isoGroup.add(
                            createRingShape(shellGeometry.left.outer, shellGeometry.left.inner, {
                                fill: 'rgba(59, 130, 246, 0.35)',
                                stroke: '#1e3a8a',
                                strokeWidth: 1,
                                name: 'whd-iso-left'
                            })
                        );

                        isoGroup.add(
                            createRingShape(shellGeometry.right.outer, shellGeometry.right.inner, {
                                fill: 'rgba(37, 99, 235, 0.45)',
                                stroke: '#1e3a8a',
                                strokeWidth: 1,
                                name: 'whd-iso-right'
                            })
                        );

                        isoGroup.add(
                            new Konva.Line({
                                points: shellGeometry.outline.outer,
                                closed: false,
                                stroke: '#1e3a8a',
                                strokeWidth: 1.5,
                                name: 'whd-iso-outline'
                            })
                        );

                        if (Array.isArray(shellGeometry.outline.inner) && shellGeometry.outline.inner.length >= 6) {
                            isoGroup.add(
                                new Konva.Line({
                                    points: shellGeometry.outline.inner,
                                    closed: true,
                                    stroke: '#1e3a8a',
                                    strokeWidth: 1,
                                    name: 'whd-iso-inner-outline'
                                })
                            );
                        }
                    }
                } else {
                    const geometry = buildIsometricRectangleGeometry(widthPx, depthPx, heightPx);
                    isoBounds = geometry.bounds;

                    const topFace = new Konva.Line({
                        points: geometry.top,
                        closed: true,
                        fill: 'rgba(191, 219, 254, 0.55)',
                        stroke: '#1e3a8a',
                        strokeWidth: 1,
                        name: 'whd-iso-top'
                    });

                    const leftFace = new Konva.Line({
                        points: geometry.left,
                        closed: true,
                        fill: 'rgba(59, 130, 246, 0.35)',
                        stroke: '#1e3a8a',
                        strokeWidth: 1,
                        name: 'whd-iso-left'
                    });

                    const rightFace = new Konva.Line({
                        points: geometry.right,
                        closed: true,
                        fill: 'rgba(37, 99, 235, 0.45)',
                        stroke: '#1e3a8a',
                        strokeWidth: 1,
                        name: 'whd-iso-right'
                    });

                    isoGroup.add(topFace);
                    isoGroup.add(leftFace);
                    isoGroup.add(rightFace);

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
            } else {
                const polygonPoints = buildRegularPolygonPoints(sides, widthPx, depthPx);
                const geometry = buildIsometricPolygonGeometry(polygonPoints, heightPx);
                isoBounds = geometry.bounds;

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

            const isoButton = ensureControlButton(group, isoGroup, 'iso');
            if (isoButton && isoBounds) {
                const buttonX = Math.max(4, isoBounds.maxX - CONTROL_BUTTON_SIZE - 4);
                const buttonY = Math.max(4, isoBounds.minY + 4);
                isoButton.position({ x: buttonX, y: buttonY });
                isoButton.moveToTop();
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
        const wallThicknessMeters =
            normalized.wallThicknessMeters && normalized.wallThicknessMeters > 0
                ? normalized.wallThicknessMeters
                : DEFAULT_WALL_THICKNESS_METERS;

        const widthPx = widthMeters * pixelsPerMeter;
        const depthPx = depthMeters * pixelsPerMeter;
        const heightPx = heightMeters * pixelsPerMeter;
        const wallThicknessPx = wallThicknessMeters * pixelsPerMeter;

        const group = new Konva.Group({
            x: gridSize * 2,
            y: gridSize * 2,
            draggable: true,
            name: 'cottage whd-draggable'
        });

        const initialWorld = snapPosition({ x: gridSize * 2, y: gridSize * 2 }, gridSize);
        group.position(initialWorld);
        group.setAttr('whdWorldPosition', initialWorld);

        group.setAttr('whdDimensions', {
            widthMeters: widthMeters,
            depthMeters: depthMeters,
            heightMeters: heightMeters,
            wallThicknessMeters: wallThicknessMeters
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
            heightPx: heightPx,
            wallThicknessPx: wallThicknessPx
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
            const wallThicknessValue = parseFloat(raw.wall_thickness);

            if (!width || width <= 0 || !depth || depth <= 0) {
                continue;
            }

            const heightMeters = heightValue && heightValue > 0 ? heightValue : 3;
            const allowedThickness = [28, 45, 80];
            const roundedThickness = Math.round(wallThicknessValue);
            const thicknessMm = allowedThickness.includes(roundedThickness) ? roundedThickness : 45;
            const wallThicknessMeters = thicknessMm / 1000;
            const replacements = {
                width: String(parseFloat(width.toFixed(2))),
                depth: String(parseFloat(depth.toFixed(2))),
                height: String(parseFloat(heightMeters.toFixed(2)))
            };

            items.push({
                id: 'cottage-' + index,
                label: formatTemplate(labelTemplate, replacements),
                dimensions: {
                    width: width,
                    depth: depth,
                    height: heightMeters,
                    wallThickness: wallThicknessMeters
                },
                origin: 'admin',
                factory: function (options) {
                    const currentGrid = options && options.gridSize ? options.gridSize : gridSize;
                    const currentScale = options && options.scaleRatio ? options.scaleRatio : scaleRatio;
                    return createCottageNode({
                        gridSize: currentGrid,
                        scaleRatio: currentScale,
                        widthMeters: width,
                        depthMeters: depth,
                        heightMeters: heightMeters,
                        wallThicknessMeters: wallThicknessMeters
                    });
                }
            });
        }

        return items;
    }

    function drawGrid(layer, width, height, gridSize, scaleRatio, mode, options) {
        layer.destroyChildren();

        const elements = [];
        const majorEvery = 5;
        const majorColor = '#a0aec0';
        const minorColor = '#e2e8f0';

        if (mode === 'iso') {
            const isoOptions = options || {};
            const isoOffset = isoOptions.isoOffset || { x: 0, y: 0 };
            const horizontalCount = Math.ceil(height / gridSize);
            const verticalCount = Math.ceil(width / gridSize);
            const viewOptions = { isoOffset: isoOffset };

            for (let i = 0; i <= verticalCount; i++) {
                const isMajor = i % majorEvery === 0;
                const worldX = i * gridSize;
                const start = worldToViewPosition({ x: worldX, y: 0 }, 'iso', viewOptions);
                const end = worldToViewPosition({ x: worldX, y: height }, 'iso', viewOptions);
                elements.push(
                    new Konva.Line({
                        points: [start.x, start.y, end.x, end.y],
                        stroke: isMajor ? majorColor : minorColor,
                        strokeWidth: isMajor ? 1 : 0.5
                    })
                );

                if (isMajor && i > 0) {
                    const labelPosition = worldToViewPosition({ x: worldX, y: 0 }, 'iso', viewOptions);
                    elements.push(
                        new Konva.Text({
                            x: labelPosition.x + 6,
                            y: labelPosition.y - 16,
                            text: (i * scaleRatio).toFixed(2) + ' m',
                            fontSize: 10,
                            fill: '#4a5568',
                            listening: false
                        })
                    );
                }
            }

            for (let j = 0; j <= horizontalCount; j++) {
                const isMajor = j % majorEvery === 0;
                const worldY = j * gridSize;
                const start = worldToViewPosition({ x: 0, y: worldY }, 'iso', viewOptions);
                const end = worldToViewPosition({ x: width, y: worldY }, 'iso', viewOptions);
                elements.push(
                    new Konva.Line({
                        points: [start.x, start.y, end.x, end.y],
                        stroke: isMajor ? majorColor : minorColor,
                        strokeWidth: isMajor ? 1 : 0.5
                    })
                );

                if (isMajor && j > 0) {
                    const labelPosition = worldToViewPosition({ x: 0, y: worldY }, 'iso', viewOptions);
                    elements.push(
                        new Konva.Text({
                            x: labelPosition.x - 60,
                            y: labelPosition.y + 4,
                            width: 56,
                            align: 'right',
                            text: (j * scaleRatio).toFixed(2) + ' m',
                            fontSize: 10,
                            fill: '#4a5568',
                            listening: false
                        })
                    );
                }
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
        const [adminCottages] = useState(function () {
            return getCottagesConfig(config);
        });
        const [userCottages, setUserCottages] = useState([]);

        const stageContainerRef = useRef(null);
        const stageRef = useRef(null);
        const drawingLayerRef = useRef(null);
        const gridLayerRef = useRef(null);
        const transformerRef = useRef(null);
        const resizeTimerRef = useRef(null);
        const statusRef = useRef('');
        const viewModeRef = useRef('top');
        const isoOffsetRef = useRef({ x: 0, y: 0 });

        const [status, setStatus] = useState('');
        const [viewMode, setViewMode] = useState('top');
        const [customSides, setCustomSides] = useState('4');
        const [customWidth, setCustomWidth] = useState('');
        const [customDepth, setCustomDepth] = useState('');
        const [customHeight, setCustomHeight] = useState('');
        const [customWallThickness, setCustomWallThickness] = useState('45');
        const [customError, setCustomError] = useState('');
        const [toolsModal, setToolsModal] = useState(null);

        const getNodeFootprintRect = useCallback(function (node, worldPosition) {
            if (!node) {
                return null;
            }

            const pixelSize = node.getAttr('whdPixelSize');
            const widthPx =
                pixelSize && Number.isFinite(pixelSize.widthPx) ? Math.abs(pixelSize.widthPx) : 0;
            const depthPx =
                pixelSize && Number.isFinite(pixelSize.depthPx) ? Math.abs(pixelSize.depthPx) : 0;
            const basePosition = worldPosition || node.getAttr('whdWorldPosition');

            if (
                !basePosition ||
                !Number.isFinite(basePosition.x) ||
                !Number.isFinite(basePosition.y) ||
                widthPx <= 0 ||
                depthPx <= 0
            ) {
                return null;
            }

            return {
                x: basePosition.x,
                y: basePosition.y,
                width: widthPx,
                height: depthPx
            };
        }, []);

        const isPositionWithinStage = useCallback(
            function (node, worldPosition) {
                const rect = getNodeFootprintRect(node, worldPosition);
                if (!rect) {
                    return true;
                }

                if (rect.x < 0 || rect.y < 0) {
                    return false;
                }

                const stage = stageRef.current;
                if (!stage) {
                    return true;
                }

                const stageWidth = stage.width();
                const stageHeight = stage.height();

                if (
                    !Number.isFinite(stageWidth) ||
                    !Number.isFinite(stageHeight) ||
                    stageWidth <= 0 ||
                    stageHeight <= 0
                ) {
                    return true;
                }

                return rect.x + rect.width <= stageWidth && rect.y + rect.height <= stageHeight;
            },
            [getNodeFootprintRect]
        );

        const hasCollision = useCallback(
            function (node, worldPosition) {
                const targetRect = getNodeFootprintRect(node, worldPosition);
                if (!targetRect) {
                    return false;
                }

                const layer = drawingLayerRef.current;
                if (!layer) {
                    return false;
                }

                const children = layer.getChildren();
                for (let index = 0; index < children.length; index++) {
                    const other = children[index];
                    if (other === node) {
                        continue;
                    }

                    if (typeof other.draggable === 'function' && !other.draggable()) {
                        continue;
                    }

                    const otherRect = getNodeFootprintRect(other);
                    if (!otherRect) {
                        continue;
                    }

                    if (rectanglesOverlap(targetRect, otherRect)) {
                        return true;
                    }
                }

                return false;
            },
            [getNodeFootprintRect]
        );

        const resolveWorldPosition = useCallback(
            function (node, desiredWorld) {
                const previous = node.getAttr('whdWorldPosition');
                const fallback = previous
                    ? { x: previous.x, y: previous.y }
                    : { x: desiredWorld.x, y: desiredWorld.y };

                if (!isPositionWithinStage(node, desiredWorld)) {
                    return { accepted: false, world: fallback };
                }

                if (hasCollision(node, desiredWorld)) {
                    return { accepted: false, world: fallback };
                }

                return { accepted: true, world: desiredWorld };
            },
            [hasCollision, isPositionWithinStage]
        );

        const findAvailableWorldPosition = useCallback(
            function (node, startWorld) {
                const grid = config.gridSize && config.gridSize > 0 ? config.gridSize : 1;
                const base = startWorld || { x: 0, y: 0 };
                const normalizedBase = {
                    x: Number.isFinite(base.x) ? base.x : 0,
                    y: Number.isFinite(base.y) ? base.y : 0
                };
                const maxRadius = 25;

                for (let radius = 0; radius <= maxRadius; radius++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        for (let dy = -radius; dy <= radius; dy++) {
                            if (radius !== 0 && Math.abs(dx) !== radius && Math.abs(dy) !== radius) {
                                continue;
                            }

                            const candidate = {
                                x: normalizedBase.x + dx * grid,
                                y: normalizedBase.y + dy * grid
                            };

                            if (!isPositionWithinStage(node, candidate)) {
                                continue;
                            }

                            if (!hasCollision(node, candidate)) {
                                return candidate;
                            }
                        }
                    }
                }

                return null;
            },
            [config.gridSize, hasCollision, isPositionWithinStage]
        );

        const handleDragBound = useCallback(
            function (node, pos, mode, dragOptions) {
                const isoParams = {
                    isoOffset:
                        dragOptions && dragOptions.isoOffset ? dragOptions.isoOffset : { x: 0, y: 0 }
                };
                const grid =
                    dragOptions && dragOptions.gridSize && dragOptions.gridSize > 0
                        ? dragOptions.gridSize
                        : config.gridSize;
                const world = viewToWorldPosition(pos, mode, isoParams);
                const snapped = snapPosition(world, grid);
                const resolution = resolveWorldPosition(node, snapped);
                node.setAttr('whdWorldPosition', resolution.world);
                return worldToViewPosition(resolution.world, mode, isoParams);
            },
            [config.gridSize, resolveWorldPosition]
        );

        const updateStatus = useCallback(function (message) {
            if (statusRef.current === message) {
                return;
            }

            statusRef.current = message;
            setStatus(message);
        }, []);

        const handleOpenToolsModal = useCallback(
            function (node) {
                if (!node) {
                    return;
                }

                const dimensions = node.getAttr('whdDimensions');
                let widthMeters = 0;
                let depthMeters = 0;
                let heightMeters = 0;

                if (dimensions) {
                    widthMeters = parseFloat((dimensions.widthMeters || 0).toFixed(2));
                    depthMeters = parseFloat((dimensions.depthMeters || 0).toFixed(2));
                    heightMeters = parseFloat((dimensions.heightMeters || 0).toFixed(2));
                }

                const isoOptions = { isoOffset: isoOffsetRef.current };
                let worldPosition = node.getAttr('whdWorldPosition');

                if (!worldPosition) {
                    worldPosition = viewToWorldPosition(node.position(), viewModeRef.current, isoOptions);
                }

                const snappedPosition = snapPosition(worldPosition, config.gridSize);
                node.setAttr('whdWorldPosition', snappedPosition);
                const positionMeters = {
                    x: parseFloat(((snappedPosition.x / config.gridSize) * config.scaleRatio).toFixed(2)),
                    y: parseFloat(((snappedPosition.y / config.gridSize) * config.scaleRatio).toFixed(2))
                };

                setToolsModal({
                    node: node,
                    dimensions: {
                        width: widthMeters,
                        depth: depthMeters,
                        height: heightMeters
                    },
                    position: positionMeters
                });
            },
            [config]
        );

        const handleCloseToolsModal = useCallback(function () {
            setToolsModal(null);
        }, []);

        const handleDeleteNode = useCallback(
            function () {
                if (!toolsModal || !toolsModal.node) {
                    setToolsModal(null);
                    return;
                }

                const node = toolsModal.node;
                node.destroy();

                if (drawingLayerRef.current) {
                    drawingLayerRef.current.batchDraw();
                }

                if (transformerRef.current && transformerRef.current.nodes().includes(node)) {
                    transformerRef.current.nodes([]);
                }

                setToolsModal(null);
                updateStatus(config.strings.toolsRemoved || config.strings.ready);
            },
            [config, toolsModal, updateStatus]
        );

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
                resizeEnabled: false,
                enabledAnchors: []
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
                const isoOffset = computeIsoOffset(stage.width(), stage.height(), config.gridSize);
                isoOffsetRef.current = isoOffset;
                drawGrid(
                    gridLayer,
                    stage.width(),
                    stage.height(),
                    config.gridSize,
                    config.scaleRatio,
                    viewModeRef.current,
                    { isoOffset: isoOffset }
                );

                if (drawingLayerRef.current) {
                    drawingLayerRef.current.getChildren().forEach(function (child) {
                        applyViewModeToNode(child, viewModeRef.current, {
                            isoOffset: isoOffset,
                            gridSize: config.gridSize,
                            dragBoundFunc: handleDragBound
                        });
                    });
                    drawingLayerRef.current.batchDraw();
                }
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

                const isoOptions = { isoOffset: isoOffsetRef.current };
                const mode = viewModeRef.current;
                const worldPointer = mode === 'iso' ? viewToWorldPosition(pointer, 'iso', isoOptions) : pointer;

                if (!worldPointer || !Number.isFinite(worldPointer.x) || !Number.isFinite(worldPointer.y)) {
                    return;
                }

                const scaledX = ((worldPointer.x / config.gridSize) * config.scaleRatio).toFixed(2);
                const scaledY = ((worldPointer.y / config.gridSize) * config.scaleRatio).toFixed(2);
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
        }, [config, handleDragBound, updateStatus]);

        useEffect(function () {
            viewModeRef.current = viewMode;

            const isoOffset = isoOffsetRef.current;

            if (gridLayerRef.current && stageRef.current) {
                drawGrid(
                    gridLayerRef.current,
                    stageRef.current.width(),
                    stageRef.current.height(),
                    config.gridSize,
                    config.scaleRatio,
                    viewMode,
                    { isoOffset: isoOffset }
                );
            }

            if (drawingLayerRef.current) {
                drawingLayerRef.current.getChildren().forEach(function (node) {
                    applyViewModeToNode(node, viewMode, {
                        isoOffset: isoOffset,
                        gridSize: config.gridSize,
                        dragBoundFunc: handleDragBound
                    });
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
        }, [config, handleDragBound, updateStatus, viewMode]);

        const handleToolClick = useCallback(
            function (tool) {
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

                let worldPosition = node.getAttr('whdWorldPosition');
                if (!worldPosition) {
                    worldPosition = snapPosition(node.position(), config.gridSize);
                }

                const safeWorldPosition = findAvailableWorldPosition(node, worldPosition);
                if (!safeWorldPosition) {
                    if (typeof node.destroy === 'function') {
                        node.destroy();
                    }
                    updateStatus(config.strings.placementBlocked || config.strings.ready);
                    return;
                }
                node.setAttr('whdWorldPosition', safeWorldPosition);

                const currentIsoOffset = { isoOffset: isoOffsetRef.current };
                const currentViewMode = viewModeRef.current;
                const positioned = worldToViewPosition(safeWorldPosition, currentViewMode, currentIsoOffset);
                node.position(positioned);

                updateIsometricGeometry(node, config);
                applyViewModeToNode(node, viewModeRef.current, {
                    isoOffset: isoOffsetRef.current,
                    gridSize: config.gridSize,
                    dragBoundFunc: handleDragBound
                });

                node.on('dragmove transform', function () {
                    updateDimensionLabel(node, config);
                    if (transformerRef.current && transformerRef.current.nodes().includes(node)) {
                        updateStatus(getDimensions(node, config));
                    }
                });

                node.on('dragend', function () {
                    const isoOptions = { isoOffset: isoOffsetRef.current };
                    const worldPos = viewToWorldPosition(node.position(), viewModeRef.current, isoOptions);
                    const snapped = snapPosition(worldPos, config.gridSize);
                    const resolution = resolveWorldPosition(node, snapped);
                    node.setAttr('whdWorldPosition', resolution.world);
                    const nextView = worldToViewPosition(resolution.world, viewModeRef.current, isoOptions);
                    node.position(nextView);
                    if (drawingLayerRef.current) {
                        drawingLayerRef.current.batchDraw();
                    }
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
                    const averageScale = (Math.abs(scaleX) + Math.abs(scaleY)) / 2;
                    const nextWidth = parseFloat((dims.widthMeters * scaleX).toFixed(2));
                    const nextDepth = parseFloat((dims.depthMeters * scaleY).toFixed(2));
                    const baseThickness =
                        dims.wallThicknessMeters && dims.wallThicknessMeters > 0
                            ? dims.wallThicknessMeters
                            : DEFAULT_WALL_THICKNESS_METERS;
                    const scaledThickness = baseThickness * averageScale;
                    const maxThickness = Math.min(nextWidth / 2, nextDepth / 2);
                    const nextThickness = parseFloat(Math.min(scaledThickness, maxThickness).toFixed(3));
                    const newDimensions = {
                        widthMeters: nextWidth,
                        depthMeters: nextDepth,
                        heightMeters: dims.heightMeters,
                        wallThicknessMeters: nextThickness
                    };

                    node.setAttr('whdDimensions', newDimensions);
                    node.scale({ x: 1, y: 1 });
                    updateIsometricGeometry(node, config);
                    updateStatus(getDimensions(node, config));
                });

                node.on('whd:open-tools', function () {
                    handleOpenToolsModal(node);
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
            },
            [
                config,
                findAvailableWorldPosition,
                handleDragBound,
                handleOpenToolsModal,
                resolveWorldPosition,
                updateStatus
            ]
        );

        const handleAddCustomPolygon = useCallback(
            function (event) {
                if (event && typeof event.preventDefault === 'function') {
                    event.preventDefault();
                }

                const sidesValue = parseInt(customSides, 10);
                const widthValue = parseFloat(customWidth);
                const depthValue = parseFloat(customDepth);
                const heightValue = parseFloat(customHeight);
                const wallThicknessValue = parseFloat(customWallThickness);
                const allowedThickness = [28, 45, 80];
                const roundedThickness = Math.round(wallThicknessValue);
                const thicknessMm = allowedThickness.includes(roundedThickness) ? roundedThickness : NaN;

                if (
                    !Number.isFinite(sidesValue) ||
                    sidesValue < 3 ||
                    !Number.isFinite(widthValue) ||
                    widthValue <= 0 ||
                    !Number.isFinite(depthValue) ||
                    depthValue <= 0 ||
                    !Number.isFinite(heightValue) ||
                    heightValue <= 0 ||
                    !Number.isFinite(wallThicknessValue) ||
                    Number.isNaN(thicknessMm)
                ) {
                    setCustomError(config.strings.invalidPolygon);
                    return;
                }

                setCustomError('');

                const widthMeters = parseFloat(widthValue.toFixed(2));
                const depthMeters = parseFloat(depthValue.toFixed(2));
                const heightMeters = parseFloat(heightValue.toFixed(2));
                const wallThicknessMeters = thicknessMm / 1000;
                const label = formatTemplate(config.strings.cottageLabel, {
                    width: String(widthMeters),
                    depth: String(depthMeters),
                    height: String(heightMeters)
                });

                const tool = {
                    id: 'custom-' + Date.now(),
                    label: label,
                    origin: 'user',
                    dimensions: {
                        width: widthMeters,
                        depth: depthMeters,
                        height: heightMeters,
                        wallThickness: wallThicknessMeters
                    },
                    factory: function (options) {
                        const currentGrid = options && options.gridSize ? options.gridSize : config.gridSize;
                        const currentScale = options && options.scaleRatio ? options.scaleRatio : config.scaleRatio;
                        return createCottageNode({
                            gridSize: currentGrid,
                            scaleRatio: currentScale,
                            widthMeters: widthMeters,
                            depthMeters: depthMeters,
                            heightMeters: heightMeters,
                            sides: sidesValue,
                            wallThicknessMeters: wallThicknessMeters
                        });
                    }
                };

                setUserCottages(function (previous) {
                    return previous.concat(tool);
                });
                setCustomWidth('');
                setCustomDepth('');
                setCustomHeight('');
                setCustomWallThickness('45');
                updateStatus(config.strings.customAdded);
            },
            [
                config,
                customDepth,
                customHeight,
                customSides,
                customWallThickness,
                customWidth,
                updateStatus
            ]
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

        function renderCottageList(items, variant) {
            if (!Array.isArray(items) || items.length === 0) {
                return [
                    el('li', { className: 'whd-tools__empty', key: variant + '-empty' }, config.strings.noCottages)
                ];
            }

            return items.map(function (tool) {
                const dimensions = tool.dimensions || {};
                let widthValue = Number.isFinite(dimensions.width) ? dimensions.width : parseFloat(dimensions.width);
                let depthValue = Number.isFinite(dimensions.depth) ? dimensions.depth : parseFloat(dimensions.depth);
                let heightValue = Number.isFinite(dimensions.height) ? dimensions.height : parseFloat(dimensions.height);

                widthValue = Number.isFinite(widthValue) ? widthValue : 0;
                depthValue = Number.isFinite(depthValue) ? depthValue : 0;
                heightValue = Number.isFinite(heightValue) ? heightValue : 0;

                const className = 'whd-tool-button whd-tool-button--' + variant;

                const dimsText =
                    widthValue.toFixed(2) +
                    ' m × ' +
                    depthValue.toFixed(2) +
                    ' m × ' +
                    heightValue.toFixed(2) +
                    ' m';

                return el(
                    'li',
                    { key: tool.id },
                    el(
                        'button',
                        {
                            type: 'button',
                            className: className,
                            onClick: function () {
                                handleToolClick(tool);
                            },
                            'aria-label': tool.label
                        },
                        el('span', { className: 'whd-tool-button__icon', 'aria-hidden': 'true' }, '🏠'),
                        el('span', { className: 'whd-tool-button__dims' }, dimsText)
                    )
                );
            });
        }

        return el(
            Fragment,
            null,
            el(
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
                                'div',
                                { className: 'whd-cottage-groups' },
                                el(
                                    'div',
                                    { className: 'whd-cottage-group' },
                                    el('h3', { className: 'whd-tools__subtitle' }, config.strings.adminCottagesTitle),
                                    el('ul', { className: 'whd-tools__list whd-tools__list--grid' }, renderCottageList(adminCottages, 'admin'))
                                ),
                                el(
                                    'div',
                                    { className: 'whd-cottage-group' },
                                    el('h3', { className: 'whd-tools__subtitle' }, config.strings.userCottagesTitle),
                                    el('ul', { className: 'whd-tools__list whd-tools__list--grid' }, renderCottageList(userCottages, 'user'))
                                )
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
                                el(
                                    'label',
                                    { className: 'whd-field' },
                                    el('span', { className: 'whd-field__label' }, config.strings.wallThicknessLabel),
                                    el(
                                        'select',
                                        {
                                            className: 'whd-field__input',
                                            value: customWallThickness,
                                            onChange: function (event) {
                                                setCustomWallThickness(event.target.value);
                                                setCustomError('');
                                            }
                                        },
                                        el('option', { value: '28' }, '28'),
                                        el('option', { value: '45' }, '45'),
                                        el('option', { value: '80' }, '80')
                                    )
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
            ),
            toolsModal
                ? el(
                      'div',
                      { className: 'whd-modal' },
                      el('div', { className: 'whd-modal__overlay', onClick: handleCloseToolsModal }),
                      el(
                          'div',
                          {
                              className: 'whd-modal__dialog',
                              role: 'dialog',
                              'aria-modal': 'true',
                              'aria-label': config.strings.toolsMenuTitle
                          },
                          el(
                              'header',
                              { className: 'whd-modal__header' },
                              el('h3', { className: 'whd-modal__title' }, config.strings.toolsMenuTitle),
                              el(
                                  'button',
                                  {
                                      type: 'button',
                                      className: 'whd-modal__close',
                                      onClick: handleCloseToolsModal,
                                      'aria-label': config.strings.toolsClose
                                  },
                                  '×'
                              )
                          ),
                          el(
                              'div',
                              { className: 'whd-modal__body' },
                              el(
                                  'p',
                                  { className: 'whd-modal__text' },
                                  config.strings.toolsDimensionsLabel +
                                      ': ' +
                                      toolsModal.dimensions.width.toFixed(2) +
                                      ' m × ' +
                                      toolsModal.dimensions.depth.toFixed(2) +
                                      ' m × ' +
                                      toolsModal.dimensions.height.toFixed(2) +
                                      ' m'
                              ),
                              el(
                                  'p',
                                  { className: 'whd-modal__text' },
                                  config.strings.toolsPositionLabel +
                                      ': X ' +
                                      toolsModal.position.x.toFixed(2) +
                                      ' m, Y ' +
                                      toolsModal.position.y.toFixed(2) +
                                      ' m'
                              )
                          ),
                          el(
                              'div',
                              { className: 'whd-modal__footer' },
                              el(
                                  'button',
                                  {
                                      type: 'button',
                                      className: 'button button-secondary',
                                      onClick: handleCloseToolsModal
                                  },
                                  config.strings.toolsClose
                              ),
                              el(
                                  'button',
                                  {
                                      type: 'button',
                                      className: 'button whd-modal__delete',
                                      onClick: handleDeleteNode
                                  },
                                  config.strings.toolsDelete
                              )
                          )
                      )
                  )
                : null
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
