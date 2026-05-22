'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard/generate', label: 'Generate' },
  { href: '/dashboard/billing', label: 'Billing' },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              isActive
                ? 'border-teal-400/60 bg-teal-300/15 text-teal-200'
                : 'border-white/10 text-slate-200 hover:border-teal-300/60 hover:bg-teal-300/10 hover:text-white'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
