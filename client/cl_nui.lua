-- Fahrzeug-Spawn Logik
local lastVehicle = nil

Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local playerPed = PlayerPedId()
            if not IsPedInAnyVehicle(playerPed, false) then
                local coords = GetEntityCoords(playerPed)
                local vehicle = GetClosestVehicle(coords.x, coords.y, coords.z, 20.0, 0, 71)

                if vehicle == 0 then
                    if lastVehicle and DoesEntityExist(lastVehicle) then
                        DeleteEntity(lastVehicle)
                    end

                    local spawnPos = GetOffsetFromEntityInWorldCoords(playerPed, 0.0, 5.0, 0.0)
                    local model = GetHashKey(Config.VehicleModel or 'zentorno')

                    RequestModel(model)
                    while not HasModelLoaded(model) do Wait(10) end

                    lastVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(playerPed), true, false)
                    SetVehicleOnGroundProperly(lastVehicle)
                    SetEntityAsMissionEntity(lastVehicle, true, true)
                    SetModelAsNoLongerNeeded(model)
                end
            end
        end
    end
end)

-- Anti-Teamkill
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.mode == 'tdm' and not currentLobby.friendlyFire then
            -- FiveM Native Team-Management
            NetworkSetFriendlyFireOption(false)
            SetCanAttackFriendly(PlayerPedId(), false, false)
        else
            NetworkSetFriendlyFireOption(true)
            SetCanAttackFriendly(PlayerPedId(), true, false)
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
    AddRelationshipGroup('FFA_PLAYERS')

    local ped = PlayerPedId()
    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(ped, GetHashKey('BLUE_TEAM'))
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(ped, GetHashKey('RED_TEAM'))
    else
        SetPedRelationshipGroupHash(ped, GetHashKey('FFA_PLAYERS'))
    end

    SetRelationshipBetweenGroups(1, GetHashKey('BLUE_TEAM'), GetHashKey('BLUE_TEAM')) -- Like
    SetRelationshipBetweenGroups(1, GetHashKey('RED_TEAM'), GetHashKey('RED_TEAM')) -- Like
    SetRelationshipBetweenGroups(5, GetHashKey('BLUE_TEAM'), GetHashKey('RED_TEAM')) -- Hate
    SetRelationshipBetweenGroups(5, GetHashKey('RED_TEAM'), GetHashKey('BLUE_TEAM')) -- Hate
    SetRelationshipBetweenGroups(5, GetHashKey('FFA_PLAYERS'), GetHashKey('FFA_PLAYERS')) -- Hate
end)
