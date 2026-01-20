"use client";

import * as React from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { cn } from "../../lib/utils";

const ResizablePanelGroup = Group;
const ResizablePanel = Panel;

type ResizableHandleProps = React.ComponentPropsWithoutRef<typeof Separator> & {
  withHandle?: boolean;
};

const ResizableHandle = ({
  className,
  withHandle = false,
  ...props
}: ResizableHandleProps) => (
  <Separator
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
  </Separator>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
