// ── Download tasks as an .ics calendar file ────────────────
import { buildCalendar } from './ics.js'
import { downloadText } from './export.js'
import { todayISO } from './dates.js'
import { toast } from '../toast.js'

export const exportCalendar = (tasks, filename = `todos-${todayISO()}.ics`) => {
  const dated = tasks.filter(t => t.dueDate && !t.completed)
  if (!dated.length) { toast({ message: 'No open tasks have a due date, so there’s nothing to add to a calendar.', tone: 'warning' }); return }
  downloadText(buildCalendar(dated), filename, 'text/calendar')
  toast({ message: `Calendar file downloaded with ${dated.length} task${dated.length === 1 ? '' : 's'}. Open it to add them to your calendar.`, tone: 'success' })
}
