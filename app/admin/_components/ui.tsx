'use client'

import Image from 'next/image'
import {
  type ButtonHTMLAttributes,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
  useState,
} from 'react'
import { BOOKING_STATE_LABELS, type BookingState } from '../_lib/admin-data'

/* --------------------------------- Layout --------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-text)] sm:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-[var(--admin-muted)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_1px_2px_rgba(60,40,20,0.04)] ${className}`}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--admin-text)]">{title}</h2>
        {description && (
          <p className="mt-0.5 text-[13px] text-[var(--admin-muted)]">{description}</p>
        )}
      </div>
      {actions}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card className="px-5 py-4">
      <p className="text-[13px] font-medium text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-[var(--admin-text)]">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-[var(--admin-muted)]">{hint}</p>}
    </Card>
  )
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-6 py-12 text-center">
      <p className="text-sm font-medium text-[var(--admin-text)]">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-[var(--admin-muted)]">{description}</p>
      )}
    </div>
  )
}

export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2">
          Δοκίμασε ξανά
        </button>
      )}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-[#ece4d8] ${className}`} />
}

/* --------------------------------- Buttons -------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--admin-accent)] text-white shadow-sm hover:bg-[var(--admin-accent-hover)]',
  secondary:
    'border border-[var(--admin-border)] bg-white text-[var(--admin-text)] hover:bg-[var(--admin-surface-2)]',
  ghost: 'text-[var(--admin-muted)] hover:bg-[#efe7dc] hover:text-[var(--admin-text)]',
  danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
}) {
  const sizing = size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm'
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${BUTTON_VARIANTS[variant]} ${className}`}
    />
  )
}

export function IconButton({
  label,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--admin-muted)] transition-colors hover:bg-[#efe7dc] hover:text-[var(--admin-text)] disabled:opacity-50 ${className}`}
    />
  )
}

// Destructive action that asks for a second click before running.
export function ConfirmButton({
  label,
  confirmLabel,
  busy,
  onConfirm,
  size = 'sm',
}: {
  label: ReactNode
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  size?: 'sm' | 'md'
}) {
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!confirming) return
    const timer = window.setTimeout(() => setConfirming(false), 4000)
    return () => window.clearTimeout(timer)
  }, [confirming])

  if (confirming) {
    return (
      <Button
        variant="danger"
        size={size}
        disabled={busy}
        onClick={() => {
          setConfirming(false)
          onConfirm()
        }}
      >
        {busy ? '...' : confirmLabel}
      </Button>
    )
  }

  return (
    <Button variant="ghost" size={size} disabled={busy} onClick={() => setConfirming(true)}>
      {label}
    </Button>
  )
}

/* ---------------------------------- Forms --------------------------------- */

const FIELD_CLASS =
  'mt-1.5 h-10 w-full rounded-xl border border-[var(--admin-border)] bg-white px-3 text-sm text-[var(--admin-text)] outline-none transition placeholder:text-[#b3a899] focus:border-[var(--admin-accent)] focus:ring-2 focus:ring-[var(--admin-accent-soft)] disabled:bg-[var(--admin-surface-2)] disabled:text-[var(--admin-muted)]'

export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[13px] font-medium text-[var(--admin-text)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--admin-muted)]">{hint}</span>}
    </label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${FIELD_CLASS} ${props.className ?? ''}`} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      {...props}
      className={`${FIELD_CLASS} h-auto resize-y py-2 leading-relaxed ${props.className ?? ''}`}
    />
  )
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${FIELD_CLASS} ${props.className ?? ''}`} />
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
      {message}
    </p>
  )
}

/* --------------------------------- Overlays ------------------------------- */

function useEscape(onClose: () => void) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}

export function Modal({
  title,
  description,
  onClose,
  onSubmit,
  submitLabel,
  submitting,
  submitDisabled,
  children,
  wide,
}: {
  title: string
  description?: string
  onClose: () => void
  onSubmit: (event: FormEvent) => void
  submitLabel: string
  submitting?: boolean
  submitDisabled?: boolean
  children: ReactNode
  wide?: boolean
}) {
  useEscape(onClose)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#2a2018]/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={onClose}
    >
      <form
        onSubmit={onSubmit}
        onMouseDown={(event) => event.stopPropagation()}
        className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--admin-border)] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">{title}</h2>
            {description && (
              <p className="mt-0.5 text-sm text-[var(--admin-muted)]">{description}</p>
            )}
          </div>
          <IconButton label="Κλείσιμο" onClick={onClose}>
            <XIcon className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">{children}</div>
        <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] px-6 py-4">
          <Button onClick={onClose}>Άκυρο</Button>
          <Button type="submit" variant="primary" disabled={submitting || submitDisabled}>
            {submitting ? 'Αποθήκευση...' : submitLabel}
          </Button>
        </div>
      </form>
    </div>
  )
}

export function Drawer({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEscape(onClose)

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[#2a2018]/25" onMouseDown={onClose}>
      <aside
        onMouseDown={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[var(--admin-border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">{title}</h2>
          <IconButton label="Κλείσιμο" onClick={onClose}>
            <XIcon className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="border-t border-[var(--admin-border)] px-6 py-4">{footer}</div>
        )}
      </aside>
    </div>
  )
}

/* ---------------------------------- Badges -------------------------------- */

const STATE_STYLES: Record<BookingState, string> = {
  upcoming: 'bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]',
  completed: 'bg-emerald-50 text-emerald-700',
  noShow: 'bg-amber-50 text-amber-800',
  cancelled: 'bg-stone-100 text-stone-500',
}

export function StateBadge({ state }: { state: BookingState }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_STYLES[state]}`}
    >
      {BOOKING_STATE_LABELS[state]}
    </span>
  )
}

export function Avatar({
  name,
  image,
  size = 36,
}: {
  name: string
  image?: string | null
  size?: number
}) {
  const [failed, setFailed] = useState(false)
  const initials = name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#ece2d4] font-semibold text-[#6b5d4f]"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {image && !failed ? (
        <Image
          src={image}
          alt={name}
          fill
          unoptimized
          sizes={`${size}px`}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials
      )}
    </span>
  )
}

/* ---------------------------------- Icons --------------------------------- */

type IconProps = { className?: string }

function Icon({ className, d }: IconProps & { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d={d} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export const XIcon = (p: IconProps) => <Icon {...p} d="M6 6l12 12M18 6 6 18" />
export const PlusIcon = (p: IconProps) => <Icon {...p} d="M12 5v14M5 12h14" />
export const ChevronLeftIcon = (p: IconProps) => <Icon {...p} d="m15 18-6-6 6-6" />
export const ChevronRightIcon = (p: IconProps) => <Icon {...p} d="m9 18 6-6-6-6" />
export const PhoneIcon = (p: IconProps) => (
  <Icon {...p} d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
)
export const MailIcon = (p: IconProps) => (
  <Icon {...p} d="M4 6h16v12H4zM4 7l8 6 8-6" />
)
export const ClockIcon = (p: IconProps) => <Icon {...p} d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
export const ScissorsIcon = (p: IconProps) => (
  <Icon {...p} d="M8.5 8.5 20 20M8.5 15.5 20 4M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm0 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
)
export const UserIcon = (p: IconProps) => <Icon {...p} d="M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 20a8 8 0 0 1 16 0" />
export const PencilIcon = (p: IconProps) => <Icon {...p} d="m4 20 4-1 11-11a2.1 2.1 0 0 0-3-3L5 16l-1 4ZM14.5 6.5l3 3" />
export const TrashIcon = (p: IconProps) => <Icon {...p} d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7l1-3h4l1 3" />
export const SearchIcon = (p: IconProps) => <Icon {...p} d="m20 20-4-4m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
export const LogoutIcon = (p: IconProps) => <Icon {...p} d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
export const AlertIcon = (p: IconProps) => <Icon {...p} d="M12 9v4m0 4h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
export const LockIcon = (p: IconProps) => <Icon {...p} d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
export const NoteIcon = (p: IconProps) => <Icon {...p} d="M5 4h14v11l-5 5H5zM14 20v-5h5M8.5 9h7M8.5 12.5h4" />
export const BanIcon = (p: IconProps) => <Icon {...p} d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM5.6 5.6l12.8 12.8" />
