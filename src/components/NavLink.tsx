import Link, { type LinkProps } from "next/link";
import { forwardRef } from "react";

type NavLinkCompatProps = LinkProps & React.AnchorHTMLAttributes<HTMLAnchorElement>;

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(function NavLink(
  { href, children, ...props },
  ref,
) {
  return (
    <Link href={href} {...props} ref={ref}>
      {children}
    </Link>
  );
});

export { NavLink };

