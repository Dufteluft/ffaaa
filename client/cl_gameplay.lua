-- Event: Spielstart-Vorbereitung (Teleportation, Loadout)
RegisterNetEvent('ffa:gameStarting')
AddEventHandler('ffa:gameStarting', function(lobby)
    currentLobby = lobby
    playerState.isInGame = true
    playerState.kills = 0
    playerState.deaths = 0

    -- UI ausblenden für Fokus aufs Spiel
    SendNUIMessage({ action = 'gameStarting' })

    -- Auf Karte teleportieren und Countdown
    TeleportToMap(lobby.mapId)

    if lobby.isPersistent then
        FreezeEntityPosition(PlayerPedId(), false)
    else
        StartCountdown(10)
    end

    -- Waffen austeilen
    GiveLoadout(lobby.loadout)

    -- HUD einblenden
    SendNUIMessage({
        action = 'showHUD',
        mode = lobby.mode
    })

    -- HUD initialisieren
    SendNUIMessage({
        action = 'updateHUD',
        kills = 0,
        deaths = 0,
        scoreBlue = 0,
        scoreRed = 0,
        mode = lobby.mode
    })
end)

-- Funktion: Teilt das gewählte Loadout an den Spieler aus
function GiveLoadout(loadoutKeys)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    -- loadoutKeys kann ein einzelner String oder eine Liste (Array) sein
    local keys = type(loadoutKeys) == 'table' and loadoutKeys or {loadoutKeys}

    for _, key in ipairs(keys) do
        local loadout = Config.WeaponLoadouts[key]
        if loadout then
            for _, weapon in ipairs(loadout) do
                GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, false)
            end
        end
    end

    -- Wähle die erste Waffe aus dem ersten Loadout
    local firstKey = keys[1]
    if Config.WeaponLoadouts[firstKey] then
        SetCurrentPedWeapon(ped, GetHashKey(Config.WeaponLoadouts[firstKey][1].name), true)
    end
end

-- Map-Grenzprüfung und Waffen-Validierung
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(2000)
        if playerState.isInGame and currentLobby then
            local ped = PlayerPedId()
            if not IsEntityDead(ped) then
                local coords = GetEntityCoords(ped)
                local map = Utils.GetMapById(currentLobby.mapId)

                if map then
                    -- Grenzprüfung
                    local dist = #(coords - map.center)
                    if dist > map.radius then
                        ESX.ShowNotification('~r~Du verlässt das Kampfgebiet!')
                        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                        if spawn then
                            SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                        end
                    end

                    -- Waffen-Validierung
                    local currentWeapon = GetSelectedPedWeapon(ped)
                    if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                        local allowed = false
                        local keys = type(currentLobby.loadout) == 'table' and currentLobby.loadout or {currentLobby.loadout}

                        for _, key in ipairs(keys) do
                            local loadout = Config.WeaponLoadouts[key]
                            if loadout then
                                for _, w in ipairs(loadout) do
                                    if GetHashKey(w.name) == currentWeapon then
                                        allowed = true
                                        break
                                    end
                                end
                            end
                            if allowed then break end
                        end

                        if not allowed then
                            RemoveWeaponFromPed(ped, currentWeapon)
                            ESX.ShowNotification('~r~Diese Waffe ist hier nicht erlaubt!')
                        end
                    end
                end
            end
        end
    end
end)

-- Kill-Erkennung via ESX Event (Performanter als Loop)
RegisterNetEvent('esx:onPlayerDeath')
AddEventHandler('esx:onPlayerDeath', function(data)
    if playerState.isInGame then
        local killerServerId = data.killerServerId
        TriggerServerEvent('ffa:playerKilled', killerServerId)

        -- Killer-Ped finden für die Kill-Cam
        local killerPed = 0
        if killerServerId and killerServerId ~= -1 then
            killerPed = GetPlayerPed(GetPlayerFromServerId(killerServerId))
        end

        HandleDeath(killerPed)
    end
end)

-- Funktion: Behandelt Tod, Kill-Cam und Respawn
function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local playerPed = PlayerPedId()

        -- Kill-Cam: Fokus auf den Mörder (falls vorhanden)
        if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
            local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
            local killerCoords = GetEntityCoords(killerPed)
            SetCamCoord(cam, GetEntityCoords(playerPed) + vector3(0, 0, 2))
            PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
            RenderScriptCams(true, true, 1000, true, true)

            Wait(3000)
            RenderScriptCams(false, true, 1000, true, true)
            DestroyCam(cam, true)
        else
            Wait(2000)
        end

        -- Respawn-Wartezeit (aus Lobby-Settings)
        local waitTime = (currentLobby and currentLobby.respawnTime or 5) - 2
        if waitTime > 0 then Wait(waitTime * 1000) end

        -- Wiederbelebung
        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        if spawn then
            NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        end

        GiveLoadout(currentLobby.loadout)
    end)
end

-- HUD-Aktualisierungen vom Server
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
        deaths = deaths,
        mode = currentLobby and currentLobby.mode or 'ffa'
    })
end)

RegisterNetEvent('ffa:updateTDMScore')
AddEventHandler('ffa:updateTDMScore', function(blue, red)
    SendNUIMessage({
        action = 'updateHUD',
        scoreBlue = blue,
        scoreRed = red,
        mode = 'tdm'
    })
end)

-- Event: Spielende (Sieg-Anzeige)
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
