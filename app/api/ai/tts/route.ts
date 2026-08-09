import { NextResponse } from "next/server";

interface TTSRequest {
  text: string;
  voice?: "sales_tiktok" | "kakak_ayu" | "narator_profesional";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { text, voice = "kakak_ayu" } = body as TTSRequest;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "Teks diperlukan." }, { status: 400 });
    }

    // Validate voice selection
    const validVoices = ["sales_tiktok", "kakak_ayu", "narator_profesional"];
    const selectedVoice = validVoices.includes(voice) ? voice : "kakak_ayu";

    // Voice configuration mapping
    const voiceConfig: Record<string, { voice_id: string; stability: number; similarity_boost: number }> = {
      sales_tiktok: {
        voice_id: "pNInz6obpgDQGcFmaJgB", // Example ElevenLabs voice ID for energetic speaker
        stability: 0.5,
        similarity_boost: 0.75,
      },
      kakak_ayu: {
        voice_id: "EXAVITQu4vr4xnSDxMaL", // Example ElevenLabs voice ID for friendly female speaker
        stability: 0.6,
        similarity_boost: 0.8,
      },
      narator_profesional: {
        voice_id: "VR6AewLTigWG4xSOukaG", // Example ElevenLabs voice ID for deep narrator voice
        stability: 0.85,
        similarity_boost: 0.9,
      },
    };

    const selectedConfig = voiceConfig[selectedVoice];
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!elevenLabsApiKey) {
      // Fallback: Return a simple text response indicating TTS is not configured
      return NextResponse.json(
        {
          error: "Layanan TTS belum dikonfigurasi. Silakan tambahkan ELEVENLABS_API_KEY di environment variables.",
          voice: selectedVoice,
        },
        { status: 501 }
      );
    }

    // Call ElevenLabs API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedConfig.voice_id}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": elevenLabsApiKey,
        },
        body: JSON.stringify({
          text: text.slice(0, 5000), // Limit to 5000 characters for API
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: selectedConfig.stability,
            similarity_boost: selectedConfig.similarity_boost,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      return NextResponse.json(
        { error: `Gagal memproses audio: ${response.statusText}` },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });

    return new NextResponse(audioBlob, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `inline; filename="tts-${selectedVoice}.mp3"`,
      },
    });
  } catch (e) {
    console.error("TTS API error:", e);
    return NextResponse.json(
      { error: "Gagal memproses permintaan audio." },
      { status: 500 }
    );
  }
}
