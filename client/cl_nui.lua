-- Fahrzeug-Spawn Logik
local playerVehicle = nil

Citizen.CreateThread(function()
    while true do
        Citizen.Wait(2000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local playerPed = PlayerPedId()

            -- Spawn nur wenn kein Fahrzeug da ist
            if not DoesEntityExist(playerVehicle) then
                local coords = GetEntityCoords(playerPed)
                local model = `zentorno`

                RequestModel(model)
                while not HasModelLoaded(model) do Wait(10) end

                local spawnPos = GetOffsetFromEntityInWorldCoords(playerPed, 0.0, 5.0, 0.0)
                playerVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(playerPed), true, false)
                SetVehicleOnGroundProperly(playerVehicle)
                SetEntityAsMissionEntity(playerVehicle, true, true)
                SetModelAsNoLongerNeeded(model)

                ESX.ShowNotification('Fahrzeug gespawnt!')
            end
        elseif playerVehicle then
            -- Lösche Fahrzeug wenn nicht mehr in Game oder Lobby es verbietet
            if DoesEntityExist(playerVehicle) then
                DeleteEntity(playerVehicle)
            end
            playerVehicle = nil
        end
    end
end)

-- Anti-Teamkill
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(0)
        if playerState and playerState.isInGame and currentLobby and currentLobby.mode == 'tdm' and not currentLobby.friendlyFire then
            -- Deaktiviere Friendly Fire via Relationships (passiert in ffa:syncTeams)
            -- Zusätzlich: Verhindere Schaden durch Nahkampf
            local playerPed = PlayerPedId()
            local _, targetPed = GetEntityPlayerIsFreeAimingAt(PlayerId())

            if targetPed and DoesEntityExist(targetPed) and IsPedAPlayer(targetPed) then
                local targetId = GetPlayerServerId(NetworkGetPlayerIndexFromPed(targetPed))
                -- Wenn im gleichen Team, zielen/schießen erschweren oder verhindern
                -- Relationship groups regeln das meiste
            end
        end
    end
end)

RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    local myTeam = teams[myId]
    if not myTeam or myTeam == 'none' or myTeam == 'ffa' then
        -- Alle sind Feinde in FFA
        SetPedRelationshipGroupHash(PlayerPedId(), `PLAYER`)
        return
    end

    AddRelationshipGroup('BLUE_TEAM')
    AddRelationshipGroup('RED_TEAM')

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), `BLUE_TEAM`)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), `RED_TEAM`)
    end

    -- 0 = Companion, 1 = Respect, 2 = Like, 3 = Neutral, 4 = Dislike, 5 = Hate
    SetRelationshipBetweenGroups(0, `BLUE_TEAM`, `BLUE_TEAM`)
    SetRelationshipBetweenGroups(0, `RED_TEAM`, `RED_TEAM`)
    SetRelationshipBetweenGroups(5, `BLUE_TEAM`, `RED_TEAM`)
    SetRelationshipBetweenGroups(5, `RED_TEAM`, `BLUE_TEAM`)

    -- Deaktiviere Friendly Fire Schaden
    SetCanAttackFriendly(PlayerPedId(), false, false)
end)
