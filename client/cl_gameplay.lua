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
    SendNUIMessage({ action = 'showHUD' })
    TriggerEvent('ffa:updateHUDStats', 0, 0)
end)

function GiveLoadout(loadoutKey)
    local loadout = Config.WeaponLoadouts[loadoutKey]
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)
    if loadout then
        for _, weapon in ipairs(loadout) do
            GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
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
                    ESX.ShowNotification('~r~Du verlässt das Kampfgebiet!')
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                end

                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    local loadout = Config.WeaponLoadouts[currentLobby.loadout]
                    if loadout then
                        for _, w in ipairs(loadout) do
                            if GetHashKey(w.name) == currentWeapon then
                                allowed = true
                                break
                            end
                        end
                    end
                    if not allowed then
                        RemoveWeaponFromPed(ped, currentWeapon)
                    end
                end
            end
        end
    end
end)

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
        local playerPed = PlayerPedId()
        local killerCoords = GetEntityCoords(killerPed)

        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        SetCamCoord(cam, GetEntityCoords(playerPed))
        PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
        RenderScriptCams(true, true, 1000, true, true)

        Wait(3000)

        local respawnTime = currentLobby.respawnTime or 5
        if respawnTime > 3 then
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
            if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
                NetworkSetInSpectatorMode(true, killerPed)
            end
            Wait((respawnTime - 3) * 1000)
            NetworkSetInSpectatorMode(false, playerPed)
        else
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
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
    SetNuiFocus(true, true)
    SendNUIMessage({
        action = 'showWinner',
        winnerName = data.winnerName,
        stats = data.stats
    })
    RemoveAllPedWeapons(PlayerPedId(), true)
end)

-- Anti-Teamkill logic
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState.isInGame and currentLobby then
            if currentLobby.mode == 'tdm' and not currentLobby.friendlyFire then
                NetworkSetFriendlyFireOption(false)
                SetCanAttackFriendly(PlayerPedId(), false, false)
            else
                NetworkSetFriendlyFireOption(true)
                SetCanAttackFriendly(PlayerPedId(), true, false)
            end
        end
    end
end)

RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myTeam = teams[tostring(GetPlayerServerId(PlayerId()))]
    if not myTeam then return end
    AddRelationshipGroup('BLUE_TEAM')
    AddRelationshipGroup('RED_TEAM')
    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), `BLUE_TEAM`)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), `RED_TEAM`)
    end
    SetRelationshipBetweenGroups(1, `BLUE_TEAM`, `BLUE_TEAM`)
    SetRelationshipBetweenGroups(1, `RED_TEAM`, `RED_TEAM`)
    SetRelationshipBetweenGroups(5, `BLUE_TEAM`, `RED_TEAM`)
    SetRelationshipBetweenGroups(5, `RED_TEAM`, `BLUE_TEAM`)
end)
