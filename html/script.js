let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};

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

// Localization
function setLocales(locales) {
    for (const [key, value] of Object.entries(locales)) {
        const el = document.getElementById(`l-${key}`);
        if (el) el.innerHTML = value;
        const els = document.querySelectorAll(`.l-${key}`);
        els.forEach(e => e.innerHTML = value);
    }
}

// Tab Switching
$('.tab-btn').click(function() {
    const tab = $(this).data('tab');
    if (tab === currentTab) return;
    playSound('click');

    $('.tab-btn').removeClass('active');
    $(this).addClass('active');

    currentTab = tab;

    if (tab === 'create') {
        $('#lobby-list-container').hide();
        $('#filter-section').hide();
        $('#create-lobby-form').show();
        $('#create-btn-container').show();
    } else {
        $('#create-lobby-form').hide();
        $('#create-btn-container').hide();
        $('#lobby-list-container').show();
        $('#filter-section').show();
        fetchLobbies();
    }
});

// Slider values sync
const setupSlider = (id, valId, suffix = '') => {
    $(`#${id}`).on('input', function() {
        $(`#${valId}`).text($(this).val() + suffix);
    });
};
setupSlider('input-round-time', 'val-round-time');
setupSlider('input-max-players', 'val-max-players');
setupSlider('input-respawn-time', 'val-respawn-time');
setupSlider('input-kill-limit', 'val-kill-limit');

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            $('#app').show();
            setupInitialData(data.config, data.maps);
            fetchLobbies();
            break;
        case 'close':
            $('#app').hide();
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
            $('#app').hide();
            $('#lobby-waiting-area').hide();
            $('#game-hud').show();
            break;
        case 'showHUD':
            $('#game-hud').show();
            $('#tdm-score-box').toggle(data.mode === 'tdm');
            break;
        case 'hideHUD':
            $('#game-hud').hide();
            break;
        case 'updateHUD':
            updateHUD(data);
            break;
        case 'updateHUDDetails':
            updateHUDDetails(data);
            break;
        case 'countdown':
            handleCountdown(data.seconds);
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;
    setLocales(config.Locales[config.Locale]);

    // Populate maps
    const mapSelects = ['#select-map', '#filter-maps'];
    mapSelects.forEach(selId => {
        const sel = $(selId);
        sel.find('option:not([value="all"])').remove();
        maps.forEach(map => {
            sel.append(`<option value="${map.id}">${map.label}</option>`);
        });
    });

    // Populate Loadouts (Multi-select)
    const loadoutGrid = $('#loadout-multi-select');
    loadoutGrid.empty();
    for (const [key, val] of Object.entries(config.WeaponLoadouts)) {
        const label = config.Locales[config.Locale][`${key}s`] || key;
        loadoutGrid.append(`
            <label class="check-item">
                <input type="checkbox" name="loadout" value="${key}" checked>
                ${label}
            </label>
        `);
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

function renderLobbyList(lobbies) {
    const container = $('#lobby-list-container');
    container.empty();

    lobbies.forEach((lobby, index) => {
        const mapImg = `https://via.placeholder.com/140x80/0f1419/ffffff?text=${lobby.mapLabel}`;
        const item = `
            <div class="lobby-item" style="animation-delay: ${index * 0.05}s">
                <div class="lobby-map-preview">
                    <img src="${mapImg}" alt="${lobby.mapLabel}">
                </div>
                <div class="lobby-info-main">
                    <div class="match-type">${lobby.mode.toUpperCase()}</div>
                    <div class="lobby-name-row">${lobby.name}</div>
                    <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} • ${lobby.hostName}</div>
                </div>
                <div class="player-count-badge">
                    ${lobby.playerCount} / ${lobby.maxPlayers}
                </div>
                <div class="action-area">
                    <button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')">${serverConfig.Locales[serverConfig.Locale].btn_join}</button>
                </div>
            </div>
        `;
        container.append(item);
    });
}

function joinLobby(lobbyId) {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/joinLobby`, JSON.stringify({ lobbyId }));
}

$('#btn-create-lobby').click(function() {
    playSound('click');
    const selectedLoadouts = [];
    $('input[name="loadout"]:checked').each(function() {
        selectedLoadouts.push($(this).val());
    });

    const settings = {
        name: $('#input-lobby-name').val() || 'FFA MATCH',
        mapId: $('#select-map').val(),
        mode: $('#select-mode').val(),
        loadout: selectedLoadouts,
        roundTime: parseInt($('#input-round-time').val()),
        maxPlayers: parseInt($('#input-max-players').val()),
        vehiclesAllowed: $('#input-vehicles').is(':checked'),
        friendlyFire: $('#input-friendly-fire').is(':checked'),
        respawnTime: parseInt($('#input-respawn-time').val()),
        killLimit: parseInt($('#input-kill-limit').val())
    };

    if (currentLobby && isHost) {
        $.post(`https://${GetParentResourceName()}/updateSettings`, JSON.stringify(settings));
    } else {
        $.post(`https://${GetParentResourceName()}/createLobby`, JSON.stringify(settings));
    }
});

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    $('#lobby-title').text(lobby.name.toUpperCase());
    $('#lobby-waiting-area').show();
    $('#btn-start-game').toggle(asHost);
    $('#btn-close-lobby').toggle(asHost);
    $('#btn-edit-settings').toggle(asHost);

    $('#lobby-info-summary').html(`
        <p><strong>MAP:</strong> ${lobby.mapLabel}</p>
        <p><strong>MODE:</strong> ${lobby.mode.toUpperCase()}</p>
        <p><strong>TIME:</strong> ${lobby.roundTime} MIN</p>
        <p><strong>WEAPONS:</strong> ${lobby.loadout.join(', ').toUpperCase()}</p>
    `);
}

function renderPlayerList(players) {
    const list = $('#player-list');
    list.empty();
    players.forEach(p => {
        const item = `
            <div class="player-item ${p.ready ? 'ready' : ''}">
                <div class="p-info">
                    <div class="p-name">${p.name} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}</div>
                    <div class="p-team" style="font-size: 10px; color: #888;">${p.team.toUpperCase()}</div>
                </div>
                <div class="p-actions">
                    ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
                </div>
            </div>
        `;
        list.append(item);
    });

    if (isHost) {
        $('#btn-start-game').prop('disabled', players.length < 2 && !currentLobby.isPersistent);
    }
}

function kickPlayer(id) {
    $.post(`https://${GetParentResourceName()}/kickPlayer`, JSON.stringify({ id }));
}

$('#btn-ready-toggle').click(function() {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/toggleReady`);
});

$('#btn-start-game').click(function() {
    playSound('start');
    $.post(`https://${GetParentResourceName()}/startGame`);
});

$('#btn-leave-lobby').click(function() {
    playSound('click');
    $('#lobby-waiting-area').hide();
    $.post(`https://${GetParentResourceName()}/leaveLobby`);
});

$('#btn-close-lobby').click(function() {
    playSound('click');
    $('#lobby-waiting-area').hide();
    $.post(`https://${GetParentResourceName()}/closeLobby`);
});

$('#btn-edit-settings').click(function() {
    playSound('click');
    $('#lobby-waiting-area').hide();
    $('.tab-btn[data-tab="create"]').click();
});

$('.team-btn').click(function() {
    playSound('click');
    $('.team-btn').removeClass('active');
    $(this).addClass('active');
    $.post(`https://${GetParentResourceName()}/setTeam`, JSON.stringify({ team: $(this).data('team') }));
});

// Chat Logic
$('#btn-send-chat').click(sendChatMessage);
$('#chat-input').keypress(function(e) {
    if (e.which === 13) sendChatMessage();
});

function sendChatMessage() {
    const msg = $('#chat-input').val().trim();
    if (msg) {
        $.post(`https://${GetParentResourceName()}/sendLobbyChat`, JSON.stringify({ message: msg }));
        $('#chat-input').val('');
    }
}

function addChatMessage(name, message) {
    const chat = $('#chat-messages');
    chat.append(`<div><strong>${name}:</strong> ${message}</div>`);
    chat.scrollTop(chat[0].scrollHeight);
}

// HUD functions
function updateHUD(data) {
    if (data.time) $('#hud-timer').text(data.time);
    if (data.kills !== undefined) $('#hud-kills').text(data.kills);
    if (data.deaths !== undefined) $('#hud-deaths').text(data.deaths);
    if (data.scoreBlue !== undefined) $('#hud-score-blue').text(data.scoreBlue);
    if (data.scoreRed !== undefined) $('#hud-score-red').text(data.scoreRed);
}

function updateHUDDetails(data) {
    $('#hud-health-val').text(data.health);
    $('#hud-health-fill').css('width', `${data.health}%`);
    $('#hud-armor-val').text(data.armor);
    $('#hud-armor-fill').css('width', `${data.armor}%`);
    $('#hud-ammo').text(data.ammo);
}

function handleCountdown(seconds) {
    if (seconds > 0) {
        $('#hud-countdown').show();
        $('.count-num').text(seconds);
    } else {
        $('#hud-countdown').hide();
    }
}

function showWinnerScreen(data) {
    playSound('win');
    $('#winner-screen').show();
    $('#winner-name').html(`${data.winnerName} <span id="l-winner_suffix">${serverConfig.Locales[serverConfig.Locale].winner_suffix}</span>`);

    const tbody = $('#match-stats-table tbody');
    tbody.empty();
    data.stats.forEach(s => {
        tbody.append(`
            <tr>
                <td>${s.name}</td>
                <td>${s.kills}</td>
                <td>${s.deaths}</td>
                <td>${s.kd}</td>
            </tr>
        `);
    });

    // Map Voting
    const voteGrid = $('#map-vote-grid');
    voteGrid.empty();
    serverMaps.slice(0, 3).forEach(map => {
        voteGrid.append(`<div class="vote-item" onclick="voteMap('${map.id}', this)">${map.label}</div>`);
    });
}

function voteMap(mapId, el) {
    playSound('click');
    $('.vote-item').removeClass('voted');
    $(el).addClass('voted');
    $.post(`https://${GetParentResourceName()}/voteMap`, JSON.stringify({ mapId }));
}

$('#btn-back-to-lobby').click(function() {
    playSound('click');
    $('#winner-screen').hide();
    $('#lobby-waiting-area').show();
    $.post(`https://${GetParentResourceName()}/closeWinnerScreen`);
});

$('#btn-back-to-menu').click(function() {
    playSound('click');
    $('#winner-screen').hide();
    $.post(`https://${GetParentResourceName()}/leaveLobby`);
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        $.post(`https://${GetParentResourceName()}/closeUI`);
    }
});

// Auto-Refresh
setInterval(() => {
    if ($('#app').is(':visible') && !$('#lobby-waiting-area').is(':visible') && !$('#winner-screen').is(':visible') && currentTab !== 'create') {
        fetchLobbies();
    }
}, 5000);
