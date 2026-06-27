-- Globale Variable für das gespawnte Fahrzeug, um es beim Verlassen zu löschen
local spawnedVehicle = nil

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
function GiveLoadout(loadoutKeys)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    if type(loadoutKeys) == 'table' then
        for _, key in ipairs(loadoutKeys) do
            local loadout = Config.WeaponLoadouts[key]
            if loadout then
                for _, weapon in ipairs(loadout) do
                    GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
                end
            end
        end
    else
        local loadout = Config.WeaponLoadouts[loadoutKeys]
        if loadout then
            for _, weapon in ipairs(loadout) do
                GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
            end
        end
    end
end

-- Map-Grenzprüfung und Waffen-Validierung: Verhindert Campen außerhalb und Cheat-Waffen
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState.isInGame and currentLobby then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local map = Utils.GetMapById(currentLobby.mapId)

            if map then
                -- Grenzprüfung: Teleportiert Spieler zurück, wenn er Radius verlässt
                local dist = #(coords - map.center)
                if dist > map.radius then
                    ESX.ShowNotification('~r~Du verlässt das Kampfgebiet!')
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                end

                -- Waffen-Validierung: Entfernt Waffen, die nicht zum Loadout gehören
                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    local loadoutKeys = currentLobby.loadout

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
                    else
                        local loadout = Config.WeaponLoadouts[loadoutKeys]
                        if loadout then
                            for _, w in ipairs(loadout) do
                                if GetHashKey(w.name) == currentWeapon then
                                    allowed = true
                                    break
                                end
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

-- Kill-Erkennung: Prüft ständig auf Tod des Spielers und meldet ihn dem Server
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(0)
        if playerState.isInGame then
            local ped = PlayerPedId()
            if IsEntityDead(ped) then
                local killerPed = GetPedKiller(ped)
                local killerServerId = -1

                -- Ermittelt Server-ID des Killers für Punktevergabe
                if IsEntityAPed(killerPed) and IsPedAPlayer(killerPed) then
                    killerServerId = GetPlayerServerId(NetworkGetPlayerIndexFromPed(killerPed))
                end

                TriggerServerEvent('ffa:playerKilled', killerServerId)

                -- Kill-Cam und Respawn-Logik ausführen
                HandleDeath(killerPed)

                -- Warten bis Spieler wieder lebt
                while IsEntityDead(ped) do Citizen.Wait(100) end
            end
        end
    end
end)

-- Funktion: Behandelt Tod, Kill-Cam/Zuschauen und Respawn
function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local playerPed = PlayerPedId()
        local respawnTime = (currentLobby and currentLobby.respawnTime) or 5

        -- Kill-Cam: Kamera schwenkt zum Mörder
        if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
            local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
            SetCamCoord(cam, GetEntityCoords(playerPed))
            PointCamAtCoord(cam, GetEntityCoords(killerPed))
            RenderScriptCams(true, true, 1000, true, true)

            Wait(3000)

            -- Spectator-Modus für den Rest der Respawn-Zeit
            if respawnTime > 3 then
                NetworkSetInSpectatorMode(true, killerPed)
                Wait((respawnTime - 3) * 1000)
                NetworkSetInSpectatorMode(false, playerPed)
            end

            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
        else
            -- Falls Suizid oder kein Killer gefunden, einfach warten
            Wait(respawnTime * 1000)
        end

        -- Wiederbelebung an zufälligem Punkt auf der Map
        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)
    end)
end

-- Fahrzeug-Spawn Logik: Spawnt ein Fahrzeug (z.B. Bati), wenn in Einstellungen aktiviert
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        if playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)

            -- Spawnt neues Fahrzeug nur wenn keins existiert oder weit weg ist
            if not DoesEntityExist(spawnedVehicle) or #(coords - GetEntityCoords(spawnedVehicle)) > 50.0 then
                if DoesEntityExist(spawnedVehicle) then
                    DeleteEntity(spawnedVehicle)
                end

                local model = GetHashKey('bati')
                RequestModel(model)
                while not HasModelLoaded(model) do Wait(0) end

                local spawnPos = GetOffsetFromEntityInWorldCoords(ped, 0.0, 5.0, 0.0)
                spawnedVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(ped), true, false)
                SetVehicleOnGroundProperly(spawnedVehicle)
                SetModelAsNoLongerNeeded(model)
            end
        end
    end
end)

-- Team-Synchronisation und Anti-Teamkill via Relationship Groups
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    local myTeam = teams[myId]

    if not myTeam or myTeam == 'ffa' or myTeam == 'none' then
        SetPedRelationshipGroupHash(PlayerPedId(), GetHashKey('PLAYER'))
        return
    end

    AddRelationshipGroup('FFA_BLUE')
    AddRelationshipGroup('FFA_RED')

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), GetHashKey('FFA_BLUE'))
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), GetHashKey('FFA_RED'))
    end

    -- Beziehungen setzen: Eigenes Team = Neutral/Freundlich, Gegner = Feindlich
    SetRelationshipBetweenGroups(1, GetHashKey('FFA_BLUE'), GetHashKey('FFA_BLUE'))
    SetRelationshipBetweenGroups(1, GetHashKey('FFA_RED'), GetHashKey('FFA_RED'))
    SetRelationshipBetweenGroups(5, GetHashKey('FFA_BLUE'), GetHashKey('FFA_RED'))
    SetRelationshipBetweenGroups(5, GetHashKey('FFA_RED'), GetHashKey('FFA_BLUE'))

    -- Deaktiviert Friendly Fire falls in Lobby-Settings so gewünscht
    if currentLobby and not currentLobby.friendlyFire then
        SetCanAttackFriendly(PlayerPedId(), false, false)
        NetworkSetFriendlyFireOption(false)
    else
        SetCanAttackFriendly(PlayerPedId(), true, false)
        NetworkSetFriendlyFireOption(true)
    end
end)

-- HUD-Aktualisierungen vom Server (Timer, Kills, TDM Scores)
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

-- Event: Spielende (Zeigt Winner-Screen und stoppt Bewegung)
RegisterNetEvent('ffa:gameEnded')
AddEventHandler('ffa:gameEnded', function(data)
    playerState.isInGame = false
    FreezeEntityPosition(PlayerPedId(), true)

    if DoesEntityExist(spawnedVehicle) then
        DeleteEntity(spawnedVehicle)
        spawnedVehicle = nil
    end

    SendNUIMessage({
        action = 'showWinner',
        winnerName = data.winnerName,
        stats = data.stats
    })

    RemoveAllPedWeapons(PlayerPedId(), true)
end)
