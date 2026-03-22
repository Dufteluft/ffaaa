ESX = exports['es_extended']:getSharedObject()

local isMenuOpen = false

-- Menü-Steuerung (F5 öffnet/schließt Menü)
Citizen.CreateThread(function()
    local key = 166 -- Standard F5
    if Config.MenuKey == 'F1' then key = 288
    elseif Config.MenuKey == 'F2' then key = 289
    elseif Config.MenuKey == 'F3' then key = 170
    elseif Config.MenuKey == 'F5' then key = 166
    elseif Config.MenuKey == 'F6' then key = 167
    end

    -- Key Mapping nutzen statt Thread für bessere Performance
    RegisterKeyMapping('openffamenu', 'FFA Lobby Menü öffnen', 'keyboard', Config.MenuKey)
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

-- Befehl zum Verlassen der FFA Lobby
RegisterCommand('quitffa', function()
    if playerState.isInGame then
        TriggerServerEvent('ffa:leaveLobby')
    else
        ESX.ShowNotification('Du bist in keiner FFA Lobby.')
    end
end, false)

-- Lobby Events vom Server
RegisterNetEvent('ffa:lobbyCreated')
AddEventHandler('ffa:lobbyCreated', function(lobby)
    currentLobby = lobby
    SendNUIMessage({
        action = 'lobbyCreated',
        lobby = lobby
    })
end)

RegisterNetEvent('ffa:lobbyJoined')
AddEventHandler('ffa:lobbyJoined', function(lobby)
    currentLobby = lobby
    SendNUIMessage({
        action = 'lobbyJoined',
        lobby = lobby
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
    SendNUIMessage({ action = 'hideHUD' })
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

RegisterNUICallback('closeWinnerScreen', function(data, cb)
    isMenuOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
    cb('ok')
end)
