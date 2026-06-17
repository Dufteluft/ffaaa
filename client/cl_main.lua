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
RegisterKeyMapping('openffamenu', 'Open FFA Menu', 'keyboard', Config.MenuKey)

RegisterCommand('openffamenu', function()
    OpenMainMenu()
end, false)

-- Global countdown handler
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

-- Event: Restore state when leaving lobby
RegisterNetEvent('ffa:restoreState')
AddEventHandler('ffa:restoreState', function(oldCoords)
    local ped = PlayerPedId()

    playerState.isInGame = false
    currentLobby = nil
    playerState.team = 'none'

    RemoveAllPedWeapons(ped, true)
    TriggerEvent('esx:restoreLoadout')

    -- Cleanup spawned vehicles if any
    if currentVehicle then
        DeleteEntity(currentVehicle)
        currentVehicle = nil
    end

    -- Reset relationship groups
    SetPedRelationshipGroupHash(ped, GetHashKey('PLAYER'))

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

-- HUD details updater
Citizen.CreateThread(function()
    while true do
        if playerState and playerState.isInGame then
            local ped = PlayerPedId()
            local health = GetEntityHealth(ped) - 100
            if health < 0 then health = 0 end
            local armor = GetPedArmour(ped)
            local _, ammo = GetAmmoInClip(ped, GetSelectedPedWeapon(ped))

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

-- Play sound event
RegisterNetEvent('ffa:playSound')
AddEventHandler('ffa:playSound', function(sound)
    SendNUIMessage({
        action = 'playSound',
        sound = sound
    })
end)
