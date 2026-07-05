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
        isPersistent = lobby.isPersistent
    })

    -- Anti-Teamkill Initialisierung
    if lobby.mode == 'tdm' and not lobby.friendlyFire then
        NetworkSetFriendlyFireOption(false)
    else
        NetworkSetFriendlyFireOption(true)
    end

    -- HUD Initialisierung
    SendNUIMessage({
        action = 'updateHUD',
        kills = 0,
        deaths = 0,
        mode = lobby.mode,
        scoreBlue = 0,
        scoreRed = 0
    })
end)

local spawnedVehicle = nil

-- Funktion: Spawnt ein Fahrzeug für den Spieler
function SpawnLobbyVehicle()
    if spawnedVehicle and DoesEntityExist(spawnedVehicle) then
        DeleteEntity(spawnedVehicle)
    end

    local model = GetHashKey(Config.DefaultSettings.defaultVehicle or 'bati')
    RequestModel(model)
    while not HasModelLoaded(model) do Wait(0) end

    local ped = PlayerPedId()
    local coords = GetOffsetFromEntityInWorldCoords(ped, 0.0, 3.0, 0.0)
    spawnedVehicle = CreateVehicle(model, coords.x, coords.y, coords.z, GetEntityHeading(ped), true, false)
    SetVehicleOnGroundProperly(spawnedVehicle)
    SetEntityAsMissionEntity(spawnedVehicle, true, true)

    SetModelAsNoLongerNeeded(model)
end

-- Fahrzeug-Spawn Logik (wenn in Lobby aktiviert)
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        if playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local ped = PlayerPedId()
            if not IsPedInAnyVehicle(ped, false) then
                local coords = GetEntityCoords(ped)
                local vehicle = GetClosestVehicle(coords.x, coords.y, coords.z, 15.0, 0, 71)

                if vehicle == 0 then
                    SpawnLobbyVehicle()
                end
            end
        end
    end
end)

-- Synchronisation der Teams und Relationship Groups (Anti-Teamkill)
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    local myTeam = teams[myId]
    if not myTeam then return end

    local _, blueGroup = AddRelationshipGroup('BLUE_TEAM')
    local _, redGroup = AddRelationshipGroup('RED_TEAM')

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), blueGroup)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), redGroup)
    else
        SetPedRelationshipGroupHash(PlayerPedId(), GetHashKey('PLAYER'))
    end

    -- Relationen setzen: 1 = Like, 5 = Hate
    SetRelationshipBetweenGroups(1, blueGroup, blueGroup)
    SetRelationshipBetweenGroups(1, redGroup, redGroup)
    SetRelationshipBetweenGroups(5, blueGroup, redGroup)
    SetRelationshipBetweenGroups(5, redGroup, blueGroup)

    -- Friendly Fire Einstellung
    if currentLobby and not currentLobby.friendlyFire then
        NetworkSetFriendlyFireOption(false)
        SetCanAttackFriendly(PlayerPedId(), false, false)
    else
        NetworkSetFriendlyFireOption(true)
        SetCanAttackFriendly(PlayerPedId(), true, false)
    end
end)

-- Funktion: Teilt das gewählte Loadout an den Spieler aus
function GiveLoadout(loadoutKeys)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    -- Wenn nur ein einzelner Key (String) übergeben wurde, in Tabelle umwandeln
    if type(loadoutKeys) == 'string' then
        loadoutKeys = { loadoutKeys }
    end

    if type(loadoutKeys) == 'table' then
        for _, key in ipairs(loadoutKeys) do
            local loadout = Config.WeaponLoadouts[key]
            if loadout then
                for _, weapon in ipairs(loadout) do
                    GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
                end
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
                    ESX.ShowNotification('~r~Du verlässt das Kampfgebiet!')
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                end

                -- Waffen-Validierung
                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    local loadoutKeys = currentLobby.loadout
                    if type(loadoutKeys) == 'string' then loadoutKeys = {loadoutKeys} end

                    if type(loadoutKeys) == 'table' then
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
        winnerName = data.winnerName
    })

    -- Waffen entfernen am Rundenende
    RemoveAllPedWeapons(PlayerPedId(), true)
end)
