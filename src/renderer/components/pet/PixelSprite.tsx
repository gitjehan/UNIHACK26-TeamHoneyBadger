import React, { useMemo } from 'react';

interface PixelSpriteProps {
  grid: string[];
  palette: Record<string, string>;
  overlay?: string[];
  overlayPalette?: Record<string, string>;
  scale?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders a pixel sprite as an SVG using rect elements.
 * Each character in the grid maps to a color in the palette.
 * '.' characters are treated as transparent.
 */
export const PixelSprite = React.memo(function PixelSprite({
  grid,
  palette,
  overlay,
  overlayPalette,
  scale = 3,
  className,
  style,
}: PixelSpriteProps): JSX.Element {
  const height = grid.length;
  const width = grid.reduce((max, row) => Math.max(max, row.length), 0);

  const rects = useMemo(() => {
    const elements: JSX.Element[] = [];
    let key = 0;

    // Render base grid
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      for (let x = 0; x < row.length; x++) {
        const char = row[x];
        if (char !== '.' && palette[char]) {
          elements.push(
            <rect
              key={key++}
              x={x}
              y={y}
              width={1}
              height={1}
              fill={palette[char]}
            />
          );
        }
      }
    }

    // Render overlay if provided
    if (overlay && overlayPalette) {
      for (let y = 0; y < overlay.length; y++) {
        const row = overlay[y];
        for (let x = 0; x < row.length; x++) {
          const char = row[x];
          if (char !== '.' && overlayPalette[char]) {
            elements.push(
              <rect
                key={key++}
                x={x}
                y={y}
                width={1}
                height={1}
                fill={overlayPalette[char]}
              />
            );
          }
        }
      }
    }

    return elements;
  }, [grid, palette, overlay, overlayPalette]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width * scale}
      height={height * scale}
      className={className}
      style={{
        imageRendering: 'pixelated',
        ...style,
      }}
      shapeRendering="crispEdges"
    >
      {rects}
    </svg>
  );
});

/**
 * Smaller pixel heart component for floating effects
 */
export const PixelHeart = React.memo(function PixelHeart({
  color = '#E88B8B',
  size = 5,
  className,
  style,
}: {
  color?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}): JSX.Element {
  return (
    <svg
      viewBox="0 0 7 6"
      width={size * 2}
      height={size * 1.7}
      className={className}
      style={{
        imageRendering: 'pixelated',
        ...style,
      }}
      shapeRendering="crispEdges"
    >
      {/* Row 0: .hh.hh. */}
      <rect x={1} y={0} width={2} height={1} fill={color} />
      <rect x={4} y={0} width={2} height={1} fill={color} />
      {/* Row 1-2: hhhhhhh */}
      <rect x={0} y={1} width={7} height={2} fill={color} />
      {/* Row 3: .hhhhh. */}
      <rect x={1} y={3} width={5} height={1} fill={color} />
      {/* Row 4: ..hhh.. */}
      <rect x={2} y={4} width={3} height={1} fill={color} />
      {/* Row 5: ...h... */}
      <rect x={3} y={5} width={1} height={1} fill={color} />
    </svg>
  );
});

/**
 * Pixel sweat drop for worried state
 */
export const PixelSweat = React.memo(function PixelSweat({
  size = 3,
  className,
  style,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}): JSX.Element {
  const outline = '#6BA3C4';
  const light = '#A8D4E8';
  const highlight = '#E8F4FA';

  return (
    <svg
      viewBox="0 0 3 7"
      width={size}
      height={size * 2.3}
      className={className}
      style={{
        imageRendering: 'pixelated',
        ...style,
      }}
      shapeRendering="crispEdges"
    >
      <rect x={1} y={0} width={1} height={1} fill={outline} />
      <rect x={1} y={1} width={1} height={1} fill={highlight} />
      <rect x={0} y={2} width={1} height={4} fill={outline} />
      <rect x={1} y={2} width={1} height={4} fill={highlight} />
      <rect x={2} y={2} width={1} height={4} fill={light} />
      <rect x={1} y={6} width={1} height={1} fill={outline} />
    </svg>
  );
});
