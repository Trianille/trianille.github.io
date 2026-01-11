// Начать сессию обучения
async function startLearningSession() {
    const state = window.appState;
    const currentUser = state.getCurrentUser();
    
    if (!currentUser) {
        showAlert('Сначала войдите в систему');
        return;
    }
    
    try {
        showLoading();
        
        // Получаем настройки пользователя
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const cardsPerSession = parseInt(userData.cardsPerSession) || 20;
        
        // Получаем все заметки
        const notes = localStorageManager.getAllNotes(currentUser.uid);
        const notesArray = objectToArray(notes);
        
        if (notesArray.length === 0) {
            hideLoading();
            showAlert('Нет заметок для обучения');
            return;
        }
        
        // Сортируем заметки по оценке (сначала с низкой оценкой)
        const sortedNotes = sortNotesByRating(notesArray);
        
        // Берем нужное количество заметок
        sessionNotes = sortedNotes.slice(0, Math.min(cardsPerSession, sortedNotes.length));
        
        if (sessionNotes.length === 0) {
            hideLoading();
            showAlert('Нет заметок для обучения');
            return;
        }
        
        // Инициализируем сессию
        learningSession = {
            userId: currentUser.uid,
            startedAt: new Date(),
            totalCards: sessionNotes.length,
            completedCards: 0,
            cardsPerSession: cardsPerSession
        };
        
        currentSessionIndex = 0;
        sessionRating = 0;
        
        hideLoading();
        
        // Показываем модальное окно
        openSessionModal();
        
        // Показываем первую заметку
        showSessionNote();
        
    } catch (error) {
        hideLoading();
        console.error('Ошибка начала сессии:', error);
        showAlert('Ошибка начала сессии: ' + error.message);
    }
}

// Сортировка заметок по оценке
function sortNotesByRating(notesArray) {
    // Группируем по оценке
    const notesByRating = {};
    
    notesArray.forEach(note => {
        const rating = note.rating || 0;
        if (!notesByRating[rating]) {
            notesByRating[rating] = [];
        }
        notesByRating[rating].push(note);
    });
    
    // Перемешиваем заметки внутри каждой группы
    for (const rating in notesByRating) {
        notesByRating[rating] = shuffleArray(notesByRating[rating]);
    }
    
    // Собираем в один массив в порядке возрастания оценки
    const sortedNotes = [];
    for (let rating = 0; rating <= 5; rating++) {
        if (notesByRating[rating]) {
            sortedNotes.push(...notesByRating[rating]);
        }
    }
    
    return sortedNotes;
}

// Перемешивание массива (Fisher-Yates shuffle)
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Открыть модальное окно сессии
function openSessionModal() {
    document.getElementById('sessionModal').style.display = 'flex';
}

// Закрыть модальное окно сессии
function closeSessionModal() {
    document.getElementById('sessionModal').style.display = 'none';
    resetSession();
}

// Сброс сессии
function resetSession() {
    learningSession = null;
    sessionNotes = [];
    currentSessionIndex = 0;
    sessionRating = 0;
}

// Показать текущую заметку в сессии
function showSessionNote() {
    if (currentSessionIndex >= sessionNotes.length) {
        // Сессия завершена
        completeSession();
        return;
    }
    
    const note = sessionNotes[currentSessionIndex];
    const progress = currentSessionIndex + 1;
    const total = sessionNotes.length;
    
    // Обновляем прогресс
    document.getElementById('sessionProgress').textContent = `${progress} / ${total}`;
    
    // Отображаем заметку
    const noteContent = document.getElementById('sessionNoteContent');
    
    noteContent.innerHTML = `
        ${note.title ? `
            <div class="note-section">
                <div class="note-section-title">Заголовок</div>
                <div class="note-section-content">${escapeHtml(note.title)}</div>
            </div>
        ` : ''}
        
        ${note.body ? `
            <div class="note-section">
                <div class="note-section-title">Текст</div>
                <div class="note-section-content">${escapeHtml(note.body)}</div>
            </div>
        ` : ''}
        
        ${note.subbody ? `
            <div class="note-section">
                <div class="note-section-title">Дополнительный текст</div>
                <div class="note-section-content">${escapeHtml(note.subbody)}</div>
            </div>
        ` : ''}
        
        ${note.notes ? `
            <div class="note-section">
                <div class="note-section-title">Заметки</div>
                <div class="note-section-content" style="white-space: pre-wrap;">${escapeHtml(note.notes)}</div>
            </div>
        ` : ''}
    `;
    
    // Устанавливаем текущую оценку
    sessionRating = note.rating || 0;
    setupSessionRatingSelector(sessionRating);
}

// Настройка селектора оценки для сессии
function setupSessionRatingSelector(currentRating) {
    const container = document.getElementById('sessionRatingSelector');
    if (!container) return;
    
    container.innerHTML = '';
    
    for (let i = 0; i <= 5; i++) {
        const option = document.createElement('div');
        option.className = 'rating-option';
        option.dataset.value = i;
        
        if (i === currentRating) {
            option.classList.add('selected');
        }
        
        option.onclick = () => selectSessionRating(i);
        container.appendChild(option);
    }
}

// Выбор оценки в сессии
function selectSessionRating(value) {
    sessionRating = value;
    
    document.querySelectorAll('#sessionRatingSelector .rating-option').forEach(option => {
        if (parseInt(option.dataset.value) === value) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
}

// Оценить текущую заметку и перейти к следующей
async function nextNoteWithRating() {
    if (currentSessionIndex >= sessionNotes.length) return;
    
    const note = sessionNotes[currentSessionIndex];
    
    try {
        showLoading();
        
        // Обновляем оценку в заметке
        note.rating = sessionRating;
        note.updatedAt = new Date();
        
        // Сохраняем локально
        localStorageManager.saveNote(currentUser.uid, note);
        
        // Обновляем статистику тегов
        await updateTagUsageAfterNoteChange(note);
        
        // Отправляем в Firebase
        try {
            await window.appState.saveNoteToFirebase(note, true);
            console.log('Оценка сохранена в Firebase');
        } catch (firebaseError) {
            console.error('Ошибка сохранения оценки в Firebase:', firebaseError);
        }
        
        // Обновляем счетчики
        if (window.updateUserCounters) {
            await updateUserCounters();
        }
        
        // ОБНОВЛЯЕМ ОТОБРАЖЕНИЕ:
        // 1. Быстрое обновление одной заметки
        updateNoteInUI(note);
        
        // 2. Полное обновление если быстрое не сработало
        setTimeout(() => {
            if (window.applyCurrentFilter) {
                applyCurrentFilter();
            }
        }, 100);
        
        // 3. Обновляем UI тегов если окно тегов открыто
        if (document.getElementById('tagsModal') && 
            document.getElementById('tagsModal').style.display === 'flex') {
            if (window.updateAllTagUIs) {
                window.updateAllTagUIs();
            }
        }
        
        // Переходим к следующей заметке
        currentSessionIndex++;
        
        hideLoading();
        
        if (currentSessionIndex < sessionNotes.length) {
            showSessionNote();
        } else {
            completeSession();
        }
        
    } catch (error) {
        hideLoading();
        console.error('Ошибка сохранения оценки:', error);
        showAlert('Ошибка сохранения оценки: ' + error.message);
    }
}

// Обновить статистику использования тегов после изменения заметки
async function updateTagUsageAfterNoteChange(note) {
    const state = window.appState;
    const currentUser = state.getCurrentUser();
    
    if (!currentUser || !note || !note.tagsArray) return;
    
    try {
        // Загружаем все заметки
        const allNotes = localStorageManager.getAllNotes(currentUser.uid);
        const notesArray = objectToArray(allNotes);
        
        // Загружаем все теги
        const allTags = localStorageManager.getAllTags(currentUser.uid);
        const tagsArray = objectToArray(allTags);
        
        // Считаем использование каждого тега
        const tagUsage = {};
        notesArray.forEach(n => {
            if (n.tagsArray && Array.isArray(n.tagsArray)) {
                n.tagsArray.forEach(tagName => {
                    tagUsage[tagName] = (tagUsage[tagName] || 0) + 1;
                });
            }
        });
        
        // Обновляем счетчики в тегах
        const updatedTags = {};
        tagsArray.forEach(tag => {
            updatedTags[tag.id] = {
                ...tag,
                usageCount: tagUsage[tag.name] || 0
            };
        });
        
        // Сохраняем обновленные теги
        localStorageManager.saveLocalData(currentUser.uid, 'tags', updatedTags);
        
        // Обновляем глобальное состояние
        state.setAllTags(updatedTags);
        
        console.log('Статистика тегов обновлена');
        
    } catch (error) {
        console.error('Ошибка обновления статистики тегов:', error);
    }
}

// Пропустить текущую заметку
function skipCurrentNote() {
    currentSessionIndex++;
    
    if (currentSessionIndex < sessionNotes.length) {
        showSessionNote();
    } else {
        completeSession();
    }
}

// Завершить сессию
function completeSession() {
    if (learningSession) {
        learningSession.completedCards = currentSessionIndex;
        learningSession.endedAt = new Date();
        learningSession.duration = learningSession.endedAt - learningSession.startedAt;
        
        console.log('Сессия завершена:', learningSession);
    }
    
    showAlert(`Сессия завершена! Вы оценили ${currentSessionIndex} заметок.`);
    closeSessionModal();
}

// Добавляем функции в глобальную область
window.updateNoteInUI = updateNoteInUI;
window.updateTagUsageAfterNoteChange = updateTagUsageAfterNoteChange;
window.startLearningSession = startLearningSession;
window.closeSessionModal = closeSessionModal;
window.nextNoteWithRating = nextNoteWithRating;
window.skipCurrentNote = skipCurrentNote;
window.selectSessionRating = selectSessionRating;