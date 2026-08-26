const VisitDetailScreen = {
    init() {
        const visit = AppState.currentVisit;
        if (!visit) { Navigation.goBack(); return; }

        const client = DummyData.getClient(visit.clientId);
        document.getElementById('vd-client-name').textContent = client ? client.name : 'Cliente';

        const clientInfo = document.getElementById('vd-client-info');
        if (client) {
            clientInfo.innerHTML = `
                <p class="info-time">🕐 ${visit.timeStart} - ${visit.timeEnd}</p>
                <p style="margin-bottom:4px">📧 ${client.email}</p>
                <p style="margin-bottom:4px">📱 ${client.phone}</p>
                <p>📍 ${client.address}</p>`;
        }

        this.renderPrinters(visit);

        document.getElementById('vd-btn-install').onclick = () => Navigation.goTo('installation-screen');
        document.getElementById('vd-btn-toner').onclick = () => {
            if (visit.printerIds.length > 0) {
                AppState.currentPrinter = DummyData.getPrinter(visit.printerIds[0]);
                Navigation.goTo('toner-delivery-screen');
            } else {
                Toast.info('No hay impresoras en esta visita');
            }
        };
    },

    renderPrinters(visit) {
        const list = document.getElementById('vd-printers-list');
        const printers = visit.printerIds.map(id => DummyData.getPrinter(id)).filter(Boolean);

        list.innerHTML = printers.map(p => `
            <div class="printer-card" data-pid="${p.id}">
                <div class="printer-card-info">
                    <p class="printer-card-model">${p.model} →</p>
                    <p class="printer-card-serial">SERIE: ${p.serial}</p>
                    <p class="printer-card-reading">Última lectura: ${DummyData.formatNumber(p.lastReading)}</p>
                </div>
                <span class="printer-card-check">○</span>
            </div>
        `).join('');

        list.querySelectorAll('.printer-card').forEach(card => {
            card.addEventListener('click', () => {
                AppState.currentPrinter = DummyData.getPrinter(card.dataset.pid);
                Navigation.goTo('printer-select-screen');
            });
        });
    }
};