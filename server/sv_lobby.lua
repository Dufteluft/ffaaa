ESX = exports['es_extended']:getSharedObject()

Lobbies = {} -- Speichert alle aktiven Lobbys
PlayerStates = {} -- Speichert den Status jedes Spielers (Lobby-ID, Team, Kills, etc.)

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
    local hostName = "SYSTEM"
    if playerId ~= -1 then
        local xPlayer = ESX.GetPlayerFromId(playerId)
        if not xPlayer then return nil end
        hostName = xPlayer.getName()
    end

    local lobbyId = GenerateLobbyId()
    local map = Utils.GetMapById(settings.mapId)

    Lobbies[lobbyId] = {
        id = lobbyId,
        name = settings.name,
        host = playerId,
        hostName = hostName,
        isPersistent = settings.isPersistent or false,
        mapId = settings.mapId,
        mapLabel = map and map.label or "Unbekannt",
        mode = settings.mode or 'ffa',
        loadout = settings.loadout or 'all',
        roundTime = settings.roundTime or Config.DefaultSettings.roundTime,
        maxPlayers = settings.maxPlayers or Config.DefaultSettings.maxPlayers,
        vehiclesAllowed = settings.vehiclesAllowed or false,
        friendlyFire = settings.friendlyFire or false,
        respawnTime = settings.respawnTime or Config.DefaultSettings.respawnTime,
        killLimit = settings.killLimit or Config.DefaultSettings.killLimit,
        players = {},
        status = 'waiting',
        timer = (settings.roundTime or 15) * 60,
        scoreBlue = 0,
        scoreRed = 0
    }

    Utils.Print('Lobby erstellt: ' .. settings.name .. ' von ' .. hostName)

    if playerId ~= -1 then
        JoinLobby(playerId, lobbyId)
    end
    return lobbyId
end

-- Event: Lobby erstellen (via NUI)
RegisterServerEvent('ffa:createLobby')
AddEventHandler('ffa:createLobby', function(settings)
    local src = source
    local lobbyId = CreateLobby(src, settings)
    if lobbyId then
        TriggerClientEvent('ffa:lobbyCreated', src, Lobbies[lobbyId])
    end
end)

-- Funktion: Spieler tritt einer Lobby bei
function JoinLobby(playerId, lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return false end
    if #lobby.players >= lobby.maxPlayers then return false end

    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return false end

    -- Prüfen, ob der Spieler bereits in einer Lobby ist
    if PlayerStates[playerId] and PlayerStates[playerId].lobbyId then
        LeaveLobby(playerId)
    end

    table.insert(lobby.players, playerId)

    -- Speichere aktuellen Status des Spielers
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

    -- Setze Routing Bucket
    SetPlayerRoutingBucket(playerId, tonumber(lobbyId))

    UpdateLobbyPlayers(lobbyId)
    return true
end

-- Event: Lobby beitreten
RegisterServerEvent('ffa:joinLobby')
AddEventHandler('ffa:joinLobby', function(lobbyId)
    local src = source
    if JoinLobby(src, lobbyId) then
        local lobby = Lobbies[lobbyId]
        TriggerClientEvent('ffa:lobbyJoined', src, lobby)

        -- Wenn persistent, direkt starten
        if lobby.isPersistent then
            PlayerStates[src].team = 'ffa'
            TriggerClientEvent('ffa:gameStarting', src, lobby)
        end
    end
end)

-- Event: Einstellungen aktualisieren (via NUI Host)
RegisterServerEvent('ffa:updateSettings')
AddEventHandler('ffa:updateSettings', function(settings)
    local src = source
    local lobby = Lobbies[settings.lobbyId]

    if lobby and lobby.host == src then
        local map = Utils.GetMapById(settings.mapId)

        lobby.name = settings.name
        lobby.mapId = settings.mapId
        lobby.mapLabel = map and map.label or "Unbekannt"
        lobby.mode = settings.mode
        lobby.loadout = settings.loadout
        lobby.roundTime = settings.roundTime
        lobby.maxPlayers = settings.maxPlayers
        lobby.vehiclesAllowed = settings.vehiclesAllowed
        lobby.friendlyFire = settings.friendlyFire
        lobby.respawnTime = settings.respawnTime
        lobby.killLimit = settings.killLimit
        lobby.timer = settings.roundTime * 60

        -- Alle Spieler in der Lobby informieren
        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:lobbyJoined', pid, lobby)
            TriggerClientEvent('ffa:addChatMessage', pid, 'SYSTEM', 'Die Lobby-Einstellungen wurden aktualisiert.')
        end
    end
end)

-- Funktion: Lobby verlassen
function LeaveLobby(playerId)
    local state = PlayerStates[playerId]
    if not state or not state.lobbyId then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    -- Routing Bucket wiederherstellen
    SetPlayerRoutingBucket(playerId, state.oldBucket or 0)

    -- Position wiederherstellen und Waffen entfernen (via Client)
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
            -- Wenn der Host geht, wird der nächste Spieler Host
            if playerId == lobby.host then
                lobby.host = lobby.players[1]
                local xPlayer = ESX.GetPlayerFromId(lobby.host)
                if xPlayer then lobby.hostName = xPlayer.getName() end
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

-- Funktion: Aktualisiert die Spielerliste für alle in der Lobby
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

-- Event: Lobby-Chat senden
RegisterServerEvent('ffa:sendLobbyChat')
AddEventHandler('ffa:sendLobbyChat', function(data)
    local src = source
    local state = PlayerStates[src]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby then
            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:addChatMessage', pid, state.name, data.message)
            end
        end
    end
end)

-- Event: Bereit-Status umschalten
RegisterServerEvent('ffa:toggleReady')
AddEventHandler('ffa:toggleReady', function()
    local src = source
    local state = PlayerStates[src]
    if state then
        state.ready = not state.ready
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

-- Event: Team setzen
RegisterServerEvent('ffa:setTeam')
AddEventHandler('ffa:setTeam', function(team)
    local src = source
    local state = PlayerStates[src]
    if state then
        state.team = team
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

-- Event: Lobbyliste für UI abrufen
RegisterServerEvent('ffa:fetchLobbies')
AddEventHandler('ffa:fetchLobbies', function(data)
    local src = source
    local list = {}
    local filterTab = data and data.tab or 'ffa'

    for id, lobby in pairs(Lobbies) do
        local isMatch = false
        if filterTab == 'ffa' then
            if lobby.isPersistent then isMatch = true end
        elseif filterTab == 'lobby' then
            if not lobby.isPersistent then isMatch = true end
        end

        if isMatch then
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
    end
    TriggerClientEvent('ffa:updateLobbies', src, list)
end)

-- Wenn Spieler den Server verlässt
AddEventHandler('playerDropped', function()
    LeaveLobby(source)
end)

-- Automatische Initialisierung der persistenten Lobbys beim Server-Start
MySQL.ready(function()
    Citizen.Wait(1000)
    for _, map in ipairs(Config.Maps) do
        local lobbyId = GenerateLobbyId()
        Lobbies[lobbyId] = {
            id = lobbyId,
            name = "FFA " .. map.label,
            host = -1,
            hostName = "SYSTEM",
            isPersistent = true,
            mapId = map.id,
            mapLabel = map.label,
            mode = 'ffa',
            loadout = {'all'},
            roundTime = 0,
            maxPlayers = 32,
            vehiclesAllowed = false,
            friendlyFire = false,
            respawnTime = 3,
            killLimit = 0,
            players = {},
            status = 'playing',
            timer = 0,
            scoreBlue = 0,
            scoreRed = 0
        }
        Utils.Print('Persistente FFA Lobby initialisiert: ' .. map.label)
    end
end)

-- Event: Spieler aus Lobby kicken
RegisterServerEvent('ffa:kickPlayer')
AddEventHandler('ffa:kickPlayer', function(targetId)
    local src = source
    local state = PlayerStates[src]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and lobby.host == src then
            LeaveLobby(tonumber(targetId))
            TriggerClientEvent('esx:showNotification', tonumber(targetId), 'Du wurdest aus der Lobby gekickt.')
        end
    end
end)

-- Event: Map Voting
RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(mapId)
    local src = source
    local state = PlayerStates[src]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and not lobby.isPersistent then
            -- Wir speichern den Vote einfach direkt als neue Map (vereinfacht)
            local map = Utils.GetMapById(mapId)
            if map then
                lobby.mapId = mapId
                lobby.mapLabel = map.label
                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:addChatMessage', pid, 'SYSTEM', 'Nächste Map: ' .. map.label)
                end
            end
        end
    end
end)
