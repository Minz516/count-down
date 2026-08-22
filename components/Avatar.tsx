import Image from "next/image";
import { clsx } from "clsx";

interface AvatarProps {
  src: string | null;
  alt: string;
  size?: number;
  className?: string;
}

/** Circular avatar, falling back to the default silhouette when no image is set - used by
 * the account menu, the group member list, and the group card avatar previews alike. */
export function Avatar({ src, alt, size = 28, className }: AvatarProps) {
  return (
    <Image
      src={src ?? "/default-avatar.png"}
      alt={alt}
      width={size}
      height={size}
      className={clsx("shrink-0 rounded-full object-cover", className)}
      style={{ width: size, height: size }}
    />
  );
}
