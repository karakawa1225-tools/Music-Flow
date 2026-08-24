import { FormEvent, useEffect, useState } from 'react'
import { apiFetch, getToken, setToken } from './apiClient'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setAuthed(false)
      setSessionReady(true)
      return
    }
    void apiFetch<{ user: { email: string } }>('/api/auth/me')
      .then(() => setAuthed(true))
      .catch(() => {
        setToken(null)
        setAuthed(false)
      })
      .finally(() => setSessionReady(true))
  }, [])

  if (!sessionReady) {
    return (
      <Shell>
        <div className="font-display text-2xl font-semibold">MUSIC FLOW</div>
        <div className="mt-2 text-sm text-mf-muted">セッションを確認しています...</div>
      </Shell>
    )
  }

  if (!authed) {
    const onSubmit = async (e: FormEvent) => {
      e.preventDefault()
      setBusy(true)
      setError(null)
      try {
        const path = mode === 'signin' ? '/api/auth/signin' : '/api/auth/signup'
        const data = await apiFetch<{ token: string }>(path, {
          method: 'POST',
          body: JSON.stringify({ email, password })
        })
        setToken(data.token)
        setAuthed(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : '認証に失敗しました')
      } finally {
        setBusy(false)
      }
    }

    return (
      <Shell>
        <h1 className="font-display text-3xl font-semibold">MUSIC FLOW</h1>
        <p className="mt-2 text-sm text-mf-muted">Turso クラウドライブラリにログイン</p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-8 w-full max-w-sm space-y-3 text-left">
          <label className="block text-xs text-mf-muted">
            メール
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-mf-elevated px-3 py-2 text-sm text-mf-text outline-none focus:border-mf-accent"
            />
          </label>
          <label className="block text-xs text-mf-muted">
            パスワード（6文字以上）
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-mf-elevated px-3 py-2 text-sm text-mf-text outline-none focus:border-mf-accent"
            />
          </label>
          {error ? <p className="text-sm text-mf-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-mf-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-mf-accent-hover disabled:opacity-60"
          >
            {busy ? '処理中...' : mode === 'signin' ? 'ログイン' : 'アカウント作成'}
          </button>
        </form>

        <button
          type="button"
          className="mt-4 text-sm text-mf-muted hover:text-mf-text"
          onClick={() => {
            setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
            setError(null)
          }}
        >
          {mode === 'signin' ? 'アカウントを作成' : 'ログインに戻る'}
        </button>
      </Shell>
    )
  }

  return <>{children}</>
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-mf-bg px-6 text-center">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
