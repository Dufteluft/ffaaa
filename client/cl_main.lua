ESX = exports['es_extended']:getSharedObject()

-- Globaler Spieler-Status
playerState = {
    kills = 0,
    deaths = 0,
    team = 'none',
    isInGame = false
}
currentLobby = nil

-- Funktion: Startet einen Countdown vor dem Match
function StartCountdown(seconds)
    Citizen.CreateThread(function()
        while seconds >= 0 do
            SendNUIMessage({ action = 'countdown', seconds = seconds })
            if seconds == 0 then
                -- Spieler freigeben, wenn Countdown abgelaufen ist
                FreezeEntityPosition(PlayerPedId(), false)
            end
            Wait(1000)
            seconds = seconds - 1
        end
    end)
end

-- Event: Stellt den Status des Spielers nach Verlassen einer Lobby wieder her
RegisterNetEvent('ffa:restoreState')
AddEventHandler('ffa:restoreState', function(oldCoords)
    local ped = PlayerPedId()
    playerState.isInGame = false
    currentLobby = nil

    -- Waffen entfernen und ESX-Loadout wiederherstellen
    RemoveAllPedWeapons(ped, true)
    TriggerEvent('esx:restoreLoadout')

    -- Sanfter Übergang zur alten Position
    DoScreenFadeOut(500)
    while not IsScreenFadedOut() do Wait(0) end

    if oldCoords then
        SetEntityCoords(ped, oldCoords.x, oldCoords.y, oldCoords.z, false, false, false, true)
    end

    Wait(500)
    DoScreenFadeIn(500)
    FreezeEntityPosition(ped, false)

    -- UI-Elemente ausblenden
    SendNUIMessage({ action = 'hideHUD' })
    SendNUIMessage({ action = 'close' })
    SetNuiFocus(false, false)
end)

-- Funktion: Teleportiert den Spieler zur gewählten Map
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
        -- Spieler fixieren bis zum Start
        FreezeEntityPosition(ped, true)
    end
end

-- Thread: Aktualisiert HUD-Details (Leben, Rüstung, Munition) alle 500ms
Citizen.CreateThread(function()
    while true do
        if playerState and playerState.isInGame then
            local ped = PlayerPedId()
            local health = GetEntityHealth(ped) - 100
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
