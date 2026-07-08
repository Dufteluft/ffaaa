-- Event: Spielstart-Vorbereitung (Teleportation, Loadout)
-- Wird vom Server getriggert, wenn eine Runde beginnt.
RegisterNetEvent('ffa:gameStarting')
AddEventHandler('ffa:gameStarting', function(lobby)
    currentLobby = lobby
    playerState.isInGame = true
    playerState.kills = 0
    playerState.deaths = 0

    -- UI ausblenden für Fokus aufs Spiel
    SendNUIMessage({ action = 'gameStarting' })
    SetNuiFocus(false, false)

    -- Auf Karte teleportieren und Countdown starten
    TeleportToMap(lobby.mapId)
    StartCountdown(10)

    -- Waffen austeilen basierend auf Lobby-Einstellungen
    GiveLoadout(lobby.loadout)

    -- HUD einblenden und initialisieren
    SendNUIMessage({
        action = 'showHUD',
        mode = lobby.mode
    })

    -- Initialer Score/Stats Sync
    SendNUIMessage({
        action = 'updateHUD',
        kills = 0,
        deaths = 0,
        scoreBlue = 0,
        scoreRed = 0
    })
end)

-- Funktion: Teilt das gewählte Loadout an den Spieler aus
-- Unterstützt sowohl einzelne Loadout-Strings als auch Tabellen (Multi-Select).
function GiveLoadout(loadoutKeys)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    -- Wenn loadoutKeys ein String ist, in Tabelle umwandeln für einheitliche Verarbeitung
    if type(loadoutKeys) == 'string' then
        loadoutKeys = { loadoutKeys }
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

-- Map-Grenzprüfung, Waffen-Validierung und Fahrzeug-Spawn
-- Läuft jede Sekunde, um Regelverstöße zu prüfen und Fahrzeuge bereitzustellen.
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState.isInGame and currentLobby then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local map = Utils.GetMapById(currentLobby.mapId)

            if map then
                -- Grenzprüfung: Teleportiert Spieler zurück, wenn sie den Radius verlassen
                local dist = #(coords - map.center)
                if dist > map.radius then
                    ESX.ShowNotification('~r~Du verlässt das Kampfgebiet!')
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                end

                -- Waffen-Validierung (Anti-Cheat): Entfernt nicht erlaubte Waffen
                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    local loadoutKeys = currentLobby.loadout
                    if type(loadoutKeys) == 'string' then loadoutKeys = { loadoutKeys } end

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
            end

            -- Fahrzeug-Logik: Spawnt ein Fahrzeug (Bati), wenn aktiviert und keins in der Nähe ist
            if currentLobby.vehiclesAllowed then
                if not IsPedInAnyVehicle(ped, false) then
                    local vehicle = GetClosestVehicle(coords.x, coords.y, coords.z, 20.0, 0, 71)
                    if vehicle == 0 then
                        local spawnPos = GetOffsetFromEntityInWorldCoords(ped, 0.0, 5.0, 0.0)
                        local model = GetHashKey('bati')
                        RequestModel(model)
                        while not HasModelLoaded(model) do Wait(0) end
                        local veh = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(ped), true, false)
                        SetEntityAsMissionEntity(veh, true, true)
                        SetModelAsNoLongerNeeded(model)
                    end
                end
            end
        end
    end
end)

-- Kill-Erkennung: Überwacht den Tod des Spielers und meldet ihn an den Server
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
-- Zeigt eine Kamera auf den Killer und wechselt dann in den Spectator-Modus.
function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local playerPed = PlayerPedId()
        local killerCoords = GetEntityCoords(killerPed)

        -- Kill-Cam: Fokus auf die Position des Killers
        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        SetCamCoord(cam, GetEntityCoords(playerPed))
        PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
        RenderScriptCams(true, true, 1000, true, true)

        Wait(3000)

        -- Spectator-Modus: Schaltet auf den Killer um, bis die Respawn-Zeit abgelaufen ist
        if currentLobby and currentLobby.respawnTime > 3 then
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
            if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
                NetworkSetInSpectatorMode(true, killerPed)
            end
            Wait((currentLobby.respawnTime - 3) * 1000)
            NetworkSetInSpectatorMode(false, playerPed)
        else
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
        end

        -- Respawn: Belebt den Spieler an einem neuen Punkt wieder und gibt Loadout erneut
        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)
    end)
end

-- HUD-Updates vom Server (Timer, Kills, Tode)
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

-- Anti-Teamkill via Relationship Groups
-- Gruppiert Spieler in Teams und unterbindet Schaden untereinander, wenn deaktiviert.
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    local myTeam = teams[myId]
    if not myTeam or myTeam == 'ffa' then return end

    AddRelationshipGroup('BLUE_TEAM')
    AddRelationshipGroup('RED_TEAM')

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), GetHashKey('BLUE_TEAM'))
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), GetHashKey('RED_TEAM'))
    end

    SetRelationshipBetweenGroups(1, GetHashKey('BLUE_TEAM'), GetHashKey('BLUE_TEAM')) -- 1 = Like
    SetRelationshipBetweenGroups(1, GetHashKey('RED_TEAM'), GetHashKey('RED_TEAM'))
    SetRelationshipBetweenGroups(5, GetHashKey('BLUE_TEAM'), GetHashKey('RED_TEAM')) -- 5 = Hate
    SetRelationshipBetweenGroups(5, GetHashKey('RED_TEAM'), GetHashKey('BLUE_TEAM'))

    -- Friendly Fire Deaktivierung (Nativ)
    if not currentLobby.friendlyFire then
        NetworkSetFriendlyFireOption(false)
    else
        NetworkSetFriendlyFireOption(true)
    end
end)

-- Event: Spielende
-- Zeigt den Winner-Screen an und friert die Steuerung ein.
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
    SetNuiFocus(true, true)
end)
