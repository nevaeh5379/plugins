/**
 * Type declarations for capture libraries without bundled types.
 */

// dom-to-image-more
declare module 'dom-to-image-more' {
    interface DomToImageOptions {
        quality?: number;
        bgcolor?: string;
        width?: number;
        height?: number;
        style?: Record<string, string>;
        filter?: (node: Node) => boolean;
        imagePlaceholder?: string;
        cacheBust?: boolean;
        onclone?: (clonedDoc: Document, node: Element) => void;
        injectFakeTextWhileLoading?: boolean;
        includeQueryParams?: boolean;
    }

    export function toBlob(node: Element, options?: DomToImageOptions): Promise<Blob | null>;
    export function toPng(node: Element, options?: DomToImageOptions): Promise<string>;
    export function toJpeg(node: Element, options?: DomToImageOptions): Promise<string>;
    export function toSvg(node: Element, options?: DomToImageOptions): Promise<string>;
    export default { toBlob, toPng, toJpeg, toSvg };
}

// html-to-image
declare module 'html-to-image' {
    interface HtmlToImageOptions {
        quality?: number;
        backgroundColor?: string | null;
        width?: number;
        height?: number;
        pixelRatio?: number;
        canvasWidth?: number;
        canvasHeight?: number;
        skipAutoScale?: boolean;
        skipFonts?: boolean;
        fontEmbedCSS?: string;
        filter?: (node: Node) => boolean;
        imagePlaceholder?: string;
        cacheBust?: boolean;
        onclone?: (clonedDoc: Document, node: Element) => void;
        injectFakeTextWhileLoading?: boolean;
        includeQueryParams?: boolean;
        style?: Record<string, string>;
        onImageErrorHandler?: (error: unknown) => void;
        fetchRequestInit?: RequestInit;
        preferredFontFormat?: string;
    }

    export function toBlob(node: Element, options?: HtmlToImageOptions): Promise<Blob | null>;
    export function toPng(node: Element, options?: HtmlToImageOptions): Promise<string>;
    export function toJpeg(node: Element, options?: HtmlToImageOptions): Promise<string>;
    export function toSvg(node: Element, options?: HtmlToImageOptions): Promise<string>;
    export function toCanvas(node: Element, options?: HtmlToImageOptions): Promise<HTMLCanvasElement>;
    export function getFontEmbedCSS(node: Element, options?: HtmlToImageOptions): Promise<string>;
    export function toPixelData(node: Element, options?: HtmlToImageOptions): Promise<ImageData>;
}
