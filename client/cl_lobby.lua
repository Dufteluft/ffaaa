ESX = exports['es_extended']:getSharedObject()

local isMenuOpen = false

-- Menü-Steuerung
Citizen.CreateThread(function()
    local key = 166 -- Default F5
    if Config.MenuKey == 'F1' then key = 288
    elseif Config.MenuKey == 'F2' then key = 289
    elseif Config.MenuKey == 'F3' then key = 170
    elseif Config.MenuKey == 'F5' then key = 166
    elseif Config.MenuKey == 'F6' then key = 167
    end

    while true do
        Citizen.Wait(0)
        if IsControlJustReleased(0, key) then
            if not playerState.isInGame then
                OpenMainMenu()
            end
        end
    end
end)

function OpenMainMenu()
    isMenuOpen = not isMenuOpen
    SetNuiFocus(isMenuOpen, isMenuOpen)
    if isMenuOpen then
        SendNUIMessage({
            action = 'open',
            config = Config,
            maps = Config.Maps
        })
    else
        SendNUIMessage({ action = 'close' })
    end
end

-- NUI Callbacks
RegisterNUICallback('closeUI', function(data, cb)
    isMenuOpen = false
    SetNuiFocus(false, false)
    cb('ok')
end)

RegisterNUICallback('fetchLobbies', function(data, cb)
    TriggerServerEvent('ffa:fetchLobbies')
    cb('ok')
end)

RegisterNUICallback('createLobby', function(data, cb)
    TriggerServerEvent('ffa:createLobby', data)
    cb('ok')
end)

RegisterNUICallback('joinLobby', function(data, cb)
    TriggerServerEvent('ffa:joinLobby', data.lobbyId)
    cb('ok')
end)

RegisterNUICallback('quickJoin', function(data, cb)
    TriggerServerEvent('ffa:quickJoin', data)
    cb('ok')
end)

RegisterNUICallback('leaveLobby', function(data, cb)
    TriggerServerEvent('ffa:leaveLobby')
    cb('ok')
end)

RegisterNUICallback('toggleReady', function(data, cb)
    TriggerServerEvent('ffa:toggleReady')
    cb('ok')
end)

RegisterNUICallback('setTeam', function(data, cb)
    TriggerServerEvent('ffa:setTeam', data)
    cb('ok')
end)

RegisterNUICallback('startGame', function(data, cb)
    TriggerServerEvent('ffa:startGame')
    cb('ok')
end)

RegisterNUICallback('sendLobbyChat', function(data, cb)
    TriggerServerEvent('ffa:sendLobbyChat', data)
    cb('ok')
end)

RegisterNUICallback('kickPlayer', function(data, cb)
    TriggerServerEvent('ffa:kickPlayer', data)
    cb('ok')
end)

-- Events vom Server
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

RegisterNetEvent('ffa:updateLobbies')
AddEventHandler('ffa:updateLobbies', function(lobbies)
    SendNUIMessage({ action = 'updateLobbies', lobbies = lobbies })
end)

RegisterNetEvent('ffa:addChatMessage')
AddEventHandler('ffa:addChatMessage', function(name, message)
    SendNUIMessage({ action = 'addChatMessage', name = name, message = message })
end)

RegisterNetEvent('ffa:leftLobby')
AddEventHandler('ffa:leftLobby', function()
    currentLobby = nil
    playerState.isInGame = false
    isMenuOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
end)
