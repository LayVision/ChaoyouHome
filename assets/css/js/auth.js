document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const loginCard = document.getElementById('login-card');
    const registerCard = document.getElementById('register-card');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const errorMessageDiv = document.getElementById('error-message');

    // --- Toggle between Login and Register Forms ---
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginCard.classList.add('d-none');
        registerCard.classList.remove('d-none');
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerCard.classList.add('d-none');
        loginCard.classList.remove('d-none');
    });
    
    // --- Display Error Messages ---
    function showErrorMessage(message) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.classList.remove('d-none');
    }

    // --- Handle Registration ---
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = registerForm['register-email'].value;
        const password = registerForm['register-password'].value;
        const confirmPassword = registerForm['register-confirm-password'].value;

        // Basic validation
        if (password !== confirmPassword) {
            showErrorMessage("รหัสผ่านไม่ตรงกัน");
            return;
        }

        auth.createUserWithEmailAndPassword(email, password)
            .then(userCredential => {
                // Signed in
                console.log('User registered:', userCredential.user);
                // Redirect to homepage after registration
                window.location.href = 'index.html';
            })
            .catch(error => {
                console.error('Registration error:', error.message);
                showErrorMessage(error.message); // Show Firebase error message
            });
    });

    // --- Handle Login ---
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = loginForm['login-email'].value;
        const password = loginForm['login-password'].value;

        auth.signInWithEmailAndPassword(email, password)
            .then(userCredential => {
                // Signed in
                console.log('User logged in:', userCredential.user);
                // Redirect to homepage after login
                window.location.href = 'index.html';
            })
            .catch(error => {
                console.error('Login error:', error.message);
                showErrorMessage(error.message); // Show Firebase error message
            });
    });

});