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
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return nil end

    local lobbyId = GenerateLobbyId()
    local map = Utils.GetMapById(settings.mapId)

    Lobbies[lobbyId] = {
        id = lobbyId,
        name = settings.name,
        host = playerId,
        hostName = xPlayer.getName(),
        isPersistent = settings.isPersistent or false,
        mapId = settings.mapId,
        mapLabel = map.label,
        mode = settings.mode,
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
        scoreRed = 0
    }

    Utils.Print('Lobby erstellt: ' .. settings.name .. ' von ' .. xPlayer.getName())
    JoinLobby(playerId, lobbyId)
    return lobbyId
end

-- Event: Lobby erstellen (via NUI)
RegisterServerEvent('ffa:createLobby')
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
    if #lobby.players >= lobby.maxPlayers then return false end

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
        ready = (playerId == lobby.host or lobby.isPersistent),
        kills = 0,
        deaths = 0,
        name = xPlayer.getName(),
        oldCoords = GetEntityCoords(ped),
        oldBucket = GetPlayerRoutingBucket(playerId)
    }

    -- Routing Bucket setzen
    SetPlayerRoutingBucket(playerId, tonumber(lobbyId))
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
                if xPlayer then lobby.hostName = xPlayer.getName() end
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

-- Aktualisiert Spielerliste
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

-- Lobby-Chat
RegisterServerEvent('ffa:sendLobbyChat')
AddEventHandler('ffa:sendLobbyChat', function(data)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby then
            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:addChatMessage', pid, state.name, data.message)
            end
        end
    end
end)

-- Bereit-Status
RegisterServerEvent('ffa:toggleReady')
AddEventHandler('ffa:toggleReady', function()
    local state = PlayerStates[source]
    if state then
        state.ready = not state.ready
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

-- Team setzen
RegisterServerEvent('ffa:setTeam')
AddEventHandler('ffa:setTeam', function(team)
    local state = PlayerStates[source]
    if state then
        state.team = team
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

-- Lobbyliste abrufen
RegisterServerEvent('ffa:fetchLobbies')
AddEventHandler('ffa:fetchLobbies', function(data)
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
                isPersistent = lobby.isPersistent
            })
        end
    end
    TriggerClientEvent('ffa:updateLobbies', source, list)
end)

-- Schneller Beitritt (Tab 1)
RegisterServerEvent('ffa:quickJoin')
AddEventHandler('ffa:quickJoin', function(mapId)
    local playerId = source
    local targetLobbyId = nil

    for id, lobby in pairs(Lobbies) do
        if lobby.mapId == mapId and lobby.isPersistent then
            targetLobbyId = id
            break
        end
    end

    if targetLobbyId then
        if JoinLobby(playerId, targetLobbyId) then
            local lobby = Lobbies[targetLobbyId]
            PlayerStates[playerId].team = 'ffa'
            TriggerClientEvent('ffa:gameStarting', playerId, lobby)
        end
    end
end)

-- Spieler kicken
RegisterServerEvent('ffa:kickPlayer')
AddEventHandler('ffa:kickPlayer', function(data)
    local targetId = tonumber(data.id)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and lobby.host == source then
            LeaveLobby(targetId)
            TriggerClientEvent('esx:showNotification', targetId, 'Du wurdest aus der Lobby gekickt.')
        end
    end
end)

AddEventHandler('playerDropped', function()
    LeaveLobby(source)
end)

-- Initialisierung persistenter Lobbys
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
            loadouts = {'all'},
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
        Utils.Print('Persistente FFA Lobby bereit: ' .. map.label)
    end
end)
