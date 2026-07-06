ESX = exports['es_extended']:getSharedObject()

-- Globale Variablen für den Zugriff aus allen Client-Skripten
playerState = {
    kills = 0,
    deaths = 0,
    team = 'none',
    isInGame = false
}
currentLobby = nil
spawnedVehicle = nil

-- Globaler Countdown-Handler für alle Spieler
function StartCountdown(seconds)
    Citizen.CreateThread(function()
        while seconds >= 0 do
            SendNUIMessage({
                action = 'countdown',
                seconds = seconds
            })
            if seconds == 0 then
                -- Spieler nach Countdown freigeben
                FreezeEntityPosition(PlayerPedId(), false)
            end
            Citizen.Wait(1000)
            seconds = seconds - 1
        end
    end)
end

-- Event: Stellt den Spieler-Status wieder her (nach Verlassen der Lobby)
RegisterNetEvent('ffa:restoreState')
AddEventHandler('ffa:restoreState', function(oldCoords)
    local ped = PlayerPedId()

    playerState.isInGame = false
    currentLobby = nil

    -- Fahrzeug löschen falls vorhanden
    if spawnedVehicle and DoesEntityExist(spawnedVehicle) then
        DeleteEntity(spawnedVehicle)
        spawnedVehicle = nil
    end

    -- Alle Waffen entfernen
    RemoveAllPedWeapons(ped, true)

    -- ESX Loadout wiederherstellen
    TriggerEvent('esx:restoreLoadout')

    -- Zur alten Position teleportieren
    DoScreenFadeOut(500)
    while not IsScreenFadedOut() do Wait(0) end

    if oldCoords then
        SetEntityCoords(ped, oldCoords.x, oldCoords.y, oldCoords.z, false, false, false, true)
    end

    -- Beziehungsgruppen zurücksetzen
    SetPedRelationshipGroupHash(ped, GetHashKey('PLAYER'))

    Wait(500)
    DoScreenFadeIn(500)
    FreezeEntityPosition(ped, false)

    -- HUD und Menü ausblenden
    SendNUIMessage({ action = 'hideHUD' })
    SendNUIMessage({ action = 'close' })
    SetNuiFocus(false, false)
end)

-- Globaler Teleport-Handler mit Screen-Fade
function TeleportToMap(mapId)
    local map = Utils.GetMapById(mapId)
    if map then
        local spawn = Utils.GetRandomSpawn(mapId)
        local ped = PlayerPedId()
        DoScreenFadeOut(500)
        while not IsScreenFadedOut() do Wait(0) end

        SetEntityCoords(ped, spawn.x, spawn.y, spawn.z, false, false, false, true)
        SetEntityHeading(ped, spawn.w)

        Wait(500)
        DoScreenFadeIn(500)
        FreezeEntityPosition(ped, true) -- Eingefroren bis Countdown endet
    end
end

-- HUD-Updater: Alle 500ms Leben, Rüstung und Munition an NUI senden
Citizen.CreateThread(function()
    while true do
        if playerState and playerState.isInGame then
            local ped = PlayerPedId()
            local health = GetEntityHealth(ped) - 100
            local armor = GetPedArmour(ped)
            local weapon = GetSelectedPedWeapon(ped)
            local ammo = 0

            if weapon ~= GetHashKey('WEAPON_UNARMED') then
                _, ammo = GetAmmoInClip(ped, weapon)
            end

            SendNUIMessage({
                action = 'updateHUDDetails',
                health = health,
                armor = armor,
                ammo = ammo
            })
        end
        Wait(500)
    end
end)

-- Event: Spielstart-Vorbereitung (Verschoben von cl_gameplay für bessere Struktur)
RegisterNetEvent('ffa:gameStarting')
AddEventHandler('ffa:gameStarting', function(lobby)
    currentLobby = lobby
    playerState.isInGame = true
    playerState.kills = 0
    playerState.deaths = 0

    -- UI ausblenden
    SendNUIMessage({ action = 'gameStarting' })
    SetNuiFocus(false, false)

    -- Auf Karte teleportieren
    TeleportToMap(lobby.mapId)

    if lobby.isPersistent then
        FreezeEntityPosition(PlayerPedId(), false)
        SendNUIMessage({ action = 'countdown', seconds = 0 })
    else
        StartCountdown(10)
    end

    -- Waffen austeilen
    GiveLoadout(lobby.loadout)

    -- HUD einblenden
    SendNUIMessage({
        action = 'showHUD',
        isPersistent = lobby.isPersistent
    })

    -- Initiale HUD Werte
    TriggerEvent('ffa:updateHUDStats', 0, 0)
    if lobby.mode == 'tdm' then
        TriggerEvent('ffa:updateTDMScore', 0, 0)
    end
end)
