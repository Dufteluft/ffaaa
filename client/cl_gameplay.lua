-- Spielstart-Vorbereitung
RegisterNetEvent('ffa:gameStarting')
AddEventHandler('ffa:gameStarting', function(lobby)
    currentLobby = lobby
    playerState.isInGame = true
    playerState.kills = 0
    playerState.deaths = 0

    SendNUIMessage({ action = 'gameStarting' })
    SetNuiFocus(false, false)

    -- Teleportation
    local spawn = Utils.GetRandomSpawn(lobby.mapId)
    local ped = PlayerPedId()

    DoScreenFadeOut(500)
    while not IsScreenFadedOut() do Wait(0) end

    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
    SetEntityHeading(ped, spawn.w)

    Wait(500)
    DoScreenFadeIn(500)
    FreezeEntityPosition(ped, not lobby.isPersistent)

    if not lobby.isPersistent then
        StartCountdown(10)
    end

    GiveLoadout(lobby.loadout)
    SendNUIMessage({ action = 'showHUD', mode = lobby.mode })
end)

function GiveLoadout(loadoutKey)
    local ped = PlayerPedId()
    local loadout = Config.WeaponLoadouts[loadoutKey]
    RemoveAllPedWeapons(ped, true)
    if loadout then
        for _, w in ipairs(loadout.weapons) do
            GiveWeaponToPed(ped, GetHashKey(w.name), w.ammo, false, true)
        end
    end
end

-- Grenzprüfung & Waffen-Anti-Cheat & Fahrzeug-Logik
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState.isInGame and currentLobby then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local map = Utils.GetMapById(currentLobby.mapId)

            if map then
                -- Map Grenzen
                if #(coords - map.center) > map.radius then
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                    ESX.ShowNotification(_U('out_of_bounds') or 'Du verlässt das Kampfgebiet!')
                end

                -- Waffen Validierung
                local weapon = GetSelectedPedWeapon(ped)
                if weapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    local loadout = Config.WeaponLoadouts[currentLobby.loadout]
                    if loadout then
                        for _, w in ipairs(loadout.weapons) do
                            if GetHashKey(w.name) == weapon then allowed = true; break end
                        end
                    end
                    if not allowed then
                        RemoveWeaponFromPed(ped, weapon)
                        ESX.ShowNotification(_U('weapon_not_allowed') or 'Diese Waffe ist hier nicht erlaubt!')
                    end
                end
            end

            -- Fahrzeug Spawn Logik
            if currentLobby.vehiclesAllowed and not IsPedInAnyVehicle(ped, false) then
                -- Hier könnte man Logik hinzufügen um Fahrzeuge in der Nähe zu prüfen oder zu spawnen
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
                local killer = GetPedKiller(ped)
                local killerId = -1
                if IsEntityAPed(killer) and IsPedAPlayer(killer) then
                    killerId = GetPlayerServerId(NetworkGetPlayerIndexFromPed(killer))
                end

                TriggerServerEvent('ffa:playerKilled', killerId)
                HandleDeath(killer)

                while IsEntityDead(ped) do Wait(100) end
            end
        end
    end
end)

function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local playerPed = PlayerPedId()

        -- Kill-Cam Fokus
        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        SetCamCoord(cam, GetEntityCoords(playerPed))
        if killerPed and DoesEntityExist(killerPed) then
            PointCamAtEntity(cam, killerPed, 0.0, 0.0, 0.0, true)
        end
        RenderScriptCams(true, true, 1000, true, true)

        Wait(3000)

        -- Spectator Zeit bis Respawn
        local respawnTime = currentLobby and currentLobby.respawnTime or 5
        if respawnTime > 3 then
            if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
                NetworkSetInSpectatorMode(true, killerPed)
            end
            Wait((respawnTime - 3) * 1000)
            NetworkSetInSpectatorMode(false, playerPed)
        end

        RenderScriptCams(false, true, 500, true, true)
        DestroyCam(cam, true)

        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)
    end)
end

-- Team Sync & Anti-TK
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    local myTeam = teams[myId]
    if not myTeam or myTeam == 'ffa' then return end

    Citizen.CreateThread(function()
        while playerState.isInGame and currentLobby and not currentLobby.friendlyFire do
            Citizen.Wait(100)
            local ped = PlayerPedId()
            for player, team in pairs(teams) do
                if team == myTeam and player ~= myId then
                    local targetPed = GetPlayerPed(GetPlayerFromServerId(player))
                    if DoesEntityExist(targetPed) then
                        SetEntityNoCollisionEntity(ped, targetPed, true)
                        -- Schaden zwischen Teammitgliedern verhindern
                        SetEntityCanBeDamagedByRelationshipGroup(targetPed, false, GetPedRelationshipGroupHash(ped))
                    end
                end
            end
        end
    end)
end)

-- HUD Updates
RegisterNetEvent('ffa:updateHUD')
AddEventHandler('ffa:updateHUD', function(data)
    SendNUIMessage({ action = 'updateHUD',
        time = data.time,
        kills = data.kills,
        deaths = data.deaths,
        scoreBlue = data.scoreBlue,
        scoreRed = data.scoreRed
    })
end)

RegisterNetEvent('ffa:gameEnded')
AddEventHandler('ffa:gameEnded', function(data)
    playerState.isInGame = false
    FreezeEntityPosition(PlayerPedId(), true)
    SendNUIMessage({ action = 'showWinner', winnerName = data.winnerName, stats = data.stats })
    RemoveAllPedWeapons(PlayerPedId(), true)
end)
