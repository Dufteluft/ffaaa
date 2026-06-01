ESX = exports['es_extended']:getSharedObject()

Lobbies = {}
PlayerStates = {}

function GenerateLobbyId()
    local id
    repeat
        id = tostring(math.random(1000, 9999))
    until not Lobbies[id]
    return id
end

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
        status = settings.isPersistent and 'playing' or 'waiting',
        timer = settings.roundTime * 60,
        scoreBlue = 0,
        scoreRed = 0,
        votes = {}
    }

    if playerId ~= -1 then
        JoinLobby(playerId, lobbyId)
    end

    if settings.isPersistent then
        StartGameTimer(lobbyId)
    end

    return lobbyId
end

RegisterServerEvent('ffa:createLobby')
AddEventHandler('ffa:createLobby', function(settings)
    local lobbyId = CreateLobby(source, settings)
    if lobbyId then
        TriggerClientEvent('ffa:lobbyCreated', source, Lobbies[lobbyId])
    end
end)

-- Update Settings (Host)
RegisterServerEvent('ffa:updateSettings')
AddEventHandler('ffa:updateSettings', function(settings)
    local state = PlayerStates[source]
    if not state then return end

    local lobby = Lobbies[state.lobbyId]
    if not lobby or lobby.host ~= source then return end

    lobby.name = settings.name
    lobby.mapId = settings.mapId
    local map = Utils.GetMapById(settings.mapId)
    lobby.mapLabel = map.label
    lobby.mode = settings.mode
    lobby.loadout = settings.loadout
    lobby.roundTime = settings.roundTime
    lobby.timer = settings.roundTime * 60
    lobby.maxPlayers = settings.maxPlayers
    lobby.vehiclesAllowed = settings.vehiclesAllowed
    lobby.friendlyFire = settings.friendlyFire
    lobby.respawnTime = settings.respawnTime
    lobby.killLimit = settings.killLimit

    -- Informiere alle Spieler in der Lobby
    UpdateLobbyPlayers(state.lobbyId)

    -- Sync an alle für UI Info Updates
    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:lobbyJoined', pid, lobby)
    end
end)

function JoinLobby(playerId, lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return false end
    if #lobby.players >= lobby.maxPlayers then return false end

    local xPlayer = nil
    local name = "SYSTEM"

    if playerId ~= -1 then
        xPlayer = ESX.GetPlayerFromId(playerId)
        if not xPlayer then return false end
        name = xPlayer.getName()
    end

    if PlayerStates[playerId] and PlayerStates[playerId].lobbyId then
        LeaveLobby(playerId)
    end

    table.insert(lobby.players, playerId)

    local oldCoords = vector3(0,0,0)
    local oldBucket = 0

    if playerId ~= -1 then
        local ped = GetPlayerPed(playerId)
        oldCoords = GetEntityCoords(ped)
        oldBucket = GetPlayerRoutingBucket(playerId)
        SetPlayerRoutingBucket(playerId, tonumber(lobbyId))
    end

    PlayerStates[playerId] = {
        lobbyId = lobbyId,
        team = 'none',
        ready = (playerId == lobby.host),
        kills = 0,
        deaths = 0,
        name = name,
        oldCoords = oldCoords,
        oldBucket = oldBucket
    }

    UpdateLobbyPlayers(lobbyId)
    return true
end

RegisterServerEvent('ffa:joinLobby')
AddEventHandler('ffa:joinLobby', function(lobbyId)
    -- LobbyId von NUI ist String
    if JoinLobby(source, tostring(lobbyId)) then
        TriggerClientEvent('ffa:lobbyJoined', source, Lobbies[tostring(lobbyId)])

        -- Wenn Lobby bereits läuft, direkt ins Spiel
        local lobby = Lobbies[tostring(lobbyId)]
        if lobby.status == 'playing' then
            TriggerClientEvent('ffa:gameStarting', source, lobby)
        end
    end
end)

function LeaveLobby(playerId)
    local state = PlayerStates[playerId]
    if not state or not state.lobbyId then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    if playerId ~= -1 then
        SetPlayerRoutingBucket(playerId, state.oldBucket or 0)
        TriggerClientEvent('ffa:restoreState', playerId, state.oldCoords)
    end

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
                if lobby.host ~= -1 then
                    local xPlayer = ESX.GetPlayerFromId(lobby.host)
                    if xPlayer then lobby.hostName = xPlayer.getName() end
                else
                    lobby.hostName = "SYSTEM"
                end
            end
            UpdateLobbyPlayers(lobbyId)
        end
    end

    PlayerStates[playerId] = nil
    if playerId ~= -1 then
        TriggerClientEvent('ffa:leftLobby', playerId)
    end
end

RegisterServerEvent('ffa:leaveLobby')
AddEventHandler('ffa:leaveLobby', function()
    LeaveLobby(source)
end)

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
        if pid ~= -1 then
            TriggerClientEvent('ffa:updateLobbyPlayers', pid, playersInfo)
        end
    end
end

RegisterServerEvent('ffa:sendLobbyChat')
AddEventHandler('ffa:sendLobbyChat', function(data)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        for _, pid in ipairs(lobby.players) do
            if pid ~= -1 then
                TriggerClientEvent('ffa:addChatMessage', pid, state.name, data.message)
            end
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

RegisterServerEvent('ffa:fetchLobbies')
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
            table.insert(list, {
                id = tostring(id),
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
    TriggerClientEvent('ffa:updateLobbies', source, list)
end)

RegisterServerEvent('ffa:kickPlayer')
AddEventHandler('ffa:kickPlayer', function(targetId)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and lobby.host == source then
            LeaveLobby(tonumber(targetId))
        end
    end
end)

AddEventHandler('playerDropped', function()
    LeaveLobby(source)
end)

-- Init Persistente Lobbys
MySQL.ready(function()
    Citizen.Wait(1000)
    for _, map in ipairs(Config.Maps) do
        CreateLobby(-1, {
            name = "FFA " .. map.label,
            mapId = map.id,
            mode = 'ffa',
            loadout = 'all',
            roundTime = 60,
            maxPlayers = 32,
            vehiclesAllowed = false,
            friendlyFire = false,
            respawnTime = 3,
            killLimit = 0,
            isPersistent = true
        })
    end
end)
