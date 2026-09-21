import type { Payload } from 'payload'
import {
  recoverSermonMediaFinalization,
  sermonMediaMaintenanceTablesReady,
  sweepSermonMediaUploads,
} from './SermonMediaStore.ts'
import {
  sermonMediaStorageRootIsReady,
} from './SermonMediaStorage.ts'

const SWEEP_INTERVAL_MS = 15 * 60 * 1000
const FINALIZATION_RECOVERY_INTERVAL_MS = 30 * 1000
const TIMER_KEY = '__heritageSermonMediaMaintenanceTimer'
const RUNNING_KEY = '__heritageSermonMediaMaintenanceRunning'
const RECOVERY_TIMER_KEY = '__heritageSermonMediaRecoveryTimer'
const RECOVERY_RUNNING_KEY = '__heritageSermonMediaRecoveryRunning'

type MaintenanceGlobal = typeof globalThis & {
  [TIMER_KEY]?: ReturnType<typeof setInterval>
  [RUNNING_KEY]?: boolean
  [RECOVERY_TIMER_KEY]?: ReturnType<typeof setInterval>
  [RECOVERY_RUNNING_KEY]?: boolean
}

export async function startSermonMediaMaintenance(payload: Payload) {
  if (!await sermonMediaStorageRootIsReady()) return
  if (!await sermonMediaMaintenanceTablesReady(payload)) return
  const shared = globalThis as MaintenanceGlobal
  const run = async () => {
    if (shared[RUNNING_KEY]) return
    shared[RUNNING_KEY] = true
    try {
      const status = await sweepSermonMediaUploads(payload)
      payload.logger.info(
        { sermonMediaMaintenance: status },
        'Private sermon-media maintenance completed',
      )
    } catch (error) {
      payload.logger.error(
        { err: error },
        'Private sermon-media maintenance failed',
      )
    } finally {
      shared[RUNNING_KEY] = false
    }
  }
  const recover = async () => {
    if (shared[RECOVERY_RUNNING_KEY]) return
    shared[RECOVERY_RUNNING_KEY] = true
    try {
      if (await recoverSermonMediaFinalization(payload)) {
        payload.logger.info(
          'Recovered an expired private sermon-media finalization lease',
        )
      }
    } catch (error) {
      payload.logger.error(
        { err: error },
        'Private sermon-media finalization recovery failed',
      )
    } finally {
      shared[RECOVERY_RUNNING_KEY] = false
    }
  }
  await run()
  await recover()
  if (!shared[TIMER_KEY]) {
    const timer = setInterval(() => {
      void run()
    }, SWEEP_INTERVAL_MS)
    timer.unref()
    shared[TIMER_KEY] = timer
  }
  if (!shared[RECOVERY_TIMER_KEY]) {
    const timer = setInterval(() => {
      void recover()
    }, FINALIZATION_RECOVERY_INTERVAL_MS)
    timer.unref()
    shared[RECOVERY_TIMER_KEY] = timer
  }
}
