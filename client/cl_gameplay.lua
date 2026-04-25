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
    SendNUIMessage({ action = 'showHUD' })
end)

function GiveLoadout(loadoutKeys)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    if type(loadoutKeys) ~= 'table' then
        loadoutKeys = {loadoutKeys}
    end

    for _, key in ipairs(loadoutKeys) do
        local loadout = Config.WeaponLoadouts[key]
        if loadout then
            for _, weapon in ipairs(loadout.weapons) do
                GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
            end
        end
    end
end

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
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                end
            end
        end
    end
end)

-- Kill Detection
AddEventHandler('esx:onPlayerDeath', function(data)
    if playerState.isInGame then
        local killerServerId = -1
        if data.killerServerId and data.killerServerId ~= -1 then
            killerServerId = data.killerServerId
        end

        TriggerServerEvent('ffa:playerKilled', killerServerId)
        HandleDeath(data.killerServerId)
    end
end)

function HandleDeath(killerServerId)
    Citizen.CreateThread(function()
        local playerPed = PlayerPedId()
        local killerPed = -1

        if killerServerId and killerServerId ~= -1 then
            killerPed = GetPlayerPed(GetPlayerFromServerId(killerServerId))
        end

        if killerPed ~= -1 and DoesEntityExist(killerPed) and killerPed ~= playerPed then
            local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
            SetCamCoord(cam, GetEntityCoords(playerPed))
            PointCamAtCoord(cam, GetEntityCoords(killerPed))
            RenderScriptCams(true, true, 1000, true, true)

            Wait(3000)

            if currentLobby.respawnTime > 3 then
                NetworkSetInSpectatorMode(true, killerPed)
                Wait((currentLobby.respawnTime - 3) * 1000)
                NetworkSetInSpectatorMode(false, playerPed)
            end

            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
        else
            Wait(currentLobby.respawnTime * 1000)
        end

        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)
    end)
end

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
