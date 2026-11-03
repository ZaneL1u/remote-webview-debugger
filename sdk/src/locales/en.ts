import { AGENT_EN, USER_EN } from '@chobitsu/engine/rwd/i18n'

// English: the built-in default and the shape of every language pack. Missing
// keys in any other pack fall back to these.

type LevelText = { observe: string; interact: string; advanced: string }

const ui = {
  /** Levels in the floating window (auto-allow). */
  levels: {
    observe: 'View only',
    interact: 'View and interact',
    advanced: 'Advanced (run scripts, read storage)',
  } as LevelText,
  /** Levels in the attach dialog: what each choice adds. */
  attachLevels: {
    observe: 'View only',
    interact: 'View and interact',
    advanced: 'Advanced (also run scripts, read storage)',
  } as LevelText,
  state: {
    none: 'Idle: no AI connected',
    observe: 'AI is viewing this page',
    agent: 'AI is in control; your input is paused',
    user: "You've taken over; AI is paused",
  },
  link: {
    connecting: 'Connecting',
    online: 'Online',
    offline: 'Offline',
  },
  connecting: 'Connecting…',
  helpPending: 'Help requested',
  copy: 'Copy',
  copied: 'Copied',
  noteHelp: 'Help requested. The developer will find you by this device code.',
  noteAuto: 'Auto-allow is on: AI joins without asking. You can take over or end anytime.',
  noteShare: 'Share this device code with the developer. AI asks before joining, and you can take over or end anytime.',
  help: 'Get help',
  cancelHelp: 'Cancel help',
  collapse: 'Hide',
  deviceCode: 'Device code',
  barViewing: 'AI is viewing',
  barAgent: 'AI working',
  barUser: 'Your turn',
  connectedFor: (time: string) => `Connected · ${time}`,
  takeover: 'Take over',
  handback: 'Hand back',
  end: 'End',
  autoTitle: 'Auto-allow AI',
  autoOn: (level: string) => `Joins without asking · ${level}`,
  autoOff: 'Ask me each time AI wants to join',
  lockTitle: 'Lock screen while AI is connected',
  lockOn: 'Your taps and swipes are blocked while AI is connected',
  lockOff: "You can still tap and scroll; try not to get in the AI's way",
  lockedToast: 'Screen will lock while AI is connected',
  unlockedToast: "Screen won't lock while AI is connected",
  autoOffToast: 'Auto-allow is off. AI will ask before joining',
  autoDialogTitle: 'Turn on auto-allow?',
  autoDialogText:
    "When AI asks to join this device, it joins right away with the access you pick below. You'll see a notice each time, can take over or end anytime, and can turn this off here.",
  turnOn: 'Turn on',
  cancel: 'Cancel',
  autoOnToast: (level: string) => `Auto-allow on · ${level}`,
  countdown: (seconds: number) => `Auto-deny in ${seconds}s`,

  // approval
  agentName: 'AI assistant',
  autoAllowedToast: (agent: string, level: string) => `Auto-allowed "${agent}" · ${level}`,
  attachTitle: 'AI wants to join',
  attachText: (agent: string) => `"${agent}" wants to view this page. Allow?`,
  confirmTitle: 'Please confirm',
  confirmText: (action: string) => `AI wants to ${action}. Allow?`,
  allow: 'Allow',
  deny: 'Deny',
}

export type UiMessages = typeof ui

const en = {
  id: 'en',
  name: 'English',
  dir: 'ltr' as 'ltr' | 'rtl',
  ui,
  action: USER_EN,
  agent: AGENT_EN,
}

export default en
