/**
 * Utility to send notifications via the system's notification hub.
 */

export async function sendTelegramNotification(message: string) {
  try {
    const response = await fetch('/api/telegram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      console.warn('Failed to send Telegram notification:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    return false;
  }
}

export function formatStockAlert(productName: string, quantity: number, category: string, threshold: number) {
  const isZero = quantity === 0;
  const title = isZero ? '🚫 STOCK ALERT: EMPTY' : '⚠️ STOCK ALERT: CRITICAL';
  const status = isZero ? 'EMPTY' : 'LOW LEVEL';
  
  return `<b>${title}</b>\n\n` +
         `<b>Product:</b> ${productName}\n` +
         `<b>Category:</b> ${category}\n` +
         `<b>Current Level:</b> ${quantity} units\n` +
         `<b>Threshold:</b> ${threshold} units\n` +
         `<b>Status:</b> ${status}\n\n` +
         `<i>Please handle restock requirements for this item.</i>`;
}
