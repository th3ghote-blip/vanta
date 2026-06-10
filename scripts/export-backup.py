#!/usr/bin/env python3
"""
export-backup.py — free-tier replacement for the Supabase backups API check.

Dumps every table in the public schema to gzipped JSON via the PostgREST
service-role API (no Management API / paid tier / PAT needed). Run nightly
from GitHub Actions; the workflow uploads the output dir as an artifact
(90-day retention) giving us a real, restorable backup at $0.

Env:
  SUPABASE_URL               — https://<ref>.supabase.co
  SUPABASE_SERVICE_ROLE_KEY  — service role key (GH secret)
  OUT_DIR                    — output directory (default: backup-out)

Exit codes: 0 = all tables exported, 1 = any table failed.
"""
import gzip
import json
import os
import sys
import urllib.request

URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
OUT = os.environ.get("OUT_DIR", "backup-out")
PAGE = 1000  # PostgREST default max rows per request

if not URL or not KEY:
    print("error: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set", file=sys.stderr)
    sys.exit(1)


def req(path: str, headers: dict | None = None):
    r = urllib.request.Request(
        URL + path,
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", **(headers or {})},
    )
    return urllib.request.urlopen(r, timeout=60)


def list_tables() -> list[str]:
    """PostgREST root serves an OpenAPI doc whose paths are the exposed tables."""
    with req("/rest/v1/") as r:
        spec = json.load(r)
    return sorted(
        p.lstrip("/")
        for p in spec.get("paths", {})
        if p != "/" and "{" not in p and not p.startswith("/rpc/")
    )


def export_table(table: str) -> int:
    rows: list = []
    offset = 0
    while True:
        hdrs = {"Range-Unit": "items", "Range": f"{offset}-{offset + PAGE - 1}"}
        with req(f"/rest/v1/{table}?select=*", hdrs) as r:
            chunk = json.load(r)
        rows.extend(chunk)
        if len(chunk) < PAGE:
            break
        offset += PAGE
    with gzip.open(os.path.join(OUT, f"{table}.json.gz"), "wt", encoding="utf-8") as f:
        json.dump(rows, f, default=str)
    return len(rows)


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    tables = list_tables()
    print(f"exporting {len(tables)} tables from {URL}")
    failed = []
    total = 0
    for t in tables:
        try:
            n = export_table(t)
            total += n
            print(f"  {t}: {n} rows")
        except Exception as e:  # noqa: BLE001 — report and continue
            failed.append(t)
            print(f"  {t}: FAILED — {e}", file=sys.stderr)
    print(f"done: {total} rows across {len(tables) - len(failed)} tables")
    if failed:
        print(f"FAILED tables: {', '.join(failed)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
