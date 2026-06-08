-- Event: Spielstart-Vorbereitung
RegisterNetEvent('ffa:gameStarting')
AddEventHandler('ffa:gameStarting', function(lobby)
    currentLobby = lobby
    playerState.isInGame = true

    -- UI Fokus auf Spiel
    SendNUIMessage({ action = 'gameStarting' })
    SetNuiFocus(false, false)

    -- Teleportation
    TeleportToMap(lobby.mapId)

    if lobby.isPersistent then
        FreezeEntityPosition(PlayerPedId(), false)
        SendNUIMessage({ action = 'countdown', seconds = 0 })
    else
        StartCountdown(10)
    end

    -- Loadout austeilen
    GiveLoadout(lobby.loadout)

    -- HUD aktivieren
    SendNUIMessage({
        action = 'showHUD',
        mode = lobby.mode
    })

    -- Initialer HUD Reset
    TriggerEvent('ffa:updateHUDStats', 0, 0)
end)

function GiveLoadout(loadoutKeys)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

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

-- Grenzprüfung, Waffen-Validierung und Fahrzeug-Spawn
Citizen.CreateThread(function()
    while true do
        if playerState.isInGame and currentLobby then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local map = Utils.GetMapById(currentLobby.mapId)

            if map then
                -- Map Limit
                local dist = #(coords - map.center)
                if dist > map.radius then
                    ESX.ShowNotification('~r~Verlasse nicht das Kampfgebiet!')
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                end

                -- Waffen Anti-Cheat
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
                    end
                end
            end

            -- Fahrzeug Logik
            if currentLobby.vehiclesAllowed then
                if not IsPedInAnyVehicle(ped, false) then
                    if not playerVehicle or not DoesEntityExist(playerVehicle) then
                        local model = GetHashKey('bati')
                        RequestModel(model)
                        while not HasModelLoaded(model) do Wait(0) end
                        playerVehicle = CreateVehicle(model, coords.x, coords.y, coords.z, GetEntityHeading(ped), true, false)
                        SetPedIntoVehicle(ped, playerVehicle, -1)
                        SetEntityAsMissionEntity(playerVehicle, true, true)
                        SetModelAsNoLongerNeeded(model)
                    else
                        local vehCoords = GetEntityCoords(playerVehicle)
                        if #(coords - vehCoords) > 50.0 then
                            SetEntityCoords(playerVehicle, coords.x, coords.y, coords.z)
                            SetPedIntoVehicle(ped, playerVehicle, -1)
                        end
                    end
                end
            end
        end
        Wait(2000)
    end
end)

-- Tod und Respawn
Citizen.CreateThread(function()
    while true do
        Wait(0)
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
        local killerCoords = GetEntityCoords(killerPed)

        -- Kill-Cam
        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        SetCamCoord(cam, GetEntityCoords(playerPed))
        PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
        RenderScriptCams(true, true, 1000, true, true)

        Wait(3000)

        -- Spectate/Respawn Delay
        if currentLobby.respawnTime > 3 then
            NetworkSetInSpectatorMode(true, killerPed)
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

-- Anti-Teamkill
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    local myTeam = teams[myId]
    if not myTeam or currentLobby.mode ~= 'tdm' or currentLobby.friendlyFire then return end

    AddRelationshipGroup('FFA_BLUE')
    AddRelationshipGroup('FFA_RED')

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), GetHashKey('FFA_BLUE'))
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), GetHashKey('FFA_RED'))
    end

    SetRelationshipBetweenGroups(1, GetHashKey('FFA_BLUE'), GetHashKey('FFA_BLUE'))
    SetRelationshipBetweenGroups(1, GetHashKey('FFA_RED'), GetHashKey('FFA_RED'))
    SetRelationshipBetweenGroups(5, GetHashKey('FFA_BLUE'), GetHashKey('FFA_RED'))
    SetRelationshipBetweenGroups(5, GetHashKey('FFA_RED'), GetHashKey('FFA_BLUE'))
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
