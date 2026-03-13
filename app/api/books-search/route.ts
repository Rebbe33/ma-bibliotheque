import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  if (!query) return NextResponse.json([])

  const key = process.env.GOOGLE_BOOKS_KEY
  const params = new URLSearchParams({
    q: query,
    maxResults: '12',
    printType: 'books',
    ...(key ? { key } : {}),
  })

  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`)
    const data = await res.json()
    const items = (data.items || []).map((item: any) => {
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
      }
    })
    return NextResponse.json(items)
  } catch {
    return NextResponse.json([])
  }
}
