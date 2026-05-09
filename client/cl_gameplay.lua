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

    -- Waffen austeilen (Multi-Select Support)
    GiveLoadout(lobby.loadouts or {lobby.loadout})

    -- HUD einblenden
    SendNUIMessage({
        action = 'showHUD',
        mode = lobby.mode,
        isPersistent = lobby.isPersistent
    })

    -- Team-Beziehungen setzen (Anti-Teamkill)
    if lobby.mode == 'tdm' and not lobby.friendlyFire then
        SetTeamsRelationship(lobby.mode)
    end

    TriggerEvent('ffa:updateHUDStats', 0, 0)
end)

-- Funktion: Teilt das gewählte Loadout an den Spieler aus
function GiveLoadout(loadouts)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    if type(loadouts) ~= 'table' then loadouts = {loadouts} end

    for _, category in ipairs(loadouts) do
        local weapons = Config.WeaponLoadouts[category]
        if weapons then
            for _, weapon in ipairs(weapons) do
                GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
            end
        end
    end
end

-- Anti-Teamkill Logik via Relationship Groups
function SetTeamsRelationship(mode)
    local playerPed = PlayerPedId()
    AddRelationshipGroup('BLUE_TEAM')
    AddRelationshipGroup('RED_TEAM')

    if playerState.team == 'blue' then
        SetPedRelationshipGroupHash(playerPed, GetHashKey('BLUE_TEAM'))
    elseif playerState.team == 'red' then
        SetPedRelationshipGroupHash(playerPed, GetHashKey('RED_TEAM'))
    end

    SetRelationshipBetweenGroups(1, GetHashKey('BLUE_TEAM'), GetHashKey('BLUE_TEAM')) -- 1 = Like
    SetRelationshipBetweenGroups(1, GetHashKey('RED_TEAM'), GetHashKey('RED_TEAM'))
    SetRelationshipBetweenGroups(5, GetHashKey('BLUE_TEAM'), GetHashKey('RED_TEAM')) -- 5 = Hate
    SetRelationshipBetweenGroups(5, GetHashKey('RED_TEAM'), GetHashKey('BLUE_TEAM'))
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

                -- Waffen-Validierung (Anti-Cheat / Restricted Loadout)
                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    local activeLoadouts = currentLobby.loadouts or {currentLobby.loadout}

                    for _, category in ipairs(activeLoadouts) do
                        local weapons = Config.WeaponLoadouts[category]
                        if weapons then
                            for _, w in ipairs(weapons) do
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

-- Tod, Kill-Cam und Respawn
function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local playerPed = PlayerPedId()
        local respawnTime = currentLobby.respawnTime or 5

        -- Kill-Cam Fokus
        if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
            local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
            SetCamCoord(cam, GetEntityCoords(playerPed))
            PointCamAtCoord(cam, GetEntityCoords(killerPed))
            RenderScriptCams(true, true, 1000, true, true)

            Wait(math.min(3000, respawnTime * 1000))

            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)

            -- Spectator mode if respawn time is long
            if respawnTime > 3 then
                NetworkSetInSpectatorMode(true, killerPed)
                Wait((respawnTime - 3) * 1000)
                NetworkSetInSpectatorMode(false, playerPed)
            end
        else
            Wait(respawnTime * 1000)
        end

        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadouts or {currentLobby.loadout})
    end)
end

-- HUD Updates vom Server
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

RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    if teams[tostring(myId)] then
        playerState.team = teams[tostring(myId)]
        if currentLobby and currentLobby.mode == 'tdm' and not currentLobby.friendlyFire then
            SetTeamsRelationship('tdm')
        end
    end
end)
