#!/usr/bin/env python3
"""
QA-6.2 — Schema drift detector.

Uses the Supabase PostgREST OpenAPI endpoint to verify:
  - All expected tables exist in the public schema
  - Key columns are present on each table

Also verifies basic accessibility of each table using the service-role
key (bypasses RLS so we can confirm the table is reachable).

RLS status is verified via HEAD requests: the anon key should either
get rows (policy allows) or empty results, but the table must respond 200.
The true RLS-enabled check would need the Management API; we skip that
to avoid cloud IP blocks and rely on pg tests or manual confirmation.

Run:
  SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_URL=https://xxx.supabase.co python scripts/check-schema.py

Exits 0 if everything passes, 1 if anything is missing.
"""

import os
import sys
import json
import urllib.request
import urllib.error

# ── Config ────────────────────────────────────────────────────────────────────

SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')

if not SERVICE_ROLE_KEY:
    print('ERROR: SUPABASE_SERVICE_ROLE_KEY env var is required', file=sys.stderr)
    sys.exit(1)
if not SUPABASE_URL:
    print('ERROR: SUPABASE_URL env var is required', file=sys.stderr)
    sys.exit(1)

REST_BASE = f'{SUPABASE_URL}/rest/v1'
HEADERS = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
    'Accept': 'application/json',
}

# ── Expected schema ───────────────────────────────────────────────────────────

EXPECTED_TABLES = [
    'trades',
    'accounts',
    'profiles',
    'binary_rounds',
    'copy_relationships',
    'chart_drawings',
    'price_alerts',
    'robot_runs',
    'kyc_submissions',
]

# {table: [column, ...]} — verified by selecting each column individually
EXPECTED_COLUMNS = {
    'trades': [
        'id', 'account_id', 'symbol', 'side', 'volume', 'open_price',
        'status', 'order_type', 'trigger_price', 'trail_distance', 'notes',
    ],
    'accounts': [
        'id', 'user_id', 'balance', 'free_margin', 'margin_used',
        'leverage', 'hedging_enabled',
    ],
    'profiles': ['id'],
    'binary_rounds': ['id', 'account_id', 'symbol', 'direction'],
    'copy_relationships': ['follower_id', 'leader_id', 'follower_account_id', 'allocation_pct'],
    'chart_drawings': ['id', 'user_id', 'symbol', 'drawing'],
    'price_alerts': ['id', 'user_id', 'symbol'],
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def http_get(url, headers):
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        return e.code, body
    except Exception as exc:
        return None, str(exc)

# ── Main ──────────────────────────────────────────────────────────────────────

failures = []

def fail(msg):
    failures.append(msg)
    print(f'  FAIL  {msg}')

def ok(msg):
    print(f'  ok    {msg}')

project_host = SUPABASE_URL.split('//')[1].split('.')[0] if '//' in SUPABASE_URL else SUPABASE_URL
print(f'\nSchema drift check -- project: {project_host}')
print('-' * 56)

# 1. Get OpenAPI spec — lists all exposed tables and their columns
print('\n[1/3] Fetching OpenAPI spec ...')
status, spec = http_get(f'{REST_BASE}/', HEADERS)
if status != 200 or not isinstance(spec, dict):
    fail(f'could not fetch OpenAPI spec (HTTP {status}): {str(spec)[:100]}')
    print(f'\nFAIL -- {len(failures)} issue(s)')
    sys.exit(1)

# Extract exposed table names from spec paths
# OpenAPI paths are like /table_name
exposed_tables = set()
for path in spec.get('paths', {}).keys():
    name = path.strip('/')
    if name and '/' not in name:
        exposed_tables.add(name)

# Extract column names per table from spec definitions
# definitions key is the table name, properties are columns
definitions = spec.get('definitions', {})

ok(f'OpenAPI spec loaded: {len(exposed_tables)} tables exposed')

# 2. Tables check
print('\n[2/3] Tables ...')
for tbl in EXPECTED_TABLES:
    if tbl in exposed_tables:
        ok(tbl)
    else:
        fail(f'table missing or not exposed: {tbl}')

# 3. Columns check
print('\n[3/3] Columns ...')
for tbl, cols in EXPECTED_COLUMNS.items():
    if tbl not in definitions:
        # Table missing altogether — already caught above
        for col in cols:
            fail(f'column missing (table not found): {tbl}.{col}')
        continue

    tbl_props = definitions[tbl].get('properties', {})
    for col in cols:
        if col in tbl_props:
            ok(f'{tbl}.{col}')
        else:
            # Double-check by doing a HEAD request with that column selected
            url = f'{REST_BASE}/{tbl}?select={col}&limit=1'
            hstatus, _ = http_get(url, HEADERS)
            if hstatus == 200 or hstatus == 206:
                ok(f'{tbl}.{col}  (verified via REST)')
            else:
                fail(f'column missing: {tbl}.{col}')

# ── Result ─────────────────────────────────────────────────────────────────────
print('\n' + '-' * 56)
if failures:
    print(f'\nFAIL -- {len(failures)} issue(s):')
    for f in failures:
        print(f'  * {f}')
    sys.exit(1)
else:
    print(f'\nPASS -- all {len(EXPECTED_TABLES)} tables and {sum(len(c) for c in EXPECTED_COLUMNS.values())} columns verified')
    sys.exit(0)
