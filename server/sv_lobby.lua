ESX = exports['es_extended']:getSharedObject()

Lobbies = {} -- Speichert alle aktiven Lobbys
PlayerStates = {} -- Speichert den Status jedes Spielers

-- Lokale Übersetzungshilfe für Server
local function _U(str, ...)
    if Config.Locales[Config.Locale] and Config.Locales[Config.Locale][str] then
        return string.format(Config.Locales[Config.Locale][str], ...)
    else
        return 'Translation [' .. Config.Locale .. '][' .. str .. '] not found'
    end
end

function GenerateLobbyId()
    local id
    repeat
        id = tostring(math.random(1000, 9999))
    until not Lobbies[id]
    return id
end

function CreateLobby(playerId, settings)
    local xPlayer = ESX.GetPlayerFromId(playerId)
    local name = settings.name or 'Lobby'
    local lobbyId = GenerateLobbyId()
    local map = Utils.GetMapById(settings.mapId)

    Lobbies[lobbyId] = {
        id = lobbyId,
        name = name,
        host = playerId,
        hostName = xPlayer and xPlayer.getName() or 'SYSTEM',
        isPersistent = settings.isPersistent or false,
        mapId = settings.mapId,
        mapLabel = map and map.label or 'Unknown',
        mode = settings.mode or 'ffa',
        loadout = settings.loadout or 'all',
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

    if playerId ~= -1 then
        JoinLobby(playerId, lobbyId)
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

function JoinLobby(playerId, lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby or #lobby.players >= lobby.maxPlayers then return false end

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

    SetPlayerRoutingBucket(playerId, tonumber(lobbyId))
    UpdateLobbyPlayers(lobbyId)
    return true
end

RegisterServerEvent('ffa:joinLobby')
AddEventHandler('ffa:joinLobby', function(lobbyId)
    local src = source
    if JoinLobby(src, lobbyId) then
        local lobby = Lobbies[lobbyId]
        TriggerClientEvent('ffa:lobbyJoined', src, lobby)

        -- Wenn es eine persistente Lobby ist, direkt starten
        if lobby.isPersistent then
            PlayerStates[src].team = 'ffa'
            TriggerClientEvent('ffa:gameStarting', src, lobby)
        end
    end
end)

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
                lobby.hostName = xPlayer and xPlayer.getName() or 'SYSTEM'
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

RegisterServerEvent('ffa:toggleReady')
AddEventHandler('ffa:toggleReady', function()
    local src = source
    local state = PlayerStates[src]
    if state then
        state.ready = not state.ready
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

RegisterServerEvent('ffa:setTeam')
AddEventHandler('ffa:setTeam', function(data)
    local src = source
    local state = PlayerStates[src]
    if state then
        state.team = data.team
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

RegisterServerEvent('ffa:saveSettings')
AddEventHandler('ffa:saveSettings', function(data)
    local src = source
    local state = PlayerStates[src]
    if state then
        local lobby = Lobbies[state.lobbyId]
        if lobby and lobby.host == src then
            lobby[data.key] = data.value
            if data.key == 'mapId' then
                local map = Utils.GetMapById(data.value)
                lobby.mapLabel = map and map.label or 'Unknown'
            end

            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:syncSettings', pid, lobby)
            end
        end
    end
end)

RegisterServerEvent('ffa:fetchLobbies')
AddEventHandler('ffa:fetchLobbies', function(data)
    local src = source
    local list = {}
    local tab = data and data.tab or 'ffa-presets'
    local filters = data and data.filters or {}

    for id, lobby in pairs(Lobbies) do
        local isMatch = false
        if tab == 'ffa-presets' then
            if lobby.isPersistent then isMatch = true end
        else
            if not lobby.isPersistent then isMatch = true end
        end

        if isMatch then
            -- Apply Filters
            if filters.map and filters.map ~= 'all' and lobby.mapId ~= filters.map then isMatch = false end
            if filters.weapon and filters.weapon ~= 'all' and lobby.loadout ~= filters.weapon then isMatch = false end
            if filters.notFull and #lobby.players >= lobby.maxPlayers then isMatch = false end

            if isMatch then
                table.insert(list, {
                    id = id,
                    name = lobby.name,
                    playerCount = #lobby.players,
                    maxPlayers = lobby.maxPlayers,
                    mapLabel = lobby.mapLabel,
                    mode = lobby.mode,
                    loadout = lobby.loadout
                })
            end
        end
    end
    TriggerClientEvent('ffa:updateLobbies', src, list)
end)

RegisterServerEvent('ffa:sendLobbyChat')
AddEventHandler('ffa:sendLobbyChat', function(data)
    local src = source
    local state = PlayerStates[src]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:addChatMessage', pid, state.name, data.message)
        end
    end
end)

RegisterServerEvent('ffa:kickPlayer')
AddEventHandler('ffa:kickPlayer', function(data)
    local src = source
    local state = PlayerStates[src]
    if state then
        local lobby = Lobbies[state.lobbyId]
        if lobby and lobby.host == src then
            LeaveLobby(tonumber(data.id))
        end
    end
end)

RegisterServerEvent('ffa:closeLobby')
AddEventHandler('ffa:closeLobby', function()
    local src = source
    local state = PlayerStates[src]
    if state then
        local lobby = Lobbies[state.lobbyId]
        if lobby and lobby.host == src and not lobby.isPersistent then
            local players = {}
            for _, pid in ipairs(lobby.players) do table.insert(players, pid) end
            for _, pid in ipairs(players) do LeaveLobby(pid) end
        end
    end
end)

-- Initialisiere persistente Lobbys
MySQL.ready(function()
    for _, map in ipairs(Config.Maps) do
        CreateLobby(-1, {
            name = "FFA " .. map.label,
            mapId = map.id,
            isPersistent = true,
            maxPlayers = 32,
            mode = 'ffa',
            loadout = 'all',
            roundTime = 0
        })
    end
end)

-- Cleanup leere Lobbys
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(60000)
        for id, lobby in pairs(Lobbies) do
            if #lobby.players == 0 and not lobby.isPersistent then
                Lobbies[id] = nil
            end
        end
    end
end)

AddEventHandler('playerDropped', function()
    LeaveLobby(source)
end)
