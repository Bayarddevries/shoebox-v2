# Take Down Request Policy — Métis Shoebox Project

> **Status: OPERATIVE (2026-09-10)** — replaces the old NCTR-template version
> (`Take Down Request Instructions - FR Comments.txt`), which referenced
> `nctr.ca`, used the CCAP-only address `Info@RRMNHC.ca`, and had unfilled
> placeholders. This is MMF's own policy for the Red River Métis Digital
> Archive. The authority wording in the privacy notice should be confirmed by
> Fillmore Riley at the next legal review.

---

The Manitoba Métis Federation (MMF) respects an individual's right to privacy.
We allow anyone to request that a record be removed from the Red River Métis
Digital Archive for privacy or other reasons. For example, you may wish to
request a take down if your name or face appears in a record online or in an
exhibit, and you do not want that information online.

## How to make a request

- **Email:** metisshoebox@mmf.mb.ca
- Include: your contact information, the title and reference code of the
  record (or any description that identifies the photo — a filename, a
  contributor ID such as CH-001, or a description of who is in the photo all
  work), and a short note on which photo(s) you mean.
- **Phone:** (204) 295-3467 (shared RRMNHC line — leave a message identifying
  yourself and the record).

## What happens next

1. The MMF temporarily removes the record from the public website.
2. We review your request and contact you within **two business days** to
   discuss it.
3. A decision is communicated within **five business days**.

## Outcomes

Once a take down request is reviewed, one of three things will happen:

- The record is removed from the public website but stored in our archival
  collection.
- The record is reposted to our website, but with the sensitive information
  removed.
- The record is reposted to our website with no changes.

## Sign-off authority

- Takedown requests are reviewed and approved by the **Shoebox project lead**
  (Bayard DeVries).
- Disputes or requests the lead cannot resolve are escalated to the **RRMNHC
  Director**.
- Requests are acknowledged within two business days; a decision is
  communicated within five business days.

## Appeal

A requester who disagrees with a "reposted with no changes" outcome may appeal
in writing to the RRMNHC Director at metisshoebox@mmf.mb.ca within 30 days of
the decision. The appeal is reviewed within ten business days.

## Web permanence limitation

Removing a photo from the live site removes it from the current build, but the
image file remains in the public repository's git history and on GitHub's CDN.
For a standard takedown, removal from the live site is sufficient. For a
privacy or legal takedown where the image must not remain accessible, the
repository history must be purged (git-filter-repo or equivalent, then force
push) or the repository made private. The archive team decides which level
applies per request.

## Operational notes (internal)

- "Reference code" = the photo filename in the archive manifest, or the
  contributor's ID (e.g. CH-001). If unsure, any description that identifies
  the photo is sufficient.
- After approving a removal: remove the photo from
  `public/assets/shoebox/photos/`, regenerate the manifest
  (`node scripts/generate_manifest.js`), rebuild, commit, push, and confirm
  the live site no longer serves it.
- Removal from the public archive does NOT delete the archival master
  (masters live on the work PC + Lightroom cloud per Bayard, 2026-08-28).
- Every takedown is logged: date, requester, photo reference, outcome,
  approver.

---

## Notice Regarding Collection, Use, and Disclosure of Personal Information

Your personal information is collected by the Manitoba Métis Federation under
the authority of the MMF's role as the governing body of the Red River Métis
and the Shoebox Project's Consent, Release and Copyright Licence Agreement,
and is used only for the purpose of processing your take down request and
communicating with you about it. Your personal information will not be used or
disclosed for other purposes without your consent, except as required by law.
If you have questions about the collection of your personal information,
contact metisshoebox@mmf.mb.ca or (204) 295-3467.

> ⚠️ Legal review note: the original template's notice cited The University of
> Manitoba Act and The National Research Centre for Truth and Reconciliation
> Act because it was NCTR boilerplate. MMF is not the University of Manitoba,
> so that authority does not apply. The wording above is drafted pending
> confirmation by Fillmore Riley.
