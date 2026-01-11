// Глобальные переменные состояния
let currentUser = null;
let currentNoteId = null;
let currentFilterTag = null;
let selectedColor = '#FF6B6B';
let allTags = {};
let selectedNoteTags = [];
let selectedRating = 0;
let isOnline = navigator.onLine;
let appInitialized = false;

// Переменные для сессии обучения
let learningSession = null;
let sessionNotes = [];
let currentSessionIndex = 0;
let sessionRating = 0;

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    console.log('Приложение инициализируется');
    
    // Аварийный таймаут
    setTimeout(() => {
        if (!appInitialized) {
            hideLoadingForce();
            showAuthModal();
        }
    }, 5000);
    
    // Настройка Firebase авторизации
    if (auth && typeof auth.onAuthStateChanged === 'function') {
        auth.onAuthStateChanged(handleAuthStateChanged);
    } else {
        hideLoadingForce();
        showAuthModal();
    }
    
    // Настройка UI
    if (typeof setupColorPicker === 'function') setupColorPicker();
    if (typeof setupModalCloseListeners === 'function') setupModalCloseListeners();
    
    // Настройка слушателей сети
    window.addEventListener('online', () => {
        isOnline = true;
        updateNetworkStatus();
    });
    
    window.addEventListener('offline', () => {
        isOnline = false;
        updateNetworkStatus();
    });
    
    // Инициализация модулей
    setTimeout(() => initModules(), 100);
});

// Инициализация модулей
function initModules() {
    console.log('Инициализация модулей...');
    
    try {
        if (typeof initAuthModule === 'function') initAuthModule();
        if (typeof initNotesModule === 'function') initNotesModule();
        if (typeof initTagsModule === 'function') initTagsModule();
        if (typeof initUIModule === 'function') initUIModule();
        if (typeof initImportExportModule === 'function') initImportExportModule();
        if (typeof initSettingsModule === 'function') initSettingsModule();
        if (typeof initSyncModule === 'function') initSyncModule();
    } catch (error) {
        console.error('Ошибка инициализации модулей:', error);
    }
}

// Обработка авторизации
async function handleAuthStateChanged(user) {
    appInitialized = true;
    currentUser = user;
    
    hideLoadingForce();
    
    if (user) {
        showMainAppImmediate(user);
        // Загружаем данные
        await loadUserData(user);
    } else {
        hideMainAppImmediate();
        showAuthModalImmediate();
    }
}

// Загрузка данных пользователя
async function loadUserData(user) {
    try {
        showLoading();
        
        // Проверяем, есть ли данные в localStorage
        const localNotes = localStorageManager.getAllNotes(user.uid);
        const localTags = localStorageManager.getAllTags(user.uid);
        
        if (Object.keys(localNotes).length > 0 || Object.keys(localTags).length > 0) {
            // Используем локальные данные
            console.log('Используем данные из localStorage');
            allTags = localTags;
            
            // Отображаем заметки
            const notesArray = objectToArray(localNotes);
            if (window.renderNotes) {
                renderNotes(notesArray);
            }
        } else {
            // Данных нет в localStorage, грузим из Firebase
            console.log('Данных нет в localStorage, грузим из Firebase');
            await loadFromFirebase(user);
        }
        
        hideLoading();
        
    } catch (error) {
        hideLoading();
        console.error('Ошибка загрузки данных:', error);
        showAlert('Ошибка загрузки данных: ' + error.message);
    }
}

// Загрузка из Firebase
async function loadFromFirebase(user) {
    try {
        // Загружаем теги
        const tagsSnapshot = await db.collection('users').doc(user.uid)
            .collection('tags')
            .orderBy('name')
            .get();
        
        const tags = {};
        tagsSnapshot.forEach(doc => {
            const data = doc.data();
            tags[doc.id] = {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate?.() || data.createdAt || null
            };
        });
        
        // Загружаем заметки
        const notesSnapshot = await db.collection('users').doc(user.uid)
            .collection('notes')
            .orderBy('updatedAt', 'desc')
            .get();
        
        const notes = {};
        notesSnapshot.forEach(doc => {
            const data = doc.data();
            notes[doc.id] = {
                id: doc.id,
                ...data,
                rating: typeof data.rating === 'number' ? data.rating : 0,
                createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
                updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || null
            };
        });
        
        // Сохраняем в localStorage
        localStorageManager.saveLocalData(user.uid, 'notes', notes);
        localStorageManager.saveLocalData(user.uid, 'tags', tags);
        
        // Обновляем состояние
        allTags = tags;
        
        // Отображаем заметки
        const notesArray = objectToArray(notes);
        if (window.renderNotes) {
            renderNotes(notesArray);
        }
        
        console.log('Данные загружены из Firebase:', {
            notes: Object.keys(notes).length,
            tags: Object.keys(tags).length
        });
        
    } catch (error) {
        console.error('Ошибка загрузки из Firebase:', error);
        throw error;
    }
}

// Сохранить заметку в Firebase (сразу отправляем)
async function saveNoteToFirebase(noteData, isUpdate = false) {
    if (!currentUser) {
        console.error('Пользователь не авторизован');
        throw new Error('Пользователь не авторизован');
    }
    
    try {
        const firebaseData = {
            title: noteData.title || '',
            body: noteData.body || '',
            subbody: noteData.subbody || '',
            notes: noteData.notes || '',
            rating: noteData.rating || 0,
            tagsArray: noteData.tagsArray || [],
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            userId: currentUser.uid
        };
        
        let noteId = noteData.id;
        
        if (isUpdate && noteId) {
            // Убираем локальный префикс если есть
            const firebaseId = noteId.replace('local_', '');
            await db.collection('users').doc(currentUser.uid)
                .collection('notes').doc(firebaseId).update(firebaseData);
            
            // Обновляем ID если был локальный
            if (noteId.startsWith('local_')) {
                await updateLocalNoteId(noteId, firebaseId);
                noteId = firebaseId;
            }
        } else {
            firebaseData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await db.collection('users').doc(currentUser.uid)
                .collection('notes').add(firebaseData);
            
            noteId = docRef.id;
            
            // Обновляем локальный ID если был локальный
            if (noteData.id && noteData.id.startsWith('local_')) {
                await updateLocalNoteId(noteData.id, noteId);
            }
            
            // Обновляем счетчики при создании новой заметки
            if (window.updateUserCounters) {
                setTimeout(() => updateUserCounters(), 1000);
            }
        }
        
        console.log('Заметка сохранена в Firebase:', noteId);
        return noteId;
        
    } catch (error) {
        console.error('Ошибка сохранения заметки в Firebase:', error);
        throw error;
    }
}

// Удалить заметку из Firebase (сразу отправляем)
async function deleteNoteFromFirebase(noteId) {
    if (!currentUser) {
        console.error('Пользователь не авторизован');
        throw new Error('Пользователь не авторизован');
    }
    
    try {
        // Удаляем локальный префикс если есть
        const firebaseId = noteId.replace('local_', '');
        
        await db.collection('users').doc(currentUser.uid)
            .collection('notes').doc(firebaseId).delete();
        
        console.log('Заметка удалена из Firebase:', firebaseId);
        
    } catch (error) {
        console.error('Ошибка удаления заметки из Firebase:', error);
        throw error;
    }
}

// Сохранить тег в Firebase (сразу отправляем)
async function saveTagToFirebase(tagData, isUpdate = false) {
    if (!currentUser) {
        console.error('Пользователь не авторизован');
        throw new Error('Пользователь не авторизован');
    }
    
    try {
        const firebaseData = {
            name: tagData.name,
            color: tagData.color,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            userId: currentUser.uid
        };
        
        let tagId = tagData.id;
        
        if (isUpdate && tagId) {
            const firebaseId = tagId.replace('local_', '');
            await db.collection('users').doc(currentUser.uid)
                .collection('tags').doc(firebaseId).update(firebaseData);
            
            if (tagId.startsWith('local_')) {
                await updateLocalTagId(tagId, firebaseId);
                tagId = firebaseId;
            }
        } else {
            firebaseData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await db.collection('users').doc(currentUser.uid)
                .collection('tags').add(firebaseData);
            
            tagId = docRef.id;
            
            if (tagData.id && tagData.id.startsWith('local_')) {
                await updateLocalTagId(tagData.id, tagId);
            }
        }
        
        console.log('Тег сохранен в Firebase:', tagId);
        return tagId;
        
    } catch (error) {
        console.error('Ошибка сохранения тега в Firebase:', error);
        throw error;
    }
}

// Удалить тег из Firebase (сразу отправляем)
async function deleteTagFromFirebase(tagId) {
    if (!currentUser) {
        console.error('Пользователь не авторизован');
        throw new Error('Пользователь не авторизован');
    }
    
    try {
        const firebaseId = tagId.replace('local_', '');
        
        await db.collection('users').doc(currentUser.uid)
            .collection('tags').doc(firebaseId).delete();
        
        console.log('Тег удален из Firebase:', firebaseId);
        
    } catch (error) {
        console.error('Ошибка удаления тега из Firebase:', error);
        throw error;
    }
}

// Обновить локальный ID заметки
async function updateLocalNoteId(localId, firebaseId) {
    if (!currentUser) return;
    
    const notes = localStorageManager.getAllNotes(currentUser.uid);
    if (notes[localId]) {
        notes[firebaseId] = {
            ...notes[localId],
            id: firebaseId,
            isLocal: false
        };
        delete notes[localId];
        localStorageManager.saveLocalData(currentUser.uid, 'notes', notes);
    }
}

// Обновить локальный ID тега
async function updateLocalTagId(localId, firebaseId) {
    if (!currentUser) return;
    
    const tags = localStorageManager.getAllTags(currentUser.uid);
    if (tags[localId]) {
        tags[firebaseId] = {
            ...tags[localId],
            id: firebaseId,
            isLocal: false
        };
        delete tags[localId];
        localStorageManager.saveLocalData(currentUser.uid, 'tags', tags);
        
        // Обновляем глобальное состояние
        allTags = tags;
    }
}

// Немедленный показ приложения
function showMainAppImmediate(user) {
    const loading = document.getElementById('loading');
    const authModal = document.getElementById('authModal');
    
    if (loading) loading.style.display = 'none';
    if (authModal) authModal.style.display = 'none';
    
    const header = document.getElementById('header');
    const main = document.getElementById('main');
    
    if (header) header.style.display = 'flex';
    if (main) main.style.display = 'block';
    
    // Настраиваем пользовательскую информацию
    try {
        const mainEmail = user.email;
        const avatar = generateAvatar(mainEmail);
        
        const avatarContainer = document.getElementById('avatarContainer');
        const avatarContainerOptions = document.getElementById('avatarContainerOptions');
        
        if (avatarContainer) {
            avatarContainer.innerHTML = '';
            avatarContainer.appendChild(avatar);
        }
        
        if (avatarContainerOptions) {
            avatarContainerOptions.innerHTML = '';
            avatarContainerOptions.appendChild(avatar.cloneNode(true));
        }
        
        const userEmailElement = document.getElementById('userEmail');
        const userEmailOptionsElement = document.getElementById('userEmailOptions');
        
        if (userEmailElement) userEmailElement.textContent = mainEmail;
        if (userEmailOptionsElement) userEmailOptionsElement.textContent = mainEmail;
        
    } catch (error) {
        console.error('Ошибка настройки пользовательской информации:', error);
    }
    
    // Показываем пустой контейнер заметок
    const notesContainer = document.getElementById('notesContainer');
    if (notesContainer && notesContainer.innerHTML === '') {
        notesContainer.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: #999; padding: 48px;">
                <div class="spinner small"></div>
                <div style="margin-top: 16px;">Загрузка заметок...</div>
            </div>
        `;
    }
}

// Немедленное скрытие приложения
function hideMainAppImmediate() {
    const header = document.getElementById('header');
    const main = document.getElementById('main');
    
    if (header) header.style.display = 'none';
    if (main) main.style.display = 'none';
    
    const notesContainer = document.getElementById('notesContainer');
    if (notesContainer) notesContainer.innerHTML = '';
    
    allTags = {};
    selectedNoteTags = [];
}

// Немедленный показ формы авторизации
function showAuthModalImmediate() {
    const loading = document.getElementById('loading');
    const authModal = document.getElementById('authModal');
    
    if (loading) loading.style.display = 'none';
    if (authModal) authModal.style.display = 'flex';
}

// Принудительное скрытие загрузки
function hideLoadingForce() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'none';
        loading.classList.add('hidden');
    }
    
    document.body.style.visibility = 'visible';
    document.body.style.opacity = '1';
}

// Конвертация объекта в массив для отображения
function objectToArray(obj) {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj;
    
    return Object.values(obj).filter(item => item && typeof item === 'object');
}

// Обновление статуса сети
function updateNetworkStatus() {
    const indicator = document.getElementById('networkStatus');
    if (!indicator) return;
    
    if (isOnline) {
        indicator.innerHTML = '<i class="fas fa-wifi"></i>';
        indicator.style.color = '#4CAF50';
        indicator.title = 'Онлайн';
    } else {
        indicator.innerHTML = '<i class="fas fa-wifi-slash"></i>';
        indicator.style.color = '#f44336';
        indicator.title = 'Офлайн';
    }
}

// Настройка выбора цвета
function setupColorPicker() {
    const colorOptions = document.querySelectorAll('.color-option');
    if (colorOptions.length === 0) return;
    
    colorOptions.forEach(option => {
        option.addEventListener('click', function() {
            colorOptions.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            selectedColor = this.dataset.color;
        });
    });
    
    if (colorOptions.length > 0) {
        colorOptions[0].classList.add('selected');
        selectedColor = colorOptions[0].dataset.color || '#FF6B6B';
    }
}

// Закрыть все модальные окна
function closeAllModals() {
    const modals = ['authModal', 'noteModal', 'tagsModal', 'addTagModal', 
                   'confirmPopup', 'alertPopup', 'importModal', 'exportModal',
                   'settingsModal'];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    });
    
    document.body.style.overflow = 'auto';
}

// Закрытие по клику вне области
function closeModalOnOutsideClick(event, modalId) {
    if (event.target.id === modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }
}

// Показать пустое состояние заметок
function showEmptyNotesState() {
    const notesContainer = document.getElementById('notesContainer');
    if (notesContainer) {
        const filterTag = window.appState?.getCurrentFilterTag?.() || null;
        
        notesContainer.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: #999; padding: 48px;">
                ${filterTag ? 
                    'Нет заметок с этим тегом' : 
                    'Нет заметок. Создайте первую!'}
            </div>
        `;
    }
}

// Ручная синхронизация (очистка localStorage и загрузка из Firebase)
async function performManualSync() {
    if (!currentUser) {
        showAlert('Сначала войдите в систему');
        return;
    }
    
    const syncBtn = document.getElementById('syncBtn');
    const originalHtml = syncBtn ? syncBtn.innerHTML : '';
    
    if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
    
    try {
        showLoading();
        
        // 1. Очищаем localStorage
        localStorageManager.clearUserData(currentUser.uid);
        
        // 2. Загружаем свежие данные из Firebase
        await loadFromFirebase(currentUser);
        
        hideLoading();
        showAlert('Синхронизация завершена. Данные обновлены.');
        
    } catch (error) {
        hideLoading();
        console.error('Ошибка синхронизации:', error);
        showAlert('Ошибка синхронизации: ' + error.message);
    } finally {
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.innerHTML = originalHtml;
        }
    }
}

// Экспорт глобальных переменных
window.appState = {
    getCurrentUser: () => currentUser,
    getCurrentNoteId: () => currentNoteId,
    setCurrentNoteId: (id) => { currentNoteId = id; },
    
    getAllTags: () => allTags,
    setAllTags: (tags) => {
        if (!tags) {
            allTags = {};
        } else if (typeof tags === 'object' && !Array.isArray(tags)) {
            allTags = tags;
        } else if (Array.isArray(tags)) {
            // Конвертируем массив в объект
            allTags = {};
            tags.forEach(tag => {
                if (tag && tag.id) allTags[tag.id] = tag;
            });
        } else {
            console.error('setAllTags: некорректный тип данных:', typeof tags);
            allTags = {};
        }
    },
    
    getSelectedNoteTags: () => selectedNoteTags,
    setSelectedNoteTags: (tags) => {
        if (Array.isArray(tags)) {
            selectedNoteTags = tags;
        } else {
            selectedNoteTags = [];
        }
    },
    
    getCurrentFilterTag: () => currentFilterTag,
    setCurrentFilterTag: (tag) => { currentFilterTag = tag; },
    getSelectedColor: () => selectedColor,
    getSelectedRating: () => selectedRating,
    setSelectedRating: (rating) => { selectedRating = parseInt(rating) || 0; },
    isOnline: () => isOnline,
    
    // Firebase
    db,
    auth,
    
    // Локальное хранилище
    localStorageManager,
    
    // Функции работы с Firebase
    saveNoteToFirebase,
    deleteNoteFromFirebase,
    saveTagToFirebase,
    deleteTagFromFirebase
};

// Быстрое обновление одной заметки в UI
function updateNoteInUI(updatedNote) {
    const container = document.getElementById('notesContainer');
    if (!container) return;
    
    // Находим элемент заметки по ID
    const noteElement = container.querySelector(`[data-note-id="${updatedNote.id}"]`);
    
    if (noteElement) {
        // Обновляем элемент заметки
        const rating = updatedNote.rating || 0;
        const ratingClass = `rating-${rating}`;
        
        // Находим элементы внутри карточки
        const ratingIndicator = noteElement.querySelector('.note-rating-indicator');
        const ratingDisplay = noteElement.querySelector('.note-rating-display');
        
        if (ratingIndicator) {
            // Обновляем классы рейтинга
            ratingIndicator.className = `note-rating-indicator ${ratingClass}`;
        }
        
        if (ratingDisplay) {
            // Обновляем текст рейтинга
            if (rating > 0) {
                ratingDisplay.innerHTML = `<span style="font-weight: bold; color: #666;">Оценка: ${rating}/5</span>`;
            } else {
                ratingDisplay.innerHTML = '';
            }
        }
        
        console.log('Заметка обновлена в UI:', updatedNote.id);
    } else {
        // Если элемент не найден, обновляем весь список
        console.log('Элемент не найден, обновляем весь список');
        applyCurrentFilter();
    }
}

// Применить текущий фильтр
function applyCurrentFilter() {
    const state = window.appState;
    const currentUser = state.getCurrentUser();
    
    if (!currentUser) {
        showEmptyNotesState();
        return;
    }
    
    try {
        // Загружаем локальные заметки как объект
        const notesObj = localStorageManager.getAllNotes(currentUser.uid);
        
        // Проверяем, что есть данные
        if (!notesObj || Object.keys(notesObj).length === 0) {
            showEmptyNotesState();
            return;
        }
        
        // Конвертируем в массив
        let notesArray = objectToArray(notesObj);
        
        console.log('Заметок для фильтрации:', notesArray.length);
        
        // Применяем фильтр
        const filterTag = state.getCurrentFilterTag();
        if (filterTag && filterTag.trim() !== '') {
            const filteredNotes = notesArray.filter(note => 
                note && note.tagsArray && Array.isArray(note.tagsArray) && note.tagsArray.includes(filterTag)
            );
            console.log('После фильтрации:', filteredNotes.length);
            notesArray = filteredNotes;
        }
        
        // Сортируем по дате обновления (новые сначала)
        notesArray.sort((a, b) => {
            const dateA = a.updatedAt || a.createdAt;
            const dateB = b.updatedAt || b.createdAt;
            
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            
            const timeA = dateA instanceof Date ? dateA.getTime() : 
                         dateA.toDate ? dateA.toDate().getTime() : 
                         new Date(dateA).getTime();
            
            const timeB = dateB instanceof Date ? dateB.getTime() : 
                         dateB.toDate ? dateB.toDate().getTime() : 
                         new Date(dateB).getTime();
            
            return timeB - timeA;
        });
        
        // Рендерим
        if (window.renderNotes) {
            renderNotes(notesArray);
        } else {
            console.error('Функция renderNotes не найдена');
            showEmptyNotesState();
        }
        
    } catch (error) {
        console.error('Ошибка в applyCurrentFilter:', error);
        showEmptyNotesState();
    }
}

window.setupColorPicker = setupColorPicker;
window.closeAllModals = closeAllModals;
window.closeModalOnOutsideClick = closeModalOnOutsideClick;
window.objectToArray = objectToArray;
window.showEmptyNotesState = showEmptyNotesState;
window.performManualSync = performManualSync;
window.updateNetworkStatus = updateNetworkStatus;