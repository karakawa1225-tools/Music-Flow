# MUSIC FLOW Web（Turso / libSQL）

メタデータは **Turso（またはローカル libSQL）**、認証は API の JWT、音声ファイルは `data/audio/` です。Supabase は使いません。

## 起動

```bash
copy .env.example .env
npm run dev:web
```

- Web: http://localhost:5174  
- API: http://localhost:8787  

Turso 未設定でも `data/music-flow.db` で動きます。

## Turso リモート接続

1. Turso で DB 作成（例: `music-flow`）
2. トークン発行
3. `.env` に追加:

```env
TURSO_DATABASE_URL=libsql://music-flow-xxxx.turso.io
TURSO_AUTH_TOKEN=...
JWT_SECRET=長いランダム文字列
```

4. API 再起動（起動時に `turso/schema.sql` を自動適用）

手動適用する場合:

```bash
turso db shell music-flow < turso/schema.sql
```

## できること

- メール＋パスワード登録 / ログイン
- MP3 アップロード・ストリーミング（Range 対応）
- ライブラリ / プレイリスト / お気に入り
