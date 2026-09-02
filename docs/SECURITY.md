# Shoebox Security (DRAFT STUB)

Status: placeholder consolidating the security model currently documented in
`docs/SUBMITTER_SYSTEM.md` and `scripts/apps-script/Code.gs`. Review before
public launch.

## Components

1. **Public static site** (GitHub Pages) — serves the archive; no auth.
2. **Claim links** (`?claim=<token>`) — private capability keys, not auth.
   Token scopes a view to one submission and gates writes to that submission.
   Treat links as private; send each submitter only their own.
3. **Apps Script backend** — validates tokens, reads submissions, appends
   contributions, emails the team. Execute as owner, access Anyone.
4. **Google Sheet** — private; only the script touches it.
5. **Admin token** (`ADMIN_TOKEN` in Code.gs) — capability key for all admin
   actions (create/update submissions, approve contributions, delete rows).

## Known considerations

- Admin token has no documented rotation policy. Rotate if it ever leaks; do
  not paste it into docs, commits, or chat.
- Backend lives in Bayard's personal Google account ("Execute as: Me"). Plan
  migration to an MMF/RRMNHC-controlled Google Workspace before launch.
- Tokens are never logged and never in analytics.
- If a new OAuth scope is added to the Apps Script, the owner must re-approve
  the /exec URL after deploy or calls fail.

## Launch checklist

- [ ] Move sheet + script to MMF-controlled account
- [ ] Admin token rotation policy
- [ ] Repo access audit (who can push to main)
- [ ] Review claim-token length/entropy
