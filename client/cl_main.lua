ESX = exports['es_extended']:getSharedObject()

-- Globale Variablen für den Zugriff aus allen Client-Skripten
playerState = {
    kills = 0,
    deaths = 0,
    team = 'none',
    isInGame = false
}
currentLobby = nil

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

    -- Alle Waffen entfernen
    RemoveAllPedWeapons(ped, true)

    -- ESX Loadout wiederherstellen (falls vorhanden)
    TriggerEvent('esx:restoreLoadout')

    -- Zur alten Position teleportieren
    DoScreenFadeOut(500)
    while not IsScreenFadedOut() do Wait(0) end

    if oldCoords then
        SetEntityCoords(ped, oldCoords.x, oldCoords.y, oldCoords.z, false, false, false, true)
    end

    Wait(500)
    DoScreenFadeIn(500)
    FreezeEntityPosition(ped, false)

    -- HUD und Menü ausblenden
    SendNUIMessage({ action = 'hideHUD' })
    SendNUIMessage({ action = 'close' })
    SetNuiFocus(false, false)
end)

-- Globaler Teleport-Handler mit Screen-Fade für weiche Übergänge
function TeleportToMap(mapId)
    local map = Utils.GetMapById(mapId)
    if map then
        local spawn = Utils.GetRandomSpawn(mapId)
        local ped = PlayerPedId()
        DoScreenFadeOut(500)
        while not IsScreenFadedOut() do Wait(0) end

        -- Kollision laden sicherstellen
        RequestCollisionAtCoord(spawn.x, spawn.y, spawn.z)
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
            local health = GetEntityHealth(ped)
            local maxHealth = GetEntityMaxHealth(ped)
            local healthPercent = (health > 100) and ((health - 100) / (maxHealth - 100) * 100) or 0

            local armor = GetPedArmour(ped)
            local _, ammo = GetAmmoInClip(ped, GetSelectedPedWeapon(ped))

            SendNUIMessage({
                action = 'updateHUDDetails',
                health = healthPercent,
                armor = armor,
                ammo = ammo
            })
        end
        Wait(500)
    end
end)
