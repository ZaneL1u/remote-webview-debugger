import { common } from './common'
import { devices } from './devices'
import { docs } from './docs'
import { integration } from './integration'
import { members } from './members'
import { projects } from './projects'
import { shell } from './shell'

// English catalog: the source of truth for the shape of every language.
export const en = { common, shell, devices, projects, integration, members, docs }

export type Messages = typeof en
