-- Event: Spielstart-Vorbereitung (Teleportation, Loadout)
RegisterNetEvent('ffa:gameStarting')
AddEventHandler('ffa:gameStarting', function(lobby)
    currentLobby = lobby
    playerState.isInGame = true
    playerState.kills = 0
    playerState.deaths = 0

    -- UI ausblenden für Fokus aufs Spiel
    SendNUIMessage({
        action = 'gameStarting',
        isTDM = (lobby.mode == 'tdm')
    })
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
    GiveLoadout(lobby.loadouts)

    -- HUD einblenden
    SendNUIMessage({
        action = 'showHUD',
        isTDM = (lobby.mode == 'tdm'),
        isPersistent = lobby.isPersistent
    })
    TriggerEvent('ffa:updateHUDStats', 0, 0)
end)

-- Funktion: Teilt das gewählte Loadout an den Spieler aus
function GiveLoadout(loadoutKeys)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    for _, key in ipairs(loadoutKeys) do
        local loadout = Config.WeaponLoadouts[key]
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

                -- Waffen-Validierung
                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    for _, key in ipairs(currentLobby.loadouts) do
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
                        ESX.ShowNotification('~r~Waffe nicht erlaubt!')
                    end
                end
            end
        end
    end
end)

-- Kill-Erkennung und Respawn-Logik
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

-- Funktion: Behandelt Tod, Kill-Cam und Respawn
function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local playerPed = PlayerPedId()
        local respawnTime = currentLobby.respawnTime or 5

        -- UI Respawn Timer zeigen
        SendNUIMessage({ action = 'showRespawn', time = respawnTime })

        -- Kill-Cam
        if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
            local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
            local killerCoords = GetEntityCoords(killerPed)
            SetCamCoord(cam, GetEntityCoords(playerPed))
            PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
            RenderScriptCams(true, true, 1000, true, true)

            Wait(3000)

            -- Spectator mode if respawn is still far
            if respawnTime > 3 then
                RenderScriptCams(false, true, 500, true, true)
                DestroyCam(cam, true)
                NetworkSetInSpectatorMode(true, killerPed)
                Wait((respawnTime - 3) * 1000)
                NetworkSetInSpectatorMode(false, playerPed)
            else
                RenderScriptCams(false, true, 500, true, true)
                DestroyCam(cam, true)
            end
        else
            Wait(respawnTime * 1000)
        end

        -- Respawn
        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadouts)
        SendNUIMessage({ action = 'hideRespawn' })
    end)
end

-- Fahrzeug-Spawn Logik
Citizen.CreateThread(function()
    local playerVehicle = nil
    while true do
        Citizen.Wait(5000)
        if playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local playerPed = PlayerPedId()
            if not IsPedInAnyVehicle(playerPed, false) then
                if playerVehicle and DoesEntityExist(playerVehicle) then
                    local dist = #(GetEntityCoords(playerPed) - GetEntityCoords(playerVehicle))
                    if dist > 50.0 then
                        DeleteEntity(playerVehicle)
                        playerVehicle = nil
                    end
                end

                if not playerVehicle or not DoesEntityExist(playerVehicle) then
                    local spawnPos = GetOffsetFromEntityInWorldCoords(playerPed, 0.0, 5.0, 0.0)
                    local model = `zentorno`
                    RequestModel(model)
                    while not HasModelLoaded(model) do Wait(10) end
                    playerVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(playerPed), true, false)
                    SetVehicleOnGroundProperly(playerVehicle)
                    SetModelAsNoLongerNeeded(model)
                end
            end
        end
    end
end)

-- Anti-Teamkill
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(0)
        if playerState.isInGame and currentLobby and currentLobby.mode == 'tdm' and not currentLobby.friendlyFire then
            local _, targetPed = GetEntityPlayerIsFreeAimingAt(PlayerId())
            if targetPed and DoesEntityExist(targetPed) and IsEntityAPed(targetPed) and IsPedAPlayer(targetPed) then
                local targetId = GetPlayerServerId(NetworkGetPlayerIndexFromPed(targetPed))
                -- Wir nutzen Relationship Groups für den Schaden
            end
        end
    end
end)

RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    local myTeam = teams[myId]
    if not myTeam then return end

    AddRelationshipGroup('BLUE_TEAM')
    AddRelationshipGroup('RED_TEAM')

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), `BLUE_TEAM`)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), `RED_TEAM`)
    end

    SetRelationshipBetweenGroups(1, `BLUE_TEAM`, `BLUE_TEAM`) -- Like
    SetRelationshipBetweenGroups(1, `RED_TEAM`, `RED_TEAM`) -- Like
    SetRelationshipBetweenGroups(5, `BLUE_TEAM`, `RED_TEAM`) -- Hate
    SetRelationshipBetweenGroups(5, `RED_TEAM`, `BLUE_TEAM`) -- Hate

    -- Deaktiviere Schaden im eigenen Team wenn Friendly Fire aus ist
    if currentLobby and not currentLobby.friendlyFire then
        SetCanAttackFriendly(PlayerPedId(), false, false)
        NetworkSetFriendlyFireOption(false)
    else
        SetCanAttackFriendly(PlayerPedId(), true, false)
        NetworkSetFriendlyFireOption(true)
    end
end)

-- HUD Updates
RegisterNetEvent('ffa:updateTimer')
AddEventHandler('ffa:updateTimer', function(time)
    SendNUIMessage({ action = 'updateHUD', time = time })
end)

RegisterNetEvent('ffa:updateHUDStats')
AddEventHandler('ffa:updateHUDStats', function(kills, deaths)
    playerState.kills = kills
    playerState.deaths = deaths
    SendNUIMessage({ action = 'updateHUD', kills = kills, deaths = deaths })
end)

RegisterNetEvent('ffa:updateTDMScore')
AddEventHandler('ffa:updateTDMScore', function(blue, red)
    SendNUIMessage({ action = 'updateHUD', scoreBlue = blue, scoreRed = red })
end)

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

RegisterNetEvent('ffa:playSound')
AddEventHandler('ffa:playSound', function(data)
    SendNUIMessage({ action = 'playSound', sound = data.sound })
end)
