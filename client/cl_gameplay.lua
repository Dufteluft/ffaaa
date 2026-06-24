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
        mode = lobby.mode
    })
    TriggerEvent('ffa:updateHUDStats', 0, 0)
end)

-- Funktion: Teilt das gewählte Loadout an den Spieler aus
function GiveLoadout(loadoutKeys)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    -- Falls loadoutKeys ein einzelner String ist (Abwärtskompatibilität)
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

-- Map-Grenzprüfung, Waffen-Validierung und Fahrzeug-Spawning
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

                -- Waffen-Validierung (Anti-Cheat Light)
                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    local loadoutKeys = currentLobby.loadout
                    if type(loadoutKeys) == 'string' then loadoutKeys = {loadoutKeys} end

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
                        ESX.ShowNotification('~r~Diese Waffe ist hier nicht erlaubt!')
                    end
                end

                -- Fahrzeug-Spawning (falls aktiviert)
                if currentLobby.vehiclesAllowed then
                    SpawnLobbyVehicle()
                end
            end
        end
    end
end)

function SpawnLobbyVehicle()
    local ped = PlayerPedId()
    if not IsPedInAnyVehicle(ped, false) then
        if spawnedVehicle == nil or not DoesEntityExist(spawnedVehicle) then
            local model = GetHashKey(Config.DefaultVehicle or 'bati')
            RequestModel(model)
            while not HasModelLoaded(model) do Wait(0) end

            local coords = GetEntityCoords(ped)
            spawnedVehicle = CreateVehicle(model, coords.x, coords.y, coords.z, GetEntityHeading(ped), true, false)
            SetVehicleOnGroundProperly(spawnedVehicle)
            SetPedIntoVehicle(ped, spawnedVehicle, -1)
            SetEntityAsMissionEntity(spawnedVehicle, true, true)
            SetModelAsNoLongerNeeded(model)
        end
    end
end

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
        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)

        -- Reset Relationship if TDM
        if currentLobby.mode == 'tdm' then
            TriggerEvent('ffa:syncTeam', playerState.team)
        end
    end)
end

-- TDM Relationship Logic
RegisterNetEvent('ffa:syncTeam')
AddEventHandler('ffa:syncTeam', function(team)
    playerState.team = team
    local ped = PlayerPedId()

    AddRelationshipGroup('FFA_BLUE')
    AddRelationshipGroup('FFA_RED')

    if team == 'blue' then
        SetPedRelationshipGroupHash(ped, GetHashKey('FFA_BLUE'))
    elseif team == 'red' then
        SetPedRelationshipGroupHash(ped, GetHashKey('FFA_RED'))
    end

    -- 1 = Like, 5 = Hate
    SetRelationshipBetweenGroups(1, GetHashKey('FFA_BLUE'), GetHashKey('FFA_BLUE'))
    SetRelationshipBetweenGroups(1, GetHashKey('FFA_RED'), GetHashKey('FFA_RED'))
    SetRelationshipBetweenGroups(5, GetHashKey('FFA_BLUE'), GetHashKey('FFA_RED'))
    SetRelationshipBetweenGroups(5, GetHashKey('FFA_RED'), GetHashKey('FFA_BLUE'))

    -- Friendly Fire
    if currentLobby and not currentLobby.friendlyFire then
        SetCanAttackFriendly(ped, false, false)
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
