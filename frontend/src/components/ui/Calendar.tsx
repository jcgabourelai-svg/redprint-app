import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'

export interface CalendarEvent {
  id: string
  date: Date
  title: string
  type?: 'lectura' | 'mantenimiento' | 'instalacion' | 'retiro'
  status?: 'pendiente' | 'completada' | 'reprogramada' | 'cancelada'
  time?: string
  color?: string
}

export interface CalendarProps {
  events?: CalendarEvent[]
  onDateClick?: (date: Date) => void
  onEventClick?: (event: CalendarEvent) => void
  className?: string
}

export default function Calendar({
  events = [],
  onDateClick,
  onEventClick,
  className,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => isSameDay(event.date, date))
  }

  const getEventStyle = (event: CalendarEvent) => {
    if (event.color) {
      return { backgroundColor: event.color, color: 'white' }
    }
    switch (event.status) {
      case 'completada':
        return { backgroundColor: undefined, className: 'bg-success/10 text-success' }
      case 'pendiente':
        return { backgroundColor: undefined, className: 'bg-primary/10 text-primary' }
      case 'reprogramada':
        return { backgroundColor: undefined, className: 'bg-warning/10 text-warning' }
      case 'cancelada':
        return { backgroundColor: undefined, className: 'bg-muted text-muted-foreground' }
      default:
        return { backgroundColor: undefined, className: 'bg-muted text-muted-foreground' }
    }
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            className="rounded-md p-2 hover:bg-muted"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={nextMonth}
            className="rounded-md p-2 hover:bg-muted"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: monthStart.getDay() }).map((_, i) => (
          <div key={`empty-${i}`} className="h-32" />
        ))}

        {days.map((date) => {
          const dayEvents = getEventsForDate(date)
          return (
            <div
              key={date.toISOString()}
              onClick={() => onDateClick?.(date)}
              className={cn(
                'relative h-32 rounded-lg border border-border p-2 transition-colors hover:bg-muted cursor-pointer',
                !isSameMonth(date, currentMonth) && 'bg-muted',
                isToday(date) && 'border-primary'
              )}
            >
              <div className={cn(
                'mb-2 text-sm font-medium',
                isToday(date) && 'rounded-full bg-primary px-2 py-1 text-primary-foreground'
              )}>
                {date.getDate()}
              </div>

              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => {
                  const eventStyle = getEventStyle(event)
                  return (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventClick?.(event)
                      }}
                      className={cn(
                        'truncate rounded px-1 py-0.5 text-xs font-medium',
                        eventStyle.className
                      )}
                      style={eventStyle}
                      title={event.title}
                    >
                      {event.time && <span className="mr-1">{event.time}</span>}
                      {event.title}
                    </div>
                  )
                })}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-muted-foreground">
                    +{dayEvents.length - 3} más
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
