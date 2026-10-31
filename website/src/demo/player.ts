// Pacing for the scripted agent: pausable, speed-adjustable sleeps, and a
// run token so a restart cancels everything still in flight.

export class Cancelled extends Error {
  constructor() {
    super('cancelled')
  }
}

export class Player {
  speed = 1
  paused = false
  private token = 0
  private resumers: (() => void)[] = []
  private controller = new AbortController()
  private onChange: () => void

  constructor(onChange: () => void) {
    this.onChange = onChange
  }

  /** Start a new run: cancels the previous one. Returns its token. */
  begin(): number {
    this.token++
    this.controller.abort()
    this.controller = new AbortController()
    this.paused = false
    this.wake()
    return this.token
  }

  /** Cancel the current run without starting another. */
  cancel() {
    this.begin()
  }

  get signal() {
    return this.controller.signal
  }

  alive(token: number) {
    return token === this.token
  }

  check(token: number) {
    if (token !== this.token) throw new Cancelled()
  }

  setPaused(p: boolean) {
    this.paused = p
    if (!p) this.wake()
    this.onChange()
  }

  setSpeed(s: number) {
    this.speed = s
    this.onChange()
  }

  private wake() {
    const r = this.resumers.splice(0)
    for (const fn of r) fn()
  }

  /** Wait while paused; throws Cancelled if the run was replaced. */
  async gate(token: number) {
    this.check(token)
    while (this.paused) {
      await new Promise<void>(resolve => this.resumers.push(resolve))
      this.check(token)
    }
  }

  /** Sleep `ms` of demo time (scaled by speed, frozen while paused). */
  async sleep(token: number, ms: number) {
    let left = ms
    while (left > 0) {
      await this.gate(token)
      const slice = Math.min(left / this.speed, 60)
      await new Promise(resolve => setTimeout(resolve, slice))
      left -= slice * this.speed
    }
    this.check(token)
  }
}
