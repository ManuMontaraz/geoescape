# GeoEscape — Agent Context

AGPL-3.0-or-later. Copyright (C) 2026 Manuel Arjona Blanco.

## Architecture

- **Frontend**: Vanilla HTML5/JS/CSS. No build system, no bundler, no npm.
- **Backend**: PHP 8.x + MySQL/MariaDB. No framework (plain PDO).
- **Game engine**: Custom HTML5 Canvas renderer (`js/engine/`).
- **Editor**: Custom DOM + Canvas editor (`js/editor/`).
- **Offline**: Service Worker (`sw.js`) + IndexedDB (`js/core/db.js`).

## Entry Points

| File | Purpose |
|------|---------|
| `index.html` | Main menu, SEO-landing, login/register, footer legal |
| `game.html` | Game player (loads campaign from `localStorage.ge_campaign_json`) |
| `editor.html` | Campaign editor (requires auth session) |
| `play.html` | Invitation link handler (`?uuid=xxx`) downloads JSON and redirects to `game.html` |
| `api/setup` | One-time DB setup script (creates DB, user, tables) |

## Database Setup

1. Ensure `api/.env` exists (copied from `.env.example` if needed).
2. Run `https://yoursite.com/api/setup` once as root. It creates DB + app user + tables.
3. Delete `api/setup` after use (security).
4. Tables: `users`, `campaigns`, `campaign_votes`, `password_resets`, `php_sessions`.

## `.env` Location & Contents

- **Production**: `api/.env` (gitignored; contains DB creds, SMTP, session config, legal data).
- **Never commit** `api/.env` or any `.env`. They are in `.gitignore`.
- Legal pages (`aviso-legal.php`, `privacidad.php`, etc.) read from `api/.env`.

## Campaign JSON Flow

```
Editor → localStorage.ge_campaign_json → game.html
              ↓
         Upload to cloud (api/campaigns/save.php)
              ↓
         UUID stored in localStorage.ge_cloud_uuid
```

- `campaign_id` in JSON is a UUID generated client-side.
- Backend uses `$_SESSION['username']` as author in DB.
- `uploadCampaign()` reuses `ge_cloud_uuid` to overwrite existing cloud campaign, never creating duplicates.

## Key Conventions

### UUID Persistence
- `newCampaign()` clears `ge_cloud_uuid`.
- `importFile()` clears `ge_cloud_uuid` (new local copy).
- `loadCloudCampaign()` sets `ge_cloud_uuid` to loaded UUID.
- `uploadCampaign()` reuses `ge_cloud_uuid` if present before generating a new UUID.

### Auto-Save
- Editor auto-saves on input/change with 500ms debounce.
- `_doAutoSave()` calls `saveForm()` + toast.
- Dialogue modals (`DialogueModal`) auto-save on every keystroke (debounce 500ms) and on close.

### Action System
- Actions are sequential via `actionQueue` + `isProcessingQueue` in `GameEngine`.
- `textOverlay.onComplete` triggers `_processNextAction()`.
- `dialogueBox` options enqueue their actions and continue the queue on close.
- During dialogue/text-overlay, UI buttons are blocked (`dialogueBox.isOpen || textOverlay.isOpen`).

### Testing Mode
- `game.html?test=1` enables GPS simulator.
- Test mode skips "continue saved game?" prompt.
- Only allowed for campaign owner or public campaigns (`check-owner.php`).

### Stale Selection Guard
- Editor scene elements (areas/NPCs) can be deleted while selected.
- `_validateSceneSelection(loc)` checks if selected index still exists; clears selection if stale.
- Applied in: `saveLocationForm`, `_renderSceneProperties`, `_updateScenePropertyInputs`, `_hitTestResizeHandle`, `_onSceneMouseDown`, `updateSceneFromProps`.

## Important Files

| Path | Role |
|------|------|
| `js/engine/renderer.js` | Game engine: canvas rendering, action queue, dialogue, NPCs, minigames |
| `js/editor/editor.js` | Campaign editor: map, scene canvas, action blocks, forms |
| `js/editor/dialogueModal.js` | Recursive dialogue editor modals with auto-save |
| `js/engine/dialogueBox.js` | In-game dialogue system with options |
| `js/engine/textOverlay.js` | Sequential text display with queue |
| `js/core/db.js` | IndexedDB wrapper (campaigns, progress) |
| `sw.js` | Service Worker: cache-first for static assets, network-only for `/api/` |
| `api/campaigns/save.php` | Cloud save with error handling and JSON validation |
| `api/config/session.php` | MariaDB-backed PHP sessions |

## SEO / Legal

- Only `index.html` is indexable. All other pages have `<meta robots="noindex">` or `X-Robots-Tag: noindex`.
- Legal docs are PHP reading `api/.env`: `aviso-legal.php`, `privacidad.php`, `cookies.php`, `terminos.php`.
- Cookies: only `PHPSESSID` (technical). No third-party cookies. Banner is informative only.

## Common Pitfalls

1. **Dialogue JSON circular references**: `_cleanActionForJSON()` strips `_`-prefixed properties before stringify.
2. **GPS type in DB**: Column is `ENUM('relative','absolute')`. Client sends `'relative'` or `'absolute'`; server validates with `in_array(...)`.
3. **Condition evaluation**: `_evaluateSingleCondition` skips empty `var` values (`''`, `null`, `undefined`) to avoid false negatives.
4. **Asset paths**: `AssetResolver` uses `assets/images/icons/` for global icons. Campaign-specific custom icons are at `assets/campaigns_custom/{campaign_id}/images/icons/`.
5. **No Node.js build**: Do not add webpack, vite, etc. This is plain static-file hosting.
