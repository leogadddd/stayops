"use client";

/**
 * Last-resort boundary for errors in the root layout itself. It replaces the
 * root layout, so it renders its own <html> and can't rely on app styles.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
          textAlign: "center",
          padding: "0 24px",
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>StayOps couldn’t load</h1>
          <p style={{ color: "#555", fontSize: 14 }}>
            Something went wrong on our side. Please try again in a moment.
          </p>
          {error.digest && (
            <p style={{ color: "#999", fontSize: 12 }}>Reference: {error.digest}</p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 16, padding: "8px 16px", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
