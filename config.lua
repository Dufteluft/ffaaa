Config = {}

Config.Locale = 'de' -- 'de' oder 'en'
Config.MenuKey = 'F5' -- Standardtaste für das Hauptmenü

-- Standardeinstellungen für neue Lobbys
Config.DefaultSettings = {
    roundTime = 15, -- Minuten
    maxPlayers = 16,
    respawnTime = 5, -- Sekunden
    killLimit = 30,
    friendlyFire = false,
    vehiclesAllowed = false
}

-- Waffen-Loadouts (Multi-Select fähig)
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

-- Map Definitionen mit Spawnpoints
Config.Maps = {
    {
        id = 'legion',
        label = 'Würfelpark',
        center = vector3(185.0, -930.0, 30.6),
        radius = 80.0,
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
        radius = 120.0,
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
        radius = 150.0,
        spawns = {
            vector4(-1060.0, -2730.0, 20.1, 90.0),
            vector4(-1010.0, -2730.0, 20.1, 270.0),
            vector4(-1035.0, -2700.0, 20.1, 0.0),
            vector4(-1035.0, -2760.0, 20.1, 180.0)
        }
    }
}

-- Lokalisierungstexte
Config.Locales = {
    ['de'] = {
        ['menu_title'] = 'FFA LOBBY SYSTEM',
        ['tab_ffa'] = 'FFA Lobby',
        ['tab_create'] = 'Lobby erstellen',
        ['tab_list'] = 'Offene Lobbys',
        ['your_stats'] = 'DEINE STATS',
        ['kills'] = 'Kills',
        ['deaths'] = 'Tode',
        ['kd_ratio'] = 'K/D',
        ['wins'] = 'Siege',
        ['sidebar_hint'] = 'Wähle einen Modus um zu starten.',
        ['lobby_name'] = 'Lobby Name',
        ['map_select'] = 'Map auswählen',
        ['mode_select'] = 'Spielmodus',
        ['loadout_select'] = 'Waffen-Loadout',
        ['multi_select_hint'] = 'Halte STRG für Mehrfachauswahl',
        ['round_time'] = 'Rundenzeit (Min)',
        ['max_players'] = 'Max. Spieler',
        ['vehicles_allowed'] = 'Fahrzeuge erlaubt',
        ['friendly_fire'] = 'Freundliches Feuer',
        ['respawn_time'] = 'Respawn-Zeit (Sek)',
        ['kill_limit'] = 'Kill-Limit zum Sieg',
        ['kill_limit_hint'] = '0 = Deaktiviert',
        ['filter_free_slots'] = 'Nur freie Plätze',
        ['btn_create'] = 'Lobby erstellen',
        ['btn_cancel'] = 'Abbrechen',
        ['btn_join'] = 'Beitreten',
        ['btn_ready'] = 'Bereit',
        ['btn_start'] = 'Spiel starten',
        ['btn_leave'] = 'Verlassen',
        ['players'] = 'SPIELER',
        ['lobby_settings'] = 'EINSTELLUNGEN',
        ['select_team'] = 'TEAM WÄHLEN',
        ['team_blue'] = 'Blau',
        ['team_red'] = 'Rot',
        ['spectator'] = 'Zuschauer',
        ['random'] = 'Zufall',
        ['game_ended'] = 'RUNDE BEENDET!',
        ['player'] = 'Spieler',
        ['vote_next_map'] = 'NÄCHSTE MAP WÄHLEN',
        ['btn_back_lobby'] = 'Zurück zur Lobby',
        ['btn_back_menu'] = 'Hauptmenü'
    },
    ['en'] = {
        ['menu_title'] = 'FFA LOBBY SYSTEM',
        ['tab_ffa'] = 'FFA Lobby',
        ['tab_create'] = 'Create Lobby',
        ['tab_list'] = 'Open Lobbies',
        ['your_stats'] = 'YOUR STATS',
        ['kills'] = 'Kills',
        ['deaths'] = 'Deaths',
        ['kd_ratio'] = 'K/D',
        ['wins'] = 'Wins',
        ['sidebar_hint'] = 'Choose a mode to start.',
        ['lobby_name'] = 'Lobby Name',
        ['map_select'] = 'Select Map',
        ['mode_select'] = 'Game Mode',
        ['loadout_select'] = 'Weapon Loadout',
        ['multi_select_hint'] = 'Hold CTRL for multi-select',
        ['round_time'] = 'Round Time (Min)',
        ['max_players'] = 'Max Players',
        ['vehicles_allowed'] = 'Vehicles Allowed',
        ['friendly_fire'] = 'Friendly Fire',
        ['respawn_time'] = 'Respawn Time (Sec)',
        ['kill_limit'] = 'Kill Limit to Win',
        ['kill_limit_hint'] = '0 = Disabled',
        ['filter_free_slots'] = 'Only free slots',
        ['btn_create'] = 'Create Lobby',
        ['btn_cancel'] = 'Cancel',
        ['btn_join'] = 'Join',
        ['btn_ready'] = 'Ready',
        ['btn_start'] = 'Start Game',
        ['btn_leave'] = 'Leave',
        ['players'] = 'PLAYERS',
        ['lobby_settings'] = 'SETTINGS',
        ['select_team'] = 'SELECT TEAM',
        ['team_blue'] = 'Blue',
        ['team_red'] = 'Red',
        ['spectator'] = 'Spectator',
        ['random'] = 'Random',
        ['game_ended'] = 'GAME ENDED!',
        ['player'] = 'Player',
        ['vote_next_map'] = 'VOTE NEXT MAP',
        ['btn_back_lobby'] = 'Back to Lobby',
        ['btn_back_menu'] = 'Main Menu'
    }
}

-- Globaler Hilf für Übersetzungen
function _U(str, ...)
    local lang = Config.Locale or 'en'
    if Config.Locales[lang] and Config.Locales[lang][str] then
        return string.format(Config.Locales[lang][str], ...)
    else
        return 'Translation [' .. lang .. '][' .. str .. '] not found'
    end
end
