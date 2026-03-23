export async function dispatchCrmWebhook(event: string, payload: any) {
  const webhookUrl = process.env.CRM_WEBHOOK_URL;
  if (!webhookUrl) return;
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        event, 
        payload, 
        timestamp: new Date().toISOString() 
      })
    });
    if (!response.ok) {
      console.error(`[CRM Webhook] Delivery failed for event ${event}: ${response.status}`);
    } else {
      console.log(`[CRM Webhook] Successfully delivered event ${event} to CRM`);
    }
  } catch (error) {
    console.error(`[CRM Webhook] Error delivering event ${event}:`, error);
  }
}
