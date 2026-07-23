import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Log incoming payload for debugging
    console.log('Incoming Telegram Webhook Update:', JSON.stringify(body));

    const message = body.message || body.edited_message;
    if (!message || !message.text) {
      // Return 200 OK for updates we don't handle (e.g., photo changes, join notifications)
      return NextResponse.json({ ok: true });
    }

    const text = message.text.trim();
    const chatId = message.chat.id;

    const parts = text.split(' ');
    const commandWithBot = parts[0].toLowerCase();
    // Strip "@botname" if applicable
    const command = commandWithBot.split('@')[0];
    const arg = parts.slice(1).join(' ').trim();

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('TELEGRAM_BOT_TOKEN is not configured');
      return NextResponse.json({ ok: true, error: 'Telegram bot credentials missing on server' });
    }

    let responseText = '';

    // Route commands
    if (command === '/start' || command === '/help' || command === '/bantuan') {
      responseText = `🤖 <b>StockFlow WMS Bot</b> 🤖\n\n` +
        `Asisten operasional gudang dan inventaris langsung di genggaman Anda!\n\n` +
        `🛠 <b>DAFTAR PERINTAH:</b>\n` +
        `• /stok - Ringkasan status inventaris & estimasi nilai aset.\n` +
        `• /kosong - Daftar barang yang habis total (Stok = 0).\n` +
        `• /tipis - Daftar barang kritis yang berada di bawah batas minimum.\n` +
        `• /cari [kata_kunci] - Cari unit barang (cth: <code>/cari Seprei</code>).\n` +
        `• /laundry - Status cucian aktif yang sedang dikerjakan.\n` +
        `• /myid - Pelajari ID Chat Telegram Anda untuk set-up notifikasi.\n` +
        `• /help - Menampilkan panduan bantuan ini kembali.\n\n` +
        `💡 <i>Gunakan perintah di atas kapan saja untuk berinteraksi dengan basis data secara real-time!</i>`;
    } 
    else if (command === '/stok' || command === '/stock') {
      const { data: products, error } = await supabase
        .from('products')
        .select('*');

      if (error) {
        console.error('Webhook database error:', error);
        responseText = `🔌 <b>Kesalahan Koneksi</b>\n\nGagal terhubung ke pusat basis data. Silakan coba beberapa saat lagi.`;
      } else if (!products || products.length === 0) {
        responseText = `📦 <b>Inventaris Kosong</b>\n\nTidak ditemukan catatan produk di dalam sistem gudang saat ini.`;
      } else {
        const totalSKU = products.length;
        const totalPhysical = products.reduce((acc, p) => acc + (p.stock_quantity || 0), 0);
        const outOfStock = products.filter(p => (p.stock_quantity || 0) === 0).length;
        const lowStock = products.filter(p => (p.stock_quantity || 0) <= (p.min_stock || 0)).length;
        const totalValuation = products.reduce((acc, p) => acc + ((p.stock_quantity || 0) * Number(p.unit_cost || 0)), 0);

        responseText = `📊 <b>RINGKASAN STATUS INVENTARIS</b>\n\n` +
          `• <b>Total Jenis SKU:</b> ${totalSKU} item\n` +
          `• <b>Total Unit Fisik:</b> ${totalPhysical} unit\n` +
          `• <b>Stok Habis (0):</b> ${outOfStock} item 🚫\n` +
          `• <b>Stok Kritis (≤ Min):</b> ${lowStock} item ⚠️\n` +
          `• <b>Estimasi Nilai Aset:</b> $${totalValuation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 💰\n\n` +
          `<i>Ketik /tipis untuk daftar stok kritis atau /kosong untuk daftar stok habis total.</i>`;
      }
    } 
    else if (command === '/kosong' || command === '/empty') {
      const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .eq('stock_quantity', 0)
        .order('name', { ascending: true });

      if (error) {
        console.error('Webhook database error:', error);
        responseText = `🔌 <b>Kesalahan Koneksi</b>\n\nGagal terhubung ke basis data.`;
      } else if (!products || products.length === 0) {
        responseText = `✅ <b>Semua Stok Aman!</b>\n\nTidak ada produk yang kehabisan stok fisik (Stok = 0) saat ini. Semua unit aktif!`;
      } else {
        const itemLines = products.map((p, idx) => 
          `${idx + 1}. [${p.category}] <b>${p.name}</b>\n   <code>ID: ${p.id.slice(0, 8)}</code>`
        );
        
        responseText = `🚫 <b>DAFTAR STOK HABIS TOTAL (0 UNITS)</b>\n` +
          `Ditemukan <b>${products.length}</b> produk kosong:\n\n` +
          itemLines.slice(0, 25).join('\n\n') +
          (products.length > 25 ? `\n\n<i>Dan ${products.length - 25} item kosong lainnya...</i>` : '');
      }
    } 
    else if (command === '/tipis' || command === '/low' || command === '/kritis') {
      const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Webhook database error:', error);
        responseText = `🔌 <b>Kesalahan Koneksi</b>\n\nGagal terhubung ke basis data.`;
      } else {
        const lowProducts = (products || []).filter(p => (p.stock_quantity || 0) <= (p.min_stock || 0) && (p.stock_quantity || 0) > 0);

        if (lowProducts.length === 0) {
          responseText = `🛡️ <b>Inventaris Optimal!</b>\n\nTidak ada produk yang kritis/tipis saat ini. Semua sisa unit berada di atas batas minimal kelayakan.`;
        } else {
          const itemLines = lowProducts.map((p, idx) => {
            const deficit = (p.min_stock || 0) - (p.stock_quantity || 0);
            return `${idx + 1}. [${p.category}] <b>${p.name}</b>\n` +
                   `   Stok: <code>${p.stock_quantity}</code> / Min: <code>${p.min_stock}</code> (Defisit: +${deficit} unit)`;
          });

          responseText = `⚠️ <b>DAFTAR STOK SANGAT KRITIS</b>\n` +
            `Ditemukan <b>${lowProducts.length}</b> produk menipis:\n\n` +
            itemLines.slice(0, 20).join('\n\n') +
            (lowProducts.length > 20 ? `\n\n<i>Dan ${lowProducts.length - 20} item kritis lainnya...</i>` : '');
        }
      }
    } 
    else if (command === '/cari' || command === '/search') {
      if (!arg) {
        responseText = `⚠️ <b>Instruksi Pencarian</b>\n\nFormat salah! Silakan sertakan kata kunci setelah perintah.\nContoh: <code>/cari Handuk</code>`;
      } else {
        const { data: products, error } = await supabase
          .from('products')
          .select('*');

        if (error) {
          console.error('Webhook database error:', error);
          responseText = `🔌 <b>Kesalahan Koneksi</b>\n\nGagal terhubung ke basis data.`;
        } else if (!products || products.length === 0) {
          responseText = `🔍 Tidak ada barang apa pun di dalam gudang saat ini.`;
        } else {
          const matches = products.filter(p => 
            p.name.toLowerCase().includes(arg.toLowerCase()) || 
            p.category.toLowerCase().includes(arg.toLowerCase()) ||
            p.id.toLowerCase().includes(arg.toLowerCase())
          );

          if (matches.length === 0) {
            responseText = `🔍 <b>Hasil Pencarian</b>\n\nTidak ditemukan produk yang cocok dengan kata kunci: <b>"${arg}"</b>`;
          } else {
            const itemLines = matches.map((p) => {
              const isZero = (p.stock_quantity || 0) === 0;
              const isLow = (p.stock_quantity || 0) <= (p.min_stock || 0);
              const status = isZero ? '🚫 KOSONG' : isLow ? '⚠️ KRITIS' : '✅ OPTIMAL';
              return `• <b>${p.name}</b> (${p.category})\n` +
                     `  Sisa: <code>${p.stock_quantity}</code> / Min: <code>${p.min_stock}</code>\n` +
                     `  Biaya: $${Number(p.unit_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
                     `  Status: <b>${status}</b>`;
            });

            responseText = `🔍 <b>HASIL PENCARIAN FOR "${arg.toUpperCase()}"</b>\n\n` +
              itemLines.slice(0, 10).join('\n\n') +
              (matches.length > 10 ? `\n\n<i>Dan ${matches.length - 10} item matching lainnya...</i>` : '');
          }
        }
      }
    } 
    else if (command === '/laundry') {
      const { data: laundryRecords, error } = await supabase
        .from('laundry_records')
        .select('*')
        .neq('status', 'returned');

      if (error) {
        console.error('Webhook database error:', error);
        responseText = `🔌 <b>Kesalahan Koneksi</b>\n\nGagal memuat data pencucian.`;
      } else if (!laundryRecords || laundryRecords.length === 0) {
        responseText = `🧺 <b>Status Cucian Laundry</b>\n\nKosong! Tidak ada pakaian/linen aktif yang sedang diproses di laundry saat ini. Semua barang di gudang.`;
      } else {
        const totalItemsOut = laundryRecords.reduce((acc, r) => acc + ((r.quantity_out || 0) - (r.quantity_in || 0)), 0);
        const totalCostOut = laundryRecords.reduce((acc, r) => acc + Number(r.total_cost || 0), 0);

        const lines = laundryRecords.map((r, idx) => {
          const qtyRemaining = (r.quantity_out || 0) - (r.quantity_in || 0);
          return `${idx + 1}. <b>${r.item_name}</b>\n` +
                 `   Kirim: ${qtyRemaining} unit | Status: <code>${r.status.toUpperCase()}</code>\n` +
                 `   Operator: ${r.operator_name || '-'}`;
        });

        responseText = `🧺 <b>RINGKASAN OPERASIONAL LAUNDRY AKTIF</b>\n\n` +
          `• <b>Cucian Aktif:</b> ${laundryRecords.length} batch\n` +
          `• <b>Total Sisa Unit:</b> <b>${totalItemsOut}</b> unit\n` +
          `• <b>Total Estimasi Biaya:</b> $${totalCostOut.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n\n` +
          `<b>Daftar Detail Cucian:</b>\n` +
          lines.slice(0, 15).join('\n\n') +
          (laundryRecords.length > 15 ? `\n\n<i>Dan ${laundryRecords.length - 15} batch laundry lainnya...</i>` : '');
      }
    } 
    else if (command === '/myid') {
      responseText = `🆔 <b>ID CHAT TELEGRAM ANDA</b>\n\n` +
        `• <b>Chat ID Anda:</b> <code>${chatId}</code>\n` +
        `• <b>Tipe Obrolan:</b> <code>${message.chat.type}</code>\n` +
        `• <b>Hubungan:</b> Terhubung dengan sukses!\n\n` +
        `<i>Gunakan Chat ID di atas sebagai isi variabel lingkungan <code>TELEGRAM_CHAT_ID</code> di server untuk mengirim pemberitahuan otomatis ketika stok menipis!</i>`;
    } 
    else {
      // Unrecognized commands
      responseText = `❓ <b>Perintah Tidak Dikenal</b>\n\n` +
        `Maaf, perintah <code>${command}</code> tidak dikenali oleh sistem.\n\n` +
        `Ketik /help untuk menampilkan daftar perintah yang didukung.`;
    }
 
    // Deliver response
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: responseText,
        parse_mode: 'HTML',
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram receiver callback caught error:', error);
    return NextResponse.json({ ok: true, error: 'Internal pipeline error handled safely' });
  }
}
