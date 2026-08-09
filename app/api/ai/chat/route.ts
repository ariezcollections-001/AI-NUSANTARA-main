import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const message = String(body.message || "").trim();

    if (!message) {
      return NextResponse.json({ error: "Pesan diperlukan." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
    }

    // Simple chatbot response logic
    const lowerMessage = message.toLowerCase();
    let reply = "";

    if (lowerMessage.includes("halo") || lowerMessage.includes("hai") || lowerMessage.includes("hi")) {
      reply = "Halo! 👋 Selamat datang di BIKIN AI. Ada yang bisa saya bantu?";
    } else if (lowerMessage.includes("saldo") || lowerMessage.includes("kuota")) {
      reply = "Untuk melihat saldo karakter Anda, silakan cek di dashboard utama. Jika saldo habis, Anda dapat mengisi ulang melalui tombol 'ISI ULANG SALDO'.";
    } else if (lowerMessage.includes("cara") || lowerMessage.includes("bagaimana") || lowerMessage.includes("gimana")) {
      reply = "Anda dapat menggunakan fitur AI dengan memilih salah satu dari 11 klaster fitur di dashboard, mengisi formulir, dan mengklik 'Generate'. Setiap permintaan akan memotong saldo karakter Anda.";
    } else if (lowerMessage.includes("error") || lowerMessage.includes("salah") || lowerMessage.includes("gagal")) {
      reply = "Mohon maaf jika terjadi kesalahan. Coba refresh halaman atau hubungi tim support jika masalah berlanjut. Pastikan koneksi internet Anda stabil.";
    } else if (lowerMessage.includes("terima kasih") || lowerMessage.includes("makasih") || lowerMessage.includes("thanks")) {
      reply = "Sama-sama! 😊 Senang bisa membantu. Jika ada pertanyaan lain, jangan ragu untuk bertanya.";
    } else if (lowerMessage.includes("fitur") || lowerMessage.includes("apa saja")) {
      reply = "BIKIN AI memiliki 11+ fitur: Generator Teks, Chat AI, Image Prompt, Ringkas Teks, Parafras/Paraphrase, Translate, Data Analyzer, Email Writer, Social Caption, Business Plan, dan Kode Generator.";
    } else {
      reply = "Terima kasih atas pesan Anda. Tim support akan segera membantu. Untuk pertanyaan teknis, Anda juga bisa mencoba merefresh halaman atau memeriksa kembali input Anda.";
    }

    return NextResponse.json({
      success: true,
      data: {
        reply,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error("Chat API error:", e);
    return NextResponse.json(
      { error: "Gagal memproses pesan." },
      { status: 500 }
    );
  }
}
