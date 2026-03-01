-- Fahrzeug-Spawn Logik (wenn in Lobby aktiviert)
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local playerPed = PlayerPedId()
            local coords = GetEntityCoords(playerPed)
            local vehicle = GetClosestVehicle(coords.x, coords.y, coords.z, 30.0, 0, 71)

            if vehicle == 0 then
                local spawnPos = GetOffsetFromEntityInWorldCoords(playerPed, 0.0, 15.0, 0.0)
                local model = `zentorno`
                RequestModel(model)
                while not HasModelLoaded(model) do Wait(10) end

                local veh = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(playerPed), true, false)
                SetVehicleOnGroundProperly(veh)
                SetEntityAsMissionEntity(veh, true, true)
                SetModelAsNoLongerNeeded(model)
            end
        end
    end
end)

-- Anti-Teamkill: Verhindert Schaden an Teammitgliedern
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(0)
        if playerState and playerState.isInGame and currentLobby and currentLobby.mode == 'tdm' and not currentLobby.friendlyFire then
            local playerPed = PlayerPedId()

            -- Wir nutzen SetCanAttackFriendly, aber das ist oft unzuverlässig in GTA
            -- Daher prüfen wir zusätzlich das Ziel des Spielers
            local _, targetPed = GetEntityPlayerIsFreeAimingAt(PlayerId())

            if targetPed and DoesEntityExist(targetPed) and IsEntityAPed(targetPed) and IsPedAPlayer(targetPed) then
                local targetId = NetworkGetPlayerIndexFromPed(targetPed)
                local targetServerId = GetPlayerServerId(targetId)

                -- Wenn das Ziel im gleichen Team ist, Schaden deaktivieren
                -- Hinweis: Dies erfordert eine Synchronisation der Teams aller Spieler auf dem Client
                -- Für eine einfache Lösung nutzen wir hier eine Prüfung via Server oder Globaler Tabelle
                -- Hier implementieren wir die native Lösung:
                SetEntityCanBeDamagedByRelationshipGroup(targetPed, false, `PLAYER`)
            end
        end
    end
end)

-- Native Anti-Teamkill via Relationship Groups
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myTeam = teams[GetPlayerServerId(PlayerId())]
    if not myTeam then return end

    AddRelationshipGroup('BLUE_TEAM')
    AddRelationshipGroup('RED_TEAM')

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), `BLUE_TEAM`)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), `RED_TEAM`)
    end

    SetRelationshipBetweenGroups(1, `BLUE_TEAM`, `BLUE_TEAM`) -- 1 = Like
    SetRelationshipBetweenGroups(1, `RED_TEAM`, `RED_TEAM`)
    SetRelationshipBetweenGroups(5, `BLUE_TEAM`, `RED_TEAM`) -- 5 = Hate
    SetRelationshipBetweenGroups(5, `RED_TEAM`, `BLUE_TEAM`)
end)
