ESX = exports['es_extended']:getSharedObject()

local isMenuOpen = false

-- Menü-Steuerung (F5 öffnet/schließt Menü)
-- Registriere Key Mapping für bessere Performance und Anpassbarkeit
Citizen.CreateThread(function()
    RegisterKeyMapping('openffamenu', 'FFA Menü öffnen', 'keyboard', Config.MenuKey)
end)

RegisterCommand('openffamenu', function()
    OpenMainMenu()
end, false)

-- Funktion: Hauptmenü öffnen
function OpenMainMenu()
    if isMenuOpen then
        isMenuOpen = false
        SetNuiFocus(false, false)
        SendNUIMessage({ action = 'close' })
        return
    end

    -- Statistiken anfordern bevor Menü geöffnet wird
    TriggerServerEvent('ffa:getStats')

    isMenuOpen = true
    SetNuiFocus(true, true)
    SendNUIMessage({
        action = 'open',
        config = Config,
        maps = Config.Maps,
        isInGame = playerState.isInGame
    })
end

-- Callback: UI schließen
RegisterNUICallback('closeUI', function(data, cb)
    isMenuOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
    cb('ok')
end)

-- Lobby Events
RegisterNetEvent('ffa:lobbyCreated')
AddEventHandler('ffa:lobbyCreated', function(lobby, myId)
    currentLobby = lobby
    SendNUIMessage({
        action = 'lobbyCreated',
        lobby = lobby,
        myId = myId
    })
end)

RegisterNetEvent('ffa:lobbyJoined')
AddEventHandler('ffa:lobbyJoined', function(lobby, myId)
    currentLobby = lobby
    SendNUIMessage({
        action = 'lobbyJoined',
        lobby = lobby,
        myId = myId
    })
end)

RegisterNetEvent('ffa:updateLobbyPlayers')
AddEventHandler('ffa:updateLobbyPlayers', function(players)
    SendNUIMessage({
        action = 'updateLobbyPlayers',
        players = players
    })
end)

RegisterNetEvent('ffa:leftLobby')
AddEventHandler('ffa:leftLobby', function()
    currentLobby = nil
    playerState.isInGame = false
end)

RegisterNetEvent('ffa:receiveStats')
AddEventHandler('ffa:receiveStats', function(stats)
    SendNUIMessage({
        action = 'receiveStats',
        stats = stats
    })
end)

-- NUI Callbacks
RegisterNUICallback('createLobby', function(data, cb)
    TriggerServerEvent('ffa:createLobby', data)
    cb('ok')
end)

RegisterNUICallback('joinLobby', function(data, cb)
    TriggerServerEvent('ffa:joinLobby', data.lobbyId)
    cb('ok')
end)

RegisterNUICallback('fetchLobbies', function(data, cb)
    TriggerServerEvent('ffa:fetchLobbies', data)
    cb('ok')
end)

RegisterNetEvent('ffa:updateLobbies')
AddEventHandler('ffa:updateLobbies', function(lobbies)
    SendNUIMessage({
        action = 'updateLobbies',
        lobbies = lobbies
    })
end)

RegisterNUICallback('sendLobbyChat', function(data, cb)
    TriggerServerEvent('ffa:sendLobbyChat', data)
    cb('ok')
end)

RegisterNetEvent('ffa:addChatMessage')
AddEventHandler('ffa:addChatMessage', function(name, message)
    SendNUIMessage({
        action = 'addChatMessage',
        name = name,
        message = message
    })
end)

RegisterNUICallback('toggleReady', function(data, cb)
    TriggerServerEvent('ffa:toggleReady')
    cb('ok')
end)

RegisterNUICallback('setTeam', function(data, cb)
    TriggerServerEvent('ffa:setTeam', data.team)
    cb('ok')
end)

RegisterNUICallback('startGame', function(data, cb)
    TriggerServerEvent('ffa:startGame')
    cb('ok')
end)

RegisterNUICallback('leaveLobby', function(data, cb)
    TriggerServerEvent('ffa:leaveLobby')
    cb('ok')
end)

RegisterNUICallback('quickJoin', function(data, cb)
    TriggerServerEvent('ffa:quickJoin', data.mapId)
    cb('ok')
end)

RegisterNUICallback('kickPlayer', function(data, cb)
    TriggerServerEvent('ffa:kickPlayer', data.id)
    cb('ok')
end)

RegisterNUICallback('voteMap', function(data, cb)
    TriggerServerEvent('ffa:voteMap', data.mapId)
    cb('ok')
end)

RegisterNUICallback('closeWinnerScreen', function(data, cb)
    -- Hier bleiben wir in der Lobby, also nur Fokus weg
    SetNuiFocus(false, false)
    TriggerServerEvent('ffa:closeWinnerScreen')
    cb('ok')
end)
