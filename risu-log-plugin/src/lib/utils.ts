import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export type { ClassValue };

/**
 * Combines multiple class names and resolves Tailwind CSS class conflicts.
 *
 * This utility wraps `clsx` for conditional and varied class name input handling,
 * and `tailwind-merge` (`twMerge`) to intelligently deduplicate and resolve conflicting
 * Tailwind CSS utility classes (e.g., merging `px-2 py-1` with `p-4` properly yields `p-4`).
 *
 * @param inputs - A rest parameter of class values, which can include strings,
 *                 booleans, undefined, null, objects, and arrays.
 * @returns A single consolidated class name string with conflicts resolved.
 *
 * @example
 * ```ts
 * // Basic concatenation
 * cn("text-sm", "font-bold"); // => "text-sm font-bold"
 *
 * // Conditional classes
 * cn("btn", isActive && "btn-active", isDisabled ? "opacity-50" : "opacity-100");
 *
 * // Resolving Tailwind class conflicts (last declaration wins properly)
 * cn("p-2 text-red-500", "p-4 text-blue-500"); // => "p-4 text-blue-500"
 *
 * // Object syntax
 * cn({ "bg-blue-500": isPrimary, "bg-gray-500": !isPrimary });
 * ```
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export default cn;
