let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverConfig = {};
let serverMaps = [];

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

// Tab Switching Logic
$('.tab-btn').click(function() {
    const tab = $(this).data('tab');
    if (tab === currentTab) return;

    playSound('click');
    $('.tab-btn').removeClass('active');
    $(this).addClass('active');

    currentTab = tab;
    if (tab === 'ffa' || tab === 'list') {
        $('#tab-view-list').show();
        $('#tab-view-create').hide();
        fetchLobbies();
    } else {
        $('#tab-view-list').hide();
        $('#tab-view-create').show();
    }
});

// Slider Value Updates
const setupSlider = (id, valId) => {
    $(`#${id}`).on('input', function() {
        $(`#${valId}`).text($(this).val());
    });
};
setupSlider('create-round-time', 'val-round-time');
setupSlider('create-max-players', 'val-max-players');
setupSlider('create-respawn-time', 'val-respawn-time');
setupSlider('create-kill-limit', 'val-kill-limit');

// NUI Message Handling
window.addEventListener('message', function(event) {
    const data = event.data;

    switch (data.action) {
        case 'open':
            $('#app').fadeIn(300);
            setupInitialData(data.config, data.maps);
            setLocales(data.config.Locales[data.config.Locale]);
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
            $('#game-hud').show();
            $('#hud-score-container').toggle(data.mode === 'tdm');
            break;
        case 'hideHUD':
            $('#game-hud').hide();
            break;
        case 'updateHUD':
            if (data.time) $('#hud-timer').text(data.time);
            if (data.kills !== undefined) $('#hud-kills').text(data.kills);
            if (data.deaths !== undefined) $('#hud-deaths').text(data.deaths);
            if (data.scoreBlue !== undefined) $('#hud-score-blue').text(data.scoreBlue);
            if (data.scoreRed !== undefined) $('#hud-score-red').text(data.scoreRed);
            break;
        case 'updateHUDDetails':
            $('#hud-health-bar').css('width', data.health + '%');
            $('#hud-armor-bar').css('width', data.armor + '%');
            $('#hud-ammo').text(data.ammo);
            break;
        case 'countdown':
            if (data.seconds > 0) {
                $('#hud-countdown').text(data.seconds).show();
            } else {
                $('#hud-countdown').hide();
            }
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function setLocales(locales) {
    if (!locales) return;
    for (let key in locales) {
        $(`#l-${key}`).text(locales[key]);
        $(`.l-${key}`).text(locales[key]);
    }
}

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Filter Maps Select
    const filterMaps = $('#filter-maps');
    filterMaps.html('<option value="all">ALL MAPS</option>');
    maps.forEach(map => {
        filterMaps.append(`<option value="${map.id}">${map.label.toUpperCase()}</option>`);
    });

    // Create Map Select
    const createMap = $('#create-map');
    createMap.empty();
    maps.forEach(map => {
        createMap.append(`<option value="${map.id}">${map.label.toUpperCase()}</option>`);
    });

    // Loadout Checkboxes
    const loadoutContainer = $('#loadout-checkboxes');
    loadoutContainer.empty();
    for (let key in config.WeaponLoadouts) {
        const label = config.WeaponLoadouts[key].label;
        loadoutContainer.append(`
            <label>
                <input type="checkbox" name="loadout" value="${key}" ${key === 'pistol' ? 'checked' : ''}>
                ${label}
            </label>
        `);
    }
}

function fetchLobbies() {
    $.post(`https://${GetParentResourceName()}/fetchLobbies`, JSON.stringify({ tab: currentTab }));
}

function renderLobbyList(lobbies) {
    const container = $('#lobby-list-container');
    container.empty();

    if (lobbies.length === 0) {
        container.append(`<div class="no-lobbies">${serverConfig.Locales[serverConfig.Locale]['no_lobbies']}</div>`);
        return;
    }

    lobbies.forEach(lobby => {
        const item = `
            <div class="lobby-item">
                <div class="lobby-info-main">
                    <div class="match-type">${lobby.mode === 'tdm' ? 'TEAM DEATHMATCH' : 'FREE FOR ALL'}</div>
                    <div class="match-name">${lobby.name}</div>
                    <div class="match-map"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel}</div>
                </div>
                <div class="player-count">
                    <i class="fa-solid fa-users"></i> ${lobby.playerCount}/${lobby.maxPlayers}
                </div>
                <div class="lobby-actions-btn">
                    <button class="action-btn" onclick="${currentTab === 'ffa' ? `quickJoin('${lobby.mapId}')` : `joinLobby('${lobby.id}')`}">
                        ${serverConfig.Locales[serverConfig.Locale]['btn_join']}
                    </button>
                </div>
            </div>
        `;
        container.append(item);
    });
}

window.joinLobby = (lobbyId) => {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/joinLobby`, JSON.stringify({ lobbyId }));
};

window.quickJoin = (mapId) => {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/quickJoin`, JSON.stringify({ mapId }));
};

$('#btn-submit-create').click(function() {
    playSound('click');
    const selectedLoadouts = [];
    $('input[name="loadout"]:checked').each(function() {
        selectedLoadouts.push($(this).val());
    });

    const settings = {
        name: $('#create-name').val() || 'MATCH',
        mapId: $('#create-map').val(),
        mode: $('#create-mode').val(),
        loadout: selectedLoadouts,
        roundTime: parseInt($('#create-round-time').val()),
        maxPlayers: parseInt($('#create-max-players').val()),
        vehiclesAllowed: $('#create-vehicles').is(':checked'),
        friendlyFire: $('#create-ff').is(':checked'),
        respawnTime: parseInt($('#create-respawn-time').val()),
        killLimit: parseInt($('#create-kill-limit').val())
    };

    $.post(`https://${GetParentResourceName()}/createLobby`, JSON.stringify(settings));
});

$('#btn-cancel-create').click(() => { playSound('click'); $('.tab-btn[data-tab="ffa"]').click(); });

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    $('#lobby-display-name').text(lobby.name);
    $('#lobby-display-mode').text(lobby.mode.toUpperCase());
    $('#lobby-waiting-area').fadeIn(300);

    $('#btn-start-game').toggle(asHost);
    $('#btn-close-lobby').toggle(asHost);
    $('#team-selector').toggle(lobby.mode === 'tdm');

    $('#lobby-settings-display').html(`
        <p><strong>MAP:</strong> ${lobby.mapLabel}</p>
        <p><strong>LOADOUT:</strong> ${Array.isArray(lobby.loadout) ? lobby.loadout.join(', ') : lobby.loadout}</p>
        <p><strong>LIMIT:</strong> ${lobby.killLimit > 0 ? lobby.killLimit + ' Kills' : 'None'}</p>
        <p><strong>VEHICLES:</strong> ${lobby.vehiclesAllowed ? 'ON' : 'OFF'}</p>
    `);
}

function renderPlayerList(players) {
    const container = $('#player-list');
    container.empty();

    players.forEach(p => {
        const item = `
            <div class="player-item ${p.ready ? 'ready' : ''}">
                <div class="player-name">${p.name} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold;"></i>' : ''}</div>
                <div class="player-team">${p.team}</div>
                ${isHost && !p.isHost ? `<button onclick="kickPlayer('${p.id}')" style="background:none; border:none; color:var(--danger); cursor:pointer;"><i class="fa-solid fa-user-minus"></i></button>` : ''}
            </div>
        `;
        container.append(item);
    });

    if (isHost) {
        $('#btn-start-game').prop('disabled', players.length < 2 && !currentLobby.isPersistent);
    }
}

window.kickPlayer = (id) => {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/kickPlayer`, JSON.stringify({ id }));
};

$('#btn-ready-toggle').click(() => {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/toggleReady`);
});

$('#btn-start-game').click(() => {
    playSound('start');
    $.post(`https://${GetParentResourceName()}/startGame`);
});

$('#btn-leave-lobby').click(() => {
    playSound('click');
    $('#lobby-waiting-area').fadeOut(300);
    $.post(`https://${GetParentResourceName()}/leaveLobby`);
});

$('#btn-close-lobby').click(() => {
    playSound('click');
    $('#lobby-waiting-area').fadeOut(300);
    $.post(`https://${GetParentResourceName()}/closeLobby`);
});

$('.team-btn').click(function() {
    playSound('click');
    $('.team-btn').removeClass('active');
    $(this).addClass('active');
    $.post(`https://${GetParentResourceName()}/setTeam`, JSON.stringify({ team: $(this).data('team') }));
});

$('#btn-send-chat').click(sendChat);
$('#chat-input').keypress(e => { if (e.key === 'Enter') sendChat(); });

function sendChat() {
    const msg = $('#chat-input').val();
    if (msg.trim().length > 0) {
        $.post(`https://${GetParentResourceName()}/sendLobbyChat`, JSON.stringify({ message: msg }));
        $('#chat-input').val('');
    }
}

window.addEventListener('message', e => {
    if (e.data.action === 'addChatMessage') {
        $('#chat-messages').append(`<div class="chat-msg"><span class="chat-name">${e.data.name}:</span> ${e.data.message}</div>`);
        $('#chat-messages').scrollTop($('#chat-messages')[0].scrollHeight);
    }
});

function showWinnerScreen(data) {
    playSound('win');
    $('#winner-name').text(data.winnerName);

    const tbody = $('#match-stats-table tbody');
    tbody.empty();
    data.stats.forEach(s => {
        tbody.append(`<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`);
    });

    const voteGrid = $('#map-vote-grid');
    voteGrid.empty();
    serverMaps.slice(0, 3).forEach(map => {
        voteGrid.append(`<div class="vote-item" onclick="voteMap('${map.id}', this)"><div class="vote-label">${map.label}</div></div>`);
    });

    $('#winner-screen').fadeIn(500);
}

window.voteMap = (mapId, el) => {
    playSound('click');
    $('.vote-item').removeClass('active');
    $(el).addClass('active');
    $.post(`https://${GetParentResourceName()}/voteMap`, JSON.stringify({ mapId }));
};

$('#btn-back-to-lobby').click(() => {
    $('#winner-screen').fadeOut(300);
    $.post(`https://${GetParentResourceName()}/closeWinnerScreen`);
});

$('#btn-back-to-menu').click(() => {
    $('#winner-screen').fadeOut(300);
    $.post(`https://${GetParentResourceName()}/leaveLobby`);
});

// ESC to close UI
$(document).keyup(e => {
    if (e.key === 'Escape') $.post(`https://${GetParentResourceName()}/closeUI`);
});

// Filter listeners
$('#filter-maps, #filter-players').change(() => fetchLobbies());

// Auto-Refresh
setInterval(() => {
    if ($('#app').is(':visible') && !$('#lobby-waiting-area').is(':visible') && !$('#winner-screen').is(':visible')) {
        fetchLobbies();
    }
}, 5000);
