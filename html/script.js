let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};

// Audio Setup
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
            setLocales(data.config.Locales[data.config.Locale]);
            fetchLobbies();
            break;
        case 'close':
            $('#app').fadeOut(200);
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
        case 'gameStarting':
            $('#app').fadeOut(300);
            $('#lobby-waiting-area').fadeOut(300);
            break;
        case 'showHUD':
            $('#game-hud').fadeIn(500);
            if (data.isPersistent) {
                $('.hud-timer').hide();
            } else {
                $('.hud-timer').show();
            }
            break;
        case 'hideHUD':
            $('#game-hud').fadeOut(200);
            break;
        case 'updateHUD':
            updateHUD(data);
            break;
        case 'updateHUDDetails':
            updateHUDDetails(data);
            break;
        case 'countdown':
            showCountdown(data.seconds);
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
    }
});

function setLocales(locales) {
    if (!locales) return;
    $('.l-key').each(function() {
        const id = $(this).attr('id');
        if (id && id.startsWith('l-')) {
            const key = id.replace('l-', '');
            if (locales[key]) {
                $(this).text(locales[key]);
            }
        }
    });
}

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Filter Maps
    const filterMaps = $('#filter-maps');
    filterMaps.empty().append('<option value="all">ALLE MAPS</option>');

    // Create Map Select
    const createMap = $('#create-map');
    createMap.empty();

    maps.forEach(map => {
        const opt = `<option value="${map.id}">${map.label.toUpperCase()}</option>`;
        filterMaps.append(opt);
        createMap.append(opt);
    });

    // Loadout Checkboxes
    const loadoutGrid = $('#loadout-checkboxes');
    loadoutGrid.empty();
    for (let key in config.WeaponLoadouts) {
        const label = config.WeaponLoadouts[key][0] ? key.toUpperCase() : key;
        const item = `
            <div class="loadout-item" data-key="${key}">
                <input type="checkbox" id="loadout-${key}" value="${key}">
                <label for="loadout-${key}">${label}</label>
            </div>
        `;
        loadoutGrid.append(item);
    }

    $('.loadout-item').on('click', function() {
        $(this).toggleClass('active');
        const checkbox = $(this).find('input');
        checkbox.prop('checked', !checkbox.prop('checked'));
        playSound('click');
    });
}

// Tab Management
$('.tab-btn').on('click', function() {
    const tab = $(this).data('tab');
    if (tab === currentTab) return;

    playSound('click');
    $('.tab-btn').removeClass('active');
    $(this).addClass('active');
    currentTab = tab;

    $('.tab-view').removeClass('active');
    if (tab === 'create') {
        $('#create-view').addClass('active');
    } else {
        $('#browser-view').addClass('active');
        $('#tab-description').text(tab === 'ffa' ? 'Wähle ein vordefiniertes Match für sofortige Action.' : 'Tritt einer von Spielern erstellten Lobby bei.');
        fetchLobbies();
    }
});

function fetchLobbies() {
    $.post(`https://${GetParentResourceName()}/fetchLobbies`, JSON.stringify({ tab: currentTab }));
}

function renderLobbyList(lobbies) {
    const container = $('#lobby-list-container');
    container.empty();

    if (lobbies.length === 0) {
        container.append('<div style="text-align:center; padding:50px; color:rgba(255,255,255,0.2); font-weight:900;">KEINE LOBBYS GEFUNDEN</div>');
        return;
    }

    lobbies.forEach((lobby, index) => {
        const item = `
            <div class="lobby-item" style="animation-delay: ${index * 0.05}s">
                <div class="lobby-info-main">
                    <div class="match-type">${lobby.mode === 'tdm' ? 'Team Deathmatch' : 'Free-for-All'}</div>
                    <div class="map-name-row">
                        <i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} • Host: ${lobby.hostName}
                    </div>
                </div>
                <div class="player-count-display">${lobby.playerCount}/${lobby.maxPlayers}</div>
                <div class="status-badge">${lobby.status}</div>
                <div class="action-area">
                    <button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')">${lobby.status === 'ACTIVE' ? 'SPECTATE' : 'JOIN'}</button>
                </div>
            </div>
        `;
        container.append(item);
    });
}

window.joinLobby = function(id) {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/joinLobby`, JSON.stringify({ lobbyId: id }));
};

// Form Sliders
function setupSlider(id, valId) {
    $(`#${id}`).on('input', function() {
        $(`#${valId}`).text($(this).val());
    });
}
setupSlider('create-time', 'val-time');
setupSlider('create-maxplayers', 'val-players');
setupSlider('create-respawn', 'val-respawn');
setupSlider('create-kills', 'val-kills');

// Create Lobby Submit
$('#btn-submit-create').on('click', function() {
    playSound('click');
    const selectedLoadouts = [];
    $('.loadout-item input:checked').each(function() {
        selectedLoadouts.push($(this).val());
    });

    const settings = {
        name: $('#create-name').val() || 'CUSTOM LOBBY',
        mapId: $('#create-map').val(),
        mode: $('#create-mode').val(),
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : 'all',
        roundTime: parseInt($('#create-time').val()),
        maxPlayers: parseInt($('#create-maxplayers').val()),
        respawnTime: parseInt($('#create-respawn').val()),
        killLimit: parseInt($('#create-kills').val()),
        vehiclesAllowed: $('#create-vehicles').is(':checked'),
        friendlyFire: $('#create-ff').is(':checked')
    };

    $.post(`https://${GetParentResourceName()}/createLobby`, JSON.stringify(settings));
});

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    $('#lobby-title').text(lobby.name.toUpperCase());
    $('#lobby-waiting-area').fadeIn(300);
    $('#btn-start-game').toggle(asHost);

    $('#lobby-settings-summary').html(`
        <span>MAP: ${lobby.mapLabel}</span> |
        <span>MODE: ${lobby.mode.toUpperCase()}</span> |
        <span>TIME: ${lobby.roundTime} MIN</span>
    `);
}

function renderPlayerList(players) {
    const list = $('#player-list');
    list.empty();
    players.forEach(p => {
        const item = `
            <div class="player-item ${p.ready ? 'ready' : ''}">
                <span>${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown" style="color:var(--warning); font-size:10px; margin-left:5px;"></i>' : ''}</span>
                <span style="font-size:10px; opacity:0.6;">${p.team.toUpperCase()}</span>
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-circle-xmark"></i></button>` : ''}
            </div>
        `;
        list.append(item);
    });

    if (isHost) {
        $('#btn-start-game').prop('disabled', players.length < 2 && !currentLobby.isPersistent);
    }
}

window.kickPlayer = function(id) {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/kickPlayer`, JSON.stringify({ id: id }));
};

// Lobby Actions
$('#btn-ready-toggle').on('click', function() {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/toggleReady`, JSON.stringify({}));
});

$('#btn-start-game').on('click', function() {
    playSound('start');
    $.post(`https://${GetParentResourceName()}/startGame`, JSON.stringify({}));
});

$('#btn-leave-lobby').on('click', function() {
    playSound('click');
    $('#lobby-waiting-area').fadeOut(200);
    $.post(`https://${GetParentResourceName()}/leaveLobby`, JSON.stringify({}));
});

$('.team-btn').on('click', function() {
    playSound('click');
    $('.team-btn').removeClass('active');
    $(this).addClass('active');
    $.post(`https://${GetParentResourceName()}/setTeam`, JSON.stringify({ team: $(this).data('team') }));
});

// Chat Logic
function addChatMessage(name, message) {
    const msg = `<div><span style="color:var(--primary); font-weight:900;">${name}:</span> <span>${message}</span></div>`;
    $('#chat-messages').append(msg);
    $('#chat-messages').scrollTop($('#chat-messages')[0].scrollHeight);
}

$('#chat-input').on('keypress', function(e) {
    if (e.which === 13) {
        $('#btn-send-chat').click();
    }
});

$('#btn-send-chat').on('click', function() {
    const msg = $('#chat-input').val();
    if (msg.trim() !== '') {
        $.post(`https://${GetParentResourceName()}/sendLobbyChat`, JSON.stringify({ message: msg }));
        $('#chat-input').val('');
    }
});

// HUD Updates
function updateHUD(data) {
    if (data.time) $('#hud-time').text(data.time);
    if (data.kills !== undefined) $('#hud-kills').text(data.kills);
    if (data.deaths !== undefined) $('#hud-deaths').text(data.deaths);

    if (data.mode === 'tdm') {
        $('#hud-team-score').show();
        if (data.scoreBlue !== undefined) $('#hud-score-blue').text(data.scoreBlue);
        if (data.scoreRed !== undefined) $('#hud-score-red').text(data.scoreRed);
    } else {
        $('#hud-team-score').hide();
    }
}

function updateHUDDetails(data) {
    if (data.health !== undefined) $('#hud-health').css('width', data.health + '%');
    if (data.armor !== undefined) $('#hud-armor').css('width', data.armor + '%');
    if (data.ammo !== undefined) $('#hud-ammo').text(data.ammo);
}

function showCountdown(seconds) {
    if (seconds > 0) {
        $('#countdown-display').text(seconds).show();
    } else {
        $('#countdown-display').hide();
    }
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    $('#winner-screen').fadeIn(500).css('display', 'flex');
    $('#winner-name-display').html(`${data.winnerName.toUpperCase()} <span class="l-key" id="l-winner_suffix">GEWINNT!</span>`);

    const table = $('<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody></tbody></table>');
    data.stats.forEach(s => {
        table.find('tbody').append(`<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`);
    });
    $('#match-stats-table').empty().append(table);

    // Map Voting
    const mapGrid = $('#map-voting-grid');
    mapGrid.empty();
    serverMaps.slice(0, 3).forEach(map => {
        const item = `<div class="map-vote-item" onclick="voteMap('${map.id}')">
            <div class="vote-count" id="vote-${map.id}">0</div>
            ${map.label.toUpperCase()}
        </div>`;
        mapGrid.append(item);
    });
}

window.voteMap = function(mapId) {
    playSound('click');
    $('.map-vote-item').removeClass('active');
    $(`.map-vote-item:contains('${mapId.toUpperCase()}')`).addClass('active'); // Simplistic selection
    $.post(`https://${GetParentResourceName()}/voteMap`, JSON.stringify({ mapId: mapId }));
};

$('#btn-win-menu').on('click', function() {
    playSound('click');
    $('#winner-screen').fadeOut(200);
    $.post(`https://${GetParentResourceName()}/leaveLobby`, JSON.stringify({}));
});

$('#btn-win-lobby').on('click', function() {
    playSound('click');
    $('#winner-screen').fadeOut(200);
    $('#lobby-waiting-area').fadeIn(300);
    $.post(`https://${GetParentResourceName()}/closeWinnerScreen`, JSON.stringify({}));
});

// Close UI
$(document).on('keyup', function(e) {
    if (e.key === "Escape") {
        $.post(`https://${GetParentResourceName()}/closeUI`);
    }
});

// Auto-Refresh Lobbys
setInterval(() => {
    if ($('#app').is(':visible') && !$('#lobby-waiting-area').is(':visible') && !$('#winner-screen').is(':visible')) {
        fetchLobbies();
    }
}, 5000);
