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
        mode = lobby.mode,
        isPersistent = lobby.isPersistent
    })
end)

function GiveLoadout(loadoutKey)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    local keys = {}
    if type(loadoutKey) == "table" then
        keys = loadoutKey
    else
        table.insert(keys, loadoutKey)
    end

    for _, key in ipairs(keys) do
        local loadout = Config.WeaponLoadouts[key]
        if loadout then
            for _, weapon in ipairs(loadout) do
                GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
            end
        end
    end
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
                    ESX.ShowNotification('~r~Du verlässt das Kampfgebiet!')
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                end

                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    -- Hier prüfen wir gegen alle erlaubten Loadouts
                    local keys = type(currentLobby.loadout) == "table" and currentLobby.loadout or {currentLobby.loadout}
                    for _, lKey in ipairs(keys) do
                        local loadout = Config.WeaponLoadouts[lKey]
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
        local respawnTime = (currentLobby and currentLobby.respawnTime) or 5

        -- Kill-Cam
        if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
            local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
            local killerCoords = GetEntityCoords(killerPed)
            SetCamCoord(cam, GetEntityCoords(playerPed))
            PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
            RenderScriptCams(true, true, 1000, true, true)

            Wait(3000)

            if respawnTime > 3 then
                NetworkSetInSpectatorMode(true, killerPed)
                Wait((respawnTime - 3) * 1000)
                NetworkSetInSpectatorMode(false, playerPed)
            end

            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
        else
            Wait(respawnTime * 1000)
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

-- Fahrzeug Spawn
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        if playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local ped = PlayerPedId()
            if not IsPedInAnyVehicle(ped, false) and not playerVehicle then
                local spawnPos = GetOffsetFromEntityInWorldCoords(ped, 0.0, 5.0, 0.0)
                local model = GetHashKey('bati')
                RequestModel(model)
                while not HasModelLoaded(model) do Wait(0) end

                playerVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(ped), true, false)
                SetVehicleOnGroundProperly(playerVehicle)
                SetEntityAsMissionEntity(playerVehicle, true, true)
                SetModelAsNoLongerNeeded(model)
                TaskWarpPedIntoVehicle(ped, playerVehicle, -1)
            end
        end
    end
end)

-- Anti-Teamkill
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    local myTeam = teams[tostring(myId)] or teams[myId]

    if not myTeam or myTeam == 'ffa' then return end

    local _, blueGroup = AddRelationshipGroup("FFA_BLUE")
    local _, redGroup = AddRelationshipGroup("FFA_RED")

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), blueGroup)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), redGroup)
    end

    SetRelationshipBetweenGroups(1, blueGroup, blueGroup)
    SetRelationshipBetweenGroups(1, redGroup, redGroup)
    SetRelationshipBetweenGroups(5, blueGroup, redGroup)
    SetRelationshipBetweenGroups(5, redGroup, blueGroup)
end)
