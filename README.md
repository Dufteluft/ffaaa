# Advanced FFA Lobby System for ESX Legacy

Ein komplettes Free For All (FFA) und Team Deathmatch (TDM) Lobby-System für FiveM, optimiert für ESX Legacy 1.13.4.

## Features
- **3 Tab NUI Menü**: FFA Lobbys, Lobby erstellen, Offene Lobbys.
- **Benutzerdefinierte Lobbys**: Name, Map, Modus, Loadout, Zeit, Kill-Limit, Fahrzeuge, Friendly Fire.
- **Team Deathmatch (TDM)**: Blau vs. Rot mit automatischem Score-Tracking.
- **Spielablauf**: 10s Countdown, zufälliger Spawn, automatisches Loadout, HUD.
- **Statistiken**: MySQL Speicherung von Kills, Toden, Spielen und Siegen.
- **Kill-Cam**: Kamera schwenkt nach dem Tod kurz zum Mörder.
- **Optimiert**: Läuft mit 60+ FPS, Event-basierte Synchronisation.

## Installation
1. Lade den Ordner `ffa-lobby` in dein `resources` Verzeichnis hoch.
2. Importiere die `database.sql` in deine MySQL Datenbank.
3. Füge `ensure ffa-lobby` in deine `server.cfg` ein.
4. (Optional) Passe die `config.lua` nach deinen Wünschen an.

## Tastaturbelegung
- Standard: **F5** zum Öffnen des Hauptmenüs (konfigurierbar in `config.lua`).

## Abhängigkeiten
- `es_extended` (Legacy)
- `mysql-async` oder `oxmysql`
