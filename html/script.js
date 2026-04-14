let currentTab = 'ffa';
let serverConfig = {};
let serverMaps = [];
let myId = null;
let currentLobby = null;
let isHost = false;

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

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            $('#app').fadeIn(300).css('display', 'flex');
            setupInitialData(data.config, data.maps);
            setTab('ffa');
            break;
        case 'close':
            $('#app').fadeOut(300);
            break;
        case 'updateLobbies':
            renderLobbyList(data.lobbies);
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            showLobbyArea(data.lobby, data.action === 'lobbyCreated');
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'gameStarting':
            $('#app').fadeOut(300);
            $('#lobby-waiting-area').hide();
            break;
        case 'showHUD':
            $('#game-hud').fadeIn(300);
            $('#hud-team-scores').toggle(data.mode === 'tdm');
            break;
        case 'hideHUD':
            $('#game-hud').fadeOut(300);
            break;
        case 'updateHUD':
            if (data.time) $('#hud-time').text(data.time);
            if (data.kills !== undefined) $('#hud-kills').text(data.kills);
            if (data.deaths !== undefined) $('#hud-deaths').text(data.deaths);
            if (data.scoreBlue !== undefined) $('#hud-score-blue').text(data.scoreBlue);
            if (data.scoreRed !== undefined) $('#hud-score-red').text(data.scoreRed);
            break;
        case 'updateHUDDetails':
            $('#hud-health').css('width', data.health + '%');
            $('#hud-armor').css('width', data.armor + '%');
            $('#hud-ammo').text(data.ammo);
            break;
        case 'countdown':
            if (data.seconds > 0) {
                $('#countdown-display').text(data.seconds).show();
            } else {
                $('#countdown-display').hide();
            }
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Set Localizations
    const loc = config.Locales[config.Locale];
    for (const key in loc) {
        $(`#loc-${key.replace(/_/g, '-')}`).text(loc[key]);
    }

    // Populate Creation Maps
    const mapSelect = $('#create-map');
    mapSelect.empty();
    maps.forEach(m => {
        mapSelect.append(`<option value="${m.id}">${m.label}</option>`);
    });

    // Populate Filter Maps
    const filterMaps = $('#filter-maps');
    filterMaps.find('option:not([value="all"])').remove();
    maps.forEach(m => {
        filterMaps.append(`<option value="${m.id}">${m.label.toUpperCase()}</option>`);
    });

    // Populate Loadout Multi-Select
    const loadoutGrid = $('#loadout-checkboxes');
    loadoutGrid.empty();
    for (const key in config.WeaponLoadouts) {
        if (key === 'all') continue;
        loadoutGrid.append(`
            <div class="loadout-item" data-value="${key}">
                <i class="fa-solid fa-square-check"></i>
                <span>${key.toUpperCase()}</span>
            </div>
        `);
    }

    $('.loadout-item').off('click').on('click', function() {
        $(this).toggleClass('active');
        playSound('click');
    });
}

// Tab Management
$('.tab-btn').on('click', function() {
    const tab = $(this).data('tab');
    if (tab === currentTab) return;
    setTab(tab);
    playSound('click');
});

function setTab(tab) {
    currentTab = tab;
    $('.tab-btn').removeClass('active');
    $(`.tab-btn[data-tab="${tab}"]`).addClass('active');

    if (tab === 'create') {
        $('#browser-view').hide();
        $('#create-view').show();
    } else {
        $('#create-view').hide();
        $('#browser-view').show();
        fetchLobbies();
    }
}

function fetchLobbies() {
    $.post(`https://${GetParentResourceName()}/fetchLobbies`, JSON.stringify({
        tab: currentTab,
        filters: {
            map: $('#filter-maps').val(),
            players: $('#filter-players').val()
        }
    }));
}

// Creation Logic
$('#create-round-time').on('input', function() { $('#val-round-time').text($(this).val()); });
$('#create-max-players').on('input', function() { $('#val-max-players').text($(this).val()); });

$('.toggle-btn').on('click', function() {
    const val = $(this).data('value') === 'true';
    const newVal = !val;
    $(this).data('value', newVal.toString());
    $(this).toggleClass('on', newVal);
    $(this).text(newVal ? 'ON' : 'OFF');
    playSound('click');
});

$('#btn-submit-create').on('click', function() {
    const loadout = [];
    $('.loadout-item.active').each(function() {
        loadout.push($(this).data('value'));
    });

    if (loadout.length === 0) loadout.push('pistol'); // Default

    const settings = {
        name: $('#create-name').val() || 'CUSTOM LOBBY',
        mapId: $('#create-map').val(),
        mode: $('#create-mode').val(),
        loadout: loadout,
        roundTime: parseInt($('#create-round-time').val()),
        maxPlayers: parseInt($('#create-max-players').val()),
        respawnTime: parseInt($('#create-respawn-time').val()),
        killLimit: parseInt($('#create-kill-limit').val()),
        vehiclesAllowed: $('#toggle-vehicles').data('value') === 'true',
        friendlyFire: $('#toggle-ff').data('value') === 'true'
    };

    $.post(`https://${GetParentResourceName()}/createLobby`, JSON.stringify(settings));
    playSound('click');
});

$('#btn-cancel-create').on('click', () => setTab('ffa'));

// Lobby List Rendering
function renderLobbyList(lobbies) {
    const list = $('#lobby-list');
    list.empty();

    if (lobbies.length === 0) {
        list.append('<div class="no-lobbies">NO LOBBIES FOUND</div>');
        return;
    }

    lobbies.forEach(lobby => {
        const item = $(`
            <div class="lobby-item">
                <div class="lobby-info">
                    <h4>${lobby.name.toUpperCase()}</h4>
                    <p>${lobby.mapLabel} | ${lobby.mode.toUpperCase()} | ${lobby.hostName}</p>
                </div>
                <div class="player-count">${lobby.playerCount}/${lobby.maxPlayers}</div>
                <button class="action-btn btn-join">${lobby.status === 'ACTIVE' ? 'SPECTATE' : 'JOIN'}</button>
            </div>
        `);

        item.find('.btn-join').on('click', () => {
            $.post(`https://${GetParentResourceName()}/joinLobby`, JSON.stringify({ lobbyId: lobby.id }));
            playSound('click');
        });

        list.append(item);
    });
}

// Waiting Area Logic
function showLobbyArea(lobby, host) {
    currentLobby = lobby;
    isHost = host;
    playSound('join');

    $('#waiting-lobby-name').text(lobby.name.toUpperCase());
    $('#waiting-lobby-id').text(lobby.id);
    $('#lobby-waiting-area').fadeIn(300);
    $('#btn-start-game').toggle(host);

    updateSettingsSummary(lobby);
}

function updateSettingsSummary(lobby) {
    const loc = serverConfig.Locales[serverConfig.Locale];
    $('#waiting-settings-summary').html(`
        <p><strong>${loc.map_select}:</strong> ${lobby.mapLabel}</p>
        <p><strong>${loc.mode_select}:</strong> ${lobby.mode === 'tdm' ? loc.mode_tdm : loc.mode_ffa}</p>
        <p><strong>${loc.round_time}:</strong> ${lobby.roundTime} MIN</p>
        <p><strong>${loc.kill_limit}:</strong> ${lobby.killLimit > 0 ? lobby.killLimit : loc.off}</p>
        <p><strong>${loc.vehicles_allowed}:</strong> ${lobby.vehiclesAllowed ? loc.on : loc.off}</p>
    `);
}

function renderPlayerList(players) {
    const list = $('#waiting-player-list');
    list.empty();

    players.forEach(p => {
        const item = $(`
            <div class="player-item ${p.ready ? 'ready' : ''}">
                <div class="p-info">
                    <span class="name">${p.name.toUpperCase()} ${p.isHost ? '(HOST)' : ''}</span>
                    <span class="team badge-${p.team}">${p.team.toUpperCase()}</span>
                </div>
                ${isHost && !p.isHost ? `<i class="fa-solid fa-xmark kick-btn" onclick="kickPlayer('${p.id}')"></i>` : ''}
            </div>
        `);
        list.append(item);
    });

    if (isHost) {
        $('#btn-start-game').prop('disabled', players.length < 2 && !currentLobby.isPersistent);
    }
}

function kickPlayer(id) {
    $.post(`https://${GetParentResourceName()}/kickPlayer`, JSON.stringify({ id }));
    playSound('click');
}

$('.team-btn').on('click', function() {
    const team = $(this).data('team');
    $('.team-btn').removeClass('active');
    $(this).addClass('active');
    $.post(`https://${GetParentResourceName()}/setTeam`, JSON.stringify({ team }));
    playSound('click');
});

$('#btn-ready-toggle').on('click', () => {
    $.post(`https://${GetParentResourceName()}/toggleReady`);
    playSound('click');
});

$('#btn-start-game').on('click', () => {
    $.post(`https://${GetParentResourceName()}/startGame`);
    playSound('start');
});

$('#btn-leave-lobby').on('click', () => {
    $('#lobby-waiting-area').fadeOut(300);
    $.post(`https://${GetParentResourceName()}/leaveLobby`);
    playSound('click');
});

// Chat
$('#chat-input').on('keypress', function(e) {
    if (e.key === 'Enter') {
        const msg = $(this).val();
        if (msg.trim().length > 0) {
            $.post(`https://${GetParentResourceName()}/sendLobbyChat`, JSON.stringify({ message: msg }));
            $(this).val('');
        }
    }
});

function addChatMessage(name, msg) {
    const chat = $('#chat-messages');
    chat.append(`<div class="chat-msg"><span class="name">${name}:</span><span class="text">${msg}</span></div>`);
    chat.scrollTop(chat[0].scrollHeight);
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    $('#winner-announcement').html(`${data.winnerName.toUpperCase()} <span id="loc-winner-suffix">${serverConfig.Locales[serverConfig.Locale].winner_suffix}</span>`);

    const body = $('#winner-stats-body');
    body.empty();
    data.stats.forEach(s => {
        body.append(`
            <tr>
                <td>${s.name.toUpperCase()}</td>
                <td>${s.kills}</td>
                <td>${s.deaths}</td>
                <td>${s.kd}</td>
            </tr>
        `);
    });

    $('#winner-screen').fadeIn(500);
}

$('#btn-winner-lobby').on('click', () => {
    $('#winner-screen').fadeOut(300);
    $('#lobby-waiting-area').fadeIn(300);
    $.post(`https://${GetParentResourceName()}/closeWinnerScreen`);
});

$('#btn-winner-menu').on('click', () => {
    $('#winner-screen').fadeOut(300);
    $.post(`https://${GetParentResourceName()}/leaveLobby`);
});

// Global Close
$(window).on('keyup', (e) => {
    if (e.key === 'Escape') {
        $.post(`https://${GetParentResourceName()}/closeUI`);
    }
});

// Auto-Refresh Lobbies
setInterval(() => {
    if ($('#app').is(':visible') && !$('#lobby-waiting-area').is(':visible') && !$('#winner-screen').is(':visible')) {
        fetchLobbies();
    }
}, 5000);

// Filters Update
$('#filter-maps, #filter-players').on('change', () => fetchLobbies());
