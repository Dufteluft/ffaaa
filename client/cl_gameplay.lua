-- Event: Spielstart-Vorbereitung (Teleportation, Loadout)
RegisterNetEvent('ffa:gameStarting')
AddEventHandler('ffa:gameStarting', function(lobby)
    currentLobby = lobby
    playerState.isInGame = true
    playerState.kills = 0
    playerState.deaths = 0

    -- UI ausblenden
    SendNUIMessage({
        action = 'gameStarting',
        mode = lobby.mode
    })
    SetNuiFocus(false, false)

    -- Teleportation
    TeleportToMap(lobby.mapId)

    if lobby.isPersistent then
        FreezeEntityPosition(PlayerPedId(), false)
        SendNUIMessage({ action = 'countdown', seconds = 0 })
    else
        StartCountdown(10) -- 10 Sekunden Countdown
    end

    -- Waffen austeilen
    GiveLoadout(lobby.loadout)

    -- HUD einblenden
    SendNUIMessage({
        action = 'showHUD',
        mode = lobby.mode,
        isPersistent = lobby.isPersistent
    })

    TriggerEvent('ffa:updateHUDStats', 0, 0)
end)

-- Funktion: Teilt das gewählte Loadout (Array oder String) an den Spieler aus
function GiveLoadout(loadoutData)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    if type(loadoutData) == 'table' then
        for _, key in ipairs(loadoutData) do
            local loadout = Config.WeaponLoadouts[key]
            if loadout then
                for _, weapon in ipairs(loadout) do
                    GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
                end
            end
        end
    elseif type(loadoutData) == 'string' then
        local loadout = Config.WeaponLoadouts[loadoutData]
        if loadout then
            for _, weapon in ipairs(loadout) do
                GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
            end
        end
    end
end

-- Map-Grenzprüfung und Waffen-Validierung
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState.isInGame and currentLobby then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local map = Utils.GetMapById(currentLobby.mapId)

            if map then
                -- Grenzprüfung
                local dist = #(coords - map.center)
                if dist > map.radius then
                    ESX.ShowNotification('~r~Du verlässt das Kampfgebiet!')
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                end

                -- Waffen-Validierung (Anti-Cheat)
                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    local loadoutData = currentLobby.loadout

                    if type(loadoutData) == 'table' then
                        for _, key in ipairs(loadoutData) do
                            local loadout = Config.WeaponLoadouts[key]
                            if loadout then
                                for _, w in ipairs(loadout) do
                                    if GetHashKey(w.name) == currentWeapon then allowed = true; break end
                                end
                            end
                            if allowed then break end
                        end
                    elseif type(loadoutData) == 'string' then
                        local loadout = Config.WeaponLoadouts[loadoutData]
                        if loadout then
                            for _, w in ipairs(loadout) do
                                if GetHashKey(w.name) == currentWeapon then allowed = true; break end
                            end
                        end
                    end

                    if not allowed then
                        RemoveWeaponFromPed(ped, currentWeapon)
                        ESX.ShowNotification('~r~Waffe in dieser Lobby nicht erlaubt!')
                    end
                end
            end
        end
    end
end)

-- Kill-Erkennung
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(0)
        if playerState.isInGame then
            local ped = PlayerPedId()
            if IsEntityDead(ped) then
                local killerId = GetPedKiller(ped)
                local killerServerId = -1

                if IsEntityAPed(killerId) and IsPedAPlayer(killerId) then
                    killerServerId = GetPlayerServerId(NetworkGetPlayerIndexFromPed(killerId))
                end

                TriggerServerEvent('ffa:playerKilled', killerServerId)
                HandleDeath(killerId)

                while IsEntityDead(ped) do Citizen.Wait(100) end
            end
        end
    end
end)

-- Funktion: Behandelt Tod, Kill-Cam/Zuschauen und Respawn
function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local playerPed = PlayerPedId()
        local killerCoords = GetEntityCoords(killerPed)
        local respawnTime = currentLobby.respawnTime or 5

        -- Kill-Cam
        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        SetCamCoord(cam, GetEntityCoords(playerPed))
        PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
        RenderScriptCams(true, true, 1000, true, true)

        Wait(3000)

        -- Spectator-Modus bis Respawn
        if respawnTime > 3 then
            if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
                NetworkSetInSpectatorMode(true, killerPed)
            end
            Wait((respawnTime - 3) * 1000)
            NetworkSetInSpectatorMode(false, playerPed)
        end

        RenderScriptCams(false, true, 500, true, true)
        DestroyCam(cam, true)

        -- Respawn
        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)
    end)
end

-- HUD Updates
RegisterNetEvent('ffa:updateTimer')
AddEventHandler('ffa:updateTimer', function(time)
    SendNUIMessage({ action = 'updateHUD', time = time })
end)

RegisterNetEvent('ffa:updateHUDStats')
AddEventHandler('ffa:updateHUDStats', function(kills, deaths)
    playerState.kills = kills
    playerState.deaths = deaths
    SendNUIMessage({
        action = 'updateHUD',
        kills = kills,
        deaths = deaths
    })
end)

RegisterNetEvent('ffa:updateTDMScore')
AddEventHandler('ffa:updateTDMScore', function(blue, red)
    SendNUIMessage({
        action = 'updateHUD',
        scoreBlue = blue,
        scoreRed = red
    })
end)

-- Spielende
RegisterNetEvent('ffa:gameEnded')
AddEventHandler('ffa:gameEnded', function(data)
    playerState.isInGame = false
    FreezeEntityPosition(PlayerPedId(), true)
    SendNUIMessage({
        action = 'showWinner',
        winnerName = data.winnerName,
        stats = data.stats
    })
    RemoveAllPedWeapons(PlayerPedId(), true)
end)
