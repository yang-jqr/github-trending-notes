import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 96,
        background: 'linear-gradient(145deg, #8b6cff, #ff79b0)',
      }}
    >
      <div style={{ position: 'relative', width: 280, height: 280, display: 'flex' }}>
        {[0, 45, 90, 135].map(rotation => (
          <div
            key={rotation}
            style={{
              position: 'absolute',
              left: 112,
              top: 0,
              width: 56,
              height: 280,
              borderRadius: 999,
              background: 'white',
              transform: `rotate(${rotation}deg)`,
            }}
          />
        ))}
      </div>
    </div>,
    size,
  );
}
