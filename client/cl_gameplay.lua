-- Event: Spielstart-Vorbereitung
RegisterNetEvent('ffa:gameStarting')
AddEventHandler('ffa:gameStarting', function(lobby)
    currentLobby = lobby
    playerState.isInGame = true
    playerState.kills = 0
    playerState.deaths = 0

    -- UI ausblenden
    SendNUIMessage({ action = 'gameStarting' })
    SetNuiFocus(false, false)

    -- Teleportation
    TeleportToMap(lobby.mapId)

    -- Countdown (außer bei persistenten Lobbys die bereits laufen)
    if not lobby.isPersistent then
        StartCountdown(10)
    else
        FreezeEntityPosition(PlayerPedId(), false)
        SendNUIMessage({ action = 'countdown', seconds = 0 })
    end

    -- Waffen austeilen
    GiveLoadout(lobby.loadout)

    -- HUD einblenden
    SendNUIMessage({
        action = 'showHUD',
        isPersistent = lobby.isPersistent
    })
    TriggerEvent('ffa:updateHUDStats', 0, 0)
end)

-- Funktion: Teilt das gewählte Loadout aus (Unterstützt Multi-Select)
function GiveLoadout(loadoutKeys)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    if type(loadoutKeys) ~= "table" then loadoutKeys = {loadoutKeys} end

    for _, key in ipairs(loadoutKeys) do
        local category = Config.WeaponLoadouts[key]
        if category then
            for _, weapon in ipairs(category.weapons) do
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
                -- Grenzprüfung
                local dist = #(coords - map.center)
                if dist > map.radius then
                    ESX.ShowNotification('~r~' .. _U('out_of_bounds'))
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                end

                -- Waffen-Validierung
                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    local loadoutKeys = currentLobby.loadout
                    if type(loadoutKeys) ~= "table" then loadoutKeys = {loadoutKeys} end

                    for _, key in ipairs(loadoutKeys) do
                        local category = Config.WeaponLoadouts[key]
                        if category then
                            for _, w in ipairs(category.weapons) do
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
                        ESX.ShowNotification('~r~' .. _U('weapon_not_allowed'))
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

-- Funktion: Behandelt Tod, Kill-Cam und Respawn
function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local playerPed = PlayerPedId()
        local killerCoords = GetEntityCoords(killerPed)
        local respawnTime = (currentLobby and currentLobby.respawnTime) or 5

        -- Kill-Cam: Sanfter Zoom auf den Killer
        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        local playerCoords = GetEntityCoords(playerPed)
        SetCamCoord(cam, playerCoords.x, playerCoords.y, playerCoords.z + 1.0)
        PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
        SetCamActive(cam, true)
        RenderScriptCams(true, true, 1000, true, true)

        Wait(3000)

        -- Übergang zum Zuschauer-Modus oder direkt zum Respawn
        if respawnTime > 3 then
            RenderScriptCams(false, true, 500, true, true)
            SetCamActive(cam, false)
            DestroyCam(cam, true)

            -- Spectate Killer
            if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
                NetworkSetInSpectatorMode(true, killerPed)
            end

            -- Timer Anzeige in der UI
            local remaining = respawnTime - 3
            while remaining > 0 do
                SendNUIMessage({ action = 'countdown', seconds = remaining })
                Wait(1000)
                remaining = remaining - 1
            end
            NetworkSetInSpectatorMode(false, playerPed)
        else
            RenderScriptCams(false, true, 500, true, true)
            SetCamActive(cam, false)
            DestroyCam(cam, true)
            Wait((respawnTime > 0 and (respawnTime - 3) or 0) * 1000)
        end

        -- Respawn an zufälligem Punkt
        if currentLobby then
            local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
            NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
            GiveLoadout(currentLobby.loadout)
            SendNUIMessage({ action = 'countdown', seconds = 0 })
        end
    end)
end

-- Fahrzeug-Spawn Logik
local lastVehicle = nil
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        if playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local playerPed = PlayerPedId()
            if not IsPedInAnyVehicle(playerPed, false) then
                local coords = GetEntityCoords(playerPed)
                local vehicle = GetClosestVehicle(coords.x, coords.y, coords.z, 20.0, 0, 71)

                if vehicle == 0 then
                    if lastVehicle and DoesEntityExist(lastVehicle) then DeleteEntity(lastVehicle) end

                    local spawnPos = GetOffsetFromEntityInWorldCoords(playerPed, 0.0, 5.0, 0.0)
                    local model = `zentorno`
                    RequestModel(model)
                    while not HasModelLoaded(model) do Wait(10) end

                    lastVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(playerPed), true, false)
                    SetVehicleOnGroundProperly(lastVehicle)
                    SetEntityAsMissionEntity(lastVehicle, true, true)
                    SetModelAsNoLongerNeeded(model)
                end
            end
        end
    end
end)

-- Anti-Teamkill
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myTeam = teams[GetPlayerServerId(PlayerId())]
    if not myTeam or myTeam == 'ffa' then
        NetworkSetFriendlyFireOption(true)
        return
    end

    NetworkSetFriendlyFireOption(not (currentLobby and not currentLobby.friendlyFire))

    for serverId, team in pairs(teams) do
        local playerIndex = GetPlayerFromServerId(serverId)
        if playerIndex ~= -1 then
            local targetPed = GetPlayerPed(playerIndex)
            if team == myTeam then
                SetCanAttackFriendly(PlayerPedId(), false, false)
                NetworkSetFriendlyFireOption(false)
            end
        end
    end
end)

-- HUD-Aktualisierungen
RegisterNetEvent('ffa:updateTimer')
AddEventHandler('ffa:updateTimer', function(time)
    SendNUIMessage({ action = 'updateHUD', time = time })
end)

RegisterNetEvent('ffa:updateHUDStats')
AddEventHandler('ffa:updateHUDStats', function(kills, deaths)
    if kills > playerState.kills then SendNUIMessage({ action = 'playSound', sound = 'kill' }) end
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
