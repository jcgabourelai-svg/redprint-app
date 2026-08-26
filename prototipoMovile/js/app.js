document.addEventListener('DOMContentLoaded', () => {
    Modal.init();
    Toast.init();
    OfflineIndicator.init();
    Offline.init();
    Navigation.init();
    LoginScreen.init();

    AppState.load();

    if (AppState.user) {
        Navigation.goTo('home-screen', false);
    } else {
        Navigation.goTo('login-screen', false);
    }
});