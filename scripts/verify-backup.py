"""
Verify that Supabase has a recent database backup.

Queries the Supabase Management API for the project's latest backup timestamp.
Exits with code 1 (fails the CI step → GitHub emails the repo owner) if the
most recent backup is older than MAX_AGE_HOURS.

Usage:
  python scripts/verify-backup.py

Required env vars:
  SUPABASE_PAT        — Personal Access Token (stored as a GitHub secret)

Optional env vars:
  SUPABASE_PROJECT_REF — project ref (default: auavcfwytrwurawcvrsc)
  MAX_AGE_HOURS        — alert threshold in hours (default: 30)
"""

import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone

PROJECT_REF = os.environ.get('SUPABASE_PROJECT_REF', 'auavcfwytrwurawcvrsc')
MAX_AGE_HOURS = int(os.environ.get('MAX_AGE_HOURS', '30'))


def main():
    pat = os.environ.get('SUPABASE_PAT')
    if not pat:
        print('error: SUPABASE_PAT env var not set', file=sys.stderr)
        sys.exit(1)

    url = f'https://api.supabase.com/v1/projects/{PROJECT_REF}/database/backups'
    req = urllib.request.Request(
        url,
        headers={
            'Authorization': f'Bearer {pat}',
            'Content-Type': 'application/json',
            'User-Agent': 'vanta-backup-check/0.1',
        },
        method='GET',
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read().decode()
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f'error: Supabase API returned HTTP {e.code}', file=sys.stderr)
        print(body[:2000], file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f'error: network error reaching Supabase API — {e.reason}', file=sys.stderr)
        sys.exit(1)

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        print(f'error: unexpected response (not JSON): {body[:500]}', file=sys.stderr)
        sys.exit(1)

    # Response shape: {"backups": [...], "tiered_backups": [...]}
    # Each backup has: {"id": ..., "inserted_at": "2026-05-24T06:00:00Z",
    #                   "status": "completed", ...}
    backups = []
    if isinstance(data, dict):
        backups = data.get('backups', []) + data.get('tiered_backups', [])
    elif isinstance(data, list):
        backups = data

    if not backups:
        print('WARNING: no backups found for this project.', file=sys.stderr)
        print('This may mean backups are not yet enabled or the API response shape changed.')
        print(f'Raw response: {body[:1000]}')
        sys.exit(1)

    # Find the most recent completed backup
    completed = [b for b in backups if b.get('status') in ('completed', 'success', None)]
    if not completed:
        completed = backups  # fall back to all if status field is absent

    def parse_ts(b):
        raw = b.get('inserted_at') or b.get('created_at') or b.get('finished_at') or ''
        if not raw:
            return datetime.min.replace(tzinfo=timezone.utc)
        # Normalise: "2026-05-24T06:00:00Z" or "2026-05-24T06:00:00.000Z"
        raw = raw.rstrip('Z')
        if '.' in raw:
            raw = raw[:19]
        try:
            return datetime.fromisoformat(raw).replace(tzinfo=timezone.utc)
        except ValueError:
            return datetime.min.replace(tzinfo=timezone.utc)

    latest = max(completed, key=parse_ts)
    latest_ts = parse_ts(latest)
    now = datetime.now(tz=timezone.utc)

    if latest_ts == datetime.min.replace(tzinfo=timezone.utc):
        print('WARNING: could not parse a timestamp from any backup entry.', file=sys.stderr)
        print(f'Latest backup entry: {json.dumps(latest, indent=2)}')
        sys.exit(1)

    age_hours = (now - latest_ts).total_seconds() / 3600
    age_str = f'{age_hours:.1f}h ago'

    print(f'Project ref   : {PROJECT_REF}')
    print(f'Latest backup : {latest_ts.strftime("%Y-%m-%d %H:%M UTC")}  ({age_str})')
    print(f'Total backups : {len(backups)}  (completed: {len(completed)})')
    print(f'Alert threshold: {MAX_AGE_HOURS}h')

    if age_hours > MAX_AGE_HOURS:
        print(
            f'\n🚨 ALERT: Latest backup is {age_str} old — exceeds {MAX_AGE_HOURS}h threshold!',
            file=sys.stderr,
        )
        print('Check the Supabase dashboard → Settings → Database → Backups.', file=sys.stderr)
        sys.exit(1)
    else:
        print(f'\n✅ Backup is fresh ({age_str} < {MAX_AGE_HOURS}h threshold). All good.')
        sys.exit(0)


if __name__ == '__main__':
    main()
