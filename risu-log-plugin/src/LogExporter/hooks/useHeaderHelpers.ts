/**
 * @file useHeaderHelpers.ts
 * Comprehensive header and log metadata utilities for LogExporter.
 *
 * Provides hooks and pure helper functions for:
 * 1. Image Data URL / Blob conversion (single and batch with memoized de-duplication)
 * 2. Header tag parsing, filtering, and formatting
 * 3. Title resolution and formatting
 * 4. Localized and ISO date formatting
 * 5. Log statistics calculation and summary formatting
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { imageUrlToBlob } from '../utils/imageUtils';
import { showWarning } from '../utils/notify';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Options for parsing comma-separated or custom-delimited header tags.
 */
export interface HeaderTagParseOptions {
    /** Delimiter string or RegExp. Defaults to comma `,` */
    delimiter?: string | RegExp;
    /** Whether to trim surrounding whitespace from each tag. Defaults to `true`. */
    trim?: boolean;
    /** Whether to filter out empty strings. Defaults to `true`. */
    filterEmpty?: boolean;
    /** Whether to deduplicate tag entries. Defaults to `false`. */
    removeDuplicates?: boolean;
    /** Maximum number of tags to return. */
    maxTags?: number;
}

/**
 * Supported display formats for rendering tag lists into strings.
 */
export type TagFormatVariant = 'comma' | 'dot' | 'quoted-array' | 'hashtag';

/**
 * Supported title formatting styles.
 */
export type HeaderTitleFormat = 'dash' | 'paren' | 'full' | 'name-only' | 'chat-only';

/**
 * Input options for header title generation.
 */
export interface HeaderTitleSource {
    /** Character / persona name. */
    name?: string;
    /** Chat session / scenario name. */
    chatName?: string;
}

/**
 * Supported date formats for header and log metadata display.
 */
export type HeaderDateFormat =
    | 'iso-date'      // YYYY-MM-DD (e.g., "2026-08-14")
    | 'iso-datetime'  // YYYY-MM-DD HH:mm:ss
    | 'korean'        // YYYY년 MM월 DD일
    | 'localized'     // Locale-aware date string
    | 'compact'       // YY.MM.DD
    | 'time-only';    // HH:mm:ss

/**
 * Configuration options for header date formatting.
 */
export interface HeaderDateOptions {
    /** Desired date format variant. Defaults to `'iso-date'`. */
    format?: HeaderDateFormat;
    /** BCP 47 language tag for localization. Defaults to `'ko-KR'`. */
    locale?: string;
    /** Optional custom date formatter callback. */
    customFormatter?: (date: Date) => string;
}

/**
 * Statistical summary of chat log messages and text volume.
 */
export interface LogStatistics {
    /** Total number of message elements / turns. */
    messageCount: number;
    /** Total character count across all messages. */
    characterCount: number;
    /** Total word count across all messages. */
    wordCount: number;
    /** Estimated reading time in minutes (based on ~500 chars/min or ~200 words/min). */
    estimatedReadingTimeMinutes: number;
}

/**
 * Format variant for statistics summary string.
 */
export type StatisticsFormatVariant = 'short' | 'korean' | 'detailed';

// ============================================================================
// 1. Image Blob & Data URL Conversion Helpers & Hooks
// ============================================================================

/**
 * Converts a single remote or local image URL to a base64 Data URL (Blob).
 *
 * @param url Image URL to convert.
 * @returns Promise resolving to the Data URL string.
 */
export async function convertSingleUrl(url: string): Promise<string> {
    return imageUrlToBlob(url);
}

/**
 * Hook to convert a single image URL into a Data URL (Blob) when embedding is enabled.
 * Preserves the original URL if embedding is disabled or if conversion fails.
 *
 * @param url Target image URL or undefined.
 * @param embedAsBlob Whether blob/Data URL embedding is active.
 * @returns Converted data URL or fallback original URL.
 */
export function useConvertedImage(
    url: string | undefined,
    embedAsBlob: boolean
): string | undefined {
    const [convertedUrl, setConvertedUrl] = useState<string | undefined>(url);

    useEffect(() => {
        if (!embedAsBlob || !url) {
            setConvertedUrl(url);
            return;
        }

        let cancelled = false;

        const convert = async () => {
            try {
                const blobUrl = await convertSingleUrl(url);
                if (!cancelled) {
                    setConvertedUrl(blobUrl);
                }
            } catch (error) {
                console.error('[log plugin] Failed to convert image to blob:', url, error);
                if (!cancelled) {
                    setConvertedUrl(url);
                }
            }
        };

        convert();

        return () => {
            cancelled = true;
        };
    }, [url, embedAsBlob]);

    return convertedUrl;
}

/**
 * Hook to convert an avatar image URL to a Data URL (Blob).
 * Convenience alias for `useConvertedImage`.
 *
 * @param avatarUrl Avatar URL or undefined.
 * @param embedAsBlob Whether to embed as blob.
 * @returns Converted data URL or fallback avatar URL.
 */
export function useAvatarBlob(
    avatarUrl: string | undefined,
    embedAsBlob: boolean
): string | undefined {
    return useConvertedImage(avatarUrl, embedAsBlob);
}

/**
 * Hook to concurrently convert multiple image URLs into Data URLs (Blobs).
 * Uses serialized comparison of URLs to prevent unnecessary re-renders when
 * consumer passes new array references.
 *
 * @param urls Array of image URLs to convert.
 * @param embedAsBlob Whether to embed as blob.
 * @returns Array of converted Data URLs (or original URLs on fallback).
 */
export function useMultiImageBlob(
    urls: (string | undefined)[],
    embedAsBlob: boolean
): (string | undefined)[] {
    const [convertedUrls, setConvertedUrls] = useState<(string | undefined)[]>(() => [...urls]);

    // Serialize URL array to avoid re-triggering effect on ephemeral array reference changes
    const urlsSerializedKey = urls.map(u => u ?? '').join('\u0000');

    // Ref to hold current URLs to avoid stale closures
    const urlsRef = useRef(urls);
    urlsRef.current = urls;

    useEffect(() => {
        const currentUrls = urlsRef.current;

        if (!embedAsBlob) {
            setConvertedUrls([...currentUrls]);
            return;
        }

        let cancelled = false;

        const convertAll = async () => {
            const results = await Promise.all(
                currentUrls.map(async (url) => {
                    if (!url) return url;
                    try {
                        return await convertSingleUrl(url);
                    } catch (error) {
                        console.error('[log plugin] Failed to convert image to blob:', url, error);
                        const truncated = url.length > 80 ? `${url.substring(0, 80)}...` : url;
                        showWarning(`이미지 변환 실패: ${truncated}`);
                        return url;
                    }
                })
            );

            if (!cancelled) {
                setConvertedUrls(results);
            }
        };

        convertAll();

        return () => {
            cancelled = true;
        };
    }, [urlsSerializedKey, embedAsBlob]);

    return convertedUrls;
}

// ============================================================================
// 2. Header Tag Parsing, Formatting & Hook
// ============================================================================

/**
 * Parses a comma-separated or custom-delimited tags string into a clean string array.
 *
 * @param tagsString Raw tags string input (e.g. "Action, Fantasy, Romance").
 * @param options Optional parsing configuration.
 * @returns Array of parsed, trimmed tag strings.
 */
export function parseHeaderTags(
    tagsString?: string | null,
    options: HeaderTagParseOptions = {}
): string[] {
    if (!tagsString || typeof tagsString !== 'string') {
        return [];
    }

    const {
        delimiter = ',',
        trim = true,
        filterEmpty = true,
        removeDuplicates = false,
        maxTags,
    } = options;

    let tokens = tagsString.split(delimiter);

    if (trim) {
        tokens = tokens.map(tag => tag.trim());
    }

    if (filterEmpty) {
        tokens = tokens.filter(Boolean);
    }

    if (removeDuplicates) {
        tokens = Array.from(new Set(tokens));
    }

    if (typeof maxTags === 'number' && maxTags >= 0) {
        tokens = tokens.slice(0, maxTags);
    }

    return tokens;
}

/**
 * Formats a list of tags into a unified display string according to a variant style.
 *
 * @param tags Array of tag strings.
 * @param variant Formatting style: `'comma'`, `'dot'`, `'quoted-array'`, or `'hashtag'`.
 * @returns Formatted tag string.
 */
export function formatHeaderTags(
    tags: string[],
    variant: TagFormatVariant = 'comma'
): string {
    if (!tags || tags.length === 0) {
        return '';
    }

    switch (variant) {
        case 'dot':
            return tags.join(' · ');
        case 'quoted-array':
            return `[${tags.map(t => `'${t}'`).join(', ')}]`;
        case 'hashtag':
            return tags.map(t => (t.startsWith('#') ? t : `#${t}`)).join(' ');
        case 'comma':
        default:
            return tags.join(', ');
    }
}

/**
 * Hook to parse a tag string into a memoized tag array.
 *
 * @param tagsString Comma-separated tag string.
 * @param options Optional parsing options.
 * @returns Memoized array of parsed tags.
 */
export function useParsedTags(
    tagsString?: string | null,
    options?: HeaderTagParseOptions
): string[] {
    const delimiter = options?.delimiter;
    const trim = options?.trim;
    const filterEmpty = options?.filterEmpty;
    const removeDuplicates = options?.removeDuplicates;
    const maxTags = options?.maxTags;

    return useMemo(() => {
        return parseHeaderTags(tagsString, {
            delimiter,
            trim,
            filterEmpty,
            removeDuplicates,
            maxTags,
        });
    }, [tagsString, delimiter, trim, filterEmpty, removeDuplicates, maxTags]);
}

// ============================================================================
// 3. Header Title Generation & Hook
// ============================================================================

/**
 * Generates a clean, formatted title from character info and chat session names.
 *
 * @param source Character information containing name and/or chatName.
 * @param fallback Fallback title when no names are present. Defaults to `'Chat Log'`.
 * @param format Title layout style: `'dash'`, `'paren'`, `'full'`, `'name-only'`, or `'chat-only'`.
 * @returns Formatted title string.
 */
export function generateHeaderTitle(
    source?: HeaderTitleSource | null,
    fallback = 'Chat Log',
    format: HeaderTitleFormat = 'dash'
): string {
    const name = source?.name?.trim() || '';
    const chatName = source?.chatName?.trim() || '';

    if (!name && !chatName) {
        return fallback;
    }

    switch (format) {
        case 'name-only':
            return name || chatName || fallback;
        case 'chat-only':
            return chatName || name || fallback;
        case 'paren':
            if (name && chatName) return `${name} (${chatName})`;
            return name || chatName || fallback;
        case 'full':
        case 'dash':
        default:
            if (name && chatName) return `${name} - ${chatName}`;
            return name || chatName || fallback;
    }
}

/**
 * Hook to memoize header title generation based on character information.
 *
 * @param source Character info containing name and chatName.
 * @param fallback Optional fallback title. Defaults to `'Chat Log'`.
 * @param format Optional title format style. Defaults to `'dash'`.
 * @returns Memoized title string.
 */
export function useHeaderTitle(
    source?: HeaderTitleSource | null,
    fallback = 'Chat Log',
    format: HeaderTitleFormat = 'dash'
): string {
    const name = source?.name;
    const chatName = source?.chatName;

    return useMemo(() => {
        return generateHeaderTitle({ name, chatName }, fallback, format);
    }, [name, chatName, fallback, format]);
}

// ============================================================================
// 4. Header Date Formatting & Hook
// ============================================================================

/**
 * Pads a single-digit number with a leading zero.
 */
function padZero(val: number): string {
    return val < 10 ? `0${val}` : String(val);
}

/**
 * Safely parses any date input into a valid Date object or null if invalid.
 */
function parseSafeDate(dateInput?: Date | string | number | null): Date | null {
    if (dateInput === null || dateInput === undefined) {
        return new Date();
    }
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    return isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a date into a header-ready date string according to the specified format.
 *
 * @param dateInput Date object, timestamp, or ISO string. Defaults to current date.
 * @param format Date format variant (e.g. `'iso-date'`, `'korean'`, `'compact'`).
 * @param locale Locale tag for localized formats. Defaults to `'ko-KR'`.
 * @returns Formatted date string.
 */
export function formatHeaderDate(
    dateInput?: Date | string | number | null,
    format: HeaderDateFormat = 'iso-date',
    locale = 'ko-KR'
): string {
    const date = parseSafeDate(dateInput);
    if (!date) {
        return '';
    }

    const year = date.getFullYear();
    const month = padZero(date.getMonth() + 1);
    const day = padZero(date.getDate());
    const hours = padZero(date.getHours());
    const minutes = padZero(date.getMinutes());
    const seconds = padZero(date.getSeconds());

    switch (format) {
        case 'iso-datetime':
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        case 'korean':
            return `${year}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
        case 'compact':
            return `${String(year).slice(-2)}.${month}.${day}`;
        case 'time-only':
            return `${hours}:${minutes}:${seconds}`;
        case 'localized':
            return date.toLocaleDateString(locale, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        case 'iso-date':
        default:
            return `${year}-${month}-${day}`;
    }
}

/**
 * Hook to memoize formatted date string for header and timestamp displays.
 *
 * @param dateInput Date, timestamp, or string.
 * @param options Formatting options.
 * @returns Memoized formatted date string.
 */
export function useHeaderDate(
    dateInput?: Date | string | number | null,
    options?: HeaderDateOptions
): string {
    const format = options?.format ?? 'iso-date';
    const locale = options?.locale ?? 'ko-KR';
    const customFormatter = options?.customFormatter;

    return useMemo(() => {
        if (customFormatter) {
            const parsed = parseSafeDate(dateInput);
            return parsed ? customFormatter(parsed) : '';
        }
        return formatHeaderDate(dateInput, format, locale);
    }, [dateInput, format, locale, customFormatter]);
}

// ============================================================================
// 5. Chat Log Statistics Calculation & Hook
// ============================================================================

/**
 * Calculates volume and reading statistics from a list of log message elements or strings.
 *
 * @param nodes Array of DOM elements, HTML elements, or strings representing messages.
 * @param options Calculation options.
 * @returns Calculated `LogStatistics` object.
 */
export function calculateLogStatistics(
    nodes?: (Element | HTMLElement | string | null | undefined)[],
    options?: { countSpaces?: boolean; readingWordsPerMinute?: number }
): LogStatistics {
    if (!nodes || nodes.length === 0) {
        return {
            messageCount: 0,
            characterCount: 0,
            wordCount: 0,
            estimatedReadingTimeMinutes: 0,
        };
    }

    const { countSpaces = true, readingWordsPerMinute = 200 } = options || {};

    let totalChars = 0;
    let totalWords = 0;
    let messageCount = 0;

    for (const node of nodes) {
        if (!node) continue;
        messageCount++;

        const text = typeof node === 'string' ? node : (node.textContent || '');
        const trimmed = text.trim();

        if (trimmed.length > 0) {
            totalChars += countSpaces ? text.length : text.replace(/\s+/g, '').length;
            const words = trimmed.split(/\s+/).filter(Boolean);
            totalWords += words.length;
        }
    }

    // Estimate reading time: roughly 500 chars/min for CJK / 200 words/min for alphabetic text
    const readingTimeFromWords = totalWords / Math.max(readingWordsPerMinute, 50);
    const readingTimeFromChars = totalChars / 500;
    const estimatedReadingTimeMinutes = Math.max(1, Math.round(Math.max(readingTimeFromWords, readingTimeFromChars)));

    return {
        messageCount,
        characterCount: totalChars,
        wordCount: totalWords,
        estimatedReadingTimeMinutes: messageCount > 0 ? estimatedReadingTimeMinutes : 0,
    };
}

/**
 * Formats a `LogStatistics` object into a localized human-readable summary string.
 *
 * @param stats Calculated statistics object.
 * @param variant Display format variant (`'short'`, `'korean'`, or `'detailed'`).
 * @returns Formatted summary string.
 */
export function formatStatisticsSummary(
    stats: LogStatistics,
    variant: StatisticsFormatVariant = 'short'
): string {
    const formattedChars = stats.characterCount.toLocaleString();
    const formattedMsgs = stats.messageCount.toLocaleString();

    switch (variant) {
        case 'korean':
            return `메시지 ${formattedMsgs}개 · ${formattedChars}자`;
        case 'detailed':
            return `${formattedMsgs} msgs · ${formattedChars} chars · ~${stats.estimatedReadingTimeMinutes} min read`;
        case 'short':
        default:
            return `${formattedMsgs} msgs · ${formattedChars} chars`;
    }
}

/**
 * Hook to memoize calculated chat log statistics from message nodes.
 *
 * @param nodes Array of message nodes or strings.
 * @param options Calculation options.
 * @returns Memoized `LogStatistics` object.
 */
export function useHeaderStatistics(
    nodes?: (Element | HTMLElement | string | null | undefined)[],
    options?: { countSpaces?: boolean; readingWordsPerMinute?: number }
): LogStatistics {
    const countSpaces = options?.countSpaces;
    const readingWordsPerMinute = options?.readingWordsPerMinute;

    return useMemo(() => {
        return calculateLogStatistics(nodes, { countSpaces, readingWordsPerMinute });
    }, [nodes, countSpaces, readingWordsPerMinute]);
}
