// Модуль работы с тегами
function initTagsModule() {
    console.log('Модуль тегов инициализирован');
}

// Открыть модальное окно тегов
function openTagsModal() {
    renderTagsGrid();
    document.getElementById('tagsModal').style.display = 'flex';
}

// Закрыть модальное окно тегов
function closeTagsModal() {
    document.getElementById('tagsModal').style.display = 'none';
}

// Открыть модальное окно добавления тега
function openAddTagModal() {
    window.wasTagsModalOpen = document.getElementById('tagsModal').style.display === 'flex';
    
    document.getElementById('tagsModal').style.display = 'none';
    document.getElementById('addTagModal').style.display = 'flex';
}

// Закрыть модальное окно добавления тега
function closeAddTagModal() {
    document.getElementById('addTagModal').style.display = 'none';
    document.getElementById('newTagName').value = '';
    
    if (window.wasTagsModalOpen) {
        document.getElementById('tagsModal').style.display = 'flex';
        renderTagsGrid();
    }
    
    window.wasTagsModalOpen = false;
}

// Добавить новый тег
async function addNewTag() {
    const state = window.appState;
    const selectedColor = state.getSelectedColor();
    
    const name = document.getElementById('newTagName').value.trim();
    
    if (!name) {
        showAlert('Введите название тега');
        return;
    }
    
    if (name.length > 20) {
        showAlert('Название тега не должно превышать 20 символов');
        return;
    }
    
    try {
        const tagData = {
            name: name,
            color: selectedColor
        };
        
        showLoading();
        
        // 1. Сохраняем локально
        const tagId = await addTagLocally(tagData);
        
        // 2. Отправляем в Firebase
        try {
            const firebaseTagId = await state.saveTagToFirebase(tagData, false);
            console.log('Тег сохранен в Firebase:', firebaseTagId);
        } catch (firebaseError) {
            console.error('Ошибка сохранения в Firebase, но тег сохранен локально:', firebaseError);
            // Продолжаем работу с локальными данными
        }
        
        if (window.wasTagsModalOpen) {
            addTagToGridUI(tagData, tagId);
        }
        
        if (document.getElementById('noteModal') && 
            document.getElementById('noteModal').style.display === 'flex') {
            if (window.renderAvailableTags) {
                renderAvailableTags();
            }
        }
        
        if (window.updateUserCounters) {
            await updateUserCounters();
        }
        
        hideLoading();
        closeAddTagModal();
        showAlert('Тег создан');
        
    } catch (error) {
        hideLoading();
        console.error('Ошибка создания тега:', error);
        showAlert('Ошибка создания тега: ' + error.message);
    }
}

// Добавить тег в UI сетки
function addTagToGridUI(tagData, tagId) {
    const container = document.getElementById('tagsList');
    if (!container) return;
    
    const tagElement = document.createElement('div');
    tagElement.className = 'tag-chip';
    tagElement.style.background = tagData.color;
    tagElement.id = `tag-${tagId}`;
    
    const tagName = document.createElement('div');
    tagName.className = 'tag-chip-name';
    tagName.textContent = tagData.name;
    
    const tagUsage = document.createElement('div');
    tagUsage.className = 'tag-chip-usage';
    tagUsage.textContent = 'Используется в 0 заметках';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'tag-chip-delete';
    deleteBtn.title = 'Удалить тег';
    deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
    
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        showDeleteTagConfirm(tagId, tagData.name);
    });
    
    tagElement.addEventListener('click', (e) => {
        if (e.target !== deleteBtn && !deleteBtn.contains(e.target)) {
            filterByTagFromModal(tagData.name);
        }
    });
    
    tagElement.appendChild(tagName);
    tagElement.appendChild(tagUsage);
    tagElement.appendChild(deleteBtn);
    
    if (container.firstChild) {
        container.insertBefore(tagElement, container.firstChild);
    } else {
        container.appendChild(tagElement);
    }
    
    const noTagsMessage = container.querySelector('div[style*="grid-column: 1 / -1"]');
    if (noTagsMessage) {
        noTagsMessage.remove();
    }
}

// Рендеринг сетки тегов
function renderTagsGrid() {
    const state = window.appState;
    const container = document.getElementById('tagsList');
    const allTags = state.getAllTags();
    
    if (!container) return;
    
    const tagsArray = objectToArray(allTags);
    if (tagsArray.length === 0) {
        container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #999; padding: 48px;">Нет созданных тегов</div>';
        return;
    }
    
    container.innerHTML = '';
    
    const sortedTags = tagsArray.sort((a, b) => a.name.localeCompare(b.name));
    
    sortedTags.forEach(tag => {
        const tagElement = document.createElement('div');
        tagElement.className = 'tag-chip';
        tagElement.style.background = tag.color;
        
        const tagName = document.createElement('div');
        tagName.className = 'tag-chip-name';
        tagName.textContent = tag.name;
        
        const tagUsage = document.createElement('div');
        tagUsage.className = 'tag-chip-usage';
        tagUsage.textContent = `Используется в ${tag.usageCount || 0} заметках`;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'tag-chip-delete';
        deleteBtn.title = 'Удалить тег';
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            showDeleteTagConfirm(tag.id, tag.name);
        });
        
        tagElement.addEventListener('click', (e) => {
            if (e.target !== deleteBtn && !deleteBtn.contains(e.target)) {
                filterByTagFromModal(tag.name);
            }
        });
        
        tagElement.appendChild(tagName);
        tagElement.appendChild(tagUsage);
        tagElement.appendChild(deleteBtn);
        container.appendChild(tagElement);
    });
}

// Показать подтверждение удаления тега
function showDeleteTagConfirm(tagId, tagName) {
    showConfirm('Удалить этот тег?', () => deleteTag(tagId, tagName));
}

// Удалить тег
async function deleteTag(tagId, tagName) {
    const state = window.appState;
    const currentUser = state.getCurrentUser();
    
    if (!tagId || !currentUser) return;
    
    try {
        showLoading();
        
        // 1. Удаляем локально
        await deleteTagLocally(tagId);
        
        // 2. Удаляем из Firebase
        try {
            await state.deleteTagFromFirebase(tagId);
            console.log('Тег удален из Firebase:', tagId);
        } catch (firebaseError) {
            console.error('Ошибка удаления из Firebase:', firebaseError);
            // Продолжаем работу с локальными данными
        }
        
        if (document.getElementById('tagsModal') && 
            document.getElementById('tagsModal').style.display === 'flex') {
            removeTagFromGridUI(tagId);
        }
        
        hideLoading();
        showAlert(`Тег "${tagName}" удален`);
        
    } catch (error) {
        hideLoading();
        console.error('Ошибка удаления тега:', error);
        showAlert('Ошибка удаления тега: ' + error.message);
    }
}

// Удалить тег из UI сетки
function removeTagFromGridUI(tagId) {
    const tagElement = document.querySelector(`#tag-${tagId}`);
    if (tagElement) tagElement.remove();
    
    const container = document.getElementById('tagsList');
    if (container && container.children.length === 0) {
        container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #999; padding: 48px;">Нет созданных тегов</div>';
    }
}

// Удалить тег локально
async function deleteTagLocally(tagId) {
    const state = window.appState;
    const currentUser = state.getCurrentUser();
    
    if (!currentUser) return;
    
    localStorageManager.deleteTag(currentUser.uid, tagId);
    
    const updatedTags = localStorageManager.getAllTags(currentUser.uid);
    state.setAllTags(updatedTags);
    
    updateAllTagUIs();
}

// Добавить тег локально
async function addTagLocally(tagData) {
    const state = window.appState;
    const currentUser = state.getCurrentUser();
    
    if (!currentUser) return null;
    
    const tags = localStorageManager.getAllTags(currentUser.uid);
    const tagsArray = objectToArray(tags);
    
    const existingTag = tagsArray.find(tag => tag.name.toLowerCase() === tagData.name.toLowerCase());
    if (existingTag) {
        throw new Error('Тег с таким названием уже существует');
    }
    
    const tagId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTag = {
        ...tagData,
        id: tagId,
        createdAt: new Date(),
        isLocal: true,
        usageCount: 0
    };
    
    localStorageManager.saveTag(currentUser.uid, newTag);
    
    const updatedTags = localStorageManager.getAllTags(currentUser.uid);
    state.setAllTags(updatedTags);
    
    return tagId;
}

// Обновить все UI связанные с тегами
function updateAllTagUIs() {
    if (document.getElementById('tagsModal') && 
        document.getElementById('tagsModal').style.display === 'flex') {
        renderTagsGrid();
    }
    
    if (document.getElementById('noteModal') && 
        document.getElementById('noteModal').style.display === 'flex') {
        if (window.renderAvailableTags) {
            renderAvailableTags();
        }
    }
}

// Фильтрация по тегу из модального окна
function filterByTagFromModal(tagName) {
    filterByTag(tagName);
    closeTagsModal();
}

// Фильтр по тегу
function filterByTag(tagName) {
    const state = window.appState;
    const allTags = state.getAllTags();
    const tagsArray = objectToArray(allTags);
    
    state.setCurrentFilterTag(tagName);
    
    const tag = tagsArray.find(t => t.name === tagName);
    const tagColor = tag ? tag.color : '#666';
    
    const activeFilter = document.getElementById('activeFilter');
    const filterTag = document.getElementById('filterTag');
    
    if (activeFilter && filterTag) {
        activeFilter.style.display = 'flex';
        filterTag.textContent = tagName;
        filterTag.style.background = tagColor;
    }
    
    if (window.applyCurrentFilter) {
        applyCurrentFilter();
    }
}

// Очистить фильтр
function clearFilter() {
    const state = window.appState;
    
    state.setCurrentFilterTag(null);
    
    const activeFilter = document.getElementById('activeFilter');
    if (activeFilter) {
        activeFilter.style.display = 'none';
    }
    
    if (window.applyCurrentFilter) {
        applyCurrentFilter();
    }
}

// Экспорт функций
window.openTagsModal = openTagsModal;
window.closeTagsModal = closeTagsModal;
window.openAddTagModal = openAddTagModal;
window.closeAddTagModal = closeAddTagModal;
window.addNewTag = addNewTag;
window.filterByTag = filterByTag;
window.clearFilter = clearFilter;
window.filterByTagFromModal = filterByTagFromModal;
window.showDeleteTagConfirm = showDeleteTagConfirm;
window.renderTagsGrid = renderTagsGrid;
window.deleteTagLocally = deleteTagLocally;
window.addTagLocally = addTagLocally;
window.addTagToGridUI = addTagToGridUI;
window.removeTagFromGridUI = removeTagFromGridUI;
window.updateAllTagUIs = updateAllTagUIs;