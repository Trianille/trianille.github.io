// Вспомогательные функции

// Форматирование даты (обрабатывает все типы)
function formatDate(timestamp) {
    if (!timestamp) return '';
    
    let date;
    
    try {
        // Если это Firebase Timestamp объект
        if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            date = timestamp.toDate();
        }
        // Если это объект с seconds и nanoseconds
        else if (timestamp.seconds !== undefined) {
            date = new Date(timestamp.seconds * 1000);
            if (timestamp.nanoseconds) {
                date.setMilliseconds(date.getMilliseconds() + timestamp.nanoseconds / 1000000);
            }
        }
        // Если это строка даты
        else if (typeof timestamp === 'string') {
            date = new Date(timestamp);
        }
        // Если это Date объект
        else if (timestamp instanceof Date) {
            date = timestamp;
        }
        // Если это число (timestamp в миллисекундах)
        else if (typeof timestamp === 'number') {
            date = new Date(timestamp);
        }
        else {
            console.warn('Неизвестный формат даты:', timestamp);
            return '';
        }
        
        // Проверяем валидность даты
        if (isNaN(date.getTime())) {
            console.warn('Невалидная дата:', timestamp);
            return '';
        }
        
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return `Сегодня в ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        } else if (diffDays === 1) {
            return `Вчера в ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        } else if (diffDays < 7) {
            return `${diffDays} дн. назад`;
        } else {
            return date.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        }
        
    } catch (error) {
        console.error('Ошибка форматирования даты:', error, timestamp);
        return '';
    }
}

// Функция для получения цвета тега по умолчанию
function getDefaultTagColor(tagName) {
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
        hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
        '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0',
        '#118AB2', '#073B4C', '#7209B7', '#F72585',
        '#FF9F1C', '#2A9D8F', '#E76F51', '#264653'
    ];
    
    return colors[Math.abs(hash) % colors.length];
}

// Конвертировать объект в массив
function objectToArray(obj) {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj;
    
    return Object.values(obj).filter(item => item && typeof item === 'object');
}

// Получить теги заметки (используем глобальный allTags)
function getNoteTags(note) {
    if (!note.tagsArray || !Array.isArray(note.tagsArray)) {
        return [];
    }
    
    const state = window.appState;
    const allTags = state.getAllTags();
    
    return note.tagsArray.map(tagName => {
        // Ищем тег по имени в объекте тегов
        let tag = null;
        for (const tagId in allTags) {
            if (allTags[tagId] && allTags[tagId].name === tagName) {
                tag = allTags[tagId];
                break;
            }
        }
        
        return {
            name: tagName,
            color: tag && tag.color ? tag.color : getDefaultTagColor(tagName)
        };
    }).filter(tag => tag.name);
}

// Получить оценку заметки
function getNoteRating(note) {
    if (typeof note.rating === 'number') {
        return Math.max(0, Math.min(5, note.rating));
    }
    return 0;
}

// Экранировать HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Обрезать текст
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return escapeHtml(text);
    return escapeHtml(text.substring(0, maxLength)) + '...';
}

// Рендеринг заметок (работает с массивом)
function renderNotes(notesArray) {
    const container = document.getElementById('notesContainer');
    if (!container) {
        console.error('Контейнер заметок не найден');
        return;
    }
    
    try {
        // notesArray - это уже массив (преобразован через objectToArray)
        
        // Если нет заметок, показываем соответствующее сообщение
        if (!notesArray || notesArray.length === 0) {
            const state = window.appState;
            const filterTag = state ? state.getCurrentFilterTag() : null;
            
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; color: #999; padding: 48px;">
                    ${filterTag ? 
                        'Нет заметок с этим тегом' : 
                        'Нет заметок. Создайте первую!'}
                </div>
            `;
            return;
        }
        
        // Рендерим заметки
        const notesHtml = notesArray.map((note, index) => {
            try {
                // Проверяем каждую заметку
                if (!note || typeof note !== 'object') {
                    console.warn(`renderNotes: пропускаем некорректную заметку ${index}:`, note);
                    return '';
                }
                
                // Получаем теги заметки
                const noteTags = getNoteTags(note);
                
                // Получаем оценку
                const rating = getNoteRating(note);
                const ratingClass = `rating-${rating}`;
                
                // Форматируем дату
                const formattedDate = formatDate(note.updatedAt || note.createdAt);
                
                // Экранируем текст
                const title = escapeHtml(note.title || 'Без названия');
                const body = note.body ? truncateText(note.body, 100) : '';
                const subbody = note.subbody ? truncateText(note.subbody, 100) : '';
                const notesText = note.notes ? truncateText(note.notes, 100) : '';
                
                // Генерируем HTML для тегов
                const tagsHtml = noteTags.length > 0 ? `
                    <div class="note-tags">
                        ${noteTags.map(tag => `
                            <button class="tag" 
                                    onclick="event.stopPropagation(); filterByTag('${escapeHtml(tag.name)}')"
                                    style="background: ${tag.color}">
                                ${escapeHtml(tag.name)}
                            </button>
                        `).join('')}
                    </div>
                ` : '';
                
                // Генерируем HTML для заметки
                return `
                    <div class="note-card" onclick="openNoteModal(${JSON.stringify(note).replace(/"/g, '&quot;')}) data-note-id="${note.id}">
                        <div class="note-rating-indicator ${ratingClass}"></div>
                        <div class="note-header">
                            <div class="note-title">${title}</div>
                        </div>
                        ${body ? `<div class="note-text">${body}</div>` : ''}
                        ${subbody ? `<div class="note-text">${subbody}</div>` : ''}
                        ${notesText ? `<div class="note-text">${notesText}</div>` : ''}
                        ${tagsHtml}
                        <div class="note-date">${formattedDate}</div>
                    </div>
                `;
                
            } catch (error) {
                console.error(`renderNotes: ошибка рендеринга заметки ${index}:`, error);
                return '';
            }
        }).join('');
        
        container.innerHTML = notesHtml;
        
    } catch (error) {
        console.error('Критическая ошибка в renderNotes:', error);
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: #f44336; padding: 48px;">
                <i class="fas fa-exclamation-triangle"></i><br>
                Критическая ошибка отображения заметок<br>
                <small>${error.message}</small>
            </div>
        `;
    }
}

// Применить текущий фильтр (упрощенная версия)
function applyCurrentFilter() {
    const state = window.appState;
    const currentUser = state.getCurrentUser();
    
    if (!currentUser) {
        showEmptyNotesState();
        return;
    }
    
    try {
        // Загружаем локальные заметки как объект
        const notesObj = localStorageManager.loadLocalData(currentUser.uid, 'notes') || {};
        
        // Конвертируем в массив
        let notesArray = objectToArray(notesObj);
        
        // Применяем фильтр
        const filterTag = state.getCurrentFilterTag();
        if (filterTag && filterTag.trim() !== '') {
            notesArray = notesArray.filter(note => 
                note && note.tagsArray && Array.isArray(note.tagsArray) && note.tagsArray.includes(filterTag)
            );
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
            
            return timeB - timeA; // По убыванию (новые сначала)
        });
        
        // Рендерим
        renderNotes(notesArray);
        
    } catch (error) {
        console.error('Ошибка в applyCurrentFilter:', error);
        showEmptyNotesState();
    }
}

// Показать пустое состояние заметок
function showEmptyNotesState() {
    const container = document.getElementById('notesContainer');
    if (container) {
        const state = window.appState;
        const filterTag = state ? state.getCurrentFilterTag() : null;
        
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: #999; padding: 48px;">
                ${filterTag ? 
                    'Нет заметок с этим тегом' : 
                    'Нет заметок. Создайте первую!'}
            </div>
        `;
    }
}

// Экспорт функций
window.formatDate = formatDate;
window.getDefaultTagColor = getDefaultTagColor;
window.objectToArray = objectToArray;
window.renderNotes = renderNotes;
window.applyCurrentFilter = applyCurrentFilter;
window.escapeHtml = escapeHtml;