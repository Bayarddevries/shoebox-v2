import { useState, useEffect, useCallback } from 'react'
import type { Page } from '../types'
import PhotoPicker from './PhotoPicker'

// ── Types ──────────────────────────────────────
interface Status {
  photoCount: number
  manifestPhotoCount: number
  storyCount: number
  audioCount: number
  photosWithYear: number
  photosGeocoded: number
  photosWithPeople: number
  yearRange: string
  gitBranch: string
  gitLastCommit: string
  gitStatus: string
}

interface Story {
  id: string
  title: string
  text_file?: string
  audio_file?: string
  photo_files: string[]
}

type DeployStep = 'idle' | 'building' | 'committing' | 'pushing' | 'done' | 'error'

// ── API helper ──────────────────────────────────
const API = (path: string, opts?: RequestInit) =>
  fetch(`/admin/api${path}`, opts).then(r => {
    if (!r.ok) return r.json().then(e => Promise.reject(e))
    return r.json()
  })

// ── Component ───────────────────────────────────
interface Props {
  onNavigate: (page: Page) => void
}

export default function AdminPanel({ onNavigate }: Props) {
  // ── State ───────────────────────────────────
  const [isDev, setIsDev] = useState(true)
  const [status, setStatus] = useState<Status | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)

  // Manifest
  const [regenLoading, setRegenLoading] = useState(false)
  const [regenResult, setRegenResult] = useState<{ success: boolean; output?: string; error?: string } | null>(null)

  // Stories
  const [stories, setStories] = useState<Story[]>([])
  const [allPhotos, setAllPhotos] = useState<string[]>([])
  const [manifestPhotos, setManifestPhotos] = useState<any[]>([])
  const [editingStory, setEditingStory] = useState<Story | null>(null)
  const [isNewStory, setIsNewStory] = useState(false)
  const [saveResult, setSaveResult] = useState<string | null>(null)

  // Deploy
  const [deployStep, setDeployStep] = useState<DeployStep>('idle')
  const [deployError, setDeployError] = useState<string | null>(null)
  const [commitMessage, setCommitMessage] = useState('admin: update content')

  // ── Load status ──────────────────────────────
  const loadStatus = useCallback(async () => {
    setStatusLoading(true)
    try {
      const data = await API('/status')
      setStatus(data)
      setIsDev(true)
    } catch {
      setIsDev(false)
    } finally {
      setStatusLoading(false)
    }
  }, [])

  const loadStories = useCallback(async () => {
    try {
      const [storiesData, photosData, manifestData] = await Promise.all([
        API('/stories'),
        API('/photos'),
        API('/manifest'),
      ])
      setStories(Array.isArray(storiesData) ? storiesData : [])
      setAllPhotos(photosData.photos || [])
      setManifestPhotos(manifestData.photos || [])
    } catch {
      // Will show on UI
    }
  }, [])

  useEffect(() => { loadStatus(); loadStories() }, [loadStatus, loadStories])

  // ── Handlers ─────────────────────────────────
  const regenerateManifest = async () => {
    setRegenLoading(true)
    setRegenResult(null)
    try {
      const result = await API('/regenerate-manifest', { method: 'POST' })
      setRegenResult(result)
      loadStatus()
      loadStories()
    } catch (err: any) {
      setRegenResult({ success: false, error: err.error || 'Unknown error' })
    } finally {
      setRegenLoading(false)
    }
  }

  const saveStories = async (updated: Story[]) => {
    try {
      await API('/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stories: updated }),
      })
      setStories(updated)
      setSaveResult('✓ Saved')
      setTimeout(() => setSaveResult(null), 2000)
    } catch (err: any) {
      setSaveResult(`✗ ${err.error || 'Save failed'}`)
    }
  }

  const uploadAudio = async (file: File): Promise<string | null> => {
    try {
      const result = await API(`/upload-audio?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: file,
      })
      return result.filename
    } catch {
      return null
    }
  }

  const handleSaveStory = async (story: Story) => {
    let updated: Story[]
    if (isNewStory) {
      const newId = `story_${story.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30)}_${Date.now()}`
      const newStory = { ...story, id: newId }
      updated = [...stories, newStory]
    } else {
      updated = stories.map(s => s.id === story.id ? story : s)
    }
    await saveStories(updated)
    setEditingStory(null)
    setIsNewStory(false)
    loadStatus()
  }

  const handleDeleteStory = async (id: string) => {
    if (!confirm('Delete this story permanently?')) return
    const updated = stories.filter(s => s.id !== id)
    await saveStories(updated)
    loadStatus()
  }

  const handleDeploy = async () => {
    if (!confirm(`Build and deploy to GitHub Pages?\n\nCommit message: "${commitMessage}"`)) return
    setDeployStep('building')
    setDeployError(null)
    try {
      // We'll do this step-by-step for better UX
      // The server endpoint does it all at once, but we can simulate steps
 setDeployStep('building')
 await API('/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commitMessage }),
      })
      setDeployStep('done')
      loadStatus()
    } catch (err: any) {
      setDeployStep('error')
      setDeployError(err.error || err.stderr || 'Deploy failed')
    }
  }

  // ── Production guard ─────────────────────────
  if (!isDev && !statusLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-4">
          <div className="text-5xl">🔒</div>
          <h2 className="text-xl font-semibold text-[#d4c5a9]">Dev Mode Only</h2>
          <p className="text-[#888] text-sm leading-relaxed">
            The admin dashboard is only available when running the app locally with
            <code className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-[#8b6914]"> npm run dev</code>.
            Start the dev server and navigate to
            <code className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-[#8b6914]"> #admin</code> to
            manage your photos, stories, and deployments.
          </p>
          <button
            onClick={() => onNavigate('home')}
            className="text-[#8b6914] hover:underline text-sm"
          >
            ← Back to archive
          </button>
        </div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* ── Header ──────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#d4c5a9] font-serif">Admin Dashboard</h1>
            <p className="text-sm text-[#888] mt-1">
              Manage photos, stories, and deployments for the Shoebox archive.
              This page only works during local development.
            </p>
          </div>
          <button
            onClick={() => onNavigate('home')}
            className="text-sm text-[#8b6914] hover:underline"
          >
            ← Back to archive
          </button>
        </div>

        {/* ── Status Bar ──────────────────────── */}
        {status && (
          <div className="bg-[#111] border border-[#222] rounded-xl p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <Stat label="Photos on disk" value={status.photoCount} />
              <Stat label="In manifest" value={status.manifestPhotoCount} />
              <Stat label="Stories" value={status.storyCount} />
              <Stat label="Audio files" value={status.audioCount} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center mt-3 pt-3 border-t border-[#222]">
              <Stat label="With year data" value={status.photosWithYear} sub={`${Math.round(status.photosWithYear / Math.max(status.manifestPhotoCount, 1) * 100)}%`} />
              <Stat label="Geocoded" value={status.photosGeocoded} sub={`${Math.round(status.photosGeocoded / Math.max(status.manifestPhotoCount, 1) * 100)}%`} />
              <Stat label="With people" value={status.photosWithPeople} />
              <Stat label="Year range" value={status.yearRange} />
            </div>
            <div className="mt-3 pt-3 border-t border-[#222] flex flex-wrap items-center gap-4 text-xs text-[#666]">
              <span>🌿 {status.gitBranch}</span>
              <span>📝 {status.gitLastCommit}</span>
              <span className={status.gitStatus !== 'clean' ? 'text-[#c08040]' : 'text-[#5a5]'}>
                {status.gitStatus !== 'clean' ? `⚠ Uncommitted changes (${status.gitStatus.split('\n').length})` : '✓ Clean working tree'}
              </span>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════ */}
        {/* ── PHOTO MANIFEST SECTION ────────────── */}
        {/* ════════════════════════════════════════ */}
        <Section
          icon="📸"
          title="Photo Manifest"
          description="After exporting photos from Lightroom to the photos/ folder, regenerate the manifest to pick up new metadata (years, people, locations, keywords). The manifest generator reads IPTC data via exiftool."
        >
          <div className="space-y-3">
            <button
              onClick={regenerateManifest}
              disabled={regenLoading}
              className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
                regenLoading
                  ? 'bg-[#333] text-[#666] cursor-wait'
                  : 'bg-[#8b6914] text-white hover:bg-[#a07a18] active:scale-95'
              }`}
            >
              {regenLoading ? '⏳ Scanning photos...' : '🔄 Regenerate Manifest'}
            </button>

            {regenResult && (
              <div className={`p-3 rounded-lg text-sm ${
                regenResult.success
                  ? 'bg-[#1a2a1a] border border-[#2a4a2a] text-[#5a5]'
                  : 'bg-[#2a1a1a] border border-[#4a2a2a] text-[#c55]'
              }`}>
                {regenResult.success
                  ? `✓ Manifest regenerated — ${regenResult.output?.trim().split('\n').pop() || 'done'}`
                  : `✗ ${regenResult.error}`
                }
              </div>
            )}

            <div className="text-xs text-[#555] space-y-1">
              <p><strong className="text-[#888]">Workflow:</strong></p>
              <ol className="list-decimal list-inside space-y-0.5 ml-2">
                <li>Tag photos in Lightroom with IPTC metadata (people keywords, year keywords, city/province, captions)</li>
                <li>Export JPGs to <code className="bg-[#1a1a1a] px-1 rounded text-[#8b6914]">public/assets/shoebox/photos/</code></li>
                <li>Click "Regenerate Manifest" above — it runs <code className="bg-[#1a1a1a] px-1 rounded text-[#8b6914]">generate_manifest.js</code> which calls exiftool on every photo</li>
                <li>New photos appear in the archive immediately. If a community isn't geocoded, add it to the <code className="bg-[#1a1a1a] px-1 rounded text-[#8b6914]">GEOCODE_TABLE</code> in the script.</li>
              </ol>
            </div>
          </div>
        </Section>

        {/* ════════════════════════════════════════ */}
        {/* ── STORIES SECTION ───────────────────── */}
        {/* ════════════════════════════════════════ */}
        <Section
          icon="📖"
          title="Stories"
          description="Create and edit oral history stories. Link photos to stories by clicking thumbnails — no need to type filenames. Audio files are uploaded directly and saved to the audio/ folder."
        >
          <div className="space-y-4">
            {/* Story list */}
            <div className="space-y-2">
              {stories.map(story => (
                <div
                  key={story.id}
                  className="flex items-center justify-between bg-[#111] border border-[#222] rounded-lg p-3"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[#d4c5a9] font-medium truncate">{story.title}</h4>
                    <div className="flex gap-3 text-xs text-[#666] mt-1">
                      {story.audio_file && <span>🎵 {story.audio_file}</span>}
                      <span>📷 {story.photo_files.length} photo{story.photo_files.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <button
                      onClick={() => { setEditingStory({ ...story }); setIsNewStory(false) }}
                      className="px-3 py-1.5 text-xs rounded bg-[#222] text-[#aaa] hover:bg-[#333] hover:text-white transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteStory(story.id)}
                      className="px-3 py-1.5 text-xs rounded bg-[#2a1a1a] text-[#c55] hover:bg-[#4a2a2a] transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {stories.length === 0 && (
                <p className="text-[#666] text-sm py-4 text-center">No stories yet. Create one below.</p>
              )}
            </div>

            {/* Add story button */}
            {!editingStory && (
              <button
                onClick={() => {
                  setEditingStory({ id: '', title: '', text_file: '', audio_file: '', photo_files: [] })
                  setIsNewStory(true)
                }}
                className="w-full py-3 rounded-lg border-2 border-dashed border-[#333] text-[#888] hover:border-[#8b6914] hover:text-[#8b6914] transition-colors text-sm"
              >
                + New Story
              </button>
            )}

            {/* Story editor */}
            {editingStory && (
              <StoryEditor
                story={editingStory}
                isNew={isNewStory}
                allPhotos={allPhotos}
                manifestPhotos={manifestPhotos}
                onSave={handleSaveStory}
                onCancel={() => { setEditingStory(null); setIsNewStory(false) }}
                onUploadAudio={uploadAudio}
              />
            )}

            {saveResult && (
              <div className={`text-sm px-3 py-2 rounded-lg ${
                saveResult.startsWith('✓')
                  ? 'bg-[#1a2a1a] text-[#5a5]'
                  : 'bg-[#2a1a1a] text-[#c55]'
              }`}>
                {saveResult}
              </div>
            )}
          </div>
        </Section>

        {/* ════════════════════════════════════════ */}
        {/* ── DEPLOY SECTION ────────────────────── */}
        {/* ════════════════════════════════════════ */}
        <Section
          icon="🚀"
          title="Build & Deploy"
          description="Build the site and push to GitHub. GitHub Pages will auto-deploy from the main branch. Changes typically appear within 1–2 minutes."
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={commitMessage}
                onChange={e => setCommitMessage(e.target.value)}
                placeholder="Commit message..."
                className="flex-1 bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#d4c5a9] placeholder-[#666] focus:outline-none focus:border-[#8b6914]"
              />
              <button
                onClick={handleDeploy}
                disabled={deployStep === 'building' || deployStep === 'committing' || deployStep === 'pushing'}
                className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
                  deployStep === 'building' || deployStep === 'committing' || deployStep === 'pushing'
                    ? 'bg-[#333] text-[#666] cursor-wait'
                    : deployStep === 'done'
                    ? 'bg-[#2a4a2a] text-[#5a5]'
                    : 'bg-[#8b6914] text-white hover:bg-[#a07a18] active:scale-95'
                }`}
              >
                {deployStep === 'idle' && '🚀 Build & Push'}
                {deployStep === 'building' && '⏳ Building...'}
                {deployStep === 'committing' && '⏳ Committing...'}
                {deployStep === 'pushing' && '⏳ Pushing...'}
                {deployStep === 'done' && '✓ Deployed!'}
                {deployStep === 'error' && '✗ Failed — Retry?'}
              </button>
            </div>

            {deployStep === 'done' && (
              <div className="p-3 rounded-lg bg-[#1a2a1a] border border-[#2a4a2a] text-sm text-[#5a5]">
                ✓ Built and pushed to GitHub. Your changes will appear at
                <a href="https://bayarddevries.github.io/shoebox-v2/" target="_blank" rel="noopener"
                   className="text-[#8b6914] hover:underline ml-1">
                  bayarddevries.github.io/shoebox-v2
                </a>
                within 1–2 minutes.
              </div>
            )}

            {deployStep === 'error' && deployError && (
              <div className="p-3 rounded-lg bg-[#2a1a1a] border border-[#4a2a2a] text-sm text-[#c55]">
                <p className="font-medium">Deploy failed:</p>
                <pre className="mt-1 text-xs overflow-x-auto whitespace-pre-wrap text-[#a55]">{deployError}</pre>
              </div>
            )}

            <div className="text-xs text-[#555] space-y-1">
              <p><strong className="text-[#888]">What happens:</strong></p>
              <ol className="list-decimal list-inside space-y-0.5 ml-2">
                <li><code className="bg-[#1a1a1a] px-1 rounded text-[#8b6914]">npm run build</code> — Vite builds the production bundle</li>
                <li><code className="bg-[#1a1a1a] px-1 rounded text-[#8b6914]">git add -A && git commit</code> — stages all changes and commits</li>
                <li><code className="bg-[#1a1a1a] px-1 rounded text-[#8b6914]">git push origin main</code> — pushes to GitHub</li>
                <li>GitHub Pages rebuilds and publishes — live in ~90 seconds</li>
              </ol>
            </div>
          </div>
        </Section>

        {/* ── Footer ──────────────────────────── */}
        <div className="text-center text-xs text-[#444] pt-4 border-t border-[#1a1a1a]">
          Shoebox Admin • Dev mode only • Changes are written directly to your local project files
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────

function Section({ icon, title, description, children }: {
  icon: string; title: string; description: string; children: React.ReactNode
}) {
  return (
    <section className="bg-[#0e0e0e] border border-[#222] rounded-xl p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[#d4c5a9] flex items-center gap-2">
          <span>{icon}</span> {title}
        </h2>
        <p className="text-sm text-[#777] mt-1 leading-relaxed">{description}</p>
      </div>
      {children}
    </section>
  )
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div>
      <div className="text-xl font-bold text-[#d4c5a9]">
        {value}
        {sub && <span className="text-xs text-[#888] font-normal ml-1">({sub})</span>}
      </div>
      <div className="text-xs text-[#666] mt-0.5">{label}</div>
    </div>
  )
}

function StoryEditor({ story, isNew, allPhotos, manifestPhotos, onSave, onCancel, onUploadAudio }: {
  story: Story
  isNew: boolean
  allPhotos: string[]
  manifestPhotos: any[]
  onSave: (story: Story) => void
  onCancel: () => void
  onUploadAudio: (file: File) => Promise<string | null>
}) {
  const [form, setForm] = useState<Story>({ ...story })
  const [audioUploading, setAudioUploading] = useState(false)
  const [audioFile, setAudioFile] = useState<File | null>(null)

  const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAudioFile(file)
  }

  const handleSave = async () => {
    if (!form.title.trim()) {
      alert('Story title is required')
      return
    }

    let audioFilename = form.audio_file
    if (audioFile) {
      setAudioUploading(true)
      const uploaded = await onUploadAudio(audioFile)
      if (uploaded) audioFilename = uploaded
      setAudioUploading(false)
    }

    onSave({ ...form, audio_file: audioFilename })
  }

  return (
    <div className="bg-[#111] border border-[#333] rounded-lg p-4 space-y-4">
      <h3 className="text-[#d4c5a9] font-medium">
        {isNew ? '✨ New Story' : `✏️ Editing: ${story.title}`}
      </h3>

      {/* Title */}
      <div>
        <label className="block text-xs text-[#888] mb-1">Title *</label>
        <input
          type="text"
          value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })}
          className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#d4c5a9] focus:outline-none focus:border-[#8b6914]"
          placeholder="e.g. Mabel's Story"
        />
      </div>

      {/* Text file reference */}
      <div>
        <label className="block text-xs text-[#888] mb-1">Text file <span className="text-[#555]">(optional — filename in the stories folder)</span></label>
        <input
          type="text"
          value={form.text_file || ''}
          onChange={e => setForm({ ...form, text_file: e.target.value })}
          className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#d4c5a9] focus:outline-none focus:border-[#8b6914]"
          placeholder="e.g. Mabel's story.txt"
        />
      </div>

      {/* Audio upload */}
      <div>
        <label className="block text-xs text-[#888] mb-1">Audio file</label>
        {form.audio_file && !audioFile && (
          <p className="text-xs text-[#8b6914] mb-2">🎵 Currently: {form.audio_file}</p>
        )}
        <input
          type="file"
          accept=".m4a,.mp3,.wav,.ogg"
          onChange={handleAudioSelect}
          className="block w-full text-sm text-[#888] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-[#222] file:text-[#aaa] hover:file:bg-[#333] file:cursor-pointer"
        />
        {audioFile && (
          <p className="text-xs text-[#5a5] mt-1">Ready to upload: {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(1)} MB)</p>
        )}
      </div>

      {/* Photo picker */}
      <div>
        <label className="block text-xs text-[#888] mb-2">Linked Photos <span className="text-[#555]">(click thumbnails to link/unlink)</span></label>
        <PhotoPicker
          photos={allPhotos}
          selected={form.photo_files}
          onChange={files => setForm({ ...form, photo_files: files })}
          manifestPhotos={manifestPhotos}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={audioUploading || !form.title.trim()}
          className="px-5 py-2 rounded-lg bg-[#8b6914] text-white text-sm font-medium hover:bg-[#a07a18] disabled:bg-[#333] disabled:text-[#666] transition-colors"
        >
          {audioUploading ? '⏳ Uploading audio...' : '💾 Save Story'}
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2 rounded-lg bg-[#222] text-[#888] text-sm hover:bg-[#333] hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
