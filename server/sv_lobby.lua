ESX = exports['es_extended']:getSharedObject()

Lobbies = {} -- Speichert alle aktiven Lobbys
PlayerStates = {} -- Speichert den Status jedes Spielers

-- Hilfsfunktion zur Generierung einer eindeutigen Lobby-ID
function GenerateLobbyId()
    local id
    repeat
        id = tostring(math.random(1000, 9999))
    until not Lobbies[id]
    return id
end

-- Funktion: Erstellt eine neue Lobby
function CreateLobby(playerId, settings)
    local xPlayer = (playerId ~= -1) and ESX.GetPlayerFromId(playerId) or nil
    local hostName = xPlayer and xPlayer.getName() or "SYSTEM"

    local lobbyId = GenerateLobbyId()
    local map = Utils.GetMapById(settings.mapId)

    Lobbies[lobbyId] = {
        id = lobbyId,
        name = settings.name,
        host = playerId,
        hostName = hostName,
        isPersistent = settings.isPersistent or false,
        mapId = settings.mapId,
        mapLabel = map and map.label or "Unknown",
        mode = settings.mode or 'ffa',
        loadout = settings.loadout or 'all',
        roundTime = settings.roundTime or Config.DefaultSettings.roundTime,
        maxPlayers = settings.maxPlayers or Config.DefaultSettings.maxPlayers,
        vehiclesAllowed = settings.vehiclesAllowed or false,
        friendlyFire = settings.friendlyFire or false,
        respawnTime = settings.respawnTime or Config.DefaultSettings.respawnTime,
        killLimit = settings.killLimit or Config.DefaultSettings.killLimit,
        players = {},
        status = settings.status or 'waiting',
        timer = (settings.roundTime or Config.DefaultSettings.roundTime) * 60,
        scoreBlue = 0,
        scoreRed = 0
    }

    Utils.Print('Lobby erstellt: ' .. settings.name .. ' von ' .. hostName)

    if playerId ~= -1 then
        JoinLobby(playerId, lobbyId)
    end
    return lobbyId
end

-- Event: Lobby erstellen
RegisterServerEvent('ffa:createLobby')
AddEventHandler('ffa:createLobby', function(settings)
    local lobbyId = CreateLobby(source, settings)
    if lobbyId then
        TriggerClientEvent('ffa:lobbyCreated', source, Lobbies[lobbyId])
    end
end)

-- Event: Lobby-Einstellungen aktualisieren (durch Host)
RegisterServerEvent('ffa:updateSettings')
AddEventHandler('ffa:updateSettings', function(settings)
    local src = source
    local ps = PlayerStates[src]
    if not ps then return end

    local lobbyId = ps.lobbyId
    local lobby = Lobbies[lobbyId]

    if lobby and lobby.host == src then
        local map = Utils.GetMapById(settings.mapId)

        lobby.name = settings.name
        lobby.mapId = settings.mapId
        lobby.mapLabel = map and map.label or "Unknown"
        lobby.mode = settings.mode
        lobby.loadout = settings.loadout
        lobby.roundTime = settings.roundTime
        lobby.maxPlayers = settings.maxPlayers
        lobby.vehiclesAllowed = settings.vehiclesAllowed
        lobby.friendlyFire = settings.friendlyFire
        lobby.respawnTime = settings.respawnTime
        lobby.killLimit = settings.killLimit
        lobby.timer = settings.roundTime * 60

        -- Alle Spieler in der Lobby über die neuen Einstellungen informieren
        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:lobbyJoined', pid, lobby)
            TriggerClientEvent('ffa:addChatMessage', pid, 'SYSTEM', 'Lobby-Einstellungen wurden vom Host aktualisiert.')
        end
    end
end)

-- Funktion: Spieler tritt einer Lobby bei
function JoinLobby(playerId, lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return false end

    if #lobby.players >= lobby.maxPlayers then
        TriggerClientEvent('esx:showNotification', playerId, 'Lobby ist voll!')
        return false
    end

    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return false end

    if PlayerStates[playerId] and PlayerStates[playerId].lobbyId then
        LeaveLobby(playerId)
    end

    table.insert(lobby.players, playerId)

    local ped = GetPlayerPed(playerId)
    PlayerStates[playerId] = {
        lobbyId = lobbyId,
        team = 'none',
        ready = (playerId == lobby.host),
        kills = 0,
        deaths = 0,
        name = xPlayer.getName(),
        oldCoords = GetEntityCoords(ped),
        oldBucket = GetPlayerRoutingBucket(playerId)
    }

    SetPlayerRoutingBucket(playerId, tonumber(lobbyId))

    -- Wenn Lobby bereits läuft (persistent), Spieler direkt starten
    if lobby.status == 'playing' then
        if lobby.mode == 'tdm' then
            -- Einfache Team-Zuweisung beim Nachjoinen
            PlayerStates[playerId].team = (math.random(1,2) == 1) and 'blue' or 'red'
        else
            PlayerStates[playerId].team = 'ffa'
        end
        TriggerClientEvent('ffa:gameStarting', playerId, lobby)
    end

    UpdateLobbyPlayers(lobbyId)
    return true
end

-- Event: Lobby beitreten
RegisterServerEvent('ffa:joinLobby')
AddEventHandler('ffa:joinLobby', function(lobbyId)
    if JoinLobby(source, lobbyId) then
        TriggerClientEvent('ffa:lobbyJoined', source, Lobbies[lobbyId])
    end
end)

-- Funktion: Lobby verlassen
function LeaveLobby(playerId)
    local state = PlayerStates[playerId]
    if not state or not state.lobbyId then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    SetPlayerRoutingBucket(playerId, state.oldBucket or 0)
    TriggerClientEvent('ffa:restoreState', playerId, state.oldCoords)

    if lobby then
        for i, id in ipairs(lobby.players) do
            if id == playerId then
                table.remove(lobby.players, i)
                break
            end
        end

        if #lobby.players == 0 and not lobby.isPersistent then
            Lobbies[lobbyId] = nil
        elseif #lobby.players > 0 then
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

-- Event: Lobby verlassen
RegisterServerEvent('ffa:leaveLobby')
AddEventHandler('ffa:leaveLobby', function()
    LeaveLobby(source)
end)

-- Funktion: Spielerliste aktualisieren
function UpdateLobbyPlayers(lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    local playersInfo = {}
    for _, pid in ipairs(lobby.players) do
        local state = PlayerStates[pid]
        if state then
            table.insert(playersInfo, {
                id = tostring(pid),
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

-- Event: Lobby-Chat
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

-- Event: Bereit-Status
RegisterServerEvent('ffa:toggleReady')
AddEventHandler('ffa:toggleReady', function()
    local state = PlayerStates[source]
    if state then
        state.ready = not state.ready
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

-- Event: Team setzen
RegisterServerEvent('ffa:setTeam')
AddEventHandler('ffa:setTeam', function(data)
    local state = PlayerStates[source]
    if state then
        state.team = data.team
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

-- Event: Lobbyliste abrufen
RegisterServerEvent('ffa:fetchLobbies')
AddEventHandler('ffa:fetchLobbies', function(data)
    local list = {}
    for id, lobby in pairs(Lobbies) do
        table.insert(list, {
            id = id,
            name = lobby.name,
            hostName = lobby.hostName,
            playerCount = #lobby.players,
            maxPlayers = lobby.maxPlayers,
            mapLabel = lobby.mapLabel,
            mapId = lobby.mapId,
            mode = lobby.mode,
            status = lobby.status == 'playing' and 'ACTIVE' or 'WAITING',
            isPersistent = lobby.isPersistent
        })
    end
    TriggerClientEvent('ffa:updateLobbies', source, list)
end)

-- Event: Spieler kicken
RegisterServerEvent('ffa:kickPlayer')
AddEventHandler('ffa:kickPlayer', function(data)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and (lobby.host == source or lobby.host == -1) then
            LeaveLobby(tonumber(data.id))
        end
    end
end)

-- Automatische Initialisierung persistenter Lobbys
MySQL.ready(function()
    Citizen.Wait(1000)
    for _, map in ipairs(Config.Maps) do
        CreateLobby(-1, {
            name = "FFA " .. map.label,
            mapId = map.id,
            mode = 'ffa',
            loadout = 'all',
            roundTime = 0, -- 0 = Unendlich
            maxPlayers = 32,
            isPersistent = true,
            status = 'playing'
        })
        Utils.Print('Persistente FFA Lobby initialisiert: ' .. map.label)
    end
end)

AddEventHandler('playerDropped', function()
    LeaveLobby(source)
end)
