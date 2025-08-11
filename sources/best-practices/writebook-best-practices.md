# Writebook Best Practices (37signals Rails style)

Purpose: Equip an AI assistant to generate Rails code in the style of 37signals’
Writebook app: pragmatic, model‑centric, Hotwire‑first, minimal abstractions,
excellent editor UX, and production readiness.

## Core philosophy
- Prefer Rails conventions and straightforward code over custom frameworks.
- Keep domain logic in rich Active Record models with small, focused concerns.
- Render HTML on the server; use Hotwire (Turbo + Stimulus) for interactivity.
- Design for public reading + authenticated editing access.
- Optimize for operability: transactions, scopes, callbacks; avoid over‑engineering.

## Stack
- Rails (7.2+ defaults).
- Asset pipeline: Propshaft.
- JavaScript without bundling: Importmap.
- Hotwire: turbo-rails, stimulus-rails.
- Markdown editing: Redcarpet + custom renderer + Rouge highlighting; custom
  ActionText::Markdown record and helpers; House editor JS (`house.min.js`).
- Data: SQLite by default (including FTS usage via custom table); Active Storage
  for uploads; Action Cable via Redis.
- Background jobs: Resque + resque-pool (production adapter set to :resque).
- Deployment: Puma; optional Thruster proxy for HTTP/2 + TLS.

References
- Redcarpet: github.com/vmg/redcarpet (v3.6+)
- Rouge: github.com/rouge-ruby/rouge (v4.6+)
- Turbo: github.com/hotwired/turbo-rails
- Stimulus: github.com/hotwired/stimulus-rails
- Propshaft: github.com/rails/propshaft
- Importmap: github.com/rails/importmap-rails
- Resque/resque-pool: github.com/resque/resque, github.com/resque/resque-pool

## App configuration
- `config.load_defaults 7.2`.
- Autoload lib subdirs except rails_ext, assets, tasks: `config.autoload_lib(ignore: %w[rails_ext assets tasks])`.
- Opt in to Active Support 8.0 timezone behavior:
  `config.active_support.to_time_preserves_timezone = :zone`.
- Action Cable uses Redis; env‑specific `cable.yml` with prefix for production.
- Production:
  - `config.active_job.queue_adapter = :resque`.
  - Redis cache store; public file server with long cache headers.
  - Assume/force SSL by default (toggle with DISABLE_SSL).
  - I18n fallbacks.
- Version headers: set X‑Version and X‑Rev from env in a before_action concern.

## Browser support gating
- Enforce modern browser features via `allow_browser versions: :modern` in
  ApplicationController to simplify CSS/JS assumptions (webp, import maps, CSS
  nesting, :has, etc.). Render a friendly fallback if blocked.

## Auth, sessions, and Current
- Authentication concern:
  - Cookie session token; `Current.user` set on restore.
  - `require_unauthenticated_access` and `allow_unauthenticated_access` helpers
    for controllers that are public or sign‑in pages.
  - Durable `cookies.signed.permanent[:session_token]`; `post_authenticating_url`
    for returning after login.
- Session model: `has_secure_token`, `resume` refreshing activity hourly.
- Current: provides `user` and `account` helpers for ambient context.

## Authorization
- Keep simple gates in a shared concern (in Writebook: under app/models/concerns):
  - `ensure_can_administer` for admin‑only.
  - `ensure_current_user` when limiting to self service.
- Book‑level authorization lives on the model (`editable?`, `access_for`).

## Domain model
- Book: includes `Accessable`, `Sluggable`.
  - Associations: `has_many :leaves`, `has_one_attached :cover`.
  - Scopes: `ordered`, `published`, `with_everyone_access`.
  - Theme as an enum; `press(leafable, params)` to create a leaf around a leafable.
  - Access management via `update_access(editors:, readers:)` computes full set
    and upserts; respects `everyone_access` readers.
- Access: join model for `user`↔`book` with enum `level: reader|editor`.
- User: includes Role + Transferable; `has_secure_password` (no default validations)
  and `has_many :sessions`; `has_many :accesses`→`books`; `after_create` grants
  access to `Book.with_everyone_access` via bulk `insert_all`.
- Leaf: the unit wrapping actual content types; includes `Editable`, `Positionable`,
  `Searchable`.
  - Delegated types to leafables: `Page`, `Section`, `Picture` (see `Leafable::TYPES`).
  - Positioned within a `book` using a score (`position_score`) with rebalancing.
  - Status enum (`active|trashed`), scope `with_leafables` eager loads.
  - Slug computed from `title`.
- Leafable concern:
  - Each concrete leafable `has_one :leaf` and `has_one :book, through: :leaf`.
  - `leafable_name` for routing helpers and polymorphic view partials.
- Page (example leafable):
  - `has_markdown :body` (custom ActionText::Markdown record), `searchable_content`
    returns plain text derived from rendered markdown, `html_preview` renders an
    excerpt using Redcarpet.

## Markdown pipeline
- A custom `ActionText::Markdown` record type encapsulates markdown content and
  rendering, with:
  - DEFAULT_RENDERER_OPTIONS and DEFAULT_MARKDOWN_EXTENSIONS matching Redcarpet
    options for modern Markdown (autolink, fenced code blocks, tables, etc.).
  - A pluggable renderer via `ActionText::Markdown.renderer`, defaulting to
    Redcarpet + custom renderer.
- `ActionText::HasMarkdown` adds `has_markdown :attr` to models with helpers:
  - Accessor methods, an autosaved `markdown_attr` association, and scopes that
    include attachments.
- `MarkdownRenderer` inherits `Redcarpet::Render::HTML` and includes
  `Rouge::Plugins::Redcarpet` for syntax highlighting. It:
  - Adds unique header anchors and link symbols.
  - Wraps images with a lightbox anchor and supports attachment disposition.
  - Provides `.build` returning a memoizable Redcarpet::Markdown instance.
- Tag helpers for the in‑house editor (House):
  - `markdown_area` injects a `<house-md>` element with `uploads_url` for AJAX
    attachment; `house_toolbar*` helpers generate toolbar UI.
- Uploads
  - Active Storage attachments gain a slug (`ActiveStorage::Sluggable`) that
    produces stable, readable URLs for embedded assets.
  - Controller for uploads: accepts a signed GID (record + attribute_name),
    attaches file to the ActionText::Markdown uploads, and renders JSON with
    the attachment representation; GET resolves by slug and redirects to blob
    URL with long cache (1 year, public).

## Search
- `Leaf::Searchable` implements a lightweight FTS index in SQLite:
  - `leaf_search_index` table (FTS) maintained via raw SQL on create/update/destroy.
  - Query helpers sanitize terms by removing invalid characters and unbalanced
    quotes. Results join the virtual table and select `highlight`/`snippet`
    columns; `bm25` used to favor titles.
  - Instance method `matches_for_highlight` returns unique marked terms for view
    highlighting.

## Positioning
- `Positionable` uses a numeric `position_score` and calculates gaps when moving
  elements (and followers) to a target offset; rebalances scores when gaps shrink
  below a threshold. Locking at parent (`book.with_lock`) ensures consistency.

## Controllers and routing
- RESTful resources for books, sections, pages, pictures; nested under books.
- Public reading routes:
  - `/:id/:slug` resolves books by numeric id and slug; `leafables#show` resolves
    a specific leaf by book and leaf id + slugs.
  - `direct` helpers (`book_slug`, `leafable_slug`, `leafable`, `edit_leafable`)
    centralize path generation for cleaner URL building from models and views.
- BooksController patterns:
  - `allow_unauthenticated_access` for index/show; block access to an empty index
    unless signed in.
  - `@book.leaves.active.with_leafables.positioned` for show view lists.
  - `update_accesses` composes editor/reader ids from form params and current user.
  - `redirect_to book_slug_url(@book)` after create/update/destroy.
- PublicationsController:
  - Admin/editable guard; simple toggling of `published` and `slug` with redirect
    to slugged URL.
- SearchesController:
  - Public search within a book: `@book.leaves.active.search(params[:search]).favoring_title.limit(50)`.
- ActionText::Markdown::UploadsController:
  - Sets `ActiveStorage::Current.url_options` from request for proper URL generation.

## Views and Hotwire
- Server-rendered HTML with partials for all domains: books list, edit forms,
  leaves (header, navigation, sidebar, history, edit footer), leafable show,
  pages/pictures forms, etc.
- Turbo Streams for CRUD updates (leafables create/destroy/update stream views).
- Stimulus controllers implement behavior units: autosave, edit mode, dialog,
  popover, arrangement (drag/move), reading progress/tracker, sidebar, ToC view,
  scroll helpers, hotkeys, touch, fullscreen, copy to clipboard, upload preview,
  web share.
- Importmap pins `house`, Turbo, Stimulus, @rails/request.js, and app trees.

## Security and sanitization
- HtmlScrubber extends Rails whitelist to include needed tags (`audio`, `video`,
  `iframe`, `table` suite, `mark`, etc.) for richer content.
- Content Security Policy/Permissions Policy initializers present; tune for prod.
- Signed Global IDs protect the uploads API for ActionText::Markdown.

## Background jobs
- Configure :resque in production. Jobs should be thin and idempotent; prefer
  doing the minimal background work necessary (e.g., emails, heavy processing).
- Use resque-pool to manage worker process counts per queue.

## Environment / configuration
- Needed:
  - `APP_VERSION`, `GIT_REVISION` for version headers.
  - `REDIS_URL` for Action Cable in production.
  - Database (SQLite paths) per environment; storage service configuration.
  - SSL toggles (DISABLE_SSL) if deploying behind a TLS terminator.
- House editor assets (`house.min.js`) pinned via importmap. Ensure matching
  versions with the markdown helpers.

## Testing
- Minitest with fixtures for books, pages, sections, pictures, users, accesses.
- System tests for editing and publishing; integration/controller tests around
  search, uploads, sessions, profiles, and bookmarks.
- Keep model tests for concerns: `Editable`, `Positionable`, `Searchable`, roles.

## Performance
- Eager load leafables in lists (`with_leafables`).
- Use SQLite FTS (`leaf_search_index`) with direct SQL for speed.
- Rebalance positions in bulk via a single SQL update query.
- Serve uploads via redirect to blob URLs with long cache headers; use slugs in
  the public URL for stability and readability.

## Checklists

Controllers
- [ ] Public endpoints: `allow_unauthenticated_access` when safe.
- [ ] Load resources (`before_action`) and guard with `editable?`/auth gates.
- [ ] Use direct route helpers for slugged URLs and leafable polymorphic routes.
- [ ] Prefer redirects after mutations; Turbo Streams for list updates.

Models
- [ ] Keep logic in rich models; extract to concerns (`Accessable`, `Sluggable`,
      `Editable`, `Searchable`, `Positionable`).
- [ ] Transactions for multi‑record edits; bulk operations (`insert_all`,
      `upsert_all`) where appropriate.
- [ ] Background side effects minimized; keep callbacks purposeful.

Views/JS
- [ ] Partial‑driven templates; Turbo Frames/Streams for async updates.
- [ ] Small Stimulus controllers per behavior; pin via importmap.
- [ ] Use markdown helpers (`markdown_area`, toolbar helpers) with uploads URL.

Markdown
- [ ] Use Redcarpet with the same extension set as in ActionText::Markdown.
- [ ] Use Rouge integration via `Rouge::Plugins::Redcarpet` for code blocks.
- [ ] Ensure `HtmlScrubber` allows necessary tags but stays conservative.

Search
- [ ] Maintain FTS table via `Leaf::Searchable` callbacks.
- [ ] Sanitize queries; highlight/snippet fields for result display.

Positioning
- [ ] Use `move_to_position` with optional followers; lock via parent to avoid
      race conditions; rebalance when gaps become tiny.

Deployment
- [ ] Puma server; optional Thruster for HTTP/2 + TLS and static caching.
- [ ] Redis cache store in production; long asset cache headers.

By following these guidelines, generated code should align with Writebook’s
style: idiomatic Rails, a rich document model (book/leaves/leafables), a first‑
class Markdown editor pipeline with uploads, simple and robust access control,
lightweight search, and polished Hotwire interactions.
