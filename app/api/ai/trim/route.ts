import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const text = String(body.text || "").trim();

    if (!text) {
      return NextResponse.json({ error: "Teks diperlukan." }, { status: 400 });
    }

    // Limit to 2000 characters
    const limitedText = text.slice(0, 2000);

    // Simple AI trimming logic - remove extra whitespace, extract key information
    const lines = limitedText.split("\n").filter(line => line.trim().length > 0);
    const cleanedText = lines.map(line => line.trim()).join("\n");

    // Extract structured data based on common patterns
    const trimmedData = {
      raw: cleanedText,
      summary: cleanedText.slice(0, 500) + (cleanedText.length > 500 ? "..." : ""),
      lines: lines.length,
      characters: cleanedText.length,
    };

    return NextResponse.json({
      success: true,
      data: {
        trimmedText: cleanedText,
        metadata: trimmedData,
      },
    });
  } catch (error) {
    console.error("Trim API error:", error);
    return NextResponse.json(
      { error: "Gagal memproses teks." },
      { status: 500 }
    );
  }
}