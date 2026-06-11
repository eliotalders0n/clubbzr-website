'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: string | number
  change?: number
  icon?: string
  color?: 'default' | 'blue' | 'green' | 'orange' | 'lavender'
  className?: string
}

export function StatsCard({
  title,
  value,
  change,
  icon,
  color = 'default',
  className,
}: StatsCardProps) {
  const colorClasses = {
    default: 'border-gray-800',
    blue: 'border-bzr-blue/30 bg-bzr-blue/5',
    green: 'border-bzr-green/30 bg-bzr-green/5',
    orange: 'border-bzr-orange/30 bg-bzr-orange/5',
    lavender: 'border-bzr-lavender/30 bg-bzr-lavender/5',
  }

  const valueColorClasses = {
    default: 'text-bzr-white',
    blue: 'text-bzr-blue',
    green: 'text-bzr-green',
    orange: 'text-bzr-orange',
    lavender: 'text-bzr-lavender',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className={cn(
        'glass border rounded-xl p-6',
        colorClasses[color],
        className
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <span className="text-gray-400 text-sm font-medium">{title}</span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <div className="flex items-end gap-3">
        <span className={cn('text-3xl font-display font-bold', valueColorClasses[color])}>
          {value}
        </span>
        {change !== undefined && (
          <span
            className={cn(
              'text-sm mb-1',
              change >= 0 ? 'text-bzr-green' : 'text-red-400'
            )}
          >
            {change >= 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>
    </motion.div>
  )
}
