-- Event: Spielstart-Vorbereitung
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
        mode = lobby.mode
    })

    TriggerEvent('ffa:updateHUDStats', 0, 0)
end)

-- Funktion: Teilt das gewählte Loadout aus
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
spawnedVehicle = nil
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        if playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local ped = PlayerPedId()
            if not IsPedInAnyVehicle(ped, false) then
                if not DoesEntityExist(spawnedVehicle) then
                    local coords = GetEntityCoords(ped)
                    local model = GetHashKey(Config.DefaultSettings.defaultVehicle or 'bati')

                    RequestModel(model)
                    while not HasModelLoaded(model) do Wait(10) end

                    spawnedVehicle = CreateVehicle(model, coords.x, coords.y, coords.z, GetEntityHeading(ped), true, false)
                    SetVehicleOnGroundProperly(spawnedVehicle)
                    SetPedIntoVehicle(ped, spawnedVehicle, -1)
                    SetModelAsNoLongerNeeded(model)
                end
            end
        end
    end
end)

-- Anti-Cheat & Map Bound Check
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState.isInGame and currentLobby then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local map = Utils.GetMapById(currentLobby.mapId)

            if map then
                if #(coords - map.center) > map.radius then
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                    ESX.ShowNotification('~r~Du hast das Kampfgebiet verlassen!')
                end
            end

            -- Waffen Validierung
            local currentWeapon = GetSelectedPedWeapon(ped)
            if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                local allowed = false
                local loadout = currentLobby.loadout

                local checkLoadout = function(key)
                    local items = Config.WeaponLoadouts[key]
                    if items then
                        for _, w in ipairs(items) do
                            if GetHashKey(w.name) == currentWeapon then return true end
                        end
                    end
                    return false
                end

                if type(loadout) == 'table' then
                    for _, k in ipairs(loadout) do
                        if checkLoadout(k) then allowed = true break end
                    end
                else
                    allowed = checkLoadout(loadout)
                end

                if not allowed then
                    RemoveWeaponFromPed(ped, currentWeapon)
                    ESX.ShowNotification('~r~Waffe nicht erlaubt!')
                end
            end
        end
    end
end)

-- Kill Erkennung
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(0)
        if playerState.isInGame then
            local ped = PlayerPedId()
            if IsEntityDead(ped) then
                local killer = GetPedKiller(ped)
                local killerId = -1
                if IsEntityAPed(killer) and IsPedAPlayer(killer) then
                    killerId = GetPlayerServerId(NetworkGetPlayerIndexFromPed(killer))
                end

                TriggerServerEvent('ffa:playerKilled', killerId)
                HandleDeath(killer)

                while IsEntityDead(ped) do Wait(100) end
            end
        end
    end
end)

function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local ped = PlayerPedId()
        local killerCoords = GetEntityCoords(killerPed)
        local respawnTime = (currentLobby and currentLobby.respawnTime) or 5

        -- Kill-Cam (3 Sekunden)
        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        SetCamCoord(cam, GetEntityCoords(ped))
        PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
        RenderScriptCams(true, true, 1000, true, true)

        Wait(3000)
        RenderScriptCams(false, true, 500, true, true)
        DestroyCam(cam, true)

        -- Spectator-Modus bis zum Respawn (falls Zeit übrig ist)
        if respawnTime > 3 and playerState.isInGame then
            if killerPed and DoesEntityExist(killerPed) and killerPed ~= ped then
                NetworkSetInSpectatorMode(true, killerPed)
            end
            Wait((respawnTime - 3) * 1000)
            NetworkSetInSpectatorMode(false, ped)
        end

        if playerState.isInGame then
            local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
            NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
            GiveLoadout(currentLobby.loadout)
        end
    end)
end

-- Anti-Teamkill & Team-Sync
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    playerState.team = teams[myId] or 'none'

    local blueGroup = AddRelationshipGroup('FFA_BLUE')
    local redGroup = AddRelationshipGroup('FFA_RED')

    if playerState.team == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), blueGroup)
    elseif playerState.team == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), redGroup)
    end

    SetRelationshipBetweenGroups(1, blueGroup, blueGroup) -- Like
    SetRelationshipBetweenGroups(1, redGroup, redGroup)
    SetRelationshipBetweenGroups(5, blueGroup, redGroup) -- Hate
    SetRelationshipBetweenGroups(5, redGroup, blueGroup)
end)

-- HUD Updates
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
    TriggerEvent('ffa:playSound', 'win')
end)
