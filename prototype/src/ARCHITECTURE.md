# Frontend architecture

The application follows a pragmatic Feature-Sliced Design structure. Imports should point only to layers below the current layer.

```text
app
├── pages
├── widgets
├── features
├── entities
└── shared
```

## Layer responsibilities

- `app`: route history, cross-screen state, and application-wide overlay composition.
- `pages`: route-level screens grouped by user journey.
- `widgets`: reusable, page-spanning compositions such as bottom navigation.
- `features`: user actions that can be opened from multiple screens, such as adding a friend or filtering products.
- `entities`: domain types, API requests, and retained mock data for friends, products, gifts, and categories.
- `shared`: generic API utilities, pagination, reusable hooks, UI primitives, and application-neutral types.
- `mobile`: protected device runtime supplied by the prototype template; treat it as shared infrastructure.

Each slice exposes a small public API through `index.ts`. Cross-slice imports should use that public API instead of reaching into another slice's internals.
