import { forwardRef } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    return (
      <div className="flex items-center">
        <div className="relative flex items-center">
          <input
            type="checkbox"
            ref={ref}
            id={id}
            className="peer h-4 w-4 cursor-pointer appearance-none rounded-md border border-gray-300 checked:border-blue-500 checked:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            {...props}
          />
          <Check className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100" />
        </div>
        {label && (
          <label
            htmlFor={id}
            className="ml-2 cursor-pointer text-sm text-gray-700"
          >
            {label}
          </label>
        )}
      </div>
    )
  }
)

Checkbox.displayName = 'Checkbox'

export default Checkbox
