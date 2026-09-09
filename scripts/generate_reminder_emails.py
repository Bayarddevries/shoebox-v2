#!/usr/bin/env python3
"""Generate per-submitter reminder emails for the Shoebox metadata claim links.

Fetches live submissions + contributions from the Apps Script backend,
computes which photos still lack metadata, and writes ready-to-send email
drafts (markdown) to an output folder. Optionally sends them via Gmail API
(--send) from the account that owns ~/.hermes/google_token.json.

Usage:
  python3 scripts/generate_reminder_emails.py            # drafts only
  python3 scripts/generate_reminder_emails.py --send     # drafts + send
  python3 scripts/generate_reminder_emails.py --out DIR  # custom output dir
"""
import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
import urllib.error
from datetime import date

BACKEND_URL = 'https://script.google.com/macros/s/AKfycbwx0l2LijEV5MkodZcKMWPGNj5ADiZvS0Yfj9zUsITaEhhoFn_1mzd3jLi-w42qduNe/exec'
TOKEN_PATH = os.path.expanduser('~/.hermes/google_token.json')
CLAIM_BASE = 'https://bayarddevries.github.io/shoebox-v2/?claim='

# Submitters whose metadata is complete / no reminder needed (none currently).
SKIP_IDS = set()

PROJECT_NAME = 'Red River Métis Shoebox Archive'
SIGN_OFF = 'Red River Métis National Heritage Centre\nmetisshoebox@mmf.mb.ca'


def get_admin_token():
    """Read the admin token from Code.gs (single source of truth)."""
    code_path = os.path.join(os.path.dirname(__file__), 'apps-script', 'Code.gs')
    with open(code_path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith('const ADMIN_TOKEN'):
                # Extract between the first pair of quotes after '='.
                rest = line.split('=', 1)[1].strip()
                if rest.startswith("'") or rest.startswith('"'):
                    quote = rest[0]
                    end = rest.find(quote, 1)
                    if end != -1:
                        tok = rest[1:end]
                    else:
                        tok = rest[1:].strip()
                else:
                    tok = rest.split()[0]
                if tok and 'CHANGE_THIS' not in tok:
                    return tok
    raise RuntimeError('ADMIN_TOKEN not found in Code.gs')


def api(action, admin_token):
    url = BACKEND_URL + '?action=' + action + '&admin_token=' + urllib.parse.quote(admin_token)
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.load(resp)


def fetch_data(admin_token):
    subs = api('admin_list_submissions', admin_token).get('submissions', [])
    contribs = api('admin_list_contributions', admin_token).get('contributions', [])
    return subs, contribs


def parse_photo_ids(raw):
    if not raw:
        return []
    return [p.strip() for p in str(raw).split(',') if p.strip()]


def build_reminders(subs, contribs):
    """Return list of reminder dicts, one per submitter needing follow-up."""
    # contributed photoIds per submission (unique, non-test)
    contributed_by_sub = {}
    for c in contribs:
        sid = c.get('submissionId', '')
        pid = (c.get('photoId') or '').strip()
        if not pid or not sid:
            continue
        text = str(c.get('people', '')) + str(c.get('caption', '')) + str(c.get('story', ''))
        if '/TEST/' in text.upper():
            continue
        contributed_by_sub.setdefault(sid, set()).add(pid)

    reminders = []
    for s in subs:
        sid = s.get('submissionId', '')
        if sid in SKIP_IDS:
            continue
        photos = parse_photo_ids(s.get('photoIds'))
        contributed = contributed_by_sub.get(sid, set())
        missing = [p for p in photos if p not in contributed]
        if not missing:
            continue
        reminders.append({
            'submissionId': sid,
            'name': s.get('submitterName') or sid,
            'email': (s.get('email') or '').strip(),
            'claim_url': CLAIM_BASE + (s.get('token') or '').strip(),
            'total': len(photos),
            'contributed': len(contributed),
            'missing': missing,
            'missing_count': len(missing),
        })
    return reminders


def render_email(r):
    today = date.today().strftime('%B %d, %Y')
    missing_list = '\n'.join(f'  - {p}' for p in r['missing'])
    body = f"""Hello {r['name']},

We're following up on your photos in the {PROJECT_NAME}. Thank you for the
information you've already shared with us.

{r['missing_count']} of your photos still don't have their details filled in.
If you can, please take a few minutes to add what you know (who is in the
photo, where and when it was taken, any memories you'd like to share).

To view your photos and update them, use your personal link:
{r['claim_url']}

If you have any questions or would prefer to share the details by phone or
email, just reply to this message.

Thank you for helping preserve these stories.

{SIGN_OFF}
"""
    return body


def render_subject(r):
    return f"Your photos in the {PROJECT_NAME} — a quick follow-up"


def write_drafts(reminders, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    manifest = []
    for r in reminders:
        safe = (r['submissionId'] + '-' + r['name'].replace(' ', '_')).replace('/', '_')
        path = os.path.join(out_dir, f'{safe}.md')
        content = (
            f"# Reminder email — {r['name']} ({r['submissionId']})\n\n"
            f"**To:** {r['email']}\n"
            f"**Subject:** {render_subject(r)}\n\n"
            f"---\n\n{render_email(r)}\n"
        )
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        manifest.append({'id': r['submissionId'], 'name': r['name'], 'email': r['email'],
                         'path': path, 'missing': r['missing_count']})
    with open(os.path.join(out_dir, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
    return manifest


def send_emails(reminders, dry_run=True):
    """Send via Gmail API using the Hermes token. Returns per-recipient result."""
    if not os.path.exists(TOKEN_PATH):
        print(f'ERROR: token not found at {TOKEN_PATH}', file=sys.stderr)
        return []
    tok = json.load(open(TOKEN_PATH))
    body = urllib.parse.urlencode({
        'client_id': tok['client_id'],
        'client_secret': tok['client_secret'],
        'refresh_token': tok['refresh_token'],
        'grant_type': 'refresh_token',
    }).encode()
    req = urllib.request.Request(tok['token_uri'], data=body, method='POST')
    with urllib.request.urlopen(req, timeout=30) as resp:
        access = json.load(resp)['access_token']

    import base64
    results = []
    for r in reminders:
        email = render_email(r)
        subject = render_subject(r)
        msg = f"To: {r['email']}\r\nSubject: {subject}\r\n\r\n{email}"
        raw = base64.urlsafe_b64encode(msg.encode('utf-8')).decode('ascii')
        payload = json.dumps({'raw': raw}).encode()
        if dry_run:
            print(f"[dry-run] would send to {r['email']} ({r['submissionId']})")
            results.append({'id': r['submissionId'], 'email': r['email'], 'sent': False, 'dry_run': True})
            continue
        req2 = urllib.request.Request(
            'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
            data=payload, method='POST',
            headers={'Authorization': 'Bearer ' + access, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req2, timeout=30) as resp2:
                sent = json.load(resp2)
                print(f"[sent] {r['email']} ({r['submissionId']}) -> id {sent.get('id')}")
                results.append({'id': r['submissionId'], 'email': r['email'], 'sent': True, 'gmail_id': sent.get('id')})
        except urllib.error.HTTPError as e:
            err = e.read().decode()[:300]
            print(f"[FAILED] {r['email']} ({r['submissionId']}): {err}", file=sys.stderr)
            results.append({'id': r['submissionId'], 'email': r['email'], 'sent': False, 'error': err})
    return results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--send', action='store_true', help='actually send via Gmail API')
    ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'reminder-drafts'),
                    help='output dir for drafts')
    args = ap.parse_args()

    admin_token = get_admin_token()
    subs, contribs = fetch_data(admin_token)
    reminders = build_reminders(subs, contribs)

    print(f'Submissions: {len(subs)} | Contributions: {len(contribs)} | Need reminders: {len(reminders)}\n')
    for r in reminders:
        print(f"  {r['submissionId']} {r['name']}: {r['contributed']}/{r['total']} done, "
              f"{r['missing_count']} missing -> {r['email']}")

    out_dir = os.path.abspath(args.out)
    manifest = write_drafts(reminders, out_dir)
    print(f'\nDrafts written to {out_dir}/ ({len(manifest)} files + index.json)')

    if args.send:
        print('\n--- SENDING ---')
        results = send_emails(reminders, dry_run=False)
        ok = sum(1 for x in results if x.get('sent'))
        print(f'\nSent: {ok}/{len(results)}')
    else:
        print('\nDry run: nothing sent. Use --send after reviewing drafts.')


if __name__ == '__main__':
    main()
