const Modal = {
    overlay: null,
    content: null,

    init() {
        this.overlay = document.getElementById('modal-overlay');
        this.content = document.getElementById('modal-content');
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });
    },

    show(opts) {
        if (!this.overlay) this.init();
        const { title, body, actions, inputs } = opts;

        let html = '';
        if (title) html += `<h3 class="modal-title">${title}</h3>`;
        if (body) html += `<div class="modal-body">${body}</div>`;

        if (inputs) {
            inputs.forEach(inp => {
                html += `<div class="input-group">
                    <label for="modal-${inp.id}">${inp.label}</label>
                    <textarea id="modal-${inp.id}" rows="3" placeholder="${inp.placeholder || ''}" ${inp.required ? 'required' : ''}></textarea>
                    <span class="input-error" id="modal-${inp.id}-error"></span>
                </div>`;
            });
        }

        if (actions) {
            html += '<div class="modal-actions">';
            actions.forEach(a => {
                html += `<button class="btn ${a.class || 'btn-secondary'}" data-modal-action="${a.id}">${a.label}</button>`;
            });
            html += '</div>';
        }

        this.content.innerHTML = html;
        this.overlay.classList.remove('hidden');

        return new Promise(resolve => {
            this.content.querySelectorAll('[data-modal-action]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const result = { action: btn.dataset.modalAction };
                    if (inputs) {
                        result.values = {};
                        inputs.forEach(inp => {
                            result.values[inp.id] = document.getElementById(`modal-${inp.id}`).value;
                        });
                    }
                    this.close();
                    resolve(result);
                });
            });
        });
    },

    close() {
        if (this.overlay) {
            this.overlay.classList.add('hidden');
            this.content.innerHTML = '';
        }
    },

    async confirm(title, body) {
        return this.show({
            title,
            body,
            actions: [
                { id: 'cancel', label: 'Cancelar', class: 'btn-secondary' },
                { id: 'confirm', label: 'Confirmar', class: 'btn-primary' }
            ]
        });
    },

    async justify(title, body) {
        return this.show({
            title,
            body,
            inputs: [
                { id: 'justification', label: 'Justificación *', placeholder: 'Explica por qué...', required: true }
            ],
            actions: [
                { id: 'cancel', label: 'Cancelar', class: 'btn-secondary' },
                { id: 'confirm', label: 'Confirmar', class: 'btn-primary' }
            ]
        });
    }
};