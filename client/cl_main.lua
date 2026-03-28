ESX = exports['es_extended']:getSharedObject()

-- Global variables for access from all client scripts
playerState = {
    kills = 0,
    deaths = 0,
    team = 'none',
    isInGame = false
}
currentLobby = nil

-- Key mapping for the main menu
RegisterKeyMapping('openffamenu', 'Open FFA Lobby Menu', 'keyboard', Config.MenuKey)

RegisterCommand('openffamenu', function()
    OpenMainMenu()
end, false)

-- Global countdown handler for all players
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

-- Restore player state after match/lobby
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
    NetworkSetInSpectatorMode(false, ped)

    SendNUIMessage({ action = 'hideHUD' })
    SendNUIMessage({ action = 'close' })
    SetNuiFocus(false, false)
end)

-- Teleport to map
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

-- HUD Updater
Citizen.CreateThread(function()
    while true do
        if playerState.isInGame then
            local ped = PlayerPedId()
            local health = math.floor((GetEntityHealth(ped) - 100) / (GetEntityMaxHealth(ped) - 100) * 100)
            if health < 0 then health = 0 end
            local armor = GetPedArmour(ped)
            local weapon = GetSelectedPedWeapon(ped)
            local _, ammo = GetAmmoInClip(ped, weapon)
            local totalAmmo = GetAmmoInPedWeapon(ped, weapon)

            SendNUIMessage({
                action = 'updateHUDDetails',
                health = health,
                armor = armor,
                ammo = ammo .. " / " .. (totalAmmo - ammo)
            })
        end
        Wait(500)
    end
end)
