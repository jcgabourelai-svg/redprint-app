const LoginScreen = {
    emailInput: null,
    passInput: null,
    loginBtn: null,
    emailError: null,
    passError: null,

    init() {
        this.emailInput = document.getElementById('login-email');
        this.passInput = document.getElementById('login-password');
        this.loginBtn = document.getElementById('login-btn');
        this.emailError = document.getElementById('login-email-error');
        this.passError = document.getElementById('login-password-error');

        this.emailInput.addEventListener('input', () => this.validate());
        this.passInput.addEventListener('input', () => this.validate());
        this.emailInput.addEventListener('blur', () => this.validateEmail());
        this.passInput.addEventListener('blur', () => this.validatePassword());
        this.loginBtn.addEventListener('click', () => this.doLogin());
    },

    validateEmail() {
        const val = this.emailInput.value.trim();
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!val) {
            this.emailError.textContent = '';
            return false;
        }
        if (!re.test(val)) {
            this.emailError.textContent = '⚠️ Ingresa un correo válido';
            return false;
        }
        this.emailError.textContent = '';
        return true;
    },

    validatePassword() {
        const val = this.passInput.value;
        if (!val) {
            this.passError.textContent = '';
            return false;
        }
        if (val.length < 8) {
            this.passError.textContent = '⚠️ Mínimo 8 caracteres';
            return false;
        }
        this.passError.textContent = '';
        return true;
    },

    validate() {
        const emailOk = this.validateEmail();
        const passOk = this.validatePassword();
        this.loginBtn.disabled = !(emailOk && passOk);
    },

    async doLogin() {
        this.loginBtn.disabled = true;
        this.loginBtn.innerHTML = '<span class="loading-spinner"></span> Iniciando sesión...';

        const result = await API.login(this.emailInput.value.trim(), this.passInput.value);

        if (result.success) {
            AppState.user = result.user;
            AppState.save();
            Toast.success(`¡Bienvenido, ${result.user.name}!`);
            Navigation.goTo('home-screen', false);
        } else {
            Toast.error(result.error);
            this.loginBtn.disabled = false;
            this.loginBtn.textContent = 'Iniciar Sesión';
        }
    }
};