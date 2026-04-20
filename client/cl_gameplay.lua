-- Event: Game Starting (Teleport, Loadout)
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
        mode = lobby.mode
    })

    TriggerEvent('ffa:updateHUDStats', 0, 0)
end)

-- Event: Reset Lobby (Back to waiting area)
RegisterNetEvent('ffa:resetLobby')
AddEventHandler('ffa:resetLobby', function(lobby)
    currentLobby = lobby
    playerState.isInGame = false

    SendNUIMessage({ action = 'hideHUD' })
    SendNUIMessage({
        action = 'lobbyJoined',
        lobby = lobby,
        myId = GetPlayerServerId(PlayerId())
    })
    SetNuiFocus(true, true)

    local ped = PlayerPedId()
    FreezeEntityPosition(ped, true)
    RemoveAllPedWeapons(ped, true)
end)

-- Function: Give Loadout (supports array of categories)
function GiveLoadout(loadoutKeys)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    if type(loadoutKeys) ~= 'table' then loadoutKeys = {loadoutKeys} end

    for _, key in ipairs(loadoutKeys) do
        local loadout = Config.WeaponLoadouts[key]
        if loadout then
            for _, weapon in ipairs(loadout.weapons) do
                GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
            end
        end
    end
end

-- Boundary and Weapon Validation
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState.isInGame and currentLobby then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local map = Utils.GetMapById(currentLobby.mapId)

            if map then
                -- Boundary Check
                if #(coords - map.center) > map.radius then
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                    ESX.ShowNotification('~r~Du hast das Kampfgebiet verlassen!')
                end

                -- Weapon Validation
                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    local loadoutKeys = currentLobby.loadout
                    if type(loadoutKeys) ~= 'table' then loadoutKeys = {loadoutKeys} end

                    for _, key in ipairs(loadoutKeys) do
                        local loadout = Config.WeaponLoadouts[key]
                        if loadout then
                            for _, w in ipairs(loadout.weapons) do
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
                        ESX.ShowNotification('~r~Waffe nicht erlaubt!')
                    end
                end
            end
        end
    end
end)

-- Kill Detection using ESX event
RegisterNetEvent('esx:onPlayerDeath')
AddEventHandler('esx:onPlayerDeath', function(data)
    if playerState.isInGame then
        local killerServerId = data.killerServerId or -1
        TriggerServerEvent('ffa:playerKilled', killerServerId)
        HandleDeath(data.killerEntity)
    end
end)

-- Death Handling (Kill-Cam & Respawn)
function HandleDeath(killerEntity)
    Citizen.CreateThread(function()
        local playerPed = PlayerPedId()

        -- Kill-Cam
        if killerEntity and DoesEntityExist(killerEntity) and killerEntity ~= playerPed then
            local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
            SetCamCoord(cam, GetEntityCoords(playerPed))
            PointCamAtEntity(cam, killerEntity, 0.0, 0.0, 0.0, true)
            RenderScriptCams(true, true, 1000, true, true)

            Wait(3000)
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
        else
            Wait(3000)
        end

        -- Respawn
        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)
    end)
end

-- Sync Events
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
