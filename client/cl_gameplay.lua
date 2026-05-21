-- Globale Variablen für Team-Management
local relationshipGroups = {
    ['blue'] = nil,
    ['red'] = nil,
    ['none'] = nil
}

-- Initialisierung der Relationship Groups
Citizen.CreateThread(function()
    _, relationshipGroups['blue'] = AddRelationshipGroup("FFA_BLUE")
    _, relationshipGroups['red'] = AddRelationshipGroup("FFA_RED")
    _, relationshipGroups['none'] = AddRelationshipGroup("FFA_NEUTRAL")
end)

-- Event: Spielstart-Vorbereitung (Teleportation, Loadout)
RegisterNetEvent('ffa:gameStarting')
AddEventHandler('ffa:gameStarting', function(lobby)
    currentLobby = lobby
    playerState.isInGame = true
    playerState.kills = 0
    playerState.deaths = 0

    -- UI ausblenden für Fokus aufs Spiel
    SendNUIMessage({ action = 'gameStarting' })
    SetNuiFocus(false, false)

    -- Auf Karte teleportieren und Countdown (nur wenn nicht persistent)
    TeleportToMap(lobby.mapId)
    if lobby.isPersistent then
        FreezeEntityPosition(PlayerPedId(), false)
        SendNUIMessage({ action = 'countdown', seconds = 0 })
    else
        StartCountdown(10)
    end

    -- Waffen austeilen
    GiveLoadout(lobby.loadout)

    -- HUD einblenden
    SendNUIMessage({
        action = 'showHUD',
        isPersistent = lobby.isPersistent
    })
    TriggerEvent('ffa:updateHUDStats', 0, 0)
end)

-- Funktion: Teilt das gewählte Loadout an den Spieler aus
function GiveLoadout(loadoutKey)
    local ped = PlayerPedId()
    RemoveAllPedWeapons(ped, true)

    local function giveSet(key)
        local loadout = Config.WeaponLoadouts[key]
        if loadout then
            for _, weapon in ipairs(loadout) do
                GiveWeaponToPed(ped, GetHashKey(weapon.name), weapon.ammo, false, true)
            end
        end
    end

    if type(loadoutKey) == 'table' then
        for _, key in ipairs(loadoutKey) do
            giveSet(key)
        end
    else
        giveSet(loadoutKey)
    end
end

-- Team-Management und Relationship Groups (Anti-Teamkill)
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    local myTeam = teams[myId] or 'none'
    playerState.team = myTeam

    -- Relationship Groups setzen
    local myGroup = relationshipGroups[myTeam] or relationshipGroups['none']
    SetPedRelationshipGroupHash(PlayerPedId(), myGroup)

    -- Verhalten zwischen Gruppen festlegen
    if currentLobby and not currentLobby.friendlyFire then
        SetRelationshipBetweenGroups(1, relationshipGroups['blue'], relationshipGroups['blue']) -- Respekt
        SetRelationshipBetweenGroups(1, relationshipGroups['red'], relationshipGroups['red'])
        SetRelationshipBetweenGroups(5, relationshipGroups['blue'], relationshipGroups['red']) -- Hass
        SetRelationshipBetweenGroups(5, relationshipGroups['red'], relationshipGroups['blue'])
    else
        SetRelationshipBetweenGroups(5, relationshipGroups['blue'], relationshipGroups['blue'])
        SetRelationshipBetweenGroups(5, relationshipGroups['red'], relationshipGroups['red'])
    end
end)

-- Map-Grenzprüfung und Waffen-Validierung
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState.isInGame and currentLobby then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local map = Utils.GetMapById(currentLobby.mapId)

            if map then
                -- Grenzprüfung
                local dist = #(coords - map.center)
                if dist > map.radius then
                    ESX.ShowNotification('~r~Du verlässt das Kampfgebiet!')
                    local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
                    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z)
                end

                -- Waffen-Validierung
                local currentWeapon = GetSelectedPedWeapon(ped)
                if currentWeapon ~= GetHashKey('WEAPON_UNARMED') then
                    local allowed = false

                    local function checkAllowed(key)
                        local loadout = Config.WeaponLoadouts[key]
                        if loadout then
                            for _, w in ipairs(loadout) do
                                if GetHashKey(w.name) == currentWeapon then return true end
                            end
                        end
                        return false
                    end

                    if type(currentLobby.loadout) == 'table' then
                        for _, k in ipairs(currentLobby.loadout) do
                            if checkAllowed(k) then allowed = true; break end
                        end
                    else
                        allowed = checkAllowed(currentLobby.loadout)
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

-- Kill-Erkennung
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
        local respawnTime = currentLobby.respawnTime or 5

        -- Kill-Cam: 3 Sekunden auf Killer fokussieren (oder dorthin wo er war)
        local cam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
        SetCamCoord(cam, GetEntityCoords(playerPed))
        if DoesEntityExist(killerPed) then
            PointCamAtEntity(cam, killerPed, 0.0, 0.0, 0.0, true)
        end
        RenderScriptCams(true, true, 1000, true, true)

        Wait(3000)

        -- Wenn Respawn-Zeit > 3s, in Spectator-Modus wechseln
        if respawnTime > 3 then
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)

            if DoesEntityExist(killerPed) and killerPed ~= playerPed then
                NetworkSetInSpectatorMode(true, killerPed)
            end

            Wait((respawnTime - 3) * 1000)
            NetworkSetInSpectatorMode(false, playerPed)
        else
            RenderScriptCams(false, true, 500, true, true)
            DestroyCam(cam, true)
        end

        -- Wiederbelebung
        local spawn = Utils.GetRandomSpawn(currentLobby.mapId)
        NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.w, true, false)
        GiveLoadout(currentLobby.loadout)

        -- Falls Fahrzeug erlaubt war, evtl. neu spawnen?
        -- Hier vereinfacht: Fahrzeug wird nur beim ersten Start gegeben (cl_gameplay handle)
    end)
end

-- HUD-Aktualisierungen vom Server
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
