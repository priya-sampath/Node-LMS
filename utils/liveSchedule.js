export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// converts "14:30" -> 870 (minutes since midnight), makes time comparison easy
const toMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

const startOfDay = (date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

// two date ranges overlap if one starts before the other ends, both ways
const dateRangesOverlap = (aStart, aEnd, bStart, bEnd) => {
  return startOfDay(aStart) <= startOfDay(bEnd) && startOfDay(bStart) <= startOfDay(aEnd)
}

const daysOverlap = (daysA, daysB) => {
  return daysA.some((day) => daysB.includes(day))
}

const timesOverlap = (aStart, aEnd, bStart, bEnd) => {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd)
}

// true if scheduleA and scheduleB would ever be live at the same time
export const doSchedulesConflict = (scheduleA, scheduleB) => {
  if (!scheduleA || !scheduleB) return false
  if (!dateRangesOverlap(scheduleA.startDate, scheduleA.endDate, scheduleB.startDate, scheduleB.endDate)) {
    return false
  }
  if (!daysOverlap(scheduleA.availableDays, scheduleB.availableDays)) {
    return false
  }
  return timesOverlap(scheduleA.startTime, scheduleA.endTime, scheduleB.startTime, scheduleB.endTime)
}

// true if right now falls inside the course's live window
export const isLiveNow = (schedule) => {
  if (!schedule || !schedule.startDate || !schedule.endDate) return false

  const now = new Date()
  const today = startOfDay(now)
  if (today < startOfDay(schedule.startDate) || today > startOfDay(schedule.endDate)) {
    return false
  }

  const todayName = WEEKDAYS[now.getDay()]
  if (!schedule.availableDays.includes(todayName)) {
    return false
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return nowMinutes >= toMinutes(schedule.startTime) && nowMinutes <= toMinutes(schedule.endTime)
}

// converts minutes-since-midnight back to "HH:mm"
const toTimeString = (minutes) => {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0')
  const m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}`
}

// splits the tutor's reschedule window (e.g. 09:00-18:00) into fixed-length
// slots the same duration as a regular class (e.g. startTime-endTime = 1hr),
// labelled "Class 1", "Class 2", etc. in order across the day
export const generateSlotsForDate = (schedule) => {
  if (!schedule?.rescheduleWindowStart || !schedule?.rescheduleWindowEnd) return []

  const classDuration = toMinutes(schedule.endTime) - toMinutes(schedule.startTime)
  if (classDuration <= 0) return []

  const windowStart = toMinutes(schedule.rescheduleWindowStart)
  const windowEnd = toMinutes(schedule.rescheduleWindowEnd)

  const slots = []
  let cursor = windowStart
  let index = 1
  while (cursor + classDuration <= windowEnd) {
    slots.push({ label: `Class ${index}`, time: toTimeString(cursor) })
    cursor += classDuration
    index += 1
  }
  return slots
}

// the Reschedule button only shows on the day of a scheduled class, between
// the tutor's reschedule-window start (e.g. 9am) and the class's own start
// time (e.g. 5pm) — after the class starts, or before the window opens, it's hidden
export const isRescheduleWindowOpenNow = (schedule) => {
  if (!schedule?.rescheduleWindowStart) return false

  const now = new Date()
  const today = startOfDay(now)
  if (today < startOfDay(schedule.startDate) || today > startOfDay(schedule.endDate)) {
    return false
  }

  const todayName = WEEKDAYS[now.getDay()]
  if (!schedule.availableDays.includes(todayName)) {
    return false
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return nowMinutes >= toMinutes(schedule.rescheduleWindowStart) && nowMinutes < toMinutes(schedule.startTime)
}

// true if right now falls inside a specific rescheduled makeup slot —
// used when a tutor starts a live session that's a 1-on-1 makeup, not
// the regular group class
export const isWithinRescheduledSlotNow = (schedule, reschedule) => {
  const now = new Date()
  const today = startOfDay(now)
  if (today.getTime() !== startOfDay(reschedule.newDate).getTime()) return false

  const classDuration = toMinutes(schedule.endTime) - toMinutes(schedule.startTime)
  const slotStart = toMinutes(reschedule.newSlotTime)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return nowMinutes >= slotStart && nowMinutes < slotStart + classDuration
}

// every future date (today excluded) within the course's date range that
// falls on one of the tutor's available weekdays — the candidate list a
// student can pick a new date from
export const getCandidateRescheduleDates = (schedule) => {
  if (!schedule?.startDate || !schedule?.endDate) return []

  const dates = []
  const today = startOfDay(new Date())
  const cursor = new Date(Math.max(startOfDay(schedule.startDate), today.getTime() + 24 * 60 * 60 * 1000))
  const end = startOfDay(schedule.endDate)

  while (cursor <= end) {
    const dayName = WEEKDAYS[cursor.getDay()]
    if (schedule.availableDays.includes(dayName)) {
      dates.push(new Date(cursor))
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}
