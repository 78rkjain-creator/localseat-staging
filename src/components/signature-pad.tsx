"use client";

import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react";

export interface SignaturePadHandle {
  getDataURL: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
}

interface Props {
  width?: number;
  height?: number;
}

export const SignaturePad = forwardRef<SignaturePadHandle, Props>(
  function SignaturePad({ width = 600, height = 220 }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const hasStrokes = useRef(false);
    const [empty, setEmpty] = useState(true);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }, []);

    useImperativeHandle(ref, () => ({
      getDataURL() {
        return canvasRef.current?.toDataURL("image/png") ?? null;
      },
      clear() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        hasStrokes.current = false;
        setEmpty(true);
      },
      isEmpty() {
        return !hasStrokes.current;
      },
    }));

    function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
      };
    }

    function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
      e.currentTarget.setPointerCapture(e.pointerId);
      isDrawing.current = true;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    }

    function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!isDrawing.current) return;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      hasStrokes.current = true;
      if (empty) setEmpty(false);
    }

    function handlePointerUp() {
      isDrawing.current = false;
    }

    return (
      <div className="relative w-full">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ touchAction: "none", cursor: "crosshair" }}
          className="w-full rounded-xl border border-slate-200 bg-white"
        />
        {empty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-slate-300 select-none">Sign here</p>
          </div>
        )}
      </div>
    );
  }
);
