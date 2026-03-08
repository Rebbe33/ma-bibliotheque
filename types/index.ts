export type BookStatus = 'À lire' | 'En cours' | 'Lu' | 'Abandonné'
export type WishPriority = 'Haute' | 'Moyenne' | 'Basse'

export interface Book {
  id: string
  user_id: string
  title: string
  author: string
  genre?: string
  year?: number
  pages?: number
  publisher?: string
  isbn?: string
  series_name?: string
  series_number?: number
  cover_url?: string
  status: BookStatus
  rating: number
  notes?: string
  google_books_id?: string
  date_added: string
  date_updated: string
}

export interface WishItem {
  id: string
  user_id: string
  title: string
  author?: string
  genre?: string
  priority: WishPriority
  where_to_find?: string
  notes?: string
  cover_url?: string
  google_books_id?: string
  publisher?: string
  year?: number
  date_added: string
}

export interface GoogleBook {
  id: string
  title: string
  authors: string[]
  publisher?: string
  publishedDate?: string
  pageCount?: number
  categories?: string[]
  imageLinks?: { thumbnail?: string; smallThumbnail?: string }
  industryIdentifiers?: { type: string; identifier: string }[]
  seriesInfo?: { bookDisplayNumber?: string; shortSeriesBookTitle?: string }
  description?: string
}

export interface Profile {
  id: string
  username?: string
  avatar_url?: string
  created_at: string
}
