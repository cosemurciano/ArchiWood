(function () {
    'use strict';

    function onReady(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback);
        } else {
            callback();
        }
    }

    function renderEmptyState(container) {
        if (container.querySelector('.whd-casetta-row')) {
            const empty = container.querySelector('.whd-casette-empty');
            if (empty) {
                empty.remove();
            }
            return;
        }

        if (!container.querySelector('.whd-casette-empty')) {
            const empty = document.createElement('p');
            empty.className = 'whd-casette-empty';
            empty.textContent = (window.WoodHouseDesignerAdmin && window.WoodHouseDesignerAdmin.emptyLabel) || 'No cottages configured yet.';
            container.appendChild(empty);
        }
    }

    onReady(function () {
        const list = document.getElementById('whd-casette-list');
        const addButton = document.getElementById('whd-add-casetta');
        const template = document.getElementById('tmpl-whd-casetta-row');

        if (!list || !addButton || !template) {
            return;
        }

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
            renderEmptyState(list);
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
                    renderEmptyState(list);
                }
            }
        });

        renderEmptyState(list);
    });
})();
