ESX = exports['es_extended']:getSharedObject()

-- Globale Variablen
playerState = { kills = 0, deaths = 0, team = 'none', isInGame = false }
currentLobby = nil

function StartCountdown(seconds)
    Citizen.CreateThread(function()
        while seconds >= 0 do
            SendNUIMessage({ action = 'countdown', seconds = seconds })
            if seconds == 0 then FreezeEntityPosition(PlayerPedId(), false) end
            Citizen.Wait(1000)
            seconds = seconds - 1
        end
    end)
end

RegisterNetEvent('ffa:restoreState')
AddEventHandler('ffa:restoreState', function(oldCoords)
    local ped = PlayerPedId()
    playerState.isInGame = false
    currentLobby = nil
    RemoveAllPedWeapons(ped, true)
    TriggerEvent('esx:restoreLoadout')

    DoScreenFadeOut(500)
    while not IsScreenFadedOut() do Wait(0) end
    if oldCoords then SetEntityCoords(ped, oldCoords.x, oldCoords.y, oldCoords.z) end
    Wait(500)
    DoScreenFadeIn(500)
    FreezeEntityPosition(ped, false)
    SendNUIMessage({ action = 'hideHUD' })
    SetNuiFocus(false, false)
end)

function TeleportToMap(mapId)
    local map = Utils.GetMapById(mapId)
    if map then
        local spawn = Utils.GetRandomSpawn(mapId)
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

-- HUD-Updater
Citizen.CreateThread(function()
    while true do
        if playerState.isInGame then
            local ped = PlayerPedId()
            local maxHealth = GetEntityMaxHealth(ped)
            local health = GetEntityHealth(ped)
            local healthPct = math.floor(((health - 100) / (maxHealth - 100)) * 100)
            if healthPct < 0 then healthPct = 0 end

            local armor = GetPedArmour(ped)
            local _, ammo = GetAmmoInClip(ped, GetSelectedPedWeapon(ped))

            SendNUIMessage({
                action = 'updateHUDDetails',
                health = healthPct,
                armor = armor,
                ammo = ammo
            })
        end
        Wait(500)
    end
end)

RegisterNetEvent('ffa:syncLobbyData')
AddEventHandler('ffa:syncLobbyData', function(lobby)
    currentLobby = lobby
    SendNUIMessage({ action = 'lobbyJoined', lobby = lobby })
end)

RegisterNetEvent('ffa:returnToLobby')
AddEventHandler('ffa:returnToLobby', function(lobby)
    currentLobby = lobby
    playerState.isInGame = false
    FreezeEntityPosition(PlayerPedId(), false)
    SendNUIMessage({ action = 'hideHUD' })
    SendNUIMessage({ action = 'lobbyJoined', lobby = lobby })
    SetNuiFocus(true, true)
end)
