-- Event: Spielstart-Vorbereitung
RegisterNetEvent('ffa:gameStarting')
AddEventHandler('ffa:gameStarting', function(lobby)
    currentLobby = lobby
    playerState.isInGame = true
    playerState.kills = 0
    playerState.deaths = 0

    SendNUIMessage({ action = 'gameStarting' })
    SetNuiFocus(false, false)

    TeleportToMap(lobby.mapId)

    if lobby.isPersistent then
        FreezeEntityPosition(PlayerPedId(), false)
        SendNUIMessage({ action = 'countdown', seconds = 0 })
    else
        StartCountdown(10)
    end

    GiveLoadout(lobby.loadout)

    SendNUIMessage({
        action = 'showHUD',
        mode = lobby.mode,
        isPersistent = lobby.isPersistent
    })
    TriggerEvent('ffa:updateHUDStats', 0, 0)
end)

-- Funktion: Teilt das gewählte Loadout aus (Unterstützt Multi-Select)
function GiveLoadout(loadout)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    if type(loadout) == 'table' then
        for _, key in ipairs(loadout) do
            local weapons = Config.WeaponLoadouts[key]
            if weapons then
                for _, w in ipairs(weapons) do
                    GiveWeaponToPed(ped, GetHashKey(w.name), w.ammo, false, true)
                end
            end
        end
    else
        local weapons = Config.WeaponLoadouts[loadout]
        if weapons then
            for _, w in ipairs(weapons) do
                GiveWeaponToPed(ped, GetHashKey(w.name), w.ammo, false, true)
            end
        end
    end
end

-- Fahrzeug-Spawn Logik
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        if playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local ped = PlayerPedId()
            if not IsPedInAnyVehicle(ped, false) then
                -- Prüfen ob bereits ein Fahrzeug existiert das wir getrackt haben
                if not playerVehicle or not DoesEntityExist(playerVehicle) then
                    local model = GetHashKey('bati')
                    RequestModel(model)
                    while not HasModelLoaded(model) do Wait(10) end

                    local spawnPos = GetOffsetFromEntityInWorldCoords(ped, 0.0, 5.0, 0.0)
                    local veh = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(ped), true, false)
                    SetVehicleOnGroundProperly(veh)
                    SetEntityAsMissionEntity(veh, true, true)
                    SetModelAsNoLongerNeeded(model)
                    playerVehicle = veh
                end
            end
        end
    end
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
                local dist = #(coords - map.center)
                if dist > map.radius then
                    ESX.ShowNotification('~r~Du verlässt das Kampfgebiet!')
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                end

                -- Waffen-Validierung (Anti-Cheat)
                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    local loadout = currentLobby.loadout

                    local function check(key)
                        local wps = Config.WeaponLoadouts[key]
                        if wps then
                            for _, w in ipairs(wps) do
                                if GetHashKey(w.name) == currentWeapon then return true end
                            end
                        end
                        return false
                    end

                    if type(loadout) == 'table' then
                        for _, k in ipairs(loadout) do
                            if check(k) then allowed = true break end
                        end
                    else
                        allowed = check(loadout)
                    end

                    if not allowed then
                        RemoveWeaponFromPed(ped, currentWeapon)
                        ESX.ShowNotification('~r~Diese Waffe ist nicht erlaubt!')
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

function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local ped = PlayerPedId()
        local killerCoords = GetEntityCoords(killerPed)

        -- Kill-Cam
        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        SetCamCoord(cam, GetEntityCoords(ped))
        PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
        RenderScriptCams(true, true, 1000, true, true)

        Wait(3000)

        -- Spectator bis Respawn
        local respawnTime = currentLobby.respawnTime or 5
        if respawnTime > 3 then
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
            if killerPed ~= ped and DoesEntityExist(killerPed) then
                NetworkSetInSpectatorMode(true, killerPed)
            end
            Wait((respawnTime - 3) * 1000)
            NetworkSetInSpectatorMode(false, ped)
        else
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
        end

        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)
    end)
end

-- HUD Events
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
    if playerVehicle and DoesEntityExist(playerVehicle) then
        DeleteEntity(playerVehicle)
    end
end)

-- Anti-Teamkill
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myTeam = teams[tostring(GetPlayerServerId(PlayerId()))] or teams[GetPlayerServerId(PlayerId())]
    if not myTeam then return end

    local groupBlue = AddRelationshipGroup('FFA_BLUE')
    local groupRed = AddRelationshipGroup('FFA_RED')

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), groupBlue)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), groupRed)
    end

    SetRelationshipBetweenGroups(1, groupBlue, groupBlue) -- Like
    SetRelationshipBetweenGroups(1, groupRed, groupRed)
    SetRelationshipBetweenGroups(5, groupBlue, groupRed) -- Hate
    SetRelationshipBetweenGroups(5, groupRed, groupBlue)
end)
