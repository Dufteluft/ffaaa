-- Fahrzeug-Spawn Logik (wenn in Lobby aktiviert)
Citizen.CreateThread(function()
    local playerVehicle = nil

    while true do
        Citizen.Wait(5000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local playerPed = PlayerPedId()

            if not IsPedInAnyVehicle(playerPed, false) then
                if playerVehicle and DoesEntityExist(playerVehicle) then
                    local vCoords = GetEntityCoords(playerVehicle)
                    local pCoords = GetEntityCoords(playerPed)
                    if #(vCoords - pCoords) > 50.0 then
                        DeleteEntity(playerVehicle)
                        playerVehicle = nil
                    end
                end

                if not playerVehicle or not DoesEntityExist(playerVehicle) then
                    local spawnPos = GetOffsetFromEntityInWorldCoords(playerPed, 0.0, 5.0, 0.0)
                    local model = `zentorno`
                    RequestModel(model)
                    while not HasModelLoaded(model) do Wait(10) end

                    playerVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(playerPed), true, false)
                    SetVehicleOnGroundProperly(playerVehicle)
                    SetEntityAsMissionEntity(playerVehicle, true, true)
                    SetModelAsNoLongerNeeded(model)
                end
            end
        elseif playerVehicle and DoesEntityExist(playerVehicle) then
            DeleteEntity(playerVehicle)
            playerVehicle = nil
        end
    end
end)

-- Native Anti-Teamkill via Relationship Groups
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myTeam = teams[GetPlayerServerId(PlayerId())]

    AddRelationshipGroup('BLUE_TEAM')
    AddRelationshipGroup('RED_TEAM')
    AddRelationshipGroup('FFA_TEAM')

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), `BLUE_TEAM`)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), `RED_TEAM`)
    else
        SetPedRelationshipGroupHash(PlayerPedId(), `FFA_TEAM`)
    end

    -- Blue Team
    SetRelationshipBetweenGroups(1, `BLUE_TEAM`, `BLUE_TEAM`) -- Like
    SetRelationshipBetweenGroups(5, `BLUE_TEAM`, `RED_TEAM`) -- Hate
    SetRelationshipBetweenGroups(5, `BLUE_TEAM`, `FFA_TEAM`) -- Hate

    -- Red Team
    SetRelationshipBetweenGroups(1, `RED_TEAM`, `RED_TEAM`) -- Like
    SetRelationshipBetweenGroups(5, `RED_TEAM`, `BLUE_TEAM`) -- Hate
    SetRelationshipBetweenGroups(5, `RED_TEAM`, `FFA_TEAM`) -- Hate

    -- FFA Team (Hate everyone)
    SetRelationshipBetweenGroups(5, `FFA_TEAM`, `BLUE_TEAM`)
    SetRelationshipBetweenGroups(5, `FFA_TEAM`, `RED_TEAM`)
    SetRelationshipBetweenGroups(5, `FFA_TEAM`, `FFA_TEAM`)

    -- Friendly Fire handling
    if currentLobby and currentLobby.mode == 'tdm' and not currentLobby.friendlyFire then
        SetCanAttackFriendly(PlayerPedId(), false, false)
        NetworkSetFriendlyFireOption(false)
    else
        SetCanAttackFriendly(PlayerPedId(), true, false)
        NetworkSetFriendlyFireOption(true)
    end
end)
