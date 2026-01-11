function initSyncModule() {
    console.log('Модуль синхронизации инициализирован');
    
    // Добавляем кнопку синхронизации при загрузке
    setTimeout(() => {
        addSyncButton();
    }, 1000);
}

function addSyncButton() {
    const controlsRight = document.querySelector('.controls-right');
    if (!controlsRight) {
        console.warn('Элемент controls-right не найден');
        return;
    }
    
    // Проверяем, не добавлена ли уже кнопка
    if (document.getElementById('syncBtn')) {
        return;
    }
    
    const syncBtn = document.createElement('button');
    syncBtn.id = 'syncBtn';
    syncBtn.className = 'btn-secondary';
    syncBtn.title = 'Синхронизировать (загрузить свежие данные из Firebase)';
    syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
    syncBtn.onclick = performManualSync;
    
    const networkIndicator = document.createElement('div');
    networkIndicator.id = 'networkStatus';
    networkIndicator.style.marginLeft = '8px';
    networkIndicator.style.cursor = 'default';
    
    controlsRight.appendChild(syncBtn);
    controlsRight.appendChild(networkIndicator);
    
    // Обновляем статус сети
    if (window.updateNetworkStatus) {
        window.updateNetworkStatus();
    }
}

// Экспорт функций
window.initSyncModule = initSyncModule;