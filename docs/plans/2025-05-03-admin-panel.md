# Admin Panel Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add a `#admin` route to Shoebox v2 that runs only during `npm run dev`, providing a visual UI for regenerating the photo manifest, creating/editing stories with a visual photo picker, and one-click build & deploy.

**Architecture:** A new `AdminPanel.tsx` component mounted at the `#admin` hash route. It talks to a lightweight Vite dev server plugin (`server/admin-api.ts`) that exposes REST endpoints for running the manifest generator, reading/writing `stories.json`, listing photos, and triggering `npm run build && git push`. All file I/O happens server-side; the admin UI is purely a frontend that calls these endpoints.

**Tech Stack:** React + Tailwind (existing), Vite plugin custom server middleware (new), Node `child_process` for manifest generation and git commands.

---

### Task 1: Add `#admin` route to App.tsx

**Objective:** Wire up the admin page so navigating to `#admin` renders an `AdminPanel` component (placeholder for now).

**Files:**
- Modify: `src/App.tsx` — add `'admin'` to `Page` type, detect `#admin` hash
- Modify: `src/types.ts` — add `'admin'` to `Page` union
- Create: `src/components/AdminPanel.tsx` — placeholder with "Admin Panel" heading

**Step 1: Update Page type**

In `src/types.ts`, change:
```ts
export type Page = 'home' | 'archive' | 'stories' | 'map' | 'contribute'
```
to:
```ts
export type Page = 'home' | 'archive' | 'stories' | 'map' | 'contribute' | 'admin'
```

**Step 2: Detect `#admin` in App.tsx**

In the hash-detection `useEffect` in `src/App.tsx`, add `'admin'` to the list:
```ts
if (['archive', 'map', 'stories', 'admin'].includes(hash)) {
  setCurrentPage(hash as Page)
}
```

**Step 3: Render AdminPanel in App.tsx**

Add import and conditional render:
```tsx
import AdminPanel from './components/AdminPanel'
// ...
{currentPage === 'admin' && <AdminPanel />}
```

**Step 4: Create placeholder AdminPanel**

`src/components/AdminPanel.tsx`:
```tsx
export default function AdminPanel() {
  return (
    <div className="max-w-6xl mx-auto py-12 px-6">
      <h1 className="text-4xl font-serif mb-4" style={{ color: 'var(--color-crimson)' }}>
        Admin Panel
      </h1>
      <p className="text-sm" style={{ color: 'var(--color-charcoal-light)' }}>
        Manage photos, stories, and deployments.
      </p>
    </div>
  )
}
```

**Step 5: Verify**

Run `npm run dev`, navigate to `http://localhost:5173/shoebox-v2/#admin`, confirm "Admin Panel" heading appears. Also confirm it does NOT appear in production build (no nav link to it).

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add #admin route with placeholder component"
```

---

### Task 2: Create Vite dev server plugin with admin API endpoints

**Objective:** Add a Vite plugin that registers REST endpoints during `npm run dev` only. These endpoints will be called by the admin UI.

**Files:**
- Create: `server/admin-api.ts` — Vite plugin with configureServer hook
- Modify: `vite.config.ts` — import and register the plugin

**Step 1: Create the plugin**

`server/admin-api.ts`:
```ts
import type { Plugin } from 'vite'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const PROJECT_ROOT = path.resolve(__dirname, '..')
const PHOTOS_DIR = path.join(PROJECT_ROOT, 'public/assets/shoebox/photos')
const MANIFEST_PATH = path.join(PROJECT_ROOT, 'public/assets/shoebox/manifest.json')
const STORIES_PATH = path.join(PROJECT_ROOT, 'public/assets/shoebox/stories.json')
const AUDIO_DIR = path.join(PROJECT_ROOT, 'public/assets/shoebox/audio')

export function adminApi(): Plugin {
  return {
    name: 'admin-api',
    configureServer(server) {
      server.middlewares.use('/admin/api', (req, res, next) => {
        // CORS for dev
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Content-Type', 'application/json')

        const url = new URL(req.url || '/', `http://localhost`)

        // GET /admin/api/photos — list all photo filenames
        if (req.method === 'GET' && url.pathname === '/photos') {
          const files = fs.readdirSync(PHOTOS_DIR)
            .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
            .sort()
          res.end(JSON.stringify({ photos: files }))
          return
        }

        // POST /admin/api/regenerate-manifest — run the manifest generator
        if (req.method === 'POST' && url.pathname === '/regenerate-manifest') {
          try {
            const output = execSync('node scripts/generate_manifest.js', {
              cwd: PROJECT_ROOT,
              encoding: 'utf8',
              timeout: 120000,
            })
            const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
            res.end(JSON.stringify({ success: true, output, photoCount: manifest.photoCount }))
          } catch (e: any) {
            res.statusCode = 500
            res.end(JSON.stringify({ success: false, error: e.message }))
          }
          return
        }

        // GET /admin/api/stories — read stories.json
        if (req.method === 'GET' && url.pathname === '/stories') {
          const stories = fs.existsSync(STORIES_PATH)
            ? JSON.parse(fs.readFileSync(STORIES_PATH, 'utf8'))
            : []
          res.end(JSON.stringify({ stories }))
          return
        }

        // POST /admin/api/stories — write stories.json
        if (req.method === 'POST' && url.pathname === '/stories') {
          let body = ''
          req.on('data', chunk => { body += chunk })
          req.on('end', () => {
            try {
              const data = JSON.parse(body)
              fs.writeFileSync(STORIES_PATH, JSON.stringify(data.stories, null, 2))
              res.end(JSON.stringify({ success: true }))
            } catch (e: any) {
              res.statusCode = 500
              res.end(JSON.stringify({ success: false, error: e.message }))
            }
          })
          return
        }

        // POST /admin/api/upload-audio — save an audio file
        if (req.method === 'POST' && url.pathname === '/upload-audio') {
          let body = Buffer.alloc(0)
          const filename = url.searchParams.get('filename') || 'upload.m4a'
          req.on('data', chunk => { body = Buffer.concat([body, chunk]) })
          req.on('end', () => {
            fs.mkdirSync(AUDIO_DIR, { recursive: true })
            fs.writeFileSync(path.join(AUDIO_DIR, filename), body)
            res.end(JSON.stringify({ success: true, filename }))
          })
          return
        }

        // POST /admin/api/deploy — build and push
        if (req.method === 'POST' && url.pathname === '/deploy') {
          try {
            const buildOutput = execSync('npm run build', {
              cwd: PROJECT_ROOT,
              encoding: 'utf8',
              timeout: 120000,
            })
            execSync('git add -A && git commit -m "admin: deploy from admin panel" && git push', {
              cwd: PROJECT_ROOT,
              encoding: 'utf8',
              timeout: 60000,
            })
            res.end(JSON.stringify({ success: true }))
          } catch (e: any) {
            res.statusCode = 500
            res.end(JSON.stringify({ success: false, error: e.message }))
          }
          return
        }

        next()
      })
    },
  }
}
```

**Step 2: Register in vite.config.ts**

```ts
import { adminApi } from './server/admin-api'

export default defineConfig({
  plugins: [react(), tailwindcss(), adminApi()],
  // ... rest unchanged
})
```

**Step 3: Verify**

Run `npm run dev`, then `curl http://localhost:5173/admin/api/photos | head`. Confirm JSON list of filenames returns.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add Vite dev server plugin with admin API endpoints"
```

---

### Task 3: Build the Manifest Management section of AdminPanel

**Objective:** A "Regenerate Manifest" button that calls the API, shows a spinner while running, then displays the results (photo count, stats).

**Files:**
- Modify: `src/components/AdminPanel.tsx`

**Step 1: Add state and fetch call**

Add React state for manifest status and a handler:
```tsx
const [manifestStatus, setManifestStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
const [manifestResult, setManifestResult] = useState<any>(null)

const regenerateManifest = async () => {
  setManifestStatus('running')
  try {
    const res = await fetch('/admin/api/regenerate-manifest', { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      setManifestStatus('done')
      setManifestResult(data)
    } else {
      setManifestStatus('error')
      setManifestResult(data)
    }
  } catch (e: any) {
    setManifestStatus('error')
    setManifestResult({ error: e.message })
  }
}
```

**Step 2: Add UI section**

Add a card-style section with the button and result display. Show photoCount on success, error message on failure.

**Step 3: Verify**

Run dev server, click "Regenerate Manifest" in admin panel, confirm it shows the photo count.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: admin manifest regeneration with status display"
```

---

### Task 4: Build the Story Editor section of AdminPanel

**Objective:** A form to create/edit stories with title, text, audio upload, and a visual photo picker that shows thumbnails.

**Files:**
- Modify: `src/components/AdminPanel.tsx` — story editor UI
- Create: `src/components/PhotoPicker.tsx` — reusable photo thumbnail picker

**Step 1: PhotoPicker component**

A grid of photo thumbnails. Click to toggle selection. Shows a checkmark overlay on selected photos. Props: `photos` (filename list), `selected` (Set of filenames), `onToggle(filename)`.

Loads thumbnail images from the Vite dev server's static file serving of `public/`.

**Step 2: Story editor state**

```tsx
const [stories, setStories] = useState<any[]>([])
const [editingStory, setEditingStory] = useState<any | null>(null)
const [photoList, setPhotoList] = useState<string[]>([])
const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
```

**Step 3: Load stories + photo list on mount**

Fetch from `/admin/api/stories` and `/admin/api/photos`.

**Step 4: Story form**

Fields: title (text input), text (textarea), audio file (file input → POST to `/admin/api/upload-audio`), linked photos (PhotoPicker).

Save button POSTs the full stories array to `/admin/api/stories`.

**Step 5: Story list**

Show existing stories as cards with edit/delete buttons.

**Step 6: Verify**

Create a test story, link photos, save. Confirm `stories.json` updates on disk. Delete the test story.

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: admin story editor with visual photo picker"
```

---

### Task 5: Build & Deploy button

**Objective:** A "Build & Deploy" button that triggers `npm run build && git add -A && git commit && git push` via the API.

**Files:**
- Modify: `src/components/AdminPanel.tsx`

**Step 1: Add deploy button and state**

```tsx
const [deployStatus, setDeployStatus] = useState<'idle' | 'building' | 'pushing' | 'done' | 'error'>('idle')
```

**Step 2: Deploy handler**

Calls `/admin/api/deploy`, shows progress states.

**Step 3: Verify**

Click deploy, confirm it builds and pushes. Check GitHub Actions for deploy.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: admin one-click build & deploy"
```

---

### Task 6: Polish and guard rails

**Objective:** Add confirmation dialogs, error handling, and ensure the admin panel is inaccessible in production.

**Files:**
- Modify: `src/components/AdminPanel.tsx` — add confirmation for deploy/delete
- Modify: `src/App.tsx` — hide admin from navbar (already no link, but add a comment)

**Step 1: Confirmation dialogs**

- Deploy: "This will build and push to GitHub. Continue?"
- Delete story: "Delete this story?"

**Step 2: Production guard**

The admin API plugin only runs during `configureServer` (dev mode). In production, `/admin/api/*` returns 404, so the panel gracefully degrades. Add a check in AdminPanel: if first API call fails, show "Admin panel is only available in development mode."

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: admin guard rails and confirmation dialogs"
```

