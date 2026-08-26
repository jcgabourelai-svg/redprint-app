const RemovalScreen = {
    selectedReason: null,
    selectedWarehouse: null,
    printer: null,

    init() {
        this.selectedReason = null;
        this.selectedWarehouse = null;
        this.printer = AppState.currentPrinter;
        if (!this.printer) { Navigation.goBack(); return; }

        document.getElementById('rem-submit-btn').disabled = true;
        document.getElementById('rem-final-reading').value = '';
        document.getElementById('rem-reading-error').textContent = '';
        document.getElementById('rem-observations').value = '';

        document.getElementById('rem-printer-name').textContent = this.printer.model;
        document.getElementById('rem-printer-serial').textContent = 'SERIE: ' + this.printer.serial;

        const contractInfo = document.getElementById('rem-contract-info');
        if (this.printer.contractId) {
            const contract = DummyData.getContract(this.printer.contractId);
            const client = DummyData.getClient(this.printer.clientId);
            contractInfo.innerHTML = `
                <p style="font-size:14px"><strong>Contrato:</strong> ${contract ? contract.id : 'N/A'}</p>
                <p style="font-size:14px"><strong>Cliente:</strong> ${client ? client.name : 'N/A'}</p>
                <p style="font-size:14px;color:var(--text-secondary)">Última lectura: ${DummyData.formatNumber(this.printer.lastReading)}</p>`;
        }

        document.querySelectorAll('#rem-reason-grid .selection-card').forEach(card => {
            card.onclick = () => {
                document.querySelectorAll('#rem-reason-grid .selection-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedReason = card.dataset.reason;
                this.checkReady();
            };
        });

        this.renderWarehouses();

        document.getElementById('rem-final-reading').oninput = () => this.validateReading();
        document.getElementById('rem-submit-btn').onclick = () => this.submit();

        const photoBtn = document.getElementById('rem-photo-btn');
        const photoInput = document.getElementById('rem-photo-input');
        if (photoBtn && photoInput) {
            photoBtn.onclick = () => photoInput.click();
        }
    },

    renderWarehouses() {
        const warehouses = DummyData.getActiveWarehouses();
        const list = document.getElementById('rem-warehouse-list');
        if (!list) return;

        list.innerHTML = warehouses.map(w => `
            <div class="warehouse-card" data-wid="${w.id}">
                <div>
                    <p class="warehouse-name">${w.name}</p>
                    <p class="warehouse-loc">📍 ${w.location}</p>
                </div>
            </div>
        `).join('');

        list.querySelectorAll('.warehouse-card').forEach(card => {
            card.onclick = () => {
                list.querySelectorAll('.warehouse-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedWarehouse = DummyData.getWarehouse(card.dataset.wid);
                this.checkReady();
            };
        });
    },

    validateReading() {
        const val = parseInt(document.getElementById('rem-final-reading').value);
        const err = document.getElementById('rem-reading-error');

        if (isNaN(val) || val <= 0) {
            err.textContent = '';
            return;
        }
        if (val < this.printer.lastReading) {
            err.textContent = '⚠️ Lectura menor a la anterior. Se requerirá justificación.';
        } else {
            err.textContent = '';
        }
        this.checkReady();
    },

    checkReady() {
        const reading = parseInt(document.getElementById('rem-final-reading').value);
        const ready = this.printer && this.selectedReason && this.selectedWarehouse && !isNaN(reading) && reading > 0;
        document.getElementById('rem-submit-btn').disabled = !ready;
    },

    async submit() {
        const finalReading = parseInt(document.getElementById('rem-final-reading').value);
        const observations = document.getElementById('rem-observations').value.trim();

        if (finalReading < this.printer.lastReading) {
            const result = await Modal.justify(
                '⚠️ Lectura final menor a la anterior',
                `La lectura final (${DummyData.formatNumber(finalReading)}) es menor que la última registrada (${DummyData.formatNumber(this.printer.lastReading)}).`
            );
            if (result.action !== 'confirm') return;
            if (!result.values.justification.trim()) {
                Toast.error('La justificación es obligatoria');
                return;
            }
        }

        const submitBtn = document.getElementById('rem-submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading-spinner"></span> Procesando...';

        await API.removePrinter(
            this.printer.id,
            this.selectedReason,
            finalReading,
            this.selectedWarehouse.id,
            observations
        );

        Toast.success('Retiro registrado');
        Navigation.goBack();
    }
};
