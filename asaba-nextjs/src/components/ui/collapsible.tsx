// We need to add Collapsible to shadcn or create our own
// This re-exports from @base-ui/react or uses a simple implementation

"use client";

import * as React from "react";

const CollapsibleContext = React.createContext<{
  open: boolean;
  toggle: () => void;
}>({ open: false, toggle: () => {} });

interface CollapsibleProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function Collapsible({
  children,
  defaultOpen = false,
  className,
}: CollapsibleProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <CollapsibleContext.Provider
      value={{ open, toggle: () => setOpen((o) => !o) }}
    >
      <div className={className} data-state={open ? "open" : "closed"}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
}

export function CollapsibleTrigger({
  children,
  asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  const { toggle } = React.useContext(CollapsibleContext);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: toggle,
    });
  }

  return <button onClick={toggle}>{children}</button>;
}

export function CollapsibleContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { open } = React.useContext(CollapsibleContext);
  if (!open) return null;
  return <>{children}</>;
}
