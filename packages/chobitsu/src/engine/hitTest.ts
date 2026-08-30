// Hit testing for synthesized input. Our own in-page UI (the remote-debugging
// banner, overlays) is marked `__chobitsu-hide__` and is invisible to the
// agent's DOM tree and snapshot, so input must pass through it too. Otherwise
// a click aimed at the page's own bottom bar can land on the banner's "end"
// button and close the session.
//
// Other in-page debug tools float their entry buttons over the page too
// (eruda's gear, PageSpy's logo, vConsole's switch). They are not part of the
// app, so the agent's clicks go through them as well.

export const HIDE_SELECTOR = '.__chobitsu-hide__, #eruda, #__pageSpy, #__vconsole'

export function elementFromPoint(x: number, y: number): Element {
  for (const el of document.elementsFromPoint(x, y)) {
    if (!el.closest(HIDE_SELECTOR)) return el
  }
  return document.documentElement
}
