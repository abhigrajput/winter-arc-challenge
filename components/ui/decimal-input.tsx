import * as React from 'react';
import { Input } from '@/components/ui/input';

/**
 * Numeric entry that survives every mobile keyboard.
 *
 * type="number" silently rewrites "80,5" (comma-decimal keyboards) to 805 or to
 * an empty string, and the form then fails validation with no visible cause.
 * A text input with inputMode="decimal" still opens the number pad; the zod
 * schema normalises the comma on the server.
 */
const DecimalInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<'input'>, 'type' | 'inputMode'> & { integer?: boolean }
>(({ integer = false, ...props }, ref) => (
  <Input
    ref={ref}
    type="text"
    inputMode={integer ? 'numeric' : 'decimal'}
    autoComplete="off"
    autoCorrect="off"
    spellCheck={false}
    {...props}
  />
));
DecimalInput.displayName = 'DecimalInput';

export { DecimalInput };
