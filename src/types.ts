export interface Photo {
 id: number
 src: string
 alt: string
 title?: string
 caption?: string
 people?: string
 location?: string
 community?: string
 province?: string
 sublocation?: string
 keywords?: string[]
 storyIds?: string[]
 lat?: number
 lng?: number
 position?: { x: number; y: number }
 rotation?: number
 scale?: number
 zIndex?: number
 lastModified?: number
 year?: number
}

export interface Story {
  id: string
  title: string
  text: string
  audioSrc: string
  photoIds: number[]
  textFile?: string
  audioFile?: string
  _photoFiles?: string[] // Internal: original filenames
}

export interface FilterState {
  type: 'search' | 'family' | 'location' | 'yearSpan'
  value: string
}