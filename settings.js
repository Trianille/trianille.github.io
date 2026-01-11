// Инициализация модуля настроек
function initSettingsModule() {
    const settingsBtn = document.getElementById('settingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const closeBtn = document.querySelector('.close-btn[data-modal-id="settingsModal"]');
    const cancelBtn = document.querySelector('.btn-secondary[data-modal-id="settingsModal"]');
    
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            openSettingsModal();
        });
    }
    
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSettings);
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => closeModal('settingsModal'));
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => closeModal('settingsModal'));
    }
}

// Открытие модального окна настроек
async function openSettingsModal() {
    const state = window.appState;
    const currentUser = state.getCurrentUser();
    
    if (!currentUser) return;
    
    try {
        // Загружаем настройки пользователя
        const userDoc = await state.db.collection('users').doc(currentUser.uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            console.log(userData);
            // Загружаем статистику
			const notesQuery = userData.totalNotes;
			const tagsQuery = userData.totalTags;
            /*const notesQuery = await state.db.collection('users').doc(currentUser.uid)
                .collection('notes')
                .get();
            
            const tagsQuery = await state.db.collection('users').doc(currentUser.uid)
                .collection('tags')
                .get();
            */
            // Обновляем счетчики в интерфейсе
            document.getElementById('settingsTotalNotesCount').textContent = notesQuery;
            document.getElementById('settingsTotalTagsCount').textContent = tagsQuery;
            
            // Загружаем сохраненные настройки
            const cardsPerSession = userData.cardsPerSession || '20';
            const cardsPerSessionSelect = document.getElementById('cardsPerSessionSelect');
            if (cardsPerSessionSelect) {
                cardsPerSessionSelect.value = cardsPerSession;
            }
        }
        
        openModal('settingsModal');
        
    } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
        showAlert('Ошибка загрузки настроек');
    }
}

// Сохранение настроек
async function saveSettings() {
    const state = window.appState;
    const currentUser = state.getCurrentUser();
    
    if (!currentUser) return;
    
    try {
        const cardsPerSessionSelect = document.getElementById('cardsPerSessionSelect');
        const cardsPerSession = cardsPerSessionSelect ? cardsPerSessionSelect.value : '20';
        
        // Загружаем текущие данные пользователя
        const userDocRef = state.db.collection('users').doc(currentUser.uid);
        const userDoc = await userDocRef.get();
        
        const userData = userDoc.exists ? userDoc.data() : {};
        
        // Обновляем настройки
        const updatedData = {
            ...userData,
            cardsPerSession,
            updatedAt: new Date().toISOString()
        };
        
        await userDocRef.set(updatedData, { merge: true });
        
        showAlert('Настройки сохранены');
        closeModal('settingsModal');
        
    } catch (error) {
        console.error('Ошибка сохранения настроек:', error);
        showAlert('Ошибка сохранения настроек');
    }
}

// Функция для обновления счетчиков в Firestore
async function updateUserCounters() {
    const state = window.appState;
    const currentUser = state.getCurrentUser();
    
    if (!currentUser) return;
    
    try {
        // Получаем текущее количество заметок и тегов
        const notesQuery = await state.db.collection('users').doc(currentUser.uid)
            .collection('notes')
            .get();
        
        const tagsQuery = await state.db.collection('users').doc(currentUser.uid)
            .collection('tags')
            .get();
        
        // Обновляем документ пользователя
        await state.db.collection('users').doc(currentUser.uid).set({
            totalNotes: notesQuery.size,
            totalTags: tagsQuery.size,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        
        console.log('Счетчики обновлены:', {
            notes: notesQuery.size,
            tags: tagsQuery.size
        });
        
    } catch (error) {
        console.error('Ошибка обновления счетчиков:', error);
    }
}

// Функции для обновления счетчиков при изменениях
async function updateNotesCounter() {
    await updateUserCounters();
}

async function updateTagsCounter() {
    await updateUserCounters();
}