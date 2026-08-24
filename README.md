# MUSIC FLOW

Your Music. Your Library. Your Flow.

ローカルMP3デスクトップアプリ＋ Turso 対応の Web アプリ（Version 2）。

## 技術構成

- **Desktop**: Electron + React + TypeScript + Vite / sql.js
- **Web**: 同じUI + Hono API + Turso/libSQL
- Tailwind CSS / Web Audio API（再生 / EQ）

## 開発

### デスクトップ

```bash
npm install
npm run dev
```

### Web（Turso）

詳細は [docs/WEB.md](docs/WEB.md)。

```bash
copy .env.example .env
npm run dev:web
```

- Web: http://localhost:5174
- API: http://localhost:8787

未設定時はローカル `data/music-flow.db` を使います。Turso を使う場合は `.env` に `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` を設定してください。

## 他のPC用インストーラー（EXE）作成

```bash
npm run dist
```

## ビルド

```bash
npm run build       # Desktop
npm run build:web   # Web → dist-web/
```
