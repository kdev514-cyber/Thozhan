"use client";

type ThozhanLogoProps = {
  compact?: boolean;
  dark?: boolean;
};

export default function ThozhanLogo({
  compact = false,
  dark = false,
}: ThozhanLogoProps) {
  return (
    <div
      className={`relative ${
        compact ? "w-9 h-9" : "w-11 h-11"
      } shrink-0`}
      aria-label="Thozhan"
    >
      <div
        className={`absolute inset-[2px] rounded-full border ${
          dark
            ? "border-white/20"
            : "border-[#706BDA]/25"
        }`}
      />

      <div
        className={`absolute left-0 top-1/2 w-full h-[1px] rotate-[-28deg] ${
          dark
            ? "bg-white/15"
            : "bg-[#706BDA]/15"
        }`}
      />

      <div
        className={`absolute -right-[1px] top-[7px] w-2 h-2 rounded-full ${
          dark
            ? "bg-[#C9C7FF]"
            : "bg-[#6965D7]"
        } shadow-[0_0_0_3px_rgba(105,101,215,0.10)]`}
      />

      <div
        className={`absolute inset-[7px] rounded-[11px] flex items-center justify-center font-semibold ${
          compact
            ? "text-[14px]"
            : "text-[17px]"
        } ${
          dark
            ? "bg-white text-[#5753C9]"
            : "bg-[#ECECF8] text-[#5753C9]"
        }`}
      >
        த
      </div>
    </div>
  );
}
