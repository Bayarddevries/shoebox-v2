import { useState } from 'react'

interface PhotoPickerProps {
  photos: string[]           // all filenames in photos/
  selected: string[]         // currently linked filenames
  onChange: (files: string[]) => void
  manifestPhotos?: any[]     // manifest entries for showing metadata
}

export default function PhotoPicker({ photos, selected, onChange, manifestPhotos = [] }: PhotoPickerProps) {
  const [search, setSearch] = useState('')

  // Build a lookup from filename → manifest photo
  const byFile = new Map<string, any>()
  for (const p of manifestPhotos) {
    const fname = p.alt || p.src?.split('/').pop()
    if (fname) byFile.set(fname, p)
  }

  const filtered = search
    ? photos.filter(f => {
        const meta = byFile.get(f)
        const label = meta?.title || meta?.people || f
        return label.toLowerCase().includes(search.toLowerCase()) || f.toLowerCase().includes(search.toLowerCase())
      })
    : photos

  const toggle = (file: string) => {
    if (selected.includes(file)) {
      onChange(selected.filter(f => f !== file))
    } else {
      onChange([...selected, file])
    }
  }

  const baseUrl = '/shoebox-v2/assets/shoebox/photos/'

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search photos by name, person, or filename..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#d4c5a9] placeholder-[#666] focus:outline-none focus:border-[#8b6914]"
        />
        <span className="text-xs text-[#888] whitespace-nowrap">
          {selected.length} linked
        </span>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-64 overflow-y-auto p-1">
        {filtered.map(file => {
          const isSelected = selected.includes(file)
          const meta = byFile.get(file)
          return (
            <button
              key={file}
              type="button"
              onClick={() => toggle(file)}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                isSelected
                  ? 'border-[#8b6914] ring-2 ring-[#8b6914]/40'
                  : 'border-[#333] hover:border-[#555]'
              }`}
              title={meta?.title || meta?.people || file}
            >
              <img
                src={`${baseUrl}${encodeURIComponent(file)}`}
                alt={meta?.title || file}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {isSelected && (
                <div className="absolute inset-0 bg-[#8b6914]/30 flex items-center justify-center">
                  <span className="bg-[#8b6914] text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">✓</span>
                </div>
              )}
              {meta?.year && (
                <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-[10px] text-[#d4c5a9] text-center py-0.5">
                  {meta.year}
                </span>
              )}
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-[#666] py-4">No photos match your search</p>
        )}
      </div>
    </div>
  )
}
