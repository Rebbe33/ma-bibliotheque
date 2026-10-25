import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const page = parseInt(searchParams.get('page') || '0')
  const lang = searchParams.get('lang') || 'fr'

  if (!query) return NextResponse.json([])

  // Lancer les 3 sources en parallèle
  const [googleResults, olResults, bnfResults] = await Promise.allSettled([
    searchGoogle(query, page, lang),
    searchOpenLibrary(query, page),
    searchBnF(query, page),
  ])

  const google = googleResults.status === 'fulfilled' ? googleResults.value : []
  const ol = olResults.status === 'fulfilled' ? olResults.value : []
  const bnf = bnfResults.status === 'fulfilled' ? bnfResults.value : []

  // Fusionner et dédoublonner
  const merged = mergeResults([...bnf, ...google, ...ol])

  return NextResponse.json(merged.slice(page * 20, page * 20 + 20))
}

// ── Dédoublonnage ──
function normalizeTitle(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30)
}

function getISBNs(book: any): string[] {
  return (book.industryIdentifiers || [])
    .map((i: any) => i.identifier?.replace(/-/g, ''))
    .filter(Boolean)
}

function mergeResults(books: any[]): any[] {
  const seen = new Map<string, any>()

  for (const book of books) {
    const isbns = getISBNs(book)
    const titleKey = normalizeTitle(book.title)

    // Chercher un doublon existant par ISBN
    let existingKey: string | null = null
    for (const isbn of isbns) {
      if (seen.has('isbn_' + isbn)) { existingKey = 'isbn_' + isbn; break }
    }
    // Sinon par titre normalisé
    if (!existingKey && seen.has('title_' + titleKey)) {
      existingKey = 'title_' + titleKey
    }

    if (existingKey) {
      // Enrichir l'entrée existante avec les données manquantes
      const existing = seen.get(existingKey)!
      if (!existing.cover_url && book.cover_url) existing.cover_url = book.cover_url
      if (!existing.imageLinks && book.imageLinks) existing.imageLinks = book.imageLinks
      if (!existing.pageCount && book.pageCount) existing.pageCount = book.pageCount
      if (!existing.publisher && book.publisher) existing.publisher = book.publisher
      if (!existing.categories?.length && book.categories?.length) existing.categories = book.categories
      if (!existing.industryIdentifiers?.length && isbns.length) {
        existing.industryIdentifiers = book.industryIdentifiers
      }
      // Préférer la BnF pour la date (plus fiable pour les livres FR)
      if (book.source === 'bnf' && book.publishedDate) existing.publishedDate = book.publishedDate
    } else {
      // Nouveau livre
      const key = isbns.length ? 'isbn_' + isbns[0] : 'title_' + titleKey
      seen.set(key, { ...book })
      // Indexer aussi les autres ISBN pour dédoublonner
      for (const isbn of isbns.slice(1)) seen.set('isbn_' + isbn, seen.get(key)!)
    }
  }

  // Dédoublonner les valeurs (une Map peut pointer plusieurs clés vers le même objet)
  const unique: any[] = []
  const added = new Set<any>()
  for (const v of Array.from(seen.values())) {
    if (!added.has(v)) { unique.push(v); added.add(v) }
  }

  // Trier : BnF en premier (livres FR), puis Google, puis OL
  const sourceOrder: Record<string, number> = { bnf: 0, google: 1, openlibrary: 2 }
  return unique.sort((a, b) => (sourceOrder[a.source] ?? 9) - (sourceOrder[b.source] ?? 9))
}

// ── BnF (Bibliothèque nationale de France) ──
async function searchBnF(query: string, page = 0) {
  // Si la query ressemble à un ISBN, chercher par ISBN ; sinon cherche texte libre
  const cleanQuery = query.replace(/[-\s]/g, '')
  const isIsbn = /^\d{10,13}$/.test(cleanQuery)
  const cql = isIsbn
    ? `bib.isbn adj "${cleanQuery}"`
    : `bib.anywhere all "${query.replace(/"/g, ' ')}"`
  const params = new URLSearchParams({
    operation: 'searchRetrieve',
    version: '1.2',
    query: cql,
    recordSchema: 'dublincore',
    maximumRecords: '20',
    startRecord: String(page * 20 + 1),
  })

  try {
    // BnF requiert %20 pour les espaces dans CQL (URLSearchParams utilise + qui n'est pas reconnu)
    const bnfUrl = `https://catalogue.bnf.fr/api/SRU?${params.toString().replace(/\+/g, '%20')}`
    const res = await fetch(bnfUrl, {
      headers: { Accept: 'application/xml, text/xml' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const xml = await res.text()
    return parseBnFDublinCore(xml)
  } catch (e) { console.log('[BnF] error:', e); return [] }
}

function getAll(content: string, tag: string): string[] {
  const rx = new RegExp(`<(?:[a-z_]+:)?${tag}(?:\\\\s[^>]*)?>([\\\\s\\\\S]*?)<\\/(?:[a-z_]+:)?${tag}>`, 'gi')
  return Array.from(content.matchAll(rx)).map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean)
}
function getFirst(content: string, tag: string): string { return getAll(content, tag)[0] || '' }

function parseBnFDublinCore(xml: string): any[] {
  const books: any[] = []

  // srw:recordData dans le XML BnF
  const recordMatches = Array.from(xml.matchAll(/<(?:[a-z]+:)?recordData[^>]*>([\s\S]*?)<\/(?:[a-z]+:)?recordData>/gi))

  for (const [, recordContent] of recordMatches) {

    const title = getFirst(recordContent, 'title')
    if (!title) continue

    // Filtrer : ne garder que les livres (pas les partitions, films, etc.)
    const types = getAll(recordContent, 'type').join(' ').toLowerCase()
    if (types && types.includes('image') && !types.includes('text') && !types.includes('imprimé')) continue

    // Auteurs
    const creators = getAll(recordContent, 'creator')
    // Format BnF : "Nom, Prénom (1970-....)" — on nettoie
    const authors = creators.map(c => c.replace(/\s*\(\d{4}.*?\)/, '').replace(/\s*\[.*?\]/, '').trim())

    // ISBN depuis dc:identifier
    const identifiers = getAll(recordContent, 'identifier')
    const isbns = identifiers
      .filter(id => /isbn/i.test(id) || /^97[89]/.test(id.replace(/[-\s]/g, '')))
      .map(id => id.replace(/^ISBN\s*/i, '').replace(/[-\s]/g, '').trim())
      .filter(id => /^\d{10,13}$/.test(id))

    // Date
    const rawDate = getFirst(recordContent, 'date')
    const dateMatch = rawDate.match(/\d{4}/)
    const publishedDate = dateMatch ? dateMatch[0] : ''

    // Pages depuis dc:format : "1 vol. (248 p.)"
    const formats = getAll(recordContent, 'format')
    let pageCount: number | undefined
    for (const f of formats) {
      const m = f.match(/(\d+)\s*p\./)
      if (m) { pageCount = parseInt(m[1]); break }
    }

    // Éditeur depuis dc:publisher
    const publisher = getFirst(recordContent, 'publisher')

    // Genres/sujets
    const subjects = getAll(recordContent, 'subject').slice(0, 3)

    books.push({
      id: 'bnf_' + (identifiers.find(i => i.startsWith('http')) || Math.random().toString(36).slice(2)),
      title,
      authors,
      publisher: publisher || undefined,
      publishedDate: publishedDate || undefined,
      pageCount,
      categories: subjects.length ? subjects : undefined,
      imageLinks: isbns[0] ? {
        // Couverture via OpenLibrary par ISBN (BnF n'héberge pas les couvertures)
        thumbnail: `https://covers.openlibrary.org/b/isbn/${isbns[0]}-M.jpg`,
        smallThumbnail: `https://covers.openlibrary.org/b/isbn/${isbns[0]}-S.jpg`,
      } : undefined,
      industryIdentifiers: isbns.map(isbn => ({
        type: isbn.length === 13 ? 'ISBN_13' : 'ISBN_10',
        identifier: isbn,
      })),
      source: 'bnf',
    })
  }

  return books
}

// ── Google Books ──
async function searchGoogle(query: string, page = 0, lang = 'fr') {
  const key = process.env.GOOGLE_BOOKS_KEY
  const params = new URLSearchParams({
    q: query,
    maxResults: '40',
    startIndex: String(page * 20),
    printType: 'books',
    ...(lang !== 'all' ? { langRestrict: lang } : {}),
    ...(key ? { key } : {}),
  })
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`, {
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    const results = (data.items || []).map((item: any) => {
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
        language: v.language,
        source: 'google',
      }
    })

    if (lang !== 'all') {
      const filtered = results.filter((b: any) => b.language === lang)
      return (filtered.length >= 5 ? filtered : results).slice(0, 20)
    }
    return results.slice(0, 20)
  } catch { return [] }
}

// ── Open Library ──
async function searchOpenLibrary(query: string, page = 0) {
  const params = new URLSearchParams({
    q: query,
    limit: '20',
    offset: String(page * 20),
    fields: 'key,title,author_name,first_publish_year,number_of_pages_median,publisher,isbn,cover_i,subject,series',
  })
  try {
    const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
      signal: AbortSignal.timeout(8000),
    })
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
