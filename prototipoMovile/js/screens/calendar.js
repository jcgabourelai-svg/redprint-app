const CalendarScreen = {
    list: null,
    emptyState: null,
    currentFilter: 'today',
    statusFilters: ['PENDIENTE', 'EN_CURSO', 'COMPLETADA', 'RETRASADA'],

    init() {
        this.list = document.getElementById('calendar-visits-list');
        this.emptyState = document.getElementById('calendar-empty-state');

        this.loadVisits();

        document.querySelectorAll('#calendar-screen .filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('#calendar-screen .filter-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.loadVisits(chip.dataset.filter);
            });
        });

        document.getElementById('cal-filter-btn').addEventListener('click', () => this.openFilterModal());
    },

    openFilterModal() {
        const statusOptions = [
            { id: 'PENDIENTE', label: '🟢 Pendiente' },
            { id: 'EN_CURSO', label: '🔵 En curso' },
            { id: 'COMPLETADA', label: '⚪ Completada' },
            { id: 'RETRASADA', label: '🔴 Retrasada' }
        ];

        let html = '<div class="filter-options">';
        statusOptions.forEach(opt => {
            const checked = this.statusFilters.includes(opt.id) ? 'checked' : '';
            html += `<label class="filter-option">
                <input type="checkbox" value="${opt.id}" ${checked}>
                <span>${opt.label}</span>
            </label>`;
        });
        html += '</div>';

        Modal.show({
            title: 'Filtrar por estado',
            body: html,
            actions: [
                { id: 'cancel', label: 'Cancelar', class: 'btn-secondary' },
                { id: 'apply', label: 'Aplicar', class: 'btn-primary' }
            ]
        }).then(result => {
            if (result.action === 'apply') {
                const checkboxes = document.querySelectorAll('.filter-option input[type="checkbox"]');
                const selected = [];
                checkboxes.forEach(cb => {
                    if (cb.checked) selected.push(cb.value);
                });
                this.statusFilters = selected.length > 0 ? selected : ['PENDIENTE', 'EN_CURSO', 'COMPLETADA', 'RETRASADA'];
                this.loadVisits();
            }
        });
    },

    async loadVisits(filter = 'today') {
        this.currentFilter = filter;
        let visits = await API.getVisits(filter);

        visits = visits.filter(v => {
            const isPast = DummyData.isPast(v.date) && v.status === 'PENDIENTE';
            const status = isPast ? 'RETRASADA' : v.status;
            return this.statusFilters.includes(status);
        });

        visits.sort((a, b) => a.date.localeCompare(b.date) || a.timeStart.localeCompare(b.timeStart));

        if (visits.length === 0) {
            this.list.innerHTML = '';
            this.emptyState.classList.remove('hidden');
            return;
        }

        this.emptyState.classList.add('hidden');

        let html = '';
        let lastDate = '';
        visits.forEach(v => {
            if (v.date !== lastDate) {
                const isToday = DummyData.isToday(v.date);
                html += `<div class="date-group-header ${isToday ? 'today' : ''}">${isToday ? '📅 ' : ''}${DummyData.formatDate(v.date)}</div>`;
                lastDate = v.date;
            }
            const client = DummyData.getClient(v.clientId);
            const isPast = DummyData.isPast(v.date) && v.status === 'PENDIENTE';
            const status = isPast ? 'RETRASADA' : v.status;
            const statusClass = status === 'PENDIENTE' ? 'pending' :
                status === 'EN_CURSO' ? 'progress' :
                    status === 'COMPLETADA' ? 'completed' : 'overdue';
            const cardClass = status === 'RETRASADA' ? 'overdue' :
                status === 'EN_CURSO' ? 'in-progress' :
                    status === 'COMPLETADA' ? 'completed' : '';
            const statusLabels = {
                PENDIENTE: '🟢 Pendiente', EN_CURSO: '🔵 En curso',
                COMPLETADA: '⚪ Completada', RETRASADA: '🔴 Retrasada'
            };

            html += `<button class="visit-card ${cardClass}" style="margin-bottom:10px;cursor:pointer" data-visit-id="${v.id}">
                <p class="cal-visit-time">🕐 ${v.timeStart} - ${v.timeEnd}</p>
                <p class="visit-card-client">${client ? client.name : ''}</p>
                <p class="visit-card-detail">🖨️ ${v.printerIds.length} impresora(s)</p>
                <span class="visit-card-status status-${statusClass}">${statusLabels[status]}</span>
            </button>`;
        });

        this.list.innerHTML = html;

        this.list.querySelectorAll('[data-visit-id]').forEach(card => {
            card.addEventListener('click', () => {
                const visit = DummyData.getVisit(card.dataset.visitId);
                if (visit) {
                    const isPast = DummyData.isPast(visit.date) && visit.status === 'PENDIENTE';
                    const status = isPast ? 'RETRASADA' : visit.status;
                    if (visit.status === 'PENDIENTE' || status === 'RETRASADA') {
                        visit.status = 'EN_CURSO';
                        Toast.success('Visita iniciada');
                    }
                    AppState.currentVisit = visit;
                    Navigation.goTo('visit-detail-screen');
                }
            });
        });
    }
};