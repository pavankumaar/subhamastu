import { Copy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyStateCard, PageHeader } from '../components/ScreenChrome'
import { useWedding } from '../context/useWedding'
import { formatCurrencyInr } from '../utils/weddingFormat'

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function DirectoryScreen() {
  const { data, updateVendorPhone } = useWedding()
  const [editingPhoneVendorId, setEditingPhoneVendorId] = useState<string | null>(null)
  const [pendingPhone, setPendingPhone] = useState('')
  const eventNameById = useMemo(
    () => new Map(data.guests.events.map((event) => [event.id, event.name])),
    [data.guests.events],
  )

  async function copyValue(value: string) {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      return
    }
  }

  async function handlePhoneAction(vendorId: string, currentPhone: string) {
    if (currentPhone.trim()) {
      await copyValue(currentPhone)
      return
    }
    setEditingPhoneVendorId(vendorId)
    setPendingPhone('')
  }

  function savePendingPhone(vendorId: string) {
    const normalizedPhone = pendingPhone.trim()
    if (!normalizedPhone) {
      return
    }
    updateVendorPhone(vendorId, normalizedPhone)
    setEditingPhoneVendorId(null)
    setPendingPhone('')
  }

  return (
    <section className="screen-animate">
      <PageHeader kicker="Trusted Artisans" title="Vendors" rightMeta={`${data.vendors.length} partners`} />

      <section className="space-y-3 px-1 pb-2">
        {data.vendors.length === 0 ? (
          <EmptyStateCard
            title="Curate Your Vendors"
            subtitle="Keep florists, Nadaswaram ensembles, Purohits, and photographers in one calm directory."
          />
        ) : (
          data.vendors.map((vendor) => {
            const settled = vendor.totalContract > 0 && vendor.paidAmount >= vendor.totalContract
            const isEditingPhone = editingPhoneVendorId === vendor.id
            return (
              <article key={vendor.id} className="space-y-3 rounded-2xl border border-brass-line bg-silk p-4 shadow-soft">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brass-line bg-champagne-light font-display text-sm font-semibold text-charcoal">
                    {getInitials(vendor.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate text-[13px] font-semibold text-charcoal">{vendor.name}</h3>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${settled ? 'bg-sage-light text-sage' : 'bg-champagne-light text-champagne'}`}>
                        {settled ? 'Settled' : 'Due'}
                      </span>
                    </div>
                    {vendor.eventId && eventNameById.get(vendor.eventId) ? (
                      <p className="mt-0.5 text-[11px] text-champagne">{eventNameById.get(vendor.eventId)}</p>
                    ) : null}
                    {vendor.notes ? <p className="mt-1 text-xs leading-relaxed text-muted-taupe">{vendor.notes}</p> : null}
                  </div>
                </div>

                {vendor.totalContract > 0 ? (
                  <div className="flex items-center justify-between border-t border-brass-line/60 pt-2 text-[11px] text-muted-taupe tabular-nums">
                    <span>Paid Progress</span>
                    <span className="font-medium text-charcoal">
                      {formatCurrencyInr(vendor.paidAmount)} / {formatCurrencyInr(vendor.totalContract)}
                    </span>
                  </div>
                ) : null}

                <div className="pt-1">
                  {isEditingPhone ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        value={pendingPhone}
                        onChange={(event) => setPendingPhone(event.target.value)}
                        placeholder="+91 98490 00000"
                        className="flex-1 bg-ivory px-3 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => savePendingPhone(vendor.id)}
                        className="rounded-xl bg-charcoal px-3 py-1.5 text-[11px] font-medium text-ivory"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPhoneVendorId(null)}
                        className="rounded-xl border border-brass-line px-2.5 py-1.5 text-[11px] text-muted-taupe"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : vendor.phone ? (
                    <button
                      type="button"
                      onClick={() => void handlePhoneAction(vendor.id, vendor.phone)}
                      className="flex w-full items-center justify-between rounded-xl border border-brass-line bg-ivory px-3 py-2 text-xs text-charcoal"
                    >
                      <span className="tabular-nums">{vendor.phone}</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-champagne">
                        <Copy className="h-3 w-3" />
                        Copy
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handlePhoneAction(vendor.id, vendor.phone)}
                      className="w-full rounded-xl border border-dashed border-brass-line px-3 py-2 text-xs text-muted-taupe"
                    >
                      Add Phone Number
                    </button>
                  )}
                </div>
              </article>
            )
          })
        )}
      </section>
    </section>
  )
}
