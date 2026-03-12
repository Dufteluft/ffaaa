-- Game Starting
RegisterNetEvent('ffa:gameStarting')
AddEventHandler('ffa:gameStarting', function(lobby)
    currentLobby = lobby
    playerState.isInGame = true
    playerState.kills = 0
    playerState.deaths = 0

    SendNUIMessage({ action = 'gameStarting' })
    SetNuiFocus(false, false)

    TeleportToMap(lobby.mapId)
    StartCountdown(10)

    GiveLoadout(lobby.loadout)

    SendNUIMessage({
        action = 'showHUD',
        mode = lobby.mode
    })

    TriggerEvent('ffa:updateHUDStats', 0, 0)
end)

function GiveLoadout(loadout)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    local function giveFromKey(key)
        local weapons = Config.WeaponLoadouts[key]
        if weapons then
            for _, w in ipairs(weapons) do
                GiveWeaponToPed(ped, GetHashKey(w.name), w.ammo, false, true)
            end
        end
    end

    if type(loadout) == 'table' then
        for _, key in ipairs(loadout) do
            giveFromKey(key)
        end
    else
        giveFromKey(loadout)
    end
end

-- Boundary & Weapon Check
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
                    ESX.ShowNotification('~r~Du hast das Kampfgebiet verlassen!')
                end
            end
        end
    end
end)

-- Death Handling
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
        Wait(3000) -- Killcam Time

        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)
    end)
end

-- HUD Sync
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
        mode = currentLobby and currentLobby.mode
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
    SetNuiFocus(true, true) -- Winner screen interactable
end)

-- Team Sync & Anti-TK
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myTeam = teams[GetPlayerServerId(PlayerId())]
    if not myTeam or myTeam == 'ffa' then return end

    -- Reset friendly fire
    NetworkSetFriendlyFireOption(true)

    if currentLobby and currentLobby.mode == 'tdm' and not currentLobby.friendlyFire then
        NetworkSetFriendlyFireOption(false)
        SetCanAttackFriendly(PlayerPedId(), false, false)
    end
end)
