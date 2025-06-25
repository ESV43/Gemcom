
import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', text, className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-4',
    lg: 'w-12 h-12 border-[6px]',
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div
        className={`loading-spinner ${sizeClasses[size]} border-t-transparent animate-spin rounded-full border-cyan-400`}
        role="status"
        aria-live="polite"
        aria-label={text || 'Loading'}
      >
        <span className="sr-only">{text || 'Loading...'}</span>
      </div>
      {text && <p className="mt-2 text-cyan-300">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;