export function GlassCard({ children, className = '', as: Element = 'section', ...props }) {
  return (
    <Element className={`glass-surface rounded-glass p-5 sm:p-6 ${className}`} {...props}>
      {children}
    </Element>
  );
}
