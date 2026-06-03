ESX = exports['es_extended']:getSharedObject()

-- Global state variables
playerState = {
    kills = 0,
    deaths = 0,
    team = 'none',
    isInGame = false
}
currentLobby = nil
playerVehicle = nil

-- Key mapping for the menu
RegisterKeyMapping('openffamenu', 'Open FFA Menu', 'keyboard', Config.MenuKey)

RegisterCommand('openffamenu', function()
    TriggerEvent('ffa:toggleMenu')
end, false)

-- Global Countdown handler
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

-- Teleport and setup for map
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

-- Restore player state after leaving
RegisterNetEvent('ffa:restoreState')
AddEventHandler('ffa:restoreState', function(oldCoords)
    local ped = PlayerPedId()

    playerState.isInGame = false
    currentLobby = nil

    if DoesEntityExist(playerVehicle) then
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

    SendNUIMessage({ action = 'hideHUD' })
    SendNUIMessage({ action = 'close' })
    SetNuiFocus(false, false)
end)

-- HUD Update Loop
Citizen.CreateThread(function()
    while true do
        if playerState.isInGame then
            local ped = PlayerPedId()
            local health = GetEntityHealth(ped)
            local maxHealth = GetEntityMaxHealth(ped)
            local armor = GetPedArmour(ped)

            -- Calculate health percentage (GTA uses 100-200 for players)
            local healthPct = math.max(0, (health - 100) / (maxHealth - 100) * 100)

            local weapon = GetSelectedPedWeapon(ped)
            local _, ammo = GetAmmoInClip(ped, weapon)
            local totalAmmo = GetAmmoInPedWeapon(ped, weapon)

            SendNUIMessage({
                action = 'updateHUDDetails',
                health = healthPct,
                armor = armor,
                ammo = string.format("%d / %d", ammo, totalAmmo - ammo)
            })
        end
        Wait(500)
    end
end)
