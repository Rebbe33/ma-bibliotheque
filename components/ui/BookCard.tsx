import Image from 'next/image'
import { Book, BookStatus } from '@/types'
import { Edit2, Trash2, CheckCircle } from 'lucide-react'

const STATUS_CHIP: Record<BookStatus, string> = {
  'Lu':         'chip chip-lu',
  'En cours':   'chip chip-en',
  'À lire':     'chip chip-al',
  'Abandonné':  'chip chip-ab',
  'Prêté':      'chip chip-pr',
  'À acquérir': 'chip chip-aq',
}
const STATUS_EMOJI: Record<BookStatus, string> = {
  'Lu':         '✅',
  'En cours':   '📖',
  'À lire':     '📋',
  'Abandonné':  '💀',
  'Prêté':      '🤝',
  'À acquérir': '🛒',
}

const PHYSICAL_BADGE: Record<string, { label: string; emoji: string; cls: string }> = {
  'Possédé':         { label: 'Possédé',        emoji: '🏠', cls: 'bg-emerald-50 text-emerald-700' },
  'À vendre/donner': { label: 'À vendre',        emoji: '📤', cls: 'bg-orange-50 text-orange-600' },
  'Emprunté biblio': { label: 'Biblio',          emoji: '🔄', cls: 'bg-blue-50 text-blue-600' },
  'À acheter':       { label: 'À acheter',       emoji: '🛍️', cls: 'bg-pink-50 text-pink-600' },
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
  const physicalStatus = (book as any).physical_status as string | undefined
  const returnDate = (book as any).return_date as string | undefined
  const physical = physicalStatus ? PHYSICAL_BADGE[physicalStatus] : null

  const isReturnSoon = returnDate && physicalStatus === 'Emprunté biblio'
    ? (() => {
        const diff = (new Date(returnDate + 'T12:00:00').getTime() - Date.now()) / 86400000
        return diff <= 3
      })()
    : false

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
          {book.status === 'Prêté' && book.borrower_name && (
            <span className="text-[11px] font-semibold text-violet bg-violet-light px-2 py-0.5 rounded-full">
              🤝 {book.borrower_name}
            </span>
          )}
          {book.rating > 0 && <span className="text-xs leading-none">{'⭐'.repeat(book.rating)}</span>}
          {book.series_name && (
            <span className="text-[11px] font-semibold text-violet bg-violet-light px-2 py-0.5 rounded-full">
              {book.series_name}{book.series_number ? ` #${book.series_number}` : ''}
            </span>
          )}
          {/* Badge physique */}
          {physical && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${physical.cls}`}>
              {physical.emoji} {physical.label}
            </span>
          )}
          {/* Date de retour biblio */}
          {returnDate && physicalStatus === 'Emprunté biblio' && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${isReturnSoon ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
              {isReturnSoon ? '⚠️' : '📅'} {new Date(returnDate + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
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
        {onMarkRead && book.status !== 'Lu' && book.status !== 'Abandonné' && (
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
