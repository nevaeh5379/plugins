import { getNameFromNode, applyReplacements } from '../utils/domUtils';
import { imageUrlToBlob } from '../utils/imageUtils';
import { loadGlobalSettings } from './settingsService';
import { showWarning } from '../utils/notify';
import type { LogExportSettings, ColorPalette, ThemeInfo } from '../../types';

// CSS 변수 목록 (중복 제거)
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

/**
 * 메시지 노드에서 텍스트를 추출합니다.
 * replacementRules가 있으면 적용합니다.
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
 * 메시지 노드에서 이름과 메시지 텍스트를 추출합니다.
 */
function extractMessageData(
    node: HTMLElement,
    globalSettings: import('../../types').GlobalSettings,
    charName: string,
    settings?: LogExportSettings
): { name: string; messageText: string } {
    const name = getNameFromNode(node, globalSettings, charName);
    const messageEl = node.querySelector('.prose, .chattext');
    const messageText = extractMessageText(messageEl, settings);
    return { name, messageText };
}

export const generateBasicLog = async (
    nodes: HTMLElement[],
    charName: string,
    chatName: string,
    charAvatarUrl: string,
    settings: LogExportSettings,
    themes: Record<string, ThemeInfo>,
    colors: Record<string, ColorPalette>
) => {
    let contentHtml = '';
    const globalSettings = await loadGlobalSettings();

    const themeInfo = themes[settings.theme || 'basic'] || themes.basic;
    const colorPalette = settings.theme === 'basic'
        ? ((typeof settings.color === 'string' ? colors[settings.color || 'dark'] : colors.dark) || colors.dark)
        : (themeInfo.color || colors.dark);

    if (settings.showHeader !== false) {
        contentHtml += `
            <header style="text-align: center; padding-bottom: 1.5em; margin-bottom: 2em; border-bottom: 2px solid ${colorPalette.border};">
                <img src="${charAvatarUrl}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin: 0 auto 1em; display: block; border: 3px solid ${colorPalette.avatarBorder}; box-shadow: ${colorPalette.shadow};" />
                <h1 style="color: ${colorPalette.nameColor}; margin: 0 0 0.25em 0; font-size: 1.8em; letter-spacing: 1px;">${charName}</h1>
                <p style="color: ${colorPalette.text}; opacity: 0.8; margin: 0; font-size: 0.9em;">${chatName}</p>
            </header>
        `;
    }

    for (const node of nodes) {
        const isUser = node.classList.contains('justify-end');
        const { name, messageText: messageHtml } = extractMessageData(node, globalSettings, charName);

        contentHtml += `
            <div class="chat-message-container" style="display: flex; align-items: flex-start; margin-bottom: 20px; flex-direction: ${isUser ? 'row-reverse' : 'row'};">
                <div style="flex: 1;">
                    <strong style="color: ${colorPalette.nameColor}; font-weight: 600; display: block; margin-bottom: 8px; text-align: ${isUser ? 'right' : 'left'};">${name}</strong>
                    <div style="background-color: ${isUser ? colorPalette.cardBgUser : colorPalette.cardBg}; border-radius: 16px; padding: 14px 18px; color: ${colorPalette.text};">
                        ${messageHtml}
                    </div>
                </div>
            </div>
        `;
    }

    return `<div style="padding: 20px; background-color: ${colorPalette.background};">${contentHtml}</div>`;
};

export const generateMarkdownLog = async (
    nodes: HTMLElement[],
    charName: string,
    settings?: LogExportSettings
) => {
    let markdown = '';
    const globalSettings = await loadGlobalSettings();

    for (const node of nodes) {
        const { name, messageText } = extractMessageData(node, globalSettings, charName, settings);
        markdown += `**${name}**\n\n${messageText}\n\n---\n\n`;
    }
    return markdown;
};

export const generateTextLog = async (
    nodes: HTMLElement[],
    charName: string,
    settings?: LogExportSettings
) => {
    let text = '';
    const globalSettings = await loadGlobalSettings();

    for (const node of nodes) {
        const { name, messageText } = extractMessageData(node, globalSettings, charName, settings);
        text += `${name}: ${messageText}\n\n`;
    }
    return text;
};

async function getParentPageStyles(): Promise<string[]> {
    const cssTexts: string[] = [];
    try {
        const rootDoc = await Risuai.getRootDocument();
        if (rootDoc) {
            // Collect parent <style> blocks
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

            // Collect parent <link rel="stylesheet"> blocks
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
        }
    } catch (e) {
        console.warn('[log plugin] getParentPageStyles failed:', e);
    }
    return cssTexts;
}

async function generateForceHoverCss(): Promise<string> {
    const newRules = new Set<string>();
    const hoverRegex = /:hover/g;

    const createImportantRule = (rule: CSSRule): string | null => {
        if (!(rule instanceof CSSStyleRule)) return null;
        const styleRule = rule as CSSStyleRule;

        if (!styleRule.selectorText || !hoverRegex.test(styleRule.selectorText)) return null;

        const newSelector = styleRule.selectorText
            .split(',')
            .map(part => `.expand-hover-globally ${part.trim().replace(hoverRegex, '')}`)
            .join(', ');

        let newDeclarations = '';
        for (let i = 0; i < styleRule.style.length; i++) {
            const propName = styleRule.style[i];
            const propValue = styleRule.style.getPropertyValue(propName);
            const propPriority = styleRule.style.getPropertyPriority(propName);
            newDeclarations += `${propName}: ${propValue} ${propPriority || '!important'}; `;
        }

        if (newSelector && newDeclarations) {
            return `${newSelector} { ${newDeclarations} }`;
        }
        return null;
    };

    for (const sheet of Array.from(document.styleSheets)) {
        try {
            if (!sheet.cssRules) continue;
            for (const rule of Array.from(sheet.cssRules)) {
                if (rule.type === CSSRule.MEDIA_RULE) {
                    const mediaRule = rule as CSSMediaRule;
                    let mediaRules = '';
                    for (const nestedRule of Array.from(mediaRule.cssRules)) {
                        const importantRule = createImportantRule(nestedRule);
                        if (importantRule) mediaRules += importantRule;
                    }
                    if (mediaRules) {
                        newRules.add(`@media ${mediaRule.conditionText} { ${mediaRules} }`);
                    }
                } else {
                    const importantRule = createImportantRule(rule);
                    if (importantRule) newRules.add(importantRule);
                }
            }
        } catch {
            // ignore CORS errors
        }
    }
    return Array.from(newRules).join('\n');
}

export const generateHtmlPreview = async (nodes: HTMLElement[], settings: LogExportSettings, avatarMap?: Map<string, string> | Record<string, string>) => {
    // 1. Fetch parent page styles (style elements + link elements fetched via nativeFetch)
    const parentStyles = await getParentPageStyles();

    const getThemeCssVariables = async () => {
        let colors: Record<string, string> = {};
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
                const vars = [
                    '--FontColorStandard',
                    '--FontColorItalic',
                    '--FontColorBold',
                    '--FontColorItalicBold',
                    '--FontColorQuote1',
                    '--FontColorQuote2',
                    '--risu-font-family'
                ];
                for (const v of vars) {
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
            cssText += `  --risu-theme-textcolor: ${colors.textcolor};\n`;
            cssText += `  --risu-theme-textcolor2: ${colors.textcolor2};\n`;
            cssText += `  --risu-theme-bgcolor: ${colors.bgcolor};\n`;
            cssText += `  --risu-theme-darkbg: ${colors.darkbg};\n`;
            cssText += `  --risu-theme-borderc: ${colors.borderc};\n`;
            cssText += `  --risu-theme-darkborderc: ${colors.darkBorderc || colors.darkborderc || '#4b5563'};\n`;
            cssText += `  --risu-theme-selected: ${colors.selected};\n`;
            cssText += `  --risu-theme-darkbutton: ${colors.darkbutton};\n`;
            cssText += `  --risu-theme-draculared: ${colors.draculared};\n`;

            cssText += `  --color-textcolor: ${colors.textcolor};\n`;
            cssText += `  --color-textcolor2: ${colors.textcolor2};\n`;
            cssText += `  --color-bgcolor: ${colors.bgcolor};\n`;
            cssText += `  --color-darkbg: ${colors.darkbg};\n`;
            cssText += `  --color-borderc: ${colors.borderc};\n`;
            cssText += `  --color-darkborderc: ${colors.darkBorderc || colors.darkborderc || '#4b5563'};\n`;
            cssText += `  --color-selected: ${colors.selected};\n`;
            cssText += `  --color-draculared: ${colors.draculared};\n`;
            cssText += `  --color-darkbutton: ${colors.darkbutton};\n`;
        }

        for (const [k, v] of Object.entries(textColors)) {
            cssText += `  ${k}: ${v};\n`;
        }

        if (!colors && Object.keys(textColors).length === 0) {
            const root = document.documentElement;
            const body = document.body;
            const computedRoot = window.getComputedStyle(root);
            const computedBody = window.getComputedStyle(body);
            const variables = THEME_CSS_VARIABLES;
            for (const v of variables) {
                const val = root.style.getPropertyValue(v) || body.style.getPropertyValue(v) || computedRoot.getPropertyValue(v) || computedBody.getPropertyValue(v);
                if (val) {
                    cssText += `  ${v}: ${val};\n`;
                }
            }
        }
        cssText += '}\n';
        return cssText;
    };

    const getComprehensivePageCSS = async () => {
        const cssTexts = new Set<string>();
        for (const sheet of Array.from(document.styleSheets)) {
            try {
                const rules = sheet.cssRules;
                for (const rule of Array.from(rules)) {
                    cssTexts.add(rule.cssText);
                }
            } catch {
                // ignore CORS
            }
        }
        document.querySelectorAll('style').forEach(styleElement => {
            if (styleElement.id !== 'log-exporter-styles' && styleElement.textContent) {
                cssTexts.add(styleElement.textContent);
            }
        });
        return Array.from(cssTexts).join('\n');
    };

    const scaleMode = settings.htmlScaleMode || 'font';
    const scaleFactor = settings.htmlScaleFactor !== undefined ? Number(settings.htmlScaleFactor) : 1.0;

    const scaleValue = (val: string): string => {
        return val.replace(/(-?\d+(?:\.\d+)?)\s*(px|rem)\b/g, (match, p1, p2) => {
            const num = parseFloat(p1);
            if (p2 === 'px' && Math.abs(num) <= 1) return match;
            return `${Number((num * scaleFactor).toFixed(4))}${p2}`;
        });
    };

    const scaleInlineStyles = (node: HTMLElement) => {
        const processElement = (el: HTMLElement) => {
            if (!el.style) return;
            for (let i = 0; i < el.style.length; i++) {
                const prop = el.style[i];
                if (prop === 'background-image' || prop === 'background') continue;
                const val = el.style.getPropertyValue(prop);
                if (val) {
                    const newVal = scaleValue(val);
                    if (newVal !== val) {
                        el.style.setProperty(prop, newVal, el.style.getPropertyPriority(prop));
                    }
                }
            }
        };

        processElement(node);
        node.querySelectorAll('*').forEach(el => processElement(el as HTMLElement));
    };

    const scaleStylesheetCSSOM = (cssText: string): string => {
        const tempStyle = document.createElement('style');
        tempStyle.textContent = cssText;
        document.head.appendChild(tempStyle);

        const sheet = tempStyle.sheet;
        if (!sheet) {
            document.head.removeChild(tempStyle);
            return cssText;
        }

        const processRules = (rules: CSSRuleList) => {
            for (let i = 0; i < rules.length; i++) {
                const rule = rules[i];
                if (rule instanceof CSSStyleRule) {
                    const style = rule.style;
                    for (let j = 0; j < style.length; j++) {
                        const prop = style[j];
                        if (prop === 'background-image' || prop === 'background') continue;
                        const val = style.getPropertyValue(prop);
                        if (val) {
                            const newVal = scaleValue(val);
                            if (newVal !== val) {
                                style.setProperty(prop, newVal, style.getPropertyPriority(prop));
                            }
                        }
                    }
                } else if (rule instanceof CSSMediaRule) {
                    processRules(rule.cssRules);
                } else if (rule instanceof CSSKeyframesRule) {
                    for (let j = 0; j < rule.cssRules.length; j++) {
                        const kfRule = rule.cssRules[j];
                        if (kfRule instanceof CSSKeyframeRule) {
                            const style = kfRule.style;
                            for (let k = 0; k < style.length; k++) {
                                const prop = style[k];
                                const val = style.getPropertyValue(prop);
                                if (val) {
                                    const newVal = scaleValue(val);
                                    if (newVal !== val) {
                                        style.setProperty(prop, newVal, style.getPropertyPriority(prop));
                                    }
                                }
                            }
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
    };

    const clonedNodesHtml = await Promise.all(nodes.map(async (node) => {
        const clonedNode = node.cloneNode(true) as HTMLElement;

        // Remove RisuAI's utility buttons, model badges, and custom injected buttons
        clonedNode.querySelectorAll('button, .log-exporter-msg-btn-group, .grow.flex.items-center.justify-end, .flex-grow.flex.items-center.justify-end').forEach(el => el.remove());

        // 이름 폰트 색상 강제 지정 (CSS 우선순위 이슈 및 테마 클래스 누락 방지)
        clonedNode.querySelectorAll('.text-textcolor, .text-textcolor span').forEach(el => {
            (el as HTMLElement).style.setProperty('color', 'var(--risu-theme-textcolor)', 'important');
        });

        // 아바타 이미지 강제 치환 (샌드박스 파일 접근/보안 에러 방지)
        const globalSettings = await loadGlobalSettings();
        const name = getNameFromNode(clonedNode, globalSettings, '');
        if (name && avatarMap) {
            let avatarDataUrl = '';
            if (avatarMap instanceof Map) {
                avatarDataUrl = avatarMap.get(name) || avatarMap.get(name.trim()) || '';
            } else {
                avatarDataUrl = avatarMap[name] || avatarMap[name.trim()] || '';
            }

            if (avatarDataUrl) {
                // 본문 바깥 영역의 <img> 태그 교체
                clonedNode.querySelectorAll('img').forEach(img => {
                    if (!img.closest('.prose, .chattext')) {
                        (img as HTMLImageElement).src = avatarDataUrl;
                    }
                });

                // 본문 바깥 영역의 background-image 스타일 요소 교체
                clonedNode.querySelectorAll<HTMLElement>('[style*="background"]').forEach(el => {
                    if (!el.closest('.prose, .chattext')) {
                        const styleAttr = el.getAttribute('style');
                        if (styleAttr) {
                            const newStyle = styleAttr.replace(/url\(['"]?.*?['"]?\)/g, `url('${avatarDataUrl}')`)
                                                     .replace(/url\(&quot;.*?&quot;\)/g, `url('${avatarDataUrl}')`);
                            el.setAttribute('style', newStyle);
                        }
                    }
                });
            }
        }

        if (settings.embedImages !== false) {
            for (const img of Array.from(clonedNode.querySelectorAll('img'))) {
                if (img.src && !img.src.startsWith('data:') && !img.src.startsWith('blob:')) {
                    try {
                        img.src = await imageUrlToBlob(img.src);
                    } catch (e) {
                        console.warn(`Blob conversion error for ${img.src}:`, e);
                    }
                }
            }

            // 가상 DOM 에서 style 속성 파서 한계를 우회하기 위해 getAttribute/setAttribute를 활용한 속성 문자열 파싱
            for (const el of Array.from(clonedNode.querySelectorAll<HTMLElement>('[style*="background"]'))) {
                const styleAttr = el.getAttribute('style');
                if (styleAttr) {
                    const urlMatch = styleAttr.match(/url\(['"]?(.*?)['"]?\)/) || styleAttr.match(/url\(&quot;(.*?)&quot;\)/);
                    if (urlMatch && urlMatch[1]) {
                        const originalUrl = urlMatch[1];
                        if (!originalUrl.startsWith('data:') && !originalUrl.startsWith('blob:')) {
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
            }
        }

        if (settings.replacementRules && settings.replacementRules.length > 0) {
            // Apply replacements to the message content within the cloned node
            const messageEl = clonedNode.querySelector('.prose, .chattext');
            if (messageEl) {
                applyReplacements(messageEl as HTMLElement, settings.replacementRules);
            }
        }

        // Scale inline styles for full scaling mode
        if (scaleMode === 'full' && scaleFactor !== 1.0) {
            scaleInlineStyles(clonedNode);
        }

        return clonedNode.outerHTML;
    }));

    let fullCss = await getThemeCssVariables() + '\n' + parentStyles.join('\n') + '\n' + await getComprehensivePageCSS();

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

    // Scale CSS stylesheets for full scaling mode
    if (scaleMode === 'full' && scaleFactor !== 1.0) {
        fullCss = scaleStylesheetCSSOM(fullCss);
        extraCss = scaleStylesheetCSSOM(extraCss);
    }

    const wrapperClassAttr = settings.expandHover ? 'class="expand-hover-globally"' : '';
    const wrapperStyle = `
    max-width: ${settings.previewWidth || 800}px;
    `;

    return `
        <style>${fullCss}\n${extraCss}</style>
        <div id="log-html-preview-container" ${wrapperClassAttr} style="${wrapperStyle}">
        <div id="log-html-scaler">
            ${clonedNodesHtml.join('')}
            </div>
        </div>
    `;
};
