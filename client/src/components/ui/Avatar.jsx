/**
 * Avatar Component
 * Displays user profile picture or generated initials avatar
 */

export default function Avatar({ user, size = 'md', showOnline = false }) {
  const sizeClasses = {
    xs: 'w-7 h-7 text-xs',
    sm: 'w-9 h-9 text-sm',
    md: 'w-11 h-11 text-base',
    lg: 'w-14 h-14 text-lg',
    xl: 'w-20 h-20 text-2xl',
  };

  const dotSizes = {
    xs: 'w-2 h-2 border',
    sm: 'w-2.5 h-2.5 border',
    md: 'w-3 h-3 border-2',
    lg: 'w-3.5 h-3.5 border-2',
    xl: 'w-4 h-4 border-2',
  };

  // Generate color from username for consistent avatar colors
  const colors = [
    'bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-yellow-400',
    'bg-lime-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500',
    'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500',
    'bg-pink-500', 'bg-rose-400'
  ];

  const colorIndex = user?.username
    ? user.username.charCodeAt(0) % colors.length
    : 0;

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '??';

  return (
    <div className="relative flex-shrink-0">
      {user?.profilePicture ? (
        <img
          src={user.profilePicture}
          alt={user.username}
          className={`${sizeClasses[size]} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} ${colors[colorIndex]} rounded-full flex items-center justify-center text-white font-bold select-none`}
        >
          {initials}
        </div>
      )}

      {/* Online status dot */}
      {showOnline && (
        <span
          className={`absolute bottom-0 right-0 ${dotSizes[size]} rounded-full border-white dark:border-gray-800 ${
            user?.isOnline ? 'bg-ck-500' : 'bg-gray-400'
          }`}
        />
      )}
    </div>
  );
}
