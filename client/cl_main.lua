ESX = exports['es_extended']:getSharedObject()

-- Globale Variablen
playerState = {
    kills = 0,
    deaths = 0,
    team = 'none',
    isInGame = false
}
currentLobby = nil

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

-- Teleport-Handler
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

-- State Restore
RegisterNetEvent('ffa:restoreState')
AddEventHandler('ffa:restoreState', function(oldCoords)
    local ped = PlayerPedId()

    playerState.isInGame = false
    currentLobby = nil

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

    SendNUIMessage({ action = 'close' })
    SetNuiFocus(false, false)
end)

-- HUD-Updater
Citizen.CreateThread(function()
    while true do
        if playerState and playerState.isInGame then
            local ped = PlayerPedId()
            local health = GetEntityHealth(ped)
            local maxHealth = GetEntityMaxHealth(ped)
            local healthPercent = math.max(0, ((health - 100) / (maxHealth - 100)) * 100)
            local armor = GetPedArmour(ped)

            local weapon = GetSelectedPedWeapon(ped)
            local _, ammo = GetAmmoInClip(ped, weapon)
            local totalAmmo = GetAmmoInPedWeapon(ped, weapon)

            SendNUIMessage({
                action = 'updateHUDDetails',
                health = healthPercent,
                armor = armor,
                ammo = string.format("%d / %d", ammo, (totalAmmo - ammo >= 0) and (totalAmmo - ammo) or 0)
            })
        end
        Wait(250)
    end
end)
