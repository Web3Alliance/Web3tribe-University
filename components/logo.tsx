import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The official Web3tribe University crest. Used wherever the brand needs to
 * appear as an image rather than plain text — auth pages, the topbar, the
 * marketing page, and the public certificate verification page.
 */
export function Logo({
  size = 40,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt="Web3tribe University crest"
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0", className)}
    />
  );
}