fx_version 'cerulean'
game 'gta5'

description 'Advanced FFA Lobby System for ESX Legacy'
version '1.0.0'
author 'Jules'

shared_scripts {
    '@es_extended/imports.lua',
    'config.lua',
    'shared/sh_utils.lua'
}

client_scripts {
    'client/cl_main.lua',
    'client/cl_lobby.lua',
    'client/cl_gameplay.lua'
}

server_scripts {
    '@mysql-async/lib/MySQL.lua', -- Standard for many ESX setups, or use oxmysql
    'server/sv_main.lua',
    'server/sv_lobby.lua',
    'server/sv_stats.lua'
}

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/style.css',
    'html/script.js',
    'html/assets/*.png',
    'html/assets/*.mp3'
}

lua54 'yes'
