// Модуль UI и попапов
function initUIModule() {
    console.log('Модуль UI инициализирован');
}

// Аватар
function stringToColor(string) {
            let hash = 0;
            for (let i = 0; i < string.length; i++) {
                hash = string.charCodeAt(i) + ((hash << 5) - hash);
            }
            
            // Используем только насыщенные цвета (убираем слишком светлые и темные)
            const hue = hash % 360;
            const saturation = 70 + (hash % 30); // 70-100%
            const lightness = 50 + (hash % 20);  // 50-70%
            
            return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        }
        
        function generateAvatar(email) {
            const firstLetter = email.charAt(0).toUpperCase();
            const color = stringToColor(email);
            
            const avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.style.backgroundColor = color;
            avatar.textContent = firstLetter;
            
            return avatar;
        }

// Система попапов
let confirmCallback = null;

// Показать попап подтверждения
function showConfirm(message, callback) {
    console.log('Показываем подтверждение:', message);
    document.getElementById('popupMessage').textContent = message;
    document.getElementById('confirmPopup').style.display = 'flex';
    confirmCallback = callback;
}

// Обработчик кнопки "Да"
function confirmYes() {
    console.log('Нажата кнопка "Да"');
    
    if (confirmCallback) {
        console.log('Выполняем колбэк...');
        try {
            confirmCallback();
            console.log('Колбэк выполнен успешно');
        } catch (error) {
            console.error('Ошибка в колбэке:', error);
        }
    }
    
    document.getElementById('confirmPopup').style.display = 'none';
    confirmCallback = null;
}

// Обработчик кнопки "Нет"
function confirmNo() {
    console.log('Нажата кнопка "Нет"');
    document.getElementById('confirmPopup').style.display = 'none';
    confirmCallback = null;
}

// Показать попап уведомления
function showAlert(message) {
    console.log('Показываем уведомление:', message);
    document.getElementById('alertMessage').textContent = message;
    document.getElementById('alertPopup').style.display = 'flex';
}

// Скрыть попап уведомления
function closeAlert() {
    document.getElementById('alertPopup').style.display = 'none';
}

// Открытие модального окна
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

// Закрыть модальное окно
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Закрыть все модальные окна
function closeAllModals() {
    ['authModal', 'noteModal', 'tagsModal', 'addTagModal', 'confirmPopup', 'alertPopup']
        .forEach(modalId => closeModal(modalId));
}

// Показать загрузку
function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

// Скрыть загрузку
function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

// Показать сообщение авторизации
function showAuthMessage(message, type) {
    const el = document.getElementById('authMessage');
    el.textContent = message;
    el.className = type === 'success' ? 'message-success' : 'message-error';
}

// Экспорт функций
window.showConfirm = showConfirm;
window.confirmYes = confirmYes;
window.confirmNo = confirmNo;
window.showAlert = showAlert;
window.closeAlert = closeAlert;
window.closeModal = closeModal;
window.closeAllModals = closeAllModals;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showAuthMessage = showAuthMessage;