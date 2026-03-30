local lastVehicle = nil

-- Event: Spielstart-Vorbereitung
RegisterNetEvent('ffa:gameStarting')
AddEventHandler('ffa:gameStarting', function(lobby)
    currentLobby = lobby
    playerState.isInGame = true
    playerState.kills = 0
    playerState.deaths = 0

    -- UI ausblenden
    SendNUIMessage({ action = 'gameStarting' })
    SetNuiFocus(false, false)

    -- Auf Karte teleportieren
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

    -- HUD initialisieren
    SendNUIMessage({
        action = 'updateHUD',
        kills = 0,
        deaths = 0,
        mode = lobby.mode,
        scoreBlue = 0,
        scoreRed = 0
    })
end)

-- Funktion: Teilt Loadout aus (Unterstützt Multi-Select Kategorien)
function GiveLoadout(loadout)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    if type(loadout) == 'table' then
        for _, category in ipairs(loadout) do
            local items = Config.WeaponLoadouts[category]
            if items then
                for _, weapon in ipairs(items) do
                    GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
                end
            end
        end
    else
        local items = Config.WeaponLoadouts[loadout]
        if items then
            for _, weapon in ipairs(items) do
                GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
            end
        end
    end
end

-- Grenzprüfung und Waffen-Validierung
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
                    if type(currentLobby.loadout) == 'table' then
                        for _, category in ipairs(currentLobby.loadout) do
                            local items = Config.WeaponLoadouts[category]
                            if items then
                                for _, w in ipairs(items) do
                                    if GetHashKey(w.name) == currentWeapon then
                                        allowed = true; break
                                    end
                                end
                            end
                            if allowed then break end
                        end
                    else
                        local items = Config.WeaponLoadouts[currentLobby.loadout]
                        if items then
                            for _, w in ipairs(items) do
                                if GetHashKey(w.name) == currentWeapon then
                                    allowed = true; break
                                end
                            end
                        end
                    end

                    if not allowed then
                        RemoveWeaponFromPed(ped, currentWeapon)
                        ESX.ShowNotification('~r~Diese Waffe ist hier nicht erlaubt!')
                    end
                end
            end
        end
    end
end)

-- Fahrzeug-Spawn Logik
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        if playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local vehicle = GetClosestVehicle(coords.x, coords.y, coords.z, 30.0, 0, 71)

            if vehicle == 0 then
                if lastVehicle and DoesEntityExist(lastVehicle) then
                    DeleteEntity(lastVehicle)
                end

                local model = `zentorno`
                RequestModel(model)
                while not HasModelLoaded(model) do Wait(10) end

                local spawnPos = GetOffsetFromEntityInWorldCoords(ped, 0.0, 10.0, 0.0)
                lastVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(ped), true, false)
                SetVehicleOnGroundProperly(lastVehicle)
                SetEntityAsMissionEntity(lastVehicle, true, true)
                SetModelAsNoLongerNeeded(model)
            end
        end
    end
end)

-- Anti-Teamkill
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    if not currentLobby or currentLobby.mode ~= 'tdm' or currentLobby.friendlyFire then
        NetworkSetFriendlyFireOption(true)
        return
    end

    local myId = GetPlayerServerId(PlayerId())
    local myTeam = teams[myId]
    if not myTeam then return end

    -- Wir setzen Relationship Groups für TDM
    AddRelationshipGroup('BLUE_TEAM')
    AddRelationshipGroup('RED_TEAM')

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), `BLUE_TEAM`)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), `RED_TEAM`)
    end

    SetRelationshipBetweenGroups(1, `BLUE_TEAM`, `BLUE_TEAM`) -- Like
    SetRelationshipBetweenGroups(1, `RED_TEAM`, `RED_TEAM`)
    SetRelationshipBetweenGroups(5, `BLUE_TEAM`, `RED_TEAM`) -- Hate
    SetRelationshipBetweenGroups(5, `RED_TEAM`, `BLUE_TEAM`)

    -- Deaktiviere Friendly Fire auf Netzwerk-Ebene für TDM
    NetworkSetFriendlyFireOption(false)
    SetCanAttackFriendly(PlayerPedId(), false, false)
end)

-- Kill-Erkennung & Respawn
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

function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local playerPed = PlayerPedId()
        local killerCoords = GetEntityCoords(killerPed)

        -- Kill-Cam
        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        SetCamCoord(cam, GetEntityCoords(playerPed))
        PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
        RenderScriptCams(true, true, 1000, true, true)

        Wait(3000)

        -- Respawn Timer abwarten
        if currentLobby and currentLobby.respawnTime > 3 then
            if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
                NetworkSetInSpectatorMode(true, killerPed)
            end
            Wait((currentLobby.respawnTime - 3) * 1000)
            NetworkSetInSpectatorMode(false, playerPed)
        end

        RenderScriptCams(false, true, 500, true, true)
        DestroyCam(cam, true)

        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)
    end)
end

-- HUD Updates vom Server
RegisterNetEvent('ffa:updateTimer')
AddEventHandler('ffa:updateTimer', function(time)
    SendNUIMessage({ action = 'updateHUD', time = time })
end)

RegisterNetEvent('ffa:updateHUDStats')
AddEventHandler('ffa:updateHUDStats', function(kills, deaths)
    local oldKills = playerState.kills
    playerState.kills = kills
    playerState.deaths = deaths

    if kills > oldKills then
        SendNUIMessage({ action = 'playSound', name = 'kill' })
    end

    SendNUIMessage({
        action = 'updateHUD',
        kills = kills,
        deaths = deaths,
        mode = currentLobby.mode
    })
end)

RegisterNetEvent('ffa:updateTDMScore')
AddEventHandler('ffa:updateTDMScore', function(blue, red)
    SendNUIMessage({
        action = 'updateHUD',
        scoreBlue = blue,
        scoreRed = red,
        mode = currentLobby.mode
    })
end)

RegisterNetEvent('ffa:updateMapVotes')
AddEventHandler('ffa:updateMapVotes', function(counts)
    for mapId, count in pairs(counts) do
        SendNUIMessage({ action = 'updateVote', mapId = mapId, count = count })
    end
end)

-- Event: Spielende
RegisterNetEvent('ffa:gameEnded')
AddEventHandler('ffa:gameEnded', function(data)
    playerState.isInGame = false
    FreezeEntityPosition(PlayerPedId(), true)
    SetNuiFocus(true, true) -- Wichtig für Winner Screen Interaktion
    SendNUIMessage({
        action = 'showWinner',
        winnerName = data.winnerName,
        stats = data.stats
    })
    RemoveAllPedWeapons(PlayerPedId(), true)
end)
