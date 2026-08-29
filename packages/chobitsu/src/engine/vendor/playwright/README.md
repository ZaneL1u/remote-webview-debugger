# Vendored Playwright sources

Source: <https://github.com/microsoft/playwright>, tag **v1.64.1**.
License: Apache License 2.0 (see `LICENSE`; Playwright's `NOTICE` is kept as is).
Copyright (c) Microsoft Corporation.

Used by `../../rwd/snapshot.ts` (and the actionability checks in `../../rwd/`) to
produce the same AI-mode aria snapshot (`[ref=eN]`) as Playwright MCP.

| File here | Upstream path |
|---|---|
| `injected/ariaSnapshot.ts` | `packages/injected/src/ariaSnapshot.ts` |
| `injected/ariaSnapshotDistiller.ts` | `packages/injected/src/ariaSnapshotDistiller.ts` |
| `injected/roleUtils.ts` | `packages/injected/src/roleUtils.ts` |
| `injected/domUtils.ts` | `packages/injected/src/domUtils.ts` |
| `isomorphic/ariaSnapshot.ts` | `packages/isomorphic/ariaSnapshot.ts` |
| `isomorphic/ariaSnapshotRenderer.ts` | `packages/isomorphic/ariaSnapshotRenderer.ts` |
| `isomorphic/stringUtils.ts` | `packages/isomorphic/stringUtils.ts` |
| `isomorphic/cssTokenizer.ts` | `packages/isomorphic/cssTokenizer.ts` |
| `isomorphic/yaml.ts` | `packages/isomorphic/yaml.ts` |

Local modifications, nothing else:

1. A first line `/* eslint-disable */ // @ts-nocheck: …`, because chobitsu's
   `tsc` (ES5 target, ES2015 lib) and ESLint config check everything under
   `src/`. The SDK build (`sdk/`, ES2017 target) type-checks and transpiles the
   files normally.
2. Imports of `@isomorphic/…` rewritten to the relative `../isomorphic/…`.

Everything else (excluding debug tools' UI, masking, the `checkVisibility`
fallback for old webviews, ref bookkeeping) is done by the wrapper in
`../../rwd/`, so updating means copying the files of a newer tag and redoing the
two steps above.
