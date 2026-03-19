-- Spielstart Vorbereitung (Teleport, Loadout)
RegisterNetEvent('ffa:gameStarting')
AddEventHandler('ffa:gameStarting', function(lobby)
    currentLobby = lobby
    playerState.isInGame = true
    playerState.kills = 0
    playerState.deaths = 0

    -- NUI für Spielstart anpassen
    SendNUIMessage({ action = 'gameStarting' })
    SetNuiFocus(false, false)

    -- Teleportation auf die Map
    TeleportToMap(lobby.mapId)

    if lobby.isPersistent then
        -- In persistenten Lobbys kein Countdown notwendig
        FreezeEntityPosition(PlayerPedId(), false)
        SendNUIMessage({ action = 'countdown', seconds = 0 })
    else
        StartCountdown(10)
    end

    -- Loadout austeilen (kann Array von Keys sein)
    GiveLoadout(lobby.loadout)

    -- HUD aktivieren
    SendNUIMessage({
        action = 'showHUD',
        isPersistent = lobby.isPersistent,
        mode = lobby.mode
    })
    TriggerEvent('ffa:updateHUDStats', 0, 0)
end)

-- Loadout Verteilung (Unterstützt Multi-Select)
function GiveLoadout(loadoutKeys)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    if type(loadoutKeys) ~= 'table' then loadoutKeys = { loadoutKeys } end

    for _, key in ipairs(loadoutKeys) do
        local weapons = Config.WeaponLoadouts[key]
        if weapons then
            for _, w in ipairs(weapons) do
                GiveWeaponToPed(ped, GetHashKey(w.name), w.ammo, false, true)
            end
        end
    end
end

-- Grenzprüfung und Waffen-Check Loop
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1500)
        if playerState.isInGame and currentLobby then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local map = Utils.GetMapById(currentLobby.mapId)

            if map then
                local dist = #(coords - map.center)
                if dist > map.radius then
                    ESX.ShowNotification('~r~Achtung: Du verlässt das Kampfgebiet!')
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                end

                -- Waffenvalidierung
                local weapon = GetSelectedPedWeapon(ped)
                if weapon ~= `WEAPON_UNARMED` then
                    local allowed = false
                    local keys = type(currentLobby.loadout) == 'table' and currentLobby.loadout or { currentLobby.loadout }
                    for _, k in ipairs(keys) do
                        local list = Config.WeaponLoadouts[k]
                        if list then
                            for _, w in ipairs(list) do
                                if GetHashKey(w.name) == weapon then allowed = true; break end
                            end
                        end
                        if allowed then break end
                    end
                    if not allowed then
                        RemoveWeaponFromPed(ped, weapon)
                        ESX.ShowNotification('~r~Diese Waffe ist hier nicht erlaubt!')
                    end
                end
            end
        end
    end
end)

-- Kill-Erkennung Loop
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

-- Tod-Behandlung: Kill-Cam und Respawn
function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local ped = PlayerPedId()
        local killerCoords = GetEntityCoords(killerPed)

        -- Kill-Cam Fokus für 3 Sekunden
        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        SetCamCoord(cam, GetEntityCoords(ped))
        PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
        RenderScriptCams(true, true, 1000, true, true)

        Wait(3000)

        -- Spectator-Modus bis Respawn (falls Zeit > 3s)
        local respawnTime = (currentLobby and currentLobby.respawnTime or 5)
        if respawnTime > 3 then
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
            if DoesEntityExist(killerPed) and killerPed ~= ped then
                NetworkSetInSpectatorMode(true, killerPed)
            end
            Wait((respawnTime - 3) * 1000)
            NetworkSetInSpectatorMode(false, ped)
        else
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
        end

        -- Respawn an zufälligem Punkt
        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)
    end)
end

-- Fahrzeug-System (wenn in Lobby aktiv)
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        if playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local ped = PlayerPedId()
            local veh = GetClosestVehicle(GetEntityCoords(ped), 25.0, 0, 71)
            if veh == 0 then
                local spawnPos = GetOffsetFromEntityInWorldCoords(ped, 0.0, 10.0, 0.0)
                local model = `zentorno`
                RequestModel(model)
                while not HasModelLoaded(model) do Wait(10) end
                local v = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(ped), true, false)
                SetVehicleOnGroundProperly(v)
                SetModelAsNoLongerNeeded(model)
            end
        end
    end
end)

-- Anti-Teamkill via Friendly Fire Option
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    local myTeam = teams[myId]
    if not myTeam or myTeam == 'ffa' then return end

    if currentLobby and not currentLobby.friendlyFire then
        NetworkSetFriendlyFireOption(false)
        SetCanAttackFriendly(PlayerPedId(), false, false)
    else
        NetworkSetFriendlyFireOption(true)
        SetCanAttackFriendly(PlayerPedId(), true, true)
    end
end)

-- HUD Updates vom Server
RegisterNetEvent('ffa:updateTimer')
AddEventHandler('ffa:updateTimer', function(time)
    SendNUIMessage({ action = 'updateHUD', time = time })
end)

RegisterNetEvent('ffa:updateHUDStats')
AddEventHandler('ffa:updateHUDStats', function(k, d)
    playerState.kills, playerState.deaths = k, d
    SendNUIMessage({ action = 'updateHUD', kills = k, deaths = d, mode = currentLobby.mode })
end)

RegisterNetEvent('ffa:updateTDMScore')
AddEventHandler('ffa:updateTDMScore', function(blue, red)
    SendNUIMessage({ action = 'updateHUD', scoreBlue = blue, scoreRed = red, mode = currentLobby.mode })
end)

-- Spielende Anzeige
RegisterNetEvent('ffa:gameEnded')
AddEventHandler('ffa:gameEnded', function(data)
    playerState.isInGame = false
    FreezeEntityPosition(PlayerPedId(), true)
    SendNUIMessage({ action = 'showWinner', winnerName = data.winnerName, stats = data.stats })
    RemoveAllPedWeapons(PlayerPedId(), true)
end)
