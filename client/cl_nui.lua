-- Fahrzeug-Spawn Logik
local playerVehicle = nil
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(2000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local playerPed = PlayerPedId()
            if not IsPedInAnyVehicle(playerPed, false) then
                if not playerVehicle or not DoesEntityExist(playerVehicle) or #(GetEntityCoords(playerPed) - GetEntityCoords(playerVehicle)) > 50.0 then
                    local spawnPos = GetOffsetFromEntityInWorldCoords(playerPed, 0.0, 5.0, 0.0)
                    local model = `zentorno`
                    RequestModel(model)
                    while not HasModelLoaded(model) do Wait(10) end

                    if playerVehicle and DoesEntityExist(playerVehicle) then
                        DeleteEntity(playerVehicle)
                    end

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
    local myTeam = teams[tostring(GetPlayerServerId(PlayerId()))]
    if not myTeam then return end

    AddRelationshipGroup('BLUE_TEAM')
    AddRelationshipGroup('RED_TEAM')
    AddRelationshipGroup('FFA_TEAM')

    local ped = PlayerPedId()
    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(ped, `BLUE_TEAM`)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(ped, `RED_TEAM`)
    else
        SetPedRelationshipGroupHash(ped, `FFA_TEAM`)
    end

    -- Relationships
    SetRelationshipBetweenGroups(1, `BLUE_TEAM`, `BLUE_TEAM`) -- Respect
    SetRelationshipBetweenGroups(1, `RED_TEAM`, `RED_TEAM`)
    SetRelationshipBetweenGroups(5, `BLUE_TEAM`, `RED_TEAM`) -- Hate
    SetRelationshipBetweenGroups(5, `RED_TEAM`, `BLUE_TEAM`)

    if currentLobby and currentLobby.mode == 'tdm' and not currentLobby.friendlyFire then
        SetCanAttackFriendly(ped, false, false)
        NetworkSetFriendlyFireOption(false)
    else
        NetworkSetFriendlyFireOption(true)
    end
end)
