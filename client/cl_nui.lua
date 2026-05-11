-- Fahrzeug-Spawn Logik
Citizen.CreateThread(function()
    local playerVehicle = nil
    while true do
        Citizen.Wait(5000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local playerPed = PlayerPedId()
            local coords = GetEntityCoords(playerPed)

            if not DoesEntityExist(playerVehicle) then
                local spawnPos = GetOffsetFromEntityInWorldCoords(playerPed, 0.0, 5.0, 0.0)
                local model = `zentorno`
                RequestModel(model)
                while not HasModelLoaded(model) do Wait(10) end

                playerVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(playerPed), true, false)
                SetVehicleOnGroundProperly(playerVehicle)
                SetEntityAsMissionEntity(playerVehicle, true, true)
                SetModelAsNoLongerNeeded(model)
            end
        elseif playerVehicle and DoesEntityExist(playerVehicle) then
            DeleteVehicle(playerVehicle)
            playerVehicle = nil
        end
    end
end)

-- Anti-Teamkill & Relationship Groups
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
    else
        SetPedRelationshipGroupHash(PlayerPedId(), `PLAYER`)
    end

    -- 1 = Like, 5 = Hate
    SetRelationshipBetweenGroups(1, `BLUE_TEAM`, `BLUE_TEAM`)
    SetRelationshipBetweenGroups(1, `RED_TEAM`, `RED_TEAM`)
    SetRelationshipBetweenGroups(5, `BLUE_TEAM`, `RED_TEAM`)
    SetRelationshipBetweenGroups(5, `RED_TEAM`, `BLUE_TEAM`)

    if currentLobby and not currentLobby.friendlyFire then
        SetRelationshipBetweenGroups(1, `BLUE_TEAM`, `BLUE_TEAM`)
        SetRelationshipBetweenGroups(1, `RED_TEAM`, `RED_TEAM`)
    end
end)

-- Schaden verhindern bei deaktiviertem Friendly Fire
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(0)
        if playerState.isInGame and currentLobby and currentLobby.mode == 'tdm' and not currentLobby.friendlyFire then
            local playerPed = PlayerPedId()
            local _, targetPed = GetEntityPlayerIsFreeAimingAt(PlayerId())

            if targetPed and DoesEntityExist(targetPed) and IsEntityAPed(targetPed) and IsPedAPlayer(targetPed) then
                local targetId = NetworkGetPlayerIndexFromPed(targetPed)
                local targetServerId = GetPlayerServerId(targetId)

                -- Wir verlassen uns hier auf Relationship Groups für NPCs,
                -- aber für Spieler nutzen wir zusätzlich SetCanAttackFriendly
                SetCanAttackFriendly(playerPed, false, false)
                NetworkSetFriendlyFireOption(false)
            else
                NetworkSetFriendlyFireOption(true)
            end
        end
    end
end)
