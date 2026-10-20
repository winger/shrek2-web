#!/usr/bin/env python3
"""Restore this disc's game layout using its MSI tables, without executing setup.

The cabinet member names are MSI file identifiers, NOT their installed names.
In particular, many music/cutscene identifiers are truncated. File/Component/
Directory tables are the authority for the installed layout.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess

ROOT = Path(__file__).resolve().parents[1]


class MsiTables:
    def __init__(self, directory):
        self.directory = directory
        pool = (directory / '!_StringPool').read_bytes()
        data = (directory / '!_StringData').read_bytes()
        codepage, flags = struct.unpack_from('<HH', pool)
        if flags or len(pool) % 4:
            raise ValueError('Unsupported MSI string-pool format')
        self.strings = ['']
        offset = 0
        for i in range(4, len(pool), 4):
            size, references = struct.unpack_from('<HH', pool, i)
            self.strings.append(data[offset:offset + size].decode(f'cp{codepage}'))
            offset += size
        if offset != len(data):
            raise ValueError('String-pool lengths do not match string data')
        self.columns = {}
        columns = (directory / '!_Columns').read_bytes()
        if len(columns) % 8:
            raise ValueError('Malformed MSI column table')
        rows = len(columns) // 8
        for row in range(rows):
            table, number, name, kind = [
                struct.unpack_from('<H', columns, col * rows * 2 + row * 2)[0]
                for col in range(4)
            ]
            self.columns.setdefault(self.strings[table], []).append(
                (number - 0x8000, self.strings[name], kind - 0x8000))

    def table(self, name):
        columns = sorted(self.columns[name])
        widths = [2 if kind & 0x800 else kind & 0xff for _, _, kind in columns]
        data = (self.directory / ('!' + name)).read_bytes()
        if len(data) % sum(widths):
            raise ValueError(f'Malformed MSI table: {name}')
        count = len(data) // sum(widths)
        rows = [{} for _ in range(count)]
        offset = 0
        for (_, key, kind), width in zip(columns, widths):
            for row in range(count):
                start = offset + row * width
                value = int.from_bytes(data[start:start + width], 'little')
                rows[row][key] = self.strings[value] if kind & 0x800 else (
                    value - (1 << (width * 8 - 1)) if value else None)
            offset += width * count
        return rows


def safe_part(value):
    name = value.split('|')[-1]
    if name in ('', '.', '..') or any(c in name for c in '/\\:\x00'):
        raise ValueError(f'Unsafe installed name: {name!r}')
    return name


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('iso', type=Path)
    args = parser.parse_args()
    sevenzip = ROOT / 'local/tools/7zip/7zz'
    disc, cab, msi, game = [ROOT / 'local' / p for p in ('disc', 'cab', 'msi', 'game')]
    for directory in (disc, cab, msi, game):
        directory.mkdir(parents=True, exist_ok=True)
    subprocess.run([str(sevenzip), 'x', str(args.iso.resolve()), '-o' + str(disc), '-y'], check=True)
    subprocess.run([str(sevenzip), 'x', str(disc / 'MainApp.cab'), '-o' + str(cab), '-y'], check=True)
    subprocess.run([str(sevenzip), 'x', str(disc / 'Shrek 2.msi'), '-o' + str(msi), '-y'], check=True)
    tables = MsiTables(msi)
    directories = {r['Directory']: r for r in tables.table('Directory')}
    components = {r['Component']: r for r in tables.table('Component')}

    def installed_path(key, ancestors=()):
        if key == 'INSTALLDIR':
            return Path()
        if not key:
            return None
        if key in ancestors:
            raise ValueError('Cycle in MSI directories')
        row = directories[key]
        parent = installed_path(row['Directory_Parent'], (*ancestors, key))
        if parent is None:
            return None
        target = row['DefaultDir'].split(':')[0]
        return parent if target == '.' else parent / safe_part(target)

    manifest = []
    for row in tables.table('File'):
        destination = installed_path(components[row['Component_']]['Directory_'])
        if destination is None:
            continue  # Installer/support files that are not part of INSTALLDIR.
        source = cab / row['File']
        if not source.is_file():
            raise FileNotFoundError(f'Missing cabinet member: {row["File"]}')
        if source.stat().st_size != row['FileSize']:
            raise ValueError(f'File-size mismatch: {source.name}')
        target = game / destination / safe_part(row['FileName'])
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            target.unlink()
        os.link(source, target)
        manifest.append({'path': target.relative_to(game).as_posix(),
                         'size': source.stat().st_size,
                         'sha256': hashlib.sha256(source.read_bytes()).hexdigest()})
    # InstallShield's script copies the loose executable into the engine's System
    # directory; it is marked source-only in the MSI, unlike the cabinet files.
    target = game / 'System/Game.exe'
    if target.exists():
        target.unlink()
    os.link(disc / 'Game.exe', target)
    manifest.append({'path': 'System/Game.exe', 'size': target.stat().st_size,
                     'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
    (ROOT / 'local/game-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'Restored and verified sizes for {len(manifest)} game files in {game}')


if __name__ == '__main__':
    main()
