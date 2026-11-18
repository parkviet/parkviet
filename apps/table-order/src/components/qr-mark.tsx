import { encode } from 'uqr';

// The QR drawn on the phone; the payload never goes to a remote QR service.
export function QrMark({ payload, label }: { payload: string; label: string }) {
  const { size, data } = encode(payload, { ecc: 'M', border: 2 });
  const path = data
    .flatMap((row, y) => row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : [])))
    .join('');
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="qr"
    >
      <path d={path} fill="#000" />
    </svg>
  );
}
