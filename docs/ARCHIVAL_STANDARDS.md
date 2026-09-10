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

### 2.2 Every photo has its own permanent name (ID)

Every photo in the archive gets a permanent ID that never changes — no
matter how many photos we add later, or what else changes.

- **The archive ID:** a short code like `photo_6248a99112`. This is the
  photo's private name inside the archive. It is how we keep track of the
  photo in submissions, consent records, and the claim links citizens use to
  review their own photos. The code is built from the file's name, so the
  same photo always has the same ID. Adding new photos never changes the
  IDs of photos we already have.
- **The everyday name:** the Lightroom filename (for example,
  `20260417 AlfredAnderson 39.jpg`) is what we actually use day to day. It
  already tells you who submitted the photo and roughly when.

**The one rule that protects all of this:** once a photo is in the archive,
its filename never changes. If a file is renamed, its archive ID changes
too — and that would break the links to its consent record, submission, and
claim link. So filenames are frozen once a photo is ingested.

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

**How it works in practice:** flagged photos go to the restricted/sensitive
tier (§8), the project lead reviews them, and anything unresolved stays off
the public site. Flagging happens at intake or during the metadata review;
the consent register notes the flag.

### 3.5 Takedown

The operative Takedown Policy (docs/TAKEDOWN_POLICY.md) governs removal.
Every takedown is logged.

### 3.6 Rights for photos with no living contributor

Most photos come with a signed consent form from the contributor. Two
situations need a defined default:

- **Contributor is deceased:** a family member signs the consent form on
  the contributor's behalf before the photos are ingested.
- **Copyright holder unknown:** photos with no identifiable holder (or
  no one able to sign) are treated as restricted — not displayed publicly —
  until the rights question is resolved. The project lead decides; legal
  (Fillmore Riley) reviews anything uncertain.

This default protects the archive: better to hold a photo back than to
display it without clear rights.

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

Keywords are how the archive remembers what matters: who was there, what
was happening, what gathering it came from. Tag freely and generously —
more tags mean the archive is easier to search, sort, and build exhibits
from. The categories below are a guide, not a cage.

1. **Events & Gatherings** — the biggest and most personal category. Tag
   the event name + year so a whole batch stays findable together:
   `Ste. Madeleine Métis Days 2026`, `Winnipeg Regional Meeting 2026`,
   `AGA 2024`, `NIPD`, `Louis Riel Day`, `wedding`, `funeral`, `gathering`.
   (Event tags were the top keywords in the live archive — this category
   just puts a name on what we already do.)
2. **People & Roles** — names (louis riel, guillaume sayer) and roles
   (elder, child, Minister, veteran, President Chartrand). People are also
   tagged by name in the `people` field; role keywords help exhibits
   ("veterans", "Ministers").
3. **Places** — turtle mountain, st laurent, red river, batoche, Ste.
   Madeleine, Duck Bay, Stony Rapids, Selkirk, San Clara. Place also lives
   in the location fields; keywords catch places that matter culturally
   even when the photo wasn't taken there (e.g. a family's home
   community).
4. **Objects & Artifacts** — beadwork, fur stretcher, red river cart,
   scout jacket, fiddle, trapper cabin, cart wheel.
5. **Themes & Activities** — resistance, ceremony, homesteading,
   storytelling, military service, agriculture, fishing, trapping, school,
   church, winter, outdoors, home, family. These are the exhibit hooks:
   "flag military images", "flag agricultural images" is exactly this
   category.
6. **Language & Culture** — michif, oral history, french, english. Still
   thin in the archive; grows as audio stories arrive.
7. **Technical** — HR (high-res, display-ready) / LR (low-res, unfit for
   enlargement), black and white, scanned in house, year + year range
   (e.g. 2025, 2000-2025; best-estimate range when the exact year is
   unknown).

**Rules that keep keywords healthy:**

- **Lowercase everything.** `outdoors` and `Outdoors` are the same tag to
  the archive; a capitalized variant splits the filter and makes counts
  lie. Enter lowercase, and fix existing capital variants at source
  (Lightroom find-replace) rather than in the manifest.
- **Tag freely, tag generously.** More description is better when sorting
  and filtering. Event names, themes, and objects are all welcome — no
  need to stay inside one bucket.
- **Never delete a keyword from Lightroom to fix a leak.** If a keyword
  shows up as a fake family in the people filter, add it to the blocklist
  in `generate_manifest.js` instead.
- **QA after every manifest regen:** run a keyword variant check (same
  idea as the place-name check) to catch new case splits before they
  accumulate.

---

## 5. Controlled vocabularies

This is the layer that fixes the live data bugs at the source. Names, places,
and themes are authority-controlled so variants collapse.

### 5.1 Place names

**Rule:** one place, one spelling. Enter the official spelling in Lightroom
(City / Sub-location / Province); fix variants at the source, never in the
manifest (the manifest is generated and would just be overwritten). When
unsure whether a name is official, flag it for the archive lead — don't
guess. `place-aliases.json` is a safety net that collapses old spellings in
display, but it doesn't replace fixing the source.

**Locked spellings (2026-09-02):** St. Lazare (not St. Lazar), Ste.
Madeleine, Fond du Lac = Saskatchewan, Rooster Town stays its own community,
sublocations stay under their city.

**Live variants (check_metadata.js, 2026-09-10 — re-run after regens):**
Cemetary → Cemetery (54), Fort Gary → Fort Garry (10), Assinaboia →
Assiniboia (10), "Victory at Frog" → Frog Plain (3), Canaada/Territoties/
canada (3), Fort Rae (1), Hydroelectric Station (1), behind Duck Bay (1).
Total: 82.

### 5.2 Personal names

- Full names when known, consistent format (First Last, not Last, First or
  nicknames).
- Family names as bare surnames ("Chartrand", not "Chartrand family").
- Use Lightroom's People View to tag faces as well as keyword names — both
  support search and exhibits.
- Authority list maintained as people are added; future addition to link to
  the Métis Research Wiki entity pages.

### 5.3 Theme keywords

Some words describe what a photo is *about* (a theme) rather than naming a
person — words like "family", "portrait", "winter", "uniform", "collected
at". These belong in the keywords, not in the family-name filter. The
archive's keyword blocklist keeps theme words from showing up as fake
family names in the website filter.

**The rules:**

- **Blocklist, don't delete.** If a theme word is leaking into the family
  filter, it gets added to the blocklist in `generate_manifest.js` so it
  stays a keyword but stops being treated as a person. Never delete the
  keyword from Lightroom to fix a leak — that loses real tagging.
- **Never block a real surname.** Some words are both a theme and a family
  name (e.g. "Park" is a person in 8 photos). The blocklist is checked
  against real family names before anything is added.
- **After any blocklist change**, regenerate the manifest and re-check the
  family filter + the "with people" count to confirm the fix moved the
  right way.

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
**Current gap:** the manifest's `alt` field holds the filename, not alt
text. Real alt text is a planned pass (§10).

### 6.3 Language

The archive serves the Red River Métis in English first. French and Michif
terms are welcome in keywords and captions where they are how people speak.
Bilingual interface text is a planned phase; until then, keep captions and
titles in English so the whole community can read them.

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

**3-2-1 rule:** three copies of every master, on two different kinds of
storage, with one copy off site. This is the durability target, not the
current state — treat it as the gap to close, and check off each copy as
it is added. (The gap register tracks it.)

- **Fix:** keep one copy in the project's normal working location, one in
  a second location (e.g. cloud), and one off site (e.g. MMF OneDrive);
  document a test-restore so a real loss is recoverable.
- **Checksums:** archive IDs are derived from filenames (deterministic),
  but full archive fixity (content hashes + verification) is a planned
  addition.
- **Exit path:** document how the archive leaves its current platform
  (export originals + settings to a local catalog) in the runbook, so the
  masters are never trapped in a proprietary system.

### 7.4 File naming

**The standard going forward (new batches only — existing filenames are
frozen and stay as they are):**

`[Submitter]_[Event or Date]_[SequenceNumber].jpg`

- **Submitter:** the person or family who provided the photo (e.g. Alfred
  Anderson, Wendy Sikora).
- **Event or Date:** the gathering it came from (e.g. `SteMadeleine2026`,
  `WinnipegRegional2026`) or the date if no event (e.g. `20260417`).
- **SequenceNumber:** for multiple related files (01, 02, ...).

Example: `AlfredAnderson_SteMadeleine2026_01.jpg`

This is the pattern already in use for recent batches (e.g.
`20260417 AlfredAnderson 39.jpg` — submitter + date + sequence). It keeps
files identifiable at a glance and groups a submitter's photos together.
Descriptions do not go in the filename; they belong in the title and
caption fields, which is where the archive is searched.

**Rules:**
- Renaming a file after ingest changes its archive ID and breaks its
  links (consent, submission, claim link). Filenames are frozen once a
  photo is ingested.
- Applies to audio files identically (matching name, .mp3).

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
