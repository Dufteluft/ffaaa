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
        isPersistent = lobby.isPersistent
    })
    TriggerEvent('ffa:updateHUDStats', 0, 0)

    -- Friendly Fire Einstellung setzen
    if lobby.mode == 'tdm' then
        NetworkSetFriendlyFireOption(lobby.friendlyFire)
    else
        NetworkSetFriendlyFireOption(true)
    end
end)

-- Funktion: Teilt das gewählte Loadout an den Spieler aus
function GiveLoadout(loadoutKeys)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    -- loadoutKeys kann ein String oder ein Array von Strings sein
    local keys = type(loadoutKeys) == 'table' and loadoutKeys or {loadoutKeys}

    for _, key in ipairs(keys) do
        local loadout = Config.WeaponLoadouts[key]
        if loadout then
            for _, weapon in ipairs(loadout) do
                GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
            end
        end
    end
end

-- Map-Grenzprüfung, Waffen-Validierung und Fahrzeug-Spawn
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
                        ESX.ShowNotification('~r~Diese Waffe ist in dieser Lobby nicht erlaubt!')
                    end
                end
            end

            -- Fahrzeug-Spawn Logik (aus cl_nui.lua verschoben)
            if currentLobby.vehiclesAllowed then
                local vehicle = GetClosestVehicle(coords.x, coords.y, coords.z, 30.0, 0, 71)
                if vehicle == 0 then
                    local spawnPos = GetOffsetFromEntityInWorldCoords(ped, 0.0, 15.0, 0.0)
                    local model = `zentorno`
                    RequestModel(model)
                    while not HasModelLoaded(model) do Wait(10) end

                    local veh = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(ped), true, false)
                    SetVehicleOnGroundProperly(veh)
                    SetEntityAsMissionEntity(veh, true, true)
                    SetModelAsNoLongerNeeded(model)
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
        local killerCoords = killerPed and DoesEntityExist(killerPed) and GetEntityCoords(killerPed) or GetEntityCoords(PlayerPedId())
        local playerPed = PlayerPedId()

        -- Kill-Cam: Fokus für 3 Sek auf den Mörder
        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        SetCamCoord(cam, GetEntityCoords(playerPed))
        PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
        RenderScriptCams(true, true, 1000, true, true)

        Wait(3000)

        -- Wenn Respawn noch nicht fällig, wechsle in Zuschauer-Modus
        local respawnTime = currentLobby and currentLobby.respawnTime or 5
        if respawnTime > 3 then
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)

            -- Automatisch auf Killer oder zufälligen Spieler schauen
            if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
                NetworkSetInSpectatorMode(true, killerPed)
            end

            Wait((respawnTime - 3) * 1000)
            NetworkSetInSpectatorMode(false, playerPed)
        else
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
        end

        -- Wiederbelebung an zufälligem Punkt auf der Map
        if playerState.isInGame and currentLobby then
            local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
            NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
            GiveLoadout(currentLobby.loadout)
        end
    end)
end

-- Anti-Teamkill via Relationship Groups (Verbesserte Version aus cl_nui.lua)
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myServerId = GetPlayerServerId(PlayerId())
    local myTeam = teams[myServerId]
    if not myTeam then return end

    AddRelationshipGroup('BLUE_TEAM')
    AddRelationshipGroup('RED_TEAM')
    AddRelationshipGroup('FFA_TEAM')

    local ped = PlayerPedId()
    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(ped, `BLUE_TEAM`)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(ped, `RED_TEAM`)
    else
        SetPedRelationshipGroupHash(ped, `FFA_TEAM`)
    end

    -- Beziehungen setzen
    SetRelationshipBetweenGroups(1, `BLUE_TEAM`, `BLUE_TEAM`) -- Like
    SetRelationshipBetweenGroups(1, `RED_TEAM`, `RED_TEAM`)   -- Like
    SetRelationshipBetweenGroups(5, `BLUE_TEAM`, `RED_TEAM`)  -- Hate
    SetRelationshipBetweenGroups(5, `RED_TEAM`, `BLUE_TEAM`)  -- Hate

    -- Friendly Fire Option für TDM
    if currentLobby and currentLobby.mode == 'tdm' then
        SetCanAttackFriendly(ped, currentLobby.friendlyFire, false)
        NetworkSetFriendlyFireOption(currentLobby.friendlyFire)
    end
end)

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
        mode = currentLobby and currentLobby.mode or 'tdm'
    })
end)

-- Event: Spielende (Sieg-Anzeige und Sperren)
RegisterNetEvent('ffa:gameEnded')
AddEventHandler('ffa:gameEnded', function(data)
    playerState.isInGame = false
    FreezeEntityPosition(PlayerPedId(), true) -- Spieler am Platz halten

    SetNuiFocus(true, true) -- Fokus für Voting aktivieren
    SendNUIMessage({
        action = 'showWinner',
        winnerName = data.winnerName,
        stats = data.stats
    })

    -- Waffen entfernen am Rundenende
    RemoveAllPedWeapons(PlayerPedId(), true)
end)
