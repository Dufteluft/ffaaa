Config = {}

Config.Locale = 'de' -- 'de' or 'en'
Config.MenuKey = 'F5' -- Default key for the main menu

Config.DefaultSettings = {
    roundTime = 15, -- minutes
    maxPlayers = 16,
    respawnTime = 5, -- seconds
    killLimit = 30,
    friendlyFire = false,
    vehiclesAllowed = false
}

Config.WeaponLoadouts = {
    ['pistol'] = {
        label = 'Pistole',
        weapons = {
            { name = 'WEAPON_PISTOL', ammo = 250 },
            { name = 'WEAPON_COMBATPISTOL', ammo = 250 }
        }
    },
    ['smg'] = {
        label = 'SMG',
        weapons = {
            { name = 'WEAPON_SMG', ammo = 250 },
            { name = 'WEAPON_COMBATMG', ammo = 250 }
        }
    },
    ['assault'] = {
        label = 'Sturmgewehr',
        weapons = {
            { name = 'WEAPON_ASSAULTRIFLE', ammo = 250 },
            { name = 'WEAPON_CARBINERIFLE', ammo = 250 }
        }
    },
    ['sniper'] = {
        label = 'Scharfschützengewehr',
        weapons = {
            { name = 'WEAPON_SNIPERRIFLE', ammo = 50 },
            { name = 'WEAPON_HEAVYSNIPER', ammo = 50 }
        }
    },
    ['shotgun'] = {
        label = 'Schrotflinte',
        weapons = {
            { name = 'WEAPON_PUMPSHOTGUN', ammo = 50 },
            { name = 'WEAPON_SAWNOFFSHOTGUN', ammo = 50 }
        }
    },
    ['all'] = {
        label = 'Alle Waffen',
        weapons = {
            { name = 'WEAPON_PISTOL', ammo = 250 },
            { name = 'WEAPON_SMG', ammo = 250 },
            { name = 'WEAPON_ASSAULTRIFLE', ammo = 250 },
            { name = 'WEAPON_SNIPERRIFLE', ammo = 50 },
            { name = 'WEAPON_PUMPSHOTGUN', ammo = 50 }
        }
    }
}

Config.Maps = {
    {
        id = 'legion',
        label = 'Würfelpark',
        center = vector3(185.0, -930.0, 30.6),
        radius = 100.0,
        spawns = {
            vector4(167.0, -929.0, 30.6, 180.0),
            vector4(185.0, -912.0, 30.6, 90.0),
            vector4(203.0, -930.0, 30.6, 0.0),
            vector4(185.0, -948.0, 30.6, 270.0)
        }
    },
    {
        id = 'sandyshores',
        label = 'Sandy Shores',
        center = vector3(1850.0, 3680.0, 34.0),
        radius = 150.0,
        spawns = {
            vector4(1820.0, 3680.0, 34.0, 90.0),
            vector4(1880.0, 3680.0, 34.0, 270.0),
            vector4(1850.0, 3650.0, 34.0, 0.0),
            vector4(1850.0, 3710.0, 34.0, 180.0)
        }
    },
    {
        id = 'airport',
        label = 'Flughafen',
        center = vector3(-1037.0, -2737.0, 20.1),
        radius = 200.0,
        spawns = {
            vector4(-1060.0, -2730.0, 20.1, 90.0),
            vector4(-1010.0, -2730.0, 20.1, 270.0),
            vector4(-1035.0, -2700.0, 20.1, 0.0),
            vector4(-1035.0, -2760.0, 20.1, 180.0)
        }
    },
    {
        id = 'vinewood',
        label = 'Vinewood',
        center = vector3(630.0, 560.0, 128.0),
        radius = 120.0,
        spawns = {
            vector4(610.0, 560.0, 128.0, 90.0),
            vector4(650.0, 560.0, 128.0, 270.0),
            vector4(630.0, 540.0, 128.0, 0.0),
            vector4(630.0, 580.0, 128.0, 180.0)
        }
    },
    {
        id = 'port',
        label = 'Hafen',
        center = vector3(770.0, -2980.0, 6.0),
        radius = 150.0,
        spawns = {
            vector4(740.0, -2980.0, 6.0, 90.0),
            vector4(800.0, -2980.0, 6.0, 270.0),
            vector4(770.0, -2950.0, 6.0, 0.0),
            vector4(770.0, -3010.0, 6.0, 180.0)
        }
    },
    {
        id = 'paleto',
        label = 'Paleto Bay',
        center = vector3(-110.0, 6450.0, 31.0),
        radius = 120.0,
        spawns = {
            vector4(-100.0, 6440.0, 31.0, 90.0),
            vector4(-120.0, 6460.0, 31.0, 270.0),
            vector4(-110.0, 6430.0, 31.0, 0.0),
            vector4(-110.0, 6470.0, 31.0, 180.0)
        }
    }
}

Config.Locales = {
    ['de'] = {
        ['menu_title'] = 'FFA LOBBY SYSTEM',
        ['tab_ffa'] = 'FFA Lobby',
        ['tab_create'] = 'Lobby erstellen',
        ['tab_list'] = 'Offene Lobbys',
        ['lobby_name'] = 'Lobby Name',
        ['map_select'] = 'Map auswählen',
        ['mode_select'] = 'Spielmodus',
        ['loadout_select'] = 'Waffen-Loadout',
        ['round_time'] = 'Rundenzeit (Min)',
        ['max_players'] = 'Max. Spieler',
        ['vehicles_allowed'] = 'Fahrzeuge erlaubt',
        ['friendly_fire'] = 'Freundliches Feuer',
        ['respawn_time'] = 'Respawn-Zeit (Sek)',
        ['kill_limit'] = 'Kill-Limit zum Sieg',
        ['btn_create'] = 'Lobby erstellen',
        ['btn_cancel'] = 'Abbrechen',
        ['btn_join'] = 'Beitreten',
        ['btn_ready'] = 'Bereit',
        ['btn_start'] = 'Spiel starten',
        ['btn_leave'] = 'Lobby verlassen',
        ['btn_kick'] = 'Kicken',
        ['team_blue'] = 'Team Blau',
        ['team_red'] = 'Team Rot',
        ['spectator'] = 'Zuschauer',
        ['random'] = 'Zufall',
        ['waiting_for_players'] = 'Warte auf Spieler...',
        ['players'] = 'Spieler',
        ['countdown'] = 'Start in %s Sekunden',
        ['game_ended'] = 'Runde beendet!',
        ['winner'] = 'Gewinner: %s',
        ['kills'] = 'Kills',
        ['deaths'] = 'Tode',
        ['kd_ratio'] = 'K/D',
        ['score'] = 'Score'
    },
    ['en'] = {
        ['menu_title'] = 'FFA LOBBY SYSTEM',
        ['tab_ffa'] = 'FFA Lobby',
        ['tab_create'] = 'Create Lobby',
        ['tab_list'] = 'Open Lobbies',
        ['lobby_name'] = 'Lobby Name',
        ['map_select'] = 'Select Map',
        ['mode_select'] = 'Game Mode',
        ['loadout_select'] = 'Weapon Loadout',
        ['round_time'] = 'Round Time (Min)',
        ['max_players'] = 'Max Players',
        ['vehicles_allowed'] = 'Vehicles Allowed',
        ['friendly_fire'] = 'Friendly Fire',
        ['respawn_time'] = 'Respawn Time (Sec)',
        ['kill_limit'] = 'Kill Limit to Win',
        ['btn_create'] = 'Create Lobby',
        ['btn_cancel'] = 'Cancel',
        ['btn_join'] = 'Join',
        ['btn_ready'] = 'Ready',
        ['btn_start'] = 'Start Game',
        ['btn_leave'] = 'Leave Lobby',
        ['btn_kick'] = 'Kick',
        ['team_blue'] = 'Team Blue',
        ['team_red'] = 'Team Red',
        ['spectator'] = 'Spectator',
        ['random'] = 'Random',
        ['waiting_for_players'] = 'Waiting for players...',
        ['players'] = 'Players',
        ['countdown'] = 'Starting in %s seconds',
        ['game_ended'] = 'Game Ended!',
        ['winner'] = 'Winner: %s',
        ['kills'] = 'Kills',
        ['deaths'] = 'Deaths',
        ['kd_ratio'] = 'K/D',
        ['score'] = 'Score'
    }
}

function _U(str, ...)
    if Config.Locales[Config.Locale] and Config.Locales[Config.Locale][str] then
        return string.format(Config.Locales[Config.Locale][str], ...)
    else
        return 'Translation [' .. Config.Locale .. '][' .. str .. '] not found'
    end
end
