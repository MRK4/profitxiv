"use client";

import { useState, useEffect } from "react";
import spinners from "unicode-animations";

interface SpinnerProps {
  name?: keyof typeof spinners;
  children?: React.ReactNode;
}

export function BrailleSpinner({ name = "braille", children }: SpinnerProps) {
  const s = spinners[name] ?? spinners.braille;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setFrame((f) => (f + 1) % s.frames.length),
      s.interval
    );
    return () => clearInterval(timer);
  }, [s.frames.length, s.interval]);

  return (
    <span style={{ fontFamily: "monospace" }}>
      {s.frames[frame]} {children}
    </span>
  );
}

// Usage: <Spinner name="helix">Generating response...</Spinner>