import { useState, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface Tab {
  id: string
  label: string
  content: ReactNode
  disabled?: boolean
}

export interface TabsProps {
  tabs: Tab[]
  defaultTab?: string
  variant?: 'underline' | 'boxed'
  className?: string
}

export default function Tabs({
  tabs,
  defaultTab,
  variant = 'underline',
  className,
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id)

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content

  return (
    <div className={className}>
      <div
        className={cn(
          'flex',
          variant === 'underline' && 'border-b border-gray-200',
          variant === 'boxed' && 'space-x-2'
        )}
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && setActiveTab(tab.id)}
            disabled={tab.disabled}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={cn(
              'pb-3 text-sm font-medium transition-colors focus:outline-none',
              variant === 'underline' && [
                'border-b-2 -mb-px px-1',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ],
              variant === 'boxed' && [
                'rounded-md px-4 py-2',
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
              ],
              tab.disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4" role="tabpanel">{activeTabContent}</div>
    </div>
  )
}
