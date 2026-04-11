import { NextRequest, NextResponse } from 'next/server';

/**
 * Shopify Embedded App Home Page
 * This is what merchants see when they click "Whitepay Crypto" in their Shopify admin sidebar.
 * It renders inside Shopify's admin iframe and shows the app dashboard.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const shop = searchParams.get('shop') || 'your-store';
  const host = searchParams.get('host') || '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Whitepay Crypto — One Company</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0a0a0a;
      color: #ffffff;
      min-height: 100vh;
      padding: 32px;
    }

    .container {
      max-width: 720px;
      margin: 0 auto;
    }

    /* Header */
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 32px;
      border-bottom: 1px solid #1a1a1a;
    }
    
    .header-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    
    .logo-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #c29d59, #d4af6a);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }
    
    .header h1 {
      font-size: 22px;
      font-weight: 600;
      letter-spacing: 1px;
    }
    
    .header p {
      color: #c29d59;
      font-size: 13px;
      letter-spacing: 2px;
      margin-top: 4px;
    }

    /* Status Badge */
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.2);
      color: #22c55e;
      padding: 8px 16px;
      border-radius: 100px;
      font-size: 13px;
      font-weight: 500;
      margin-top: 16px;
    }
    
    .status-dot {
      width: 8px;
      height: 8px;
      background: #22c55e;
      border-radius: 50%;
      animation: pulse 2s ease-in-out infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* Cards */
    .card {
      background: #111111;
      border: 1px solid #1e1e1e;
      border-radius: 12px;
      padding: 28px;
      margin-bottom: 16px;
      transition: border-color 0.2s ease;
    }
    
    .card:hover {
      border-color: #333;
    }
    
    .card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    
    .card-icon {
      width: 36px;
      height: 36px;
      background: rgba(194, 157, 89, 0.1);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
    }
    
    .card-title {
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    
    .card-subtitle {
      font-size: 12px;
      color: #666;
      margin-top: 2px;
    }
    
    .card p, .card li {
      color: #888;
      font-size: 14px;
      line-height: 22px;
    }
    
    .card ul {
      list-style: none;
      padding: 0;
    }
    
    .card ul li {
      padding: 6px 0;
      padding-left: 20px;
      position: relative;
    }
    
    .card ul li::before {
      content: '→';
      position: absolute;
      left: 0;
      color: #c29d59;
    }

    /* Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 16px;
    }
    
    .info-item {
      background: #1a1a1a;
      border-radius: 8px;
      padding: 16px;
    }
    
    .info-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #666;
      margin-bottom: 4px;
    }
    
    .info-value {
      font-size: 15px;
      font-weight: 500;
      color: #fff;
    }
    
    .info-value.highlight {
      color: #c29d59;
    }

    /* Store Chip */
    .store-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 13px;
      color: #aaa;
      font-family: 'SF Mono', 'Fira Code', monospace;
    }

    /* Footer */
    .footer {
      text-align: center;
      padding-top: 32px;
      margin-top: 16px;
      border-top: 1px solid #1a1a1a;
    }
    
    .footer p {
      color: #444;
      font-size: 12px;
    }
    
    .footer a {
      color: #c29d59;
      text-decoration: none;
    }
    
    .footer a:hover {
      text-decoration: underline;
    }

    /* Responsive */
    @media (max-width: 600px) {
      body { padding: 16px; }
      .info-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="header-logo">
        <div class="logo-icon">₿</div>
        <div>
          <h1>Whitepay Crypto</h1>
          <p>by One Company</p>
        </div>
      </div>
      <div class="status">
        <span class="status-dot"></span>
        Connected & Active
      </div>
    </div>

    <!-- Connection Info -->
    <div class="card">
      <div class="card-header">
        <div class="card-icon">🏪</div>
        <div>
          <div class="card-title">Store Connection</div>
          <div class="card-subtitle">Your store is linked to the Whitepay payment system</div>
        </div>
      </div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Connected Store</div>
          <div class="info-value">${shop}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Payment Gateway</div>
          <div class="info-value highlight">WhiteBIT Commerce</div>
        </div>
        <div class="info-item">
          <div class="info-label">Accepted Currencies</div>
          <div class="info-value">USDT · BTC · ETH</div>
        </div>
        <div class="info-item">
          <div class="info-label">Email Notifications</div>
          <div class="info-value highlight">Active ✓</div>
        </div>
      </div>
    </div>

    <!-- How It Works -->
    <div class="card">
      <div class="card-header">
        <div class="card-icon">⚡</div>
        <div>
          <div class="card-title">How It Works</div>
          <div class="card-subtitle">Automatic crypto checkout in 3 steps</div>
        </div>
      </div>
      <ul>
        <li>Customer selects <strong style="color:#fff">Crypto WhiteBIT</strong> at checkout and places order</li>
        <li>System generates a unique Whitepay invoice and sends a <strong style="color:#fff">branded email</strong> with a payment link</li>
        <li>Customer pays in <strong style="color:#c29d59">USDT, BTC, or ETH</strong> — order status updates automatically</li>
      </ul>
    </div>

    <!-- Supported Features -->
    <div class="card">
      <div class="card-header">
        <div class="card-icon">🌍</div>
        <div>
          <div class="card-title">Multi-Store & Localization</div>
          <div class="card-subtitle">Smart features built for scale</div>
        </div>
      </div>
      <ul>
        <li>Automatic <strong style="color:#fff">UA / EN</strong> email language detection based on customer locale</li>
        <li>Branded emails — each store gets its own name, domain, and styling</li>
        <li>Multi-store support — connect unlimited Shopify stores to one app</li>
        <li>Non-crypto orders are silently ignored — no spam emails</li>
      </ul>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>
        Whitepay Crypto App · Powered by <a href="https://onecompany.global" target="_blank">One Company</a>
        <br>Need help? Contact <a href="mailto:info@onecompany.global">info@onecompany.global</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      // Allow Shopify admin to embed this page in an iframe
      'Content-Security-Policy': `frame-ancestors https://${shop} https://admin.shopify.com`,
      'X-Frame-Options': `ALLOW-FROM https://${shop}`,
    },
  });
}
