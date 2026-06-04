"""
Apply a SQL file to Supabase via the Management API.

Usage:
  python scripts/apply-migration.py supabase/migrations/00X_name.sql

Reads the PAT from SUPABASE_PAT env var (set in your shell).
Does NOT commit the PAT to disk.
"""
import json, os, sys, urllib.request, urllib.error

PROJECT_REF = 'pepqcrzbxyuhwqesuejk'

def main():
    if len(sys.argv) != 2:
        print('usage: apply-migration.py <path-to-sql>', file=sys.stderr)
        sys.exit(1)

    pat = os.environ.get('SUPABASE_PAT')
    if not pat:
        print('error: SUPABASE_PAT env var not set', file=sys.stderr)
        sys.exit(1)

    path = sys.argv[1]
    with open(path, encoding='utf-8') as f:
        sql = f.read()

    req = urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query',
        data=json.dumps({'query': sql}).encode(),
        headers={
            'Authorization': f'Bearer {pat}',
            'Content-Type': 'application/json',
            'User-Agent': 'vanta-migrate/0.1',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req) as r:
            body = r.read().decode()
            print(f'[{path}] OK {r.status}')
            if body and body != '[]':
                print(body[:2000])
    except urllib.error.HTTPError as e:
        print(f'[{path}] ERR {e.code}', file=sys.stderr)
        print(e.read().decode()[:2000], file=sys.stderr)
        sys.exit(2)

if __name__ == '__main__':
    main()
