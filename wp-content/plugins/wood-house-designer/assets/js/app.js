(function () {
    'use strict';

    const config = window.WoodHouseDesignerConfig || {};

    function initApp() {
        const container = document.getElementById('whd-stage-container');
        if (!container || typeof Konva === 'undefined') {
            return;
        }

        const shapesList = document.getElementById('whd-shape-list');
        const exportBtn = document.getElementById('whd-export-project');

        if (!shapesList) {
            return;
        }

        const width = config.canvasWidth || container.clientWidth || 1000;
        const height = config.canvasHeight || container.clientHeight || 600;
        const gridSize = config.gridSize || 50;
        const scaleRatio = config.scaleRatio || 1;

        container.style.minHeight = height + 'px';

        const stage = new Konva.Stage({
            container: 'whd-stage-container',
            width,
            height
        });

        const gridLayer = new Konva.Layer({ listening: false });
        const drawingLayer = new Konva.Layer();

        stage.add(gridLayer);
        stage.add(drawingLayer);

        let stageWidth = width;
        let stageHeight = height;

        function resizeStage() {
            const containerWidth = container.clientWidth || stageWidth;
            const containerHeight = container.clientHeight || stageHeight;
            stageWidth = containerWidth || width;
            stageHeight = containerHeight || height;
            stage.size({ width: stageWidth, height: stageHeight });
            drawGrid(gridLayer, stageWidth, stageHeight, gridSize, scaleRatio);
        }

        window.addEventListener('resize', function () {
            clearTimeout(window.__whdResizeTimer);
            window.__whdResizeTimer = setTimeout(resizeStage, 150);
        });

        resizeStage();
        updateStatus('Ready. Use the toolbox to add elements.');

        const transformer = new Konva.Transformer({
            rotateEnabled: true,
            enabledAnchors: [
                'top-left', 'top-center', 'top-right',
                'middle-left', 'middle-right',
                'bottom-left', 'bottom-center', 'bottom-right'
            ]
        });
        drawingLayer.add(transformer);

        stage.on('click tap', function (evt) {
            if (evt.target === stage) {
                transformer.nodes([]);
                updateStatus('');
                return;
            }

            if (!evt.target.draggable()) {
                return;
            }

            transformer.nodes([evt.target]);
            const dims = getDimensions(evt.target, scaleRatio);
            updateStatus(`${dims}`);
        });

        stage.on('mousemove', function () {
            const pointer = stage.getPointerPosition();
            if (!pointer) {
                return;
            }
            const activeNodes = transformer.nodes();
            if (activeNodes.length > 0) {
                return;
            }
            const scaledX = (pointer.x / gridSize * scaleRatio).toFixed(2);
            const scaledY = (pointer.y / gridSize * scaleRatio).toFixed(2);
            updateStatus(`Cursor: ${scaledX} × ${scaledY} m`);
        });

        const tools = getToolsConfig(scaleRatio);
        tools.forEach(function (tool) {
            const button = document.createElement('button');
            button.className = 'whd-tool-button';
            button.type = 'button';
            button.textContent = tool.label;
            button.addEventListener('click', function () {
                const node = tool.factory({ gridSize, scaleRatio });
                node.on('dragmove transform', function () {
                    updateDimensionLabel(node, scaleRatio);
                    if (transformer.nodes().includes(node)) {
                        const dims = getDimensions(node, scaleRatio);
                        updateStatus(`${dims}`);
                    }
                });
                drawingLayer.add(node);
                drawingLayer.draw();
                transformer.nodes([node]);
                const dims = getDimensions(node, scaleRatio);
                updateStatus(`${dims}`);
            });
            shapesList.appendChild(button);
        });

        if (exportBtn) {
            exportBtn.addEventListener('click', function () {
                const json = stage.toJSON();
                const metadata = {
                    version: config.appVersion || '1.0.0',
                    generatedAt: new Date().toISOString(),
                    scaleRatio,
                    gridSize,
                    canvas: { width, height }
                };
                const payload = JSON.stringify({ metadata, stage: JSON.parse(json) }, null, 2);
                downloadFile((config.exportFileName || 'wood-house-project') + '.json', payload);
                updateStatus('Project exported successfully.');
            });
        }
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
                    text: `${(i * scaleRatio).toFixed(2)} m`,
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
                    text: `${(j * scaleRatio).toFixed(2)} m`,
                    fontSize: 10,
                    fill: '#4a5568'
                }));
            }
        }

        elements.forEach(function (item) {
            layer.add(item);
        });

        layer.draw();
    }

    function getToolsConfig(scaleRatio) {
        return [
            {
                label: 'Wall (Rectangle)',
                factory: function ({ gridSize }) {
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
                label: 'Window (Circle)',
                factory: function ({ gridSize }) {
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
                label: 'Beam (Line)',
                factory: function ({ gridSize }) {
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
                label: 'Dimension Label',
                factory: function ({ gridSize, scaleRatio }) {
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

                    group.on('dragmove transform', function () {
                        updateDimensionLabel(group, scaleRatio);
                    });

                    updateDimensionLabel(group, scaleRatio);

                    return group;
                }
            }
        ];
    }

    function getDimensions(node, scaleRatio) {
        const box = node.getClientRect({ skipShadow: true, skipStroke: false });
        const widthMeters = (box.width / getGridSize() * scaleRatio).toFixed(2);
        const heightMeters = (box.height / getGridSize() * scaleRatio).toFixed(2);
        return `Selected ${node.name() || node.className} - ${widthMeters}m x ${heightMeters}m`;

        function getGridSize() {
            return config.gridSize || 50;
        }
    }

    function updateStatus(message) {
        const statusEl = document.getElementById('whd-status-message');
        if (statusEl) {
            statusEl.textContent = message;
        }
    }

    function updateDimensionLabel(node, scaleRatio) {
        if (!node || typeof node.name !== 'function' || node.name() !== 'dimension') {
            return;
        }
        const box = node.getClientRect({ skipShadow: true, skipStroke: false });
        const widthMeters = (box.width / (config.gridSize || 50) * scaleRatio).toFixed(2);
        const textNode = node.findOne('Text');
        if (textNode) {
            textNode.text(`${widthMeters} m`);
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
})();
