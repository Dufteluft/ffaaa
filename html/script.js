let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};
let playerKills = 0;
let playerDeaths = 0;

// Localization Helper
function setLocales(locales) {
    if (!locales) return;
    for (const [key, value] of Object.entries(locales)) {
        $(`.l-${key}`).html(value);
        $(`#l-${key}`).html(value);
    }
}

// Sound Management
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
$('.tab-btn').on('click', function() {
    const tab = $(this).data('tab');
    if (tab === currentTab) return;

    playSound('click');
    $('.tab-btn').removeClass('active');
    $(this).addClass('active');
    currentTab = tab;

    $('.tab-content').removeClass('active');
    if (tab === 'ffa' || tab === 'list') {
        $('#tab-browser').addClass('active');
        fetchLobbies();
    } else if (tab === 'create') {
        $('#tab-create').addClass('active');
    }
});

// Slider Value Updates
function setupSliders() {
    const sliders = ['time', 'players', 'respawn', 'killlimit'];
    sliders.forEach(id => {
        $(`#create-${id}`).on('input', function() {
            $(`#val-${id}`).text($(this).val());
        });
    });
}

// Initial Data Setup
function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;
    setLocales(config.Locales[config.Locale]);

    // Map Selects
    const mapOptions = maps.map(m => `<option value="${m.id}">${m.label.toUpperCase()}</option>`).join('');
    $('#create-map').html(mapOptions);
    $('#filter-maps').html('<option value="all">ALL MAPS</option>' + mapOptions);

    // Multi-select Loadouts
    let loadoutHtml = '';
    for (const [key, data] of Object.entries(config.WeaponLoadouts)) {
        loadoutHtml += `
            <div class="checkbox-item">
                <input type="checkbox" name="loadout" value="${key}" id="loadout-${key}">
                <label for="loadout-${key}">${data.label}</label>
            </div>
        `;
    }
    $('#create-loadout').html(loadoutHtml);
}

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            $('#app').fadeIn(200).css('display', 'flex');
            setupInitialData(data.config, data.maps);
            setupSliders();
            fetchLobbies();
            break;
        case 'close':
            $('#app').fadeOut(200);
            break;
        case 'updateLobbies':
            setLobbies(data.lobbies);
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            currentLobby = data.lobby;
            isHost = (data.action === 'lobbyCreated');
            showLobbyArea(data.lobby);
            break;
        case 'updateLobbyPlayers':
            setPlayers(data.players);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'gameStarting':
            $('#app').hide();
            $('#lobby-waiting-area').hide();
            break;
        case 'showHUD':
            $('#game-hud').fadeIn(300);
            $('#hud-tdm-scores').css('display', data.mode === 'tdm' ? 'flex' : 'none');
            break;
        case 'hideHUD':
            $('#game-hud').fadeOut(300);
            break;
        case 'updateHUDDetails':
            updateHUDDetails(data);
            break;
        case 'updateHUD':
            updateHUDStats(data);
            break;
        case 'countdown':
            handleCountdown(data.seconds);
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
    }
});

// Lobby Creation Submission
$('#btn-create-submit').on('click', function() {
    playSound('click');
    const selectedLoadouts = [];
    $('input[name="loadout"]:checked').each(function() {
        selectedLoadouts.push($(this).val());
    });

    const settings = {
        name: $('#create-name').val() || 'CUSTOM LOBBY',
        mapId: $('#create-map').val(),
        mode: $('#create-mode').val(),
        loadout: selectedLoadouts,
        roundTime: parseInt($('#create-time').val()),
        maxPlayers: parseInt($('#create-players').val()),
        respawnTime: parseInt($('#create-respawn').val()),
        killLimit: parseInt($('#create-killlimit').val()),
        vehiclesAllowed: $('#create-vehicles').is(':checked'),
        friendlyFire: $('#create-friendlyfire').is(':checked')
    };

    if (selectedLoadouts.length === 0) {
        // Fallback or warning
        settings.loadout = ['pistol'];
    }

    $.post(`https://${GetParentResourceName()}/createLobby`, JSON.stringify(settings));
});

$('#btn-create-cancel').on('click', function() {
    playSound('click');
    $('.tab-btn[data-tab="ffa"]').trigger('click');
});

// Lobby Browser Actions
function fetchLobbies() {
    $.post(`https://${GetParentResourceName()}/fetchLobbies`, JSON.stringify({
        tab: currentTab,
        mapId: $('#filter-maps').val(),
        notFull: $('#filter-players').is(':checked')
    }));
}

$('#filter-maps, #filter-players').on('change', fetchLobbies);

function setLobbies(lobbies) {
    const container = $('#lobby-list-container');
    container.empty();

    if (!lobbies || lobbies.length === 0) {
        container.append(`<div class="no-lobbies l-no_lobbies">Keine Lobbys gefunden.</div>`);
        setLocales(serverConfig.Locales[serverConfig.Locale]);
        return;
    }

    lobbies.forEach(l => {
        const item = `
            <div class="lobby-item">
                <div class="lobby-header">
                    <div class="lobby-name">${l.name}</div>
                    <div class="lobby-host">${l.hostName}</div>
                </div>
                <div class="lobby-details">
                    <span>Map: ${l.mapLabel}</span>
                    <span>Modus: ${l.mode.toUpperCase()}</span>
                </div>
                <div class="lobby-footer">
                    <div class="player-count">${l.playerCount}/${l.maxPlayers}</div>
                    <button class="action-btn l-btn_join" onclick="joinLobby('${l.id}')">Beitreten</button>
                </div>
            </div>
        `;
        container.append(item);
    });
    setLocales(serverConfig.Locales[serverConfig.Locale]);
}

window.joinLobby = function(id) {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/joinLobby`, JSON.stringify({ lobbyId: id }));
};

// Lobby Waiting Area Logic
function showLobbyArea(lobby) {
    playSound('join');
    $('#lobby-title').text(lobby.name.toUpperCase());
    $('#lobby-waiting-area').fadeIn(300);
    $('#host-controls').css('display', isHost ? 'block' : 'none');
    $('#btn-start-game').css('display', isHost ? 'block' : 'none');
}

function setPlayers(players) {
    const list = $('#player-list');
    list.empty();

    players.forEach(p => {
        const item = `
            <div class="player-item ${p.ready ? 'ready' : ''}">
                <div class="player-name">${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}</div>
                <div class="player-team team-${p.team}-bg">${p.team.toUpperCase()}</div>
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-user-minus"></i></button>` : ''}
            </div>
        `;
        list.append(item);
    });

    if (isHost) {
        $('#btn-start-game').prop('disabled', players.length < 2);
    }
}

window.kickPlayer = function(id) {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/kickPlayer`, JSON.stringify({ id: id }));
};

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
    $('#lobby-waiting-area').fadeOut(300);
    $.post(`https://${GetParentResourceName()}/leaveLobby`, JSON.stringify({}));
});

$('#btn-close-lobby').on('click', function() {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/closeLobby`, JSON.stringify({}));
});

$('.team-btn').on('click', function() {
    playSound('click');
    $('.team-btn').removeClass('active');
    $(this).addClass('active');
    $.post(`https://${GetParentResourceName()}/setTeam`, JSON.stringify({ team: $(this).data('team') }));
});

// Chat Logic
function addChatMessage(name, message) {
    const msg = `<div class="chat-msg"><span class="chat-sender">${name}:</span> ${message}</div>`;
    const container = $('#chat-messages');
    container.append(msg);
    container.scrollTop(container[0].scrollHeight);
}

$('#chat-input').on('keypress', function(e) {
    if (e.which === 13) {
        const val = $(this).val();
        if (val.trim()) {
            $.post(`https://${GetParentResourceName()}/sendLobbyChat`, JSON.stringify({ message: val }));
            $(this).val('');
        }
    }
});

$('#btn-send-chat').on('click', function() {
    const val = $('#chat-input').val();
    if (val.trim()) {
        $.post(`https://${GetParentResourceName()}/sendLobbyChat`, JSON.stringify({ message: val }));
        $('#chat-input').val('');
    }
});

// HUD Updates
function updateHUDDetails(data) {
    $('#bar-health').css('width', `${data.health}%`);
    $('#bar-armor').css('width', `${data.armor}%`);
    $('#hud-ammo').text(data.ammo);
}

function updateHUDStats(data) {
    if (data.kills !== undefined) {
        if (data.kills > playerKills) playSound('kill');
        playerKills = data.kills;
        $('#hud-kills').text(data.kills);
    }
    if (data.deaths !== undefined) {
        playerDeaths = data.deaths;
        $('#hud-deaths').text(data.deaths);
    }
    if (data.time !== undefined) $('#hud-time').text(data.time);
    if (data.scoreBlue !== undefined) $('.score-blue').text(data.scoreBlue);
    if (data.scoreRed !== undefined) $('.score-red').text(data.scoreRed);
}

function handleCountdown(seconds) {
    if (seconds > 0) {
        $('#hud-countdown').text(seconds).show();
    } else {
        $('#hud-countdown').fadeOut(200);
    }
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    $('#winner-announcement').html(`${data.winnerName.toUpperCase()} <span class="l-winner_suffix">GEWINNT!</span>`);

    const tbody = $('#winner-stats-table tbody');
    tbody.empty();
    data.stats.forEach(s => {
        tbody.append(`<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`);
    });

    const voteGrid = $('#map-voting-grid');
    voteGrid.empty();
    serverMaps.forEach(m => {
        voteGrid.append(`<div class="map-vote-item" onclick="voteMap('${m.id}', this)">${m.label.toUpperCase()}</div>`);
    });

    $('#winner-screen').fadeIn(500);
    setLocales(serverConfig.Locales[serverConfig.Locale]);
}

window.voteMap = function(mapId, el) {
    playSound('click');
    $('.map-vote-item').removeClass('active');
    $(el).addClass('active');
    $.post(`https://${GetParentResourceName()}/voteMap`, JSON.stringify({ mapId: mapId }));
};

$('#btn-winner-back').on('click', function() {
    playSound('click');
    $('#winner-screen').fadeOut(300);
    $('#lobby-waiting-area').fadeIn(300);
    $.post(`https://${GetParentResourceName()}/closeWinnerScreen`, JSON.stringify({}));
});

$('#btn-winner-menu').on('click', function() {
    playSound('click');
    $('#winner-screen').fadeOut(300);
    $.post(`https://${GetParentResourceName()}/leaveLobby`, JSON.stringify({}));
});

// ESC Key Handling
$(document).on('keyup', function(e) {
    if (e.key === "Escape") {
        $.post(`https://${GetParentResourceName()}/closeUI`, JSON.stringify({}));
    }
});

// Auto-Refresh Lobbies
setInterval(() => {
    if ($('#app').is(':visible') && $('#tab-browser').hasClass('active')) {
        fetchLobbies();
    }
}, 5000);
