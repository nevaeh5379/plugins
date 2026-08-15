import React, { useMemo } from 'react';
import type { ColorPalette } from '../../../types';

/**
 * Supported visual styles for header tag badges.
 */
export type HeaderTagsVariant =
    | 'default'
    | 'modern'
    | 'smart'
    | 'banner'
    | 'simple'
    | 'compact'
    | 'cover';

/**
 * Props for the `HeaderTags` component.
 */
export interface HeaderTagsProps {
    /**
     * List of tag strings, a single comma-delimited string, or null/undefined.
     * Empty and whitespace-only tags are automatically filtered out.
     */
    tags?: (string | null | undefined)[] | string | null;

    /**
     * Color palette for theming the tags.
     */
    color: ColorPalette;

    /**
     * Visual style variant. Defaults to `'default'`.
     */
    variant?: HeaderTagsVariant;

    /**
     * Optional custom styles to merge into the tag container.
     */
    style?: React.CSSProperties;

    /**
     * Optional CSS class name for the tag container.
     */
    className?: string;
}

/**
 * Normalized style configuration for container and individual tag badges.
 */
interface VariantStyles {
    container: React.CSSProperties;
    tag?: React.CSSProperties;
}

/**
 * Normalizes input tags into a clean string array.
 * Accepts arrays, comma-delimited strings, and handles null/undefined entries safely.
 *
 * @param tags Input tags in string array, single string, or null/undefined format.
 * @returns Array of non-empty, trimmed tag strings.
 */
function normalizeTags(tags?: (string | null | undefined)[] | string | null): string[] {
    if (!tags) return [];

    if (typeof tags === 'string') {
        return tags
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean);
    }

    if (Array.isArray(tags)) {
        return tags
            .flatMap(tag => (typeof tag === 'string' ? tag.split(',') : []))
            .map(tag => tag.trim())
            .filter(Boolean);
    }

    return [];
}

/**
 * Resolves container and badge styles according to the specified header variant and color theme.
 *
 * @param variant Visual variant name.
 * @param color Active color palette.
 * @returns Object containing container and tag styles.
 */
function getVariantStyles(variant: HeaderTagsVariant, color: ColorPalette): VariantStyles {
    const textColor = color.textSecondary || color.text;
    const border = `1px solid ${color.border}`;

    switch (variant) {
        case 'modern':
            return {
                container: {
                    display: 'flex',
                    gap: '5px',
                    flexWrap: 'wrap',
                },
                tag: {
                    fontSize: '0.72em',
                    color: color.textSecondary,
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border,
                },
            };

        case 'smart':
            return {
                container: {
                    display: 'flex',
                    gap: '5px',
                    marginTop: '6px',
                    flexWrap: 'wrap',
                },
                tag: {
                    fontSize: '0.72em',
                    color: color.nameColor,
                    background: color.quoteBg,
                    padding: '3px 9px',
                    borderRadius: '6px',
                    fontWeight: 600,
                },
            };

        case 'banner':
            return {
                container: {
                    display: 'flex',
                    gap: '6px',
                    flexWrap: 'wrap',
                },
                tag: {
                    background: 'rgba(0,0,0,0.4)',
                    color: '#fff',
                    padding: '4px 10px',
                    borderRadius: '100px',
                    fontSize: '0.78em',
                    border: '1px solid rgba(255,255,255,0.2)',
                },
            };

        case 'simple':
            return {
                container: {
                    fontSize: '0.82em',
                    color: textColor,
                },
            };

        case 'cover':
            return {
                container: {
                    display: 'flex',
                    gap: '5px',
                    flexWrap: 'wrap',
                    justifyContent: 'flex-end',
                },
                tag: {
                    fontSize: '0.72em',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    border,
                    color: color.textSecondary,
                    opacity: 0.8,
                },
            };

        case 'compact':
            return {
                container: {
                    marginTop: '0.6em',
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '5px',
                    flexWrap: 'wrap',
                },
                tag: {
                    background: color.cardBg,
                    color: textColor,
                    padding: '2px 8px',
                    borderRadius: '100px',
                    fontSize: '0.72em',
                    border,
                },
            };

        case 'default':
        default:
            return {
                container: {
                    marginTop: '0.8em',
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '6px',
                    flexWrap: 'wrap',
                },
                tag: {
                    background: color.cardBg,
                    color: textColor,
                    padding: '3px 10px',
                    borderRadius: '100px',
                    fontSize: '0.78em',
                    border,
                },
            };
    }
}

/**
 * Header tag rendering component.
 * Displays list of tags formatted cleanly as styled pills, badges, or inline text depending on the chosen variant.
 */
export const HeaderTags: React.FC<HeaderTagsProps> = React.memo(({
    tags,
    color,
    variant = 'default',
    style,
    className,
}) => {
    const normalizedTags = useMemo(() => normalizeTags(tags), [tags]);

    if (normalizedTags.length === 0) {
        return null;
    }

    const { container: containerStyle, tag: tagStyle } = getVariantStyles(variant, color);
    const mergedContainerStyle: React.CSSProperties = style
        ? { ...containerStyle, ...style }
        : containerStyle;

    // Simple variant renders inline text separated by middle dots
    if (variant === 'simple') {
        return (
            <div className={className} style={mergedContainerStyle}>
                {normalizedTags.join(' · ')}
            </div>
        );
    }

    // Badge / Pill variants
    return (
        <div className={className} style={mergedContainerStyle}>
            {normalizedTags.map((tag, index) => (
                <span key={`${tag}-${index}`} style={tagStyle}>
                    {tag}
                </span>
            ))}
        </div>
    );
});

HeaderTags.displayName = 'HeaderTags';

export default HeaderTags;
