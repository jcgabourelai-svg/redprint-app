const AppState = {
    currentScreen: 'login-screen',
    previousScreen: null,
    screenHistory: [],
    user: null,
    currentVisit: null,
    currentPrinter: null,
    currentToner: null,
    syncPending: 0,

    save() {
        const data = {
            user: this.user,
            currentScreen: this.currentScreen,
            syncPending: this.syncPending
        };
        try {
            localStorage.setItem('redprint_state', JSON.stringify(data));
        } catch (e) {
            console.warn('Error saving state:', e);
        }
    },

    load() {
        try {
            const raw = localStorage.getItem('redprint_state');
            if (raw) {
                const data = JSON.parse(raw);
                if (data.user) this.user = data.user;
                if (data.currentScreen) this.currentScreen = data.currentScreen;
                if (data.syncPending !== undefined) this.syncPending = data.syncPending;
            }
        } catch (e) {
            console.warn('Error loading state:', e);
        }
    },

    clear() {
        this.user = null;
        this.currentVisit = null;
        this.currentPrinter = null;
        this.currentToner = null;
        this.currentScreen = 'login-screen';
        this.screenHistory = [];
        this.syncPending = 0;
        localStorage.removeItem('redprint_state');
        localStorage.removeItem('redprint_pending_sync');
    },

    pushScreen(screenId) {
        this.screenHistory.push(this.currentScreen);
        this.previousScreen = this.currentScreen;
        this.currentScreen = screenId;
        this.save();
    },

    popScreen() {
        if (this.screenHistory.length > 0) {
            const prev = this.screenHistory.pop();
            this.currentScreen = prev;
            this.previousScreen = this.currentScreen;
            this.save();
            return prev;
        }
        return 'home-screen';
    },

    addPendingSync(item) {
        this.syncPending++;
        try {
            let pending = JSON.parse(localStorage.getItem('redprint_pending_sync') || '[]');
            pending.push({ ...item, timestamp: Date.now() });
            localStorage.setItem('redprint_pending_sync', JSON.stringify(pending));
        } catch (e) { /* ignore */ }
        this.save();
        OfflineIndicator.update();
    },

    removePendingSync() {
        if (this.syncPending > 0) this.syncPending--;
        this.save();
        OfflineIndicator.update();
    }
};

const OfflineIndicator = {
    el: null,
    badgeEl: null,

    init() {
        this.el = document.getElementById('sync-indicator');
        this.badgeEl = this.el ? this.el.querySelector('.sync-badge') : null;
        this.update();
    },

    update() {
        if (!this.el) return;
        if (AppState.syncPending > 0) {
            this.el.classList.remove('hidden');
            if (this.badgeEl) {
                this.badgeEl.classList.remove('hidden');
                this.badgeEl.textContent = AppState.syncPending;
            }
        } else {
            this.el.classList.add('hidden');
        }
    }
};