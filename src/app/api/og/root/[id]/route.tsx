import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get("title") || "Hidden Roots";
    const headline = searchParams.get("headline") || "Everything has roots. Discover the hidden system.";
    const lens = searchParams.get("lens") || "tech";

    const lensColors: Record<string, string> = {
      language: "#7FB8FF",
      culture: "#FF9B7A",
      mind: "#D4A5FF",
      money: "#9BE564",
      tech: "#5FE0E8",
      origins: "#FF86B8",
    };

    const accentColor = lensColors[lens] || "#FFC857";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            backgroundColor: "#0E1411",
            padding: "60px 70px",
            fontFamily: "system-ui, sans-serif",
            border: "2px solid #2A372F",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  backgroundColor: "#FFC857",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "26px",
                  fontWeight: "bold",
                  color: "#0E1411",
                }}
              >
                🌱
              </div>
              <span
                style={{
                  fontSize: "28px",
                  fontWeight: "800",
                  letterSpacing: "-0.02em",
                  color: "#EAF1EC",
                }}
              >
                Deep Roots
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 20px",
                borderRadius: "9999px",
                backgroundColor: "#151D18",
                border: "1.5px solid #2A372F",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: accentColor,
                }}
              />
              <span
                style={{
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "#FFC857",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Root Discovery
              </span>
            </div>
          </div>

          {/* Central Question / Discovery */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div
              style={{
                fontSize: "64px",
                fontWeight: "900",
                color: "#EAF1EC",
                letterSpacing: "-0.03em",
                lineHeight: "1.05",
              }}
            >
              {title}
            </div>

            <div
              style={{
                fontSize: "30px",
                fontWeight: "500",
                color: "#9AAAA0",
                lineHeight: "1.35",
                maxWidth: "960px",
              }}
            >
              {headline}
            </div>
          </div>

          {/* Footer Call to Action */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "1.5px solid #2A372F",
              paddingTop: "32px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "20px", color: "#FFC857", fontWeight: "600" }}>
                deeproots.app/r/{params.id}
              </span>
            </div>

            <span style={{ fontSize: "20px", color: "#55635B" }}>
              Scan, decompose & unearth hidden systems
            </span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    return new Response(`Failed to generate image: ${e.message}`, { status: 500 });
  }
}
