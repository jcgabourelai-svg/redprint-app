const ProfileScreen = {
    init() {
        if (AppState.user) {
            document.getElementById('profile-name').textContent = AppState.user.name;
            document.getElementById('profile-email').textContent = AppState.user.email;
        }
        document.getElementById('profile-logout').onclick = () => {
            AppState.clear();
            Toast.info('Sesión cerrada');
            Navigation.goTo('login-screen', false);
        };
    }
};