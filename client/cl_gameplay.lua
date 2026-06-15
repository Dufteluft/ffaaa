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
        SendNUIMessage({ action = 'countdown', seconds = 0 })
    else
        StartCountdown(10)
    end

    GiveLoadout(lobby.loadout)
    SendNUIMessage({ action = 'showHUD', isPersistent = lobby.isPersistent })

    if lobby.mode == 'tdm' then
        SendNUIMessage({ action = 'updateHUD', mode = 'tdm', scoreBlue = 0, scoreRed = 0 })
    end
end)

function GiveLoadout(loadoutKeys)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    local keys = type(loadoutKeys) == "table" and loadoutKeys or {loadoutKeys}

    for _, key in ipairs(keys) do
        local loadout = Config.WeaponLoadouts[key]
        if loadout then
            for _, weapon in ipairs(loadout) do
                GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
            end
        end
    end
end

-- Map Boundary & Weapon Validation
Citizen.CreateThread(function()
    while true do
        Wait(1000)
        if playerState.isInGame and currentLobby then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local map = Utils.GetMapById(currentLobby.mapId)

            if map then
                if #(coords - map.center) > map.radius then
                    ESX.ShowNotification('~r~Kampfgebiet verlassen!')
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                end

                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    local keys = type(currentLobby.loadout) == "table" and currentLobby.loadout or {currentLobby.loadout}
                    for _, key in ipairs(keys) do
                        local loadout = Config.WeaponLoadouts[key]
                        if loadout then
                            for _, w in ipairs(loadout) do
                                if GetHashKey(w.name) == currentWeapon then allowed = true break end
                            end
                        end
                        if allowed then break end
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

-- Vehicle Spawning
Citizen.CreateThread(function()
    while true do
        Wait(5000)
        if playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            if not playerVehicle or not DoesEntityExist(playerVehicle) then
                local ped = PlayerPedId()
                local model = GetHashKey(Config.DefaultSettings.defaultVehicle or 'bati')
                RequestModel(model)
                while not HasModelLoaded(model) do Wait(10) end

                local spawnPos = GetOffsetFromEntityInWorldCoords(ped, 0.0, 5.0, 0.0)
                playerVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(ped), true, false)
                SetVehicleOnGroundProperly(playerVehicle)
                SetModelAsNoLongerNeeded(model)
            end
        end
    end
end)

-- Death Handling
Citizen.CreateThread(function()
    while true do
        Wait(0)
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
        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        SetCamCoord(cam, GetEntityCoords(ped))
        if killerPed and DoesEntityExist(killerPed) then
            PointCamAtEntity(cam, killerPed, 0.0, 0.0, 0.0, true)
        end
        RenderScriptCams(true, true, 1000, true, true)

        Wait(3000)
        if currentLobby.respawnTime > 3 then
            if killerPed and DoesEntityExist(killerPed) and killerPed ~= ped then
                NetworkSetInSpectatorMode(true, killerPed)
            end
            Wait((currentLobby.respawnTime - 3) * 1000)
            NetworkSetInSpectatorMode(false, ped)
        end

        RenderScriptCams(false, true, 500, true, true)
        DestroyCam(cam, true)

        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)
    end)
end

-- Team Sync & Anti-Teamkill
RegisterNetEvent('ffa:syncTeam')
AddEventHandler('ffa:syncTeam', function(team)
    playerState.team = team
    local ped = PlayerPedId()
    if team == 'blue' then
        local _, group = AddRelationshipGroup('FFA_BLUE')
        SetPedRelationshipGroupHash(ped, group)
    elseif team == 'red' then
        local _, group = AddRelationshipGroup('FFA_RED')
        SetPedRelationshipGroupHash(ped, group)
    else
        SetPedRelationshipGroupHash(ped, GetHashKey('PLAYER'))
    end
end)
