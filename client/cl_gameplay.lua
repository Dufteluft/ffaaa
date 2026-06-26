-- Event: Spielstart-Vorbereitung
RegisterNetEvent('ffa:gameStarting')
AddEventHandler('ffa:gameStarting', function(lobby)
    currentLobby = lobby
    playerState.isInGame = true
    playerState.kills = 0
    playerState.deaths = 0

    SendNUIMessage({ action = 'gameStarting' })
    SetNuiFocus(false, false)

    TeleportToMap(lobby.mapId)

    if lobby.isPersistent then
        FreezeEntityPosition(PlayerPedId(), false)
        SendNUIMessage({ action = 'countdown', seconds = 0 })
    else
        StartCountdown(10)
    end

    GiveLoadout(lobby.loadout)

    if lobby.vehiclesAllowed then
        SpawnLobbyVehicle()
    end

    SendNUIMessage({
        action = 'showHUD',
        mode = lobby.mode,
        isPersistent = lobby.isPersistent
    })

    -- Relationship Groups für TDM Anti-TK
    SetupRelationshipGroups(playerState.team)
end)

function SetupRelationshipGroups(team)
    local ped = PlayerPedId()
    local blueGroup = AddRelationshipGroup('FFA_BLUE')
    local redGroup = AddRelationshipGroup('FFA_RED')

    if team == 'blue' then
        SetPedRelationshipGroupHash(ped, blueGroup)
        SetRelationshipBetweenGroups(1, blueGroup, blueGroup) -- Like
        SetRelationshipBetweenGroups(5, blueGroup, redGroup) -- Hate
    elseif team == 'red' then
        SetPedRelationshipGroupHash(ped, redGroup)
        SetRelationshipBetweenGroups(1, redGroup, redGroup) -- Like
        SetRelationshipBetweenGroups(5, redGroup, blueGroup) -- Hate
    else
        SetPedRelationshipGroupHash(ped, GetHashKey('PLAYER'))
    end
end

RegisterNetEvent('ffa:syncTeam')
AddEventHandler('ffa:syncTeam', function(team)
    playerState.team = team
    if playerState.isInGame then
        SetupRelationshipGroups(team)
    end
end)

function GiveLoadout(loadoutKeys)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    if type(loadoutKeys) == 'string' then
        loadoutKeys = {loadoutKeys}
    end

    for _, key in ipairs(loadoutKeys) do
        local loadout = Config.WeaponLoadouts[key]
        if loadout then
            for _, weapon in ipairs(loadout) do
                GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
            end
        end
    end
end

function SpawnLobbyVehicle()
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local model = GetHashKey(Config.DefaultSettings.defaultVehicle or 'bati')

    RequestModel(model)
    while not HasModelLoaded(model) do Wait(0) end

    spawnedVehicle = CreateVehicle(model, coords.x, coords.y, coords.z, GetEntityHeading(ped), true, false)
    TaskWarpPedIntoVehicle(ped, spawnedVehicle, -1)
    SetModelAsNoLongerNeeded(model)
end

-- Grenzprüfung und Anti-Cheat
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState.isInGame and currentLobby then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local map = Utils.GetMapById(currentLobby.mapId)

            if map then
                local dist = #(coords - map.center)
                if dist > map.radius then
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                    ESX.ShowNotification('~r~Zurück ins Kampfgebiet!')
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

function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local playerPed = PlayerPedId()
        local killerCoords = GetEntityCoords(killerPed)
        local respawnTime = currentLobby.respawnTime or 5

        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        SetCamCoord(cam, GetEntityCoords(playerPed))
        PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
        RenderScriptCams(true, true, 1000, true, true)

        Wait(3000)

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
        if currentLobby.vehiclesAllowed then
            SpawnLobbyVehicle()
        end
    end)
end

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

RegisterNetEvent('ffa:gameEnded')
AddEventHandler('ffa:gameEnded', function(data)
    playerState.isInGame = false
    FreezeEntityPosition(PlayerPedId(), true)

    if spawnedVehicle and DoesEntityExist(spawnedVehicle) then
        DeleteEntity(spawnedVehicle)
        spawnedVehicle = nil
    end

    SendNUIMessage({
        action = 'showWinner',
        winnerName = data.winnerName,
        stats = data.stats
    })

    RemoveAllPedWeapons(PlayerPedId(), true)
end)

RegisterNetEvent('ffa:syncSettings')
AddEventHandler('ffa:syncSettings', function(lobby)
    currentLobby = lobby
    SendNUIMessage({
        action = 'syncSettings',
        lobby = lobby
    })
end)
