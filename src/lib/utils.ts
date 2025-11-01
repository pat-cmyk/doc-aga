import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS classes with proper precedence handling
 * 
 * This utility combines `clsx` for conditional class handling with `tailwind-merge`
 * to resolve conflicting Tailwind utility classes. When multiple classes target the
 * same CSS property, only the last one is applied.
 * 
 * @param inputs - Class values (strings, objects, arrays) to be merged
 * @returns A single string with merged class names
 * 
 * @example
 * ```typescript
 * // Basic usage
 * cn('px-2 py-1', 'px-3') // Returns: 'py-1 px-3' (px-3 overrides px-2)
 * 
 * // Conditional classes
 * cn('base-class', isActive && 'active-class') // Returns: 'base-class active-class'
 * 
 * // Object notation
 * cn({ 'text-red-500': hasError, 'text-green-500': !hasError })
 * 
 * // Component props merging
 * <Button className={cn('default-button-styles', className)} />
 * ```
 * 
 * @see {@link https://github.com/lukeed/clsx} for clsx documentation
 * @see {@link https://github.com/dcastil/tailwind-merge} for tailwind-merge documentation
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
