import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', accent = false }) => {
  return (
    <div className={`${accent ? 'stat-card' : 'glass-panel'} p-5 ${className}`}>
      {children}
    </div>
  );
};
