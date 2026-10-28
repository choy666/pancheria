import { ReactNode } from 'react';

export default function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      data-theme="light"
      className="flex min-h-dvh flex-col bg-background text-foreground"
    >
      {children}
    </div>
  );
}
