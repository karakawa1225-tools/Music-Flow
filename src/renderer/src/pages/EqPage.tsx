import { EQ_BAND_LABELS, EQ_PRESETS } from '@shared/types'
import { useLibraryStore } from '@renderer/stores/libraryStore'
import { usePlayerStore } from '@renderer/stores/playerStore'
import { cn } from '@renderer/lib/utils'

const PRESET_KEYS = Object.keys(EQ_PRESETS)

export function EqPage() {
  const settings = useLibraryStore((s) => s.settings)
  const setSettings = useLibraryStore((s) => s.setSettings)
  const applyEqFromSettings = usePlayerStore((s) => s.applyEqFromSettings)

  const update = async (partial: Parameters<typeof setSettings>[0]) => {
    await setSettings(partial)
    // apply after settings store updates
    setTimeout(() => applyEqFromSettings(), 0)
  }

  const bands = settings.eqBands.length === 10 ? settings.eqBands : [...EQ_PRESETS.FLAT]

  return (
    <div className="page-enter">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Equalizer</h1>
          <p className="mt-1 text-sm text-mf-muted">10バンド EQ · Version 1</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-mf-muted">Enable EQ</span>
            <button
              type="button"
              onClick={() => void update({ eqEnabled: !settings.eqEnabled })}
              className={cn(
                'relative h-6 w-11 rounded-full transition',
                settings.eqEnabled ? 'bg-mf-accent' : 'bg-white/15'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white transition',
                  settings.eqEnabled ? 'left-5' : 'left-0.5'
                )}
              />
            </button>
          </label>
          <button
            type="button"
            onClick={() =>
              void update({
                eqPreset: 'FLAT',
                eqBands: [...EQ_PRESETS.FLAT],
                eqBassBoost: 0,
                eq3d: 0,
                eqSurround: 0,
                eqBalance: 0
              })
            }
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-mf-muted hover:bg-white/5"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        <aside className="w-48 shrink-0 space-y-1">
          {PRESET_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() =>
                void update({
                  eqPreset: key,
                  eqBands: [...EQ_PRESETS[key]],
                  eqEnabled: true
                })
              }
              className={cn(
                'w-full rounded-xl px-3 py-2.5 text-left text-sm',
                settings.eqPreset === key
                  ? 'bg-mf-accent text-white'
                  : 'text-mf-muted hover:bg-white/5 hover:text-mf-text'
              )}
            >
              {key}
            </button>
          ))}
        </aside>

        <div className="flex-1 rounded-2xl border border-white/5 bg-mf-surface/40 p-6">
          <div className="flex items-end justify-between gap-3 overflow-x-auto pb-2">
            {EQ_BAND_LABELS.map((label, index) => (
              <div key={label} className="flex min-w-[56px] flex-col items-center gap-3">
                <span className="text-xs text-mf-muted">{bands[index] > 0 ? `+${bands[index]}` : bands[index]}dB</span>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={bands[index]}
                  disabled={!settings.eqEnabled}
                  onChange={(e) => {
                    const next = [...bands]
                    next[index] = Number(e.target.value)
                    void update({ eqBands: next, eqPreset: 'CUSTOM', eqEnabled: true })
                  }}
                  className="eq-slider"
                />
                <span className="text-[11px] text-mf-muted">{label}</span>
              </div>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-4">
            <Knob
              label="Bass Boost"
              value={settings.eqBassBoost}
              min={0}
              max={12}
              onChange={(v) => void update({ eqBassBoost: v, eqEnabled: true })}
            />
            <Knob
              label="3D Effect"
              value={settings.eq3d}
              min={0}
              max={100}
              onChange={(v) => void update({ eq3d: v })}
            />
            <Knob
              label="Surround"
              value={settings.eqSurround}
              min={0}
              max={100}
              onChange={(v) => void update({ eqSurround: v })}
            />
            <div>
              <div className="mb-3 text-sm text-mf-muted">Balance</div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-mf-muted">L</span>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  value={settings.eqBalance}
                  onChange={(e) => void update({ eqBalance: Number(e.target.value), eqEnabled: true })}
                  className="knob-range flex-1"
                />
                <span className="text-xs text-mf-muted">R</span>
              </div>
              <div className="mt-2 text-center text-xs text-mf-muted">{settings.eqBalance}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Knob({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="mb-3 text-sm text-mf-muted">{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="knob-range w-full"
      />
      <div className="mt-2 text-center text-xs text-mf-muted">{value}</div>
    </div>
  )
}
