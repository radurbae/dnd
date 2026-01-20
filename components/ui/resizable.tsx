"use client";

import * as React from "react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";

import { cn } from "../../lib/utils";

const ResizablePanelGroup = PanelGroup;
const ResizablePanel = Panel;

const ResizableHandle = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PanelResizeHandle> & {
    withHandle?: boolean;
  }
>(({ className, withHandle = false, ...props }, ref) => (
  <PanelResizeHandle
    ref={ref}
    className={cn(
      "relative flex w-px items-center justify-center bg-zinc-900",
      "after:absolute after:h-16 after:w-[3px] after:rounded-full after:bg-zinc-800",
      "hover:bg-zinc-800",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="h-6 w-2 rounded-full bg-zinc-700" />
    )}
  </PanelResizeHandle>
));
ResizableHandle.displayName = "ResizableHandle";

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
