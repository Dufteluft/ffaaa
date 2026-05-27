-- Event: Spielstart Vorbereitung
RegisterNetEvent('ffa:gameStarting')
AddEventHandler('ffa:gameStarting', function(lobby)
    currentLobby = lobby
    playerState.isInGame = true

    SendNUIMessage({ action = 'gameStarting' })
    SetNuiFocus(false, false)

    TeleportToMap(lobby.mapId)

    if lobby.isPersistent then
        FreezeEntityPosition(PlayerPedId(), false)
    else
        StartCountdown(10)
    end

    GiveLoadout(lobby.loadout)
    SendNUIMessage({ action = 'showHUD', mode = lobby.mode })
end)

-- Countdown-Logik
function StartCountdown(seconds)
    Citizen.CreateThread(function()
        while seconds >= 0 do
            SendNUIMessage({ action = 'countdown', seconds = seconds })
            if seconds == 0 then
                FreezeEntityPosition(PlayerPedId(), false)
            end
            Wait(1000)
            seconds = seconds - 1
        end
    end)
end

-- Loadout vergeben (unterstützt Multi-Select)
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

-- Gameplay-Loop: Grenzprüfung, Fahrzeuge, Anti-Teamkill
Citizen.CreateThread(function()
    while true do
        local wait = 1000
        if playerState.isInGame and currentLobby then
            wait = 500
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local map = Utils.GetMapById(currentLobby.mapId)

            -- Grenzprüfung
            if map then
                local dist = #(coords - map.center)
                if dist > map.radius then
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                    ESX.ShowNotification('~r~Zurück ins Kampfgebiet!')
                end

                -- Anti-Cheat: Waffen-Validierung
                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') and currentWeapon ~= 0 then
                    local allowed = false
                    for _, key in ipairs(currentLobby.loadout) do
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
                        ESX.ShowNotification('~r~Diese Waffe ist hier nicht erlaubt!')
                    end
                end
            end

            -- Fahrzeug-Spawn (einfach gehalten)
            if currentLobby.vehiclesAllowed and not playerVehicle then
                local model = GetHashKey('bati')
                RequestModel(model)
                while not HasModelLoaded(model) do Wait(0) end
                playerVehicle = CreateVehicle(model, coords.x, coords.y, coords.z, GetEntityHeading(ped), true, false)
                TaskWarpPedIntoVehicle(ped, playerVehicle, -1)
            end
        end
        Wait(wait)
    end
end)

-- Kill-Erkennung
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
        Wait(3000) -- Kill-Cam Zeit

        local respawnTime = (currentLobby and currentLobby.respawnTime) or 5
        if respawnTime > 3 then
            -- Optional: Spectate killer
            if killerPed and DoesEntityExist(killerPed) and killerPed ~= ped then
                NetworkSetInSpectatorMode(true, killerPed)
                Wait((respawnTime - 3) * 1000)
                NetworkSetInSpectatorMode(false, ped)
            else
                Wait((respawnTime - 3) * 1000)
            end
        end

        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)
    end)
end

-- Team-Sync & Relationship Groups
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myTeam = teams[GetPlayerServerId(PlayerId())]
    if not myTeam or currentLobby.friendlyFire then return end

    -- Relationship Groups für Anti-Teamkill
    local _, blueHash = AddRelationshipGroup("FFA_BLUE")
    local _, redHash = AddRelationshipGroup("FFA_RED")
    local _, neutralHash = AddRelationshipGroup("FFA_NEUTRAL")

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), blueHash)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), redHash)
    else
        SetPedRelationshipGroupHash(PlayerPedId(), neutralHash)
    end

    SetRelationshipBetweenGroups(1, blueHash, blueHash) -- Respect
    SetRelationshipBetweenGroups(1, redHash, redHash)
    SetRelationshipBetweenGroups(5, blueHash, redHash) -- Hate
    SetRelationshipBetweenGroups(5, redHash, blueHash)
end)

-- HUD Events
RegisterNetEvent('ffa:updateTimer')
AddEventHandler('ffa:updateTimer', function(time)
    SendNUIMessage({ action = 'updateHUD', time = time })
end)

RegisterNetEvent('ffa:updateHUDStats')
AddEventHandler('ffa:updateHUDStats', function(kills, deaths)
    playerState.kills = kills
    playerState.deaths = deaths
    SendNUIMessage({ action = 'updateHUD', kills = kills, deaths = deaths })
end)

RegisterNetEvent('ffa:updateTDMScore')
AddEventHandler('ffa:updateTDMScore', function(blue, red)
    SendNUIMessage({ action = 'updateHUD', scoreBlue = blue, scoreRed = red })
end)

RegisterNetEvent('ffa:gameEnded')
AddEventHandler('ffa:gameEnded', function(data)
    playerState.isInGame = false
    FreezeEntityPosition(PlayerPedId(), true)
    SendNUIMessage({ action = 'showWinner', winnerName = data.winnerName, stats = data.stats })
    RemoveAllPedWeapons(PlayerPedId(), true)
end)
