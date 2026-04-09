let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let locales = {};

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
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'gameStarting':
            $('#app').fadeOut(300);
            $('#lobby-waiting-area').hide();
            break;
        case 'showHUD':
            $('#game-hud').fadeIn(500);
            $('#hud-tdm-scores').toggle(data.mode === 'tdm');
            break;
        case 'hideHUD':
            $('#game-hud').fadeOut(500);
            break;
        case 'updateHUD':
            updateHUD(data);
            break;
        case 'updateHUDDetails':
            updateHUDDetails(data);
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'countdown':
            showCountdown(data.seconds);
            break;
    }
});

function setupInitialData(config, maps) {
    locales = config.Locales[config.Locale];
    setLocales();

    // Map Selects (Filter & Create)
    const mapFilter = $('#filter-maps');
    const mapSelect = $('#map-select');
    mapFilter.find('option:not([value="all"])').remove();
    mapSelect.empty();

    maps.forEach(map => {
        mapFilter.append(`<option value="${map.id}">${map.label.toUpperCase()}</option>`);
        mapSelect.append(`<option value="${map.id}">${map.label.toUpperCase()}</option>`);
    });

    // Multi-Select Loadouts
    const loadoutGrid = $('#loadout-checkboxes');
    loadoutGrid.empty();
    for (let key in config.WeaponLoadouts) {
        loadoutGrid.append(`
            <label class="checkbox-item">
                <input type="checkbox" name="loadout" value="${key}">
                ${key.toUpperCase()}
            </label>
        `);
    }

    // Default values from config
    $('#round-time').val(config.DefaultSettings.roundTime);
    $('#round-time-val').text(config.DefaultSettings.roundTime);
    $('#max-players').val(config.DefaultSettings.maxPlayers);
    $('#max-players-val').text(config.DefaultSettings.maxPlayers);
}

function setLocales() {
    for (let key in locales) {
        $(`.l-${key}`).text(locales[key]);
        $(`#l-${key}`).text(locales[key]);
    }
}

// Tab Switching
$('.tab-btn').click(function() {
    const tab = $(this).data('tab');
    if (tab === currentTab) return;

    playSound('click');
    $('.tab-btn').removeClass('active');
    $(this).addClass('active');

    $('.tab-content').removeClass('active');
    if (tab === 'create') {
        $('#tab-create').addClass('active');
    } else {
        currentTab = tab;
        $('#tab-browser').addClass('active');
        fetchLobbies();
    }
});

// Sidebar Create Button
$('#sidebar-create-btn').click(() => {
    $('.tab-btn[data-tab="create"]').click();
});

// Slider Sync
$('input[type="range"]').on('input', function() {
    $(`#${this.id}-val`).text(this.value);
});

function fetchLobbies() {
    $.post(`https://${GetParentResourceName()}/fetchLobbies`, JSON.stringify({
        tab: currentTab,
        map: $('#filter-maps').val(),
        notFull: $('#filter-players').val() === 'not-full'
    }));
}

// Filter Listeners
$('#filter-maps, #filter-players').change(() => fetchLobbies());

function renderLobbyList(lobbies) {
    const container = $('#lobby-list-container');
    container.empty();

    if (lobbies.length === 0) {
        container.append('<div class="no-lobbies">NO ACTIVE LOBBIES FOUND</div>');
        return;
    }

    lobbies.forEach(lobby => {
        const item = `
            <div class="lobby-item">
                <div class="lobby-info-main">
                    <div class="match-type">${lobby.mode === 'tdm' ? locales['tdm_mode'] : locales['ffa_mode']}</div>
                    <div class="lobby-name-row">${lobby.name}</div>
                    <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel}</div>
                </div>
                <div class="player-stat">
                    <span class="stat-val">${lobby.playerCount}/${lobby.maxPlayers}</span>
                    <span class="stat-lbl l-tab_list">${locales['tab_list']}</span>
                </div>
                <div class="action-area">
                    ${renderActionButton(lobby)}
                </div>
            </div>
        `;
        container.append(item);
    });
}

function renderActionButton(lobby) {
    if (lobby.playerCount >= lobby.maxPlayers) {
        return `<button class="action-btn btn-disabled" disabled>${locales['btn_join']}</button>`;
    }
    if (lobby.status === 'ACTIVE') {
        return `<button class="action-btn btn-spectate" onclick="joinLobby('${lobby.id}', true)">${locales['btn_spectate']}</button>`;
    }
    return `<button class="action-btn" onclick="joinLobby('${lobby.id}')">${locales['btn_join']}</button>`;
}

function joinLobby(lobbyId, isSpectator = false) {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/joinLobby`, JSON.stringify({ lobbyId, isSpectator }));
}

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    $('#lobby-title').text(lobby.name.toUpperCase());
    $('#lobby-waiting-area').fadeIn(300);
    $('#btn-start-game').toggle(asHost);

    $('#lobby-info-summary').html(`
        <p>${locales['map_select']}: ${lobby.mapLabel}</p>
        <p>${locales['mode_select']}: ${lobby.mode.toUpperCase()}</p>
        <p>${locales['round_time']}: ${lobby.roundTime} MIN</p>
    `);

    $('#chat-messages').empty();
}

// Create Lobby Submit
$('#btn-create-lobby').click(() => {
    const selectedLoadouts = [];
    $('input[name="loadout"]:checked').each(function() {
        selectedLoadouts.push($(this).val());
    });

    const settings = {
        name: $('#lobby-name').val() || 'FFA MATCH',
        mapId: $('#map-select').val(),
        mode: $('#mode-select').val(),
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : ['all'],
        roundTime: parseInt($('#round-time').val()),
        maxPlayers: parseInt($('#max-players').val()),
        respawnTime: parseInt($('#respawn-time').val()),
        killLimit: parseInt($('#kill-limit').val()),
        vehiclesAllowed: $('#vehicles-allowed').is(':checked'),
        friendlyFire: $('#friendly-fire').is(':checked')
    };

    playSound('click');
    $.post(`https://${GetParentResourceName()}/createLobby`, JSON.stringify(settings));
});

$('#btn-cancel-create').click(() => {
    playSound('click');
    $('.tab-btn[data-tab="ffa"]').click();
});

function renderPlayerList(players) {
    const list = $('#player-list');
    list.empty();
    players.forEach(p => {
        list.append(`
            <div class="player-item ${p.ready ? 'ready' : ''}">
                <span>${p.name} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}</span>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 10px; color: #888;">${p.team.toUpperCase()}</span>
                    ${isHost && !p.isHost ? `<i class="fa-solid fa-user-minus" style="cursor: pointer; color: #ff4444;" onclick="kickPlayer('${p.id}')"></i>` : ''}
                </div>
            </div>
        `);
    });

    if (isHost) {
        $('#btn-start-game').prop('disabled', players.length < 2);
    }
}

function kickPlayer(id) {
    $.post(`https://${GetParentResourceName()}/kickPlayer`, JSON.stringify({ id }));
}

// Team Selection
$('.team-btn').click(function() {
    playSound('click');
    $('.team-btn').removeClass('active');
    $(this).addClass('active');
    $.post(`https://${GetParentResourceName()}/setTeam`, JSON.stringify({ team: $(this).data('team') }));
});

// Lobby Actions
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
    $('#lobby-waiting-area').hide();
    $.post(`https://${GetParentResourceName()}/leaveLobby`);
});

// Chat
$('#chat-input').keypress((e) => {
    if (e.key === 'Enter') {
        const msg = $('#chat-input').val();
        if (msg.trim().length > 0) {
            $.post(`https://${GetParentResourceName()}/sendLobbyChat`, JSON.stringify({ message: msg }));
            $('#chat-input').val('');
        }
    }
});

function addChatMessage(name, message) {
    $('#chat-messages').append(`
        <div class="chat-msg">
            <span class="chat-name">${name}:</span>
            <span class="chat-text">${message}</span>
        </div>
    `);
    $('#chat-messages').scrollTop($('#chat-messages')[0].scrollHeight);
}

// HUD Updates
function updateHUD(data) {
    if (data.time) $('#hud-time').text(data.time);
    if (data.kills !== undefined) $('#hud-kills').text(data.kills);
    if (data.deaths !== undefined) $('#hud-deaths').text(data.deaths);
    if (data.scoreBlue !== undefined) $('#score-blue').text(data.scoreBlue);
    if (data.scoreRed !== undefined) $('#score-red').text(data.scoreRed);
}

function updateHUDDetails(data) {
    $('#health-bar').css('width', data.health + '%');
    $('#armor-bar').css('width', data.armor + '%');
    $('#hud-ammo').text(data.ammo);
}

function showCountdown(seconds) {
    // Optional: Visual countdown overlay
}

// Winner Screen & Map Vote
function showWinnerScreen(data) {
    playSound('win');
    $('#winner-name').html(`${data.winnerName.toUpperCase()} <span class="l-winner_suffix">${locales['winner_suffix']}</span>`);

    let statsHtml = `<table><thead><tr><th>${locales['kills']}</th><th>${locales['deaths']}</th><th>${locales['kd_ratio']}</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        statsHtml += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    statsHtml += `</tbody></table>`;
    $('#match-stats-table').html(statsHtml);

    // Map Voting Options
    const voteGrid = $('#map-vote-options');
    voteGrid.empty();
    data.voteMaps.forEach(map => {
        voteGrid.append(`
            <div class="vote-item" onclick="voteMap('${map.id}')">
                <img src="https://via.placeholder.com/150x80/222/fff?text=${map.label}" alt="${map.label}">
                <span>${map.label}</span>
                <div class="vote-count" id="vote-${map.id}">0</div>
            </div>
        `);
    });

    $('#winner-screen').fadeIn(500);
}

function voteMap(mapId) {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/voteMap`, JSON.stringify({ mapId }));
}

$('#btn-back-to-menu').click(() => {
    playSound('click');
    $('#winner-screen').fadeOut(300);
    $.post(`https://${GetParentResourceName()}/leaveLobby`);
});

// Close UI on Escape
$(document).keyup((e) => {
    if (e.key === "Escape") {
        $.post(`https://${GetParentResourceName()}/closeUI`);
    }
});

// Auto-Refresh Lobbies
setInterval(() => {
    if ($('#app').is(':visible') && !$('#lobby-waiting-area').is(':visible') && !$('#winner-screen').is(':visible')) {
        fetchLobbies();
    }
}, 5000);
