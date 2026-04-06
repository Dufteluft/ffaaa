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

// Tab Switching
$('.tab-btn').on('click', function() {
    const tab = $(this).data('tab');
    if (tab === currentTab) return;

    playSound('click');
    $('.tab-btn').removeClass('active');
    $(this).addClass('active');

    $('.tab-content').removeClass('active');

    if (tab === 'create') {
        $('#lobby-creation').addClass('active');
        $('#filter-sidebar').fadeOut(200);
    } else {
        $('#lobby-browser').addClass('active');
        $('#filter-sidebar').fadeIn(200);
        currentTab = tab;
        fetchLobbies();
    }
});

// Slider Value Sync
const bindSlider = (id) => {
    $(`#${id}`).on('input', function() {
        $(`#${id}-val`).text($(this).val());
    });
};
['round-time', 'max-players', 'respawn-time', 'kill-limit'].forEach(bindSlider);

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
            $('#app').hide();
            $('#lobby-waiting-area').hide();
            break;
        case 'showHUD':
            $('#game-hud').fadeIn(500);
            break;
        case 'hideHUD':
            $('#game-hud').fadeOut(500);
            break;
        case 'updateHUDDetails':
            $('#health-bar').css('width', data.health + '%');
            $('#armor-bar').css('width', data.armor + '%');
            $('#hud-ammo').text(data.ammo);
            break;
        case 'updateHUD':
            if (data.time) $('#hud-timer').text(data.time);
            if (data.kills !== undefined) $('#hud-kills').text(data.kills);
            if (data.deaths !== undefined) $('#hud-deaths').text(data.deaths);
            if (data.mode === 'tdm') {
                $('#hud-team-scores').show();
                $('#score-blue').text(data.scoreBlue || 0);
                $('#score-red').text(data.scoreRed || 0);
            } else {
                $('#hud-team-scores').hide();
            }
            break;
        case 'countdown':
            // Logic for countdown sound or visual
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'updateVotes':
            updateMapVotes(data.voteCounts);
            break;
        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Map Selects
    const $mapSelect = $('#map-select');
    const $filterMaps = $('#filter-maps');
    $mapSelect.empty();
    $filterMaps.find('option:not([value="all"])').remove();

    maps.forEach(map => {
        $mapSelect.append(`<option value="${map.id}">${map.label.toUpperCase()}</option>`);
        $filterMaps.append(`<option value="${map.id}">${map.label.toUpperCase()}</option>`);
    });

    // Loadout Grid (Checkboxes)
    const $loadoutGrid = $('#loadout-grid');
    $loadoutGrid.empty();
    for (let key in config.WeaponLoadouts) {
        $loadoutGrid.append(`
            <label class="loadout-item">
                <input type="checkbox" name="loadout" value="${key}">
                ${key.toUpperCase()}
            </label>
        `);
    }

    setLocales(config.Locale);
}

function setLocales(lang) {
    const locales = serverConfig.Locales[lang];
    if (!locales) return;

    $('[id^="l-"], .l-').each(function() {
        const id = $(this).attr('id') || $(this).attr('class').split(' ').find(c => c.startsWith('l-'));
        const key = id.replace('l-', '');
        if (locales[key]) {
            $(this).html(locales[key]);
        }
    });
}

function fetchLobbies() {
    $.post(`https://${GetParentResourceName()}/fetchLobbies`, JSON.stringify({ tab: currentTab }));
}

function renderLobbyList(lobbies) {
    const $container = $('#lobby-list-container');
    $container.empty();

    lobbies.forEach((lobby, index) => {
        const playerCount = lobby.playerCount || 0;
        const maxPlayers = lobby.maxPlayers || 16;
        const status = (lobby.status || 'waiting').toUpperCase();
        const mapImg = `assets/${lobby.mapId}.png`;

        const html = `
            <div class="lobby-item" style="animation: slideIn 0.3s forwards ${index * 0.05}s; opacity: 0;">
                <div class="lobby-map-preview">
                    <img src="${mapImg}" onerror="this.src='https://via.placeholder.com/140x80/222/fff?text=${lobby.mapLabel}'">
                </div>
                <div class="lobby-info-main">
                    <div class="match-type">${lobby.name.toUpperCase()}</div>
                    <div class="map-name-row">
                        <i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} | ${lobby.mode.toUpperCase()}
                    </div>
                </div>
                <div class="lobby-info-stats">
                    <div class="match-type">${playerCount}/${maxPlayers}</div>
                    <div class="map-name-row">${serverConfig.Locales[serverConfig.Locale]['max_players']}</div>
                </div>
                <div class="status-badge status-${status.toLowerCase()}">${status}</div>
                <div class="action-area">
                    ${renderActionButton(lobby)}
                </div>
            </div>
        `;
        $container.append(html);
    });
}

function renderActionButton(lobby) {
    const loc = serverConfig.Locales[serverConfig.Locale];
    if (lobby.playerCount >= lobby.maxPlayers) {
        return `<button class="action-btn btn-disabled" disabled>FULL</button>`;
    }
    if (lobby.status === 'ACTIVE') {
        return `<button class="action-btn btn-spectate" onclick="joinLobby('${lobby.id}')">${loc['spectate'] || 'SPECTATE'}</button>`;
    }
    return `<button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')">${loc['btn_join']}</button>`;
}

window.joinLobby = function(lobbyId) {
    if (currentTab === 'ffa') {
        // Quick join for Tab 1
        const lobby = serverMaps.find(m => "FFA " + m.label === lobbyId || m.id === lobbyId); // Simplified
        $.post(`https://${GetParentResourceName()}/quickJoin`, JSON.stringify({ mapId: lobbyId }));
    } else {
        $.post(`https://${GetParentResourceName()}/joinLobby`, JSON.stringify({ lobbyId }));
    }
};

$('#btn-create-lobby').on('click', function() {
    playSound('click');
    const loadouts = [];
    $('input[name="loadout"]:checked').each(function() {
        loadouts.push($(this).val());
    });

    if (loadouts.length === 0) {
        // Validation: at least one loadout
        return;
    }

    const settings = {
        name: $('#lobby-name').val() || 'CUSTOM LOBBY',
        mapId: $('#map-select').val(),
        mode: $('#mode-select').val(),
        loadout: loadouts,
        roundTime: parseInt($('#round-time').val()),
        maxPlayers: parseInt($('#max-players').val()),
        respawnTime: parseInt($('#respawn-time').val()),
        killLimit: parseInt($('#kill-limit').val()),
        vehiclesAllowed: $('#vehicles-allowed').is(':checked'),
        friendlyFire: $('#friendly-fire').is(':checked')
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

    $('#lobby-info-summary').html(`
        <p>MAP: ${lobby.mapLabel}</p>
        <p>MODE: ${lobby.mode.toUpperCase()}</p>
        <p>TIME: ${lobby.roundTime} MIN</p>
    `);
}

function renderPlayerList(players) {
    const $list = $('#player-list');
    $list.empty();
    players.forEach(p => {
        $list.append(`
            <div class="player-item ${p.ready ? 'ready' : ''}">
                <span>${p.name.toUpperCase()} ${p.isHost ? '(HOST)' : ''}</span>
                <span>${p.team.toUpperCase()}</span>
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
            </div>
        `);
    });

    if (isHost) {
        $('#btn-start-game').prop('disabled', players.length < 2);
    }
}

window.kickPlayer = function(id) {
    $.post(`https://${GetParentResourceName()}/kickPlayer`, JSON.stringify({ id }));
};

$('#btn-ready-toggle').on('click', () => {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/toggleReady`);
});

$('#btn-start-game').on('click', () => {
    playSound('start');
    $.post(`https://${GetParentResourceName()}/startGame`);
});

$('#btn-leave-lobby').on('click', () => {
    playSound('click');
    $('#lobby-waiting-area').hide();
    $.post(`https://${GetParentResourceName()}/leaveLobby`);
});

$('.team-btn').on('click', function() {
    playSound('click');
    $('.team-btn').removeClass('active');
    $(this).addClass('active');
    $.post(`https://${GetParentResourceName()}/setTeam`, JSON.stringify({ team: $(this).data('team') }));
});

$('#btn-send-chat').on('click', sendChat);
$('#chat-input').on('keypress', (e) => { if (e.key === 'Enter') sendChat(); });

function sendChat() {
    const msg = $('#chat-input').val();
    if (msg.trim().length > 0) {
        $.post(`https://${GetParentResourceName()}/sendLobbyChat`, JSON.stringify({ message: msg }));
        $('#chat-input').val('');
    }
}

function showWinnerScreen(data) {
    playSound('win');
    $('#winner-screen').fadeIn(500);
    $('#winner-name').text(data.winnerName.toUpperCase());

    const $table = $('#match-stats-table');
    let html = `<table style="width:100%; border-collapse: collapse; margin-top: 20px;">
        <thead><tr style="border-bottom: 2px solid var(--border); text-align: left;">
        <th style="padding: 10px;">NAME</th><th style="padding: 10px;">KILLS</th><th style="padding: 10px;">DEATHS</th><th style="padding: 10px;">K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 10px;">${s.name.toUpperCase()}</td><td style="padding: 10px;">${s.kills}</td><td style="padding: 10px;">${s.deaths}</td><td style="padding: 10px;">${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    $table.html(html);

    // Map Voting
    const $voteGrid = $('#map-vote-grid');
    $voteGrid.empty();
    serverMaps.forEach(map => {
        $voteGrid.append(`
            <div class="map-vote-item" onclick="voteMap('${map.id}')">
                <img src="assets/${map.id}.png" onerror="this.src='https://via.placeholder.com/140x80/222/fff?text=${map.label}'">
                <div>${map.label.toUpperCase()}</div>
                <div class="vote-count" id="vote-count-${map.id}">0</div>
            </div>
        `);
    });
}

window.voteMap = function(mapId) {
    $('.map-vote-item').removeClass('active');
    $(`.map-vote-item[onclick="voteMap('${mapId}')"]`).addClass('active');
    $.post(`https://${GetParentResourceName()}/voteMap`, JSON.stringify({ mapId }));
};

$('#btn-back-to-menu').on('click', () => {
    $('#winner-screen').hide();
    $.post(`https://${GetParentResourceName()}/leaveLobby`);
});

$('#btn-back-to-lobby').on('click', () => {
    $('#winner-screen').hide();
    $('#lobby-waiting-area').show();
    $.post(`https://${GetParentResourceName()}/closeWinnerScreen`);
});

function updateMapVotes(voteCounts) {
    $('.vote-count').text('0');
    for (let mapId in voteCounts) {
        $(`#vote-count-${mapId}`).text(voteCounts[mapId]);
    }
}

$(document).on('keyup', (e) => {
    if (e.key === 'Escape') {
        $.post(`https://${GetParentResourceName()}/closeUI`);
    }
});

// Filter Auto-Refresh
$('#filter-maps, #filter-players').on('change', fetchLobbies);

setInterval(() => {
    if ($('#app').is(':visible') && $('#lobby-waiting-area').is(':hidden') && $('#winner-screen').is(':hidden')) {
        fetchLobbies();
    }
}, 5000);
