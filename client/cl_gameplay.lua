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

    if lobby.vehiclesAllowed then
        SpawnLobbyVehicle()
    end
end)

function GiveLoadout(loadoutKey)
    local loadout = Config.WeaponLoadouts[loadoutKey]
    local ped = PlayerPedId()

    RemoveAllPedWeapons(ped, true)
    if loadout then
        for _, weapon in ipairs(loadout) do
            GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
        end
    end
end

function SpawnLobbyVehicle()
    local model = GetHashKey(Config.DefaultSettings.defaultVehicle or 'bati')
    RequestModel(model)
    while not HasModelLoaded(model) do Wait(0) end

    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    spawnedVehicle = CreateVehicle(model, coords.x, coords.y, coords.z, GetEntityHeading(ped), true, false)
    TaskWarpPedIntoVehicle(ped, spawnedVehicle, -1)
    SetModelAsNoLongerNeeded(model)
end

RegisterNetEvent('ffa:syncTeam')
AddEventHandler('ffa:syncTeam', function(team)
    playerState.team = team

    local ped = PlayerPedId()
    if team == 'blue' then
        AddRelationshipGroup('BLUE_TEAM')
        SetPedRelationshipGroupHash(ped, GetHashKey('BLUE_TEAM'))
    elseif team == 'red' then
        AddRelationshipGroup('RED_TEAM')
        SetPedRelationshipGroupHash(ped, GetHashKey('RED_TEAM'))
    end

    SetRelationshipBetweenGroups(1, GetHashKey('BLUE_TEAM'), GetHashKey('BLUE_TEAM'))
    SetRelationshipBetweenGroups(1, GetHashKey('RED_TEAM'), GetHashKey('RED_TEAM'))
    SetRelationshipBetweenGroups(5, GetHashKey('BLUE_TEAM'), GetHashKey('RED_TEAM'))
    SetRelationshipBetweenGroups(5, GetHashKey('RED_TEAM'), GetHashKey('BLUE_TEAM'))

    if currentLobby and not currentLobby.friendlyFire then
        NetworkSetFriendlyFireOption(false)
    else
        NetworkSetFriendlyFireOption(true)
    end
end)

-- Gameplay Loop
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

                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    local loadout = Config.WeaponLoadouts[currentLobby.loadout]
                    if loadout then
                        for _, w in ipairs(loadout) do
                            if GetHashKey(w.name) == currentWeapon then
                                allowed = true
                                break
                            end
                        end
                    end
                    if not allowed then
                        RemoveWeaponFromPed(ped, currentWeapon)
                    end
                end
            end
        end
    end
end)

-- Kill Recognition
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(0)
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
                while IsEntityDead(PlayerPedId()) do Wait(100) end
            end
        end
    end
end)

function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local killerCoords = GetEntityCoords(killerPed)
        local ped = PlayerPedId()

        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        SetCamCoord(cam, GetEntityCoords(ped))
        PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
        RenderScriptCams(true, true, 1000, true, true)

        Wait(3000)

        local respawnTime = currentLobby and currentLobby.respawnTime or 5
        if respawnTime > 3 then
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
            if killerPed ~= ped then
                NetworkSetInSpectatorMode(true, killerPed)
            end
            Wait((respawnTime - 3) * 1000)
            NetworkSetInSpectatorMode(false, ped)
        else
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
        end

        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)
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
end)
