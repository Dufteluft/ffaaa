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
        loadout = settings.loadout,
        roundTime = settings.roundTime,
        maxPlayers = settings.maxPlayers,
        vehiclesAllowed = settings.vehiclesAllowed,
        friendlyFire = settings.friendlyFire,
        respawnTime = settings.respawnTime,
        killLimit = settings.killLimit,
        players = {},
        status = 'waiting',
        timer = settings.roundTime * 60,
        scoreBlue = 0,
        scoreRed = 0
    }

    Utils.Print('Lobby erstellt: ' .. settings.name .. ' (ID: ' .. lobbyId .. ') von ' .. xPlayer.getName())

    JoinLobby(playerId, lobbyId)
    return lobbyId
end

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
        id = playerId,
        lobbyId = lobbyId,
        team = 'none',
        ready = (playerId == lobby.host),
        kills = 0,
        deaths = 0,
        name = xPlayer.getName(),
        oldCoords = GetEntityCoords(ped),
        oldBucket = GetPlayerRoutingBucket(playerId)
    }

    -- Setze Routing Bucket zur Isolation
    SetPlayerRoutingBucket(playerId, tonumber(lobbyId))

    UpdateLobbyPlayers(lobbyId)
    return true
end

-- Funktion: Lobby verlassen
function LeaveLobby(playerId)
    local state = PlayerStates[playerId]
    if not state or not state.lobbyId then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    -- Routing Bucket und Position wiederherstellen
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
            Utils.Print('Lobby gelöscht: ' .. lobbyId)
        elseif #lobby.players > 0 then
            -- Host-Migration
            if playerId == lobby.host then
                lobby.host = lobby.players[1]
                local xPlayer = ESX.GetPlayerFromId(lobby.host)
                if xPlayer then
                    lobby.hostName = xPlayer.getName()
                end
            end
            UpdateLobbyPlayers(lobbyId)
        end
    end

    PlayerStates[playerId] = nil
    TriggerClientEvent('ffa:leftLobby', playerId)
end

-- Funktion: Aktualisiert die Spielerliste für alle in der Lobby
function UpdateLobbyPlayers(lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    local playersInfo = {}
    for _, pid in ipairs(lobby.players) do
        local state = PlayerStates[pid]
        table.insert(playersInfo, {
            id = pid,
            name = state.name,
            team = state.team,
            ready = state.ready,
            isHost = (pid == lobby.host),
            isMe = false -- Wird clientseitig gesetzt oder wir senden die ID mit
        })
    end

    for _, pid in ipairs(lobby.players) do
        -- Markiere den aktuellen Spieler in seiner Liste
        local personalList = {}
        for _, pInfo in ipairs(playersInfo) do
            local item = {}
            for k,v in pairs(pInfo) do item[k] = v end
            if pInfo.id == pid then item.isMe = true end
            table.insert(personalList, item)
        end
        TriggerClientEvent('ffa:updateLobbyPlayers', pid, personalList)
    end
end

-- NUI Event Handlers
RegisterServerEvent('ffa:createLobby')
AddEventHandler('ffa:createLobby', function(settings)
    local lobbyId = CreateLobby(source, settings)
    if lobbyId then
        TriggerClientEvent('ffa:lobbyCreated', source, Lobbies[lobbyId])
    end
end)

RegisterServerEvent('ffa:joinLobby')
AddEventHandler('ffa:joinLobby', function(lobbyId)
    if JoinLobby(source, lobbyId) then
        TriggerClientEvent('ffa:lobbyJoined', source, Lobbies[lobbyId])
    end
end)

RegisterServerEvent('ffa:leaveLobby')
AddEventHandler('ffa:leaveLobby', function()
    LeaveLobby(source)
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
AddEventHandler('ffa:setTeam', function(data)
    local state = PlayerStates[source]
    if state then
        state.team = data.team
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

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

RegisterServerEvent('ffa:fetchLobbies')
AddEventHandler('ffa:fetchLobbies', function()
    local list = {}
    for id, lobby in pairs(Lobbies) do
        if not lobby.isPersistent then
            table.insert(list, {
                id = id,
                name = lobby.name,
                hostName = lobby.hostName,
                playerCount = #lobby.players,
                maxPlayers = lobby.maxPlayers,
                mapLabel = lobby.mapLabel,
                mode = lobby.mode,
                status = lobby.status == 'playing' and 'ACTIVE' or 'waiting'
            })
        end
    end
    TriggerClientEvent('ffa:updateLobbies', source, list)
end)

RegisterServerEvent('ffa:quickJoin')
AddEventHandler('ffa:quickJoin', function(data)
    local playerId = source
    local targetLobbyId = nil

    for id, lobby in pairs(Lobbies) do
        if lobby.mapId == data.mapId and lobby.isPersistent then
            targetLobbyId = id
            break
        end
    end

    if targetLobbyId then
        if JoinLobby(playerId, targetLobbyId) then
            PlayerStates[playerId].team = 'ffa'
            TriggerClientEvent('ffa:gameStarting', playerId, Lobbies[targetLobbyId])
        end
    end
end)

RegisterServerEvent('ffa:kickPlayer')
AddEventHandler('ffa:kickPlayer', function(data)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and lobby.host == source then
            LeaveLobby(tonumber(data.id))
        end
    end
end)

-- Initialisierung der persistenten Lobbys
MySQL.ready(function()
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
            loadout = 'all',
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
    end
    Utils.Print('Persistente Lobbys geladen.')
end)

AddEventHandler('playerDropped', function()
    LeaveLobby(source)
end)
