import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')

serve(async (req: Request) => {
  // Tangani blokade CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      } 
    })
  }

  try {
    const { imageUrl } = await req.json()
    if (!imageUrl) throw new Error("Injeksi URL gambar gagal pada payload.")

    // Konversi stream biner ke Base64 (Mencegah blocking akses crawler AI)
    const imageRes = await fetch(imageUrl)
    if (!imageRes.ok) throw new Error("Akses penarikan aset dari Storage ditolak.")
    
    const imageBuffer = await imageRes.arrayBuffer()
    const mimeType = imageRes.headers.get('content-type') || 'image/jpeg'
    const base64Data = encode(new Uint8Array(imageBuffer))
    const base64Url = `data:${mimeType};base64,${base64Data}`

    // Eksekusi API Call OpenRouter dengan Model Vision Alternatif
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://managjeh.pages.dev", 
        "X-Title": "Managjeh App"
      },
      body: JSON.stringify({
        // Model dirotasi ke Gemini 1.5 Flash (Tier Gratis OpenRouter)
        model: "qwen/qwen-2-vl-7b-instruct:free",
        messages: [
          {
            role: "user",
            content: [
              { 
                type: "text", 
                text: "Ekstrak total biaya pembelian akhir (amount) dan nama toko/deskripsi singkat (description). Respon WAJIB JSON murni tanpa pembungkus markdown. Format rigid: {\"amount\": 50000, \"description\": \"Nama Toko\"}" 
              },
              { 
                type: "image_url", 
                image_url: { url: base64Url } 
              }
            ]
          }
        ]
      })
    });

    const aiData = await response.json();

    // Rejeksi payload jika vendor mengembalikan error
    if (!response.ok) {
      throw new Error(aiData.error?.message || "Terdapat anomali dari sisi penyedia AI.");
    }

    // Ekstraksi dan sanitasi JSON (Mencegah parse error)
    const rawText = aiData.choices?.[0]?.message?.content || "{}";
    const cleanedText = rawText.replace(/```json|```/g, "").trim();
    const parsedData = JSON.parse(cleanedText);

    return new Response(JSON.stringify(parsedData), { 
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
    })

  } catch (error: any) {
    console.error("🔥 FATAL EDGE FUNCTION ERROR:", error.message || error);

    return new Response(JSON.stringify({ error: error.message || "Eksekusi fungsi backend terinterupsi." }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
    })
  }
})