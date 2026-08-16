import { getNameFromNode, applyReplacements } from '../utils/domUtils';
import { imageUrlToBlob, extractBackgroundImageUrl } from '../utils/imageUtils';
import { loadGlobalSettings } from './settingsService';
import { showWarning } from '../utils/notify';
import type { LogExportSettings, ColorPalette, ThemeInfo, GlobalSettings } from '../../types';

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * CSS variables to extract from computed styles as fallback.
 */
const THEME_CSS_VARIABLES = [
    '--risu-theme-textcolor',
    '--risu-theme-textcolor2',
    '--risu-theme-bgcolor',
    '--risu-theme-darkbg',
    '--risu-theme-borderc',
    '--risu-theme-darkborderc',
    '--risu-theme-selected',
    '--risu-theme-darkbutton',
    '--risu-theme-draculared',
    '--color-textcolor',
    '--color-textcolor2',
    '--color-bgcolor',
    '--color-darkbg',
    '--color-borderc',
    '--color-darkborderc',
    '--color-selected',
    '--color-draculared',
    '--color-darkbutton',
    '--FontColorStandard',
    '--FontColorItalic',
    '--FontColorBold',
    '--FontColorItalicBold',
    '--FontColorQuote1',
    '--FontColorQuote2',
    '--risu-font-family',
] as const;

const ROOT_DOC_FONT_VARIABLES = [
    '--FontColorStandard',
    '--FontColorItalic',
    '--FontColorBold',
    '--FontColorItalicBold',
    '--FontColorQuote1',
    '--FontColorQuote2',
    '--risu-font-family',
] as const;

// ─── Message Data Extraction ─────────────────────────────────────────────────

/**
 * Extracts inner text from a message element, applying replacement rules if configured.
 */
function extractMessageText(
    messageEl: Element | null,
    settings?: LogExportSettings
): string {
    if (!messageEl) return '';

    if (settings?.replacementRules && settings.replacementRules.length > 0) {
        const clonedEl = messageEl.cloneNode(true) as HTMLElement;
        applyReplacements(clonedEl, settings.replacementRules);
        return clonedEl.innerText;
    }

    return (messageEl as HTMLElement).innerText;
}

/**
 * Extracts participant name and formatted message text from a chat message node.
 */
function extractMessageData(
    node: HTMLElement,
    globalSettings: GlobalSettings,
    charName: string,
    settings?: LogExportSettings
): { name: string; messageText: string } {
    const name = getNameFromNode(node, globalSettings, charName);
    const messageEl = node.querySelector('.prose, .chattext');
    const messageText = extractMessageText(messageEl, settings);
    return { name, messageText };
}

// ─── Basic Log Formatting Helpers ────────────────────────────────────────────

/**
 * Resolves active color palette for basic log export based on theme and color settings.
 */
function resolveColorPalette(
    settings: LogExportSettings,
    themes: Record<string, ThemeInfo>,
    colors: Record<string, ColorPalette>
): ColorPalette {
    const fallbackColor: ColorPalette = colors.dark || {
        background: '#1a1b26',
        text: '#c0caf5',
        cardBg: '#24283b',
        cardBgUser: '#2f354f',
        border: '#414868',
        nameColor: '#7aa2f7',
        avatarBorder: '#7aa2f7',
        shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    };

    if (settings.theme === 'basic') {
        const colorKey = typeof settings.color === 'string' ? (settings.color || 'dark') : 'dark';
        return colors[colorKey] || fallbackColor;
    }

    const themeInfo = themes[settings.theme || 'basic'] || themes.basic;
    return themeInfo?.color || fallbackColor;
}

/**
 * Renders the top header for basic HTML log export.
 */
function renderBasicLogHeader(
    charName: string,
    chatName: string,
    charAvatarUrl: string,
    palette: ColorPalette
): string {
    return `
        <header style="text-align: center; padding-bottom: 1.5em; margin-bottom: 2em; border-bottom: 2px solid ${palette.border};">
            <img src="${charAvatarUrl}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin: 0 auto 1em; display: block; border: 3px solid ${palette.avatarBorder}; box-shadow: ${palette.shadow};" />
            <h1 style="color: ${palette.nameColor}; margin: 0 0 0.25em 0; font-size: 1.8em; letter-spacing: 1px;">${charName}</h1>
            <p style="color: ${palette.text}; opacity: 0.8; margin: 0; font-size: 0.9em;">${chatName}</p>
        </header>
    `;
}

/**
 * Renders an individual message card for basic HTML log export.
 */
function renderBasicLogMessage(
    name: string,
    messageHtml: string,
    isUser: boolean,
    palette: ColorPalette
): string {
    const cardBg = isUser ? palette.cardBgUser : palette.cardBg;
    const textAlign = isUser ? 'right' : 'left';
    const flexDirection = isUser ? 'row-reverse' : 'row';

    return `
        <div class="chat-message-container" style="display: flex; align-items: flex-start; margin-bottom: 20px; flex-direction: ${flexDirection};">
            <div style="flex: 1;">
                <strong style="color: ${palette.nameColor}; font-weight: 600; display: block; margin-bottom: 8px; text-align: ${textAlign};">${name}</strong>
                <div style="background-color: ${cardBg}; border-radius: 16px; padding: 14px 18px; color: ${palette.text};">
                    ${messageHtml}
                </div>
            </div>
        </div>
    `;
}

// ─── Export Generators: Basic, Markdown, Text ─────────────────────────────────

/**
 * Generates standalone styled HTML markup for the "Basic" theme log.
 */
export const generateBasicLog = async (
    nodes: HTMLElement[],
    charName: string,
    chatName: string,
    charAvatarUrl: string,
    settings: LogExportSettings,
    themes: Record<string, ThemeInfo>,
    colors: Record<string, ColorPalette>
): Promise<string> => {
    const globalSettings = await loadGlobalSettings();
    const palette = resolveColorPalette(settings, themes, colors);

    const headerHtml = settings.showHeader !== false
        ? renderBasicLogHeader(charName, chatName, charAvatarUrl, palette)
        : '';

    const messagesHtml = nodes.map(node => {
        const isUser = node.classList.contains('justify-end');
        const { name, messageText: messageHtml } = extractMessageData(node, globalSettings, charName, settings);
        return renderBasicLogMessage(name, messageHtml, isUser, palette);
    }).join('');

    return `<div style="padding: 20px; background-color: ${palette.background};">${headerHtml}${messagesHtml}</div>`;
};

/**
 * Generates formatted Markdown log representation from chat nodes.
 */
export const generateMarkdownLog = async (
    nodes: HTMLElement[],
    charName: string,
    settings?: LogExportSettings
): Promise<string> => {
    const globalSettings = await loadGlobalSettings();

    return nodes.map(node => {
        const { name, messageText } = extractMessageData(node, globalSettings, charName, settings);
        return `**${name}**\n\n${messageText}\n\n---\n\n`;
    }).join('');
};

/**
 * Generates plain text chat log representation from chat nodes.
 */
export const generateTextLog = async (
    nodes: HTMLElement[],
    charName: string,
    settings?: LogExportSettings
): Promise<string> => {
    const globalSettings = await loadGlobalSettings();

    return nodes.map(node => {
        const { name, messageText } = extractMessageData(node, globalSettings, charName, settings);
        return `${name}: ${messageText}\n\n`;
    }).join('');
};

// ─── Stylesheet & Theme Extraction Helpers ───────────────────────────────────

/**
 * Collects style rules from parent page via Risuai host document APIs.
 */
async function getParentPageStyles(): Promise<string[]> {
    const cssTexts: string[] = [];
    try {
        const rootDoc = await Risuai.getRootDocument();
        if (!rootDoc) return cssTexts;

        // 1. Collect parent <style> blocks
        const styleEls = await rootDoc.querySelectorAll('style');
        const styleList = await Risuai.unwarpSafeArray(styleEls);
        for (const el of styleList) {
            try {
                const html = await el.getInnerHTML();
                if (html && html.trim()) {
                    cssTexts.push(html);
                }
            } catch (e) {
                console.error('[log plugin] Failed to get style innerHTML:', e);
                showWarning('스타일 시트 읽기 중 오류가 발생했습니다.');
            }
        }

        // 2. Collect parent <link rel="stylesheet"> blocks
        const linkEls = await rootDoc.querySelectorAll('link[rel="stylesheet"]');
        const linkList = await Risuai.unwarpSafeArray(linkEls);
        for (const el of linkList) {
            try {
                const outerHTML = await el.getOuterHTML();
                const match = outerHTML.match(/href\s*=\s*["']?([^"'\s>]+)/);
                if (match && match[1]) {
                    const href = match[1];
                    const res = await Risuai.nativeFetch(href, { method: 'GET' } as Record<string, unknown>);
                    if (res.ok) {
                        const text = await res.text();
                        if (text && text.trim()) {
                            cssTexts.push(text);
                        }
                    }
                }
            } catch (e) {
                console.warn('[log plugin] Failed to fetch link stylesheet:', e);
            }
        }
    } catch (e) {
        console.warn('[log plugin] getParentPageStyles failed:', e);
    }
    return cssTexts;
}

/**
 * Builds CSS `:root, :host` theme custom properties from RisuAI environment.
 */
async function getThemeCssVariables(): Promise<string> {
    let colors: Record<string, string> | null = null;
    try {
        const res = await Risuai.getColorScheme();
        if (res && res.scheme) {
            colors = res.scheme as unknown as Record<string, string>;
        }
    } catch (e) {
        console.warn('[log plugin] Failed to getColorScheme:', e);
    }

    const textColors: Record<string, string> = {};
    try {
        const rootDoc = await Risuai.getRootDocument();
        if (rootDoc) {
            for (const v of ROOT_DOC_FONT_VARIABLES) {
                const val = await rootDoc.getStyle(v);
                if (val) {
                    textColors[v] = val;
                }
            }
        }
    } catch (e) {
        console.warn('[log plugin] Failed to get rootDoc style variables:', e);
    }

    let cssText = ':root, :host {\n';

    if (colors) {
        const cssVars: [string, string | undefined][] = [
            ['textcolor', colors.textcolor],
            ['textcolor2', colors.textcolor2],
            ['bgcolor', colors.bgcolor],
            ['darkbg', colors.darkbg],
            ['borderc', colors.borderc],
            ['darkborderc', colors.darkBorderc || colors.darkborderc || '#4b5563'],
            ['selected', colors.selected],
            ['darkbutton', colors.darkbutton],
            ['draculared', colors.draculared],
        ];
        for (const [name, value] of cssVars) {
            if (value !== undefined) {
                cssText += `  --risu-theme-${name}: ${value};\n`;
                cssText += `  --color-${name}: ${value};\n`;
            }
        }
    }

    for (const [k, v] of Object.entries(textColors)) {
        cssText += `  ${k}: ${v};\n`;
    }

    // Fallback: read computed styles from root / body if neither API returned values
    const hasColors = colors && Object.keys(colors).length > 0;
    const hasTextColors = Object.keys(textColors).length > 0;
    if (!hasColors && !hasTextColors) {
        const root = document.documentElement;
        const body = document.body;
        const computedRoot = window.getComputedStyle(root);
        const computedBody = window.getComputedStyle(body);
        for (const v of THEME_CSS_VARIABLES) {
            const val = root.style.getPropertyValue(v) ||
                body.style.getPropertyValue(v) ||
                computedRoot.getPropertyValue(v) ||
                computedBody.getPropertyValue(v);
            if (val) {
                cssText += `  ${v}: ${val};\n`;
            }
        }
    }

    cssText += '}\n';
    return cssText;
}

/**
 * Collects all loaded stylesheets and `<style>` blocks in the document.
 */
function getComprehensivePageCSS(): string {
    const cssTexts = new Set<string>();

    for (const sheet of Array.from(document.styleSheets)) {
        try {
            const rules = sheet.cssRules;
            for (const rule of Array.from(rules)) {
                cssTexts.add(rule.cssText);
            }
        } catch {
            // Ignore cross-origin stylesheet access restrictions
        }
    }

    document.querySelectorAll('style').forEach(styleElement => {
        if (styleElement.id !== 'log-exporter-styles' && styleElement.textContent) {
            cssTexts.add(styleElement.textContent);
        }
    });

    return Array.from(cssTexts).join('\n');
}

/**
 * Creates an override CSS rule for `:hover` pseudoclasses within `.expand-hover-globally`.
 */
function createHoverOverrideRule(rule: CSSRule, hoverRegex: RegExp): string | null {
    if (!(rule instanceof CSSStyleRule)) return null;

    if (!rule.selectorText || !hoverRegex.test(rule.selectorText)) return null;

    const newSelector = rule.selectorText
        .split(',')
        .map(part => `.expand-hover-globally ${part.trim().replace(hoverRegex, '')}`)
        .join(', ');

    let declarations = '';
    for (let i = 0; i < rule.style.length; i++) {
        const propName = rule.style[i];
        const propValue = rule.style.getPropertyValue(propName);
        const propPriority = rule.style.getPropertyPriority(propName);
        declarations += `${propName}: ${propValue} ${propPriority || '!important'}; `;
    }

    if (newSelector && declarations) {
        return `${newSelector} { ${declarations} }`;
    }
    return null;
}

/**
 * Generates forced-hover CSS rules so hover-only elements remain visible in static log preview.
 */
async function generateForceHoverCss(): Promise<string> {
    const newRules = new Set<string>();
    const hoverRegex = /:hover/g;

    for (const sheet of Array.from(document.styleSheets)) {
        try {
            if (!sheet.cssRules) continue;
            for (const rule of Array.from(sheet.cssRules)) {
                if (rule.type === CSSRule.MEDIA_RULE) {
                    const mediaRule = rule as CSSMediaRule;
                    let mediaRules = '';
                    for (const nestedRule of Array.from(mediaRule.cssRules)) {
                        const importantRule = createHoverOverrideRule(nestedRule, hoverRegex);
                        if (importantRule) mediaRules += importantRule;
                    }
                    if (mediaRules) {
                        newRules.add(`@media ${mediaRule.conditionText} { ${mediaRules} }`);
                    }
                } else {
                    const importantRule = createHoverOverrideRule(rule, hoverRegex);
                    if (importantRule) newRules.add(importantRule);
                }
            }
        } catch {
            // Ignore cross-origin stylesheet access restrictions
        }
    }
    return Array.from(newRules).join('\n');
}

// ─── Style Scaling Utilities ──────────────────────────────────────────────────

/**
 * Scales numeric px and rem values within a CSS property string.
 * Preserves hairline borders and sub-pixel values (<= 1px).
 */
function scaleValue(val: string, scaleFactor: number): string {
    return val.replace(/(-?\d+(?:\.\d+)?)\s*(px|rem)\b/g, (match, p1, p2) => {
        const num = parseFloat(p1);
        if (p2 === 'px' && Math.abs(num) <= 1) return match;
        return `${Number((num * scaleFactor).toFixed(4))}${p2}`;
    });
}

/**
 * Recursively scales inline styles for an element and its descendants.
 */
function scaleInlineStyles(node: HTMLElement, scaleFactor: number): void {
    const processElement = (el: HTMLElement) => {
        if (!el.style) return;
        for (let i = 0; i < el.style.length; i++) {
            const prop = el.style[i];
            if (prop === 'background-image' || prop === 'background') continue;
            const val = el.style.getPropertyValue(prop);
            if (val) {
                const newVal = scaleValue(val, scaleFactor);
                if (newVal !== val) {
                    el.style.setProperty(prop, newVal, el.style.getPropertyPriority(prop));
                }
            }
        }
    };

    processElement(node);
    node.querySelectorAll<HTMLElement>('*').forEach(processElement);
}

/**
 * Scales CSS stylesheet declarations using CSSOM in a detached `<style>` element.
 */
function scaleStylesheetCSSOM(cssText: string, scaleFactor: number): string {
    const tempStyle = document.createElement('style');
    tempStyle.textContent = cssText;
    document.head.appendChild(tempStyle);

    const sheet = tempStyle.sheet;
    if (!sheet) {
        document.head.removeChild(tempStyle);
        return cssText;
    }

    const processStyleDeclaration = (style: CSSStyleDeclaration) => {
        for (let j = 0; j < style.length; j++) {
            const prop = style[j];
            if (prop === 'background-image' || prop === 'background') continue;
            const val = style.getPropertyValue(prop);
            if (val) {
                const newVal = scaleValue(val, scaleFactor);
                if (newVal !== val) {
                    style.setProperty(prop, newVal, style.getPropertyPriority(prop));
                }
            }
        }
    };

    const processRules = (rules: CSSRuleList) => {
        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            if (rule instanceof CSSStyleRule) {
                processStyleDeclaration(rule.style);
            } else if (rule instanceof CSSMediaRule) {
                processRules(rule.cssRules);
            } else if (rule instanceof CSSKeyframesRule) {
                for (let j = 0; j < rule.cssRules.length; j++) {
                    const kfRule = rule.cssRules[j];
                    if (kfRule instanceof CSSKeyframeRule) {
                        processStyleDeclaration(kfRule.style);
                    }
                }
            }
        }
    };

    try {
        processRules(sheet.cssRules);
        const result = Array.from(sheet.cssRules).map(r => r.cssText).join('\n');
        document.head.removeChild(tempStyle);
        return result;
    } catch (e) {
        console.error('[log plugin] scaleStylesheetCSSOM error:', e);
        document.head.removeChild(tempStyle);
        return cssText;
    }
}

// ─── Node Transformation for HTML Preview ─────────────────────────────────────

/**
 * Resolves avatar data URL from avatarMap for a given participant name.
 */
function resolveAvatarDataUrl(
    name: string,
    avatarMap?: Map<string, string> | Record<string, string>
): string {
    if (!avatarMap || !name) return '';
    const trimmed = name.trim();
    if (avatarMap instanceof Map) {
        return avatarMap.get(name) || avatarMap.get(trimmed) || '';
    }
    return avatarMap[name] || avatarMap[trimmed] || '';
}

/**
 * Replaces avatar `<img>` tags and `background-image` styles outside the message prose content.
 */
function replaceNodeAvatars(clonedNode: HTMLElement, avatarDataUrl: string): void {
    if (!avatarDataUrl) return;

    // 1. Replace <img> src outside prose/chattext
    clonedNode.querySelectorAll<HTMLImageElement>('img').forEach(img => {
        if (!img.closest('.prose, .chattext')) {
            img.src = avatarDataUrl;
        }
    });

    // 2. Replace background-image outside prose/chattext
    clonedNode.querySelectorAll<HTMLElement>('[style*="background"]').forEach(el => {
        if (!el.closest('.prose, .chattext')) {
            const styleAttr = el.getAttribute('style');
            if (styleAttr) {
                const newStyle = styleAttr
                    .replace(/url\(['"]?[^'"]+?['"]?\)/g, `url('${avatarDataUrl}')`)
                    .replace(/url\(&quot;[^&]+?&quot;\)/g, `url('${avatarDataUrl}')`);
                el.setAttribute('style', newStyle);
            }
        }
    });
}

/**
 * Converts external/remote images and background-images in the node to local blob URLs.
 */
async function inlineImagesAsBlobs(clonedNode: HTMLElement): Promise<void> {
    // 1. Convert <img> elements
    const images = Array.from(clonedNode.querySelectorAll<HTMLImageElement>('img'));
    for (const img of images) {
        if (img.src && !img.src.startsWith('data:')) {
            try {
                img.src = await imageUrlToBlob(img.src);
            } catch (e) {
                console.warn(`Blob conversion error for ${img.src}:`, e);
            }
        }
    }

    // 2. Convert background-image inline styles
    const bgElements = Array.from(clonedNode.querySelectorAll<HTMLElement>('[style*="background"]'));
    for (const el of bgElements) {
        const styleAttr = el.getAttribute('style');
        if (!styleAttr) continue;

        const originalUrl = extractBackgroundImageUrl(styleAttr);
        if (originalUrl && !originalUrl.startsWith('data:')) {
            try {
                const dataUrl = await imageUrlToBlob(originalUrl);
                const newStyle = styleAttr.replace(originalUrl, dataUrl);
                el.setAttribute('style', newStyle);
                console.log('[log plugin] Successfully replaced background url in style attribute:', originalUrl.substring(0, 50));
            } catch (e) {
                console.warn(`Background image blob conversion error for ${originalUrl}:`, e);
            }
        }
    }
}

/**
 * Transforms an individual chat DOM node for the HTML preview.
 */
async function transformPreviewNode(
    node: HTMLElement,
    globalSettings: GlobalSettings,
    settings: LogExportSettings,
    avatarMap?: Map<string, string> | Record<string, string>,
    scaleMode: 'font' | 'full' = 'font',
    scaleFactor: number = 1.0
): Promise<string> {
    const clonedNode = node.cloneNode(true) as HTMLElement;

    // 1. Remove RisuAI's utility buttons, model badges, and custom injected buttons
    clonedNode.querySelectorAll('button, .log-exporter-msg-btn-group, .grow.flex.items-center.justify-end, .flex-grow.flex.items-center.justify-end').forEach(el => el.remove());

    // 2. Force text color styling to prevent CSS specificity issues
    clonedNode.querySelectorAll<HTMLElement>('.text-textcolor, .text-textcolor span').forEach(el => {
        el.style.setProperty('color', 'var(--risu-theme-textcolor)', 'important');
    });

    // 3. Replace avatars to prevent sandboxed file access/CORS security errors
    const name = getNameFromNode(clonedNode, globalSettings, '');
    const avatarDataUrl = resolveAvatarDataUrl(name, avatarMap);
    if (avatarDataUrl) {
        replaceNodeAvatars(clonedNode, avatarDataUrl);
    }

    // 4. Embed images as blobs if enabled
    if (settings.embedImages !== false) {
        await inlineImagesAsBlobs(clonedNode);
    }

    // 5. Apply text replacement rules to the message body
    if (settings.replacementRules && settings.replacementRules.length > 0) {
        const messageEl = clonedNode.querySelector<HTMLElement>('.prose, .chattext');
        if (messageEl) {
            applyReplacements(messageEl, settings.replacementRules);
        }
    }

    // 6. Scale inline styles if full scaling mode is active
    if (scaleMode === 'full' && scaleFactor !== 1.0) {
        scaleInlineStyles(clonedNode, scaleFactor);
    }

    return clonedNode.outerHTML;
}

/**
 * Assembles optional CSS extensions (force-hover, animation disable, font scaling).
 */
async function buildExtraCss(
    settings: LogExportSettings,
    scaleMode: 'font' | 'full',
    scaleFactor: number
): Promise<string> {
    let extraCss = '';

    if (settings.expandHover) {
        extraCss += await generateForceHoverCss();
    }

    if (settings.disableAnimations) {
        extraCss += `
            *, *::before, *::after {
                animation: none !important;
                transition: none !important;
            }
        `;
    }

    if (scaleMode === 'font' && scaleFactor !== 1.0) {
        extraCss += `
            .prose, .chattext {
                font-size: ${scaleFactor}em !important;
            }
        `;
    }

    return extraCss;
}

// ─── HTML Preview Generator ───────────────────────────────────────────────────

/**
 * Generates full standalone HTML with embedded styles for live preview and copy operations.
 */
export const generateHtmlPreview = async (
    nodes: HTMLElement[],
    settings: LogExportSettings,
    avatarMap?: Map<string, string> | Record<string, string>
): Promise<string> => {
    const scaleMode = settings.htmlScaleMode || 'font';
    const scaleFactor = settings.htmlScaleFactor !== undefined ? Number(settings.htmlScaleFactor) : 1.0;

    const [parentStyles, themeCss, pageCss, globalSettings] = await Promise.all([
        getParentPageStyles(),
        getThemeCssVariables(),
        Promise.resolve(getComprehensivePageCSS()),
        loadGlobalSettings(),
    ]);

    const clonedNodesHtml = await Promise.all(
        nodes.map(node =>
            transformPreviewNode(node, globalSettings, settings, avatarMap, scaleMode, scaleFactor)
        )
    );

    let fullCss = `${themeCss}\n${parentStyles.join('\n')}\n${pageCss}`;
    let extraCss = await buildExtraCss(settings, scaleMode, scaleFactor);

    if (scaleMode === 'full' && scaleFactor !== 1.0) {
        fullCss = scaleStylesheetCSSOM(fullCss, scaleFactor);
        extraCss = scaleStylesheetCSSOM(extraCss, scaleFactor);
    }

    const wrapperClassAttr = settings.expandHover ? 'class="expand-hover-globally"' : '';
    const wrapperMaxWidth = settings.previewWidth || 800;

    return `
        <style>${fullCss}\n${extraCss}</style>
        <div id="log-html-preview-container" ${wrapperClassAttr} style="max-width: ${wrapperMaxWidth}px;">
            <div id="log-html-scaler">
                ${clonedNodesHtml.join('')}
            </div>
        </div>
    `;
};
