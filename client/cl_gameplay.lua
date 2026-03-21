local lastVehicle = nil

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
    SendNUIMessage({ action = 'showHUD', mode = lobby.mode })
    TriggerEvent('ffa:updateHUDStats', 0, 0)
end)

function GiveLoadout(loadoutKeys)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    for _, key in ipairs(loadoutKeys) do
        local weapons = Config.WeaponLoadouts[key]
        if weapons then
            for _, w in ipairs(weapons) do
                GiveWeaponToPed(ped, GetHashKey(w.name), w.ammo, false, true)
            end
        end
    end
end

-- Grenzprüfung, Waffen-Validierung
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState.isInGame and currentLobby then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local map = Utils.GetMapById(currentLobby.mapId)

            if map then
                -- Map-Grenzprüfung
                if #(coords - map.center) > map.radius then
                    ESX.ShowNotification('~r~Du verlässt das Kampfgebiet!')
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                end

                -- Waffen-Validierung
                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    for _, key in ipairs(currentLobby.loadout) do
                        local loadout = Config.WeaponLoadouts[key]
                        if loadout then
                            for _, w in ipairs(loadout) do
                                if GetHashKey(w.name) == currentWeapon then allowed = true break end
                            end
                        end
                        if allowed then break end
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

        -- Spectator
        if currentLobby.respawnTime > 3 then
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
            if killerPed ~= playerPed and IsPedAPlayer(killerPed) then
                NetworkSetInSpectatorMode(true, killerPed)
                SendNUIMessage({ action = 'showSpectator', name = GetPlayerName(NetworkGetPlayerIndexFromPed(killerPed)) })
            end
            Wait((currentLobby.respawnTime - 3) * 1000)
            NetworkSetInSpectatorMode(false, playerPed)
            SendNUIMessage({ action = 'hideSpectator' })
        else
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
        end

        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)
    end)
end

-- Fahrzeug-Spawn & Teamkill Logic
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(2000)
        if playerState.isInGame and currentLobby then
            -- Fahrzeuge
            if currentLobby.vehiclesAllowed then
                local ped = PlayerPedId()
                local coords = GetEntityCoords(ped)
                local vehicle = GetClosestVehicle(coords.x, coords.y, coords.z, 30.0, 0, 71)

                -- Lösche altes Fahrzeug wenn zu weit weg
                if lastVehicle and DoesEntityExist(lastVehicle) then
                    local vCoords = GetEntityCoords(lastVehicle)
                    if #(coords - vCoords) > 50.0 then
                        DeleteEntity(lastVehicle)
                        lastVehicle = nil
                    end
                end

                if vehicle == 0 and not lastVehicle then
                    local model = `zentorno`
                    RequestModel(model)
                    while not HasModelLoaded(model) do Wait(0) end
                    lastVehicle = CreateVehicle(model, GetOffsetFromEntityInWorldCoords(ped, 0.0, 10.0, 0.0), GetEntityHeading(ped), true, false)
                    SetVehicleOnGroundProperly(lastVehicle)
                    SetEntityAsMissionEntity(lastVehicle, true, true)
                    SetModelAsNoLongerNeeded(model)
                end
            elseif lastVehicle then
                if DoesEntityExist(lastVehicle) then DeleteEntity(lastVehicle) end
                lastVehicle = nil
            end

            -- Anti-Teamkill
            if currentLobby.mode == 'tdm' and not currentLobby.friendlyFire then
                NetworkSetFriendlyFireOption(false)
                SetCanAttackFriendly(PlayerPedId(), false, false)
            else
                NetworkSetFriendlyFireOption(true)
                SetCanAttackFriendly(PlayerPedId(), true, false)
            end
        end
    end
end)

-- Relationship Groups für Anti-Teamkill
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myTeam = teams[GetPlayerServerId(PlayerId())]
    if not myTeam then return end

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
end)

-- HUD Updates
RegisterNetEvent('ffa:updateTimer')
AddEventHandler('ffa:updateTimer', function(time) SendNUIMessage({ action = 'updateHUD', time = time }) end)

RegisterNetEvent('ffa:updateHUDStats')
AddEventHandler('ffa:updateHUDStats', function(kills, deaths)
    if kills > playerState.kills then SendNUIMessage({ action = 'playSound', name = 'kill' }) end
    playerState.kills, playerState.deaths = kills, deaths
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
    SendNUIMessage({ action = 'showWinner', winnerName = data.winnerName, stats = data.stats })
    RemoveAllPedWeapons(PlayerPedId(), true)
    SetNuiFocus(true, true)
    if lastVehicle then DeleteEntity(lastVehicle) lastVehicle = nil end
end)

RegisterNetEvent('ffa:updateVotes')
AddEventHandler('ffa:updateVotes', function(votes) SendNUIMessage({ action = 'updateVotes', votes = votes }) end)
