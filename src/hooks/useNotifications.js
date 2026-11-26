import { readPref, writePref } from '../utils/storage.js'
// ── Web Notifications ──────────────────────────────────────

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export const scheduleNotification = async (task) => {
  if (!task.dueDate || !task.dueTime) return
  const granted = await requestNotificationPermission()
  if (!granted) return

  const dateTime = new Date(`${task.dueDate}T${task.dueTime}`)
  if (dateTime <= Date.now()) return

  const delay = dateTime.getTime() - Date.now()

  // Use SW for close-in notifications
  if (delay < 24 * 60 * 60 * 1000 && 'serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready
    reg.active?.postMessage({
      type: 'SCHEDULE_NOTIFICATION',
      taskId: task.id,
      title: `Due: ${task.title}`,
      body: task.dueDate,
      timestamp: dateTime.getTime(),
    })
  }

  // Store in localStorage for persistence
  const stored = readPref('scheduled-notifications', [])
  const filtered = stored.filter(n => n.taskId !== task.id)
  filtered.push({ taskId: task.id, timestamp: dateTime.getTime(), title: task.title })
  writePref('scheduled-notifications', filtered)
}
