import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const page = parseInt(searchParams.get('page') || '0')
  const source = searchParams.get('source') || 'google'
  if (!query) return NextResponse.json([])

  if (source === 'openlibrary') {
    return NextResponse.json(await searchOpenLibrary(query, page))
  }
  return NextResponse.json(await searchGoogle(query, page))
}

async function searchGoogle(query: string, page = 0) {
  const key = process.env.GOOGLE_BOOKS_KEY
  const params = new URLSearchParams({
    q: query,
    maxResults: '20',
    startIndex: String(page * 20),
    printType: 'books',
    ...(key ? { key } : {}),
  })
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`)
    const data = await res.json()
    return (data.items || []).map((item: any) => {
      const v = item.volumeInfo || {}
      return {
        id: 'g_' + item.id,
        title: v.title || 'Titre inconnu',
        authors: v.authors || [],
        publisher: v.publisher,
        publishedDate: v.publishedDate,
        pageCount: v.pageCount,
        categories: v.categories,
        imageLinks: v.imageLinks,
        industryIdentifiers: v.industryIdentifiers,
        seriesInfo: v.seriesInfo,
        source: 'google',
      }
    })
  } catch { return [] }
}

async function searchOpenLibrary(query: string, page = 0) {
  const params = new URLSearchParams({
    q: query,
    limit: '20',
    offset: String(page * 20),
    fields: 'key,title,author_name,first_publish_year,number_of_pages_median,publisher,isbn,cover_i,subject,series',
  })
  try {
    const res = await fetch(`https://openlibrary.org/search.json?${params}`)
    const data = await res.json()
    return (data.docs || []).map((item: any) => ({
      id: 'ol_' + item.key?.replace('/works/', ''),
      title: item.title || 'Titre inconnu',
      authors: item.author_name || [],
      publisher: item.publisher?.[0],
      publishedDate: item.first_publish_year?.toString(),
      pageCount: item.number_of_pages_median,
      categories: item.subject?.slice(0, 3),
      imageLinks: item.cover_i ? {
        thumbnail: `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg`,
        smallThumbnail: `https://covers.openlibrary.org/b/id/${item.cover_i}-S.jpg`,
      } : undefined,
      industryIdentifiers: item.isbn?.[0] ? [{ type: 'ISBN_13', identifier: item.isbn[0] }] : undefined,
      seriesInfo: item.series?.[0] ? { shortSeriesBookTitle: item.series[0] } : undefined,
      source: 'openlibrary',
    }))
  } catch { return [] }
}
