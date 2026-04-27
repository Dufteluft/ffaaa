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
        action = 'updateHUD',
        mode = lobby.mode,
        kills = 0,
        deaths = 0
    })
end)

function GiveLoadout(loadout)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    local function giveSet(key)
        local set = Config.WeaponLoadouts[key]
        if set then
            for _, w in ipairs(set.weapons) do
                GiveWeaponToPed(ped, GetHashKey(w.name), w.ammo, false, true)
            end
        end
    end

    if type(loadout) == 'table' then
        for _, l in ipairs(loadout) do giveSet(l) end
    else
        giveSet(loadout)
    end
end

-- Boundary and weapon validation
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState.isInGame and currentLobby then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local map = Utils.GetMapById(currentLobby.mapId)

            if map then
                -- Boundary check
                if #(coords - map.center) > map.radius then
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                    ESX.ShowNotification('Du hast das Kampfgebiet verlassen!')
                end

                -- Weapon validation
                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= `WEAPON_UNARMED` then
                    local allowed = false
                    local function checkSet(key)
                        local set = Config.WeaponLoadouts[key]
                        if set then
                            for _, w in ipairs(set.weapons) do
                                if GetHashKey(w.name) == currentWeapon then
                                    allowed = true
                                    return true
                                end
                            end
                        end
                        return false
                    end

                    if type(currentLobby.loadout) == 'table' then
                        for _, l in ipairs(currentLobby.loadout) do
                            if checkSet(l) then break end
                        end
                    else
                        checkSet(currentLobby.loadout)
                    end

                    if not allowed then
                        RemoveWeaponFromPed(ped, currentWeapon)
                        ESX.ShowNotification('Diese Waffe ist in dieser Lobby nicht erlaubt!')
                    end
                end
            end
        end
    end
end)

-- Kill detection
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
                while IsEntityDead(ped) do Citizen.Wait(100) end
            end
        end
    end
end)

function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local playerPed = PlayerPedId()
        local killerCoords = GetEntityCoords(killerPed)

        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        SetCamCoord(cam, GetEntityCoords(playerPed))
        PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
        RenderScriptCams(true, true, 1000, true, true)

        Wait(3000)

        if currentLobby and currentLobby.respawnTime > 3 then
            if DoesEntityExist(killerPed) and killerPed ~= playerPed then
                NetworkSetInSpectatorMode(true, killerPed)
            end
            Wait((currentLobby.respawnTime - 3) * 1000)
            NetworkSetInSpectatorMode(false, playerPed)
        end

        RenderScriptCams(false, true, 500, true, true)
        DestroyCam(cam, true)

        if currentLobby then
            local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
            NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
            GiveLoadout(currentLobby.loadout)
        end
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
        mode = currentLobby and currentLobby.mode or 'ffa'
    })
end)

RegisterNetEvent('ffa:updateTDMScore')
AddEventHandler('ffa:updateTDMScore', function(blue, red)
    SendNUIMessage({
        action = 'updateHUD',
        scoreBlue = blue,
        scoreRed = red,
        mode = 'tdm'
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
