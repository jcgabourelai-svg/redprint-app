const HomeScreen = {
    visitsList: null,
    emptyState: null,
    alertsList: null,
    dateText: null,
    currentFilter: 'today',

    init() {
        this.visitsList = document.getElementById('home-visits-list');
        this.emptyState = document.getElementById('home-empty-state');
        this.alertsList = document.getElementById('home-alerts-list');
        this.dateText = document.getElementById('home-date');

        this.dateText.textContent = '📅 ' + DummyData.formatDate('2026-05-26');
        this.renderAlerts();
        this.loadVisits('today');

        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.loadVisits(chip.dataset.filter);
            });
        });

        const viewNext = document.getElementById('home-view-next');
        if (viewNext) {
            viewNext.addEventListener('click', () => {
                document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                document.querySelector('[data-filter="week"]').classList.add('active');
                this.loadVisits('week');
            });
        }

        const notifBtn = document.getElementById('home-notifications-btn');
        if (notifBtn) {
            const badge = document.getElementById('home-notif-badge');
            if (badge && DummyData.notifications.length > 0) {
                badge.classList.remove('hidden');
                badge.textContent = DummyData.notifications.length;
            }
            notifBtn.addEventListener('click', () => Navigation.goTo('alerts-screen'));
        }
    },

    async loadVisits(filter) {
        this.currentFilter = filter;
        const visits = await API.getVisits(filter);
        this.renderVisits(visits);
    },

    renderVisits(visits) {
        if (!visits || visits.length === 0) {
            this.visitsList.innerHTML = '';
            this.emptyState.classList.remove('hidden');
            return;
        }
        this.emptyState.classList.add('hidden');
        this.visitsList.innerHTML = visits.map(v => {
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

            return `<button class="visit-card ${cardClass}" style="cursor:pointer" data-visit-id="${v.id}">
                <div class="visit-card-header">
                    <span class="visit-card-time">🕐 ${v.timeStart} - ${v.timeEnd}</span>
                    <span class="visit-card-status status-${statusClass}">${statusLabels[status]}</span>
                </div>
                <p class="visit-card-client">${client ? client.name : 'Cliente'}</p>
                <p class="visit-card-detail">🖨️ ${v.printerIds.length} impresora(s)</p>
            </button>`;
        }).join('');

        this.visitsList.querySelectorAll('[data-visit-id]').forEach(card => {
            card.addEventListener('click', () => {
                const visit = DummyData.getVisit(card.dataset.visitId);
                if (visit) {
                    if (visit.status === 'PENDIENTE' || status === 'RETRASADA') {
                        visit.status = 'EN_CURSO';
                        Toast.success('Visita iniciada');
                    }
                    AppState.currentVisit = visit;
                    Navigation.goTo('visit-detail-screen');
                }
            });
        });
    },

    renderAlerts() {
        if (!this.alertsList) return;
        this.alertsList.innerHTML = DummyData.notifications.slice(0, 3).map(n =>
            `<div class="alert-item">
                <span class="alert-icon">${n.icon}</span>
                <div>
                    <p class="alert-text">${n.text}</p>
                    <p class="alert-time">${n.time}</p>
                </div>
            </div>`
        ).join('');
    }
};