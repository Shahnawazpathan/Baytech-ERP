import { toZonedTime, fromZonedTime, format } from 'date-fns-tz'
import { startOfDay, endOfDay, addDays } from 'date-fns'

// Dubai timezone constant
export const DUBAI_TIMEZONE = 'Asia/Dubai'

/**
 * Get current date and time in Dubai timezone
 */
export function getDubaiTime(): Date {
  return toZonedTime(new Date(), DUBAI_TIMEZONE)
}

/**
 * Convert any date to Dubai timezone
 */
export function toDubaiTime(date: Date): Date {
  return toZonedTime(date, DUBAI_TIMEZONE)
}

/**
 * Convert Dubai time to UTC (for storing in database)
 */
export function fromDubaiTime(date: Date): Date {
  return fromZonedTime(date, DUBAI_TIMEZONE)
}

/**
 * Get the start of day (00:00:00) in Dubai timezone
 */
export function getDubaiStartOfDay(date?: Date): Date {
  const dubaiDate = date ? toDubaiTime(date) : getDubaiTime()
  const startOfDubaiDay = startOfDay(dubaiDate)
  return fromDubaiTime(startOfDubaiDay)
}

/**
 * Get the end of day (23:59:59) in Dubai timezone
 */
export function getDubaiEndOfDay(date?: Date): Date {
  const dubaiDate = date ? toDubaiTime(date) : getDubaiTime()
  const endOfDubaiDay = endOfDay(dubaiDate)
  return fromDubaiTime(endOfDubaiDay)
}

/**
 * Get today's date range in Dubai timezone (for database queries)
 * Returns [start of day in UTC, start of next day in UTC]
 */
export function getDubaiTodayRange(): { start: Date; end: Date } {
  const dubaiNow = getDubaiTime()
  const dubaiStartOfDay = startOfDay(dubaiNow)
  const dubaiStartOfNextDay = addDays(dubaiStartOfDay, 1)

  return {
    start: fromDubaiTime(dubaiStartOfDay),
    end: fromDubaiTime(dubaiStartOfNextDay)
  }
}

/**
 * Format date in Dubai timezone
 */
export function formatDubaiTime(date: Date, formatStr: string = 'yyyy-MM-dd HH:mm:ss'): string {
  return format(toZonedTime(date, DUBAI_TIMEZONE), formatStr, { timeZone: DUBAI_TIMEZONE })
}

/**
 * Check if a time is late based on Dubai timezone
 * @param checkInTime - The check-in time
 * @param officeStartHour - Office start hour (default: 9)
 * @param officeStartMinute - Office start minute (default: 0)
 * @param gracePeriodMinutes - Grace period in minutes (default: 15)
 */
export function isLateCheckIn(
  checkInTime: Date,
  officeStartHour: number = 9,
  officeStartMinute: number = 0,
  gracePeriodMinutes: number = 15
): boolean {
  const dubaiCheckInTime = toDubaiTime(checkInTime)

  // Create office start time in Dubai timezone
  const dubaiStartOfDay = startOfDay(dubaiCheckInTime)
  const officeStartTime = new Date(dubaiStartOfDay)
  officeStartTime.setHours(officeStartHour, officeStartMinute, 0, 0)

  // Add grace period
  const lateThreshold = new Date(officeStartTime.getTime() + gracePeriodMinutes * 60000)

  return dubaiCheckInTime > lateThreshold
}

/**
 * Get office start time for a given date in Dubai timezone
 */
export function getDubaiOfficeStartTime(
  date: Date,
  startHour: number = 9,
  startMinute: number = 0
): Date {
  const dubaiDate = toDubaiTime(date)
  const dubaiStartOfDay = startOfDay(dubaiDate)
  const officeStartTime = new Date(dubaiStartOfDay)
  officeStartTime.setHours(startHour, startMinute, 0, 0)

  return fromDubaiTime(officeStartTime)
}
