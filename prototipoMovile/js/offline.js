const Offline = {
    isOnline: true,

    init() {
        this.isOnline = navigator.onLine;
        window.addEventListener('online', () => this.onStatusChange(true));
        window.addEventListener('offline', () => this.onStatusChange(false));
    },

    onStatusChange(online) {
        this.isOnline = online;
        if (online) {
            Toast.info('Conexión restaurada');
            this.simulateSync();
        } else {
            Toast.error('Sin conexión - Los datos se guardarán localmente');
        }
    },

    async simulateSync() {
        if (AppState.syncPending > 0) {
            Toast.info(`Sincronizando ${AppState.syncPending} cambios pendientes...`);
            await new Promise(r => setTimeout(r, 2000));
            while (AppState.syncPending > 0) {
                AppState.removePendingSync();
            }
            Toast.success('¡Sincronización completada!');
        }
    }
};