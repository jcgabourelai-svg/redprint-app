const AlertsScreen = {
    init() {
        const list = document.getElementById('alerts-list');
        const emptyState = document.getElementById('alerts-empty-state');

        if (DummyData.notifications.length === 0) {
            list.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        list.innerHTML = DummyData.notifications.map(n =>
            `<div class="alert-item">
                <span class="alert-icon">${n.icon}</span>
                <div>
                    <p class="alert-text">${n.text}</p>
                    <p class="alert-time">${n.time}</p>
                </div>
            </div>`
        ).join('');
    }
};