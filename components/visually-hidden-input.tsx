"use client";

import * as React from "react";

type InputValue = string[] | string;

interface VisuallyHiddenInputProps<T = InputValue>
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "checked" | "onReset"
  > {
  value?: T;
  checked?: boolean;
  control: HTMLElement | null;
  bubbles?: boolean;
}

function VisuallyHiddenInput<T = InputValue>(
  props: VisuallyHiddenInputProps<T>,
) {
  const {
    control,
    value,
    checked,
    bubbles = true,
    type = "hidden",
    style,
    ...inputProps
  } = props;

  const isCheckInput = React.useMemo(
    () => type === "checkbox" || type === "radio" || type === "switch",
    [type],
  );
  const inputRef = React.useRef<HTMLInputElement>(null);

  const prevValueRef = React.useRef<{
    value: T | boolean | undefined;
    previous: T | boolean | undefined;
  }>({
    value: isCheckInput ? checked : value,
    previous: isCheckInput ? checked : value,
  });

  const [controlSize, setControlSize] = React.useState<{
    width?: number;
    height?: number;
  }>({});

  React.useLayoutEffect(() => {
    if (!control) {
      setControlSize({});
      return;
    }

    setControlSize({
      width: control.offsetWidth,
      height: control.offsetHeight,
    });

    if (typeof window === "undefined") return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!Array.isArray(entries) || !entries.length) return;

      const entry = entries[0];
      if (!entry) return;

      let width: number;
      let height: number;

      if ("borderBoxSize" in entry) {
        const borderSizeEntry = entry.borderBoxSize;
        const borderSize = Array.isArray(borderSizeEntry)
          ? borderSizeEntry[0]
          : borderSizeEntry;
        width = borderSize.inlineSize;
        height = borderSize.blockSize;
      } else {
        width = control.offsetWidth;
        height = control.offsetHeight;
      }

      setControlSize({ width, height });
    });

    resizeObserver.observe(control, { box: "border-box" });
    return () => {
      resizeObserver.disconnect();
    };
  }, [control]);

  React.useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const inputProto = window.HTMLInputElement.prototype;
    const propertyKey = isCheckInput ? "checked" : "value";
    const eventType = isCheckInput ? "click" : "input";
    const currentValue = isCheckInput ? checked : value;
    const previousValue = prevValueRef.current.value;

    if (previousValue !== currentValue) {
      // Update ref
      prevValueRef.current.previous = previousValue;
      prevValueRef.current.value = currentValue;

      // Dispatch event
      const serializedCurrentValue = isCheckInput
        ? checked
        : typeof value === "object" && value !== null
          ? JSON.stringify(value)
          : value;

      const descriptor = Object.getOwnPropertyDescriptor(inputProto, propertyKey);
      const setter = descriptor?.set;

      if (setter) {
        const event = new Event(eventType, { bubbles });
        setter.call(input, serializedCurrentValue);
        input.dispatchEvent(event);
      }
    }
  }, [isCheckInput, value, checked, bubbles]);

  const composedStyle = React.useMemo<React.CSSProperties>(() => {
    return {
      ...style,
      ...(controlSize.width !== undefined && controlSize.height !== undefined
        ? controlSize
        : {}),
      border: 0,
      clip: "rect(0 0 0 0)",
      clipPath: "inset(50%)",
      height: "1px",
      margin: "-1px",
      overflow: "hidden",
      padding: 0,
      position: "absolute",
      whiteSpace: "nowrap",
      width: "1px",
    };
  }, [style, controlSize]);

  return (
    <input
      type={type}
      {...inputProps}
      ref={inputRef}
      aria-hidden={isCheckInput}
      tabIndex={-1}
      defaultChecked={isCheckInput ? checked : undefined}
      style={composedStyle}
    />
  );
}

export { VisuallyHiddenInput };
