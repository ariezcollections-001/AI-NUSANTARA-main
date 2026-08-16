import { NextResponse } from "next/server";
import { getElevenLabsKeyPool, blockKey } from "@/lib/aiVault";

/* ====== 14 WATAK SUARA PREMIUM ======
   id di sini WAJIB sinkron dengan const AUDIO_VOICES
   di components/workbench/AIWorkbench.tsx */
type AudioVoiceId =
  | "pria-formal-wibawa"
  | "pria-santai-gaul"
  | "pria-energik-iklan"
  | "pria-karismatik-sepuh"
  | "pria-naratif-dokumenter"
  | "pria-anak-cowok"
  | "pria-seram-film"
  | "wanita-luwes-manja"
  | "wanita-ceria-antusias"
  | "wanita-dewasa-bijak"
  | "wanita-formal-korporat"
  | "wanita-bisik-asmr"
  | "wanita-anak-cewek"
  | "wanita-seksi-elegan";

interface TTSRequest {
  text: string;
  voice?: AudioVoiceId;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { text, voice = "wanita-luwes-manja" } = body as TTSRequest;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "Teks diperlukan." }, { status: 400 });
    }

    const validVoices: AudioVoiceId[] = [
      "pria-formal-wibawa",
      "pria-santai-gaul",
      "pria-energik-iklan",
      "pria-karismatik-sepuh",
      "pria-naratif-dokumenter",
      "pria-anak-cowok",
      "pria-seram-film",
      "wanita-luwes-manja",
      "wanita-ceria-antusias",
      "wanita-dewasa-bijak",
      "wanita-formal-korporat",
      "wanita-bisik-asmr",
      "wanita-anak-cewek",
      "wanita-seksi-elegan",
    ];
    const selectedVoice: AudioVoiceId = validVoices.includes(voice as AudioVoiceId)
      ? (voice as AudioVoiceId)
      : "wanita-luwes-manja";

    // voiceConfig memakai voice_id contoh yang sudah tersedia;
    // silakan ganti dengan voice_id custom milik user di dashboard ElevenLabs.
    const voiceConfig: Record<AudioVoiceId, { voice_id: string; stability: number; similarity_boost: number }> = {
      // === KATEGORI LAKI-LAKI ===
      "pria-formal-wibawa": { voice_id: "pNInz6obpgDQGcFmaJgB", stability: 0.9, similarity_boost: 0.7 },
      "pria-santai-gaul": { voice_id: "pNInz6obpgDQGcFmaJgB", stability: 0.5, similarity_boost: 0.85 },
      "pria-energik-iklan": { voice_id: "pNInz6obpgDQGcFmaJgB", stability: 0.35, similarity_boost: 0.9 },
      "pria-karismatik-sepuh": { voice_id: "VR6AewLTigWG4xSOukaG", stability: 0.85, similarity_boost: 0.75 },
      "pria-naratif-dokumenter": { voice_id: "VR6AewLTigWG4xSOukaG", stability: 0.6, similarity_boost: 0.85 },
      "pria-anak-cowok": { voice_id: "pNInz6obpgDQGcFmaJgB", stability: 0.45, similarity_boost: 0.95 },
      "pria-seram-film": { voice_id: "VR6AewLTigWG4xSOukaG", stability: 0.95, similarity_boost: 0.6 },
      // === KATEGORI PEREMPUAN ===
      "wanita-luwes-manja": { voice_id: "EXAVITQu4vr4xnSDxMaL", stability: 0.5, similarity_boost: 0.85 },
      "wanita-ceria-antusias": { voice_id: "EXAVITQu4vr4xnSDxMaL", stability: 0.4, similarity_boost: 0.9 },
      "wanita-dewasa-bijak": { voice_id: "EXAVITQu4vr4xnSDxMaL", stability: 0.85, similarity_boost: 0.8 },
      "wanita-formal-korporat": { voice_id: "EXAVITQu4vr4xnSDxMaL", stability: 0.95, similarity_boost: 0.75 },
      "wanita-bisik-asmr": { voice_id: "EXAVITQu4vr4xnSDxMaL", stability: 0.6, similarity_boost: 0.95 },
      "wanita-anak-cewek": { voice_id: "EXAVITQu4vr4xnSDxMaL", stability: 0.45, similarity_boost: 0.95 },
      "wanita-seksi-elegan": { voice_id: "EXAVITQu4vr4xnSDxMaL", stability: 0.45, similarity_boost: 0.85 },
    };

    const selectedConfig = voiceConfig[selectedVoice];
    const elevenLabsPool = await getElevenLabsKeyPool();
    if (elevenLabsPool.length === 0) {
      return NextResponse.json(
        {
          error: "Layanan TTS belum dikonfigurasi. Silakan isi setidaknya satu ElevenLabs API Key di halaman Founder → KOLAM TOKEN GLOBAL (VAULT API KEY RAHASIA) → kolom ElevenLabs Keys (TTS MP3), atau di .env.local (ELEVENLABS_API_KEY).",
          voice: selectedVoice,
        },
        { status: 501 }
      );
    }

    // 🔁 ROTATOR ElevenLabs — sama seperti kolam kunci Gemini/OpenRouter di fitur lain:
    //    coba setiap kunci dari pool; bila 401/403/429, blokir sementara (cooldown 60 detik)
    //    lalu lanjut ke kunci berikutnya. Kunci yang berhasil dipakai untuk request ini.
    let response: Response | null = null;
    for (const apiKey of elevenLabsPool) {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedConfig.voice_id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: text.slice(0, 5000),
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: selectedConfig.stability,
            similarity_boost: selectedConfig.similarity_boost,
          },
        }),
      });
      if (r.ok) {
        response = r;
        break;
      }
      if (r.status === 401 || r.status === 403 || r.status === 429) {
        blockKey("elevenlabs", apiKey); // masuk cooldown 60 detik
        continue;
      }
      response = r; // error lain (bukan rate-limit) → berhenti dan laporkan
      break;
    }

    if (!response || !response.ok) {
      const status = response?.status ?? 502;
      let errorText = "";
      if (response) {
        try { errorText = await response.text(); } catch { /* ignore */ }
      }
      console.error("ElevenLabs API error:", status, errorText);
      const message =
        status === 429
          ? "Gagal memproses audio — semua kunci ElevenLabs sedang dibatasi (rate limit). Coba lagi nanti atau tambahkan kunci di Vault Founder."
          : `Gagal memproses audio: ${response?.statusText ?? "network error"}`;
      return NextResponse.json({ error: message }, { status });
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
