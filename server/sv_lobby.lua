RegisterServerEvent('ffa:createLobby')
RegisterServerEvent('ffa:joinLobby')
RegisterServerEvent('ffa:leaveLobby')
RegisterServerEvent('ffa:sendLobbyChat')
RegisterServerEvent('ffa:toggleReady')
RegisterServerEvent('ffa:setTeam')
RegisterServerEvent('ffa:fetchLobbies')
RegisterServerEvent('ffa:updateSettings')
RegisterServerEvent('ffa:kickPlayer')
RegisterServerEvent('ffa:closeLobby')

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
    local xPlayer = nil
    local hostName = "SYSTEM"

    if playerId ~= -1 then
        xPlayer = ESX.GetPlayerFromId(playerId)
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
        loadouts = settings.loadouts or {'pistol'},
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
        scoreRed = 0,
        votes = {}
    }

    Utils.Print('Lobby erstellt: ' .. settings.name .. ' von ' .. hostName)

    if playerId ~= -1 then
        JoinLobby(playerId, lobbyId)
    end

    return lobbyId
end

-- Event: Lobby erstellen (via NUI)
AddEventHandler('ffa:createLobby', function(settings)
    local lobbyId = CreateLobby(source, settings)
    if lobbyId then
        TriggerClientEvent('ffa:lobbyCreated', source, Lobbies[lobbyId])
    end
end)

-- Funktion: Spieler tritt einer Lobby bei
function JoinLobby(playerId, lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return false end

    if #lobby.players >= lobby.maxPlayers then
        TriggerClientEvent('esx:showNotification', playerId, '~r~Lobby ist voll!')
        return false
    end

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
        ready = (playerId == lobby.host),
        kills = 0,
        deaths = 0,
        name = xPlayer.getName(),
        oldCoords = GetEntityCoords(ped),
        oldBucket = GetPlayerRoutingBucket(playerId)
    }

    -- Setze Routing Bucket (Lobby ID als Zahl)
    SetPlayerRoutingBucket(playerId, tonumber(lobbyId))

    UpdateLobbyPlayers(lobbyId)

    -- Wenn persistente Lobby, sofort ins Spiel schicken
    if lobby.isPersistent then
        PlayerStates[playerId].team = 'ffa'
        TriggerClientEvent('ffa:gameStarting', playerId, lobby)
    end

    return true
end

-- Event: Lobby beitreten
AddEventHandler('ffa:joinLobby', function(data)
    local lobbyId = data.lobbyId
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

    -- Routing Bucket und State wiederherstellen
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
AddEventHandler('ffa:sendLobbyChat', function(data)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:addChatMessage', pid, state.name, data.message)
        end
    end
end)

-- Event: Bereit-Status umschalten
AddEventHandler('ffa:toggleReady', function()
    local state = PlayerStates[source]
    if state then
        state.ready = not state.ready
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

-- Event: Team setzen
AddEventHandler('ffa:setTeam', function(data)
    local state = PlayerStates[source]
    if state then
        state.team = data.team
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

-- Event: Lobbyliste für UI abrufen
AddEventHandler('ffa:fetchLobbies', function(data)
    local list = {}
    local filterTab = data and data.tab or 'ffa'

    for id, lobby in pairs(Lobbies) do
        local isMatch = false
        if filterTab == 'ffa' then
            if lobby.isPersistent then isMatch = true end
        else
            if not lobby.isPersistent then isMatch = true end
        end

        if isMatch then
            local displayStatus = 'waiting'
            if lobby.status == 'playing' then displayStatus = 'ACTIVE' end

            table.insert(list, {
                id = id,
                name = lobby.name,
                hostName = lobby.hostName,
                playerCount = #lobby.players,
                maxPlayers = lobby.maxPlayers,
                mapLabel = lobby.mapLabel,
                mapId = lobby.mapId,
                mode = lobby.mode,
                status = displayStatus,
                isPersistent = lobby.isPersistent
            })
        end
    end
    TriggerClientEvent('ffa:updateLobbies', source, list)
end)

-- Event: Einstellungen aktualisieren (Host)
AddEventHandler('ffa:updateSettings', function(settings)
    local state = PlayerStates[source]
    if not state then return end

    local lobby = Lobbies[state.lobbyId]
    if lobby and lobby.host == source then
        lobby.name = settings.name or lobby.name
        lobby.mapId = settings.mapId or lobby.mapId
        lobby.mapLabel = Utils.GetMapById(lobby.mapId).label
        lobby.mode = settings.mode or lobby.mode
        lobby.loadouts = settings.loadouts or lobby.loadouts
        lobby.roundTime = settings.roundTime or lobby.roundTime
        lobby.maxPlayers = settings.maxPlayers or lobby.maxPlayers
        lobby.respawnTime = settings.respawnTime or lobby.respawnTime
        lobby.killLimit = settings.killLimit or lobby.killLimit
        lobby.vehiclesAllowed = settings.vehiclesAllowed
        lobby.friendlyFire = settings.friendlyFire

        -- Alle Spieler informieren
        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:lobbyJoined', pid, lobby)
            TriggerClientEvent('ffa:addChatMessage', pid, 'SYSTEM', 'Die Lobby-Einstellungen wurden aktualisiert.')
        end
    end
end)

-- Event: Spieler kicken
AddEventHandler('ffa:kickPlayer', function(data)
    local targetId = tonumber(data.id)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and lobby.host == source then
            LeaveLobby(targetId)
            TriggerClientEvent('esx:showNotification', targetId, 'Du wurdest gekickt.')
        end
    end
end)

-- Event: Lobby schließen
AddEventHandler('ffa:closeLobby', function()
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and lobby.host == source and not lobby.isPersistent then
            for _, pid in ipairs(lobby.players) do
                LeaveLobby(pid)
                TriggerClientEvent('esx:showNotification', pid, 'Lobby wurde vom Host geschlossen.')
            end
            Lobbies[state.lobbyId] = nil
        end
    end
end)

-- Automatische Initialisierung der persistenten Lobbys beim Server-Start
MySQL.ready(function()
    Citizen.Wait(1000)
    for _, map in ipairs(Config.Maps) do
        CreateLobby(-1, {
            name = "FFA " .. map.label,
            mapId = map.id,
            mode = 'ffa',
            loadouts = {'all'},
            roundTime = 0,
            maxPlayers = 32,
            vehiclesAllowed = false,
            friendlyFire = false,
            respawnTime = 3,
            killLimit = 0,
            isPersistent = true
        })
        Utils.Print('Persistente FFA Lobby initialisiert: ' .. map.label)
    end
end)

-- Verlassen beim Disconnect
AddEventHandler('playerDropped', function()
    LeaveLobby(source)
end)
