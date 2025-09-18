(function (wp) {
    'use strict';

    if (!wp || !wp.element) {
        return;
    }

    const { createElement: el, render, useCallback, useEffect, useRef, useState } = wp.element;

    const DEFAULT_STRINGS = {
        appTitle: 'Wood House Designer',
        shapesHeading: 'Shapes',
        actionsHeading: 'Actions',
        exportButton: 'Export Project',
        ready: 'Ready. Use the toolbox to add elements.',
        exportSuccess: 'Project exported successfully.',
        exportUnavailable: 'Unable to export the project right now.',
        errorKonva: 'The drawing library is not available. Please refresh the page.',
        cursorStatus: 'Cursor: %x% × %y% m',
        selectedStatus: 'Selected %name% - %width%m × %height%m',
        toolWall: 'Wall (Rectangle)',
        toolWindow: 'Window (Circle)',
        toolBeam: 'Beam (Line)',
        toolDimension: 'Dimension Label',
        designCanvas: 'Design Canvas',
        toolbox: 'Toolbox'
    };

    function buildConfig(config) {
        const normalized = config || {};
        const strings = Object.assign({}, DEFAULT_STRINGS, normalized.strings || {});

        return {
            gridSize: normalized.gridSize && normalized.gridSize > 0 ? normalized.gridSize : 50,
            scaleRatio: normalized.scaleRatio && normalized.scaleRatio > 0 ? normalized.scaleRatio : 1,
            canvasWidth: normalized.canvasWidth || 0,
            canvasHeight: normalized.canvasHeight || 0,
            exportFileName: normalized.exportFileName || 'wood-house-project',
            appVersion: normalized.appVersion || '1.0.0',
            strings: strings
        };
    }

    function getToolsConfig(config) {
        return [
            {
                id: 'wall',
                label: config.strings.toolWall,
                factory: function (options) {
                    const gridSize = options.gridSize;
                    return new Konva.Rect({
                        x: gridSize * 2,
                        y: gridSize * 2,
                        width: gridSize * 3,
                        height: gridSize,
                        fill: 'rgba(66, 153, 225, 0.25)',
                        stroke: '#2b6cb0',
                        strokeWidth: 2,
                        draggable: true,
                        name: 'wall'
                    });
                }
            },
            {
                id: 'window',
                label: config.strings.toolWindow,
                factory: function (options) {
                    const gridSize = options.gridSize;
                    return new Konva.Circle({
                        x: gridSize * 3,
                        y: gridSize * 3,
                        radius: gridSize / 2,
                        fill: 'rgba(236, 201, 75, 0.35)',
                        stroke: '#d69e2e',
                        strokeWidth: 2,
                        draggable: true,
                        name: 'window'
                    });
                }
            },
            {
                id: 'beam',
                label: config.strings.toolBeam,
                factory: function (options) {
                    const gridSize = options.gridSize;
                    return new Konva.Line({
                        points: [gridSize, gridSize, gridSize * 4, gridSize * 2],
                        stroke: '#805ad5',
                        strokeWidth: 4,
                        lineCap: 'round',
                        lineJoin: 'round',
                        draggable: true,
                        name: 'beam'
                    });
                }
            },
            {
                id: 'dimension',
                label: config.strings.toolDimension,
                factory: function (options) {
                    const gridSize = options.gridSize;
                    const group = new Konva.Group({
                        x: gridSize * 2,
                        y: gridSize * 4,
                        draggable: true,
                        name: 'dimension'
                    });

                    const line = new Konva.Line({
                        points: [0, 0, gridSize * 2, 0],
                        stroke: '#1a202c',
                        strokeWidth: 2
                    });

                    const text = new Konva.Text({
                        x: gridSize,
                        y: -14,
                        text: '',
                        fontSize: 14,
                        fill: '#1a202c',
                        align: 'center'
                    });
                    text.offsetX(text.width() / 2);

                    group.add(line);
                    group.add(text);

                    return group;
                }
            }
        ];
    }

    function drawGrid(layer, width, height, gridSize, scaleRatio) {
        layer.destroyChildren();

        const elements = [];
        const majorEvery = 5;
        const majorColor = '#a0aec0';
        const minorColor = '#e2e8f0';

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

        const box = node.getClientRect({ skipShadow: true, skipStroke: false });
        const gridSize = config.gridSize || 50;
        const scaleRatio = config.scaleRatio || 1;
        const widthMeters = (box.width / gridSize * scaleRatio).toFixed(2);
        const heightMeters = (box.height / gridSize * scaleRatio).toFixed(2);
        const rawName = typeof node.name === 'function' && node.name() ? node.name() : node.className || 'shape';
        const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

        return formatTemplate(config.strings.selectedStatus, {
            name: formattedName,
            width: widthMeters,
            height: heightMeters
        });
    }

    function updateDimensionLabel(node, config) {
        if (!node || typeof node.name !== 'function' || node.name() !== 'dimension') {
            return;
        }

        const box = node.getClientRect({ skipShadow: true, skipStroke: false });
        const gridSize = config.gridSize || 50;
        const scaleRatio = config.scaleRatio || 1;
        const widthMeters = (box.width / gridSize * scaleRatio).toFixed(2);
        const textNode = node.findOne('Text');

        if (textNode) {
            textNode.text(widthMeters + ' m');
            textNode.offsetX(textNode.width() / 2);
        }
    }

    function downloadFile(filename, data) {
        const blob = new Blob([data], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(function () {
            URL.revokeObjectURL(link.href);
        }, 2000);
    }

    function WoodHouseDesignerApp(props) {
        const configRef = useRef(buildConfig(props.initialConfig));
        const config = configRef.current;
        const toolsRef = useRef(getToolsConfig(config));
        const tools = toolsRef.current;

        const stageContainerRef = useRef(null);
        const stageRef = useRef(null);
        const drawingLayerRef = useRef(null);
        const gridLayerRef = useRef(null);
        const transformerRef = useRef(null);
        const resizeTimerRef = useRef(null);
        const statusRef = useRef('');

        const [status, setStatus] = useState('');

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
                drawGrid(gridLayer, stage.width(), stage.height(), config.gridSize, config.scaleRatio);
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

                if (!evt.target.draggable()) {
                    return;
                }

                transformer.nodes([evt.target]);
                updateStatus(getDimensions(evt.target, config));
            };

            const handleStageMouseMove = function () {
                const pointer = stage.getPointerPosition();
                if (!pointer) {
                    return;
                }

                if (transformer.nodes().length > 0) {
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

        const handleToolClick = useCallback(function (tool) {
            if (!drawingLayerRef.current || !transformerRef.current) {
                return;
            }

            const node = tool.factory({
                gridSize: config.gridSize,
                scaleRatio: config.scaleRatio
            });

            node.on('dragmove transform', function () {
                updateDimensionLabel(node, config);
                if (transformerRef.current && transformerRef.current.nodes().includes(node)) {
                    updateStatus(getDimensions(node, config));
                }
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

        const handleExport = useCallback(function () {
            if (!stageRef.current) {
                updateStatus(config.strings.exportUnavailable);
                return;
            }

            const stage = stageRef.current;
            const json = stage.toJSON();
            const metadata = {
                version: config.appVersion,
                generatedAt: new Date().toISOString(),
                scaleRatio: config.scaleRatio,
                gridSize: config.gridSize,
                canvas: {
                    width: stage.width(),
                    height: stage.height()
                }
            };

            const payload = JSON.stringify({
                metadata: metadata,
                stage: JSON.parse(json)
            }, null, 2);

            downloadFile((config.exportFileName || 'wood-house-project') + '.json', payload);
            updateStatus(config.strings.exportSuccess);
        }, [config, updateStatus]);

        return el(
            'div',
            { className: 'whd-app', 'data-app-version': config.appVersion },
            el(
                'div',
                { className: 'whd-header' },
                el('h1', { className: 'whd-header__title' }, config.strings.appTitle)
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
                            tools.map(function (tool) {
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
