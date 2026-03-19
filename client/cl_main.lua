ESX = exports['es_extended']:getSharedObject()

-- Globaler Spieler-Status
playerState = {
    kills = 0,
    deaths = 0,
    team = 'none',
    isInGame = false
}
currentLobby = nil

-- Hauptmenü öffnen via KeyMapping (F5 Standard)
RegisterKeyMapping('openffamenu', 'FFA Lobby Menü öffnen', 'keyboard', Config.MenuKey)

RegisterCommand('openffamenu', function()
    if not IsEntityDead(PlayerPedId()) then
        OpenMainMenu()
    end
end, false)

-- Globaler Countdown Handler
function StartCountdown(seconds)
    Citizen.CreateThread(function()
        while seconds >= 0 do
            SendNUIMessage({
                action = 'countdown',
                seconds = seconds
            })
            if seconds == 0 then
                -- Spieler freigeben wenn Countdown beendet
                FreezeEntityPosition(PlayerPedId(), false)
            end
            Citizen.Wait(1000)
            seconds = seconds - 1
        end
    end)
end

-- Teleport-Funktion mit Screen-Fade
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
        FreezeEntityPosition(ped, true) -- Eingefroren bis Rundenstart
    end
end

-- State-Wiederherstellung beim Verlassen der Lobby
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

-- HUD-Aktualisierungs Loop (Alle 500ms)
Citizen.CreateThread(function()
    while true do
        if playerState.isInGame then
            local ped = PlayerPedId()
            local maxHealth = GetEntityMaxHealth(ped)
            local health = (GetEntityHealth(ped) / maxHealth) * 100
            local armor = GetPedArmour(ped)

            local currentWeapon = GetSelectedPedWeapon(ped)
            local _, ammoInClip = GetAmmoInClip(ped, currentWeapon)
            local ammoTotal = GetAmmoInPedWeapon(ped, currentWeapon)

            SendNUIMessage({
                action = 'updateHUDDetails',
                health = math.floor(health),
                armor = math.floor(armor),
                ammo = string.format("%d / %d", ammoInClip, ammoTotal - ammoInClip)
            })
        end
        Wait(500)
    end
end)
