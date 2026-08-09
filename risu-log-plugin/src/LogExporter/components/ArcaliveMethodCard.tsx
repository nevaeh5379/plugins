import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface ArcaliveMethodCardProps {
  onClick: () => void;
  title: string;
  description: string;
  Icon: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  extra?: ReactNode;
}

export default function ArcaliveMethodCard({
  onClick,
  title,
  description,
  Icon,
  disabled = false,
  loading = false,
  extra,
}: Readonly<ArcaliveMethodCardProps>) {
  return (
    <button
      className="arcalive-method-button"
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled || loading ? 0.5 : 1,
      }}
    >
      <span
        style={{
          color: "var(--text-secondary)",
          fontSize: "1.2rem",
          margin: "0 0 8px 0",
          fontWeight: "bold",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <Icon size={16} />
        {title}
      </span>
      <span
        style={{
          display: "flex",
          color: "var(--text-secondary)",
          margin: 0,
          fontSize: "0.9em",
        }}
      >
        {description}
      </span>
      {extra}
    </button>
  );
}