# Campfire Best Practices (37signals Rails style)

Purpose: Teach an AI assistant to generate Rails code in the style of
37signals’ Campfire app: pragmatic, model-centric, Hotwire-first, minimal
abstraction, and production-ready. Follow these rules and patterns when building
new features.

## Core philosophy
- Prefer Rails defaults and simple, direct code over heavy abstractions.
- Keep domain logic in rich Active Record models; organize with small concerns.
- Embrace Hotwire (Turbo + Stimulus) to keep JS lean; render HTML on the server.
- Use background jobs sparingly; when used, keep them thin and idempotent.
- Optimize for readability and operability. Use transactions, scopes, and
  callbacks intentionally.
- Favor conventions: RESTful resources, Rails naming, Zeitwerk autoloading.

## Tech stack and dependencies
- Rails (edge when appropriate; configs use `config.load_defaults 7.0`).
- Assets: Propshaft for pipeline; Importmap for ESM without bundling.
- Hotwire: `turbo-rails`, `stimulus-rails`.
- Data/infra: PostgreSQL/SQLite (dev/test), Redis for Action Cable + Kredis,
  Resque for jobs (with resque-pool), Active Storage, Action Text.
- Push notifications: `web-push` (VAPID keys), custom connection pool.
- Telemetry: `sentry-ruby` + `sentry-rails` (privacy-friendly defaults).
- Other gems seen in Campfire: `rails_autolink`, `geared_pagination`, `kredis`,
  `net-http-persistent`, `platform_agent`, `thruster` (HTTP/2 proxy).

References when needed (up-to-date):
- Propshaft: github.com/rails/propshaft
- Importmap: github.com/rails/importmap-rails
- Turbo: github.com/hotwired/turbo-rails
- Stimulus: github.com/hotwired/stimulus-rails
- Resque: github.com/resque/resque, resque-pool: github.com/resque/resque-pool
- Kredis: github.com/rails/kredis
- Geared Pagination: github.com/basecamp/geared_pagination
- Web Push: rubygems.org/gems/web-push, github.com/pushpad/web-push
- PlatformAgent: github.com/basecamp/platform_agent

## Application configuration
- Use SQL schema format if needed for DB objects beyond tables:
  `config.active_record.schema_format = :sql`.
- I18n fallbacks enabled.
- Action Cable via Redis; `cable.yml` sets environment-specific prefixes.
- In production set `config.active_job.queue_adapter = :resque`.
- Emit `X-Version` and `X-Rev` headers from an initializer using
  `Rails.application.config.app_version` and `git_revision` environment values.

## Authentication and sessions
- Keep a `Current` attributes class with `user` and `request` context; delegate
  host/protocol.
- In controllers include small concerns:
  - Authentication: restore session by secure cookie; fall back to redirect to
    login. Support optional bot auth by `bot_key` parameter. Expose
    `signed_in?` helper. Set `@authenticated_by` as an Inquiry ("session",
    "bot_key", or blank). Protect from CSRF except for bot requests.
  - Authorization: simple gate like `ensure_can_administer` using
    `Current.user.can_administer?(record)`; default rule is admin, creator, or
    new record.
  - SetCurrentRequest: set `Current.request` in a `before_action` and declare
    `default_url_options` from it.
  - SetPlatform: expose a `platform` helper using `ApplicationPlatform` (from
    PlatformAgent) to branch UI based on OS/browser/app.
  - TrackedRoomVisit: remember last visited room via signed cookies.
  - VersionHeaders: add response headers with app version and git revision.
- Sessions are durable via `cookies.signed.permanent[:session_token]`.

## Browser support gating
- Enforce minimum browser versions early at controller-level. Use a helper like
  `allow_browser versions: {...}, block: -> { render template: "sessions/incompatible_browser" }`.
  Render a friendly page for unsupported browsers.

## Domain modeling
- Keep models rich; break behavior into concerns under `app/models/<entity>/`.
  Examples from Campfire:
  - Message: `Attachment`, `Broadcasts`, `Mentionee`, `Pagination`, `Searchable`.
  - Room: membership management (`grant_to`, `revoke_from`, `revise`), role
    methods (`open?`, `closed?`, `direct?`), and event hooks (`receive`).
  - User: `Avatar`, `Bot`, `Mentionable`, `Role`, `Transferable`.
- Defaults and creators:
  - Use `belongs_to :creator, class_name: "User", default: -> { Current.user }`.
  - Derive presentation helpers like `initials`, `title` directly on the model.
- Scopes: prefer composable small scopes (`ordered`, `with_creator`, domain
  filters). Keep pagination as model scopes (e.g., `last_page`, `page_after`).
- Transactions: wrap multi-step mutations (`Room.create_for`) and maintain
  invariants.
- Bulk operations: use `insert_all` when granting many memberships.
- Callbacks: use lifecycle callbacks for reactive behavior:
  - `Message`: `after_create_commit { room.receive(self) }` to push unread and
    queue push notifications.
  - `Rooms::Open`: on type change, grant access to all active users.
- Enums: use `enum` with `_prefix` where helpful (`Membership.involved_in_*`).

## Controllers (RESTful, Turbo-aware)
- Keep controllers skinny and declarative:
  - Load resources in `before_action` (scoped to `Current.user` where needed).
  - Use `head :forbidden` for authorization denials; redirect on not found.
  - Rely on model callbacks for side effects; controllers mainly orchestrate.
- Turbo Streams:
  - Broadcast UI updates from models where appropriate. From controllers, use
    `broadcast_*_to` helpers with targets/partials, passing attributes like
    `{ maintain_scroll: true }` when updating lists.
  - Respond with Turbo Stream templates (`create.turbo_stream.erb`) for create/
    destroy where needed.
- Caching and conditional GETs:
  - Use `fresh_when @records` for index fragments; return `:no_content` when
    empty.
- Pagination:
  - For message feeds, accept `before` / `after` params and delegate to model
    pagination scopes. Default to `last_page`.

## Views (server-rendered HTML, fragmentable)
- Partial-first. Break message items into small partials (`_message`,
  `_presentation`, `_actions`, etc.).
- Use Turbo Frames/Streams to incrementally update UI; don’t overuse custom JS
  when a frame/stream will do.
- Keep layouts minimal; add a `turbo-cable-stream-source` where broadcasts are
  consumed.
- Provide a PWA setup: webmanifest, service worker endpoint.

## Action Cable (real-time)
- Define channels for live updates: room streams, presence, typing, unread.
- Authenticate in `ApplicationCable::Connection` by session cookie. Reject
  unauthorized connections.
- On subscribe, find resource scoped to `current_user`; call `stream_for` the
  record.

## Background jobs (Resque + Active Job)
- Use Active Job subclasses (e.g., `Room::PushMessageJob`) and queue via
  `perform_later`. Set adapter to `:resque` in production.
- Jobs should be thin: hand off to POROs (e.g., `Room::MessagePusher.new(...).push`).
- resque-pool: configure `config/resque-pool.yml` with queue concurrency per
  environment. Use signals/semantics from resque/resque-pool for deploys.

## Push notifications (Web Push)
- Store web push subscriptions per user; enqueue delivery on message creation.
- Build payloads depending on room type (direct vs shared). Include title,
  body, and deep-link path.
- Use a pooled delivery mechanism that batches and reuses HTTP/2 connections
  (`Net::HTTP::Persistent`) and handles invalidation of expired subscriptions.
- Configure VAPID keys in an initializer from env/credentials; clean up invalid
  subscriptions asynchronously.

## Security and networking
- Block SSRF to private networks for outbound HTTP (OpenGraph, unfurling, etc.).
  Resolve host to IP and reject private/loopback ranges before requests.
- Set strict Content Security Policy and Permissions Policy in initializers.
- Sanitize Action Text embeds and filter content (custom helper filters).

## JavaScript (Importmap + Stimulus)
- Pin modules in `config/importmap.rb`; preload app controllers and helpers via
  `pin_all_from` for app/javascript subtrees.
- Entry point is `app/javascript/application.js`; start Stimulus and import
  controllers via index loader.
- Write small, focused Stimulus controllers named after UI behaviors (e.g.,
  `maintain_scroll_controller`, `messages_controller`, `notifications_controller`).
- Use helpers for small DOM utilities; avoid monolithic JS.

## Assets (Propshaft)
- Use Propshaft helpers (`asset_path`, `image_tag`, etc.). In JS, reference
  assets via `RAILS_ASSET_URL("/icons/trash.svg")` when needed so digested
  names resolve in production.
- Consider enabling SRI when shipping from CDN or for stricter integrity.

## Pagination (Geared Pagination)
- Use geared pagination to serve small first pages and larger subsequent pages
  for infinite scrolling UIs.
- Optionally switch to cursor-based pagination for deep pages with proper
  ordering and indexes.

## Testing
- Minitest with fixtures. Use Turbo test helpers to wait for stream sources to
  connect when asserting on broadcasts or system behavior.
- Include `ActiveJob::TestHelper` and `ActionCable::TestHelper` in model tests
  that depend on jobs or broadcasts.

## Performance
- Use `includes` for N+1s (`with_creator`), and simple `order("LOWER(name)")`
  for case-insensitive sorts.
- Broadcast only the necessary partial/stream updates; prefer small targets.
- Use `insert_all` for bulk inserts; avoid per-record callbacks when safe.
- Use connection/thread pools for external HTTP (push) with bounded queues.

## PWA
- Provide a lightweight manifest and service worker endpoint (via controller);
  register the SW client-side.
- Add a settings partial to guide users in enabling notifications/installing.

## Environment and configuration
- Required environment/credentials (provide defaults in dev):
  - `APP_VERSION`, `GIT_REVISION` for headers and Sentry `release`.
  - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` for Web Push.
  - Redis URL for Action Cable and Kredis.
  - Database configs per environment.
  - `SKIP_TELEMETRY` to disable Sentry in production when needed.
- Keep secrets in credentials or `.env` (never commit). Rotate keys on exposure.

## Controller design checklist
- [ ] Include `Authentication`, `Authorization`, `SetCurrentRequest`,
      `SetPlatform`, `TrackedRoomVisit`, `VersionHeaders` as needed.
- [ ] Scope queries by `Current.user`.
- [ ] Use `before_action` to load resources; redirect or `head :forbidden` for
      failures.
- [ ] Render Turbo Streams or partials; avoid JSON APIs unless necessary.
- [ ] Use strong params; keep permitted attributes minimal.

## Model design checklist
- [ ] Prefer rich models; extract cohesive concerns under `app/models/<entity>`.
- [ ] Use transactions for multi-record changes.
- [ ] Leverage `after_create_commit`/`after_save_commit` for reactive updates.
- [ ] Provide composable scopes; avoid query objects unless unavoidable.
- [ ] Consider bulk operations and background work for fan-out.

## Hotwire checklist
- [ ] Stream from key resources in views (`turbo_stream_from`).
- [ ] Broadcast on create/update/destroy with clear target ids.
- [ ] Use Stimulus for small interactions; no front-end framework needed.

## Background jobs checklist
- [ ] Enqueue via `perform_later`; keep job code tiny; delegate to POROs.
- [ ] Ensure idempotency and safe retries.
- [ ] Configure resque-pool concurrency; use signals for deploys; prefer
      graceful shutdown.

## Push notifications checklist
- [ ] Persist subscriptions per user; prune on invalidation callbacks.
- [ ] Build payloads from domain objects; deep link via Rails path helpers.
- [ ] Pool HTTP connections; bound thread pools; handle errors.

## Code style and hygiene
- Follow RuboCop Rails Omakase where applicable; wrap Markdown ~100 chars.
- Rails naming conventions (snake_case files; CamelCase classes; tests under
  `test/**/*_test.rb`).
- Don’t log secrets/PII; raise/rescue narrowly with actionable messages.
- Keep concerns small; avoid `require_relative` under `app/` (use Zeitwerk).

## Deployment
- Puma for app server. Optionally front with Thruster (HTTP/2, TLS via
  Let’s Encrypt, basic asset caching, compression, X-Sendfile). Provide
  `TLS_DOMAIN` if enabling TLS.
- Action Cable via Redis; ensure cable endpoints are reachable.
- Precompile assets with Propshaft; ensure importmap pins are up to date.

## When to introduce abstractions
- Only after duplication and pain are clear. Prefer POROs over service layers;
  keep API surfaces tiny. Avoid fancy patterns if a direct method on the model
  suffices.

By following these guidelines, generated code should closely match the
Campfire style: idiomatic Rails, rich models, thin controllers, Hotwire UI,
Resque-backed jobs, and pragmatic production-readiness.
