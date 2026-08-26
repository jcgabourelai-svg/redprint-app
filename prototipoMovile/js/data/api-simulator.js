const API = {
    delay: 300,

    async simulate(fn) {
        return new Promise(resolve => {
            setTimeout(() => resolve(fn()), this.delay);
        });
    },

    async login(email, password) {
        return this.simulate(() => {
            if (email && password && password.length >= 8) {
                return { success: true, user: { ...DummyData.user, email } };
            }
            return { success: false, error: 'Credenciales inválidas' };
        });
    },

    async getVisits(filter = 'today') {
        return this.simulate(() => {
            switch (filter) {
                case 'today': return DummyData.getVisitsForDate('2026-05-26');
                case 'week': return DummyData.getVisitsForWeek('2026-05-26');
                case 'all': return DummyData.getAllPendingVisits();
                default: return DummyData.getVisitsForDate('2026-05-26');
            }
        });
    },

    async getVisit(id) {
        return this.simulate(() => DummyData.getVisit(id));
    },

    async getPrinter(id) {
        return this.simulate(() => DummyData.getPrinter(id));
    },

    async getPrintersForClient(clientId) {
        return this.simulate(() => DummyData.getPrintersForClient(clientId));
    },

    async saveReading(printerId, value, justification) {
        return this.simulate(() => {
            const printer = DummyData.getPrinter(printerId);
            if (!printer) return { success: false };
            const pages = value - printer.lastReading;
            printer.lastReading = value;
            printer.lastReadingDate = '2026-05-26';
            printer.history.unshift({
                date: '2026-05-26',
                type: 'Lectura',
                desc: `Lectura: ${DummyData.formatNumber(value)} hojas`,
                who: AppState.user ? AppState.user.name : 'Operador'
            });
            return { success: true, pages };
        });
    },

    async reportProblem(printerId, data) {
        return this.simulate(() => {
            const printer = DummyData.getPrinter(printerId);
            if (!printer) return { success: false };
            printer.history.unshift({
                date: '2026-05-26',
                type: 'Problema',
                desc: `${data.type} - ${data.description}`,
                who: AppState.user ? AppState.user.name : 'Operador'
            });
            DummyData.notifications.unshift({
                id: 'ntf-' + Date.now(),
                type: data.severity === 'Crítica' || data.severity === 'Alta' ? 'error' : 'warning',
                icon: data.severity === 'Crítica' ? '🔴' : '⚠️',
                text: `Problema ${data.type}: ${printer.model}`,
                time: 'Ahora'
            });
            return { success: true };
        });
    },

    async deliverToner(printerId, tonerId, quantity) {
        return this.simulate(() => {
            const toner = DummyData.getToner(tonerId);
            if (!toner) return { success: false };
            toner.stock -= quantity;
            const printer = DummyData.getPrinter(printerId);
            if (printer) {
                printer.history.unshift({
                    date: '2026-05-26',
                    type: 'Entrega toner',
                    desc: `${toner.name} entregado (x${quantity})`,
                    who: AppState.user ? AppState.user.name : 'Operador'
                });
            }
            if (toner.stock < toner.threshold) {
                DummyData.notifications.unshift({
                    id: 'ntf-' + Date.now(),
                    type: toner.stock === 0 ? 'error' : 'warning',
                    icon: toner.stock === 0 ? '🔴' : '⚠️',
                    text: `Stock ${toner.stock === 0 ? 'agotado' : 'bajo'}: ${toner.name} (${toner.stock} unidades)`,
                    time: 'Ahora'
                });
            }
            return { success: true, newStock: toner.stock };
        });
    },

    async installPrinter(printerId, contractId, status, reading, observations) {
        return this.simulate(() => {
            const printer = DummyData.getPrinter(printerId);
            if (!printer) return { success: false };
            if (status === 'Completada') {
                printer.status = 'RENTADA';
                printer.warehouseId = null;
                const contract = DummyData.getContract(contractId);
                if (contract) printer.clientId = contract.clientId;
                printer.lastReading = reading || 0;
                printer.lastReadingDate = '2026-05-26';
            }
            printer.history.unshift({
                date: '2026-05-26',
                type: 'Instalación',
                desc: `Instalación ${status}: ${observations || 'Sin observaciones'}`,
                who: AppState.user ? AppState.user.name : 'Operador'
            });
            DummyData.notifications.unshift({
                id: 'ntf-' + Date.now(),
                type: 'info',
                icon: '🖨️',
                text: `Instalación ${status.toLowerCase()}: ${printer.model}`,
                time: 'Ahora'
            });
            return { success: true };
        });
    },

    async removePrinter(printerId, reason, finalReading, warehouseId, observations) {
        return this.simulate(() => {
            const printer = DummyData.getPrinter(printerId);
            if (!printer) return { success: false };
            printer.status = 'EN_ALMACEN';
            printer.clientId = null;
            printer.contractId = null;
            printer.warehouseId = warehouseId;
            printer.lastReading = finalReading;
            printer.history.unshift({
                date: '2026-05-26',
                type: 'Retiro',
                desc: `Retiro (${reason}): ${observations || 'Sin observaciones'}`,
                who: AppState.user ? AppState.user.name : 'Operador'
            });
            DummyData.notifications.unshift({
                id: 'ntf-' + Date.now(),
                type: 'info',
                icon: '📤',
                text: `Retiro: ${printer.model} - ${reason}`,
                time: 'Ahora'
            });
            return { success: true };
        });
    }
};