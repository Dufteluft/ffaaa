-- Globale Variablen werden aus cl_main.lua übernommen
local spawnedVehicle = nil

-- Event: Spielstart-Vorbereitung
RegisterNetEvent('ffa:gameStarting')
AddEventHandler('ffa:gameStarting', function(lobby)
    currentLobby = lobby
    playerState.isInGame = true
    playerState.kills = 0
    playerState.deaths = 0

    -- UI fokussieren
    SendNUIMessage({ action = 'gameStarting' })
    SetNuiFocus(false, false)

    -- Teleportation und Countdown
    TeleportToMap(lobby.mapId)

    if lobby.isPersistent then
        FreezeEntityPosition(PlayerPedId(), false)
    else
        StartCountdown(10)
    end

    -- Ausrüstung übergeben
    GiveLoadout(lobby.loadout)

    -- HUD einblenden
    SendNUIMessage({
        action = 'showHUD',
        mode = lobby.mode
    })

    -- Fahrzeug spawnen, falls erlaubt
    if lobby.vehiclesAllowed then
        SpawnLobbyVehicle()
    end
end)

-- Funktion: Teilt Waffen basierend auf dem Loadout aus
function GiveLoadout(loadoutKeys)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    if type(loadoutKeys) == "string" then
        loadoutKeys = {loadoutKeys}
    end

    for _, key in ipairs(loadoutKeys) do
        local loadout = Config.WeaponLoadouts[key]
        if loadout then
            for _, weapon in ipairs(loadout) do
                GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
            end
        end
    end
end

-- Funktion: Spawnt ein Standardfahrzeug für die Lobby
function SpawnLobbyVehicle()
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local model = GetHashKey(Config.DefaultSettings.defaultVehicle or 'bati')

    RequestModel(model)
    while not HasModelLoaded(model) do Wait(10) end

    if spawnedVehicle then DeleteVehicle(spawnedVehicle) end

    spawnedVehicle = CreateVehicle(model, coords.x, coords.y, coords.z, GetEntityHeading(ped), true, false)
    TaskWarpPedIntoVehicle(ped, spawnedVehicle, -1)
    SetModelAsNoLongerNeeded(model)
end

-- Thread: Grenzprüfung und Waffen-Validierung
Citizen.CreateThread(function()
    while true do
        Wait(1000)
        if playerState.isInGame and currentLobby then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local map = Utils.GetMapById(currentLobby.mapId)

            if map then
                -- Grenzprüfung
                if #(coords - map.center) > map.radius then
                    ESX.ShowNotification('~r~Zurück ins Kampfgebiet!')
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                end
            end

            -- Anti-Cheat: Waffen-Validierung
            local currentWeapon = GetSelectedPedWeapon(ped)
            if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                local allowed = false
                local loadoutKeys = currentLobby.loadout
                if type(loadoutKeys) == "string" then loadoutKeys = {loadoutKeys} end

                for _, key in ipairs(loadoutKeys) do
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
                    ESX.ShowNotification('~r~Waffe nicht erlaubt!')
                end
            end
        end
    end
end)

-- Thread: Überwacht den Tod des Spielers
Citizen.CreateThread(function()
    while true do
        Wait(0)
        if playerState.isInGame then
            local ped = PlayerPedId()
            if IsEntityDead(ped) then
                local killer = GetPedKiller(ped)
                local killerServerId = -1
                if IsEntityAPed(killer) and IsPedAPlayer(killer) then
                    killerServerId = GetPlayerServerId(NetworkGetPlayerIndexFromPed(killer))
                end

                TriggerServerEvent('ffa:playerKilled', killerServerId)
                HandleDeath(killer)
                while IsEntityDead(ped) do Wait(100) end
            end
        end
    end
end)

-- Funktion: Steuert Killcam, Zuschauer-Modus und Respawn
function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local playerPed = PlayerPedId()
        local killerCoords = GetEntityCoords(killerPed)

        -- Killcam für 3 Sekunden
        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        SetCamCoord(cam, GetEntityCoords(playerPed))
        PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
        RenderScriptCams(true, true, 1000, true, true)

        Wait(3000)

        local respawnTime = currentLobby.respawnTime or 5
        if respawnTime > 3 then
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
            if killerPed ~= playerPed and DoesEntityExist(killerPed) then
                -- Zuschauer-Modus bis zum Respawn
                NetworkSetInSpectatorMode(true, killerPed)
            end
            Wait((respawnTime - 3) * 1000)
            NetworkSetInSpectatorMode(false, playerPed)
        else
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
        end

        -- Respawn an zufälliger Position
        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)
        if currentLobby.vehiclesAllowed then SpawnLobbyVehicle() end
    end)
end

-- Event: Team-Synchronisation und Anti-Teamkill Setup
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    local myTeam = teams[myId]
    if not myTeam then return end

    AddRelationshipGroup('BLUE_TEAM')
    AddRelationshipGroup('RED_TEAM')

    if myTeam == 'blue' then SetPedRelationshipGroupHash(PlayerPedId(), GetHashKey('BLUE_TEAM'))
    elseif myTeam == 'red' then SetPedRelationshipGroupHash(PlayerPedId(), GetHashKey('RED_TEAM')) end

    SetRelationshipBetweenGroups(1, GetHashKey('BLUE_TEAM'), GetHashKey('BLUE_TEAM'))
    SetRelationshipBetweenGroups(1, GetHashKey('RED_TEAM'), GetHashKey('RED_TEAM'))
    SetRelationshipBetweenGroups(5, GetHashKey('BLUE_TEAM'), GetHashKey('RED_TEAM'))
    SetRelationshipBetweenGroups(5, GetHashKey('RED_TEAM'), GetHashKey('BLUE_TEAM'))

    -- Freundliches Feuer umschalten
    if currentLobby and currentLobby.mode == 'tdm' and not currentLobby.friendlyFire then
        NetworkSetFriendlyFireOption(false)
    else
        NetworkSetFriendlyFireOption(true)
    end
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

-- Event: Spielende (Sieger anzeigen)
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
    if spawnedVehicle then DeleteVehicle(spawnedVehicle) spawnedVehicle = nil end
end)
