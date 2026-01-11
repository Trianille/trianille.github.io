// Модуль авторизации
function initAuthModule() {
    console.log('Модуль авторизации инициализирован');
}

// Вход
async function signIn() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showAuthMessage('Введите email и пароль', 'error');
        return;
    }
    
    try {
        showLoading();
        await auth.signInWithEmailAndPassword(email, password);
        // Загрузка скроется автоматически в handleAuthStateChanged
    } catch (error) {
        hideLoadingForce(); // Используем принудительное скрытие
        showAuthMessage(error.message, 'error');
    }
}

// Регистрация
async function signUp() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showAuthMessage('Введите email и пароль', 'error');
        return;
    }
    
    try {
        showLoading();
        await auth.createUserWithEmailAndPassword(email, password);
        showAuthMessage('Регистрация успешна!', 'success');
        // Загрузка скроется автоматически
    } catch (error) {
        hideLoadingForce(); // Используем принудительное скрытие
        showAuthMessage(error.message, 'error');
    }
}

// Выход
async function signOut() {
    try {
        // Показываем загрузку на короткое время
        showLoading();
        
        const state = window.appState;
        const user = state.getCurrentUser();
        
        if (user) {
            // Очищаем локальные данные пользователя
            localStorageManager.clearUserData(user.uid);
        }
        
        // Отписываемся от слушателей
        if (state.unsubscribeNotes) {
            state.unsubscribeNotes();
            state.setUnsubscribeNotes(null);
        }
        
        if (state.unsubscribeTags) {
            state.unsubscribeTags();
            state.setUnsubscribeTags(null);
        }
        
        // Выходим из Firebase
        await auth.signOut();
        
        // Немедленно показываем форму авторизации
        setTimeout(() => {
            hideLoadingForce();
            showAuthModalImmediate();
        }, 500);
        
    } catch (error) {
        console.error('Ошибка выхода:', error);
        hideLoadingForce();
        showAuthModalImmediate();
    }
}

// Показать модальное окно авторизации (старая версия для обратной совместимости)
function showAuthModal() {
    hideLoadingForce();
    const authModal = document.getElementById('authModal');
    if (authModal) {
        authModal.style.display = 'flex';
    }
}

// Экспорт функций
window.signIn = signIn;
window.signUp = signUp;
window.signOut = signOut;
window.showAuthModal = showAuthModal;