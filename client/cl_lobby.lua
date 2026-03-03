ESX = exports['es_extended']:getSharedObject()

local isMenuOpen = false

-- Menü-Steuerung (konfigurierbare Taste)
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(0)
        local key = Config.MenuKey or 'F5'
        local keyCode = 166 -- Default F5

        -- Mapping bekannter Tasten
        if key == 'F1' then keyCode = 288
        elseif key == 'F2' then keyCode = 289
        elseif key == 'F3' then keyCode = 170
        elseif key == 'F5' then keyCode = 166
        elseif key == 'F6' then keyCode = 167
        end

        if IsControlJustReleased(0, keyCode) then
            ToggleMenu()
        end
    end
end)

function ToggleMenu()
    if isMenuOpen then
        CloseMenu()
    else
        OpenMenu()
    end
end

function OpenMenu()
    isMenuOpen = true
    SetNuiFocus(true, true)
    SendNUIMessage({
        action = 'open',
        config = Config,
        maps = Config.Maps
    })
end

function CloseMenu()
    isMenuOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
end

-- NUI Callbacks
RegisterNUICallback('closeUI', function(data, cb)
    CloseMenu()
    cb('ok')
end)

RegisterNUICallback('fetchLobbies', function(data, cb)
    TriggerServerEvent('ffa:fetchLobbies', data)
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

RegisterNUICallback('leaveLobby', function(data, cb)
    TriggerServerEvent('ffa:leaveLobby')
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

RegisterNUICallback('sendLobbyChat', function(data, cb)
    TriggerServerEvent('ffa:sendLobbyChat', data)
    cb('ok')
end)

RegisterNUICallback('kickPlayer', function(data, cb)
    TriggerServerEvent('ffa:kickPlayer', data.id)
    cb('ok')
end)

-- Server Events -> Client UI
RegisterNetEvent('ffa:updateLobbies')
AddEventHandler('ffa:updateLobbies', function(lobbies)
    SendNUIMessage({ action = 'updateLobbies', lobbies = lobbies })
end)

RegisterNetEvent('ffa:lobbyCreated')
AddEventHandler('ffa:lobbyCreated', function(lobby)
    SendNUIMessage({ action = 'lobbyCreated', lobby = lobby })
end)

RegisterNetEvent('ffa:lobbyJoined')
AddEventHandler('ffa:lobbyJoined', function(lobby)
    SendNUIMessage({ action = 'lobbyJoined', lobby = lobby })
end)

RegisterNetEvent('ffa:updateLobbyPlayers')
AddEventHandler('ffa:updateLobbyPlayers', function(players)
    SendNUIMessage({ action = 'updateLobbyPlayers', players = players })
end)

RegisterNetEvent('ffa:addChatMessage')
AddEventHandler('ffa:addChatMessage', function(name, message)
    SendNUIMessage({ action = 'addChatMessage', name = name, message = message })
end)
