-- Event: Spielstart-Vorbereitung
RegisterNetEvent('ffa:gameStarting')
AddEventHandler('ffa:gameStarting', function(lobby)
    currentLobby = lobby
    playerState.isInGame = true
    playerState.kills = 0
    playerState.deaths = 0

    -- UI ausblenden
    SendNUIMessage({ action = 'gameStarting' })
    SetNuiFocus(false, false)

    -- Teleportation
    TeleportToMap(lobby.mapId)

    if lobby.isPersistent then
        FreezeEntityPosition(PlayerPedId(), false)
        SendNUIMessage({ action = 'countdown', seconds = 0 })
    else
        StartCountdown(10)
    end

    -- Waffen geben
    GiveLoadout(lobby.loadouts or {lobby.loadout})

    -- HUD anzeigen
    SendNUIMessage({
        action = 'showHUD',
        mode = lobby.mode
    })

    -- Initialer HUD Reset
    SendNUIMessage({
        action = 'updateHUD',
        kills = 0,
        deaths = 0,
        scoreBlue = 0,
        scoreRed = 0,
        time = lobby.roundTime > 0 and string.format("%02d:00", lobby.roundTime) or "∞"
    })
end)

-- Funktion: Teilt Waffen aus (unterstützt Multi-Select)
function GiveLoadout(loadouts)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    for _, category in ipairs(loadouts) do
        local weapons = Config.WeaponLoadouts[category]
        if weapons then
            for _, w in ipairs(weapons) do
                GiveWeaponToPed(ped, GetHashKey(w.name), w.ammo, false, true)
            end
        end
    end

    -- Wähle erste Waffe aus
    if #loadouts > 0 then
        local firstCat = Config.WeaponLoadouts[loadouts[1]]
        if firstCat and #firstCat > 0 then
            SetCurrentPedWeapon(ped, GetHashKey(firstCat[1].name), true)
        end
    end
end

-- Grenzprüfung & Validierung
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState.isInGame and currentLobby then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local map = Utils.GetMapById(currentLobby.mapId)

            if map then
                -- Radius Check
                local dist = #(coords - map.center)
                if dist > map.radius then
                    ESX.ShowNotification('~r~GEBIET VERLASSEN! ~s~Du wirst zurückteleportiert.')
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                end

                -- Waffen Check
                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') and currentWeapon ~= 0 then
                    local allowed = false
                    local selectedLoadouts = currentLobby.loadouts or {currentLobby.loadout}

                    for _, cat in ipairs(selectedLoadouts) do
                        local weapons = Config.WeaponLoadouts[cat]
                        if weapons then
                            for _, w in ipairs(weapons) do
                                if GetHashKey(w.name) == currentWeapon then
                                    allowed = true; break
                                end
                            end
                        end
                        if allowed then break end
                    end

                    if not allowed then
                        RemoveWeaponFromPed(ped, currentWeapon)
                        ESX.ShowNotification('~r~Diese Waffe ist nicht erlaubt!')
                    end
                end
            end
        end
    end
end)

-- Kill Erkennung via Event (performanter als Loop)
AddEventHandler('esx:onPlayerDeath', function(data)
    if playerState.isInGame then
        local killerId = data.killerServerId
        TriggerServerEvent('ffa:playerKilled', killerId)

        -- Kill-Cam und Respawn
        HandleDeath(data.killerEntity)
    end
end)

-- Fallback für Nicht-ESX Death Events oder falls esx:onPlayerDeath nicht feuert
Citizen.CreateThread(function()
    local isDead = false
    while true do
        Citizen.Wait(500)
        if playerState.isInGame then
            local ped = PlayerPedId()
            if IsEntityDead(ped) and not isDead then
                isDead = true
                -- HandleDeath wird bereits durch Event ausgelöst, falls ESX korrekt konfiguriert ist.
                -- Falls nicht, hier manueller Trigger:
                -- TriggerServerEvent('ffa:playerKilled', -1)
            elseif not IsEntityDead(ped) and isDead then
                isDead = false
            end
        end
    end
end)

function HandleDeath(killerEntity)
    Citizen.CreateThread(function()
        local ped = PlayerPedId()
        local killerCoords = killerEntity ~= 0 and GetEntityCoords(killerEntity) or GetEntityCoords(ped)

        -- Kill-Cam
        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        SetCamCoord(cam, GetEntityCoords(ped))
        PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
        RenderScriptCams(true, true, 1000, true, true)

        -- Sound abspielen
        SendNUIMessage({ action = 'playSound', sound = 'kill' })

        Wait(3000)

        -- Zuschauermodus falls Respawnzeit > 3s
        local respawnTime = currentLobby.respawnTime or 5
        if respawnTime > 3 then
            if killerEntity ~= 0 and IsEntityAPed(killerEntity) then
                NetworkSetInSpectatorMode(true, killerEntity)
            end
            Wait((respawnTime - 3) * 1000)
            NetworkSetInSpectatorMode(false, ped)
        end

        RenderScriptCams(false, true, 500, true, true)
        DestroyCam(cam, true)

        -- Respawn
        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)

        -- Loadout wiedergeben
        GiveLoadout(currentLobby.loadouts or {currentLobby.loadout})
    end)
end

-- HUD Updates
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

-- Spielende
RegisterNetEvent('ffa:gameEnded')
AddEventHandler('ffa:gameEnded', function(data)
    playerState.isInGame = false
    FreezeEntityPosition(PlayerPedId(), true)

    SendNUIMessage({
        action = 'showWinner',
        winnerName = data.winnerName,
        stats = data.stats
    })

    SetNuiFocus(true, true) -- Für Map Voting
    RemoveAllPedWeapons(PlayerPedId(), true)
end)
