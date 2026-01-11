class LocalStorageManager {
    constructor() {
        this.keyPrefix = 'minimal_notes_';
    }

    // Подготовить данные для хранения
    prepareDataForStorage(data) {
        if (!data) return data;
        
        // Если это массив pending_changes, сохраняем как массив
        if (Array.isArray(data)) {
            return data.map(item => this.convertTimestampsToStrings(item));
        }
        
        // Для заметок и тегов - как объекты
        if (typeof data === 'object') {
            // Если это массив объектов с id, конвертируем в объект объектов
            if (Array.isArray(data)) {
                const obj = {};
                data.forEach(item => {
                    if (item && item.id) {
                        obj[item.id] = this.convertTimestampsToStrings(item);
                    }
                });
                return obj;
            } else {
                // Если уже объект, просто конвертируем таймстампы
                const result = {};
                for (const key in data) {
                    if (data[key] && typeof data[key] === 'object') {
                        result[key] = this.convertTimestampsToStrings(data[key]);
                    }
                }
                return result;
            }
        }
        
        return data;
    }

    // Конвертировать Timestamp в строку
    convertTimestampsToStrings(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        
        const converted = { ...obj };
        
        for (const key in converted) {
            const value = converted[key];
            
            if (value && typeof value === 'object') {
                if (value.toDate && typeof value.toDate === 'function') {
                    converted[key] = value.toDate().toISOString();
                } else if (value instanceof Date) {
                    converted[key] = value.toISOString();
                } else if (typeof value === 'object' && !Array.isArray(value)) {
                    converted[key] = this.convertTimestampsToStrings(value);
                } else if (Array.isArray(value)) {
                    converted[key] = value.map(item => 
                        typeof item === 'object' ? this.convertTimestampsToStrings(item) : item
                    );
                }
            }
        }
        
        return converted;
    }

    // Конвертировать строки обратно в Date объекты
    convertStringsToDates(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        
        const converted = { ...obj };
        
        for (const key in converted) {
            const value = converted[key];
            
            if (typeof value === 'string') {
                if (this.isISODateString(value)) {
                    converted[key] = new Date(value);
                }
            } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                converted[key] = this.convertStringsToDates(value);
            } else if (Array.isArray(value)) {
                converted[key] = value.map(item => 
                    typeof item === 'object' ? this.convertStringsToDates(item) : item
                );
            }
        }
        
        return converted;
    }

    // Проверка ISO строки даты
    isISODateString(str) {
        return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str);
    }

    // Сохранить данные локально
    saveLocalData(userId, dataType, data) {
        try {
            const key = `${this.keyPrefix}${userId}_${dataType}`;
            const preparedData = this.prepareDataForStorage(data);
            localStorage.setItem(key, JSON.stringify(preparedData));
            return true;
        } catch (error) {
            console.error('Ошибка сохранения в localStorage:', error);
            return false;
        }
    }

    // Загрузить данные локально
    loadLocalData(userId, dataType) {
        try {
            const key = `${this.keyPrefix}${userId}_${dataType}`;
            const data = localStorage.getItem(key);
            
            if (!data) {
                // Для pending_changes возвращаем пустой массив
                if (dataType === 'pending_changes') return [];
                // Для заметок и тегов - пустой объект
                return {};
            }
            
            const parsedData = JSON.parse(data);
            return this.convertStringsToDates(parsedData);
        } catch (error) {
            console.error('Ошибка загрузки из localStorage:', error);
            // Возвращаем правильный тип по умолчанию
            if (dataType === 'pending_changes') return [];
            return {};
        }
    }

    // Сохранить оффлайн данные
    saveOfflineData(userId, notes, tags) {
        this.saveLocalData(userId, 'notes', notes);
        this.saveLocalData(userId, 'tags', tags);
        this.saveLocalData(userId, 'last_sync', new Date().toISOString());
    }

    // Получить все заметки как объект
    getAllNotes(userId) {
        return this.loadLocalData(userId, 'notes') || {};
    }

    // Получить все теги как объект
    getAllTags(userId) {
        return this.loadLocalData(userId, 'tags') || {};
    }

    // Добавить/обновить заметку
    saveNote(userId, note) {
        const notes = this.getAllNotes(userId);
        notes[note.id] = note;
        return this.saveLocalData(userId, 'notes', notes);
    }

    // Удалить заметку
    deleteNote(userId, noteId) {
        const notes = this.getAllNotes(userId);
        delete notes[noteId];
        return this.saveLocalData(userId, 'notes', notes);
    }

    // Добавить/обновить тег
    saveTag(userId, tag) {
        const tags = this.getAllTags(userId);
        tags[tag.id] = tag;
        return this.saveLocalData(userId, 'tags', tags);
    }

    // Удалить тег
    deleteTag(userId, tagId) {
        const tags = this.getAllTags(userId);
        delete tags[tagId];
        return this.saveLocalData(userId, 'tags', tags);
    }

    // Получить ожидающие изменения
    getPendingChanges(userId) {
        const changes = this.loadLocalData(userId, 'pending_changes');
        
        // Гарантируем, что возвращаем массив
        if (Array.isArray(changes)) {
            return changes.map(change => ({
                ...change,
                timestamp: change.timestamp && typeof change.timestamp === 'string' ? 
                    new Date(change.timestamp) : change.timestamp,
                data: this.convertStringsToDates(change.data)
            }));
        }
        
        console.warn('pending_changes не является массивом, исправляем:', changes);
        return [];
    }

    // Добавить изменение в очередь
    addPendingChange(userId, change) {
        const changes = this.getPendingChanges(userId);
        
        const preparedChange = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            ...change,
            data: this.prepareDataForStorage(change.data)
        };
        
        changes.push(preparedChange);
        return this.saveLocalData(userId, 'pending_changes', changes);
    }

    // Очистить очередь изменений
    clearPendingChanges(userId) {
        return this.saveLocalData(userId, 'pending_changes', []);
    }

    // Удалить данные пользователя
    clearUserData(userId) {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(`${this.keyPrefix}${userId}_`)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    }
}

// Создаем глобальный экземпляр
const localStorageManager = new LocalStorageManager();
window.localStorageManager = localStorageManager;