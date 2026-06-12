import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  path?: string
}

export interface BreadcrumbsProps {
  items?: BreadcrumbItem[]
  className?: string
}

export default function Breadcrumbs({
  items: propItems,
  className,
}: BreadcrumbsProps) {
  const location = useLocation()

  const items = propItems || (() => {
    const path = location.pathname
    const parts = path.split('/').filter(Boolean)

    return [
      { label: 'Dashboard', path: '/' },
      ...parts.map((part, index) => {
        const partPath = '/' + parts.slice(0, index + 1).join('/')
        return {
          label: part.charAt(0).toUpperCase() + part.slice(1),
          path: partPath,
        }
      }),
    ]
  })()

  return (
    <nav className={cn('flex items-center gap-2 text-sm', className)}>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {index === 0 && <Home className="h-4 w-4 text-gray-400" />}
          {item.path && index !== items.length - 1 ? (
            <Link
              to={item.path}
              className="text-gray-600 hover:text-blue-600 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-gray-900">{item.label}</span>
          )}
          {index !== items.length - 1 && (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </div>
      ))}
    </nav>
  )
}
