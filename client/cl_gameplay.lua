-- Event: Spielstart-Vorbereitung (Teleportation, Loadout)
RegisterNetEvent('ffa:gameStarting')
AddEventHandler('ffa:gameStarting', function(lobby)
    currentLobby = lobby
    playerState.isInGame = true
    playerState.kills = 0
    playerState.deaths = 0

    -- UI ausblenden für Fokus aufs Spiel
    SendNUIMessage({ action = 'gameStarting' })
    SetNuiFocus(false, false)

    -- Auf Karte teleportieren und Countdown (nur wenn nicht persistent)
    TeleportToMap(lobby.mapId)
    if lobby.isPersistent then
        FreezeEntityPosition(PlayerPedId(), false)
        SendNUIMessage({ action = 'countdown', seconds = 0 })
    else
        StartCountdown(10)
    end

    -- Waffen austeilen
    GiveLoadout(lobby.loadout)

    -- HUD einblenden
    SendNUIMessage({
        action = 'showHUD',
        isPersistent = lobby.isPersistent,
        mode = lobby.mode
    })

    SendNUIMessage({
        action = 'updateHUD',
        kills = 0,
        deaths = 0,
        scoreBlue = 0,
        scoreRed = 0
    })
end)

-- Funktion: Teilt das gewählte Loadout an den Spieler aus
function GiveLoadout(loadouts)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    if type(loadouts) == "string" then
        loadouts = {loadouts}
    end

    for _, loadoutKey in ipairs(loadouts) do
        local weapons = Config.WeaponLoadouts[loadoutKey]
        if weapons then
            for _, weapon in ipairs(weapons) do
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

                -- Waffen-Validierung
                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    local loadoutKeys = currentLobby.loadout
                    if type(loadoutKeys) == "string" then loadoutKeys = {loadoutKeys} end

                    for _, lKey in ipairs(loadoutKeys) do
                        local weapons = Config.WeaponLoadouts[lKey]
                        if weapons then
                            for _, w in ipairs(weapons) do
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
                        ESX.ShowNotification('~r~Diese Waffe ist in dieser Lobby nicht erlaubt!')
                    end
                end
            end
        end
    end
end)

-- Kill-Erkennung: Prüft ständig auf Tod des Spielers
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(0)
        if playerState.isInGame then
            local ped = PlayerPedId()
            if IsEntityDead(ped) then
                local killerId = GetPedKiller(ped)
                local killerServerId = -1

                -- Ermitteln der Server-ID des Killers
                if IsEntityAPed(killerId) and IsPedAPlayer(killerId) then
                    killerServerId = GetPlayerServerId(NetworkGetPlayerIndexFromPed(killerId))
                end

                TriggerServerEvent('ffa:playerKilled', killerServerId)

                -- Kill-Cam und Respawn-Logik ausführen
                HandleDeath(killerId)

                -- Warten bis Spieler wieder lebt
                while IsEntityDead(ped) do Citizen.Wait(100) end
            end
        end
    end
end)

-- Funktion: Behandelt Tod, Kill-Cam und Respawn
function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local playerPed = PlayerPedId()
        local respawnTime = currentLobby.respawnTime or 5

        -- Kill-Cam: Fokus auf den Mörder
        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        SetCamCoord(cam, GetEntityCoords(playerPed))

        if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
            PointCamAtEntity(cam, killerPed, 0.0, 0.0, 0.0, true)
        end

        RenderScriptCams(true, true, 1000, true, true)

        -- Wartezeit basierend auf Respawn-Time
        local camTime = math.min(respawnTime * 1000, 3000)
        Wait(camTime)

        -- Wenn Respawn noch nicht fällig, wechsle in Zuschauer-Modus
        if respawnTime * 1000 > camTime then
            if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
                NetworkSetInSpectatorMode(true, killerPed)
            end
            Wait((respawnTime * 1000) - camTime)
            NetworkSetInSpectatorMode(false, playerPed)
        end

        RenderScriptCams(false, true, 500, true, true)
        DestroyCam(cam, true)

        -- Wiederbelebung an zufälligem Punkt auf der Map
        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
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

-- Event: Spielende (Sieg-Anzeige und Sperren)
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
