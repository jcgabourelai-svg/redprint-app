const PrinterSelectScreen = {
    init() {
        const printer = AppState.currentPrinter;
        if (!printer) { Navigation.goBack(); return; }

        document.getElementById('ps-printer-name').textContent = printer.model;
        document.getElementById('ps-model').textContent = printer.model;
        document.getElementById('ps-serial').textContent = 'SERIE: ' + printer.serial;
        document.getElementById('ps-last-reading').textContent = 'Última lectura: ' + DummyData.formatNumber(printer.lastReading) + ' hojas';
        document.getElementById('ps-last-date').textContent = 'Fecha última: ' + (printer.lastReadingDate ? DummyData.formatShortDate(printer.lastReadingDate) : 'N/D');

        const statusEl = document.getElementById('ps-status');
        const hasReading = printer.lastReadingDate && printer.lastReadingDate === '2026-05-26';
        statusEl.textContent = hasReading ? 'CAPTURADA' : 'NO_LEIDA';
        statusEl.className = 'info-status ' + (hasReading ? 'status-capturada' : 'status-no-leida');

        document.querySelectorAll('#printer-select-screen .action-card').forEach(card => {
            card.onclick = () => {
                const action = card.dataset.action;
                switch (action) {
                    case 'reading': Navigation.goTo('reading-capture-screen'); break;
                    case 'problem': Navigation.goTo('problem-report-screen'); break;
                    case 'history': Navigation.goTo('printer-history-screen'); break;
                    case 'removal': Navigation.goTo('removal-screen'); break;
                }
            };
        });
    }
};