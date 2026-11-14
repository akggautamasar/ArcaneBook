#!/usr/bin/env python3
"""Append isolated universal routes to existing FastAPI app; --apply backs up.

Does not restart the service or touch legacy routes; safe to re-run.
"""
import argparse,ast,shutil
from datetime import datetime
from pathlib import Path

MARK='# ARCANE_UNIVERSAL_API_V1'
BLOCK='''\n# ARCANE_UNIVERSAL_API_V1\nfrom pathlib import Path as arcane_universal_path\nimport importlib.util as arcane_universal_importlib\narcane_universal_file = arcane_universal_path(__file__).resolve().parent / "universal_api.py"\narcane_universal_spec = arcane_universal_importlib.spec_from_file_location("universal_api", arcane_universal_file)\narcane_universal_module = arcane_universal_importlib.module_from_spec(arcane_universal_spec)\narcane_universal_spec.loader.exec_module(arcane_universal_module)\narcane_universal_module.register_universal_routes(app)\n'''

def main():
    p=argparse.ArgumentParser();p.add_argument('--server',default='/opt/arcane-pdf2mock/server.py');p.add_argument('--apply',action='store_true');a=p.parse_args()
    path=Path(a.server);source=path.read_text()
    if MARK in source:
        print('Already installed. No changes.');return
    if '@app.post("/api/jobs")' not in source and "@app.post('/api/jobs')" not in source:
        raise SystemExit('Legacy jobs route not found. Refusing to modify.')
    if not (path.parent/'universal_api.py').exists() or not (path.parent/'universal_image_engine.py').exists():
        raise SystemExit('Universal API/engine files are missing from converter directory.')
    updated=source.rstrip()+'\n'+BLOCK
    ast.parse(updated,filename=str(path))
    print('Syntax valid. Existing server source and routes retained.')
    if a.apply:
        backup=path.with_name(path.name+'.before-universal-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
        shutil.copy2(path,backup)
        path.write_text(updated)
        print('STAGED',path,'BACKUP',backup,'NO RESTART')
    else:print('DRY RUN ONLY: add --apply to stage')
if __name__=='__main__':main()