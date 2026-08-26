const Navigation = {
    init() {
        document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.screen;
                if (target) this.goTo(target, false);
            });
        });

        document.querySelectorAll('[data-back]').forEach(btn => {
            btn.addEventListener('click', () => this.goBack());
        });
    },

    goTo(screenId, pushHistory = true) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(screenId);
        if (target) {
            target.classList.add('active');
            if (pushHistory) {
                AppState.pushScreen(screenId);
            } else {
                AppState.currentScreen = screenId;
                AppState.screenHistory = [];
                AppState.save();
            }
            this.updateBottomNav(screenId);
            this.triggerScreenInit(screenId);
        }
    },

    goBack() {
        const prev = AppState.popScreen();
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(prev);
        if (target) {
            target.classList.add('active');
            this.updateBottomNav(prev);
            this.triggerScreenInit(prev);
        }
    },

    updateBottomNav(screenId) {
        document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.screen === screenId);
        });
    },

    triggerScreenInit(screenId) {
        const map = {
            'home-screen': () => HomeScreen.init(),
            'calendar-screen': () => CalendarScreen.init(),
            'visit-detail-screen': () => VisitDetailScreen.init(),
            'printer-select-screen': () => PrinterSelectScreen.init(),
            'reading-capture-screen': () => ReadingCaptureScreen.init(),
            'problem-report-screen': () => ProblemReportScreen.init(),
            'printer-history-screen': () => PrinterHistoryScreen.init(),
            'toner-delivery-screen': () => TonerDeliveryScreen.init(),
            'installation-screen': () => InstallationScreen.init(),
            'removal-screen': () => RemovalScreen.init(),
            'alerts-screen': () => AlertsScreen.init(),
            'profile-screen': () => ProfileScreen.init()
        };
        if (map[screenId]) map[screenId]();
    }
};