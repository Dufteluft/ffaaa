ESX = exports['es_extended']:getSharedObject()

Lobbies = {} -- Speichert alle aktiven Lobbys
PlayerStates = {} -- Speichert den Status jedes Spielers

-- Hilfsfunktion für Übersetzungen auf dem Server
function _U(str, ...)
    if Config.Locales[Config.Locale] and Config.Locales[Config.Locale][str] then
        return string.format(Config.Locales[Config.Locale][str], ...)
    else
        return 'Übersetzung nicht gefunden'
    end
end

-- Hilfsfunktion zur Generierung einer eindeutigen 4-stelligen Lobby-ID
function GenerateLobbyId()
    local id
    repeat
        id = tostring(math.random(1000, 9999))
    until not Lobbies[id]
    return id
end

-- Erstellt eine neue Lobby mit den angegebenen Einstellungen
function CreateLobby(playerId, settings)
    local xPlayer = (playerId ~= -1) and ESX.GetPlayerFromId(playerId) or nil
    local lobbyId = GenerateLobbyId()
    local map = Utils.GetMapById(settings.mapId)

    Lobbies[lobbyId] = {
        id = lobbyId,
        name = settings.name,
        host = playerId,
        hostName = xPlayer and xPlayer.getName() or "SYSTEM",
        isPersistent = settings.isPersistent or false,
        mapId = settings.mapId,
        mapLabel = map.label,
        mode = settings.mode or 'ffa',
        loadout = settings.loadout or 'pistol',
        roundTime = settings.roundTime or 15,
        maxPlayers = settings.maxPlayers or 16,
        vehiclesAllowed = settings.vehiclesAllowed or false,
        friendlyFire = settings.friendlyFire or false,
        respawnTime = settings.respawnTime or 5,
        killLimit = settings.killLimit or 30,
        players = {},
        status = 'waiting',
        timer = (settings.roundTime or 15) * 60,
        scoreBlue = 0,
        scoreRed = 0
    }

    -- Falls ein Spieler die Lobby erstellt, tritt er automatisch bei
    if playerId ~= -1 then
        JoinLobby(playerId, lobbyId)
    end
    return lobbyId
end

-- Event zum Erstellen einer Lobby via NUI
RegisterServerEvent('ffa:createLobby')
AddEventHandler('ffa:createLobby', function(settings)
    local lobbyId = CreateLobby(source, settings)
    if lobbyId then
        TriggerClientEvent('ffa:lobbyCreated', source, Lobbies[lobbyId])
    end
end)

-- Behandelt den Beitritt eines Spielers zu einer Lobby
function JoinLobby(playerId, lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return false end
    if #lobby.players >= lobby.maxPlayers then return false end

    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return false end

    -- Falls der Spieler bereits in einer Lobby ist, diese erst verlassen
    if PlayerStates[playerId] and PlayerStates[playerId].lobbyId then
        LeaveLobby(playerId)
    end

    table.insert(lobby.players, playerId)

    local ped = GetPlayerPed(playerId)
    PlayerStates[playerId] = {
        lobbyId = lobbyId,
        team = 'none',
        ready = (playerId == lobby.host or lobby.isPersistent),
        kills = 0,
        deaths = 0,
        name = xPlayer.getName(),
        oldCoords = GetEntityCoords(ped),
        oldBucket = GetPlayerRoutingBucket(playerId)
    }

    -- Spieler in einen eigenen Routing-Bucket setzen für Instanziierung
    SetPlayerRoutingBucket(playerId, tonumber(lobbyId))

    UpdateLobbyPlayers(lobbyId)
    return true
end

-- NUI-Event zum Beitreten einer Lobby
RegisterServerEvent('ffa:joinLobby')
AddEventHandler('ffa:joinLobby', function(data)
    local lobbyId = data.lobbyId
    if JoinLobby(source, lobbyId) then
        TriggerClientEvent('ffa:lobbyJoined', source, Lobbies[lobbyId])

        -- In persistenten Lobbys (Tab 1) startet das Spiel sofort
        if Lobbies[lobbyId].isPersistent then
            local lobby = Lobbies[lobbyId]
            PlayerStates[source].team = 'ffa'
            TriggerClientEvent('ffa:gameStarting', source, lobby)
        end
    end
end)

-- Behandelt das Verlassen einer Lobby und stellt den ursprünglichen Zustand wieder her
function LeaveLobby(playerId)
    local state = PlayerStates[playerId]
    if not state or not state.lobbyId then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    -- Routing Bucket und Position zurücksetzen
    SetPlayerRoutingBucket(playerId, state.oldBucket or 0)
    TriggerClientEvent('ffa:restoreState', playerId, state.oldCoords)

    if lobby then
        -- Spieler aus der Liste entfernen
        for i, id in ipairs(lobby.players) do
            if id == playerId then
                table.remove(lobby.players, i)
                break
            end
        end

        -- Lobby löschen, wenn leer und nicht persistent
        if #lobby.players == 0 and not lobby.isPersistent then
            Lobbies[lobbyId] = nil
        elseif #lobby.players > 0 then
            -- Falls der Host geht, neuen Host ernennen
            if playerId == lobby.host then
                lobby.host = lobby.players[1]
                local xPlayer = ESX.GetPlayerFromId(lobby.host)
                lobby.hostName = xPlayer and xPlayer.getName() or "SYSTEM"
            end
            UpdateLobbyPlayers(lobbyId)
        end
    end

    PlayerStates[playerId] = nil
    TriggerClientEvent('ffa:leftLobby', playerId)
end

RegisterServerEvent('ffa:leaveLobby')
AddEventHandler('ffa:leaveLobby', function()
    LeaveLobby(source)
end)

-- Synchronisiert die Spielerliste innerhalb einer Lobby
function UpdateLobbyPlayers(lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    local playersInfo = {}
    for _, pid in ipairs(lobby.players) do
        local state = PlayerStates[pid]
        if state then
            table.insert(playersInfo, {
                id = pid,
                name = state.name,
                team = state.team,
                ready = state.ready,
                isHost = (pid == lobby.host)
            })
        end
    end

    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:updateLobbyPlayers', pid, playersInfo)
    end
end

-- Erlaubt dem Host, Einstellungen während der Wartezeit zu ändern
RegisterServerEvent('ffa:saveSettings')
AddEventHandler('ffa:saveSettings', function(settings)
    local state = PlayerStates[source]
    if not state then return end

    local lobby = Lobbies[state.lobbyId]
    if lobby and lobby.host == source then
        if settings.mapId then
            lobby.mapId = settings.mapId
            lobby.mapLabel = Utils.GetMapById(settings.mapId).label
        end
        if settings.killLimit then lobby.killLimit = settings.killLimit end

        -- Alle Spieler über die Einstellungsänderung informieren
        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:syncSettings', pid, lobby)
        end
    end
end)

-- Sendet die Liste der verfügbaren Lobbys an den Client (gefiltert nach Tab)
RegisterServerEvent('ffa:fetchLobbies')
AddEventHandler('ffa:fetchLobbies', function(data)
    local list = {}
    local tab = data and data.tab or 'ffa'

    for id, lobby in pairs(Lobbies) do
        local match = false
        if tab == 'ffa' then match = lobby.isPersistent
        elseif tab == 'list' then match = not lobby.isPersistent end

        if match then
            table.insert(list, {
                id = id,
                name = lobby.name,
                hostName = lobby.hostName,
                playerCount = #lobby.players,
                maxPlayers = lobby.maxPlayers,
                mapLabel = lobby.mapLabel,
                mode = lobby.mode,
                status = (lobby.status == 'playing') and 'ACTIVE' or 'WAITING'
            })
        end
    end
    TriggerClientEvent('ffa:updateLobbies', source, list)
end)

-- Überträgt Chat-Nachrichten innerhalb einer Lobby
RegisterServerEvent('ffa:sendLobbyChat')
AddEventHandler('ffa:sendLobbyChat', function(data)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:addChatMessage', pid, state.name, data.message)
        end
    end
end)

RegisterServerEvent('ffa:toggleReady')
AddEventHandler('ffa:toggleReady', function()
    local state = PlayerStates[source]
    if state then
        state.ready = not state.ready
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

RegisterServerEvent('ffa:setTeam')
AddEventHandler('ffa:setTeam', function(team)
    local state = PlayerStates[source]
    if state then
        state.team = team
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

-- Ermöglicht es dem Host, Spieler zu kicken
RegisterServerEvent('ffa:kickPlayer')
AddEventHandler('ffa:kickPlayer', function(data)
    local targetId = tonumber(data.id)
    local state = PlayerStates[source]
    if state and Lobbies[state.lobbyId] and Lobbies[state.lobbyId].host == source then
        LeaveLobby(targetId)
        TriggerClientEvent('esx:showNotification', targetId, 'Du wurdest aus der Lobby gekickt.')
    end
end)

-- Initialisierung der persistenten FFA Lobbys beim Serverstart
MySQL.ready(function()
    for _, map in ipairs(Config.Maps) do
        CreateLobby(-1, {
            name = "FFA " .. map.label,
            mapId = map.id,
            isPersistent = true,
            mode = 'ffa',
            loadout = 'all',
            roundTime = 60,
            maxPlayers = 32,
            respawnTime = 3,
            killLimit = 0
        })
    end
end)

-- Bereinigung, wenn ein Spieler die Verbindung zum Server trennt
AddEventHandler('playerDropped', function()
    LeaveLobby(source)
end)
