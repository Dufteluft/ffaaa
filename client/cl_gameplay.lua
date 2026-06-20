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
        isPersistent = lobby.isPersistent
    })
    TriggerEvent('ffa:updateHUDStats', 0, 0)
end)

-- Funktion: Teilt das gewählte Loadout an den Spieler aus
function GiveLoadout(loadoutKeys)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    -- loadoutKeys kann ein String oder eine Tabelle sein (Multi-Select)
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

-- Fahrzeug-Spawn Logik
local spawnedVehicle = nil
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        if playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local ped = PlayerPedId()
            if not IsPedInAnyVehicle(ped, false) and not spawnedVehicle then
                local coords = GetEntityCoords(ped)
                local vehicleModel = GetHashKey(Config.DefaultVehicle or 'bati')

                RequestModel(vehicleModel)
                while not HasModelLoaded(vehicleModel) do Wait(10) end

                spawnedVehicle = CreateVehicle(vehicleModel, coords.x, coords.y, coords.z, GetEntityHeading(ped), true, false)
                SetVehicleOnGroundProperly(spawnedVehicle)
                SetEntityAsMissionEntity(spawnedVehicle, true, true)
                SetModelAsNoLongerNeeded(vehicleModel)

                ESX.ShowNotification('Fahrzeug gespawnt!')
            end
        elseif spawnedVehicle then
            if DoesEntityExist(spawnedVehicle) then
                DeleteEntity(spawnedVehicle)
            end
            spawnedVehicle = nil
        end
    end
end)

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
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                    ESX.ShowNotification('~r~Du hast das Kampfgebiet verlassen!')
                end

                -- Waffen-Validierung (Anti-Cheat)
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

-- Funktion: Behandelt Tod, Kill-Cam und Respawn
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

        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)
    end)
end

-- HUD-Aktualisierungen
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

-- Game Ended
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

-- Anti-Teamkill
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    local myTeam = teams[myId]

    if not myTeam or myTeam == 'ffa' or myTeam == 'none' then
        return
    end

    local blueGroup = AddRelationshipGroup('FFA_BLUE')
    local redGroup = AddRelationshipGroup('FFA_RED')

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), blueGroup)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), redGroup)
    end

    -- 1 = Like, 5 = Hate
    SetRelationshipBetweenGroups(1, blueGroup, blueGroup)
    SetRelationshipBetweenGroups(1, redGroup, redGroup)
    SetRelationshipBetweenGroups(5, blueGroup, redGroup)
    SetRelationshipBetweenGroups(5, redGroup, blueGroup)
end)
