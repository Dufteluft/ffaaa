ESX = exports['es_extended']:getSharedObject()

-- Globale Variablen
playerState = {
    kills = 0,
    deaths = 0,
    team = 'none',
    isInGame = false
}
currentLobby = nil
playerVehicle = nil

-- Menü-Steuerung via RegisterKeyMapping (Standard F5)
RegisterCommand('openffamenu', function()
    TriggerEvent('ffa:toggleMenu')
end, false)

RegisterKeyMapping('openffamenu', 'FFA Menü öffnen', 'keyboard', Config.MenuKey)

-- Globaler Countdown-Handler
function StartCountdown(seconds)
    Citizen.CreateThread(function()
        while seconds >= 0 do
            SendNUIMessage({
                action = 'countdown',
                seconds = seconds
            })
            if seconds == 0 then
                FreezeEntityPosition(PlayerPedId(), false)
            end
            Citizen.Wait(1000)
            seconds = seconds - 1
        end
    end)
end

-- Event: Stellt den Spieler-Status wieder her
RegisterNetEvent('ffa:restoreState')
AddEventHandler('ffa:restoreState', function(oldCoords)
    local ped = PlayerPedId()

    playerState.isInGame = false
    currentLobby = nil

    -- Fahrzeug löschen falls vorhanden
    if playerVehicle and DoesEntityExist(playerVehicle) then
        DeleteEntity(playerVehicle)
        playerVehicle = nil
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

    Wait(500)
    DoScreenFadeIn(500)
    FreezeEntityPosition(ped, false)

    -- HUD und Menü ausblenden
    SendNUIMessage({ action = 'hideHUD' })
    SendNUIMessage({ action = 'close' })
    SetNuiFocus(false, false)
end)

-- Globaler Teleport-Handler
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
        FreezeEntityPosition(ped, true)
    end
end

-- HUD-Updater: Leben, Rüstung und Munition
Citizen.CreateThread(function()
    while true do
        if playerState.isInGame then
            local ped = PlayerPedId()
            local health = GetEntityHealth(ped)
            local maxHealth = GetEntityMaxHealth(ped)

            -- Normalisierung der Gesundheit (GTA nutzt 100-200)
            local healthPercent = math.floor(((health - 100) / (maxHealth - 100)) * 100)
            if healthPercent < 0 then healthPercent = 0 end

            local armorPercent = GetPedArmour(ped)

            local weapon = GetSelectedPedWeapon(ped)
            local _, ammo = GetAmmoInClip(ped, weapon)
            local totalAmmo = GetAmmoInPedWeapon(ped, weapon)

            SendNUIMessage({
                action = 'updateHUDDetails',
                health = healthPercent,
                armor = armorPercent,
                ammo = ammo .. ' / ' .. (totalAmmo - ammo)
            })
        end
        Wait(250) -- Häufigere Updates für flüssiges HUD
    end
end)
