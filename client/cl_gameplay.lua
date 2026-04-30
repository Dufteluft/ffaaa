-- Event: Spielstart-Vorbereitung
RegisterNetEvent('ffa:gameStarting')
AddEventHandler('ffa:gameStarting', function(lobby)
    currentLobby = lobby
    playerState.isInGame = true
    playerState.kills = 0
    playerState.deaths = 0

    SendNUIMessage({
        action = 'gameStarting',
        mode = lobby.mode
    })
    SetNuiFocus(false, false)

    TeleportToMap(lobby.mapId)
    if lobby.isPersistent then
        FreezeEntityPosition(PlayerPedId(), false)
        SendNUIMessage({ action = 'countdown', seconds = 0 })
    else
        StartCountdown(10)
    end

    GiveLoadout(lobby.loadouts)

    SendNUIMessage({
        action = 'updateHUD',
        mode = lobby.mode,
        kills = 0,
        deaths = 0,
        scoreBlue = 0,
        scoreRed = 0,
        time = lobby.roundTime > 0 and string.format('%02d:00', lobby.roundTime) or '∞'
    })
end)

-- Funktion: Teilt das gewählte Loadout (Array) an den Spieler aus
function GiveLoadout(loadoutKeys)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    for _, key in ipairs(loadoutKeys) do
        local loadout = Config.WeaponLoadouts[key]
        if loadout then
            for _, weapon in ipairs(loadout) do
                GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
            end
        end
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
                local dist = #(coords - map.center)
                if dist > map.radius then
                    ESX.ShowNotification('~r~Du verlässt das Kampfgebiet!')
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                end

                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    for _, key in ipairs(currentLobby.loadouts) do
                        local loadout = Config.WeaponLoadouts[key]
                        if loadout then
                            for _, w in ipairs(loadout) do
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
                        ESX.ShowNotification('~r~Diese Waffe ist in dieser Lobby nicht erlaubt!')
                    end
                end
            end
        end
    end
end)

-- Kill-Erkennung via Event
RegisterNetEvent('esx:onPlayerDeath')
AddEventHandler('esx:onPlayerDeath', function(data)
    if playerState.isInGame then
        local killerServerId = data.killerServerId
        TriggerServerEvent('ffa:playerKilled', killerServerId)

        local killerPed = 0
        if killerServerId and killerServerId ~= -1 then
            killerPed = GetPlayerPed(GetPlayerFromServerId(killerServerId))
        end

        HandleDeath(killerPed)
    end
end)

-- Funktion: Behandelt Tod, Kill-Cam/Zuschauen und Respawn
function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local playerPed = PlayerPedId()
        local respawnTime = currentLobby.respawnTime or 5
        local killCamTime = math.min(3000, (respawnTime * 1000) / 2)

        if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
            local killerCoords = GetEntityCoords(killerPed)
            local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
            SetCamCoord(cam, GetEntityCoords(playerPed))
            PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
            RenderScriptCams(true, true, 1000, true, true)

            Wait(killCamTime)

            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)

            if respawnTime > (killCamTime / 1000 + 1) then
                NetworkSetInSpectatorMode(true, killerPed)
                Wait((respawnTime * 1000) - killCamTime - 500)
                NetworkSetInSpectatorMode(false, playerPed)
            end
        else
            Wait(respawnTime * 1000)
        end

        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadouts)
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

RegisterNetEvent('ffa:resetToLobby')
AddEventHandler('ffa:resetToLobby', function(lobby)
    currentLobby = lobby
    playerState.isInGame = false
    FreezeEntityPosition(PlayerPedId(), false)
    SendNUIMessage({ action = 'close' }) -- Re-opens via lobby creation/join logic if needed or stay closed

    -- Main Menu logic will handle showing the lobby again
    TriggerEvent('ffa:lobbyJoined', lobby)
end)
