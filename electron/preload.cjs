// Preload script — intentionally empty.
//
// Site has no native APIs to expose. All storage is browser IndexedDB and
// localStorage, both of which work in the renderer without any bridge.
// The file exists to keep `contextIsolation: true` with a registered preload
// path, which is the recommended Electron security baseline even when no
// IPC is needed (future-proofs against accidentally exposing Node globals).
