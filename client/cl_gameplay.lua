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
        SetEntityInvincible(PlayerPedId(), false)
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

    -- Fahrzeug spawnen wenn erlaubt
    if lobby.vehiclesAllowed then
        SpawnLobbyVehicle()
    end
end)

-- Funktion: Teilt das gewählte Loadout an den Spieler aus
function GiveLoadout(loadoutKeys)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    -- loadoutKeys kann ein einzelner String oder eine Table sein
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

-- Funktion: Spawnt ein Standard-Fahrzeug
function SpawnLobbyVehicle()
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local heading = GetEntityHeading(ped)
    local model = GetHashKey(Config.DefaultSettings.defaultVehicle or 'bati')

    RequestModel(model)
    while not HasModelLoaded(model) do Wait(10) end

    if spawnedVehicle and DoesEntityExist(spawnedVehicle) then
        DeleteEntity(spawnedVehicle)
    end

    spawnedVehicle = CreateVehicle(model, coords.x, coords.y, coords.z, heading, true, false)
    TaskWarpPedIntoVehicle(ped, spawnedVehicle, -1)
    SetModelAsNoLongerNeeded(model)
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

                -- Waffen-Validierung (optional)
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
                local killerPed = GetPedKiller(ped)
                local killerServerId = -1

                if IsEntityAPed(killerPed) and IsPedAPlayer(killerPed) then
                    killerServerId = GetPlayerServerId(NetworkGetPlayerIndexFromPed(killerPed))
                end

                TriggerServerEvent('ffa:playerKilled', killerServerId)
                HandleDeath(killerPed)

                while IsEntityDead(ped) do Citizen.Wait(100) end
            end
        end
    end
end)

-- Tod, Kill-Cam und Respawn
function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local playerPed = PlayerPedId()
        local respawnTime = currentLobby.respawnTime or 5

        -- Kill-Cam
        if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
            local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
            SetCamCoord(cam, GetEntityCoords(playerPed))
            PointCamAtEntity(cam, killerPed, 0.0, 0.0, 0.0, true)
            RenderScriptCams(true, true, 1000, true, true)

            Wait(3000)
            RenderScriptCams(false, true, 1000, true, true)
            DestroyCam(cam, true)
        else
            Wait(3000)
        end

        -- Respawn
        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)

        -- Reset State
        SetEntityInvincible(playerPed, false)
        ClearPedBloodDamage(playerPed)

        GiveLoadout(currentLobby.loadout)
        if currentLobby.vehiclesAllowed then
            SpawnLobbyVehicle()
        end
    end)
end

-- Anti-Teamkill via Relationship Groups
RegisterNetEvent('ffa:syncTeam')
AddEventHandler('ffa:syncTeam', function(team)
    playerState.team = team

    local ped = PlayerPedId()
    local groupHash = GetHashKey('FFA_' .. team:upper())

    AddRelationshipGroup('FFA_BLUE')
    AddRelationshipGroup('FFA_RED')
    AddRelationshipGroup('FFA_NONE')

    SetPedRelationshipGroupHash(ped, groupHash)

    -- Relationships
    if currentLobby and currentLobby.mode == 'tdm' and not currentLobby.friendlyFire then
        SetRelationshipBetweenGroups(1, GetHashKey('FFA_BLUE'), GetHashKey('FFA_BLUE'))
        SetRelationshipBetweenGroups(1, GetHashKey('FFA_RED'), GetHashKey('FFA_RED'))
        SetRelationshipBetweenGroups(5, GetHashKey('FFA_BLUE'), GetHashKey('FFA_RED'))
        SetRelationshipBetweenGroups(5, GetHashKey('FFA_RED'), GetHashKey('FFA_BLUE'))
    else
        SetRelationshipBetweenGroups(5, GetHashKey('FFA_BLUE'), GetHashKey('FFA_BLUE'))
        SetRelationshipBetweenGroups(5, GetHashKey('FFA_RED'), GetHashKey('FFA_RED'))
        SetRelationshipBetweenGroups(5, GetHashKey('FFA_BLUE'), GetHashKey('FFA_RED'))
        SetRelationshipBetweenGroups(5, GetHashKey('FFA_RED'), GetHashKey('FFA_BLUE'))
    end
end)

-- HUD Events
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
    SendNUIMessage({
        action = 'showWinner',
        winnerName = data.winnerName,
        stats = data.stats
    })
    RemoveAllPedWeapons(PlayerPedId(), true)
end)
