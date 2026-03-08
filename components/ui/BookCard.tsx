import Image from 'next/image'
import { Book, BookStatus } from '@/types'
import { Edit2, Trash2, CheckCircle } from 'lucide-react'

const STATUS_CHIP: Record<BookStatus, string> = {
  'Lu':         'chip chip-lu',
  'En cours':   'chip chip-en',
  'À lire':     'chip chip-al',
  'Abandonné':  'chip chip-ab',
}
const STATUS_EMOJI: Record<BookStatus, string> = {
  'Lu': '✅', 'En cours': '📖', 'À lire': '📋', 'Abandonné': '💀'
}

const COVERS = 8
function coverIdx(title: string) {
  let h = 0; for (const c of title) h = (h * 31 + c.charCodeAt(0)) & 0xfffffff
  return h % COVERS
}

interface Props {
  book: Book
  onClick: () => void
  onEdit: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
  onMarkRead?: (e: React.MouseEvent) => void
}

export default function BookCard({ book, onClick, onEdit, onDelete, onMarkRead }: Props) {
  return (
    <div onClick={onClick}
      className="card card-hover flex gap-3 p-3.5 cursor-pointer active:scale-[0.98] transition-transform">
      {/* Cover */}
      {book.cover_url
        ? <Image src={book.cover_url} alt={book.title} width={52} height={72}
            className="rounded-xl object-cover flex-shrink-0 shadow-sm" />
        : <div className={`cover-${coverIdx(book.title)} w-[52px] h-[72px] rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm`}>
            📖
          </div>
      }

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-black text-sm text-ink line-clamp-2 leading-snug">{book.title}</p>
        <p className="text-xs text-gray-500 mt-0.5 font-semibold">{book.author}</p>
        <div className="flex flex-wrap gap-1.5 mt-2 items-center">
          <span className={STATUS_CHIP[book.status]}>{STATUS_EMOJI[book.status]} {book.status}</span>
          {book.rating > 0 && <span className="text-xs leading-none">{'⭐'.repeat(book.rating)}</span>}
          {book.series_name && (
            <span className="text-[11px] font-semibold text-violet bg-violet-light px-2 py-0.5 rounded-full">
              {book.series_name}{book.series_number ? ` #${book.series_number}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <button onClick={onEdit}
          className="w-8 h-8 rounded-xl bg-amber-light text-amber-dark flex items-center justify-center hover:bg-amber/20 transition-colors">
          <Edit2 size={13} />
        </button>
        {onMarkRead && book.status !== 'Lu' && (
          <button onClick={onMarkRead}
            className="w-8 h-8 rounded-xl bg-mint-light text-mint-dark flex items-center justify-center hover:bg-mint/20 transition-colors">
            <CheckCircle size={13} />
          </button>
        )}
        <button onClick={onDelete}
          className="w-8 h-8 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 transition-colors">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
