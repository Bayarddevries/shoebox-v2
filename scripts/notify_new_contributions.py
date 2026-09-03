#!/usr/bin/env python3
"""
Shoebox notification watcher.

Polls the Apps Script backend for new submissions and contributions, and
emails the archive team when something new arrives. Uses the Gmail API with
the existing Hermes OAuth token (gmail.send scope) — does NOT depend on
Apps Script MailApp authorization.

Usage:
  notify_new_contributions.py            # normal run: email new items, update state
  notify_new_contributions.py --seed     # seed state with all current IDs, no email
  notify_new_contributions.py --test     # send a test email, no state change
"""

import json
import os
import sys
import base64
import urllib.request
import urllib.parse
import urllib.error
import datetime

REPO = os.path.expanduser('/home/bayarddevries/shoebox-v2')
BACKEND_URL = ('https://script.google.com/macros/s/'
               'AKfycbwx0l2LijEV5MkodZcKMWPGNj5ADiZvS0Yfj9zUsITaEhhoFn_1mzd3jLi-w42qduNe/exec')
TOKEN_PATH = '/home/bayarddevries/Hermes Agent State/google_token.json'
STATE_PATH = os.path.expanduser('~/.hermes/state/shoebox_notify_state.json')
NOTIFY_EMAILS = ['bayard.devries@mmf.mb.ca', 'metisshoebox@mmf.mb.ca']

# Read ADMIN_TOKEN from Code.gs (single source of truth)
def get_admin_token():
    with open(os.path.join(REPO, 'scripts/apps-script/Code.gs')) as f:
        src = f.read()
    return src.split("ADMIN_TOKEN = '")[1].split("'")[0]

def api_get(path):
    req = urllib.request.Request(BACKEND_URL + '?' + path)
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.load(r)

def load_state():
    if os.path.exists(STATE_PATH):
        with open(STATE_PATH) as f:
            return json.load(f)
    return {'seen_submissions': [], 'seen_contributions': []}

def save_state(state):
    os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
    with open(STATE_PATH, 'w') as f:
        json.dump(state, f, indent=2)

def gmail_send(to, subject, text):
    tok = json.load(open(TOKEN_PATH))
    body = urllib.parse.urlencode({
        'client_id': tok['client_id'],
        'client_secret': tok['client_secret'],
        'refresh_token': tok['refresh_token'],
        'grant_type': 'refresh_token',
    }).encode()
    req = urllib.request.Request(tok['token_uri'], data=body, method='POST')
    with urllib.request.urlopen(req, timeout=30) as r:
        access = json.load(r)['access_token']
    msg = 'To: %s\r\nSubject: %s\r\n\r\n%s' % (to, subject, text)
    raw = base64.urlsafe_b64encode(msg.encode()).decode()
    req2 = urllib.request.Request(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        data=json.dumps({'raw': raw}).encode(),
        headers={'Authorization': 'Bearer ' + access, 'Content-Type': 'application/json'},
        method='POST')
    with urllib.request.urlopen(req2, timeout=30) as r:
        return json.load(r)

def submission_email(sub):
    lines = [
        'A new claim link was created in the Shoebox system.',
        '',
        'Submission: %s' % sub.get('submissionId'),
        'Photos: %s' % ', '.join(sub.get('photoIds') or []),
        'Created: %s' % sub.get('createdAt', sub.get('inviteSentAt', '?')),
    ]
    return '\n'.join(lines)

def contribution_email(c):
    lines = [
        'New details were submitted for a Shoebox photo:',
        '',
        'Submission: %s' % c.get('submissionId'),
        'Photo: %s' % c.get('photoId'),
        'Submitted: %s' % c.get('submittedAt'),
        '',
        'People: %s' % (c.get('people') or '(not provided)'),
        'Story: %s' % (c.get('story') or '(not provided)'),
        'Location: %s' % (c.get('location') or c.get('community') or '(not provided)'),
        'Province: %s' % (c.get('province') or '(not provided)'),
        'Country: %s' % (c.get('country') or '(not provided)'),
        'Occasion: %s' % (c.get('occasion') or '(not provided)'),
        'Caption: %s' % (c.get('caption') or '(not provided)'),
        'Keywords: %s' % (c.get('keywords') or '(not provided)'),
        '',
        'Status: %s. Review in the Contributions tab before merging.' % c.get('status'),
    ]
    return '\n'.join(lines)

def main():
    args = sys.argv[1:]
    token = get_admin_token()
    state = load_state()

    if '--test' in args:
        for to in NOTIFY_EMAILS:
            gmail_send(to, 'Shoebox notification watcher test',
                       'This confirms the Hermes-side watcher can send email.\n'
                       'Timestamp: %s' % datetime.datetime.utcnow().isoformat() + 'Z')
            print('test email sent to', to)
        return

    data = api_get('action=admin_list_contributions&admin_token=' + urllib.parse.quote(token))
    contribs = data.get('contributions', [])
    # Skip test junk
    real = [c for c in contribs if 'TEST' not in (c.get('people') or '').upper()]

    # Submissions list
    subs_data = api_get('action=admin_list_submissions&admin_token=' + urllib.parse.quote(token))
    subs = subs_data.get('submissions', [])

    new_subs = [s for s in subs if s.get('submissionId') not in state['seen_submissions']]
    new_contribs = [c for c in real if c.get('id') not in state['seen_contributions']]

    if '--seed' in args:
        state['seen_submissions'] = [s.get('submissionId') for s in subs]
        state['seen_contributions'] = [c.get('id') for c in real]
        save_state(state)
        print('seeded: %d submissions, %d contributions' % (len(state['seen_submissions']), len(state['seen_contributions'])))
        return

    sent = 0
    for s in new_subs:
        for to in NOTIFY_EMAILS:
            gmail_send(to, 'Shoebox: new claim link %s' % s.get('submissionId'),
                       submission_email(s))
            sent += 1
        state['seen_submissions'].append(s.get('submissionId'))

    for c in new_contribs:
        for to in NOTIFY_EMAILS:
            gmail_send(to, 'Shoebox: new photo details from %s (%s)' % (c.get('submissionId'), c.get('photoId')),
                       contribution_email(c))
            sent += 1
        state['seen_contributions'].append(c.get('id'))

    save_state(state)
    print('emails sent: %d (new subs: %d, new contribs: %d)' % (sent, len(new_subs), len(new_contribs)))

if __name__ == '__main__':
    main()
