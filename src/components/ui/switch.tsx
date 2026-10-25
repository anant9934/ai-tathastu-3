"use client"

import * as React from "react"
import { cn } from "cn"
import { Switch as SwitchPrimitive } from "radix-ui"

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-border-strong transition-colors duration-150 outline-none after:absolute after:-inset-2 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-foreground",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-5 translate-x-0.5 rounded-full bg-background shadow-sm transition-transform duration-150 data-[state=checked]:translate-x-[1.125rem]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
