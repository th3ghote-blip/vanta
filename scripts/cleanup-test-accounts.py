#!/usr/bin/env python3
"""
cleanup-test-accounts.py — purge test/E2E junk accounts (Phase 21.2).

Classifies every auth user as REAL or TEST:
  - REAL  = on the keep-list, OR has a real email (not a synthetic/test domain)
  - TEST  = everything else (synthetic {login}@vanta.account, @vanta.test, @example.com)

Dry-run by default — prints the keep/delete split and does nothing.
Pass --confirm to actually delete the TEST auth users (cascade removes their
accounts / profiles / trades / robots).

Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (read from server/.env).

⚠️ DESTRUCTIVE with --confirm. The keep-list is mandatory and never deleted.
"""
import json
import os
import re
import sys
import urllib.request
import urllib.error

# --- never delete these account logins, whatever their email looks like ---
KEEP_LOGINS = {80000035}
# emails on these domains are considered test junk
TEST_EMAIL_RE = re.compile(r'@(vanta\.account|vanta\.test|example\.com|example\.org)$', re.I)

ENV_PATH = os.path.join(os.path.dirname(__file__), '..', 'server', '.env')


def load_env():
    # Prefer real environment variables (CI passes them as secrets); fall back to
    # server/.env for local/interactive runs.
    env = {}
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if '=' in line and not line.startswith('#'):
                    k, v = line.split('=', 1)
                    env[k] = v
    for k in ('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'):
        if os.environ.get(k):
            env[k] = os.environ[k]
    return env


def main():
    confirm = '--confirm' in sys.argv
    env = load_env()
    url = env['SUPABASE_URL'].rstrip('/')
    key = env['SUPABASE_SERVICE_ROLE_KEY']
    H = {'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}

    def api(path, method='GET', body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url + path, data=data, method=method, headers=H)
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw else None

    # 1. all accounts (login + user_id)
    accounts = api('/rest/v1/accounts?select=login,user_id')
    by_user = {a['user_id']: a['login'] for a in accounts}

    # 2. all auth users (paginated)
    users = []
    page = 1
    while True:
        chunk = api(f'/auth/v1/admin/users?page={page}&per_page=200')
        batch = chunk['users'] if isinstance(chunk, dict) else chunk
        if not batch:
            break
        users.extend(batch)
        if len(batch) < 200:
            break
        page += 1

    keep, delete = [], []
    for u in users:
        uid = u['id']
        email = (u.get('email') or '').lower()
        login = by_user.get(uid)
        is_real = (login in KEEP_LOGINS) or (email and not TEST_EMAIL_RE.search(email))
        (keep if is_real else delete).append({'id': uid, 'email': email or '(none)', 'login': login})

    print(f'\nTotal auth users: {len(users)}  |  accounts: {len(accounts)}')
    print(f'\n--- KEEP ({len(keep)}) ---')
    for k in sorted(keep, key=lambda x: x['login'] or 0):
        print(f"  login {k['login']!s:<10} {k['email']}")
    print(f'\n--- DELETE ({len(delete)}) ---')
    for d in sorted(delete, key=lambda x: x['login'] or 0):
        print(f"  login {d['login']!s:<10} {d['email']}")

    if not confirm:
        print(f'\nDRY RUN — nothing deleted. Re-run with --confirm to delete the {len(delete)} TEST users.')
        return

    print(f'\nDeleting {len(delete)} test users...')
    failed = 0
    for d in delete:
        try:
            api(f"/auth/v1/admin/users/{d['id']}", method='DELETE')
        except urllib.error.HTTPError as e:
            failed += 1
            print(f"  FAILED {d['login']}: {e.code} {e.read().decode()[:120]}")
    print(f'Done. Deleted {len(delete) - failed}/{len(delete)} (failed: {failed}). Kept {len(keep)}.')


if __name__ == '__main__':
    main()
