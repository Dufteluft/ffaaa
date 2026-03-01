-- Vehicle Spawning logic (if enabled in lobby)
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            -- Spawn random vehicles near player if none are around
            local playerPed = PlayerPedId()
            local coords = GetEntityCoords(playerPed)
            local vehicle = GetClosestVehicle(coords.x, coords.y, coords.z, 20.0, 0, 71)

            if vehicle == 0 then
                local spawnPos = GetOffsetFromEntityInWorldCoords(playerPed, 0.0, 10.0, 0.0)
                local model = `zentorno` -- Default example
                RequestModel(model)
                while not HasModelLoaded(model) do Wait(10) end

                local veh = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(playerPed), true, false)
                SetVehicleOnGroundProperly(veh)
                SetEntityAsMissionEntity(veh, true, true)
            end
        end
    end
end)

-- Anti-Teamkill
AddEventHandler('gameEventTriggered', function(name, args)
    if name == 'CEventNetworkEntityDamage' then
        local victim = args[1]
        local attacker = args[2]

        if victim == PlayerPedId() and IsEntityAPed(attacker) and IsPedAPlayer(attacker) then
            local attackerId = NetworkGetPlayerIndexFromPed(attacker)
            local attackerServerId = GetPlayerServerId(attackerId)

            -- If friendly fire is off and we are on the same team
            if currentLobby and not currentLobby.friendlyFire and currentLobby.mode == 'tdm' then
                -- This check requires knowing the other player's team
                -- We'd need to sync this via metadata or a global table
            end
        end
    end
end)
