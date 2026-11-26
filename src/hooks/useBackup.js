// ── Backup download / restore (shared by the header and Settings) ──
import { useCallback } from 'react'
import { useStore } from '../store/context.js'
import * as dbUtils from '../db.js'
import { exportJSON, exportCSV } from '../utils/export.js'
import { makeBackup, validateBackup } from '../utils/backup.js'
import { getPrefs, setPrefs } from '../prefs.js'
import { toast } from '../toast.js'

export const useBackup = () => {
  const { importData, undo } = useStore()

  const downloadBackup = useCallback(async () => {
    const data = await dbUtils.exportAll()
    exportJSON(makeBackup(data, getPrefs()))
    toast({ message: `Backup downloaded: ${data.tasks.length} tasks, ${data.projects.length} projects, ${data.tags.length} tags.`, tone: 'success' })
  }, [])

  const downloadCSV = useCallback(async () => {
    const data = await dbUtils.exportAll()
    exportCSV(data.tasks, data.projects, data.tags)
    toast({ message: 'CSV downloaded.', tone: 'success' })
  }, [])

  // For <input type="file" onChange={restoreFromInput}>
  const restoreFromInput = useCallback(async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    let raw
    try {
      raw = JSON.parse(await file.text())
    } catch {
      toast({ message: `“${file.name}” isn’t a Todos backup: it isn’t valid JSON.`, tone: 'warning' })
      return
    }
    const result = validateBackup(raw)
    if (!result.ok) {
      toast({ message: `Couldn’t restore “${file.name}”. ${result.error}`, tone: 'warning', duration: 9000 })
      return
    }
    await importData(result.data)
    if (result.settings) setPrefs(result.settings)
    toast({
      message: `Restored ${result.data.tasks.length} tasks from “${file.name}”. Your previous data was saved first.`,
      tone: 'success',
      action: { label: 'Undo', onClick: undo },
      duration: 10000,
    })
  }, [importData, undo])

  const restoreSnapshot = useCallback(async (snap) => {
    await importData(snap.data)
    toast({
      message: `Restored the copy from ${new Date(snap.createdAt).toLocaleString()}. Your current data was saved first.`,
      tone: 'success',
      action: { label: 'Undo', onClick: undo },
      duration: 10000,
    })
  }, [importData, undo])

  return { downloadBackup, downloadCSV, restoreFromInput, restoreSnapshot }
}
