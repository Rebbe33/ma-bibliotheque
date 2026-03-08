import { GoogleBook } from '@/types'

const BASE = 'https://www.googleapis.com/books/v1/volumes'

export async function searchGoogleBooks(query: string): Promise<GoogleBook[]> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_KEY
  const params = new URLSearchParams({
    q: query,
    maxResults: '12',
    langRestrict: 'fr',
    printType: 'books',
    ...(key ? { key } : {}),
  })

  // Try French first, then without language restriction
  const res = await fetch(`${BASE}?${params}`)
  if (!res.ok) throw new Error('Google Books API error')
  const data = await res.json()

  // If few results, try without language filter
  let items = data.items || []
  if (items.length < 3) {
    const params2 = new URLSearchParams({ q: query, maxResults: '12', printType: 'books', ...(key ? { key } : {}) })
    const res2 = await fetch(`${BASE}?${params2}`)
    if (res2.ok) {
      const data2 = await res2.json()
      const extra = (data2.items || []).filter((b: any) => !items.find((i: any) => i.id === b.id))
      items = [...items, ...extra].slice(0, 12)
    }
  }

  return items.map((item: any): GoogleBook => {
    const v = item.volumeInfo || {}
    return {
      id: item.id,
      title: v.title || 'Titre inconnu',
      authors: v.authors || [],
      publisher: v.publisher,
      publishedDate: v.publishedDate,
      pageCount: v.pageCount,
      categories: v.categories,
      imageLinks: v.imageLinks,
      industryIdentifiers: v.industryIdentifiers,
      seriesInfo: v.seriesInfo,
      description: v.description,
    }
  })
}

export function extractYear(dateStr?: string): number | undefined {
  if (!dateStr) return undefined
  const match = dateStr.match(/(\d{4})/)
  return match ? parseInt(match[1]) : undefined
}

export function getBestCover(imageLinks?: GoogleBook['imageLinks']): string | undefined {
  if (!imageLinks) return undefined
  const url = imageLinks.thumbnail || imageLinks.smallThumbnail
  if (!url) return undefined
  // Force HTTPS and higher resolution
  return url.replace('http://', 'https://').replace('zoom=1', 'zoom=2')
}

export function getISBN(identifiers?: GoogleBook['industryIdentifiers']): string | undefined {
  if (!identifiers) return undefined
  return (
    identifiers.find(i => i.type === 'ISBN_13')?.identifier ||
    identifiers.find(i => i.type === 'ISBN_10')?.identifier
  )
}
