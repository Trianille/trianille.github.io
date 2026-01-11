// Модуль работы с заметками
function initNotesModule() {
    console.log('Модуль заметок инициализирован');
    setupRatingSelector();
}

// Настройка селектора оценки
function setupRatingSelector() {
    const container = document.getElementById('ratingSelector');
    if (!container) return;
    
    container.innerHTML = '';
    
    for (let i = 0; i <= 5; i++) {
        const option = document.createElement('div');
        option.className = 'rating-option';
        option.dataset.value = i;
        option.onclick = () => selectRating(i);
        container.appendChild(option);
    }
}

// Выбор оценки
function selectRating(value) {
    const state = window.appState;
    state.setSelectedRating(value);
    
    document.querySelectorAll('.rating-option').forEach(option => {
        if (parseInt(option.dataset.value) === value) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
}

// Открыть модальное окно заметки
async function openNoteModal(note = null) {
    const state = window.appState;
    
    state.setCurrentNoteId(note ? note.id : null);
    state.setSelectedNoteTags(note ? [...(note.tagsArray || [])] : []);
    
    const rating = note && typeof note.rating === 'number' ? note.rating : 0;
    state.setSelectedRating(rating);
    
    document.getElementById('modalTitle').textContent = 
        note ? 'Редактировать заметку' : 'Новая заметка';
    document.getElementById('modalNoteTitle').value = note?.title || '';
    document.getElementById('modalNoteBody').value = note?.body || '';
    document.getElementById('modalNoteSubbody').value = note?.subbody || '';
    document.getElementById('modalNoteNotes').value = note?.notes || '';
    
    document.getElementById('deleteNoteBtn').style.display = 
        note ? 'block' : 'none';
    
    if (window.renderAvailableTags) {
        renderAvailableTags();
    }
    
    updateRatingSelector(rating);
    
    document.getElementById('noteModal').style.display = 'flex';
}

// Обновить селектор оценки
function updateRatingSelector(rating) {
    document.querySelectorAll('.rating-option').forEach(option => {
        const value = parseInt(option.dataset.value);
        if (value === rating) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
}

// Закрыть модальное окно заметки
function closeNoteModal() {
    document.getElementById('noteModal').style.display = 'none';
    resetNoteForm();
}

// Сброс формы заметки
function resetNoteForm() {
    const state = window.appState;
    
    state.setCurrentNoteId(null);
    state.setSelectedNoteTags([]);
    state.setSelectedRating(0);
    
    document.getElementById('modalNoteTitle').value = '';
    document.getElementById('modalNoteBody').value = '';
    document.getElementById('modalNoteSubbody').value = '';
    document.getElementById('modalNoteNotes').value = '';
    document.getElementById('deleteNoteBtn').style.display = 'none';
    
    updateRatingSelector(0);
}

// Рендеринг доступных тегов
function renderAvailableTags() {
    const state = window.appState;
    const container = document.getElementById('availableTags');
    const allTags = state.getAllTags();
    const selectedTags = state.getSelectedNoteTags();
    
    if (!container) return;
    
    const tagsArray = objectToArray(allTags);
    if (tagsArray.length === 0) {
        container.innerHTML = '<div style="color: #999; padding: 20px; text-align: center;">Нет созданных тегов</div>';
        return;
    }
    
    container.innerHTML = tagsArray.map(tag => {
        const isSelected = selectedTags.includes(tag.name);
        return `
            <div class="tag-selector-item ${isSelected ? 'selected' : ''}" 
                 style="background: ${tag.color}"
                 onclick="toggleTagSelection('${tag.name}')"
                 title="${tag.name}">
                ${tag.name}
            </div>
        `;
    }).join('');
}

// Переключение выбора тега
function toggleTagSelection(tagName) {
    const state = window.appState;
    let selectedTags = state.getSelectedNoteTags();
    
    if (selectedTags.includes(tagName)) {
        selectedTags = selectedTags.filter(tag => tag !== tagName);
    } else {
        selectedTags.push(tagName);
    }
    
    state.setSelectedNoteTags(selectedTags);
    renderAvailableTags();
}

// Сохранить заметку
async function saveNote() {
    const state = window.appState;
    const currentUser = state.getCurrentUser();
    
    if (!currentUser) return;
    
    const title = document.getElementById('modalNoteTitle').value.trim();
    const body = document.getElementById('modalNoteBody').value.trim();
    const subbody = document.getElementById('modalNoteSubbody').value.trim();
    const notes = document.getElementById('modalNoteNotes').value.trim();
    const rating = state.getSelectedRating() || 0;
    
    if (!title) {
        showAlert('Введите заголовок заметки');
        return;
    }
    
    const noteData = {
        title,
        body,
        subbody,
        notes,
        rating: rating,
        tagsArray: state.getSelectedNoteTags()
    };
    
    try {
        showLoading();
        
        const currentNoteId = state.getCurrentNoteId();
        const isUpdate = !!currentNoteId;
        
        if (isUpdate) {
            noteData.id = currentNoteId;
        }
        
        // 1. Сначала сохраняем локально (для быстрого отображения)
        const savedNoteId = await saveNoteLocally(noteData, isUpdate);
        
        // 2. Отправляем в Firebase
        try {
            const firebaseNoteId = await state.saveNoteToFirebase(noteData, isUpdate);
            console.log('Заметка сохранена в Firebase:', firebaseNoteId);
        } catch (firebaseError) {
            console.error('Ошибка сохранения в Firebase, но данные сохранены локально:', firebaseError);
            // Продолжаем работу с локальными данными
        }
        
        hideLoading();
        closeNoteModal();
        showAlert(isUpdate ? 'Заметка обновлена' : 'Заметка создана');
        
        // 3. Немедленно обновляем отображение
        if (window.applyCurrentFilter) {
            applyCurrentFilter();
        }
        
    } catch (error) {
        hideLoading();
        console.error('Ошибка сохранения:', error);
        showAlert('Ошибка сохранения: ' + error.message);
    }
}

// Сохранить заметку локально
async function saveNoteLocally(noteData, isUpdate = false) {
    const state = window.appState;
    const currentUser = state.getCurrentUser();
    
    if (!currentUser) return null;
    
    let noteId = noteData.id;
    
    if (isUpdate && noteId) {
        // Обновление существующей заметки
        const updatedNote = {
            ...noteData,
            updatedAt: new Date(),
            // Сохраняем существующие поля если есть
            ...(noteData.createdAt ? { createdAt: noteData.createdAt } : {}),
            ...(noteData.isLocal ? { isLocal: noteData.isLocal } : {})
        };
        
        // Загружаем текущие заметки
        const notes = localStorageManager.getAllNotes(currentUser.uid);
        const existingNote = notes[noteId];
        
        if (existingNote) {
            // Сохраняем с объединением данных
            notes[noteId] = {
                ...existingNote,
                ...updatedNote
            };
        } else {
            // Создаем новую запись
            notes[noteId] = {
                ...updatedNote,
                createdAt: updatedNote.createdAt || new Date(),
                isLocal: true
            };
        }
        
        localStorageManager.saveLocalData(currentUser.uid, 'notes', notes);
        
    } else {
        // Создание новой заметки
        noteId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newNote = {
            ...noteData,
            id: noteId,
            createdAt: new Date(),
            updatedAt: new Date(),
            isLocal: true
        };
        
        // Загружаем текущие заметки
        const notes = localStorageManager.getAllNotes(currentUser.uid);
        notes[noteId] = newNote;
        localStorageManager.saveLocalData(currentUser.uid, 'notes', notes);
    }
    
    console.log('Заметка сохранена локально:', noteId);
    return noteId;
}

// Показать подтверждение удаления заметки
function showDeleteNoteConfirm() {
    showConfirm('Удалить эту заметку?', deleteCurrentNote);
}

// Удалить заметку
async function deleteCurrentNote() {
    const state = window.appState;
    const currentNoteId = state.getCurrentNoteId();
    const currentUser = state.getCurrentUser();
    
    if (!currentNoteId || !currentUser) return;
    
    try {
        showLoading();
        
        // 1. Удаляем локально
        await deleteNoteLocally(currentNoteId);
        
        // 2. Удаляем из Firebase
        try {
            await state.deleteNoteFromFirebase(currentNoteId);
            console.log('Заметка удалена из Firebase:', currentNoteId);
        } catch (firebaseError) {
            console.error('Ошибка удаления из Firebase:', firebaseError);
            // Продолжаем работу с локальными данными
        }
        
        hideLoading();
        closeNoteModal();
        showAlert('Заметка удалена');
        
        // 3. Немедленно обновляем отображение
        if (window.applyCurrentFilter) {
            applyCurrentFilter();
        }
        
    } catch (error) {
        hideLoading();
        console.error('Ошибка удаления:', error);
        showAlert('Ошибка удаления: ' + error.message);
    }
}

// Удалить заметку локально
async function deleteNoteLocally(noteId) {
    const state = window.appState;
    const currentUser = state.getCurrentUser();
    
    if (!currentUser) return;
    
    localStorageManager.deleteNote(currentUser.uid, noteId);
    
    if (window.applyCurrentFilter) {
        applyCurrentFilter();
    }
}

// Экспорт функций
window.openNoteModal = openNoteModal;
window.closeNoteModal = closeNoteModal;
window.saveNote = saveNote;
window.showDeleteNoteConfirm = showDeleteNoteConfirm;
window.deleteCurrentNote = deleteCurrentNote;
window.toggleTagSelection = toggleTagSelection;
window.selectRating = selectRating;
window.setupRatingSelector = setupRatingSelector;
window.updateRatingSelector = updateRatingSelector;
window.saveNoteLocally = saveNoteLocally;
window.deleteNoteLocally = deleteNoteLocally;
window.renderAvailableTags = renderAvailableTags;