const ProblemReportScreen = {
    selectedType: null,
    selectedSeverity: null,

    init() {
        this.selectedType = null;
        this.selectedSeverity = null;
        document.getElementById('pr-description').value = '';
        document.getElementById('pr-type-error').textContent = '';
        document.getElementById('pr-severity-error').textContent = '';
        document.getElementById('pr-desc-error').textContent = '';
        document.getElementById('pr-submit-btn').disabled = true;

        const printer = AppState.currentPrinter;
        if (printer) {
            document.getElementById('pr-printer-name').textContent = printer.model;
            document.getElementById('pr-printer-serial').textContent = 'SERIE: ' + printer.serial;
        }

        document.querySelectorAll('#pr-type-grid .selection-card').forEach(card => {
            card.classList.remove('selected');
            card.onclick = () => {
                document.querySelectorAll('#pr-type-grid .selection-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedType = card.dataset.type;
                document.getElementById('pr-type-error').textContent = '';
                this.checkReady();
            };
        });

        document.querySelectorAll('#pr-severity-grid .severity-btn').forEach(btn => {
            btn.classList.remove('selected');
            btn.onclick = () => {
                document.querySelectorAll('#pr-severity-grid .severity-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedSeverity = btn.dataset.severity;
                document.getElementById('pr-severity-error').textContent = '';
                this.checkReady();
            };
        });

        document.getElementById('pr-description').oninput = () => this.checkReady();

        document.querySelectorAll('#pr-visit-toggle .toggle-opt').forEach(opt => {
            opt.onclick = () => {
                document.querySelectorAll('#pr-visit-toggle .toggle-opt').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
            };
        });

        const photoBtn = document.getElementById('pr-photo-btn');
        const photoInput = document.getElementById('pr-photo-input');
        if (photoBtn && photoInput) {
            photoBtn.onclick = () => photoInput.click();
        }

        document.getElementById('pr-submit-btn').onclick = () => this.submit();
    },

    checkReady() {
        const desc = document.getElementById('pr-description').value.trim();
        document.getElementById('pr-submit-btn').disabled = !(this.selectedType && this.selectedSeverity && desc);
    },

    async submit() {
        const desc = document.getElementById('pr-description').value.trim();
        let valid = true;

        if (!this.selectedType) {
            document.getElementById('pr-type-error').textContent = 'Selecciona un tipo de problema';
            valid = false;
        }
        if (!this.selectedSeverity) {
            document.getElementById('pr-severity-error').textContent = 'Selecciona la severidad';
            valid = false;
        }
        if (!desc) {
            document.getElementById('pr-desc-error').textContent = 'Ingresa una descripción';
            valid = false;
        }
        if (!valid) return;

        const submitBtn = document.getElementById('pr-submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading-spinner"></span> Enviando...';

        const printer = AppState.currentPrinter;
        await API.reportProblem(printer ? printer.id : 'prt-001', {
            type: this.selectedType,
            severity: this.selectedSeverity,
            description: desc
        });

        const msg = this.selectedSeverity === 'Crítica' ? '¡Problema crítico reportado!' : 'Problema reportado';
        Toast.success(msg);
        Navigation.goBack();
    }
};