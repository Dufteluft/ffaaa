-- Funktion: Teilt Loadout aus
function GiveLoadout(loadoutKeys)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    local function give(key)
        local weapons = Config.WeaponLoadouts[key]
        if weapons then
            for _, weapon in ipairs(weapons) do
                GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
            end
        end
    end

    if type(loadoutKeys) == 'table' then
        for _, key in ipairs(loadoutKeys) do give(key) end
    else
        give(loadoutKeys)
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

                -- Waffen-Validierung (Anti-Cheat Light)
                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    local function check(key)
                        local loadout = Config.WeaponLoadouts[key]
                        if loadout then
                            for _, w in ipairs(loadout) do
                                if GetHashKey(w.name) == currentWeapon then return true end
                            end
                        end
                        return false
                    end

                    if type(currentLobby.loadout) == 'table' then
                        for _, k in ipairs(currentLobby.loadout) do
                            if check(k) then allowed = true; break end
                        end
                    else
                        allowed = check(currentLobby.loadout)
                    end

                    if not allowed then
                        RemoveWeaponFromPed(ped, currentWeapon)
                        ESX.ShowNotification('~r~Waffe nicht erlaubt!')
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

-- Funktion: Behandelt Tod, Kill-Cam/Zuschauen und Respawn
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

        -- Spectator Modus während Respawn
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

        -- Respawn
        if currentLobby then
            local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
            NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
            GiveLoadout(currentLobby.loadout)
        end
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
end)

-- Fahrzeug-Spawn Logik (wenn in Lobby aktiviert)
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local playerPed = PlayerPedId()

            -- Prüfen ob bereits ein Fahrzeug existiert
            if not spawnedVehicle or not DoesEntityExist(spawnedVehicle) then
                local spawnPos = GetOffsetFromEntityInWorldCoords(playerPed, 0.0, 5.0, 0.0)
                local model = GetHashKey(Config.DefaultSettings.defaultVehicle or 'bati')

                RequestModel(model)
                while not HasModelLoaded(model) do Wait(10) end

                spawnedVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(playerPed), true, false)
                SetVehicleOnGroundProperly(spawnedVehicle)
                SetEntityAsMissionEntity(spawnedVehicle, true, true)
                SetModelAsNoLongerNeeded(model)

                -- Automatisches Einsteigen
                TaskWarpPedIntoVehicle(playerPed, spawnedVehicle, -1)
            end
        end
    end
end)

-- Anti-Teamkill via Relationship Groups
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myTeam = teams[tostring(GetPlayerServerId(PlayerId()))]
    if not myTeam then return end

    local blueGroup = GetHashKey('BLUE_TEAM')
    local redGroup = GetHashKey('RED_TEAM')

    AddRelationshipGroup('BLUE_TEAM')
    AddRelationshipGroup('RED_TEAM')

    local ped = PlayerPedId()
    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(ped, blueGroup)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(ped, redGroup)
    else
        SetPedRelationshipGroupHash(ped, GetHashKey('PLAYER'))
    end

    -- Verhalten definieren
    SetRelationshipBetweenGroups(1, blueGroup, blueGroup) -- 1 = Respect/Like
    SetRelationshipBetweenGroups(1, redGroup, redGroup)
    SetRelationshipBetweenGroups(5, blueGroup, redGroup) -- 5 = Hate
    SetRelationshipBetweenGroups(5, redGroup, blueGroup)

    -- Friendly Fire deaktivieren falls in Config gesetzt
    if currentLobby and not currentLobby.friendlyFire then
        NetworkSetFriendlyFireOption(false)
        SetCanAttackFriendly(ped, false, false)
    else
        NetworkSetFriendlyFireOption(true)
        SetCanAttackFriendly(ped, true, false)
    end
end)
