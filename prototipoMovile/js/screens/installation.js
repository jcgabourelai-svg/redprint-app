const InstallationScreen = {
    selectedPrinter: null,
    selectedContract: null,
    selectedStatus: 'Completada',

    init() {
        this.selectedPrinter = null;
        this.selectedContract = null;
        this.selectedStatus = 'Completada';
        document.getElementById('inst-submit-btn').disabled = true;
        document.getElementById('inst-initial-reading').value = '';
        document.getElementById('inst-observations').value = '';
        document.getElementById('inst-obs-error').textContent = '';

        const formSection = document.getElementById('inst-form-section');
        const contractSection = document.getElementById('inst-contract-section');
        if (formSection) formSection.style.display = 'none';
        if (contractSection) contractSection.style.display = 'none';

        this.renderPrinters();

        document.querySelectorAll('#inst-status-grid .selection-card').forEach(card => {
            card.onclick = () => {
                document.querySelectorAll('#inst-status-grid .selection-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedStatus = card.dataset.status;
                const obsGroup = document.getElementById('inst-obs-group');
                if (obsGroup) {
                    obsGroup.style.display = this.selectedStatus !== 'Completada' ? 'block' : 'none';
                }
                this.checkReady();
            };
        });

        document.getElementById('inst-submit-btn').onclick = () => this.submit();

        const photoBtn = document.getElementById('inst-photo-btn');
        const photoInput = document.getElementById('inst-photo-input');
        if (photoBtn && photoInput) {
            photoBtn.onclick = () => photoInput.click();
        }
    },

    renderPrinters() {
        const printers = DummyData.getWarehousePrinters();
        const list = document.getElementById('inst-printer-list');
        const noPrinters = document.getElementById('inst-no-printers');

        if (printers.length === 0) {
            list.innerHTML = '';
            noPrinters.classList.remove('hidden');
            return;
        }
        noPrinters.classList.add('hidden');

        list.innerHTML = printers.map(p => `
            <div class="inst-printer-card" data-pid="${p.id}">
                <p class="inst-printer-model">${p.model}</p>
                <p class="inst-printer-serial">SERIE: ${p.serial}</p>
                <p class="inst-printer-loc">📍 ${DummyData.getWarehouse(p.warehouseId)?.name || 'Almacén'}</p>
            </div>
        `).join('');

        list.querySelectorAll('.inst-printer-card').forEach(card => {
            card.onclick = () => {
                list.querySelectorAll('.inst-printer-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedPrinter = DummyData.getPrinter(card.dataset.pid);
                this.renderContracts();
                this.checkReady();
            };
        });
    },

    renderContracts() {
        const contractSection = document.getElementById('inst-contract-section');
        if (contractSection) contractSection.style.display = 'block';

        const visit = AppState.currentVisit;
        const clientId = visit ? visit.clientId : null;
        const contracts = clientId ? DummyData.getContractsForClient(clientId) : DummyData.contracts.filter(c => c.status === 'ACTIVO');
        const list = document.getElementById('inst-contract-list');

        list.innerHTML = contracts.map(c => {
            const client = DummyData.getClient(c.clientId);
            return `<div class="inst-contract-card" data-cid="${c.id}">
                <p class="inst-contract-name">Contrato ${c.id} - ${client ? client.name : ''}</p>
                <p class="inst-contract-date">Desde: ${DummyData.formatShortDate(c.startDate)}</p>
            </div>`;
        }).join('');

        list.querySelectorAll('.inst-contract-card').forEach(card => {
            card.onclick = () => {
                list.querySelectorAll('.inst-contract-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedContract = DummyData.getContract(card.dataset.cid);
                const formSection = document.getElementById('inst-form-section');
                if (formSection) formSection.style.display = 'block';
                this.checkReady();
            };
        });
    },

    checkReady() {
        const obs = document.getElementById('inst-observations').value.trim();
        const needsObs = this.selectedStatus !== 'Completada';
        const obsOk = !needsObs || obs.length > 0;
        document.getElementById('inst-submit-btn').disabled = !(this.selectedPrinter && this.selectedContract && obsOk);
    },

    async submit() {
        const reading = parseInt(document.getElementById('inst-initial-reading').value) || 0;
        const obs = document.getElementById('inst-observations').value.trim();

        if (this.selectedStatus !== 'Completada' && !obs) {
            document.getElementById('inst-obs-error').textContent = 'Las observaciones son obligatorias para Parcial/Fallida';
            return;
        }

        const submitBtn = document.getElementById('inst-submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading-spinner"></span> Procesando...';

        await API.installPrinter(
            this.selectedPrinter.id,
            this.selectedContract.id,
            this.selectedStatus,
            reading,
            obs
        );

        Toast.success('Instalación registrada');
        Navigation.goBack();
    }
};