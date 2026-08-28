import { useState } from 'react'
import type { ClaimText } from '../claimText'

interface MetadataFormProps {
  photoId: number
  submitterToken: string
  onSubmit: (data: any) => void
  isCompleted?: boolean
  formText: ClaimText['form']
}

export default function MetadataForm({ photoId: _pid,
 submitterToken: _tok,
 onSubmit, isCompleted, formText: t }: MetadataFormProps) {
  const [people, setPeople] = useState('')
  const [dateYear, setDateYear] = useState('')
  const [dateEra, setDateEra] = useState('')
  const [location, setLocation] = useState('')
  const [community, setCommunity] = useState('')
  const [occasion, setOccasion] = useState('')
  const [story, setStory] = useState('')
  const [caption, setCaption] = useState('')
  const [attribution, setAttribution] = useState(t.defaultAttribution)
  const [keywords, setKeywords] = useState('')
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!consent) {
      alert(t.consentAlert)
      return
    }
    setSubmitting(true)
    try {
      onSubmit({ people, dateYear, dateEra, location, community, province: 'Manitoba', country: 'Canada', occasion, story, caption, attribution, keywords, consent })
    } finally {
      setSubmitting(false)
    }
  }

  if (isCompleted) {
    return (
      <div className="p-6 rounded-lg bg-green-50 border border-green-200 text-green-800">
        <h3 className="font-serif text-lg">{t.completedHeading}</h3>
        <p className="text-sm">{t.completedNote}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-5">
      <h2 className="font-serif text-xl" style={{ color: 'var(--color-crimson)' }}>{t.heading}</h2>
      <p className="text-sm" style={{ color: 'var(--color-charcoal-light)' }}>{t.note}</p>

      <div>
        <label htmlFor="people" className="block text-sm font-medium mb-1">{t.labels.people}</label>
        <textarea id="people" value={people} onChange={e => setPeople(e.target.value)} rows={2} className="search-input w-full" placeholder={t.placeholders.people} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="dateYear" className="block text-sm font-medium mb-1">{t.labels.dateYear}</label>
          <input id="dateYear" value={dateYear} onChange={e => setDateYear(e.target.value)} className="search-input w-full" placeholder={t.placeholders.dateYear} />
        </div>
        <div>
          <label htmlFor="dateEra" className="block text-sm font-medium mb-1">{t.labels.dateEra}</label>
          <input id="dateEra" value={dateEra} onChange={e => setDateEra(e.target.value)} className="search-input w-full" placeholder={t.placeholders.dateEra} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="location" className="block text-sm font-medium mb-1">{t.labels.location}</label>
          <input id="location" value={location} onChange={e => setLocation(e.target.value)} className="search-input w-full" placeholder={t.placeholders.location} />
        </div>
        <div>
          <label htmlFor="community" className="block text-sm font-medium mb-1">{t.labels.community}</label>
          <input id="community" value={community} onChange={e => setCommunity(e.target.value)} className="search-input w-full" placeholder={t.placeholders.community} />
        </div>
      </div>

      <div>
        <label htmlFor="occasion" className="block text-sm font-medium mb-1">{t.labels.occasion}</label>
        <input id="occasion" value={occasion} onChange={e => setOccasion(e.target.value)} className="search-input w-full" placeholder={t.placeholders.occasion} />
      </div>

      <div>
        <label htmlFor="story" className="block text-sm font-medium mb-1">{t.labels.story}</label>
        <textarea id="story" value={story} onChange={e => setStory(e.target.value)} rows={4} className="search-input w-full" placeholder={t.placeholders.story} />
      </div>

      <div>
        <label htmlFor="caption" className="block text-sm font-medium mb-1">{t.labels.caption}</label>
        <input id="caption" value={caption} onChange={e => setCaption(e.target.value)} className="search-input w-full" placeholder={t.placeholders.caption} />
      </div>

      <div>
        <label htmlFor="attribution" className="block text-sm font-medium mb-1">{t.labels.attribution}</label>
        <input id="attribution" value={attribution} onChange={e => setAttribution(e.target.value)} className="search-input w-full" />
      </div>

      <div>
        <label htmlFor="keywords" className="block text-sm font-medium mb-1">{t.labels.keywords}</label>
        <input id="keywords" value={keywords} onChange={e => setKeywords(e.target.value)} className="search-input w-full" placeholder={t.placeholders.keywords} />
      </div>

      <div className="p-4 rounded bg-cream" style={{ background: 'var(--color-cream)' }}>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" />
          <span className="text-sm">{t.consentLabel}</span>
        </label>
      </div>

      <button type="submit" className="btn-primary w-full">{t.saveButton}</button>
    </form>
  )
}
