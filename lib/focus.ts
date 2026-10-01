/**
 * Ref callback that focuses an input on mount only when the device has a fine pointer (mouse or
 * trackpad). On touch devices it does nothing, so the on-screen keyboard doesn't appear unprompted.
 */
export function focusIfFinePointer(element: HTMLElement | null) {
  if (element && window.matchMedia("(pointer: fine)").matches) {
    element.focus({ preventScroll: true });
  }
}
