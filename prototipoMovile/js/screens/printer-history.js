const PrinterHistoryScreen = {
    init() {
        const printer = AppState.currentPrinter;
        if (!printer) { Navigation.goBack(); return; }

        document.getElementById('ph-printer-name').textContent = printer.model;
        document.getElementById('ph-serial').textContent = 'SERIE: ' + printer.serial;

        const filter = document.getElementById('ph-type-filter');
        if (filter) {
            filter.onchange = () => this.renderTimeline(filter.value);
        }
        this.renderTimeline('all');
    },

    renderTimeline(typeFilter) {
        const printer = AppState.currentPrinter;
        let events = [...printer.history].sort((a, b) => b.date.localeCompare(a.date));

        if (typeFilter !== 'all') {
            events = events.filter(e => e.type === typeFilter);
        }

        const timeline = document.getElementById('ph-timeline');
        const emptyState = document.getElementById('ph-empty-state');

        if (events.length === 0) {
            timeline.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        const icons = {
            'Lectura': '🖨️', 'Visita': '📅', 'Entrega toner': '📦',
            'Problema': '⚠️', 'Instalación': '🔧', 'Retiro': '📤', 'Mantenimiento': '🔨'
        };

        let html = '';
        let lastDate = '';
        events.forEach(e => {
            if (e.date !== lastDate) {
                html += `<div class="timeline-date-header">${DummyData.formatDate(e.date)}</div>`;
                lastDate = e.date;
            }
            html += `<div class="timeline-item">
                <div>
                    <p class="timeline-type">${icons[e.type] || '📋'} ${e.type}</p>
                    <p class="timeline-desc">${e.desc}</p>
                    <p class="timeline-who">${e.who}</p>
                </div>
            </div>`;
        });

        timeline.innerHTML = html;

        timeline.querySelectorAll('.timeline-item').forEach(item => {
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => {
                Modal.show({
                    title: 'Detalle del Evento',
                    body: item.querySelector('.timeline-desc').textContent,
                    actions: [{ id: 'close', label: 'Cerrar', class: 'btn-secondary' }]
                });
            });
        });
    }
};