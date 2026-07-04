ESX = exports['es_extended']:getSharedObject()

-- Globale Variablen zur Speicherung des aktuellen Spieler- und Lobby-Status
playerState = {
    kills = 0,
    deaths = 0,
    team = 'none',
    isInGame = false
}
currentLobby = nil
spawnedVehicle = nil

-- Globaler Countdown-Handler, der die NUI informiert und den Spieler nach Ablauf freigibt
function StartCountdown(seconds)
    Citizen.CreateThread(function()
        while seconds >= 0 do
            SendNUIMessage({
                action = 'countdown',
                seconds = seconds
            })
            if seconds == 0 then
                -- Spieler darf sich nach dem Countdown wieder bewegen
                FreezeEntityPosition(PlayerPedId(), false)
            end
            Citizen.Wait(1000)
            seconds = seconds - 1
        end
    end)
end

-- Stellt den ursprünglichen Zustand des Spielers nach Verlassen einer Lobby wieder her
RegisterNetEvent('ffa:restoreState')
AddEventHandler('ffa:restoreState', function(oldCoords)
    local ped = PlayerPedId()

    playerState.isInGame = false
    currentLobby = nil

    -- Falls ein Fahrzeug gespawnt wurde, dieses entfernen
    if spawnedVehicle then
        if DoesEntityExist(spawnedVehicle) then
            DeleteEntity(spawnedVehicle)
        end
        spawnedVehicle = nil
    end

    -- Waffen entfernen und das ursprüngliche ESX Loadout laden
    RemoveAllPedWeapons(ped, true)
    TriggerEvent('esx:restoreLoadout')

    -- Sanfter Übergang zurück zur alten Position
    DoScreenFadeOut(500)
    while not IsScreenFadedOut() do Wait(0) end

    if oldCoords then
        SetEntityCoords(ped, oldCoords.x, oldCoords.y, oldCoords.z, false, false, false, true)
    end

    Wait(500)
    DoScreenFadeIn(500)
    FreezeEntityPosition(ped, false)
    NetworkSetInSpectatorMode(false, ped)

    -- UI-Elemente ausblenden
    SendNUIMessage({ action = 'hideHUD' })
    SendNUIMessage({ action = 'close' })
    SetNuiFocus(false, false)
end)

-- Teleportiert den Spieler zu einem zufälligen Spawn-Punkt einer Map
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
        -- Spieler während des Countdowns fixieren
        FreezeEntityPosition(ped, true)
    end
end

-- Thread zur regelmäßigen Aktualisierung der HUD-Details (Leben, Rüstung, Munition)
Citizen.CreateThread(function()
    while true do
        if playerState.isInGame then
            local ped = PlayerPedId()
            -- Gesundheit normalisieren (GTA nutzt 100-200 standardmäßig)
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
