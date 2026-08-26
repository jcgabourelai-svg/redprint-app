const DummyData = {
    user: {
        id: 'op-001',
        name: 'Juan García',
        email: 'juan@redprint.com',
        role: 'OPERADOR'
    },

    clients: [
        {
            id: 'cli-001',
            name: 'Empresa Alpha',
            email: 'contacto@empresaalpha.com',
            phone: '55-1234-5678',
            address: 'Av. Reforma 234, Col. Centro'
        },
        {
            id: 'cli-002',
            name: 'Corporativo Beta',
            email: 'admin@corporativobeta.com',
            phone: '55-8765-4321',
            address: 'Blvd. de la Luz 567, Del. Benito Juárez'
        },
        {
            id: 'cli-003',
            name: 'Industrias Gamma',
            email: 'contacto@industriasgamma.com',
            phone: '55-2468-1357',
            address: 'Calle Industrial 89, Parque Industrial Norte'
        },
        {
            id: 'cli-004',
            name: 'Servicios Delta',
            email: 'info@serviciosdelta.com',
            phone: '55-1357-2468',
            address: 'Paseo de la Reforma 1010, Col. Juárez'
        }
    ],

    printers: [
        {
            id: 'prt-001',
            model: 'HP LaserJet Pro M404dn',
            serial: 'VCN3K9F12M',
            status: 'RENTADA',
            clientId: 'cli-001',
            lastReading: 12450,
            lastReadingDate: '2026-05-01',
            warehouseId: null,
            contractId: 'ctr-001',
            history: [
                { date: '2026-04-01', type: 'Instalación', desc: 'Instalación en Empresa Alpha', who: 'Juan García' },
                { date: '2026-04-15', type: 'Lectura', desc: 'Lectura: 8,200 hojas', who: 'Juan García' },
                { date: '2026-05-01', type: 'Lectura', desc: 'Lectura: 12,450 hojas', who: 'Juan García' },
                { date: '2026-05-10', type: 'Entrega toner', desc: 'Tóner HP 85A entregado', who: 'Juan García' },
                { date: '2026-05-15', type: 'Problema', desc: 'Atascos frecuentes reportados', who: 'Juan García' }
            ]
        },
        {
            id: 'prt-002',
            model: 'Canon imageRUNNER 1435iF',
            serial: 'JKR7H4G21P',
            status: 'RENTADA',
            clientId: 'cli-001',
            lastReading: 8320,
            lastReadingDate: '2026-05-01',
            warehouseId: null,
            contractId: 'ctr-001',
            history: [
                { date: '2026-03-15', type: 'Instalación', desc: 'Instalación en Empresa Alpha', who: 'Juan García' },
                { date: '2026-04-01', type: 'Lectura', desc: 'Lectura: 5,100 hojas', who: 'Juan García' },
                { date: '2026-05-01', type: 'Lectura', desc: 'Lectura: 8,320 hojas', who: 'Juan García' }
            ]
        },
        {
            id: 'prt-003',
            model: 'HP LaserJet Pro M428fdw',
            serial: 'CNB5R2T89K',
            status: 'RENTADA',
            clientId: 'cli-002',
            lastReading: 22100,
            lastReadingDate: '2026-05-05',
            warehouseId: null,
            contractId: 'ctr-002',
            history: [
                { date: '2026-01-10', type: 'Instalación', desc: 'Instalación en Corporativo Beta', who: 'Pedro López' },
                { date: '2026-02-01', type: 'Lectura', desc: 'Lectura: 12,000 hojas', who: 'Juan García' },
                { date: '2026-03-01', type: 'Lectura', desc: 'Lectura: 17,500 hojas', who: 'Juan García' },
                { date: '2026-04-02', type: 'Entrega toner', desc: 'Tóner HP 26X entregado', who: 'Juan García' },
                { date: '2026-05-05', type: 'Lectura', desc: 'Lectura: 22,100 hojas', who: 'Juan García' }
            ]
        },
        {
            id: 'prt-004',
            model: 'Brother HL-L6450DW',
            serial: 'BRH8M3N45Q',
            status: 'EN_ALMACEN',
            clientId: null,
            lastReading: 0,
            lastReadingDate: null,
            warehouseId: 'wh-001',
            contractId: null,
            history: [
                { date: '2026-04-20', type: 'Instalación', desc: 'Ingreso a almacén Centro', who: 'Admin' }
            ]
        },
        {
            id: 'prt-005',
            model: 'Epson WorkForce WF-4830',
            serial: 'EPW2K7L18R',
            status: 'EN_ALMACEN',
            clientId: null,
            lastReading: 0,
            lastReadingDate: null,
            warehouseId: 'wh-001',
            contractId: null,
            history: []
        },
        {
            id: 'prt-006',
            model: 'HP Color LaserJet Pro M255dw',
            serial: 'HPC9F4D22W',
            status: 'RENTADA',
            clientId: 'cli-003',
            lastReading: 5800,
            lastReadingDate: '2026-05-10',
            warehouseId: null,
            contractId: 'ctr-003',
            history: [
                { date: '2026-02-15', type: 'Instalación', desc: 'Instalación en Industrias Gamma', who: 'Juan García' },
                { date: '2026-04-10', type: 'Lectura', desc: 'Lectura: 3,200 hojas', who: 'Juan García' },
                { date: '2026-05-10', type: 'Lectura', desc: 'Lectura: 5,800 hojas', who: 'Juan García' }
            ]
        }
    ],

    visits: [
        {
            id: 'vis-001',
            clientId: 'cli-001',
            date: '2026-05-26',
            timeStart: '09:00',
            timeEnd: '10:30',
            type: 'Lectura de contador',
            status: 'PENDIENTE',
            printerIds: ['prt-001', 'prt-002'],
            notes: ''
        },
        {
            id: 'vis-002',
            clientId: 'cli-002',
            date: '2026-05-26',
            timeStart: '11:00',
            timeEnd: '12:00',
            type: 'Entrega de tóner',
            status: 'PENDIENTE',
            printerIds: ['prt-003'],
            notes: ''
        },
        {
            id: 'vis-003',
            clientId: 'cli-003',
            date: '2026-05-26',
            timeStart: '14:00',
            timeEnd: '15:00',
            type: 'Lectura de contador',
            status: 'PENDIENTE',
            printerIds: ['prt-006'],
            notes: ''
        },
        {
            id: 'vis-004',
            clientId: 'cli-004',
            date: '2026-05-27',
            timeStart: '10:00',
            timeEnd: '11:30',
            type: 'Instalación',
            status: 'PENDIENTE',
            printerIds: [],
            notes: 'Instalar impresora nueva'
        },
        {
            id: 'vis-005',
            clientId: 'cli-001',
            date: '2026-05-28',
            timeStart: '09:00',
            timeEnd: '10:00',
            type: 'Lectura de contador',
            status: 'PENDIENTE',
            printerIds: ['prt-001'],
            notes: ''
        },
        {
            id: 'vis-006',
            clientId: 'cli-002',
            date: '2026-05-24',
            timeStart: '15:00',
            timeEnd: '16:00',
            type: 'Lectura de contador',
            status: 'PENDIENTE',
            printerIds: ['prt-003'],
            notes: ''
        }
    ],

    contracts: [
        { id: 'ctr-001', clientId: 'cli-001', status: 'ACTIVO', startDate: '2026-01-15', pagesIncluded: 3000, rate: 1.0 },
        { id: 'ctr-002', clientId: 'cli-002', status: 'ACTIVO', startDate: '2026-01-10', pagesIncluded: 5000, rate: 0.85 },
        { id: 'ctr-003', clientId: 'cli-003', status: 'ACTIVO', startDate: '2026-02-15', pagesIncluded: 2000, rate: 1.2 },
        { id: 'ctr-004', clientId: 'cli-004', status: 'ACTIVO', startDate: '2026-03-01', pagesIncluded: 4000, rate: 0.95 }
    ],

    toners: [
        { id: 'ton-001', name: 'Tóner HP 85A', model: 'CE285A', compatibleWith: ['HP LaserJet Pro M404dn', 'HP LaserJet Pro M428fdw'], stock: 5, threshold: 3 },
        { id: 'ton-002', name: 'Tóner HP 26X', model: 'CF226X', compatibleWith: ['HP LaserJet Pro M428fdw'], stock: 1, threshold: 3 },
        { id: 'ton-003', name: 'Tóner Canon C-EXV14', model: 'C-EXV14', compatibleWith: ['Canon imageRUNNER 1435iF'], stock: 0, threshold: 2 },
        { id: 'ton-004', name: 'Tóner Brother TN-880', model: 'TN-880', compatibleWith: ['Brother HL-L6450DW'], stock: 4, threshold: 2 },
        { id: 'ton-005', name: 'Tóner Epson 212XL', model: '212XL', compatibleWith: ['Epson WorkForce WF-4830'], stock: 2, threshold: 3 },
        { id: 'ton-006', name: 'Tóner HP 206A', model: 'W2210A', compatibleWith: ['HP Color LaserJet Pro M255dw'], stock: 6, threshold: 3 }
    ],

    warehouses: [
        { id: 'wh-001', name: 'Almacén Centro', location: 'Av. Centro 100, Col. Centro', active: true },
        { id: 'wh-002', name: 'Almacén Norte', location: 'Blvd. Norte 250, Zona Industrial', active: true }
    ],

    notifications: [
        { id: 'ntf-001', type: 'warning', icon: '⚠️', text: 'Stock bajo: Tóner HP 26X (1 unidad)', time: 'Hace 2h' },
        { id: 'ntf-002', type: 'error', icon: '🔴', text: 'Stock agotado: Tóner Canon C-EXV14', time: 'Hace 5h' },
        { id: 'ntf-003', type: 'warning', icon: '🔴', text: 'Visita retrasada: Servicios Delta (24/05)', time: 'Hace 1d' }
    ],

    getClient(id) { return this.clients.find(c => c.id === id); },
    getPrinter(id) { return this.printers.find(p => p.id === id); },
    getVisit(id) { return this.visits.find(v => v.id === id); },
    getContract(id) { return this.contracts.find(c => c.id === id); },
    getToner(id) { return this.toners.find(t => t.id === id); },
    getWarehouse(id) { return this.warehouses.find(w => w.id === id); },

    getCompatibleToners(printerModel) {
        return this.toners.filter(t => t.compatibleWith.includes(printerModel));
    },

    getPrintersForClient(clientId) {
        return this.printers.filter(p => p.clientId === clientId && p.status === 'RENTADA');
    },

    getPrintersForVisit(visitId) {
        const visit = this.getVisit(visitId);
        if (!visit) return [];
        return visit.printerIds.map(id => this.getPrinter(id)).filter(Boolean);
    },

    getWarehousePrinters() {
        return this.printers.filter(p => p.status === 'EN_ALMACEN');
    },

    getRentedPrinters(clientId) {
        return this.printers.filter(p => p.status === 'RENTADA' && (!clientId || p.clientId === clientId));
    },

    getContractsForClient(clientId) {
        return this.contracts.filter(c => c.clientId === clientId && c.status === 'ACTIVO');
    },

    getActiveWarehouses() {
        return this.warehouses.filter(w => w.active);
    },

    getVisitsForDate(date) {
        return this.visits.filter(v => v.date === date);
    },

    getVisitsForWeek(startDate) {
        const start = new Date(startDate);
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            dates.push(d.toISOString().split('T')[0]);
        }
        return this.visits.filter(v => dates.includes(v.date));
    },

    getAllPendingVisits() {
        return this.visits.filter(v => v.status !== 'COMPLETADA' && v.status !== 'CANCELADA');
    },

    formatNumber(n) {
        return n.toLocaleString('es-MX');
    },

    formatDate(dateStr) {
        const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
        const d = new Date(dateStr + 'T12:00:00');
        return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
    },

    formatShortDate(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
    },

    isToday(dateStr) {
        return dateStr === '2026-05-26';
    },

    isPast(dateStr) {
        return new Date(dateStr + 'T23:59:59') < new Date('2026-05-26T00:00:00');
    }
};