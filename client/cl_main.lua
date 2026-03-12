ESX = exports['es_extended']:getSharedObject()

playerState = {
    kills = 0,
    deaths = 0,
    team = 'none',
    isInGame = false
}
currentLobby = nil

-- Globaler Countdown
function StartCountdown(seconds)
    Citizen.CreateThread(function()
        while seconds >= 0 do
            SendNUIMessage({ action = 'countdown', seconds = seconds })
            if seconds == 0 then
                FreezeEntityPosition(PlayerPedId(), false)
                break
            end
            Citizen.Wait(1000)
            seconds = seconds - 1
        end
    end)
end

-- State Restoration
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
        SetEntityCoords(ped, oldCoords.x, oldCoords.y, oldCoords.z)
    end

    Wait(500)
    DoScreenFadeIn(500)
    FreezeEntityPosition(ped, false)

    SendNUIMessage({ action = 'hideHUD' })
    SetNuiFocus(false, false)
end)

function TeleportToMap(mapId)
    local spawn = Utils.GetRandomSpawn(mapId)
    if spawn then
        local ped = PlayerPedId()
        DoScreenFadeOut(500)
        while not IsScreenFadedOut() do Wait(0) end

        SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
        SetEntityHeading(ped, spawn.w)

        Wait(500)
        DoScreenFadeIn(500)
        FreezeEntityPosition(ped, true)
    end
end

-- HUD Loop
Citizen.CreateThread(function()
    while true do
        if playerState.isInGame then
            local ped = PlayerPedId()
            local health = (GetEntityHealth(ped) - 100)
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
