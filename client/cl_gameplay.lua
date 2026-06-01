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

    -- Auf Karte teleportieren und Countdown
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
        isPersistent = lobby.isPersistent,
        mode = lobby.mode
    })

    -- Reset HUD Stats
    SendNUIMessage({
        action = 'updateHUD',
        kills = 0,
        deaths = 0,
        scoreBlue = 0,
        scoreRed = 0
    })
end)

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

-- Kill-Erkennung und Respawn-Logik
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

                -- Kill-Cam und Respawn-Logik
                HandleDeath(killerId)

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
        local killerCoords = nil

        if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
            killerCoords = GetEntityCoords(killerPed)
        end

        -- Kill-Cam: Fokus für 3 Sek auf den Mörder (falls vorhanden)
        local cam = nil
        if killerCoords then
            cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
            SetCamCoord(cam, GetEntityCoords(playerPed))
            PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
            RenderScriptCams(true, true, 1000, true, true)
        end

        Wait(3000)

        -- Respawn-Zeit abwarten
        local waitRemaining = (currentLobby.respawnTime or 5) - 3
        if waitRemaining > 0 then
            if cam then
                RenderScriptCams(false, true, 500, true, true)
                DestroyCam(cam, true)
                cam = nil
            end

            -- In Zuschauer-Modus wechseln (auf Killer oder zufällig)
            if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
                NetworkSetInSpectatorMode(true, killerPed)
            end

            Wait(waitRemaining * 1000)
            NetworkSetInSpectatorMode(false, playerPed)
        else
            if cam then
                RenderScriptCams(false, true, 500, true, true)
                DestroyCam(cam, true)
            end
        end

        -- Wiederbelebung an zufälligem Punkt auf der Map
        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)

        -- Kurz warten bis Ped wieder da ist
        Wait(100)
        GiveLoadout(currentLobby.loadout)

        -- Fahrzeug neu spawnen falls erlaubt
        if currentLobby.vehiclesAllowed then
             TriggerEvent('ffa:spawnLobbyVehicle')
        end
    end)
end

-- Fahrzeug-Spawn Logik
local playerVehicle = nil

RegisterNetEvent('ffa:spawnLobbyVehicle')
AddEventHandler('ffa:spawnLobbyVehicle', function()
    if not playerState.isInGame or not currentLobby or not currentLobby.vehiclesAllowed then return end

    local ped = PlayerPedId()

    -- Altes Fahrzeug löschen
    if playerVehicle and DoesEntityExist(playerVehicle) then
        DeleteEntity(playerVehicle)
    end

    local model = GetHashKey('bati')
    RequestModel(model)
    while not HasModelLoaded(model) do Wait(10) end

    local spawnPos = GetOffsetFromEntityInWorldCoords(ped, 0.0, 2.0, 0.0)
    playerVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(ped), true, false)
    SetVehicleOnGroundProperly(playerVehicle)
    SetEntityAsMissionEntity(playerVehicle, true, true)
    SetModelAsNoLongerNeeded(model)
end)

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
                        ESX.ShowNotification('~r~Diese Waffe ist hier nicht erlaubt!')
                    end
                end
            end
        end
    end
end)

-- Anti-Teamkill via Relationship Groups
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    local myTeam = teams[tostring(myId)] or teams[myId]

    if not myTeam then return end

    local _, blueGroup = AddRelationshipGroup("FFA_BLUE")
    local _, redGroup = AddRelationshipGroup("FFA_RED")
    local _, neutralGroup = AddRelationshipGroup("FFA_NEUTRAL")

    local ped = PlayerPedId()
    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(ped, blueGroup)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(ped, redGroup)
    else
        SetPedRelationshipGroupHash(ped, neutralGroup)
    end

    SetRelationshipBetweenGroups(1, blueGroup, blueGroup)
    SetRelationshipBetweenGroups(1, redGroup, redGroup)
    SetRelationshipBetweenGroups(5, blueGroup, redGroup)
    SetRelationshipBetweenGroups(5, redGroup, blueGroup)

    if currentLobby and not currentLobby.friendlyFire then
        SetCanAttackFriendly(ped, false, false)
        NetworkSetFriendlyFireOption(false)
    else
        SetCanAttackFriendly(ped, true, false)
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
end)

RegisterNetEvent('ffa:updateTDMScore')
AddEventHandler('ffa:updateTDMScore', function(blue, red)
    SendNUIMessage({
        action = 'updateHUD',
        scoreBlue = blue,
        scoreRed = red
    })
end)

-- Event: Spielende (Sieg-Anzeige)
RegisterNetEvent('ffa:gameEnded')
AddEventHandler('ffa:gameEnded', function(data)
    playerState.isInGame = false
    local ped = PlayerPedId()
    FreezeEntityPosition(ped, true)

    SendNUIMessage({
        action = 'showWinner',
        winnerName = data.winnerName,
        stats = data.stats
    })

    RemoveAllPedWeapons(ped, true)
end)

-- Löschen des Fahrzeugs beim Verlassen
AddEventHandler('ffa:restoreState', function()
    if playerVehicle and DoesEntityExist(playerVehicle) then
        DeleteEntity(playerVehicle)
        playerVehicle = nil
    end
end)
