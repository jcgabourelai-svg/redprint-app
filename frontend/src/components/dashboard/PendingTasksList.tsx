import { ReactNode } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TaskItem {
  id: string | number
  title: string
  subtitle?: string
  time?: string
  icon?: ReactNode
  status?: 'high' | 'medium' | 'low'
  action?: string
}

export interface PendingTasksListProps {
  title: string
  subtitle?: string
  tasks: TaskItem[]
  viewAllText?: string
  onViewAllClick?: () => void
  className?: string
}

export default function PendingTasksList({
  title,
  subtitle,
  tasks,
  viewAllText,
  onViewAllClick,
  className,
}: PendingTasksListProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card shadow-sm', className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {viewAllText && onViewAllClick && (
          <button
            onClick={onViewAllClick}
            className="text-sm font-medium text-primary hover:text-primary"
          >
            {viewAllText}
          </button>
        )}
      </div>
      <div className="divide-y divide-border">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-start gap-3 px-4 py-3 hover:bg-muted"
          >
            {task.icon && (
              <div className="mt-1 flex h-8 w-8 items-center justify-center rounded bg-muted">
                {task.icon}
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{task.title}</p>
              {task.subtitle && (
                <p className="text-xs text-muted-foreground">{task.subtitle}</p>
              )}
              {task.time && (
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {task.time}
                </div>
              )}
            </div>
            {task.status === 'high' && (
              <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-destructive" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
