ESX = exports['es_extended']:getSharedObject()

-- Lokale Variable für das Menü-Status
local isMenuOpen = false

-- Hauptmenü öffnen Funktion
function OpenMainMenu()
    if isMenuOpen then
        -- Menü schließen, wenn es bereits offen ist
        isMenuOpen = false
        SetNuiFocus(false, false)
        SendNUIMessage({ action = 'close' })
        return
    end

    -- Menü öffnen und Daten an die NUI senden
    isMenuOpen = true
    SetNuiFocus(true, true)
    SendNUIMessage({
        action = 'open',
        config = Config,
        maps = Config.Maps,
        isInGame = playerState.isInGame
    })
end

-- Callback: UI schließen (wird vom JS aufgerufen)
RegisterNUICallback('closeUI', function(data, cb)
    isMenuOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
    cb('ok')
end)

-- Befehl zum schnellen Verlassen der FFA Lobby
RegisterCommand('quitffa', function()
    if playerState.isInGame then
        TriggerServerEvent('ffa:leaveLobby')
    else
        ESX.ShowNotification('Du bist in keiner FFA Lobby.')
    end
end, false)

-- Lobby Events vom Server empfangen
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

-- Aktualisierung der Spielerliste in der NUI
RegisterNetEvent('ffa:updateLobbyPlayers')
AddEventHandler('ffa:updateLobbyPlayers', function(players)
    SendNUIMessage({
        action = 'updateLobbyPlayers',
        players = players
    })
end)

-- Spieler hat die Lobby erfolgreich verlassen
RegisterNetEvent('ffa:leftLobby')
AddEventHandler('ffa:leftLobby', function()
    currentLobby = nil
    playerState.isInGame = false
end)

-- NUI Callbacks für verschiedene Lobby-Aktionen
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

-- Lobbyliste vom Server aktualisieren
RegisterNetEvent('ffa:updateLobbies')
AddEventHandler('ffa:updateLobbies', function(lobbies)
    SendNUIMessage({
        action = 'updateLobbies',
        lobbies = lobbies
    })
end)

-- Lobby-Chat Funktionen
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

-- Bereitschafts-Status umschalten
RegisterNUICallback('toggleReady', function(data, cb)
    TriggerServerEvent('ffa:toggleReady')
    cb('ok')
end)

-- Team wählen
RegisterNUICallback('setTeam', function(data, cb)
    TriggerServerEvent('ffa:setTeam', data.team)
    cb('ok')
end)

-- Spiel durch den Host starten
RegisterNUICallback('startGame', function(data, cb)
    TriggerServerEvent('ffa:startGame')
    cb('ok')
end)

-- Lobby verlassen via Button
RegisterNUICallback('leaveLobby', function(data, cb)
    TriggerServerEvent('ffa:leaveLobby')
    cb('ok')
end)

-- Spieler kicken (nur Host)
RegisterNUICallback('kickPlayer', function(data, cb)
    TriggerServerEvent('ffa:kickPlayer', data.id)
    cb('ok')
end)

-- Map Vote Callback
RegisterNUICallback('voteMap', function(data, cb)
    TriggerServerEvent('ffa:voteMap', data.mapId)
    cb('ok')
end)

-- Winner Screen schließen und zur Lobby zurückkehren
RegisterNUICallback('closeWinnerScreen', function(data, cb)
    isMenuOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
    cb('ok')
end)
