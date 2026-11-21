import React, { useEffect, useRef, useState } from 'react';

interface CarouselItem {
  src: string;
  alt: string;
}

export function Carousel({ items }: { items: CarouselItem[] }) {
  const [current, setCurrent] = useState(0);
  const [broken, setBroken] = useState<Set<number>>(() => new Set());
  const pausedRef = useRef(false);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = window.setInterval(() => {
      if (!pausedRef.current) {
        setCurrent((prev) => (prev + 1) % items.length);
      }
    }, 3000);
    return () => window.clearInterval(id);
  }, [items.length]);

  if (!items.length) return null;

  return (
    <div
      className="relative border my-5 rounded-lg overflow-hidden"
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {items.map((item, idx) => (
          <div key={idx} className="w-full shrink-0">
            {broken.has(idx) ? (
              <div className="h-44 sm:h-56 border rounded-lg p-4 space-y-4 animate-pulse bg-muted">
                <div className="h-full bg-muted-foreground/20 rounded" />
              </div>
            ) : (
              <img
                src={item.src}
                alt={item.alt}
                className="w-full h-auto max-h-[260px] object-contain bg-muted/20"
                onError={() => {
                  setBroken((prev) => new Set(prev).add(idx));
                }}
              />
            )}
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-2 bg-muted-foreground/50 p-1 rounded-lg">
          {items.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Slide ${idx + 1}`}
              onClick={() => setCurrent(idx)}
              className={`h-2 w-2 rounded-full transition-all ${
                current === idx ? 'bg-background' : 'bg-muted-foreground'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
