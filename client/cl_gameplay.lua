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
        mode = lobby.mode,
        isPersistent = lobby.isPersistent
    })
    TriggerEvent('ffa:updateHUDStats', 0, 0)
end)

-- Redundante Funktionen entfernt, nutzen jetzt cl_main.lua (StartCountdown & TeleportToMap)

-- Funktion: Teilt das gewählte Loadout an den Spieler aus
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
                    ESX.ShowNotification('~r~Du verlässt das Kampfgebiet!')
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                end

                -- Waffen-Validierung
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
                        ESX.ShowNotification('~r~Diese Waffe ist in dieser Lobby nicht erlaubt!')
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

                -- Ermitteln der Server-ID des Killers
                if IsEntityAPed(killerId) and IsPedAPlayer(killerId) then
                    killerServerId = GetPlayerServerId(NetworkGetPlayerIndexFromPed(killerId))
                end

                TriggerServerEvent('ffa:playerKilled', killerServerId)

                -- Kill-Cam und Respawn-Logik ausführen
                HandleDeath(killerId)

                -- Warten bis Spieler wieder lebt
                while IsEntityDead(ped) do Citizen.Wait(100) end
            end
        end
    end
end)

-- Funktion: Behandelt Tod, Kill-Cam und Respawn
-- Funktion: Behandelt Tod, Kill-Cam/Zuschauen und Respawn
function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local killerCoords = GetEntityCoords(killerPed)
        local playerPed = PlayerPedId()

        -- Kill-Cam: Fokus für 3 Sek auf den Mörder
        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        SetCamCoord(cam, GetEntityCoords(playerPed))
        PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
        RenderScriptCams(true, true, 1000, true, true)

        Wait(3000)

        -- Wenn Respawn noch nicht fällig, wechsle in Zuschauer-Modus
        if currentLobby.respawnTime > 3 then
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)

            -- Automatisch auf Killer oder zufälligen Spieler schauen
            if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
                NetworkSetInSpectatorMode(true, killerPed)
            end

            Wait((currentLobby.respawnTime - 3) * 1000)
            NetworkSetInSpectatorMode(false, playerPed)
        else
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
        end

        -- Wiederbelebung an zufälligem Punkt auf der Map
        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)
    end)
end

-- Zuschauer-Modus (Fixiert Kamera auf Zielspieler)
RegisterNetEvent('ffa:spectatePlayer')
AddEventHandler('ffa:spectatePlayer', function(targetId)
    local targetPed = GetPlayerPed(GetPlayerFromServerId(targetId))
    if DoesEntityExist(targetPed) then
        NetworkSetInSpectatorMode(true, targetPed)
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

-- Event: Spielende (Sieg-Anzeige und Sperren)
RegisterNetEvent('ffa:gameEnded')
AddEventHandler('ffa:gameEnded', function(data)
    playerState.isInGame = false
    FreezeEntityPosition(PlayerPedId(), true) -- Spieler am Platz halten
    SendNUIMessage({
        action = 'showWinner',
        winnerName = data.winnerName,
        stats = data.stats
    })

    -- Waffen entfernen am Rundenende
    RemoveAllPedWeapons(PlayerPedId(), true)
end)

-- Anti-Teamkill & Fahrzeug-Spawn (Verschoben aus cl_nui.lua für bessere Struktur)
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local playerPed = PlayerPedId()
            if not IsPedInAnyVehicle(playerPed, false) then
                local coords = GetEntityCoords(playerPed)
                local vehicle = GetClosestVehicle(coords.x, coords.y, coords.z, 30.0, 0, 71)

                if vehicle == 0 then
                    local spawnPos = GetOffsetFromEntityInWorldCoords(playerPed, 0.0, 15.0, 0.0)
                    local model = `zentorno`
                    RequestModel(model)
                    while not HasModelLoaded(model) do Wait(10) end

                    local veh = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(playerPed), true, false)
                    SetVehicleOnGroundProperly(veh)
                    SetEntityAsMissionEntity(veh, true, true)
                    SetModelAsNoLongerNeeded(model)
                end
            end
        end
    end
end)

RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    local myTeam = teams[myId]
    if not myTeam or myTeam == 'ffa' then return end

    AddRelationshipGroup('BLUE_TEAM')
    AddRelationshipGroup('RED_TEAM')

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), `BLUE_TEAM`)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), `RED_TEAM`)
    end

    SetRelationshipBetweenGroups(1, `BLUE_TEAM`, `BLUE_TEAM`)
    SetRelationshipBetweenGroups(1, `RED_TEAM`, `RED_TEAM`)
    SetRelationshipBetweenGroups(5, `BLUE_TEAM`, `RED_TEAM`)
    SetRelationshipBetweenGroups(5, `RED_TEAM`, `BLUE_TEAM`)
end)
