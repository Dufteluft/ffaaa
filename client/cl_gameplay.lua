-- Event: Spielstart
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
    else
        StartCountdown(10)
    end

    GiveLoadout(lobby.loadout)

    SendNUIMessage({
        action = 'showHUD',
        mode = lobby.mode
    })
end)

-- Funktion: Teilt Loadout aus
function GiveLoadout(loadoutCategories)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    for _, category in ipairs(loadoutCategories) do
        local weapons = Config.WeaponLoadouts[category]
        if weapons then
            for _, weapon in ipairs(weapons) do
                GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
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
            local coords = GetEntityCoords(ped)

            if not DoesEntityExist(spawnedVehicle) or #(coords - GetEntityCoords(spawnedVehicle)) > 50.0 then
                if DoesEntityExist(spawnedVehicle) then DeleteEntity(spawnedVehicle) end

                local model = GetHashKey(Config.DefaultSettings.defaultVehicle or 'bati')
                RequestModel(model)
                while not HasModelLoaded(model) do Wait(10) end

                local spawnPos = GetOffsetFromEntityInWorldCoords(ped, 0.0, 5.0, 0.0)
                spawnedVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(ped), true, false)
                SetVehicleOnGroundProperly(spawnedVehicle)
                SetModelAsNoLongerNeeded(model)
            end
        end
    end
end)

-- Anti-Teamkill via Relationship Groups
RegisterNetEvent('ffa:syncTeam')
AddEventHandler('ffa:syncTeam', function(myTeam)
    playerState.team = myTeam

    AddRelationshipGroup('FFA_BLUE')
    AddRelationshipGroup('FFA_RED')

    local ped = PlayerPedId()
    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(ped, GetHashKey('FFA_BLUE'))
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(ped, GetHashKey('FFA_RED'))
    else
        SetPedRelationshipGroupHash(ped, GetHashKey('PLAYER'))
    end

    SetRelationshipBetweenGroups(1, GetHashKey('FFA_BLUE'), GetHashKey('FFA_BLUE')) -- Like
    SetRelationshipBetweenGroups(1, GetHashKey('FFA_RED'), GetHashKey('FFA_RED'))
    SetRelationshipBetweenGroups(5, GetHashKey('FFA_BLUE'), GetHashKey('FFA_RED')) -- Hate
    SetRelationshipBetweenGroups(5, GetHashKey('FFA_RED'), GetHashKey('FFA_BLUE'))

    -- Deaktiviere Friendly Fire via Natives
    if currentLobby and not currentLobby.friendlyFire then
        SetCanAttackFriendly(ped, false, false)
        NetworkSetFriendlyFireOption(false)
    else
        SetCanAttackFriendly(ped, true, false)
        NetworkSetFriendlyFireOption(true)
    end
end)

-- Map-Grenzprüfung
-- Map-Grenzprüfung & Waffen-Validierung (Anti-Cheat)
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState.isInGame and currentLobby then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local map = Utils.GetMapById(currentLobby.mapId)

            -- Grenzprüfung
            if map and #(coords - map.center) > map.radius then
                ESX.ShowNotification('~r~Kampfgebiet verlassen!')
                local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
            end

            -- Waffen-Validierung
            local currentWeapon = GetSelectedPedWeapon(ped)
            if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                local allowed = false
                for _, category in ipairs(currentLobby.loadout) do
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
                    ESX.ShowNotification('~r~Waffe in dieser Lobby nicht erlaubt!')
                end
            end
        end
    end
end)

-- Tod & Kill-Erkennung
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

                while IsEntityDead(ped) do Wait(100) end
            end
        end
    end
end)

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

        RenderScriptCams(false, true, 500, true, true)
        DestroyCam(cam, true)

        -- Zuschauen bis Respawn
        if currentLobby and currentLobby.respawnTime > 3 then
            if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
                NetworkSetInSpectatorMode(true, killerPed)
            end
            Wait((currentLobby.respawnTime - 3) * 1000)
            NetworkSetInSpectatorMode(false, playerPed)
        end

        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)
    end)
end

-- HUD-Aktualisierungen
RegisterNetEvent('ffa:updateHUD')
AddEventHandler('ffa:updateHUD', function(data)
    SendNUIMessage({ action = 'updateHUD', kills = data.kills, deaths = data.deaths, time = data.time, scoreBlue = data.scoreBlue, scoreRed = data.scoreRed })
end)

RegisterNetEvent('ffa:gameEnded')
AddEventHandler('ffa:gameEnded', function(data)
    playerState.isInGame = false
    FreezeEntityPosition(PlayerPedId(), true)
    SendNUIMessage({ action = 'showWinner', winnerName = data.winnerName, stats = data.stats })
    RemoveAllPedWeapons(PlayerPedId(), true)
end)
