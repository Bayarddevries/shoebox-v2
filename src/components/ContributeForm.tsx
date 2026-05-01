interface ContributeFormProps {
  onClose: () => void
}

export default function ContributeForm({ onClose }: ContributeFormProps) {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    
    // Web3Forms submission
    const formData = new FormData(form)
    formData.append('access_key', 'YOUR_WEB3FORMS_KEY_HERE') // Replace with actual key
    
    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData,
      })
      
      if (response.ok) {
        alert('Thank you for your contribution! We will review and get back to you.')
        onClose()
      } else {
        alert('There was an error submitting. Please try again.')
      }
    } catch {
      alert('There was an error submitting. Please try again.')
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div 
      className="modal-overlay fade-in" 
      onClick={handleBackdropClick}
    >
      <div className="modal-content max-w-lg">
        {/* Header */}
        <div className="p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl" style={{ color: 'var(--color-crimson)' }}>
              Contribute to the Archive
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded flex items-center justify-center text-lg"
              style={{ background: 'var(--color-cream)' }}
            >
              ✕
            </button>
          </div>
          <p className="text-sm mt-2" style={{ color: 'var(--color-charcoal-light)' }}>
            Share your Red River Métis photographs and stories with the community.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <input type="hidden" name="subject" value="New Archive Contribution" />

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Your Name</label>
            <input
              type="text"
              name="name"
              required
              className="search-input"
              placeholder="Margaret Lapointe"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1">Email Address</label>
            <input
              type="email"
              name="email"
              required
              className="search-input"
              placeholder="margaret@example.com"
            />
          </div>

          {/* Connection to photos */}
          <div>
            <label className="block text-sm font-medium mb-1">Connection to Photos/Story</label>
            <select name="connection" className="search-input" required>
              <option value="">Select one...</option>
              <option value="family">Family Collection</option>
              <option value="community">Community Member</option>
              <option value="researcher">Researcher/Historian</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Describe Your Contribution</label>
            <textarea
              name="message"
              required
              rows={4}
              className="search-input resize-none"
              placeholder="Tell us about the photographs or stories you're sharing..."
            />
          </div>

          {/* Preferred contact method */}
          <div>
            <label className="block text-sm font-medium mb-1">Preferred Contact Method</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input type="radio" name="contact_method" value="email" defaultChecked />
                <span className="text-sm">Email</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="contact_method" value="phone" />
                <span className="text-sm">Phone</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="contact_method" value="either" />
                <span className="text-sm">Either</span>
              </label>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4">
            <button type="submit" className="btn-primary w-full">
              Submit Contribution
            </button>
            <p className="text-xs text-center mt-3" style={{ color: 'var(--color-charcoal-light)' }}>
              We respect your privacy. Your information will only be used to contact you about your contribution.
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}