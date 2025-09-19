(function () {
    'use strict';

    function onReady(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback);
        } else {
            callback();
        }
    }

    function renderEmptyState(container, options) {
        const config = options || {};
        const rowSelector = config.rowSelector || '.whd-casetta-row';
        const emptyClass = config.emptyClass || 'whd-casette-empty';
        const emptyLabel = config.emptyLabel || (window.WoodHouseDesignerAdmin && window.WoodHouseDesignerAdmin.emptyLabel) || 'No cottages configured yet.';

        if (container.querySelector(rowSelector)) {
            const empty = container.querySelector('.' + emptyClass);
            if (empty) {
                empty.remove();
            }
            return;
        }

        if (!container.querySelector('.' + emptyClass)) {
            const empty = document.createElement('p');
            empty.className = emptyClass;
            empty.textContent = emptyLabel;
            container.appendChild(empty);
        }
    }

    onReady(function () {
        const list = document.getElementById('whd-casette-list');
        const addButton = document.getElementById('whd-add-casetta');
        const template = document.getElementById('tmpl-whd-casetta-row');

        if (list && addButton && template) {
            function getNextIndex() {
                const current = parseInt(list.getAttribute('data-index'), 10);
                const nextIndex = Number.isNaN(current) ? list.querySelectorAll('.whd-casetta-row').length : current;
                list.setAttribute('data-index', String(nextIndex + 1));
                return nextIndex;
            }

            addButton.addEventListener('click', function (event) {
                event.preventDefault();
                const index = getNextIndex();
                const markup = template.innerHTML.replace(/{{index}}/g, index);
                list.insertAdjacentHTML('beforeend', markup);
                renderEmptyState(list, {
                    rowSelector: '.whd-casetta-row',
                    emptyClass: 'whd-casette-empty',
                    emptyLabel:
                        (window.WoodHouseDesignerAdmin && window.WoodHouseDesignerAdmin.emptyLabel) ||
                        'No cottages configured yet.'
                });
            });

            list.addEventListener('click', function (event) {
                const target = event.target;
                if (!(target instanceof HTMLElement)) {
                    return;
                }

                if (target.classList.contains('whd-remove-casetta')) {
                    event.preventDefault();
                    const row = target.closest('.whd-casetta-row');
                    if (row) {
                        row.remove();
                        renderEmptyState(list, {
                            rowSelector: '.whd-casetta-row',
                            emptyClass: 'whd-casette-empty',
                            emptyLabel:
                                (window.WoodHouseDesignerAdmin && window.WoodHouseDesignerAdmin.emptyLabel) ||
                                'No cottages configured yet.'
                        });
                    }
                }
            });

            renderEmptyState(list, {
                rowSelector: '.whd-casetta-row',
                emptyClass: 'whd-casette-empty',
                emptyLabel:
                    (window.WoodHouseDesignerAdmin && window.WoodHouseDesignerAdmin.emptyLabel) ||
                    'No cottages configured yet.'
            });
        }

        const doorList = document.getElementById('whd-door-list');
        const doorAddButton = document.getElementById('whd-add-door');
        const doorTemplate = document.getElementById('tmpl-whd-door-row');

        if (doorList && doorAddButton && doorTemplate) {
            function getNextDoorIndex() {
                const current = parseInt(doorList.getAttribute('data-index'), 10);
                const nextIndex = Number.isNaN(current) ? doorList.querySelectorAll('.whd-door-row').length : current;
                doorList.setAttribute('data-index', String(nextIndex + 1));
                return nextIndex;
            }

            doorAddButton.addEventListener('click', function (event) {
                event.preventDefault();
                const index = getNextDoorIndex();
                const markup = doorTemplate.innerHTML.replace(/{{index}}/g, index);
                doorList.insertAdjacentHTML('beforeend', markup);
                renderEmptyState(doorList, {
                    rowSelector: '.whd-door-row',
                    emptyClass: 'whd-door-empty',
                    emptyLabel:
                        (window.WoodHouseDesignerAdmin && window.WoodHouseDesignerAdmin.doorEmptyLabel) ||
                        'No doors configured yet.'
                });
            });

            doorList.addEventListener('click', function (event) {
                const target = event.target;
                if (!(target instanceof HTMLElement)) {
                    return;
                }

                if (target.classList.contains('whd-remove-door')) {
                    event.preventDefault();
                    const row = target.closest('.whd-door-row');
                    if (row) {
                        row.remove();
                        renderEmptyState(doorList, {
                            rowSelector: '.whd-door-row',
                            emptyClass: 'whd-door-empty',
                            emptyLabel:
                                (window.WoodHouseDesignerAdmin && window.WoodHouseDesignerAdmin.doorEmptyLabel) ||
                                'No doors configured yet.'
                        });
                    }
                }
            });

            renderEmptyState(doorList, {
                rowSelector: '.whd-door-row',
                emptyClass: 'whd-door-empty',
                emptyLabel:
                    (window.WoodHouseDesignerAdmin && window.WoodHouseDesignerAdmin.doorEmptyLabel) ||
                    'No doors configured yet.'
            });
        }
    });
})();
