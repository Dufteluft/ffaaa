local lastVehicle = nil

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
function GiveLoadout(loadoutKey)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    local function GiveWeapons(key)
        local weapons = Config.WeaponLoadouts[key]
        if weapons then
            for _, weapon in ipairs(weapons) do
                GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
            end
        end
    end

    if type(loadoutKey) == 'table' then
        for _, key in ipairs(loadoutKey) do
            GiveWeapons(key)
        end
    else
        GiveWeapons(loadoutKey)
    end
end

-- Map-Grenzprüfung, Waffen-Validierung und Fahrzeug-Spawn
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

                -- Waffen-Validierung
                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    local function CheckAllowed(key)
                        local loadout = Config.WeaponLoadouts[key]
                        if loadout then
                            for _, w in ipairs(loadout) do
                                if GetHashKey(w.name) == currentWeapon then return true end
                            end
                        end
                        return false
                    end

                    if type(currentLobby.loadout) == 'table' then
                        for _, key in ipairs(currentLobby.loadout) do
                            if CheckAllowed(key) then allowed = true; break end
                        end
                    else
                        allowed = CheckAllowed(currentLobby.loadout)
                    end

                    if not allowed then
                        RemoveWeaponFromPed(ped, currentWeapon)
                        ESX.ShowNotification('~r~Diese Waffe ist hier nicht erlaubt!')
                    end
                end

                -- Fahrzeug-Spawn Logik
                if currentLobby.vehiclesAllowed then
                    local vehicle = GetClosestVehicle(coords.x, coords.y, coords.z, 30.0, 0, 71)
                    if vehicle == 0 then
                        if lastVehicle and DoesEntityExist(lastVehicle) then
                            DeleteEntity(lastVehicle)
                        end

                        local spawnPos = GetOffsetFromEntityInWorldCoords(ped, 0.0, 10.0, 0.0)
                        local model = `zentorno`
                        RequestModel(model)
                        while not HasModelLoaded(model) do Wait(10) end

                        lastVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(ped), true, false)
                        SetVehicleOnGroundProperly(lastVehicle)
                        SetEntityAsMissionEntity(lastVehicle, true, true)
                        SetModelAsNoLongerNeeded(model)
                    end
                end
            end
        end
    end
end)

-- Kill-Erkennung: Prüft ständig auf Tod des Spielers
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

-- Funktion: Behandelt Tod, Kill-Cam/Zuschauen und Respawn
function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local playerPed = PlayerPedId()
        local respawnTime = currentLobby.respawnTime or 5

        -- Kill-Cam: Fokus für 3 Sek auf den Mörder
        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
            local killerCoords = GetEntityCoords(killerPed)
            SetCamCoord(cam, GetEntityCoords(playerPed))
            PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
            RenderScriptCams(true, true, 1000, true, true)
        end

        Wait(3000)

        -- Wenn Respawn noch nicht fällig, wechsle in Zuschauer-Modus
        if respawnTime > 3 then
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)

            if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
                NetworkSetInSpectatorMode(true, killerPed)
            end

            Wait((respawnTime - 3) * 1000)
            NetworkSetInSpectatorMode(false, playerPed)
        else
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
        end

        -- Wiederbelebung
        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)
    end)
end

-- Anti-Teamkill via Native Friendly Fire Option
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myTeam = teams[GetPlayerServerId(PlayerId())]
    if not myTeam or myTeam == 'ffa' then
        NetworkSetFriendlyFireOption(true)
        return
    end

    -- Wenn Friendly Fire aus ist (Standard in TDM)
    if not currentLobby.friendlyFire then
        NetworkSetFriendlyFireOption(false)
        SetCanAttackFriendly(PlayerPedId(), false, false)
    else
        NetworkSetFriendlyFireOption(true)
    end
end)

-- HUD-Aktualisierungen vom Server
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
    if kills > 0 then SendNUIMessage({ action = 'playSound', sound = 'kill' }) end
end)

RegisterNetEvent('ffa:updateTDMScore')
AddEventHandler('ffa:updateTDMScore', function(blue, red)
    SendNUIMessage({
        action = 'updateHUD',
        scoreBlue = blue,
        scoreRed = red
    })
end)

-- Event: Spielende
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
