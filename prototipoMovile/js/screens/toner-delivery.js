const TonerDeliveryScreen = {
    selectedToner: null,

    init() {
        this.selectedToner = null;
        const printer = AppState.currentPrinter;
        if (!printer) { Navigation.goBack(); return; }

        document.getElementById('td-printer-name').textContent = printer.model;
        document.getElementById('td-serial').textContent = 'SERIE: ' + printer.serial;
        document.getElementById('td-submit-btn').disabled = true;
        document.getElementById('td-quantity').value = '1';
        document.getElementById('td-quantity-error').textContent = '';
        document.getElementById('td-observations').value = '';

        const formSection = document.getElementById('td-form-section');
        if (formSection) formSection.style.display = 'none';

        const toners = DummyData.getCompatibleToners(printer.model);
        const list = document.getElementById('td-toner-list');
        const noToners = document.getElementById('td-no-toners');

        if (toners.length === 0) {
            list.innerHTML = '';
            noToners.classList.remove('hidden');
            return;
        }

        noToners.classList.add('hidden');

        list.innerHTML = toners.map(t => {
            const stockClass = t.stock === 0 ? 'stock-out' : t.stock < t.threshold ? 'stock-low' : 'stock-ok';
            return `<div class="toner-card" data-tid="${t.id}">
                <div class="toner-info">
                    <p class="toner-name">${t.name}</p>
                    <p class="toner-model">${t.model}</p>
                </div>
                <div class="toner-stock">
                    <span class="stock-dot ${stockClass}"></span>
                    <span>${t.stock} uds</span>
                </div>
            </div>`;
        }).join('');

        list.querySelectorAll('.toner-card').forEach(card => {
            card.onclick = () => {
                list.querySelectorAll('.toner-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedToner = DummyData.getToner(card.dataset.tid);
                if (formSection) formSection.style.display = 'block';
                const info = document.getElementById('td-stock-info');
                if (info) info.textContent = `Disponible: ${this.selectedToner.stock} unidades`;
                document.getElementById('td-submit-btn').disabled = this.selectedToner.stock === 0;
                this.validateQuantity();
            };
        });

        document.getElementById('td-quantity').oninput = () => this.validateQuantity();
        document.getElementById('td-submit-btn').onclick = () => this.submit();

        const photoBtn = document.getElementById('td-photo-btn');
        const photoInput = document.getElementById('td-photo-input');
        if (photoBtn && photoInput) {
            photoBtn.onclick = () => photoInput.click();
        }
    },

    validateQuantity() {
        if (!this.selectedToner) return;
        const qty = parseInt(document.getElementById('td-quantity').value) || 0;
        const err = document.getElementById('td-quantity-error');
        const submitBtn = document.getElementById('td-submit-btn');

        if (qty > this.selectedToner.stock) {
            err.textContent = `Stock insuficiente. Disponible: ${this.selectedToner.stock}, Solicitado: ${qty}`;
            submitBtn.disabled = true;
        } else if (qty <= 0) {
            err.textContent = 'Ingresa una cantidad válida';
            submitBtn.disabled = true;
        } else {
            err.textContent = '';
            submitBtn.disabled = false;
        }
    },

    async submit() {
        const qty = parseInt(document.getElementById('td-quantity').value) || 0;
        if (!this.selectedToner || qty <= 0 || qty > this.selectedToner.stock) return;

        const submitBtn = document.getElementById('td-submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading-spinner"></span> Procesando...';

        const printer = AppState.currentPrinter;
        await API.deliverToner(printer.id, this.selectedToner.id, qty);

        Toast.success('Entrega registrada');
        Navigation.goBack();
    }
};