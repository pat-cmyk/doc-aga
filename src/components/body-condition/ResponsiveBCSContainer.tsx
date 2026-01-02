import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ResponsiveBCSContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function ResponsiveBCSContainer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: ResponsiveBCSContainerProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={cn("max-h-[92vh] flex flex-col", className)}>
          <DrawerHeader className="text-left flex-shrink-0">
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-2 -webkit-overflow-scrolling-touch overscroll-contain">
            {children}
          </div>
          {footer && (
            <DrawerFooter className="flex-shrink-0 pt-2">
              {footer}
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-md max-h-[85vh] flex flex-col overflow-hidden", className)}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <ScrollArea className="flex-1 pr-4 -mr-4">
          {children}
        </ScrollArea>
        {footer && (
          <div className="flex-shrink-0 pt-4 border-t mt-4">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
