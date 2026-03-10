ESX = exports['es_extended']:getSharedObject()

local isMenuOpen = false

-- Key Mapping for the menu
RegisterKeyMapping('openffamenu', 'Open FFA Lobby Menu', 'keyboard', Config.MenuKey)

RegisterCommand('openffamenu', function()
    OpenMainMenu()
end, false)

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

RegisterNUICallback('closeUI', function(data, cb)
    isMenuOpen = false
    SetNuiFocus(false, false)
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

RegisterNUICallback('fetchLobbies', function(data, cb)
    TriggerServerEvent('ffa:fetchLobbies', data)
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

RegisterNUICallback('kickPlayer', function(data, cb)
    TriggerServerEvent('ffa:kickPlayer', data.id)
    cb('ok')
end)

RegisterNUICallback('sendLobbyChat', function(data, cb)
    TriggerServerEvent('ffa:sendLobbyChat', data)
    cb('ok')
end)

RegisterNUICallback('voteMap', function(data, cb)
    TriggerServerEvent('ffa:voteMap', data.mapId)
    cb('ok')
end)

RegisterNUICallback('closeWinnerScreen', function(data, cb)
    isMenuOpen = false
    SetNuiFocus(false, false)
    cb('ok')
end)
