-- Event: Spielstart-Vorbereitung (Teleportation, Loadout)
RegisterNetEvent('ffa:gameStarting')
AddEventHandler('ffa:gameStarting', function(lobby)
    currentLobby = lobby
    playerState.isInGame = true
    playerState.kills = 0
    playerState.deaths = 0

    -- UI ausblenden
    SendNUIMessage({ action = 'gameStarting' })
    SetNuiFocus(false, false)

    -- Auf Karte teleportieren
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
function GiveLoadout(loadoutKeys)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    -- Unterstützt sowohl einen einzelnen Key (String) als auch ein Array von Keys
    local keys = {}
    if type(loadoutKeys) == 'table' then
        keys = loadoutKeys
    else
        keys = {loadoutKeys}
    end

    for _, key in ipairs(keys) do
        local loadout = Config.WeaponLoadouts[key]
        if loadout then
            for _, weapon in ipairs(loadout) do
                GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, false)
            end
        end
    end

    -- Setze erste Waffe in die Hand
    if #keys > 0 then
        local firstKey = keys[1]
        local firstLoadout = Config.WeaponLoadouts[firstKey]
        if firstLoadout and #firstLoadout > 0 then
            SetCurrentPedWeapon(ped, GetHashKey(firstLoadout[1].name), true)
        end
    end
end

-- Map-Grenzprüfung und Anti-TK
-- Map-Grenzprüfung und Waffen-Validierung (Anti-Cheat)
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState.isInGame and currentLobby then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local map = Utils.GetMapById(currentLobby.mapId)

            if map then
                -- Grenzprüfung: Spieler zurückteleportieren wenn er die Map verlässt
                local dist = #(coords - map.center)
                if dist > map.radius then
                    ESX.ShowNotification('~r~Du verlässt das Kampfgebiet!')
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    if spawn then
                        SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                    end
                end

                -- Waffen-Validierung: Nur erlaubte Waffen behalten
                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local isAllowed = false
                    local keys = type(currentLobby.loadout) == 'table' and currentLobby.loadout or {currentLobby.loadout}

                    for _, key in ipairs(keys) do
                        local loadout = Config.WeaponLoadouts[key]
                        if loadout then
                            for _, w in ipairs(loadout) do
                                if GetHashKey(w.name) == currentWeapon then
                                    isAllowed = true
                                    break
                                end
                            end
                        end
                        if isAllowed then break end
                    end

                    if not isAllowed then
                        RemoveWeaponFromPed(ped, currentWeapon)
                        ESX.ShowNotification('~r~Diese Waffe ist hier nicht erlaubt!')
                    end
                end
            end
        end
    end
end)

-- Anti-Friendly Fire Logik
-- Anti-Friendly Fire Logik (Verhindert Schaden an Teammitgliedern in TDM)
Citizen.CreateThread(function()
    local _, blueGroup = AddRelationshipGroup('FFA_BLUE')
    local _, redGroup = AddRelationshipGroup('FFA_RED')
    local _, neutralGroup = AddRelationshipGroup('FFA_NEUTRAL')

    SetRelationshipBetweenGroups(1, blueGroup, blueGroup) -- Respect
    SetRelationshipBetweenGroups(1, redGroup, redGroup) -- Respect
    SetRelationshipBetweenGroups(5, blueGroup, redGroup) -- Hate
    SetRelationshipBetweenGroups(5, redGroup, blueGroup) -- Hate

    while true do
        Citizen.Wait(1000)
        if playerState.isInGame and currentLobby and currentLobby.mode == 'tdm' then
            local ped = PlayerPedId()
            local myTeam = playerTeams[GetPlayerServerId(PlayerId())]

            if myTeam == 'blue' then
                SetPedRelationshipGroupHash(ped, blueGroup)
            elseif myTeam == 'red' then
                SetPedRelationshipGroupHash(ped, redGroup)
            else
                SetPedRelationshipGroupHash(ped, neutralGroup)
            end

            -- Wenn Friendly Fire deaktiviert ist, nutzen wir SetCanAttackFriendly
            if not currentLobby.friendlyFire then
                SetCanAttackFriendly(ped, false, false)
                NetworkSetFriendlyFireOption(false)
            else
                SetCanAttackFriendly(ped, true, false)
                NetworkSetFriendlyFireOption(true)
            end
        else
            -- Zurücksetzen wenn nicht im Spiel
            local ped = PlayerPedId()
            SetPedRelationshipGroupHash(ped, GetHashKey('PLAYER'))
            NetworkSetFriendlyFireOption(true)
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
                local killerPed = GetPedKiller(ped)
                local killerServerId = -1

                if IsEntityAPed(killerPed) and IsPedAPlayer(killerPed) then
                    killerServerId = GetPlayerServerId(NetworkGetPlayerIndexFromPed(killerPed))
                end

                TriggerServerEvent('ffa:playerKilled', killerServerId)
                HandleDeath(killerPed)

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

        -- Kill-Cam
        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        SetCamCoord(cam, GetEntityCoords(playerPed))
        PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
        RenderScriptCams(true, true, 1000, true, true)

        Wait(3000)

        local respawnTime = currentLobby and currentLobby.respawnTime or 5

        if respawnTime > 3 then
            -- Optional: Spectate Mode bis zum Respawn
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
            Wait((respawnTime - 3) * 1000)
        else
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
        end

        -- Respawn
        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)

        -- Fahrzeuge spawnen falls erlaubt
        if currentLobby and currentLobby.vehiclesAllowed then
            SpawnLobbyVehicle(spawn)
        end
    end)
end

local playerVehicle = nil
function SpawnLobbyVehicle(spawn)
    if playerVehicle and DoesEntityExist(playerVehicle) then
        DeleteEntity(playerVehicle)
    end

    local model = GetHashKey('bati') -- Standard FFA Fahrzeug
    RequestModel(model)
    while not HasModelLoaded(model) do Wait(0) end

    playerVehicle = CreateVehicle(model, spawn.x, spawn.y, spawn.z, spawn.w, true, false)
    SetPedIntoVehicle(PlayerPedId(), playerVehicle, -1)
    SetModelAsNoLongerNeeded(model)

    -- Fahrzeug-Tuning/Farbe für Team-Erkennung
    if currentLobby.mode == 'tdm' then
        local team = playerTeams[GetPlayerServerId(PlayerId())]
        if team == 'blue' then
            SetVehicleColours(playerVehicle, 64, 64)
        elseif team == 'red' then
            SetVehicleColours(playerVehicle, 27, 27)
        end
    end
end

-- Synchronisation der Teams (wichtig für Anti-TK und HUD)
playerTeams = {}
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    playerTeams = teams
end)

-- HUD Updates
RegisterNetEvent('ffa:updateTimer')
AddEventHandler('ffa:updateTimer', function(time)
    SendNUIMessage({ action = 'updateHUD', time = time })
end)

RegisterNetEvent('ffa:updateHUDStats')
AddEventHandler('ffa:updateHUDStats', function(kills, deaths)
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
