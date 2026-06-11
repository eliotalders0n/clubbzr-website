import { forwardRef, useState, type HTMLAttributes, type ImgHTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs: (string | undefined | null | false)[]) => twMerge(clsx(inputs));

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type StatusType = 'online' | 'offline' | 'away' | 'busy';

interface AvatarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  src?: string;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  status?: StatusType;
  bordered?: boolean;
}

const sizes: Record<AvatarSize, { container: string; text: string; status: string }> = {
  xs: { container: 'w-6 h-6', text: 'text-[10px]', status: 'w-2 h-2 border' },
  sm: { container: 'w-8 h-8', text: 'text-xs', status: 'w-2.5 h-2.5 border' },
  md: { container: 'w-10 h-10', text: 'text-sm', status: 'w-3 h-3 border-2' },
  lg: { container: 'w-14 h-14', text: 'text-base', status: 'w-3.5 h-3.5 border-2' },
  xl: { container: 'w-20 h-20', text: 'text-xl', status: 'w-4 h-4 border-2' },
};

const statusColors: Record<StatusType, string> = {
  online: 'bg-bzr-green',
  offline: 'bg-bzr-gray-500',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
};

const getInitials = (name: string): string => {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

const getColorFromName = (name: string): string => {
  const colors = [
    'bg-bzr-blue',
    'bg-bzr-green',
    'bg-bzr-orange',
    'bg-bzr-lavender',
    'bg-purple-500',
    'bg-pink-500',
    'bg-cyan-500',
    'bg-amber-500',
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};

const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      src,
      alt,
      name = '',
      size = 'md',
      status,
      bordered = false,
      className,
      ...props
    },
    ref
  ) => {
    const [imageError, setImageError] = useState(false);
    const showFallback = !src || imageError;
    const initials = getInitials(name || alt || '?');
    const bgColor = getColorFromName(name || alt || 'default');

    return (
      <div
        ref={ref}
        className={cn(
          'relative inline-flex items-center justify-center',
          'rounded-full overflow-hidden',
          'bg-bzr-gray-800',
          sizes[size].container,
          bordered && 'ring-2 ring-bzr-white/20 ring-offset-2 ring-offset-bzr-black',
          className
        )}
        {...props}
      >
        {showFallback ? (
          <div
            className={cn(
              'w-full h-full flex items-center justify-center',
              'font-display font-semibold text-bzr-white',
              bgColor,
              sizes[size].text
            )}
            aria-label={name || alt}
          >
            {initials}
          </div>
        ) : (
          <img
            src={src}
            alt={alt || name}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        )}

        {status && (
          <span
            className={cn(
              'absolute bottom-0 right-0 rounded-full',
              'border-bzr-black',
              statusColors[status],
              sizes[size].status
            )}
            aria-label={`Status: ${status}`}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

// Avatar Group
interface AvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  max?: number;
  size?: AvatarSize;
  spacing?: 'tight' | 'normal' | 'loose';
}

const spacings = {
  tight: '-space-x-3',
  normal: '-space-x-2',
  loose: '-space-x-1',
};

interface AvatarGroupItemProps {
  src?: string;
  alt?: string;
  name?: string;
}

const AvatarGroup = forwardRef<
  HTMLDivElement,
  AvatarGroupProps & { avatars: AvatarGroupItemProps[] }
>(
  (
    {
      avatars,
      max = 5,
      size = 'md',
      spacing = 'normal',
      className,
      ...props
    },
    ref
  ) => {
    const visibleAvatars = avatars.slice(0, max);
    const remainingCount = avatars.length - max;

    return (
      <div
        ref={ref}
        className={cn('flex items-center', spacings[spacing], className)}
        {...props}
      >
        {visibleAvatars.map((avatar, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className="relative"
            style={{ zIndex: visibleAvatars.length - index }}
          >
            <Avatar
              src={avatar.src}
              alt={avatar.alt}
              name={avatar.name}
              size={size}
              bordered
            />
          </motion.div>
        ))}

        {remainingCount > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: visibleAvatars.length * 0.05 }}
            className={cn(
              'relative inline-flex items-center justify-center',
              'rounded-full',
              'bg-bzr-gray-700 text-bzr-white',
              'font-display font-semibold',
              'ring-2 ring-bzr-white/20 ring-offset-2 ring-offset-bzr-black',
              sizes[size].container,
              sizes[size].text
            )}
            style={{ zIndex: 0 }}
          >
            +{remainingCount}
          </motion.div>
        )}
      </div>
    );
  }
);

AvatarGroup.displayName = 'AvatarGroup';

export {
  Avatar,
  AvatarGroup,
  type AvatarProps,
  type AvatarGroupProps,
  type AvatarSize,
  type StatusType,
};
