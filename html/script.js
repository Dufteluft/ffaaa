let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';

// Maps and Config from Server
let serverMaps = [];
let serverConfig = {};
let currentLocales = {};

// Audio setup
const sounds = {
    click: new Audio('assets/click.mp3'),
    join: new Audio('assets/join.mp3'),
    start: new Audio('assets/start.mp3'),
    kill: new Audio('assets/kill.mp3'),
    win: new Audio('assets/win.mp3')
};

function playSound(name) {
    if (sounds[name]) {
        sounds[name].currentTime = 0;
        sounds[name].play().catch(() => {});
    }
}

// Tab Switching
$('.tab-btn').on('click', function() {
    const tab = $(this).data('tab');
    if (tab === currentTab) return;

    playSound('click');
    $('.tab-btn').removeClass('active');
    $(this).addClass('active');

    const container = $('#lobby-list-container');
    container.addClass('switching');

    setTimeout(() => {
        currentTab = tab;
        fetchLobbies();
        container.removeClass('switching');
    }, 300);
});

// Modal Controls
$('#open-create-modal').on('click', function() {
    playSound('click');
    $('#create-lobby-modal').fadeIn(200).css('display', 'flex');
});

$('#btn-close-modal').on('click', function() {
    playSound('click');
    $('#create-lobby-modal').fadeOut(200);
});

// Slider Sync
const setupSlider = (id) => {
    $(`#${id}`).on('input', function() {
        $(`#${id}-val`).text($(this).val());
    });
};
setupSlider('round-time');
setupSlider('max-players');
setupSlider('respawn-time');
setupSlider('kill-limit');

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            $('#app').fadeIn(300).css('display', 'flex');
            setupInitialData(data.config, data.maps);
            fetchLobbies();
            break;
        case 'close':
            $('#app').fadeOut(300);
            break;
        case 'updateLobbies':
            renderLobbyList(data.lobbies);
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            $('#create-lobby-modal').hide();
            showLobbyArea(data.lobby, data.action === 'lobbyCreated');
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'gameStarting':
            $('#app').hide();
            $('#lobby-waiting-area').hide();
            break;
        case 'showHUD':
            $('#game-hud').fadeIn(300);
            $('#hud-tdm-score').css('display', data.mode === 'tdm' ? 'flex' : 'none');
            break;
        case 'hideHUD':
            $('#game-hud').fadeOut(300);
            break;
        case 'updateHUDDetails':
            $('#health-bar').css('width', `${data.health}%`);
            $('#armor-bar').css('width', `${data.armor}%`);
            $('#hud-ammo').text(data.ammo);
            break;
        case 'updateHUD':
            if (data.time) $('#hud-timer').text(data.time);
            if (data.kills !== undefined) {
                if (data.kills > parseInt($('#hud-kills').text())) playSound('kill');
                $('#hud-kills').text(data.kills);
            }
            if (data.deaths !== undefined) $('#hud-deaths').text(data.deaths);
            if (data.scoreBlue !== undefined) $('#score-blue').text(data.scoreBlue);
            if (data.scoreRed !== undefined) $('#score-red').text(data.scoreRed);
            break;
        case 'countdown':
            if (data.seconds > 0) {
                $('#hud-countdown').text(data.seconds).show();
                playSound('click');
            } else {
                $('#hud-countdown').hide();
            }
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;
    currentLocales = config.Locales[config.Locale];

    setLocales();

    const mapSelect = $('#map-select');
    mapSelect.empty();
    maps.forEach(map => {
        mapSelect.append(`<option value="${map.id}">${map.label.toUpperCase()}</option>`);
    });

    const filterMapSelect = $('#filter-maps');
    filterMapSelect.find('option:not([value="all"])').remove();
    maps.forEach(map => {
        filterMapSelect.append(`<option value="${map.id}">${map.label.toUpperCase()}</option>`);
    });

    const loadoutGrid = $('#loadout-grid');
    loadoutGrid.empty();
    for (let key in config.WeaponLoadouts) {
        loadoutGrid.append(`
            <label class="checkbox-item">
                <input type="checkbox" name="loadout" value="${key}">
                <span>${config.WeaponLoadouts[key][0].label}</span>
            </label>
        `);
    }
}

function setLocales() {
    for (let key in currentLocales) {
        const elements = document.querySelectorAll(`.l-${key}`);
        elements.forEach(el => {
            if (el.tagName === 'INPUT' && el.type === 'button') {
                el.value = currentLocales[key];
            } else {
                el.innerText = currentLocales[key];
            }
        });
    }
}

function fetchLobbies() {
    $.post(`https://${GetParentResourceName()}/fetchLobbies`, JSON.stringify({
        tab: currentTab,
        filters: {
            mapId: $('#filter-maps').val(),
            capacity: $('#filter-players').val()
        }
    }));
}

$('#filter-maps, #filter-players').on('change', fetchLobbies);

function renderLobbyList(lobbies) {
    const container = $('#lobby-list-container');
    container.empty();

    if (!lobbies || lobbies.length === 0) {
        container.append('<div class="no-lobbies">KEINE LOBBYS GEFUNDEN</div>');
        return;
    }

    lobbies.forEach((lobby, index) => {
        const playerCount = lobby.playerCount || 0;
        const maxPlayers = lobby.maxPlayers || 16;
        const percent = (playerCount / maxPlayers) * 100;
        const status = lobby.status || 'waiting';

        let strokeColor = '#00ff88';
        if (status === 'ACTIVE') strokeColor = '#ff9500';
        else if (percent > 80) strokeColor = '#ff4444';

        const radius = 25;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;

        const item = `
            <div class="lobby-item" style="animation-delay: ${index * 0.05}s">
                <div class="lobby-map-preview">
                    <img src="https://via.placeholder.com/140x80/0f1419/ffffff?text=${lobby.mapLabel}" alt="${lobby.mapLabel}">
                </div>
                <div class="lobby-info-main">
                    <div class="match-type">${lobby.mode === 'tdm' ? 'Team Deathmatch' : 'Free-for-All'}</div>
                    <div class="map-name-row">
                        <i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} - ${lobby.hostName}
                    </div>
                </div>
                <div class="player-counter-wrapper">
                    <svg class="player-counter-svg">
                        <circle class="circle-bg" cx="30" cy="30" r="${radius}"></circle>
                        <circle class="circle-progress" cx="30" cy="30" r="${radius}"
                            style="stroke: ${strokeColor}; stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};">
                        </circle>
                    </svg>
                    <div class="player-count-text">${playerCount}/${maxPlayers}</div>
                </div>
                <div class="mode-icon">
                    <i class="fa-solid ${lobby.mode === 'tdm' ? 'fa-users' : 'fa-user'}"></i>
                </div>
                <div class="status-badge status-${status.toLowerCase()}">${status}</div>
                <div class="action-area">
                    <button class="action-btn ${playerCount >= maxPlayers ? 'btn-disabled' : 'btn-join'}"
                        onclick="joinLobby('${lobby.id}')" ${playerCount >= maxPlayers ? 'disabled' : ''}>
                        ${playerCount >= maxPlayers ? 'FULL' : currentLocales['btn_join']}
                    </button>
                </div>
            </div>
        `;
        container.append(item);
    });
}

window.joinLobby = function(lobbyId) {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/joinLobby`, JSON.stringify({ lobbyId }));
};

$('#btn-create-lobby').on('click', function() {
    const selectedLoadouts = [];
    $('input[name="loadout"]:checked').each(function() {
        selectedLoadouts.push($(this).val());
    });

    if (selectedLoadouts.length === 0) selectedLoadouts.push('all');

    const settings = {
        name: $('#lobby-name').val() || 'CUSTOM LOBBY',
        mapId: $('#map-select').val(),
        mode: $('#mode-select').val(),
        loadout: selectedLoadouts,
        roundTime: parseInt($('#round-time').val()),
        maxPlayers: parseInt($('#max-players').val()),
        vehiclesAllowed: $('#vehicles-allowed').is(':checked'),
        friendlyFire: $('#friendly-fire').is(':checked'),
        respawnTime: parseInt($('#respawn-time').val()),
        killLimit: parseInt($('#kill-limit').val())
    };

    playSound('click');
    $.post(`https://${GetParentResourceName()}/createLobby`, JSON.stringify(settings));
});

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    $('#lobby-title').text(lobby.name.toUpperCase());
    $('#lobby-waiting-area').fadeIn(300).css('display', 'flex');
    $('#btn-start-game').toggle(asHost);
    $('#btn-close-lobby').toggle(asHost);

    updateLobbyInfo(lobby);
}

function updateLobbyInfo(lobby) {
    if (isHost && !lobby.isPersistent) {
        // Render editable settings for host
        let mapOptions = serverMaps.map(m => `<option value="${m.id}" ${m.id === lobby.mapId ? 'selected' : ''}>${m.label.toUpperCase()}</option>`).join('');
        let loadoutCheckboxes = '';
        for (let key in serverConfig.WeaponLoadouts) {
            let checked = Array.isArray(lobby.loadout) ? lobby.loadout.includes(key) : lobby.loadout === key;
            loadoutCheckboxes += `
                <label class="checkbox-item">
                    <input type="checkbox" class="edit-loadout" value="${key}" ${checked ? 'checked' : ''}>
                    <span>${serverConfig.WeaponLoadouts[key][0].label}</span>
                </label>
            `;
        }

        $('#lobby-info-summary').html(`
            <div class="edit-settings">
                <div class="input-group">
                    <label class="l-map_select">MAP</label>
                    <select id="edit-map">${mapOptions}</select>
                </div>
                <div class="input-group">
                    <label class="l-mode_select">MODE</label>
                    <select id="edit-mode">
                        <option value="ffa" ${lobby.mode === 'ffa' ? 'selected' : ''}>FFA</option>
                        <option value="tdm" ${lobby.mode === 'tdm' ? 'selected' : ''}>TDM</option>
                    </select>
                </div>
                <div class="input-group">
                    <label class="l-loadout_select">LOADOUT</label>
                    <div class="checkbox-grid small-grid">${loadoutCheckboxes}</div>
                </div>
                <div class="input-row">
                    <div class="input-group">
                        <label class="l-round_time">TIME (MIN)</label>
                        <input type="number" id="edit-time" value="${lobby.roundTime}" min="5" max="60">
                    </div>
                    <div class="input-group">
                        <label class="l-max_players">MAX PLAYERS</label>
                        <input type="number" id="edit-players" value="${lobby.maxPlayers}" min="2" max="32">
                    </div>
                </div>
                <button class="confirm-btn small-btn" id="btn-save-settings">SAVE SETTINGS</button>
            </div>
        `);

        $('#btn-save-settings').on('click', function() {
            const selectedLoadouts = [];
            $('.edit-loadout:checked').each(function() {
                selectedLoadouts.push($(this).val());
            });

            const settings = {
                mapId: $('#edit-map').val(),
                mode: $('#edit-mode').val(),
                loadout: selectedLoadouts,
                roundTime: parseInt($('#edit-time').val()),
                maxPlayers: parseInt($('#edit-players').val())
            };
            playSound('click');
            $.post(`https://${GetParentResourceName()}/updateSettings`, JSON.stringify(settings));
        });
    } else {
        // Static info for players or persistent lobbies
        $('#lobby-info-summary').html(`
            <div class="info-row"><span>MAP:</span> <span>${lobby.mapLabel}</span></div>
            <div class="info-row"><span>MODE:</span> <span>${lobby.mode.toUpperCase()}</span></div>
            <div class="info-row"><span>LOADOUT:</span> <span>${Array.isArray(lobby.loadout) ? lobby.loadout.join(', ') : lobby.loadout}</span></div>
            <div class="info-row"><span>TIME:</span> <span>${lobby.roundTime} MIN</span></div>
            <div class="info-row"><span>KILL LIMIT:</span> <span>${lobby.killLimit || 'OFF'}</span></div>
        `);
    }
}

function renderPlayerList(players) {
    const list = $('#player-list');
    list.empty();
    players.forEach(p => {
        const item = `
            <div class="player-item ${p.ready ? 'ready' : ''}">
                <div class="p-info">
                    <span class="p-name">${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold;"></i>' : ''}</span>
                    <span class="p-team" style="color: ${p.team === 'blue' ? 'var(--blue-team)' : (p.team === 'red' ? 'var(--red-team)' : 'var(--text-muted)')}">
                        ${p.team.toUpperCase()}
                    </span>
                </div>
                <div class="p-actions">
                    ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-user-slash"></i></button>` : ''}
                    ${p.ready ? '<i class="fa-solid fa-check-double" style="color: var(--success);"></i>' : '<i class="fa-solid fa-clock"></i>'}
                </div>
            </div>
        `;
        list.append(item);
    });

    if (isHost) {
        const allReady = players.every(p => p.ready);
        $('#btn-start-game').prop('disabled', players.length < 2 || !allReady);
    }
}

window.kickPlayer = function(id) {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/kickPlayer`, JSON.stringify({ id }));
};

$('#btn-ready-toggle').on('click', function() {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/toggleReady`);
});

$('#btn-start-game').on('click', function() {
    playSound('start');
    $.post(`https://${GetParentResourceName()}/startGame`);
});

$('#btn-leave-lobby').on('click', function() {
    playSound('click');
    $('#lobby-waiting-area').fadeOut(300);
    $.post(`https://${GetParentResourceName()}/leaveLobby`);
});

$('#btn-close-lobby').on('click', function() {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/closeLobby`);
});

$('.team-btn').on('click', function() {
    const team = $(this).data('team');
    playSound('click');
    $('.team-btn').removeClass('active');
    $(this).addClass('active');
    $.post(`https://${GetParentResourceName()}/setTeam`, JSON.stringify({ team }));
});

$('#chat-input').on('keypress', function(e) {
    if (e.key === 'Enter') sendChatMessage();
});

$('#btn-send-chat').on('click', sendChatMessage);

function sendChatMessage() {
    const msg = $('#chat-input').val();
    if (msg.trim().length > 0) {
        $.post(`https://${GetParentResourceName()}/sendLobbyChat`, JSON.stringify({ message: msg }));
        $('#chat-input').val('');
    }
}

function addChatMessage(name, message) {
    const container = $('#chat-messages');
    const isSystem = name === 'SYSTEM';
    container.append(`
        <div class="chat-msg">
            <span class="${isSystem ? 'system' : 'name'}">${name}:</span>
            <span class="text">${message}</span>
        </div>
    `);
    container.scrollTop(container[0].scrollHeight);
}

function showWinnerScreen(data) {
    playSound('win');
    $('#winner-screen').fadeIn(500).css('display', 'flex');
    $('#winner-name').text(data.winnerName + " " + (currentLocales['winner_suffix'] || 'GEWINNT!'));

    const statsTable = $('#match-stats-table');
    let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.html(html);

    renderMapVoting();
}

function renderMapVoting() {
    const grid = $('#vote-map-grid');
    grid.empty();
    serverMaps.forEach(map => {
        grid.append(`
            <div class="vote-item" onclick="voteMap('${map.id}', this)">
                <div class="map-name">${map.label.toUpperCase()}</div>
                <div class="vote-count" id="votes-${map.id}">0</div>
            </div>
        `);
    });
}

window.voteMap = function(mapId, el) {
    playSound('click');
    $('.vote-item').removeClass('voted');
    $(el).addClass('voted');
    $.post(`https://${GetParentResourceName()}/voteMap`, JSON.stringify({ mapId }));
};

$('#btn-back-to-menu').on('click', function() {
    playSound('click');
    $('#winner-screen').fadeOut(300);
    $.post(`https://${GetParentResourceName()}/leaveLobby`);
});

$('#btn-back-to-lobby').on('click', function() {
    playSound('click');
    $('#winner-screen').fadeOut(300);
    $('#lobby-waiting-area').fadeIn(300).css('display', 'flex');
    $.post(`https://${GetParentResourceName()}/closeWinnerScreen`);
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        $.post(`https://${GetParentResourceName()}/closeUI`);
    }
});

// Auto-Refresh
setInterval(() => {
    if ($('#app').is(':visible') && !$('#lobby-waiting-area').is(':visible') && !$('#winner-screen').is(':visible')) {
        fetchLobbies();
    }
}, 5000);
