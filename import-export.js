// Модуль импорта/экспорта заметок
function initImportExportModule() {
    console.log('Модуль импорта/экспорта инициализирован');
    
    // Настройка обработчиков для импорта
    setupImportHandlers();
}

// Настройка обработчиков импорта
function setupImportHandlers() {
    const importFileInput = document.getElementById('importFile');
    if (importFileInput) {
        importFileInput.addEventListener('change', handleFileSelect);
    }
}

// Обработка выбора файла
function handleFileSelect(event) {
    const file = event.target.files[0];
    const importBtn = document.getElementById('importBtn');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const importPreview = document.getElementById('importPreview');
    const previewContent = document.getElementById('previewContent');
    const totalNotes = document.getElementById('totalNotes');
    
    if (!file) {
        importBtn.disabled = true;
        fileInfo.style.display = 'none';
        importPreview.style.display = 'none';
        return;
    }
    
    // Проверяем расширение файла
    if (!file.name.toLowerCase().endsWith('.json')) {
        showAlert('Пожалуйста, выберите JSON файл');
        importBtn.disabled = true;
        return;
    }
    
    // Показываем информацию о файле
    fileName.textContent = `Файл: ${file.name}`;
    fileSize.textContent = `Размер: ${(file.size / 1024).toFixed(2)} КБ`;
    fileInfo.style.display = 'block';
    
    // Читаем и парсим файл
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const fileContent = e.target.result;
            const notesData = JSON.parse(fileContent);
            
            // Проверяем структуру данных
            if (!Array.isArray(notesData)) {
                throw new Error('Файл должен содержать массив заметок');
            }
            
            // Проверяем первую заметку на наличие обязательных полей
            if (notesData.length > 0) {
                const sampleNote = notesData[0];
                if (!sampleNote.title && !sampleNote.body && !sampleNote.text) {
                    throw new Error('Неверный формат заметок');
                }
            }
            
            // Сохраняем данные для импорта
            window.importNotesData = notesData;
            
            // Показываем превью
            showImportPreview(notesData);
            
            // Активируем кнопку импорта
            importBtn.disabled = false;
            
        } catch (error) {
            console.error('Ошибка парсинга JSON:', error);
            showAlert(`Ошибка: ${error.message}. Убедитесь, что файл содержит валидный JSON с массивом заметок.`);
            importBtn.disabled = true;
            importPreview.style.display = 'none';
        }
    };
    
    reader.onerror = function() {
        showAlert('Ошибка чтения файла');
        importBtn.disabled = true;
    };
    
    reader.readAsText(file);
}

// Показ превью импорта
function showImportPreview(notesData) {
    const importPreview = document.getElementById('importPreview');
    const previewContent = document.getElementById('previewContent');
    const totalNotes = document.getElementById('totalNotes');
    
    if (notesData.length === 0) {
        importPreview.style.display = 'none';
        return;
    }
    
    // Показываем первые 3 заметки для превью
    const previewNotes = notesData.slice(0, 3);
    
    previewContent.innerHTML = previewNotes.map((note, index) => `
        <div class="preview-note" style="margin-bottom: 10px; padding: 10px; background: #fff; border: 1px solid #eee; border-radius: 4px;">
            <div style="font-weight: 600; margin-bottom: 5px;">
                ${index + 1}. ${note.title || 'Без названия'}
            </div>
            <div style="font-size: 12px; color: #666;">
                ${note.body ? note.body.substring(0, 100) + (note.body.length > 100 ? '...' : '') : ''}
            </div>
            ${note.tagsArray && note.tagsArray.length > 0 ? `
                <div style="margin-top: 5px;">
                    Теги: ${note.tagsArray.join(', ')}
                </div>
            ` : ''}
        </div>
    `).join('');
    
    totalNotes.textContent = `Всего заметок для импорта: ${notesData.length}`;
    importPreview.style.display = 'block';
}

// Показать модальное окно импорта
function showImportNotes() {
    // Сбрасываем форму
    document.getElementById('importFile').value = '';
    document.getElementById('importBtn').disabled = true;
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('importPreview').style.display = 'none';
    document.getElementById('importStatus').style.display = 'none';
    document.getElementById('importOverwrite').checked = true;
    
    document.getElementById('importModal').style.display = 'flex';
}

// Закрыть модальное окно импорта
function closeImportModal() {
    document.getElementById('importModal').style.display = 'none';
    // Очищаем данные импорта
    window.importNotesData = null;
}

// Обработка импорта
async function processImport() {
    const state = window.appState;
    const currentUser = state.getCurrentUser();
    const importNotesData = window.importNotesData;
    const overwrite = document.getElementById('importOverwrite').checked;
    const importStatus = document.getElementById('importStatus');
    
    if (!currentUser || !importNotesData || importNotesData.length === 0) {
        showAlert('Нет данных для импорта');
        return;
    }
    
    try {
        showLoading();
        importStatus.style.display = 'block';
        importStatus.innerHTML = '<div style="color: #2196f3;"><i class="fas fa-spinner fa-spin"></i> Начинаем импорт...</div>';
        
        const importedCount = { success: 0, skipped: 0, error: 0 };
        const errors = [];
        
        // Импортируем заметки по одной
        for (let i = 0; i < importNotesData.length; i++) {
            const noteData = importNotesData[i];
            
            try {
                // Подготавливаем данные для импорта
                const noteToImport = {
                    title: noteData.title || '',
                    body: noteData.body || noteData.text || '',
                    subbody: noteData.subbody || '',
                    notes: noteData.notes || '',
                    tagsArray: noteData.tagsArray || noteData.tags || [],
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    userId: currentUser.uid
                };
                
                // Если есть createdAt и мы не перезаписываем, сохраняем оригинальную дату
                if (noteData.createdAt && !overwrite) {
                    noteToImport.createdAt = noteData.createdAt.toDate ? 
                        noteData.createdAt.toDate() : new Date(noteData.createdAt);
                } else {
                    noteToImport.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                }
                
                // Проверяем, существует ли уже заметка с таким ID
                if (noteData.id && !overwrite) {
                    const existingDoc = await state.db.collection('users').doc(currentUser.uid)
                        .collection('notes').doc(noteData.id).get();
                    
                    if (existingDoc.exists) {
                        importedCount.skipped++;
                        continue;
                    }
                }
                
                // Сохраняем заметку
                if (noteData.id && overwrite) {
                    // Обновляем существующую заметку
                    await state.db.collection('users').doc(currentUser.uid)
                        .collection('notes').doc(noteData.id).set(noteToImport);
                } else {
                    // Создаем новую заметку
                    await state.db.collection('users').doc(currentUser.uid)
                        .collection('notes').add(noteToImport);
                }
                
                importedCount.success++;
                
                // Обновляем статус каждые 10 заметок
                if (i % 10 === 0 || i === importNotesData.length - 1) {
                    importStatus.innerHTML = `
                        <div style="color: #2196f3;">
                            <i class="fas fa-spinner fa-spin"></i> 
                            Импортировано ${i + 1} из ${importNotesData.length} заметок...
                        </div>
                    `;
                }
                
            } catch (error) {
                console.error(`Ошибка импорта заметки ${i}:`, error);
                importedCount.error++;
                errors.push(`Заметка ${i + 1}: ${error.message}`);
                
                // Продолжаем импорт остальных заметок
                continue;
            }
        }
        
        hideLoading();
        
        // Показываем результат
        let statusHtml = `
            <div style="color: #4caf50;">
                <i class="fas fa-check-circle"></i> Импорт завершен!
            </div>
            <div style="margin-top: 10px; font-size: 14px;">
                <div>Успешно: ${importedCount.success}</div>
                <div>Пропущено: ${importedCount.skipped}</div>
                <div>Ошибок: ${importedCount.error}</div>
            </div>
        `;
        
        if (errors.length > 0) {
            statusHtml += `
                <div style="margin-top: 10px; font-size: 12px; color: #f44336;">
                    <strong>Ошибки:</strong><br>
                    ${errors.slice(0, 5).join('<br>')}
                    ${errors.length > 5 ? `<br>... и еще ${errors.length - 5} ошибок` : ''}
                </div>
            `;
        }
        
        importStatus.innerHTML = statusHtml;
        
        // Очищаем данные импорта через 3 секунды
        setTimeout(() => {
            closeImportModal();
        }, 3000);
        
    } catch (error) {
        hideLoading();
        console.error('Ошибка импорта:', error);
        importStatus.innerHTML = `
            <div style="color: #f44336;">
                <i class="fas fa-exclamation-circle"></i> Ошибка импорта: ${error.message}
            </div>
        `;
    }
}

// Показать модальное окно экспорта
async function showExportNotes() {
    const state = window.appState;
    const currentUser = state.getCurrentUser();
    
    if (!currentUser) {
        showAlert('Сначала войдите в систему');
        return;
    }
    
    try {
        showLoading();
        
        // Получаем все заметки пользователя
        const notesQuery = await state.db.collection('users').doc(currentUser.uid)
            .collection('notes')
            .orderBy('updatedAt', 'desc')
            .get();
        
        const notes = [];
        notesQuery.forEach(doc => {
            notes.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Получаем все теги пользователя
        const tagsQuery = await state.db.collection('users').doc(currentUser.uid)
            .collection('tags')
            .get();
        
        const tags = [];
        tagsQuery.forEach(doc => {
            tags.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        hideLoading();
        
        // Обновляем статистику
        document.getElementById('exportTotalNotesCount').textContent = notes.length;
        document.getElementById('exportNotesWithTags').textContent = notes.filter(n => n.tagsArray && n.tagsArray.length > 0).length;
        document.getElementById('exportTotalTagsCount').textContent = tags.length;
        
        // Сохраняем данные для экспорта
        window.exportNotesData = notes;
        window.exportTagsData = tags;
        
        document.getElementById('exportModal').style.display = 'flex';
        
    } catch (error) {
        hideLoading();
        console.error('Ошибка загрузки данных для экспорта:', error);
        showAlert('Ошибка загрузки данных: ' + error.message);
    }
}

// Закрыть модальное окно экспорта
function closeExportModal() {
    document.getElementById('exportModal').style.display = 'none';
    // Очищаем данные экспорта
    window.exportNotesData = null;
    window.exportTagsData = null;
}

// Экспорт заметок
function exportNotes() {
    const exportNotesData = window.exportNotesData;
    const exportTagsData = window.exportTagsData;
    const exportFormat = document.getElementById('exportFormat').value;
    const withTags = document.getElementById('exportWithTags').checked;
    const withTimestamps = document.getElementById('exportTimestamps').checked;
    const exportStatus = document.getElementById('exportStatus');
    
    if (!exportNotesData || exportNotesData.length === 0) {
        showAlert('Нет заметок для экспорта');
        return;
    }
    
    try {
        exportStatus.style.display = 'block';
        exportStatus.innerHTML = '<div style="color: #2196f3;"><i class="fas fa-spinner fa-spin"></i> Подготовка экспорта...</div>';
        
        // Подготавливаем данные для экспорта
        let dataToExport;
        
        if (withTags) {
            dataToExport = {
                notes: exportNotesData.map(note => {
                    const exportedNote = { ...note };
                    
                    // Очищаем Firebase-specific поля
                    delete exportedNote.userId;
                    
                    if (!withTimestamps) {
                        delete exportedNote.createdAt;
                        delete exportedNote.updatedAt;
                    }
                    
                    // Конвертируем Timestamp в Date если нужно
                    if (withTimestamps) {
                        if (exportedNote.createdAt && exportedNote.createdAt.toDate) {
                            exportedNote.createdAt = exportedNote.createdAt.toDate().toISOString();
                        }
                        if (exportedNote.updatedAt && exportedNote.updatedAt.toDate) {
                            exportedNote.updatedAt = exportedNote.updatedAt.toDate().toISOString();
                        }
                    }
                    
                    return exportedNote;
                }),
                tags: exportTagsData.map(tag => {
                    const exportedTag = { ...tag };
                    delete exportedTag.userId;
                    
                    if (exportedTag.createdAt && exportedTag.createdAt.toDate) {
                        exportedTag.createdAt = exportedTag.createdAt.toDate().toISOString();
                    }
                    
                    return exportedTag;
                }),
                exportInfo: {
                    exportedAt: new Date().toISOString(),
                    totalNotes: exportNotesData.length,
                    totalTags: exportTagsData.length,
                    format: exportFormat,
                    version: '1.0'
                }
            };
        } else {
            dataToExport = exportNotesData.map(note => {
                const exportedNote = { ...note };
                
                // Очищаем Firebase-specific поля
                delete exportedNote.userId;
                
                if (!withTimestamps) {
                    delete exportedNote.createdAt;
                    delete exportedNote.updatedAt;
                }
                
                // Конвертируем Timestamp в Date если нужно
                if (withTimestamps) {
                    if (exportedNote.createdAt && exportedNote.createdAt.toDate) {
                        exportedNote.createdAt = exportedNote.createdAt.toDate().toISOString();
                    }
                    if (exportedNote.updatedAt && exportedNote.updatedAt.toDate) {
                        exportedNote.updatedAt = exportedNote.updatedAt.toDate().toISOString();
                    }
                }
                
                return exportedNote;
            });
        }
        
        // Форматируем JSON
        let jsonString;
        if (exportFormat === 'json_min') {
            jsonString = JSON.stringify(dataToExport);
        } else {
            jsonString = JSON.stringify(dataToExport, null, 2);
        }
        
        // Создаем и скачиваем файл
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notes_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        exportStatus.innerHTML = `
            <div style="color: #4caf50;">
                <i class="fas fa-check-circle"></i> Экспорт завершен! Файл скачан.
            </div>
        `;
        
        // Закрываем окно через 2 секунды
        setTimeout(() => {
            closeExportModal();
        }, 2000);
        
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        exportStatus.innerHTML = `
            <div style="color: #f44336;">
                <i class="fas fa-exclamation-circle"></i> Ошибка экспорта: ${error.message}
            </div>
        `;
    }
}

// Экспорт функций
window.showImportNotes = showImportNotes;
window.showExportNotes = showExportNotes;
window.closeImportModal = closeImportModal;
window.closeExportModal = closeExportModal;
window.processImport = processImport;
window.exportNotes = exportNotes;
window.handleFileSelect = handleFileSelect;