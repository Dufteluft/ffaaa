let currentTab = 'ffa';
let config = {};
let maps = [];
let myLobby = null;
let isHost = false;
let currentWinnerData = null;
let currentLobbyList = [];

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

$(document).ready(function() {
    // Tab Switching
    $('.tab-btn').on('click', function() {
        let tab = $(this).data('tab');
        if (tab === currentTab) return;

        playSound('click');
        $('.tab-btn').removeClass('active');
        $(this).addClass('active');
        currentTab = tab;

        if (tab === 'create') {
            $('#lobby-browser-tab').hide();
            $('#create-lobby-tab').show();
            $('#filter-bar').hide();
        } else {
            $('#create-lobby-tab').hide();
            $('#lobby-browser-tab').show();
            $('#filter-bar').toggle(tab === 'list');
            fetchLobbies();
        }
    });

    // Slider Sync
    const syncSlider = (id) => {
        $(`#${id}`).on('input', function() {
            $(`#${id}-val`).text($(this).val());
        });
    };
    syncSlider('c-round-time');
    syncSlider('c-max-players');
    syncSlider('c-respawn-time');
    syncSlider('c-kill-limit');

    // Create Lobby
    $('#btn-create-lobby-final').on('click', function() {
        playSound('click');
        let selectedLoadouts = [];
        $('#c-loadout-grid input:checked').each(function() {
            selectedLoadouts.push($(this).val());
        });

        if (selectedLoadouts.length === 0) selectedLoadouts.push('all');

        const data = {
            name: $('#c-lobby-name').val() || "LOBBY " + Math.floor(Math.random() * 1000),
            mapId: $('#c-map-select').val(),
            mode: $('#c-mode-select').val(),
            loadout: selectedLoadouts,
            roundTime: parseInt($('#c-round-time').val()),
            maxPlayers: parseInt($('#c-max-players').val()),
            respawnTime: parseInt($('#c-respawn-time').val()),
            killLimit: parseInt($('#c-kill-limit').val()),
            vehiclesAllowed: $('#c-vehicles-allowed').is(':checked'),
            friendlyFire: $('#c-friendly-fire').is(':checked')
        };

        $.post(`https://${GetParentResourceName()}/createLobby`, JSON.stringify(data));
    });

    $('#btn-cancel-create').on('click', function() {
        playSound('click');
        $('.tab-btn[data-tab="ffa"]').trigger('click');
    });

    // Lobby Actions
    $('#w-btn-ready').on('click', () => { playSound('click'); $.post(`https://${GetParentResourceName()}/toggleReady`); });
    $('#w-btn-start').on('click', () => { playSound('start'); $.post(`https://${GetParentResourceName()}/startGame`); });
    $('#w-btn-leave').on('click', () => { playSound('click'); $.post(`https://${GetParentResourceName()}/leaveLobby`); hideWaitingArea(); });
    $('#w-btn-close').on('click', () => { playSound('click'); $.post(`https://${GetParentResourceName()}/closeLobby`); });

    $('.team-btn').on('click', function() {
        playSound('click');
        $('.team-btn').removeClass('active');
        $(this).addClass('active');
        $.post(`https://${GetParentResourceName()}/setTeam`, JSON.stringify({ team: $(this).data('team') }));
    });

    $('#w-send-chat').on('click', sendChat);
    $('#w-chat-input').on('keypress', (e) => { if(e.key === 'Enter') sendChat(); });

    // Winner Screen Actions
    $('#btn-winner-stay').on('click', function() {
        playSound('click');
        $('#winner-screen').hide();
        $('#lobby-waiting-area').show();
        $.post(`https://${GetParentResourceName()}/closeWinnerScreen`);
    });

    $('#btn-winner-exit').on('click', function() {
        playSound('click');
        $('#winner-screen').hide();
        $('#app').show();
        $.post(`https://${GetParentResourceName()}/leaveLobby`);
    });

    // Listeners for Filters
    $('#filter-maps, #filter-players').on('change', fetchLobbies);
});

function sendChat() {
    let msg = $('#w-chat-input').val();
    if (msg.trim().length > 0) {
        $.post(`https://${GetParentResourceName()}/sendLobbyChat`, JSON.stringify({ message: msg }));
        $('#w-chat-input').val('');
    }
}

function fetchLobbies() {
    $.post(`https://${GetParentResourceName()}/fetchLobbies`, JSON.stringify({
        tab: currentTab,
        map: $('#filter-maps').val(),
        full: $('#filter-players').val() === 'free'
    }));
}

// Message Listener
window.addEventListener('message', function(event) {
    const data = event.data;

    switch(data.action) {
        case 'open':
            $('#app').fadeIn(300).css('display', 'flex');
            if (data.config && data.maps) setupInitialData(data.config, data.maps);
            fetchLobbies();
            break;
        case 'close':
            $('#app').fadeOut(300).hide();
            break;
        case 'updateLobbies':
            renderLobbies(data.lobbies);
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            showWaitingArea(data.lobby, data.action === 'lobbyCreated');
            break;
        case 'updateLobbyPlayers':
            renderPlayers(data.players);
            break;
        case 'addChatMessage':
            addChat(data.name, data.message);
            break;
        case 'gameStarting':
            $('#app').hide();
            $('#lobby-waiting-area').hide();
            break;
        case 'showHUD':
            $('#hud').show();
            if (data.isPersistent) $('#h-timer').text("--:--");
            break;
        case 'hideHUD':
            $('#hud').hide();
            break;
        case 'updateHUD':
            updateHUD(data);
            break;
        case 'updateHUDDetails':
            $('#h-health-fill').css('width', data.health + '%');
            $('#h-armor-fill').css('width', data.armor + '%');
            $('#h-ammo').text(data.ammo);
            break;
        case 'countdown':
            showCountdown(data.seconds);
            break;
        case 'showWinner':
            showWinner(data);
            break;
        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function setupInitialData(cfg, mp) {
    config = cfg;
    maps = mp;

    // Localize static keys
    for (let key in cfg.Locales[cfg.Locale]) {
        $(`.l-${key}`).text(cfg.Locales[cfg.Locale][key]);
    }

    // Populate Selects
    const mapOpts = mp.map(m => `<option value="${m.id}">${m.label}</option>`).join('');
    $('#c-map-select').html(mapOpts);
    $('#filter-maps').html('<option value="all">Alle Maps</option>' + mapOpts);

    // Populate Loadout Grid
    let loadoutHtml = '';
    for (let key in cfg.WeaponLoadouts) {
        loadoutHtml += `
            <label class="checkbox-item">
                <input type="checkbox" value="${key}">
                <span>${cfg.WeaponLoadouts[key].label}</span>
            </label>
        `;
    }
    $('#c-loadout-grid').html(loadoutHtml);
}

function renderLobbies(lobbies) {
    currentLobbyList = lobbies;
    let html = '';
    lobbies.forEach(l => {
        html += `
            <div class="lobby-item">
                <div class="lobby-info-header">
                    <span class="lobby-name">${l.name}</span>
                    <span class="lobby-mode-badge">${l.mode.toUpperCase()}</span>
                </div>
                <div class="lobby-details">
                    <div><i class="fa-solid fa-map"></i> ${l.mapLabel}</div>
                    <div><i class="fa-solid fa-user-tie"></i> Host: ${l.hostName}</div>
                </div>
                <div class="lobby-footer">
                    <span class="player-pill">${l.playerCount} / ${l.maxPlayers}</span>
                    <button class="btn-join" onclick="joinLobby('${l.id}', ${l.isPersistent})">
                        ${l.isPersistent ? 'BEITRETEN' : (l.status === 'ACTIVE' ? 'SPECTATE' : 'BEITRETEN')}
                    </button>
                </div>
            </div>
        `;
    });
    $('#lobby-list-container').html(html);
}

function joinLobby(id, persistent) {
    playSound('click');
    if (persistent) {
        const lobby = currentLobbyList.find(x => x.id == id);
        if (lobby) $.post(`https://${GetParentResourceName()}/quickJoin`, JSON.stringify({ mapId: lobby.mapId }));
    } else {
        $.post(`https://${GetParentResourceName()}/joinLobby`, JSON.stringify({ lobbyId: id }));
    }
}

function showWaitingArea(lobby, host) {
    myLobby = lobby;
    isHost = host;
    playSound('join');
    $('#w-lobby-title').text(lobby.name.toUpperCase());
    $('#w-lobby-id').text(lobby.id);
    $('#lobby-waiting-area').fadeIn(300).css('display', 'flex');

    $('#w-btn-start').toggle(host);
    $('#w-btn-close').toggle(host);

    // Summary
    $('#w-settings-summary').html(`
        <div style="font-size: 13px; color: var(--text-muted);">
            Map: ${lobby.mapLabel} | Modus: ${lobby.mode.toUpperCase()} | Time: ${lobby.roundTime}m
        </div>
    `);
}

function hideWaitingArea() {
    $('#lobby-waiting-area').hide();
    myLobby = null;
}

function renderPlayers(players) {
    let html = '';
    players.forEach(p => {
        html += `
            <div class="player-item ${p.ready ? 'ready' : ''} ${p.isHost ? 'host' : ''}">
                <span>${p.name} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left:5px;"></i>' : ''}</span>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size: 10px; opacity: 0.7;">${p.team.toUpperCase()}</span>
                    ${isHost && !p.isHost ? `<button onclick="kickPlayer('${p.id}')" style="background:none; border:none; color:var(--danger); cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>` : ''}
                </div>
            </div>
        `;
    });
    $('#w-player-list').html(html);

    if (isHost) {
        $('#w-btn-start').prop('disabled', players.length < 2);
    }
}

function kickPlayer(id) {
    $.post(`https://${GetParentResourceName()}/kickPlayer`, JSON.stringify({ id: id }));
}

function addChat(name, msg) {
    $('#w-chat-messages').append(`<div><b style="color:var(--primary)">${name}:</b> ${msg}</div>`);
    $('#w-chat-messages').scrollTop($('#w-chat-messages')[0].scrollHeight);
}

function updateHUD(data) {
    if (data.time) $('#h-timer').text(data.time);
    if (data.kills !== undefined) $('#h-kills').text(data.kills);
    if (data.deaths !== undefined) $('#h-deaths').text(data.deaths);

    if (data.mode === 'tdm') {
        $('#h-tdm-score').show();
        if (data.scoreBlue !== undefined) $('#h-score-blue').text(data.scoreBlue);
        if (data.scoreRed !== undefined) $('#h-score-red').text(data.scoreRed);
    } else {
        $('#h-tdm-score').hide();
    }
}

function showCountdown(sec) {
    if (sec <= 0) {
        $('#hud-countdown').fadeOut(300);
        return;
    }
    $('#hud-countdown').show().css('display', 'flex');
    $('.countdown-number').text(sec);
}

function showWinner(data) {
    playSound('win');
    currentWinnerData = data;
    $('#winner-announcement').html(`${data.winnerName} <span class="l-winner_suffix">${config.Locales[config.Locale]['winner_suffix']}</span>`);

    let html = '';
    data.stats.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    $('#winner-stats-table tbody').html(html);

    // Map Voting
    let voteHtml = '';
    maps.slice(0, 3).forEach(m => {
        voteHtml += `<div class="vote-item" onclick="voteMap('${m.id}')">${m.label}</div>`;
    });
    $('#vote-map-grid').html(voteHtml);

    $('#app').hide();
    $('#winner-screen').fadeIn(500).css('display', 'flex');
}

function voteMap(id) {
    $('.vote-item').removeClass('active');
    $(`.vote-item:contains('${maps.find(x => x.id == id).label}')`).addClass('active');
    $.post(`https://${GetParentResourceName()}/voteMap`, JSON.stringify({ mapId: id }));
}

// Auto-Refresh Open Lobbies
setInterval(() => {
    if ($('#app').is(':visible') && currentTab === 'list' && !$('#lobby-waiting-area').is(':visible')) {
        fetchLobbies();
    }
}, 5000);

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        $.post(`https://${GetParentResourceName()}/closeUI`);
    }
});
