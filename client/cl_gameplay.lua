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

    -- Fahrzeug spawnen wenn erlaubt
    if lobby.vehiclesAllowed then
        SpawnLobbyVehicle()
    end

    SendNUIMessage({
        action = 'showHUD',
        mode = lobby.mode
    })

    SetupTeamRelationships()
end)

function GiveLoadout(loadout)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    local function give(key)
        local items = Config.WeaponLoadouts[key]
        if items then
            for _, w in ipairs(items) do
                GiveWeaponToPed(ped, GetHashKey(w.name), w.ammo, false, true)
            end
        end
    end

    if type(loadout) == 'table' then
        for _, key in ipairs(loadout) do give(key) end
    else
        give(loadout)
    end
end

function SpawnLobbyVehicle()
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local model = GetHashKey('bati')

    RequestModel(model)
    while not HasModelLoaded(model) do Wait(0) end

    if playerVehicle and DoesEntityExist(playerVehicle) then DeleteEntity(playerVehicle) end

    playerVehicle = CreateVehicle(model, coords.x, coords.y, coords.z, GetEntityHeading(ped), true, false)
    SetPedIntoVehicle(ped, playerVehicle, -1)
    SetEntityAsMissionEntity(playerVehicle, true, true)
    SetModelAsNoLongerNeeded(model)
end

function SetupTeamRelationships()
    local _, blueGroup = AddRelationshipGroup("FFA_BLUE")
    local _, redGroup = AddRelationshipGroup("FFA_RED")
    local _, ffaGroup = AddRelationshipGroup("FFA_NEUTRAL")

    SetRelationshipBetweenGroups(1, blueGroup, blueGroup)
    SetRelationshipBetweenGroups(1, redGroup, redGroup)
    SetRelationshipBetweenGroups(5, blueGroup, redGroup)
    SetRelationshipBetweenGroups(5, redGroup, blueGroup)
    SetRelationshipBetweenGroups(5, ffaGroup, ffaGroup)

    local ped = PlayerPedId()
    if playerState.team == 'blue' then SetPedRelationshipGroupHash(ped, blueGroup)
    elseif playerState.team == 'red' then SetPedRelationshipGroupHash(ped, redGroup)
    else SetPedRelationshipGroupHash(ped, ffaGroup) end
end

Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState.isInGame and currentLobby then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local map = Utils.GetMapById(currentLobby.mapId)

            if map then
                if #(coords - map.center) > map.radius then
                    ESX.ShowNotification('~r~Du verlässt das Kampfgebiet!')
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                end

                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    local function check(key)
                        local lo = Config.WeaponLoadouts[key]
                        if lo then
                            for _, w in ipairs(lo) do
                                if GetHashKey(w.name) == currentWeapon then return true end
                            end
                        end
                        return false
                    end

                    if type(currentLobby.loadout) == 'table' then
                        for _, k in ipairs(currentLobby.loadout) do
                            if check(k) then allowed = true break end
                        end
                    else
                        allowed = check(currentLobby.loadout)
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

                while IsEntityDead(ped) do Wait(100) end
            end
        end
    end
end)

function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local playerPed = PlayerPedId()
        local respawnTime = (currentLobby and currentLobby.respawnTime or 5) * 1000

        if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
            local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
            SetCamCoord(cam, GetEntityCoords(playerPed))
            PointCamAtEntity(cam, killerPed, 0.0, 0.0, 0.0, true)
            RenderScriptCams(true, true, 1000, true, true)

            -- Zuschauen bis zum Respawn
            local waitTime = math.max(1000, respawnTime - 500)
            Wait(waitTime)

            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
        else
            Wait(respawnTime)
        end

        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)

        if currentLobby.vehiclesAllowed then SpawnLobbyVehicle() end
    end)
end

RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    playerState.team = teams[tostring(GetPlayerServerId(PlayerId()))] or 'ffa'
    SetupTeamRelationships()
end)

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
    if playerVehicle and DoesEntityExist(playerVehicle) then DeleteEntity(playerVehicle) end

    SendNUIMessage({
        action = 'showWinner',
        winnerName = data.winnerName,
        stats = data.stats
    })
    RemoveAllPedWeapons(PlayerPedId(), true)
end)

RegisterNUICallback('playSound', function(data, cb)
    cb('ok')
end)
