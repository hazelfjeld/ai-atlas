#!/usr/bin/env python3
"""Compatibility entry point: Games now belongs inside the original Atlas shell.

Do not restore the former games.html sidebar shortcut or online-only offline link.
Regenerate downloads/Atlas_Demo_Offline.html after running this command.
"""
from install_games_workspace import main

if __name__ == '__main__':
    main()
