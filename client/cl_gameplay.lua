-- Event: Spielstart-Vorbereitung
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
        isPersistent = lobby.isPersistent
    })
end)

-- Funktion: Teilt Loadout aus
function GiveLoadout(loadoutKey)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    local keys = {}
    if type(loadoutKey) == 'table' then
        keys = loadoutKey
    else
        keys = {loadoutKey}
    end

    for _, k in ipairs(keys) do
        local loadout = Config.WeaponLoadouts[k]
        if loadout then
            for _, weapon in ipairs(loadout) do
                GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
            end
        end
    end
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

-- Game Ended
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
-- Anti-Teamkill: Nutzt Relationship Groups
local groups = {
    ['FFA_BLUE'] = GetHashKey('FFA_BLUE'),
    ['FFA_RED'] = GetHashKey('FFA_RED'),
    ['FFA_NEUTRAL'] = GetHashKey('FFA_NEUTRAL')
}

Citizen.CreateThread(function()
    -- Erstelle Relationship Groups falls sie nicht existieren
    for name, _ in pairs(groups) do
        local _, groupHash = AddRelationshipGroup(name)
        groups[name] = groupHash
    end

    -- Beziehungen setzen: Teams hassen sich, eigene mögen sich
    SetRelationshipBetweenGroups(1, groups['FFA_BLUE'], groups['FFA_BLUE'])
    SetRelationshipBetweenGroups(1, groups['FFA_RED'], groups['FFA_RED'])
    SetRelationshipBetweenGroups(5, groups['FFA_BLUE'], groups['FFA_RED'])
    SetRelationshipBetweenGroups(5, groups['FFA_RED'], groups['FFA_BLUE'])
end)

-- Team Update Logic
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(2000)
        if playerState.isInGame and currentLobby and currentLobby.mode == 'tdm' then
            local ped = PlayerPedId()
            if not currentLobby.friendlyFire then
                if playerState.team == 'blue' then
                    SetPedRelationshipGroupHash(ped, groups['FFA_BLUE'])
                elseif playerState.team == 'red' then
                    SetPedRelationshipGroupHash(ped, groups['FFA_RED'])
                end
            else
                SetPedRelationshipGroupHash(ped, groups['FFA_NEUTRAL'])
            end
        end
    end
end)

-- Kill-Erkennung und Respawn
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(0)
        if playerState.isInGame then
            local ped = PlayerPedId()
            if IsEntityDead(ped) then
                local killerPed = GetPedKiller(ped)
                local killerServerId = -1

                if IsEntityAPed(killerPed) and IsPedAPlayer(killerPed) then
                    killerServerId = GetPlayerServerId(NetworkGetPlayerIndexFromPed(killerPed))
                end

                TriggerServerEvent('ffa:playerKilled', killerServerId)
                HandleDeath(killerPed)

                while IsEntityDead(ped) do Citizen.Wait(100) end
            end
        end
    end
end)

-- Funktion: Behandelt Tod, Kill-Cam und Spectator
function HandleDeath(killerPed)
    Citizen.CreateThread(function()
        local playerPed = PlayerPedId()
        local killerCoords = GetEntityCoords(killerPed)

        -- Kill-Cam
        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        SetCamCoord(cam, GetEntityCoords(playerPed))
        PointCamAtCoord(cam, killerCoords.x, killerCoords.y, killerCoords.z)
        RenderScriptCams(true, true, 1000, true, true)

        Wait(3000)

        -- Spectator Modus
        if currentLobby and currentLobby.respawnTime > 3 then
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)

            if killerPed and DoesEntityExist(killerPed) and killerPed ~= playerPed then
                NetworkSetInSpectatorMode(true, killerPed)
            end

            Wait((currentLobby.respawnTime - 3) * 1000)
            NetworkSetInSpectatorMode(false, playerPed)
        else
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
        end

        -- Respawn
        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)

        -- Vehicle Spawn falls erlaubt
        if currentLobby.vehiclesAllowed then
            SpawnLobbyVehicle()
        end
    end)
end

function SpawnLobbyVehicle()
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local model = GetHashKey(Config.DefaultSettings.defaultVehicle or 'bati')

    RequestModel(model)
    while not HasModelLoaded(model) do Wait(10) end

    local veh = CreateVehicle(model, coords.x, coords.y, coords.z, GetEntityHeading(ped), true, false)
    TaskWarpPedIntoVehicle(ped, veh, -1)
    SetModelAsNoLongerNeeded(model)
end
-- Map-Grenzprüfung und Waffen-Validierung (Anti-Cheat)
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1500)
        if playerState.isInGame and currentLobby then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local map = Utils.GetMapById(currentLobby.mapId)

            if map then
                -- Grenzprüfung
                local dist = #(coords - map.center)
                if dist > map.radius + 20.0 then
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                    TriggerEvent('esx:showNotification', '~r~Du hast das Kampfgebiet verlassen!')
                end

                -- Waffen-Validierung
                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false
                    local keys = {}
                    if type(currentLobby.loadout) == 'table' then
                        keys = currentLobby.loadout
                    else
                        keys = {currentLobby.loadout}
                    end

                    for _, k in ipairs(keys) do
                        local loadout = Config.WeaponLoadouts[k]
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
                        TriggerEvent('esx:showNotification', '~r~Diese Waffe ist hier nicht erlaubt!')
                    end
                end
            end
        end
    end
end)
