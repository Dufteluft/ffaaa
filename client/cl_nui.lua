local playerVehicle = nil

-- Fahrzeug-Spawn Logik
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local playerPed = PlayerPedId()

            if not DoesEntityExist(playerVehicle) or GetEntityHealth(playerVehicle) <= 0 then
                local coords = GetEntityCoords(playerPed)
                local spawnPos = GetOffsetFromEntityInWorldCoords(playerPed, 0.0, 5.0, 0.0)
                local model = `zentorno`

                RequestModel(model)
                while not HasModelLoaded(model) do Wait(10) end

                playerVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(playerPed), true, false)
                SetVehicleOnGroundProperly(playerVehicle)
                SetEntityAsMissionEntity(playerVehicle, true, true)
                SetModelAsNoLongerNeeded(model)
            end
        elseif playerVehicle then
            if DoesEntityExist(playerVehicle) then
                DeleteEntity(playerVehicle)
            end
            playerVehicle = nil
        end
    end
end)

-- Anti-Teamkill via Relationship Groups
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    local myTeam = teams[myId]

    if not myTeam or currentLobby.mode ~= 'tdm' or currentLobby.friendlyFire then
        SetPedRelationshipGroupHash(PlayerPedId(), `PLAYER`)
        return
    end

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

    -- Friendly Fire aus
    SetCanAttackFriendly(PlayerPedId(), false, false)
    NetworkSetFriendlyFireOption(false)
end)

-- Zurücksetzen bei Verlassen
AddEventHandler('ffa:leftLobby', function()
    if playerVehicle then
        DeleteEntity(playerVehicle)
        playerVehicle = nil
    end
    SetPedRelationshipGroupHash(PlayerPedId(), `PLAYER`)
    NetworkSetFriendlyFireOption(true)
end)
