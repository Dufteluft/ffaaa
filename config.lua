Config = {}

Config.Locale = 'de'
Config.MenuKey = 'F5'

Config.DefaultSettings = {
    roundTime = 15,
    maxPlayers = 16,
    respawnTime = 5,
    killLimit = 0,
    friendlyFire = false,
    vehiclesAllowed = false
}

Config.WeaponLoadouts = {
    ['pistol'] = {
        { name = 'WEAPON_PISTOL', label = 'Pistole', ammo = 250 },
        { name = 'WEAPON_COMBATPISTOL', label = 'Kampfpistole', ammo = 250 }
    },
    ['smg'] = {
        { name = 'WEAPON_SMG', label = 'SMG', ammo = 250 },
        { name = 'WEAPON_COMBATMG', label = 'Kampf-MG', ammo = 250 }
    },
    ['assault'] = {
        { name = 'WEAPON_ASSAULTRIFLE', label = 'Sturmgewehr', ammo = 250 },
        { name = 'WEAPON_CARBINERIFLE', label = 'Karabiner', ammo = 250 }
    },
    ['sniper'] = {
        { name = 'WEAPON_SNIPERRIFLE', label = 'Scharfschützengewehr', ammo = 50 },
        { name = 'WEAPON_HEAVYSNIPER', label = 'Schweres Scharfschützengewehr', ammo = 50 }
    },
    ['shotgun'] = {
        { name = 'WEAPON_PUMPSHOTGUN', label = 'Pump-Action', ammo = 50 },
        { name = 'WEAPON_SAWNOFFSHOTGUN', label = 'Abgesägte Schrotflinte', ammo = 50 }
    },
    ['all'] = {
        { name = 'WEAPON_PISTOL', label = 'Pistole', ammo = 250 },
        { name = 'WEAPON_SMG', label = 'SMG', ammo = 250 },
        { name = 'WEAPON_ASSAULTRIFLE', label = 'Sturmgewehr', ammo = 250 },
        { name = 'WEAPON_SNIPERRIFLE', label = 'Scharfschützengewehr', ammo = 50 },
        { name = 'WEAPON_PUMPSHOTGUN', label = 'Pump-Action', ammo = 50 }
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
    }
}

Config.Locales = {
    ['de'] = {
        ['menu_title'] = 'GTA V FREE-FOR-ALL LOBBY FINDER',
        ['tab_ffa'] = 'FFA LOBBY',
        ['tab_create'] = 'LOBBY ERSTELLEN',
        ['tab_list'] = 'OFFENE LOBBYS',
        ['tab_players'] = 'SPIELERLISTE',
        ['your_stats'] = 'DEINE STATS',
        ['btn_join'] = 'BEITRETEN',
        ['btn_ready'] = 'BEREIT',
        ['btn_start'] = 'SPIEL STARTEN',
        ['btn_save'] = 'SPEICHERN',
        ['btn_close'] = 'LOBBY SCHLIEẞEN',
        ['btn_leave'] = 'VERLASSEN',
        ['btn_cancel'] = 'ABBRECHEN',
        ['lobby_name'] = 'LOBBY NAME',
        ['map'] = 'MAP',
        ['mode'] = 'MODUS',
        ['loadout'] = 'WAFFEN-LOADOUT (MULTI-SELECT)',
        ['round_time'] = 'RUNDENZEIT',
        ['max_players'] = 'MAX. SPIELER',
        ['respawn_time'] = 'RESPAWN-ZEIT',
        ['kill_limit'] = 'KILL-LIMIT',
        ['vehicles'] = 'FAHRZEUGE',
        ['friendly_fire'] = 'FRIENDLY FIRE',
        ['team_blue'] = 'TEAM BLAU',
        ['team_red'] = 'TEAM ROT',
        ['team_random'] = 'ZUFALL',
        ['draw'] = 'UNENTSCHIEDEN',
        ['game_ended'] = 'RUNDE BEENDET',
        ['next_map'] = 'NÄCHSTE MAP WÄHLEN',
        ['back_to_lobby'] = 'ZURÜCK ZUR LOBBY',
        ['main_menu'] = 'HAUPTMENÜ'
    },
    ['en'] = {
        ['menu_title'] = 'GTA V FREE-FOR-ALL LOBBY FINDER',
        ['tab_ffa'] = 'FFA LOBBY',
        ['tab_create'] = 'CREATE LOBBY',
        ['tab_list'] = 'OPEN LOBBIES',
        ['tab_players'] = 'PLAYER LIST',
        ['your_stats'] = 'YOUR STATS',
        ['btn_join'] = 'JOIN',
        ['btn_ready'] = 'READY',
        ['btn_start'] = 'START GAME',
        ['btn_save'] = 'SAVE',
        ['btn_close'] = 'CLOSE LOBBY',
        ['btn_leave'] = 'LEAVE',
        ['btn_cancel'] = 'CANCEL',
        ['lobby_name'] = 'LOBBY NAME',
        ['map'] = 'MAP',
        ['mode'] = 'MODE',
        ['loadout'] = 'WEAPON LOADOUT (MULTI-SELECT)',
        ['round_time'] = 'ROUND TIME',
        ['max_players'] = 'MAX. PLAYERS',
        ['respawn_time'] = 'RESPAWN TIME',
        ['kill_limit'] = 'KILL LIMIT',
        ['vehicles'] = 'VEHICLES',
        ['friendly_fire'] = 'FRIENDLY FIRE',
        ['team_blue'] = 'TEAM BLUE',
        ['team_red'] = 'TEAM RED',
        ['team_random'] = 'RANDOM',
        ['draw'] = 'DRAW',
        ['game_ended'] = 'GAME ENDED',
        ['next_map'] = 'CHOOSE NEXT MAP',
        ['back_to_lobby'] = 'BACK TO LOBBY',
        ['main_menu'] = 'MAIN MENU'
    }
}

function _U(str, ...)
    if Config.Locales[Config.Locale] and Config.Locales[Config.Locale][str] then
        return string.format(Config.Locales[Config.Locale][str], ...)
    else
        return str
    end
end
