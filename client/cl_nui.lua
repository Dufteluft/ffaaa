-- HUD-Updater: Alle 500ms Leben, Rüstung und Munition an NUI senden
Citizen.CreateThread(function()
    while true do
        if playerState and playerState.isInGame then
            local ped = PlayerPedId()
            local maxHealth = GetEntityMaxHealth(ped)
            local health = GetEntityHealth(ped)

            -- Normalisierung auf 0-100%
            local healthPercent = 0
            if maxHealth > 100 then
                healthPercent = ((health - 100) / (maxHealth - 100)) * 100
            else
                healthPercent = (health / maxHealth) * 100
            end

            local armor = GetPedArmour(ped)
            local weapon = GetSelectedPedWeapon(ped)
            local ammoInClip, _ = GetAmmoInClip(ped, weapon)
            local totalAmmo = GetAmmoInPedWeapon(ped, weapon)

            SendNUIMessage({
                action = 'updateHUDDetails',
                health = healthPercent,
                armor = armor,
                ammo = ammoInClip .. ' / ' .. (totalAmmo - ammoInClip)
            })
        end
        Wait(500)
    end
end)

-- Fahrzeug-Spawn Logik (wenn in Lobby aktiviert)
local lastVehicle = nil
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local playerPed = PlayerPedId()
            local coords = GetEntityCoords(playerPed)

            if not IsPedInAnyVehicle(playerPed, false) then
                local vehicle = GetClosestVehicle(coords.x, coords.y, coords.z, 20.0, 0, 71)
                if vehicle == 0 then
                    local model = GetHashKey(Config.VehicleModel or 'zentorno')
                    RequestModel(model)
                    while not HasModelLoaded(model) do Wait(10) end

                    if lastVehicle and DoesEntityExist(lastVehicle) then DeleteVehicle(lastVehicle) end

                    lastVehicle = CreateVehicle(model, coords.x, coords.y, coords.z, GetEntityHeading(playerPed), true, false)
                    SetVehicleOnGroundProperly(lastVehicle)
                    SetModelAsNoLongerNeeded(model)
                end
            end
        end
    end
end)

-- Anti-Teamkill: Verhindert Schaden an Teammitgliedern
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.mode == 'tdm' then
            local friendlyFire = currentLobby.friendlyFire or false
            NetworkSetFriendlyFireOption(friendlyFire)
            SetCanAttackFriendly(PlayerPedId(), friendlyFire, false)
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
