import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json({ 
        success: false, 
        message: 'TELEGRAM_BOT_TOKEN is not configured in the environment variables.' 
      }, { status: 400 });
    }

    // Determine the current deployment host origin dynamically
    const host = req.headers.get('host') || req.nextUrl.host;
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const origin = `${protocol}://${host}`;
    const webhookUrl = `${origin}/api/telegram/webhook`;

    // Attempt to register with Telegram
    const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`, {
      method: 'GET'
    });

    const responseText = await telegramRes.text();
    let telegramData: any = null;

    try {
      telegramData = JSON.parse(responseText);
    } catch (e) {
      console.error('Telegram registration raw response is not JSON:', responseText);
      return NextResponse.json({
        success: false,
        message: `Telegram API returned a non-JSON response (${telegramRes.status}). Please verify that your TELEGRAM_BOT_TOKEN is correct and active.`,
        error: responseText.slice(0, 200)
      }, { status: 400 });
    }

    if (!telegramRes.ok || !telegramData.ok) {
      console.error('Failed to register webhook with Telegram:', telegramData);
      return NextResponse.json({
        success: false,
        message: telegramData?.description || 'Failed to establish connection with Telegram servers.',
        details: telegramData
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Telegram webhook established and linked successfully!',
      webhook_url: webhookUrl,
      details: telegramData
    });
  } catch (error: any) {
    console.error('Telegram bot webhook setup error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to process setup request.', 
      error: error.message 
    }, { status: 500 });
  }
}
