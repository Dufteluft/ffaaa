ESX = exports['es_extended']:getSharedObject()

-- Globale Variablen für den Zugriff aus allen Client-Skripten
playerState = {
    kills = 0,
    deaths = 0,
    team = 'none',
    isInGame = false
}
currentLobby = nil
playerVehicle = nil

-- Key Mapping für das Menü (F5 Standard)
RegisterKeyMapping('openffamenu', 'FFA Menü öffnen', 'keyboard', Config.MenuKey)

RegisterCommand('openffamenu', function()
    OpenMainMenu()
end, false)

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
                TriggerEvent('ffa:playSound', 'start')
            end
            Citizen.Wait(1000)
            seconds = seconds - 1
        end
    end)
end

-- Sound Trigger
RegisterNetEvent('ffa:playSound')
AddEventHandler('ffa:playSound', function(sound)
    SendNUIMessage({ action = 'playSound', sound = sound })
end)

-- Event: Stellt den Spieler-Status wieder her
RegisterNetEvent('ffa:restoreState')
AddEventHandler('ffa:restoreState', function(oldCoords)
    local ped = PlayerPedId()

    playerState.isInGame = false
    currentLobby = nil

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

-- HUD-Updater
Citizen.CreateThread(function()
    while true do
        if playerState and playerState.isInGame then
            local ped = PlayerPedId()
            local health = GetEntityHealth(ped)
            local maxHealth = GetEntityMaxHealth(ped)
            -- GTA Gesundheit ist oft 100-200. Wir wollen 0-100%
            local healthPercent = (health - 100) / (maxHealth - 100) * 100
            if healthPercent < 0 then healthPercent = 0 end

            local armor = GetPedArmour(ped)
            local weapon = GetSelectedPedWeapon(ped)
            local _, ammo = GetAmmoInClip(ped, weapon)
            local totalAmmo = GetAmmoInPedWeapon(ped, weapon)

            SendNUIMessage({
                action = 'updateHUDDetails',
                health = healthPercent,
                armor = armor,
                ammo = ammo .. ' / ' .. (totalAmmo - ammo)
            })
        end
        Wait(250)
    end
end)
