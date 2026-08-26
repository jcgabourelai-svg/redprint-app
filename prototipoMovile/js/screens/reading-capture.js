const ReadingCaptureScreen = {
    currentInput: null,
    saveBtn: null,
    resultCard: null,
    pagesEl: null,
    costEl: null,
    errorEl: null,
    photoBtn: null,
    photoInput: null,
    photoPreview: null,

    init() {
        const printer = AppState.currentPrinter;
        if (!printer) { Navigation.goBack(); return; }

        this.currentInput = document.getElementById('rc-current');
        this.saveBtn = document.getElementById('rc-save-btn');
        this.resultCard = document.getElementById('rc-result');
        this.pagesEl = document.getElementById('rc-pages');
        this.costEl = document.getElementById('rc-cost');
        this.errorEl = document.getElementById('rc-error');
        this.photoBtn = document.getElementById('rc-photo-btn');
        this.photoInput = document.getElementById('rc-photo-input');
        this.photoPreview = document.getElementById('rc-photo-preview');

        document.getElementById('rc-printer-name').textContent = printer.model;
        document.getElementById('rc-serial').textContent = 'SERIE: ' + printer.serial;
        document.getElementById('rc-last-value').textContent = DummyData.formatNumber(printer.lastReading);
        document.getElementById('rc-last-date').textContent = printer.lastReadingDate ? `(${DummyData.formatShortDate(printer.lastReadingDate)})` : '';

        this.currentInput.value = '';
        this.resultCard.classList.add('hidden');
        this.errorEl.textContent = '';
        this.saveBtn.disabled = true;

        this.currentInput.oninput = () => this.validate();
        this.saveBtn.onclick = () => this.save();
        this.photoBtn.onclick = () => this.photoInput.click();
        this.photoInput.onchange = (e) => {
            if (e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    this.photoPreview.innerHTML = `<img src="${ev.target.result}" alt="foto">`;
                    this.photoPreview.classList.remove('hidden');
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        };
    },

    validate() {
        const printer = AppState.currentPrinter;
        const val = parseInt(this.currentInput.value);

        if (isNaN(val) || val <= 0) {
            this.resultCard.classList.add('hidden');
            this.errorEl.textContent = '';
            this.saveBtn.disabled = true;
            return;
        }

        if (val < printer.lastReading) {
            this.resultCard.classList.add('hidden');
            this.errorEl.textContent = '⚠️ Lectura menor a la anterior. Se requerirá justificación.';
            this.saveBtn.disabled = false;
        } else {
            this.errorEl.textContent = '';
            const pages = val - printer.lastReading;
            const contract = DummyData.getContract(printer.contractId);
            const rate = contract ? contract.rate : 1.0;
            const cost = pages * rate;

            this.pagesEl.textContent = DummyData.formatNumber(pages);
            this.costEl.textContent = '$' + DummyData.formatNumber(cost);
            this.resultCard.classList.remove('hidden');
            this.saveBtn.disabled = false;
        }
    },

    async save() {
        const printer = AppState.currentPrinter;
        const val = parseInt(this.currentInput.value);
        const isAnomalous = val < printer.lastReading;

        if (isAnomalous) {
            const result = await Modal.justify(
                '⚠️ Lectura menor a la anterior',
                `<p>El contador actual (<strong>${DummyData.formatNumber(val)}</strong>) es menor que la última lectura (<strong>${DummyData.formatNumber(printer.lastReading)}</strong>).</p>
                 <p style="margin-top:8px;font-size:14px;color:var(--text-secondary)">Posibles causas:</p>
                 <ul style="margin:4px 0 0 16px;font-size:14px;color:var(--text-secondary)">
                    <li>Cambio de tambor/toner</li>
                    <li>Reinicio del contador</li>
                    <li>Error en la lectura</li>
                 </ul>`
            );
            if (result.action !== 'confirm') return;
            if (!result.values.justification.trim()) {
                Toast.error('La justificación es obligatoria');
                return;
            }
        }

        this.saveBtn.disabled = true;
        this.saveBtn.innerHTML = '<span class="loading-spinner"></span> Guardando...';

        await API.saveReading(printer.id, val);

        Toast.success(isAnomalous ? 'Lectura guardada con justificación' : 'Lectura guardada');

        AppState.currentPrinter = DummyData.getPrinter(printer.id);

        if (AppState.currentVisit) {
            const visit = AppState.currentVisit;
            const allRead = visit.printerIds.every(pid => {
                const p = DummyData.getPrinter(pid);
                return p && p.lastReadingDate === '2026-05-26';
            });
            if (allRead) {
                visit.status = 'COMPLETADA';
                Toast.success('¡Visita completada!');
                Navigation.goTo('home-screen', false);
                return;
            }
        }

        Navigation.goBack();
    }
};