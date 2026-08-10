import React from 'react';

interface WonderMallLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const WonderMallLogo: React.FC<WonderMallLogoProps> = ({ className = '', size = 'md' }) => {
  const heightMap = {
    sm: 'h-6 sm:h-7',
    md: 'h-8 sm:h-10',
    lg: 'h-11 sm:h-14',
  };

  return (
    <div className={`flex items-center select-none ${className}`}>
      <img
        src="/img/wondermall-logo.png"
        alt="WonderMall Logo"
        className={`${heightMap[size]} w-auto object-contain transition-transform hover:scale-[1.01]`}
      />
    </div>
  );
};
