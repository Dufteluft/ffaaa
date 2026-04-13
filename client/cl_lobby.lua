ESX = exports['es_extended']:getSharedObject()

local isMenuOpen = false

-- Menü-Steuerung (Registrierung des Key-Mappings für FiveM)
RegisterKeyMapping('openFFAMenu', 'FFA Lobby Menü öffnen', 'keyboard', Config.MenuKey)

RegisterCommand('openFFAMenu', function()
    OpenMainMenu()
end, false)

-- Funktion: Hauptmenü öffnen
function OpenMainMenu()
    if isMenuOpen then
        CloseUI()
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

    -- Statistiken anfordern
    TriggerServerEvent('ffa:getStats')
end

function CloseUI()
    isMenuOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
end

-- Callback: UI schließen (vom JS aufgerufen)
RegisterNUICallback('closeUI', function(data, cb)
    CloseUI()
    cb('ok')
end)

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

-- NUI Callbacks für Menü-Aktionen
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

-- Lobbyliste aktualisieren
RegisterNetEvent('ffa:updateLobbies')
AddEventHandler('ffa:updateLobbies', function(lobbies)
    SendNUIMessage({
        action = 'updateLobbies',
        lobbies = lobbies
    })
end)

-- Lobby-Chat Event-Handling
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

-- Statistiken empfangen
RegisterNetEvent('ffa:receiveStats')
AddEventHandler('ffa:receiveStats', function(stats)
    local kd = (stats.deaths > 0) and (stats.kills / stats.deaths) or (stats.kills + 0.0)
    SendNUIMessage({
        action = 'updateStats',
        kills = stats.kills,
        deaths = stats.deaths,
        kd = string.format("%.2f", kd)
    })
end)

-- Weitere Steuerungs-Callbacks
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

RegisterNUICallback('closeWinnerScreen', function(data, cb)
    isMenuOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
    cb('ok')
end)
