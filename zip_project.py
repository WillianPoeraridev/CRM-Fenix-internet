#!/usr/bin/env python3
from __future__ import annotations

import os
import zipfile
from pathlib import Path
from datetime import datetime

# Pastas principais do projeto
INCLUDE_DIRS = [
    "src",
    "docs",
    "supabase",
]

# Arquivos importantes na raiz
INCLUDE_FILES = [
    "package.json",
    "package-lock.json",
    "next.config.mjs",
    "tsconfig.json",
    "tailwind.config.ts",
    "postcss.config.js",
    "README.md",
    ".env.example",
    "components.json",
    ".eslintrc.json",
]

# Pastas/arquivos a excluir
EXCLUDE_DIRS = {
    ".git",
    ".next",
    "node_modules",
}
EXCLUDE_FILES = {
    ".env.local",
}

ROOT = Path(__file__).resolve().parent


def should_skip_path(path: Path) -> bool:
    parts = set(path.parts)
    if parts & EXCLUDE_DIRS:
        return True
    if path.name in EXCLUDE_FILES:
        return True
    return False


def add_dir(zipf: zipfile.ZipFile, dir_path: Path) -> None:
    for root, dirs, files in os.walk(dir_path):
        root_path = Path(root)
        # Filtra diretórios excluídos
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

        for file in files:
            file_path = root_path / file
            if should_skip_path(file_path):
                continue
            arcname = file_path.relative_to(ROOT)
            zipf.write(file_path, arcname)


def main() -> None:
    project_name = "crm-fenix-2.0"
    timestamp = datetime.now().strftime("%Y%m%d-%H%M")
    out_name = f"{project_name}-{timestamp}.zip"
    out_path = ROOT / out_name

    with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED) as zipf:
        # Pastas
        for d in INCLUDE_DIRS:
            dir_path = ROOT / d
            if dir_path.exists():
                add_dir(zipf, dir_path)

        # Arquivos
        for f in INCLUDE_FILES:
            file_path = ROOT / f
            if file_path.exists() and not should_skip_path(file_path):
                zipf.write(file_path, file_path.relative_to(ROOT))

    print(f"OK: {out_path}")


if __name__ == "__main__":
    main()
