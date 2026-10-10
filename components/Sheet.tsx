"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Drawer } from "@base-ui/react/drawer";
import { hapticRef } from "@/lib/haptics";

/**
 * Receives the element that the rest layers (components/RestExperience.tsx)
 * render into while a sheet is open. Provided by the session page only.
 *
 * The sheet is modal: Base UI marks everything outside its portal hidden and
 * its backdrop takes every touch, so a rest bar left on the page would sit
 * under the sheet, dead. Inside the portal it stays above the sheet and keeps
 * working, and touching it is not a backdrop press, so it never closes the
 * sheet. Do not turn modality off instead: the page must not scroll and the
 * set switches underneath must not fire while a sheet is open.
 */
export const SheetLayerHost = createContext<((host: HTMLElement | null) => void) | null>(null);

/**
 * The one bottom sheet (Base UI Drawer): slides up, swipe down to close, the
 * backdrop or × closes it too. Children render only while it is open or
 * sliding out, so their state resets each time it opens.
 */
export function Sheet({
  open,
  onClose,
  title,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const setLayerHost = useContext(SheetLayerHost);
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Drawer.Portal className="sheetportal">
        <Drawer.Backdrop className="scrim" />
        <Drawer.Viewport className="sheetport">
          <Drawer.Popup className={className ? `sheet ${className}` : "sheet"}>
            <Drawer.Close className="sheetclose" ref={hapticRef} data-haptic="selection" aria-label="close">
              ×
            </Drawer.Close>
            <Drawer.Title>{title}</Drawer.Title>
            {children}
          </Drawer.Popup>
        </Drawer.Viewport>
        {setLayerHost && <div className="sheetlayers" ref={setLayerHost} />}
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/**
 * The last non-null `value`, so a sheet keeps its content while it slides out
 * after the state that opened it has been cleared.
 */
export function useShownWhileClosing<T>(value: T | null): T | null {
  const [shown, setShown] = useState(value);
  if (value !== null && value !== shown) setShown(value);
  return value ?? shown;
}
