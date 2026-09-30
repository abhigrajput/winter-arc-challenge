import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Radio or checkbox rendered as a tappable card. */
export function OptionCard({
  name,
  value,
  type = 'radio',
  defaultChecked,
  title,
  description,
}: {
  name: string;
  value: string;
  type?: 'radio' | 'checkbox';
  defaultChecked?: boolean;
  title: string;
  description?: string;
}) {
  return (
    <label className="group relative flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card p-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 hover:border-muted-foreground/40">
      <input
        type={type}
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span className="space-y-1">
        <span className="block text-sm font-medium leading-none">{title}</span>
        {description ? (
          <span className="block text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
    </label>
  );
}
