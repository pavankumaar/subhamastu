import { Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PhoneActions, VendorCard } from '../components/Cards'
import { DetailHeader, EmptyStateCard, FieldLabel, PageHeader } from '../components/ScreenChrome'
import { useWedding } from '../context/useWedding'
import { useBackLayer } from '../hooks/useBackLayer'
import type { VendorItem } from '../types/wedding'
import { sanitizePhone } from '../utils/weddingFormat'

interface VendorFormState {
  name: string
  phone: string
  totalContract: string
  paidAmount: string
  notes: string
  eventId: string
}

function formFromVendor(vendor: VendorItem): VendorFormState {
  return {
    name: vendor.name,
    phone: vendor.phone,
    totalContract: vendor.totalContract ? String(vendor.totalContract) : '',
    paidAmount: vendor.paidAmount ? String(vendor.paidAmount) : '',
    notes: vendor.notes,
    eventId: vendor.eventId ?? '',
  }
}

interface DirectoryScreenProps {
  onQuickActionVisibilityChange?: (visible: boolean) => void
  initialItemId?: string
  onItemClosed?: () => void
}

export function DirectoryScreen({ onQuickActionVisibilityChange, initialItemId, onItemClosed }: DirectoryScreenProps) {
  const { data, updateVendorPhone, updateVendor, removeVendor, markVendorPaid } = useWedding()
  const initialVendor = initialItemId ? data.vendors.find((vendor) => vendor.id === initialItemId) : undefined

  const [selectedId, setSelectedId] = useState(initialVendor?.id ?? '')
  const [form, setForm] = useState<VendorFormState | null>(() => (initialVendor ? formFromVendor(initialVendor) : null))
  const [error, setError] = useState('')
  const [phoneDraftFor, setPhoneDraftFor] = useState('')
  const [phoneDraft, setPhoneDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const eventNameById = useMemo(
    () => new Map(data.guests.events.map((event) => [event.id, event.name])),
    [data.guests.events],
  )
  const selectedVendor = data.vendors.find((vendor) => vendor.id === selectedId) ?? null
  const isDetail = Boolean(selectedVendor && form)
  useBackLayer(isDetail, () => closeVendor())

  useEffect(() => {
    if (!onQuickActionVisibilityChange) return
    onQuickActionVisibilityChange(!isDetail)
    return () => onQuickActionVisibilityChange(true)
  }, [isDetail, onQuickActionVisibilityChange])

  function openVendor(vendor: VendorItem) {
    setSelectedId(vendor.id)
    setForm(formFromVendor(vendor))
    setError('')
  }

  function closeVendor() {
    setSelectedId('')
    setForm(null)
    setError('')
    setConfirmDelete(false)
    onItemClosed?.()
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedVendor || !form) return
    const totalContract = Number(form.totalContract || 0)
    const paidAmount = Number(form.paidAmount || 0)
    if (!form.name.trim()) {
      setError('Vendor name is required.')
      return
    }
    if (!Number.isFinite(totalContract) || totalContract < 0 || !Number.isFinite(paidAmount) || paidAmount < 0) {
      setError('Amounts cannot be negative.')
      return
    }
    if (paidAmount > totalContract) {
      setError('Paid amount cannot exceed the contract amount.')
      return
    }
    updateVendor(selectedVendor.id, {
      name: form.name,
      phone: form.phone,
      totalContract,
      paidAmount,
      notes: form.notes,
      eventId: form.eventId || undefined,
    })
    closeVendor()
  }

  if (selectedVendor && form) {
    const settled = selectedVendor.totalContract > 0 && selectedVendor.paidAmount >= selectedVendor.totalContract
    return (
      <section className="screen-animate space-y-3 pb-4">
        <DetailHeader
          backLabel="Vendors"
          onBack={closeVendor}
          title={selectedVendor.name}
          subtitle={selectedVendor.eventId ? eventNameById.get(selectedVendor.eventId) : 'Vendor details'}
          action={
            <button
              type="button"
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true)
                  return
                }
                removeVendor(selectedVendor.id)
                closeVendor()
              }}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-sm font-semibold text-blush-deep active:bg-blush-soft"
            >
              <Trash2 className="h-4 w-4" />
              {confirmDelete ? 'Tap again to delete' : 'Delete'}
            </button>
          }
        />

        {selectedVendor.phone ? <PhoneActions phone={selectedVendor.phone} /> : null}

        {selectedVendor.totalContract > 0 && !settled ? (
          <button
            type="button"
            onClick={() => {
              markVendorPaid(selectedVendor.id)
              setForm((current) => (current ? { ...current, paidAmount: String(selectedVendor.totalContract) } : current))
            }}
            className="flex w-full items-center justify-center rounded-2xl border border-sage/30 bg-sage-light py-2.5 text-sm font-semibold text-sage"
          >
            Mark contract fully paid
          </button>
        ) : null}

        <form onSubmit={handleSave} className="space-y-3 rounded-2xl border border-brass-line bg-silk p-3.5 shadow-soft">
          <div>
            <FieldLabel>Name *</FieldLabel>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>
          <div>
            <FieldLabel>Phone</FieldLabel>
            <input
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: sanitizePhone(event.target.value) })}
              placeholder="9849000000"
              className="tabular-nums"
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <FieldLabel>Contract (₹)</FieldLabel>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={form.totalContract}
                onChange={(event) => setForm({ ...form, totalContract: event.target.value })}
                className="tabular-nums"
              />
            </div>
            <div>
              <FieldLabel>Paid (₹)</FieldLabel>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={form.paidAmount}
                onChange={(event) => setForm({ ...form, paidAmount: event.target.value })}
                className="tabular-nums"
              />
            </div>
          </div>
          <div>
            <FieldLabel>Event</FieldLabel>
            <select value={form.eventId} onChange={(event) => setForm({ ...form, eventId: event.target.value })}>
              <option value="">Not linked</option>
              {data.guests.events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Notes</FieldLabel>
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              rows={3}
              className="resize-y"
            />
          </div>
          {error ? <p className="rounded-xl bg-blush-soft px-3 py-2 text-xs text-blush-deep">{error}</p> : null}
          <button type="submit" className="w-full rounded-2xl bg-charcoal py-3 text-sm font-semibold text-ivory">
            Save changes
          </button>
        </form>
      </section>
    )
  }

  return (
    <section className="screen-animate space-y-3">
      <PageHeader title="Vendors" rightMeta={`${data.vendors.length} partners`} />

      {data.vendors.length === 0 ? (
        <EmptyStateCard
          title="Curate your vendors"
          subtitle="Florists, Nadaswaram ensembles, Purohits and photographers in one calm directory."
        />
      ) : (
        <div className="space-y-2">
          {data.vendors.map((vendor) => (
            <VendorCard
              key={vendor.id}
              vendor={vendor}
              eventName={vendor.eventId ? eventNameById.get(vendor.eventId) : undefined}
              onOpen={() => openVendor(vendor)}
              onMarkPaid={() => markVendorPaid(vendor.id)}
              footer={
                vendor.phone ? null : phoneDraftFor === vendor.id ? (
                  <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoFocus
                      value={phoneDraft}
                      onChange={(event) => setPhoneDraft(sanitizePhone(event.target.value))}
                      placeholder="9849000000"
                      className="flex-1 bg-ivory py-1.5 text-xs tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!phoneDraft) return
                        updateVendorPhone(vendor.id, phoneDraft)
                        setPhoneDraftFor('')
                      }}
                      className="rounded-xl bg-charcoal px-3 py-1.5 text-xs font-semibold text-ivory"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setPhoneDraftFor(vendor.id)
                      setPhoneDraft('')
                    }}
                    className="w-full rounded-xl border border-dashed border-brass-line px-3 py-2 text-xs font-medium text-muted-taupe"
                  >
                    + Add phone number
                  </button>
                )
              }
            />
          ))}
        </div>
      )}
    </section>
  )
}
