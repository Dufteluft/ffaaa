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
    if playerVehicle then
        DeleteEntity(playerVehicle)
        playerVehicle = nil
    end

    RemoveAllPedWeapons(ped, true)
    TriggerEvent('esx:restoreLoadout')

    DoScreenFadeOut(500)
    while not IsScreenFadedOut() do Wait(0) end

    if oldCoords then
        SetEntityCoords(ped, oldCoords.x, oldCoords.y, oldCoords.z, false, false, false, true)
    end

    Wait(500)
    DoScreenFadeIn(500)
    FreezeEntityPosition(ped, false)
    NetworkSetInSpectatorMode(false, ped)

    SendNUIMessage({ action = 'hideHUD' })
    SendNUIMessage({ action = 'close' })
    SetNuiFocus(false, false)
end)

-- Teleport-Handler
function TeleportToMap(mapId)
    local spawn = Utils.GetRandomSpawn(mapId)
    local ped = PlayerPedId()
    if spawn then
        DoScreenFadeOut(500)
        while not IsScreenFadedOut() do Wait(0) end

        SetEntityCoords(ped, spawn.x, spawn.y, spawn.z, false, false, false, true)
        SetEntityHeading(ped, spawn.w)

        Wait(500)
        DoScreenFadeIn(500)
        FreezeEntityPosition(ped, true)
    end
end

-- HUD-Updater
Citizen.CreateThread(function()
    while true do
        if playerState.isInGame then
            local ped = PlayerPedId()
            local maxHealth = GetEntityMaxHealth(ped)
            local health = GetEntityHealth(ped)

            -- GTA Health ist 100-200. Umrechnung auf 0-100%
            local healthPercent = math.floor(((health - 100) / (maxHealth - 100)) * 100)
            if healthPercent < 0 then healthPercent = 0 end

            local armor = GetPedArmour(ped)
            local weapon = GetSelectedPedWeapon(ped)
            local ammo = GetAmmoInClip(ped, weapon)

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
