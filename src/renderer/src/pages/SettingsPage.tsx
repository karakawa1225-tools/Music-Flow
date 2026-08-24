import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FolderPlus, LogOut, RefreshCw, Trash2, Upload } from 'lucide-react'
import { APP_NAME, APP_TAGLINE, APP_VERSION } from '@shared/types'
import { isWebRuntime } from '@shared/platform'
import { useLibraryStore } from '@renderer/stores/libraryStore'
import { cn } from '@renderer/lib/utils'

const TABS = [
  { id: 'general', label: '一般' },
  { id: 'playback', label: '再生' },
  { id: 'library', label: 'ライブラリ' },
  { id: 'display', label: '表示' },
  { id: 'shortcut', label: 'ショートカット' },
  { id: 'info', label: '情報' }
] as const

type TabId = (typeof TABS)[number]['id']

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initial = (searchParams.get('tab') as TabId) || 'general'
  const [tab, setTab] = useState<TabId>(initial)
  const settings = useLibraryStore((s) => s.settings)
  const setSettings = useLibraryStore((s) => s.setSettings)
  const folders = useLibraryStore((s) => s.folders)
  const addFolder = useLibraryStore((s) => s.addFolder)
  const removeFolder = useLibraryStore((s) => s.removeFolder)
  const scanLibrary = useLibraryStore((s) => s.scanLibrary)
  const scanProgress = useLibraryStore((s) => s.scanProgress)
  const refreshLibrary = useLibraryStore((s) => s.refreshLibrary)
  const web = isWebRuntime()
  const [authEmail, setAuthEmail] = useState<string | null>(null)

  useEffect(() => {
    const t = searchParams.get('tab') as TabId | null
    if (t && TABS.some((x) => x.id === t)) setTab(t)
  }, [searchParams])

  useEffect(() => {
    if (!web) return
    void window.musicFlow.getAuthEmail?.().then((email) => setAuthEmail(email))
  }, [web])

  const switchTab = (id: TabId) => {
    setTab(id)
    setSearchParams({ tab: id })
  }

  return (
    <div className="page-enter">
      <h1 className="mb-6 font-display text-2xl font-semibold">設定</h1>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-white/5 pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchTab(t.id)}
            className={cn(
              'rounded-xl px-4 py-2 text-sm',
              tab === t.id ? 'bg-mf-accent text-white' : 'text-mf-muted hover:bg-white/5'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <section className="max-w-2xl space-y-4">
          {web ? (
            <div className="rounded-2xl border border-white/5 bg-mf-surface/40 p-4">
              <div className="text-sm font-medium">クラウドアカウント</div>
              <p className="mt-1 text-sm text-mf-muted">{authEmail ?? 'ログイン中'}</p>
              <button
                type="button"
                onClick={() => void window.musicFlow.signOut?.()}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
              >
                <LogOut className="h-4 w-4" />
                ログアウト
              </button>
            </div>
          ) : (
            <>
              <Toggle
                label="Windows起動時に起動"
                checked={settings.launchAtStartup}
                onChange={(v) => void setSettings({ launchAtStartup: v })}
              />
              <Toggle
                label="システムトレイに最小化"
                checked={settings.minimizeToTray}
                onChange={(v) => void setSettings({ minimizeToTray: v })}
              />
            </>
          )}
          <Toggle
            label="アプリ起動時に最後の状態を復元"
            checked={settings.restoreLastState}
            onChange={(v) => void setSettings({ restoreLastState: v })}
          />
          <Toggle
            label="アニメーションを有効にする"
            checked={settings.enableAnimations}
            onChange={(v) => void setSettings({ enableAnimations: v })}
          />
          {!web ? (
            <Toggle
              label="ハードウェアアクセラレーション"
              checked={settings.hardwareAcceleration}
              onChange={(v) => void setSettings({ hardwareAcceleration: v })}
            />
          ) : null}
        </section>
      )}

      {tab === 'playback' && (
        <section className="max-w-2xl space-y-4">
          <div className="rounded-2xl border border-white/5 bg-mf-surface/40 p-4 text-sm text-mf-muted">
            シャッフル / リピート / 音量はプレイヤーから変更でき、自動保存されます。
            Crossfade などの高度な再生機能は Version 2 で追加予定です。
          </div>
          <div>
            <div className="mb-2 text-sm">デフォルト音量</div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={settings.volume}
              onChange={(e) => void setSettings({ volume: Number(e.target.value) })}
              className="knob-range w-full max-w-md"
            />
          </div>
        </section>
      )}

      {tab === 'library' && (
        <section className="max-w-3xl space-y-6">
          {web ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-medium">クラウドライブラリ</h2>
                <button
                  type="button"
                  onClick={() =>
                    void window.musicFlow.selectMp3Files().then(() => refreshLibrary())
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-mf-accent px-3 py-2 text-sm font-semibold text-white"
                >
                  <Upload className="h-4 w-4" />
                  MP3をアップロード
                </button>
              </div>
              <p className="text-sm text-mf-muted">
                アップロードした音源はサーバーに保存され、メタデータは Turso（libSQL）に記録されます。
                ドラッグ＆ドロップでも追加できます。
              </p>
              {scanProgress.phase !== 'idle' ? (
                <p className="mt-3 text-sm text-mf-muted">
                  {scanProgress.message}
                  {scanProgress.total > 0
                    ? ` (${scanProgress.current.toLocaleString()} / ${scanProgress.total.toLocaleString()})`
                    : ''}
                </p>
              ) : null}
            </div>
          ) : (
            <>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium">登録音楽フォルダ</h2>
              <button
                type="button"
                onClick={() => void addFolder()}
                className="inline-flex items-center gap-2 rounded-xl bg-mf-accent px-3 py-2 text-sm font-semibold text-white"
              >
                <FolderPlus className="h-4 w-4" />
                フォルダを追加
              </button>
            </div>
            <div className="space-y-2">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-mf-elevated/50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm">{folder.path}</div>
                    <div className="text-xs text-mf-muted">
                      最終スキャン: {folder.lastScannedAt ?? '未スキャン'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeFolder(folder.id)}
                    className="rounded-lg p-2 text-mf-muted hover:bg-white/5 hover:text-mf-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {!folders.length ? (
                <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-mf-muted">
                  音楽フォルダが登録されていません
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => void scanLibrary()}
              disabled={scanProgress.phase === 'scanning' || scanProgress.phase === 'parsing'}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              ライブラリをスキャン
            </button>
            {scanProgress.phase !== 'idle' ? (
              <p className="mt-3 text-sm text-mf-muted">
                {scanProgress.message}
                {scanProgress.total > 0
                  ? ` (${scanProgress.current.toLocaleString()} / ${scanProgress.total.toLocaleString()})`
                  : ''}
              </p>
            ) : null}
          </div>
            </>
          )}
        </section>
      )}

      {tab === 'display' && (
        <section className="max-w-xl space-y-4">
          <div className="text-sm text-mf-muted">テーマ（Version 1 はダークがデフォルト）</div>
          {(['dark', 'light', 'system'] as const).map((theme) => (
            <label key={theme} className="flex items-center gap-3 text-sm">
              <input
                type="radio"
                name="theme"
                checked={settings.theme === theme}
                onChange={() => void setSettings({ theme })}
              />
              {theme === 'dark' ? 'ダーク' : theme === 'light' ? 'ライト' : 'システム設定に従う'}
            </label>
          ))}
        </section>
      )}

      {tab === 'shortcut' && (
        <section className="max-w-xl space-y-3 text-sm">
          <Row keys="Space" action="再生 / 一時停止" />
          <Row keys="Ctrl + Right" action="次の曲" />
          <Row keys="Ctrl + Left" action="前の曲" />
          <Row keys="Ctrl + L" action="検索" />
          <Row keys="Ctrl + F" action="お気に入り" />
          <Row keys="Ctrl + P" action="プレイリスト" />
          <Row keys="Ctrl + E" action="EQ" />
          <p className="pt-2 text-mf-muted">ショートカットのカスタマイズは Version 2 で対応予定です。</p>
        </section>
      )}

      {tab === 'info' && (
        <section className="max-w-xl space-y-3">
          <div className="font-display text-3xl font-semibold">{APP_NAME}</div>
          <div className="text-mf-muted">{APP_TAGLINE}</div>
          <div className="text-sm text-mf-muted">
            Version {APP_VERSION}
            {web ? ' · Web' : ' · Desktop'}
          </div>
          <div className="pt-4 text-sm text-mf-muted">
            {web
              ? 'クラウドに保存したMP3をブラウザからストリーミング再生するWebアプリです。'
              : 'ローカルMP3ライブラリのためのデスクトップ音楽アプリ。元の音楽ファイルは変更・移動・削除しません。'}
          </div>
        </section>
      )}
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-white/5 bg-mf-surface/40 px-4 py-3 text-sm">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 rounded-full transition',
          checked ? 'bg-mf-accent' : 'bg-white/15'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white transition',
            checked ? 'left-5' : 'left-0.5'
          )}
        />
      </button>
    </label>
  )
}

function Row({ keys, action }: { keys: string; action: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-mf-surface/40 px-4 py-3">
      <span>{action}</span>
      <kbd className="rounded-lg bg-mf-elevated px-2 py-1 text-xs text-mf-muted">{keys}</kbd>
    </div>
  )
}
