import type { Plugin } from 'vite'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const PHOTOS_DIR = path.resolve(__dirname, '../public/assets/shoebox/photos')
const MANIFEST_PATH = path.resolve(__dirname, '../public/assets/shoebox/manifest.json')
const STORIES_PATH = path.resolve(__dirname, '../public/assets/shoebox/stories.json')
const AUDIO_DIR = path.resolve(__dirname, '../public/assets/shoebox/audio')
const GENERATE_SCRIPT = path.resolve(__dirname, '../scripts/generate_manifest.js')

export function adminApi(): Plugin {
  return {
    name: 'admin-api',
    configureServer(server) {
      server.middlewares.use('/admin/api', async (req, res, next) => {
        const url = new URL(req.url || '/', `http://localhost`)
        const pathname = url.pathname

        // ── GET /admin/api/photos ──────────────────────
        if (req.method === 'GET' && pathname === '/photos') {
          try {
            const files = fs.readdirSync(PHOTOS_DIR)
              .filter(f => /\.(jpe?g|png|tiff?)$/i.test(f))
              .sort()
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ photos: files }))
          } catch (err: any) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: err.message }))
          }
          return
        }

        // ── GET /admin/api/manifest ──────────────────────
        if (req.method === 'GET' && pathname === '/manifest') {
          try {
            const data = fs.readFileSync(MANIFEST_PATH, 'utf-8')
            res.setHeader('Content-Type', 'application/json')
            res.end(data)
          } catch (err: any) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: err.message }))
          }
          return
        }

        // ── POST /admin/api/regenerate-manifest ──────────
        if (req.method === 'POST' && pathname === '/regenerate-manifest') {
          try {
            const output = execSync(`node "${GENERATE_SCRIPT}"`, {
              cwd: path.resolve(__dirname, '..'),
              encoding: 'utf-8',
              timeout: 60000,
              stdio: ['pipe', 'pipe', 'pipe'],
            })
            // Read the newly generated manifest to return stats
            const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              success: true,
              output,
              photoCount: manifest.photoCount || (manifest.photos || []).length,
            }))
          } catch (err: any) {
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = 500
            res.end(JSON.stringify({
              success: false,
              error: err.message,
              output: err.stdout || '',
              stderr: err.stderr || '',
            }))
          }
          return
        }

        // ── GET /admin/api/stories ───────────────────────
        if (req.method === 'GET' && pathname === '/stories') {
          try {
            const data = fs.readFileSync(STORIES_PATH, 'utf-8')
            res.setHeader('Content-Type', 'application/json')
            res.end(data)
          } catch (err: any) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: err.message }))
          }
          return
        }

        // ── POST /admin/api/stories ──────────────────────
        if (req.method === 'POST' && pathname === '/stories') {
          try {
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk as Buffer)
            const body = JSON.parse(Buffer.concat(chunks).toString())

            if (!Array.isArray(body.stories)) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'stories must be an array' }))
              return
            }

            fs.writeFileSync(STORIES_PATH, JSON.stringify(body.stories, null, 2) + '\n', 'utf-8')
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, count: body.stories.length }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message }))
          }
          return
        }

        // ── POST /admin/api/upload-audio ─────────────────
        if (req.method === 'POST' && pathname === '/upload-audio') {
          try {
            const filename = url.searchParams.get('filename')
            if (!filename) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'filename query param required' }))
              return
            }
            // Sanitize filename — strip path components
            const safeName = path.basename(filename)
            if (!/\.(m4a|mp3|wav|ogg)$/i.test(safeName)) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'only audio files allowed (.m4a, .mp3, .wav, .ogg)' }))
              return
            }

            const destPath = path.join(AUDIO_DIR, safeName)
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk as Buffer)
            fs.writeFileSync(destPath, Buffer.concat(chunks))

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, filename: safeName }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message }))
          }
          return
        }

 // ── POST /admin/api/deploy ───────────────────────
 if (req.method === 'POST' && pathname === '/deploy') {
 try {
 let body: any = {}
 try {
 const chunks: Buffer[] = []
 for await (const chunk of req) chunks.push(chunk as Buffer)
 body = JSON.parse(Buffer.concat(chunks).toString())
 } catch { /* no body */ }

 const message = body.message || 'admin: deploy'

 const buildOutput = execSync('npm run build', {
 cwd: path.resolve(__dirname, '..'),
 encoding: 'utf-8',
 timeout: 120000,
 stdio: ['pipe', 'pipe', 'pipe'],
 })

 execSync('git add -A', {
 cwd: path.resolve(__dirname, '..'),
 encoding: 'utf-8',
 timeout: 30000,
 })

 const commitOutput = execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
              cwd: path.resolve(__dirname, '..'),
              encoding: 'utf-8',
              timeout: 30000,
              stdio: ['pipe', 'pipe', 'pipe'],
            })

            const pushOutput = execSync('git push origin main', {
              cwd: path.resolve(__dirname, '..'),
              encoding: 'utf-8',
              timeout: 60000,
              stdio: ['pipe', 'pipe', 'pipe'],
            })

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              success: true,
              steps: {
                build: buildOutput.slice(-500),
                commit: commitOutput.trim(),
                push: pushOutput.trim(),
              },
            }))
          } catch (err: any) {
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = 500
            res.end(JSON.stringify({
              success: false,
              error: err.message,
              step: 'unknown',
              stdout: err.stdout || '',
              stderr: err.stderr || '',
            }))
          }
          return
        }

        // ── GET /admin/api/status ────────────────────────
        if (req.method === 'GET' && pathname === '/status') {
          try {
            const photoFiles = fs.readdirSync(PHOTOS_DIR).filter(f => /\.(jpe?g|png|tiff?)$/i.test(f))
            const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
            const stories = JSON.parse(fs.readFileSync(STORIES_PATH, 'utf-8'))
            const audioFiles = fs.readdirSync(AUDIO_DIR).filter(f => /\.(m4a|mp3|wav|ogg)$/i.test(f))

            let branch = 'unknown'
            let lastCommit = 'unknown'
            let gitStatus = ''
            try {
              branch = execSync('git rev-parse --abbrev-ref HEAD', {
                cwd: path.resolve(__dirname, '..'),
                encoding: 'utf-8',
              }).trim()
              lastCommit = execSync('git log -1 --oneline', {
                cwd: path.resolve(__dirname, '..'),
                encoding: 'utf-8',
              }).trim()
              gitStatus = execSync('git status --short', {
                cwd: path.resolve(__dirname, '..'),
                encoding: 'utf-8',
              }).trim()
            } catch {
              // git not available
            }

            const photos = manifest.photos || []
            const withYear = photos.filter((p: any) => p.year && p.photoYearSource !== 'scan-date').length
            const geocoded = photos.filter((p: any) => p.lat != null && p.lng != null).length
            const withPeople = photos.filter((p: any) => p.people && p.people.trim().length > 0).length
            const years = photos.map((p: any) => p.year).filter(Boolean) as number[]

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              photoCount: photoFiles.length,
              manifestPhotoCount: photos.length,
              storyCount: stories.length,
              audioCount: audioFiles.length,
              photosWithYear: withYear,
              photosGeocoded: geocoded,
              photosWithPeople: withPeople,
              yearRange: years.length > 0 ? `${Math.min(...years)}–${Math.max(...years)}` : 'N/A',
              gitBranch: branch,
              gitLastCommit: lastCommit,
              gitStatus: gitStatus || 'clean',
            }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message }))
          }
          return
        }

        // No match — pass through
        next()
      })
    },
  }
}
