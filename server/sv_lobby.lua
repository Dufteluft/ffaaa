ESX = exports['es_extended']:getSharedObject()

Lobbies = {} -- Stores all active lobbies
PlayerStates = {} -- Stores state for each player (lobbyId, team, kills, etc.)

-- Helper: Generate unique lobby ID
function GenerateLobbyId()
    local id
    repeat
        id = tostring(math.random(1000, 9999))
    until not Lobbies[id]
    return id
end

-- Function: Create a new lobby
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
        loadout = settings.loadout, -- Now supports array for multi-select
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

    Utils.Print('Lobby erstellt: ' .. settings.name .. ' von ' .. xPlayer.getName())
    JoinLobby(playerId, lobbyId)
    return lobbyId
end

-- Event: Create Lobby (NUI)
RegisterServerEvent('ffa:createLobby')
AddEventHandler('ffa:createLobby', function(settings)
    local lobbyId = CreateLobby(source, settings)
    if lobbyId then
        TriggerClientEvent('ffa:lobbyCreated', source, Lobbies[lobbyId])
    end
end)

-- Function: Join a lobby
function JoinLobby(playerId, lobbyId)
    local lobbyId = tostring(lobbyId)
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
        ready = (playerId == lobby.host),
        kills = 0,
        deaths = 0,
        name = xPlayer.getName(),
        oldCoords = GetEntityCoords(ped),
        oldBucket = GetPlayerRoutingBucket(playerId)
    }

    SetPlayerRoutingBucket(playerId, tonumber(lobbyId))
    UpdateLobbyPlayers(lobbyId)
    return true
end

-- Event: Join Lobby
RegisterServerEvent('ffa:joinLobby')
AddEventHandler('ffa:joinLobby', function(data)
    local lobbyId = (type(data) == 'table') and data.lobbyId or data
    if JoinLobby(source, lobbyId) then
        TriggerClientEvent('ffa:lobbyJoined', source, Lobbies[tostring(lobbyId)])
    end
end)

-- Function: Leave Lobby
function LeaveLobby(playerId)
    local state = PlayerStates[playerId]
    if not state or not state.lobbyId then return end

    local lobbyId = tostring(state.lobbyId)
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
                lobby.hostName = xPlayer and xPlayer.getName() or "UNKNOWN"
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

-- Function: Sync player list in lobby
function UpdateLobbyPlayers(lobbyId)
    local lobby = Lobbies[tostring(lobbyId)]
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

-- Lobby Chat
RegisterServerEvent('ffa:sendLobbyChat')
AddEventHandler('ffa:sendLobbyChat', function(data)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[tostring(state.lobbyId)]
        if lobby then
            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:addChatMessage', pid, state.name, data.message)
            end
        end
    end
end)

-- Ready Toggle
RegisterServerEvent('ffa:toggleReady')
AddEventHandler('ffa:toggleReady', function()
    local state = PlayerStates[source]
    if state then
        state.ready = not state.ready
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

-- Team Selection
RegisterServerEvent('ffa:setTeam')
AddEventHandler('ffa:setTeam', function(team)
    local state = PlayerStates[source]
    if state then
        state.team = team
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

-- Fetch Lobby List with Filters
RegisterServerEvent('ffa:fetchLobbies')
AddEventHandler('ffa:fetchLobbies', function(data)
    local list = {}
    local tab = data and data.tab or 'ffa'
    local filters = data and data.filters or {}

    for id, lobby in pairs(Lobbies) do
        local match = false
        if tab == 'ffa' then
            if lobby.isPersistent then match = true end
        else
            if not lobby.isPersistent then match = true end
        end

        if match then
            -- Apply filters
            if filters.map and filters.map ~= 'all' and lobby.mapId ~= filters.map then match = false end
            if filters.players == 'not-full' and #lobby.players >= lobby.maxPlayers then match = false end
        end

        if match then
            table.insert(list, {
                id = id,
                name = lobby.name,
                hostName = lobby.hostName,
                playerCount = #lobby.players,
                maxPlayers = lobby.maxPlayers,
                mapLabel = lobby.mapLabel,
                mapId = lobby.mapId,
                mode = lobby.mode,
                status = (lobby.status == 'playing') and 'ACTIVE' or 'WAITING'
            })
        end
    end
    TriggerClientEvent('ffa:updateLobbies', source, list)
end)

-- Kick Player
RegisterServerEvent('ffa:kickPlayer')
AddEventHandler('ffa:kickPlayer', function(data)
    local targetId = (type(data) == 'table') and data.id or data
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[tostring(state.lobbyId)]
        if lobby and lobby.host == source then
            LeaveLobby(tonumber(targetId))
        end
    end
end)

-- Quick Join (Tab 1)
RegisterServerEvent('ffa:quickJoin')
AddEventHandler('ffa:quickJoin', function(data)
    local mapId = (type(data) == 'table') and data.mapId or data
    local playerId = source
    local targetId = nil

    for id, lobby in pairs(Lobbies) do
        if lobby.mapId == mapId and lobby.isPersistent then
            targetId = id
            break
        end
    end

    if targetId then
        if JoinLobby(playerId, targetId) then
            local lobby = Lobbies[tostring(targetId)]
            PlayerStates[playerId].team = 'ffa'
            TriggerClientEvent('ffa:gameStarting', playerId, lobby)
        end
    end
end)

-- Initialize Persistent Lobbies
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

AddEventHandler('playerDropped', function()
    LeaveLobby(source)
end)
