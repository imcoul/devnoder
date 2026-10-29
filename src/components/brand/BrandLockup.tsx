import './BrandLockup.css';

export interface BrandLockupProps {
  compact?: boolean;
  className?: string;
}

export function BrandLockup({ compact = false, className = '' }: BrandLockupProps) {
  return (
    <a className={`brand-lockup${compact ? ' brand-lockup--compact' : ''}${className ? ` ${className}` : ''}`} href="/" aria-label="DevNoder home">
      <img className="brand-lockup__mark" src="/icons/devnoder-mark.png" alt="" aria-hidden="true" />
      <span className="brand-lockup__text">
        <span className="brand-lockup__name">DevNoder</span>
        {!compact && <span className="brand-lockup__byline">by Srvel</span>}
      </span>
    </a>
  );
}

export default BrandLockup;
