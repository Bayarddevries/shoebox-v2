import { useState } from 'react'

interface MetadataFormProps {
  photoId: number
  submitterToken: string
  onSubmit: (data: any) => void
  isCompleted?: boolean
}

export default function MetadataForm({ photoId: _pid,
 submitterToken: _tok,
 onSubmit, isCompleted }: MetadataFormProps) {
  const [people, setPeople] = useState('')
  const [dateYear, setDateYear] = useState('')
  const [dateEra, setDateEra] = useState('')
  const [location, setLocation] = useState('')
  const [community, setCommunity] = useState('')
  const [occasion, setOccasion] = useState('')
  const [story, setStory] = useState('')
  const [caption, setCaption] = useState('')
  const [attribution, setAttribution] = useState('Courtesy of the Family Collection')
  const [keywords, setKeywords] = useState('')
  const [consent, setConsent] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!consent) {
      alert('Please confirm you completed the photo consent form before submitting.')
      return
    }
    onSubmit({ people, dateYear, dateEra, location, community, province: 'Manitoba', country: 'Canada', occasion, story, caption, attribution, keywords, consent })
  }

  if (isCompleted) {
    return (
      <div className="p-6 rounded-lg bg-green-50 border border-green-200 text-green-800">
        <h3 className="font-serif text-lg">✓ Information added</h3>
        <p className="text-sm">Thank you for describing this photo.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-5">
      <h2 className="font-serif text-xl" style={{ color: 'var(--color-crimson)' }}>Describe this photo</h2>

      <div>
        <label htmlFor="people" className="block text-sm font-medium mb-1">People (left to right)</label>
        <textarea id="people" value={people} onChange={e => setPeople(e.target.value)} rows={2} className="search-input w-full" placeholder="Name + relation (e.g., Margaret Lapointe, mother)" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="dateYear" className="block text-sm font-medium mb-1">Approx. year</label>
          <input id="dateYear" value={dateYear} onChange={e => setDateYear(e.target.value)} className="search-input w-full" placeholder="1945" />
        </div>
        <div>
          <label htmlFor="dateEra" className="block text-sm font-medium mb-1">Era</label>
          <input id="dateEra" value={dateEra} onChange={e => setDateEra(e.target.value)} className="search-input w-full" placeholder="mid-1900s" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="location" className="block text-sm font-medium mb-1">Location (town / community)</label>
          <input id="location" value={location} onChange={e => setLocation(e.target.value)} className="search-input w-full" placeholder="Winnipeg, Manitoba" />
        </div>
        <div>
          <label htmlFor="community" className="block text-sm font-medium mb-1">Community</label>
          <input id="community" value={community} onChange={e => setCommunity(e.target.value)} className="search-input w-full" placeholder="Community name" />
        </div>
      </div>

      <div>
        <label htmlFor="occasion" className="block text-sm font-medium mb-1">Occasion or event</label>
        <input id="occasion" value={occasion} onChange={e => setOccasion(e.target.value)} className="search-input w-full" placeholder="Family reunion, harvest, birthday" />
      </div>

      <div>
        <label htmlFor="story" className="block text-sm font-medium mb-1">Tell the story</label>
        <textarea id="story" value={story} onChange={e => setStory(e.target.value)} rows={4} className="search-input w-full" placeholder="What's happening in this photo? Who is everyone? Why does it matter?" />
      </div>

      <div>
        <label htmlFor="caption" className="block text-sm font-medium mb-1">Caption (optional)</label>
        <input id="caption" value={caption} onChange={e => setCaption(e.target.value)} className="search-input w-full" placeholder="Short description of the photo" />
      </div>

      <div>
        <label htmlFor="attribution" className="block text-sm font-medium mb-1">Attribution</label>
        <input id="attribution" value={attribution} onChange={e => setAttribution(e.target.value)} className="search-input w-full" />
      </div>

      <div>
        <label htmlFor="keywords" className="block text-sm font-medium mb-1">Keywords (optional, comma-separated)</label>
        <input id="keywords" value={keywords} onChange={e => setKeywords(e.target.value)} className="search-input w-full" placeholder="family, 1945, wedding" />
      </div>

      <div className="p-4 rounded bg-cream" style={{ background: 'var(--color-cream)' }}>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" />
          <span className="text-sm">I confirm I completed the photo consent form, giving permission to scan and archive this image.</span>
        </label>
      </div>

      <button type="submit" className="btn-primary w-full">Save this photo</button>
    </form>
  )
}
