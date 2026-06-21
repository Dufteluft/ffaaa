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

    SendNUIMessage({
        action = 'showHUD',
        mode = lobby.mode
    })

    TriggerEvent('ffa:updateHUDStats', 0, 0)
end)

function GiveLoadout(loadoutKeys)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    if type(loadoutKeys) == 'string' then
        loadoutKeys = { loadoutKeys }
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

-- Fahrzeug-Logik
spawnedVehicle = nil
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        if playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local ped = PlayerPedId()
            if not IsPedInAnyVehicle(ped, false) and not DoesEntityExist(spawnedVehicle) then
                SpawnLobbyVehicle()
            end
        end
    end
end)

function SpawnLobbyVehicle()
    local ped = PlayerPedId()
    local coords = GetOffsetFromEntityInWorldCoords(ped, 0.0, 5.0, 0.0)
    local model = GetHashKey(Config.DefaultSettings.defaultVehicle or 'bati')

    RequestModel(model)
    while not HasModelLoaded(model) do Wait(0) end

    spawnedVehicle = CreateVehicle(model, coords.x, coords.y, coords.z, GetEntityHeading(ped), true, false)
    SetEntityAsMissionEntity(spawnedVehicle, true, true)
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
                local dist = #(coords - map.center)
                if dist > map.radius then
                    ESX.ShowNotification('~r~Kampfgebiet verlassen!')
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                end

                -- Waffen-Check
                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    local loadoutKeys = currentLobby.loadout
                    if type(loadoutKeys) == 'string' then loadoutKeys = { loadoutKeys } end

                    for _, key in ipairs(loadoutKeys) do
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
        end
    end
end)

-- Tod & Respawn
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

function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local playerPed = PlayerPedId()

        -- Spectator / Kill-Cam
        if killerPed and killerPed ~= playerPed and DoesEntityExist(killerPed) then
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
    SendNUIMessage({ action = 'updateHUD', kills = kills, deaths = deaths })
end)

RegisterNetEvent('ffa:updateTDMScore')
AddEventHandler('ffa:updateTDMScore', function(blue, red)
    SendNUIMessage({ action = 'updateHUD', scoreBlue = blue, scoreRed = red })
end)

-- Anti-Teamkill via Relationship Groups
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    local myTeam = teams[myId]

    AddRelationshipGroup('FFA_BLUE')
    AddRelationshipGroup('FFA_RED')

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), GetHashKey('FFA_BLUE'))
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), GetHashKey('FFA_RED'))
    end

    -- 1 = Like, 5 = Hate
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
