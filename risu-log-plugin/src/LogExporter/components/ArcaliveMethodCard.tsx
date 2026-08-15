import React, { memo } from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";

/**
 * Visual variant types for badge indicators.
 */
export type MethodBadgeVariant =
  | "default"
  | "recommended"
  | "primary"
  | "success"
  | "warning"
  | "info"
  | "secondary"
  | "purple";

/**
 * Upload method types supported in Arcalive export.
 */
export type ArcaMethodType =
  | "proxy"
  | "direct"
  | "base64"
  | "manual"
  | "custom";

/**
 * Badge configuration object for granular badge customization.
 */
export interface MethodBadgeConfig {
  text: string;
  variant?: MethodBadgeVariant;
}

/**
 * Step item definition for multi-step workflow guides.
 */
export interface MethodStepItem {
  title: string;
  description?: string;
}

/**
 * Props for the ArcaliveMethodCard component.
 */
export interface ArcaliveMethodCardProps {
  /** Click handler triggered when clicking the method card */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Title text or custom React element */
  title: React.ReactNode;
  /** Primary description text or element */
  description: React.ReactNode;
  /** Lucide icon component to display next to the title */
  Icon?:
    | LucideIcon
    | React.ComponentType<{
        size?: number;
        className?: string;
        style?: React.CSSProperties;
      }>;
  /** Whether the card button is disabled */
  disabled?: boolean;
  /** Whether the card is currently in a loading/processing state */
  loading?: boolean;
  /** Optional loading message displayed next to the spinner */
  loadingText?: string;
  /** Optional badge text, badge config, or custom badge React element */
  badge?: React.ReactNode | MethodBadgeConfig;
  /** Visual variant for badge styling (defaults to 'default') */
  badgeVariant?: MethodBadgeVariant;
  /** Semantic method type (proxy, direct, base64, manual, custom) */
  methodType?: ArcaMethodType;
  /** Optional step description list or custom step elements */
  steps?: (string | MethodStepItem | React.ReactNode)[] | React.ReactNode;
  /** Optional step number or step label (e.g. '1단계' or 1) */
  stepNumber?: string | number;
  /** Extra ReactNode (e.g. configuration warnings, secondary actions, details) */
  extra?: React.ReactNode;
  /** Additional CSS class names */
  className?: string;
  /** Custom inline styles */
  style?: React.CSSProperties;
  /** Optional HTML element ID */
  id?: string;
  /** Optional tabIndex */
  tabIndex?: number;
  /** Optional ARIA label for screen readers */
  "aria-label"?: string;
}

/**
 * Badge color map according to badge variant.
 */
const BADGE_STYLES: Record<
  MethodBadgeVariant,
  { bg: string; border: string; text: string }
> = {
  default: {
    bg: "rgba(255, 255, 255, 0.08)",
    border: "rgba(255, 255, 255, 0.15)",
    text: "var(--text-secondary, #a1a1aa)",
  },
  secondary: {
    bg: "rgba(255, 255, 255, 0.06)",
    border: "rgba(255, 255, 255, 0.12)",
    text: "var(--text-muted, #71717a)",
  },
  recommended: {
    bg: "rgba(59, 130, 246, 0.15)",
    border: "rgba(59, 130, 246, 0.35)",
    text: "var(--primary, #3b82f6)",
  },
  primary: {
    bg: "rgba(59, 130, 246, 0.15)",
    border: "rgba(59, 130, 246, 0.35)",
    text: "var(--primary, #3b82f6)",
  },
  success: {
    bg: "rgba(34, 197, 94, 0.15)",
    border: "rgba(34, 197, 94, 0.35)",
    text: "#4ade80",
  },
  warning: {
    bg: "rgba(245, 158, 11, 0.15)",
    border: "rgba(245, 158, 11, 0.35)",
    text: "#fbbf24",
  },
  info: {
    bg: "rgba(14, 165, 233, 0.15)",
    border: "rgba(14, 165, 233, 0.35)",
    text: "#38bdf8",
  },
  purple: {
    bg: "rgba(168, 85, 247, 0.15)",
    border: "rgba(168, 85, 247, 0.35)",
    text: "#c084fc",
  },
};

/**
 * Helper to render the badge indicator.
 */
function renderBadgeElement(
  badge?: React.ReactNode | MethodBadgeConfig,
  variant: MethodBadgeVariant = "default",
): React.ReactNode {
  if (!badge) return null;

  // If a raw React element or non-config node is passed
  if (React.isValidElement(badge)) {
    return badge;
  }

  let text: React.ReactNode;
  let activeVariant = variant;

  if (typeof badge === "object" && badge !== null && "text" in badge) {
    text = badge.text;
    if (badge.variant) {
      activeVariant = badge.variant;
    }
  } else {
    text = badge as React.ReactNode;
  }

  const styleConfig = BADGE_STYLES[activeVariant] || BADGE_STYLES.default;

  return (
    <span
      className="arcalive-method-badge"
      style={{
        fontSize: "0.72rem",
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: "9999px",
        backgroundColor: styleConfig.bg,
        border: `1px solid ${styleConfig.border}`,
        color: styleConfig.text,
        letterSpacing: "0.02em",
        lineHeight: "1.2",
        display: "inline-flex",
        alignItems: "center",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

/**
 * Helper to render step items cleanly.
 */
function renderStepsList(
  steps?: (string | MethodStepItem | React.ReactNode)[] | React.ReactNode,
): React.ReactNode {
  if (!steps) return null;

  if (!Array.isArray(steps)) {
    return (
      <div className="arcalive-method-steps" style={{ marginTop: "10px" }}>
        {steps}
      </div>
    );
  }

  if (steps.length === 0) return null;

  return (
    <div
      className="arcalive-method-steps"
      style={{
        marginTop: "10px",
        paddingTop: "8px",
        borderTop: "1px solid var(--border-color, rgba(255, 255, 255, 0.08))",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      {steps.map((step, index) => {
        if (typeof step === "string") {
          return (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "6px",
                fontSize: "0.82em",
                color: "var(--text-secondary, #a1a1aa)",
                lineHeight: "1.4",
              }}
            >
              <span
                style={{
                  color: "var(--text-muted, #71717a)",
                  fontWeight: 600,
                  fontSize: "0.9em",
                  minWidth: "14px",
                }}
              >
                {index + 1}.
              </span>
              <span>{step}</span>
            </div>
          );
        }

        if (step && typeof step === "object" && "title" in step) {
          const item = step as MethodStepItem;
          return (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "6px",
                fontSize: "0.82em",
                color: "var(--text-secondary, #a1a1aa)",
                lineHeight: "1.4",
              }}
            >
              <span
                style={{
                  color: "var(--text-muted, #71717a)",
                  fontWeight: 600,
                  fontSize: "0.9em",
                  minWidth: "14px",
                }}
              >
                {index + 1}.
              </span>
              <div>
                <span
                  style={{
                    fontWeight: 500,
                    color: "var(--text-primary, #ffffff)",
                  }}
                >
                  {item.title}
                </span>
                {item.description && (
                  <span
                    style={{
                      marginLeft: "4px",
                      color: "var(--text-secondary, #a1a1aa)",
                    }}
                  >
                    - {item.description}
                  </span>
                )}
              </div>
            </div>
          );
        }

        return <React.Fragment key={index}>{step}</React.Fragment>;
      })}
    </div>
  );
}

/**
 * ArcaliveMethodCard component provides an interactive card button for selecting
 * upload & export methods (Proxy, Direct, Base64, Manual ZIP) with support for
 * badges, loading state, step descriptions, and extra configuration elements.
 */
function ArcaliveMethodCardComponent({
  onClick,
  title,
  description,
  Icon,
  disabled = false,
  loading = false,
  loadingText,
  badge,
  badgeVariant = "default",
  methodType,
  steps,
  stepNumber,
  extra,
  className,
  style,
  id,
  tabIndex,
  "aria-label": ariaLabel,
}: Readonly<ArcaliveMethodCardProps>) {
  const isInteractive = !disabled && !loading;

  // Determine effective badge and variant from methodType preset if not explicitly passed
  let effectiveBadge = badge;
  let effectiveBadgeVariant = badgeVariant;

  if (!effectiveBadge && methodType) {
    switch (methodType) {
      case "proxy":
        effectiveBadge = "Proxy";
        effectiveBadgeVariant = "info";
        break;
      case "direct":
        effectiveBadge = "Direct";
        effectiveBadgeVariant = "recommended";
        break;
      case "base64":
        effectiveBadge = "Base64";
        effectiveBadgeVariant = "purple";
        break;
      case "manual":
        effectiveBadge = "Manual";
        effectiveBadgeVariant = "secondary";
        break;
      default:
        break;
    }
  }

  return (
    <button
      id={id}
      type="button"
      tabIndex={tabIndex}
      aria-label={
        typeof ariaLabel === "string"
          ? ariaLabel
          : typeof title === "string"
            ? title
            : undefined
      }
      aria-disabled={!isInteractive}
      aria-busy={loading}
      className={`arcalive-method-button ${className || ""}`.trim()}
      onClick={onClick}
      disabled={!isInteractive}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        textAlign: "left",
        boxSizing: "border-box",
        cursor: isInteractive ? "pointer" : "not-allowed",
        opacity: isInteractive ? 1 : 0.6,
        transition: "all 0.15s ease-in-out",
        outline: "none",
        ...style,
      }}
    >
      {/* Header Row: Icon, Step Number, Title, Badge, Loading Spinner */}
      <div
        className="arcalive-method-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          marginBottom: "6px",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: disabled
              ? "var(--text-secondary, #a1a1aa)"
              : "var(--text-primary, #ffffff)",
            fontSize: "1.05rem",
            fontWeight: 600,
            lineHeight: 1.3,
            flex: 1,
            minWidth: 0,
          }}
        >
          {Icon && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: disabled
                  ? "var(--text-muted, #71717a)"
                  : "var(--text-primary, #ffffff)",
              }}
            >
              <Icon size={18} />
            </span>
          )}

          {stepNumber !== undefined && (
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: "4px",
                backgroundColor:
                  "var(--bg-tertiary, rgba(255, 255, 255, 0.1))",
                color: "var(--text-muted, #71717a)",
              }}
            >
              {typeof stepNumber === "number"
                ? `${stepNumber}단계`
                : stepNumber}
            </span>
          )}

          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </span>
        </div>

        {/* Right side indicators: Badge & Loading spinner */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            flexShrink: 0,
          }}
        >
          {loading && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "0.75rem",
                color: "var(--primary, #3b82f6)",
              }}
            >
              <Loader2
                size={14}
                style={{
                  animation: "spin 1s linear infinite",
                }}
              />
              {loadingText && <span>{loadingText}</span>}
            </span>
          )}

          {renderBadgeElement(effectiveBadge, effectiveBadgeVariant)}
        </div>
      </div>

      {/* Description */}
      <div
        className="arcalive-method-description"
        style={{
          display: "block",
          color: "var(--text-secondary, #a1a1aa)",
          fontSize: "0.875rem",
          lineHeight: 1.45,
          margin: 0,
        }}
      >
        {description}
      </div>

      {/* Optional Step Instructions */}
      {renderStepsList(steps)}

      {/* Extra content (e.g. setup warning, inputs, additional actions) */}
      {extra && (
        <div
          className="arcalive-method-extra"
          style={{
            marginTop: "8px",
            width: "100%",
          }}
        >
          {extra}
        </div>
      )}
    </button>
  );
}

const ArcaliveMethodCard = memo(ArcaliveMethodCardComponent);
export default ArcaliveMethodCard;