ESX = exports['es_extended']:getSharedObject()

-- Beziehungsgruppen für TDM / Friendly Fire
local groups = {
    ['blue'] = { name = "FFA_BLUE", hash = nil },
    ['red'] = { name = "FFA_RED", hash = nil },
    ['ffa'] = { name = "FFA_NEUTRAL", hash = nil }
}

-- Initialisierung der Gruppen
Citizen.CreateThread(function()
    for k, v in pairs(groups) do
        _, hash = AddRelationshipGroup(v.name)
        groups[k].hash = hash
    end

    -- TDM: Blau vs Rot (Hass)
    SetRelationshipBetweenGroups(5, groups['blue'].hash, groups['red'].hash)
    SetRelationshipBetweenGroups(5, groups['red'].hash, groups['blue'].hash)

    -- FFA: Jeder gegen Jeden
    SetRelationshipBetweenGroups(5, groups['ffa'].hash, groups['ffa'].hash)
end)

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
    else
        StartCountdown(10)
    end

    GiveLoadout(lobby.loadout)

    -- Team-Beziehung setzen
    local ped = PlayerPedId()
    local group = groups[playerState.team] or groups['ffa']
    SetPedRelationshipGroupHash(ped, group.hash)

    -- Fahrzeug spawnen falls erlaubt
    if lobby.vehiclesAllowed then
        SpawnLobbyVehicle()
    end

    SendNUIMessage({
        action = 'showHUD',
        isPersistent = lobby.isPersistent
    })
    TriggerEvent('ffa:updateHUDStats', 0, 0)
end)

function SpawnLobbyVehicle()
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local heading = GetEntityHeading(ped)

    if playerVehicle and DoesEntityExist(playerVehicle) then
        DeleteEntity(playerVehicle)
    end

    ESX.Game.SpawnVehicle('bati', coords, heading, function(vehicle)
        playerVehicle = vehicle
        TaskWarpPedIntoVehicle(ped, vehicle, -1)
    end)
end

function GiveLoadout(loadouts)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    -- loadouts kann ein String (einzelnes) oder Table (multi-select) sein
    if type(loadouts) == 'string' then
        local loadout = Config.WeaponLoadouts[loadouts]
        if loadout then
            for _, weapon in ipairs(loadout) do
                GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
            end
        end
    elseif type(loadouts) == 'table' then
        for _, key in ipairs(loadouts) do
            local loadout = Config.WeaponLoadouts[key]
            if loadout then
                for _, weapon in ipairs(loadout) do
                    GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
                end
            end
        end
    end
end

-- Grenzprüfung und Friendly Fire
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
                    ESX.ShowNotification('~r~Du verlässt das Kampfgebiet!')
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                end
            end

            -- Friendly Fire Handling via Relationship Groups
            -- Falls friendlyFire true ist, setzen wir die Gruppen auf Hass (5)
            -- Falls false, auf Respekt (1)
            if currentLobby.mode == 'tdm' then
                local relation = currentLobby.friendlyFire and 5 or 1
                SetRelationshipBetweenGroups(relation, groups['blue'].hash, groups['blue'].hash)
                SetRelationshipBetweenGroups(relation, groups['red'].hash, groups['red'].hash)
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

        -- Kill-Cam
        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        SetCamCoord(cam, GetEntityCoords(playerPed))
        PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
        RenderScriptCams(true, true, 1000, true, true)

        Wait(3000)
        RenderScriptCams(false, true, 500, true, true)
        DestroyCam(cam, true)

        -- Respawn
        Wait((currentLobby.respawnTime - 3) * 1000)

        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)

        GiveLoadout(currentLobby.loadout)
        if currentLobby.vehiclesAllowed then SpawnLobbyVehicle() end
    end)
end

-- HUD & Stats Updates
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

RegisterNetEvent('ffa:gameEnded')
AddEventHandler('ffa:gameEnded', function(data)
    playerState.isInGame = false
    FreezeEntityPosition(PlayerPedId(), true)

    if playerVehicle and DoesEntityExist(playerVehicle) then
        DeleteEntity(playerVehicle)
        playerVehicle = nil
    end

    SendNUIMessage({
        action = 'showWinner',
        winnerName = data.winnerName,
        stats = data.stats
    })
    RemoveAllPedWeapons(PlayerPedId(), true)
end)

RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    if teams[tostring(myId)] then
        playerState.team = teams[tostring(myId)]
        local group = groups[playerState.team] or groups['ffa']
        SetPedRelationshipGroupHash(PlayerPedId(), group.hash)
    end
end)
