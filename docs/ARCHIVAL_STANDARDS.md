# Red River Métis Shoebox Project — Archival Standards Guide

> **Status:** **V1 (ratified 2026-09-10)** — the first reviewed and approved
> version of this standard. Internal revision history: 2.0 → 2.1 (red-team
> pass). The version that governs from this date is V1. Future changes
> increment to V2, V3, etc. This restructures the original guide (written by
> the project team, never externally reviewed) into a professional archival
> standard. It keeps the team's proven practices and adds the missing layers:
> standards alignment, acquisition/provenance, rights vocabulary, controlled
> vocabularies, preservation metadata, access and exhibits, and governance.
>
> **Audience:** internal team + future staff + partner institutions
> (UManitoba, LAC, grant reviewers). Formal enough to present, practical
> enough to use in the Lightroom workflow.
>
> **Voice note (Bayard, 2026-09-10):** captions and titles are written in a
> warm, familial voice — like telling a family story at the kitchen table —
> not institutional. Exhibit wall copy may keep a more measured heritage
> voice; the photo captions and titles are the voice of the family album.

---

## 0. Purpose and principles

The Shoebox Project is a community-driven initiative to collect, preserve,
and share photographs and stories from Red River Métis families and
communities. This guide sets the standard for file naming, metadata, rights,
image quality, captions, and audio so that the archive is consistent,
culturally respectful, and durable for future generations of Métis people.

The archive exists **for** the Red River Métis people and is held **in trust**
by the MMF/RRMNHC. Community governs the data (OCAP-aligned). The standards
below are the professional floor, not the ceiling.

**Guiding principles:**

1. Every item must answer: *who gave this, when, under what agreement, and
   what may we do with it.*
2. Metadata lives in the file (IPTC/XMP), not only in a database, so it
   survives platform changes.
3. Community knowledge is authoritative. Never speculate about family
   history that was never recorded; note what is unknown.
4. The archive outlives the people who built it. Every decision must be
   documented and reproducible.

---

## 1. Standards alignment

This guide aligns with the following external frameworks. Where the guide is
silent, the framework governs.

| Framework | Scope | How we use it |
|---|---|---|
| **Dublin Core** (ISO 15836) | Generic metadata for all item types | Baseline field vocabulary; our manifest fields map to dc:title, dc:description, dc:creator, dc:date, dc:coverage, dc:rights |
| **IPTC Photo Metadata Standard** | Embedded photo metadata (IPTC/XMP) | The physical carrier of our metadata; the tags the manifest generator reads |
| **SPECTRUM** (Collections Trust) | Lifecycle of a collection item | Governs acquisition, location, movement, and disposal thinking |
| **FADGI** (Federal Agencies Digital Guidelines Initiative) | Digitization quality | Target for in-house scans; the standard behind the 1200 DPI floor |
| **OCAP** (First Nations Information Governance Centre) | Indigenous data sovereignty | Ownership, Control, Access, Possession of community data |
| **Local Contexts / TK labels** | Indigenous knowledge labels | Future addition for culturally sensitive items |
| **NCTR-style takedown practice** | Removal of records for privacy | Basis of our Takedown Policy (docs/TAKEDOWN_POLICY.md) |

**Current state:** the guide aligned with none of these at time of writing.
**Target state:** every section below states which framework it serves.

---

## 2. Acquisition & accessioning

### 2.1 Batch records (the missing provenance layer)

Every acquisition (event batch, mail-in, drop-off, individual gift) gets a
**collection register** entry: a batch-level record with

- Batch ID (e.g. LEGACY-001, SM-001, VFP-001, WPG-001)
- Source: event name + date, or donor name + date
- Who digitized it (team member), what equipment, what resolution
- Consent status at intake (forms received, forms pending)
- Any known gaps (photos in hand but not digitized, forms not yet matched)

**Target state:** the existing collection-register draft
(`~/.hermes/plans/2026-09-02-shoebox-redteam/collection-register-draft.md`,
outside the repo, not yet operative) becomes the operative register; one row
per batch. Move it into `docs/` or `scripts/` when it goes live.

### 2.2 Item-level IDs

Every photo has a stable, permanent identifier that survives renames and
re-exports:

- **Stable photo ID:** `photo_<sha1(filename).slice(0,10)>` (derived from
  filename, never index-based). This is the ID used in submissions, consent
  register, and claim links. Adding photos never changes existing IDs;
  renaming a file changes its ID, so filenames are frozen once ingested.
- **Human reference:** the Lightroom filename itself (e.g.
  `20260417 AlfredAnderson 39.jpg`) is the working reference in daily use.

**Rule:** never reintroduce index-based IDs. The stable-hash scheme is the
only ID source.

---

## 3. Rights & consent

### 3.1 The governing instrument

Rights are governed by the **MMF Red River Métis Shoebox Project Consent,
Release and Copyright Licence Agreement (V3)**. Key terms:

- **Licence, not ownership:** the contributor grants MMF an unlimited,
  non-exclusive, worldwide, royalty-free, fully-paid licence to all copyright
  in the photos. The contributor keeps copyright.
- **Scope:** reproduce, digitize, use, modify, arrange, record, display,
  exhibit, make available, telecommunicate, compile, create derivative works.
  Covers archive, online, social media, public exhibit, MMF publications.
- **Term:** perpetual.
- **Moral rights:** waived in favour of MMF.
- **Termination:** contributor may terminate at any time by emailing
  metisshoebox@mmf.mb.ca; not retroactive; does not apply to already-printed
  copies.
- **No obligation:** MMF is not obligated to use the photos.
- **Name/likeness:** contributor consents to MMF using their name and likeness
  in association with the project.
- **Third-party research contact:** contributor authorizes MMF to share their
  name/contact with researchers requesting permission.

### 3.2 Rights vocabulary (metadata fields)

The standard separates three distinct concepts. **Do not collapse them:**

| Concept | Field | Example |
|---|---|---|
| **Credit line** (who to thank) | XMP-photoshop:Credit / IPTC Credit | "Courtesy of the Dumas Family Collection" |
| **Rights statement** (what use is permitted) | XMP-dc:Rights / IPTC RightsUsageTerms | "Used under licence from the contributor, MMF Shoebox Consent V3" |
| **Copyright holder** (who owns the IP) | XMP-dc:Copyright | "© [Contributor name]" (the contributor, not MMF) |

The **submitter/attribution** field (parsed from IPTC copyright
`© Submitted by <Name>` or `© Photographed by <Name>`) is separate from all
three. It records who gave us the photo, which is provenance, not a rights
statement.

**Public display:** use clean credit lines ("Courtesy of the [Family]
Collection, used with permission"). Keep the licence terminology in internal
records.

### 3.3 Consent register

Every photo maps to a signed release. Statuses (Bayard-confirmed taxonomy):

- `consent_on_file` — digitized signed form (PDF/Adobe Scan) on record
- `retro_consent_confirmed` — verbal consent recorded during scanning,
  emailed images, or verbal consent at an event
- blank — no form, no contact

One signed form covers ALL photos listed for that contributor. Consent
evidence taxonomy: digitized signed form → `consent_on_file`; verbal/email →
`retro_consent_confirmed`.

### 3.4 In-photo person consent (known gap)

The form covers the **donor's** rights. It does not obtain consent from other
identifiable people shown in the photos. Those individuals retain their own
privacy and personality rights.

**Rule:** if a photo shows identifiable people who are not the donor and may
not have consented, treat it as sensitive and review before public display.
Flag such photos. This is the single biggest legal gap in the system and the
priority for legal review with Fillmore Riley.

### 3.5 Takedown

The operative Takedown Policy (docs/TAKEDOWN_POLICY.md) governs removal.
Every takedown is logged.

---

## 4. Metadata schema

The manifest generator reads these IPTC/XMP tags from the files. Metadata is
entered in Lightroom; the manifest is generated, never hand-edited.

| Manifest field | Lightroom / exif source | Standard |
|---|---|---|
| `title` | IPTC ObjectName / XMP-dc:Title | Short, descriptive, warm; never filename-derived |
| `caption` | IPTC Caption-Abstract / XMP-dc:Description | 2–3 sentences, Grade 8–10, storytelling, familial voice |
| `people` | person-name keywords | Full names; family surname first in string, then people L→R |
| `keywords` | IPTC Keywords / XMP-dc:Subject | Split people vs topical (blocklist applied) |
| `location`/`community`/`province`/`sublocation`/`countryCode` | IPTC City / Sub-location / Province-State / Country / CountryCode | Canonical place names only |
| `year`/`scanYear`/`photoYearSource` | derived + IPTC DateCreated | Best-estimate year; note uncertainty |
| `lat`/`lng` | EXIF GPS + geocode fallback | Signed decimals; fallback table for known communities |
| `alt` | **placeholder today** (filename); target: real alt text | Grade 8–10, under 125 chars, descriptive (see §6.2) |
| `description` | = caption (backward compat) | Legacy field, keep in sync with caption |
| `extendedDescription` (planned) | Link to associated audio file | "Audio story: MD_18850315_BeadedScoutJacket_01.mp3" |
| `submitter` | IPTC Copyright `© Submitted by <Name>` / `© Photographed by <Name>` | Attribution/provenance |
| `creator` | XMP-dc:Creator / IPTC By-line | Photographer (if known), NOT the donor |
| `credit` | XMP-photoshop:Credit | Credit line (see 3.2) |
| `rights` | XMP-dc:Rights | Rights statement (see 3.2) |
| `rating` | XMP-xmp:Rating | Optional curation signal |
| `label` | XMP-xmp:Label | Color label for workflow states |

**Field rules:**

- **Title:** short, warm, human. Never duplicate; never filename-derived
  ("Untitled 3" is a defect). Title the subject the way a family would name
  it ("Grandma Marie's garden, 1948"), not the file.
- **Caption:** who, what, why; written like you are sharing the photo with a
  relative; note unknown rather than speculating; respect cultural context
  (Red River Métis, not just Métis). See §6.1 for the full voice.
- **Alt:** concise, descriptive, not poetic; do not repeat the caption.
  NOTE: the manifest currently stores the filename in `alt` — real alt text
  is a known gap (§10).
- **People:** semicolon-separated string. Family surname first, then people
  L→R. Use full names when known; placeholders ("Unknown Elder, Child –
  Turtle Mountain") when not. Avoid speculative tagging. **Never block a real
  surname** from the keyword blocklist (e.g. "Park" is a person in 8 photos).
- **Places:** canonical spellings only (see §5.1). Sublocations stay under
  their city.
- **Keywords:** lowercase; multiple per image; categories below. Places and
  descriptors go in their own fields, never as keywords that leak into the
  people filter.

### 4.1 Keyword categories

- People & Roles: louis riel, guillaume sayer, elder, child, family
- Places: turtle mountain, st laurent, red river, batoche
- Objects & Artifacts: beadwork, fur stretcher, red river cart, scout jacket
- Themes: resistance, ceremony, homesteading, storytelling
- Language & Culture: michif, oral history, french, english
- Quality: HR (high-res, display-ready) / LR (low-res, unfit for enlargement)
- Time: year + year range (e.g. 2025, 2000-2025; best-estimate range when
  exact year unknown)

---

## 5. Controlled vocabularies

This is the layer that fixes the live data bugs at the source. Names, places,
and themes are authority-controlled so variants collapse.

### 5.1 Place names

- Canonical spellings are decided and locked (2026-09-02):
  - St. Lazare (not St. Lazar)
  - Ste. Madeleine (canonical)
  - Fond du Lac province → Saskatchewan
  - Rooster Town stays its own community
  - Sublocations stay under their city
- Live variant counts (check_metadata.js, 2026-09-10 — run it again after any
  regen; do not trust numbers in this doc over the live tool):
  - Cemetary → Cemetery (54)
  - Fort Gary → Fort Garry (10)
  - Assinaboia → Assiniboia (10)
  - "Monument to the Victory at Frog" → Frog Plain (3)
  - Canaada/Territoties/canada (3 total: Canada 1, Northwest Territories 1,
    plus variants)
  - Fort Rae (1), Hydroelectric Station (1), behind Duck Bay (1)
  - Total 82 values need canonical fix
- `place-aliases.json` (alias table) collapses variants in display even if
  IPTC still holds them.

### 5.2 Personal names

- Full names when known, consistent format (First Last, not Last, First or
  nicknames).
- Family names as bare surnames ("Chartrand", not "Chartrand family").
- Use Lightroom's People View to tag faces as well as keyword names — both
  support search and exhibits.
- Authority list maintained as people are added; future addition to link to
  the Métis Research Wiki entity pages.

### 5.3 Themes

- Keyword blocklist (in `generate_manifest.js`) prevents descriptor leakage
  into the family filter: place prefixes, `/family$/`, `/^métis /`, `/uniform/i`,
  `/^collected at /i`, explicit phrases.
- Never delete a keyword from Lightroom to fix a leak; add it to the blocklist.

---

## 6. Captioning & alt text standards

### 6.1 Captioning — the voice of the family album

Captions are how future generations of Métis people will meet the people in
these photos. Write them like you are telling a family story at the kitchen
table: warm, personal, and proud of who these people were.

- **Voice:** familial and human, not institutional. Use the names and
  kinship terms the family would use (Grandma, Auntie, Uncle, cousin) when
  that is how they are known. It is fine to say "our family", "our
  community" — these are our people's stories.
- **Structure:** 2–3 sentences. Who is in the photo? What's happening? Why
  is it important?
- **Plain language:** Grade 8–10 reading level.
- **No speculation:** if details are unknown, note that clearly ("the family
  believes this was taken in the early 1940s" rather than inventing a date).
- **Respectful, culturally appropriate terminology:** Red River Métis, not
  just Métis; identify people, places, and objects the way the community
  would.
- **Historical context** when relevant, especially for artifacts or archival
  images.

### 6.2 Alt text

- 1–2 sentences, under 125 characters when possible.
- [Who/What] is shown, [doing what], [where/when if relevant].
- Descriptive, not poetic; no redundancy with captions.
- Grade 8–10 reading level; culturally appropriate terms (Red River Métis
  elder, not just elder).
- Warm where natural, but the job of alt text is to make the image visible
  to someone who cannot see it — clarity beats voice here.
- **Current gap:** the manifest's `alt` field holds the filename, not alt
  text. Real alt text is a planned pass (§10).

---

## 7. Digitization & preservation

### 7.1 In-house scans

- **Resolution:** minimum 1200 DPI (FADGI-aligned intent). The number is a
  floor, not a substitute for FADGI quality metrics (target size, sharpness,
  tone).
- **Master:** TIFF preferred (uncompressed); **Access copy:** JPEG (high
  quality).
- **Cropping:** preserve full image; crop only scanner borders or clarity.
- **Enhancement:** minimal adjustments (brightness, contrast) without
  altering historical authenticity.

### 7.2 Contributed images

- Any quality accepted; 600+ DPI preferred; JPEG/PNG/TIFF.
- Avoid filters/heavy editing/cropping that removes context.
- Contributors encouraged to share details about the scanning process or
  original photo condition.
- Lower-quality images still archived; flagged for potential re-digitization.

### 7.3 File integrity & backup

- **3-2-1 status (2026-08-28):** masters on work PC + Lightroom cloud. No
  documented third/offsite copy. **Gap.**
- **Fix:** periodic export of masters + Lightroom catalog to RRMNHC OneDrive
  (pjerome@mmf.mb.ca); document a test-restore.
- **Checksums:** hash IDs derive from filenames (deterministic), but full
  archive fixity (content hashes + verification) is a planned addition.
- **Exit path:** Lightroom cloud is proprietary lock-in. Document the export
  path (Originals + Settings → Classic/local) in the runbook.

### 7.4 File naming

`[ContributorInitials]_[YYYYMMDD]_[ShortDescription]_[SequenceNumber].jpg`

- ContributorInitials: person/family who provided the image (e.g. MD for
  Marie Dumas)
- Date: when the photo/story was created (YYYYMMDD; estimate or YYYY if
  unknown)
- ShortDescription: 3–5 words max, no spaces
- SequenceNumber: multiple related files (01, 02)

Applies to audio files identically (matching name, .mp3). **Renaming a file
after ingest changes its photo ID** — filenames are frozen once ingested.

### 7.5 Audio (planned expansion)

When the archive expands to oral histories and audio stories, the original
standard applies (preserved here so nothing is lost):

- **Format:** MP3 preferred; WAV accepted for archival purposes.
- **Naming:** match the image file name exactly (same rules as §7.4).
- **Recording:** high-quality equipment, quiet environments, verbal or
  written consent obtained.
- **Transcripts:** store in a linked folder with matching filenames.
- **Metadata link:** the image's `extendedDescription` field links to its
  audio story.

---

## 8. Access & exhibits

- **Public:** the archive is public by default when consent is on file.
- **Restricted/sensitive tier:** photos with unconsented identifiable
  people, culturally sensitive content, or deceased-person sensitivities are
  reviewed before display. TK-label field is a planned schema addition.
- **Research:** per-photo permanent citation URL, full-text search, map view,
  and bulk export are planned (see gap analysis).
- **Exhibit:** HR/LR resolution tags gate exhibit-printable images. Theme
  filters (families, land & life, celebrations) drive the exhibit slideshow.
  Captions shown in exhibits keep the familial voice; exhibit wall copy may
  use a more measured heritage voice.

---

## 9. Governance of this standard

- **Owner:** Shoebox project lead (Bayard DeVries).
- **Review cycle:** this standard is reviewed with the community advisory
  body when it is stood up, and annually thereafter.
- **Change process:** proposed changes are logged, reviewed, and the guide
  versioned. **The ratified version series starts at V1 (2026-09-10).**
  Future changes increment to V2, V3, etc. (Internal draft revisions 2.0/2.1
  predate ratification and are not part of the V-series.)
- **Training:** new team members read this guide + the intake runbook
  (docs/PHOTO_INTAKE_RUNBOOK.md) + the consent FAQ
  (docs/CONSENT_FAQ.md).

---

## 10. Gap register (current vs target)

| # | Gap | Target | Status |
|---|---|---|---|
| 1 | Provenance/batch records | Collection register operative | Draft exists outside repo (see §2.1); not yet live |
| 2 | Rights vocabulary | Credit vs rights vs copyright separated | This revision defines it; apply to metadata |
| 3 | In-photo person consent | Legal review + flagging rule | Flagging rule in §3.4; legal review pending |
| 4 | Controlled vocabularies | Place aliases + name authority | Place aliases live; name authority partial |
| 5 | Preservation 3-2-1 | Third offsite copy + checksums | No offsite copy yet |
| 6 | Research access | Citeable URLs, search, map, export | Planned |
| 7 | Restricted tier + TK labels | Schema addition | Planned |
| 8 | **Real alt text** | `alt` holds real descriptions, not filenames | **Gap — manifest stores filename in alt today** |
| 9 | Audio expansion | Oral histories + transcripts + links | Planned; §7.5 preserves the standard |
| 10 | Governance review cycle | Annual + advisory body | This section; advisory body TBD |

---

*V1 (ratified 2026-09-10) — replaces the original team-written guide.
Companion docs: docs/TAKEDOWN_POLICY.md, docs/CONSENT_FAQ.md,
docs/PHOTO_INTAKE_RUNBOOK.md, docs/SUBMITTER_SYSTEM.md.*
