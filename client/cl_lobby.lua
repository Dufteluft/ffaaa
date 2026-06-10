ESX = exports['es_extended']:getSharedObject()

local isMenuOpen = false

-- Menü-Steuerung
Citizen.CreateThread(function()
    RegisterKeyMapping('openffamenu', 'FFA Menü öffnen', 'keyboard', Config.MenuKey)
end)

RegisterCommand('openffamenu', function()
    OpenMainMenu()
end, false)

function OpenMainMenu()
    if isMenuOpen then
        CloseMenu()
        return
    end

    isMenuOpen = true
    SetNuiFocus(true, true)
    SendNUIMessage({
        action = 'open',
        config = Config,
        maps = Config.Maps,
        isInGame = playerState.isInGame
    })
end

function CloseMenu()
    isMenuOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
end

RegisterNUICallback('closeUI', function(data, cb)
    CloseMenu()
    cb('ok')
end)

-- Lobby Events
RegisterNetEvent('ffa:lobbyCreated')
AddEventHandler('ffa:lobbyCreated', function(lobby)
    currentLobby = lobby
    SendNUIMessage({ action = 'lobbyCreated', lobby = lobby })
end)

RegisterNetEvent('ffa:lobbyJoined')
AddEventHandler('ffa:lobbyJoined', function(lobby)
    currentLobby = lobby
    SendNUIMessage({ action = 'lobbyJoined', lobby = lobby })
end)

RegisterNetEvent('ffa:updateLobbyPlayers')
AddEventHandler('ffa:updateLobbyPlayers', function(players)
    SendNUIMessage({ action = 'updateLobbyPlayers', players = players })
end)

RegisterNetEvent('ffa:updateLobbySettings')
AddEventHandler('ffa:updateLobbySettings', function(lobby)
    currentLobby = lobby
    SendNUIMessage({ action = 'updateLobbyJoined', lobby = lobby }) -- reuse joined to update settings
end)

-- NUI Callbacks
RegisterNUICallback('createLobby', function(data, cb)
    TriggerServerEvent('ffa:createLobby', data)
    cb('ok')
end)

RegisterNUICallback('joinLobby', function(data, cb)
    TriggerServerEvent('ffa:joinLobby', data.lobbyId, data.mapId)
    cb('ok')
end)

RegisterNUICallback('fetchLobbies', function(data, cb)
    TriggerServerEvent('ffa:fetchLobbies', data)
    cb('ok')
end)

RegisterNetEvent('ffa:updateLobbies')
AddEventHandler('ffa:updateLobbies', function(lobbies)
    SendNUIMessage({ action = 'updateLobbies', lobbies = lobbies })
end)

RegisterNUICallback('sendLobbyChat', function(data, cb)
    TriggerServerEvent('ffa:sendLobbyChat', data)
    cb('ok')
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

RegisterNUICallback('closeLobby', function(data, cb)
    TriggerServerEvent('ffa:closeLobby')
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

RegisterNUICallback('saveSettings', function(data, cb)
    TriggerServerEvent('ffa:updateSettings', data)
    cb('ok')
end)

RegisterNUICallback('getStats', function(data, cb)
    TriggerServerEvent('ffa:getStats')
    cb('ok')
end)

RegisterNetEvent('ffa:receiveStats')
AddEventHandler('ffa:receiveStats', function(stats)
    SendNUIMessage({ action = 'receiveStats', kills = stats.kills, deaths = stats.deaths, wins = stats.wins })
end)

RegisterNUICallback('closeWinnerScreen', function(data, cb)
    CloseMenu()
    cb('ok')
end)
