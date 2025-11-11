# GoDaddy Domain Setup Guide

This guide walks you through connecting a custom domain purchased from GoDaddy to your OneCompany deployment.

## Prerequisites

- Active domain registered with GoDaddy
- Hosting provider account (Vercel, Netlify, Azure, AWS, etc.)
- Access to GoDaddy DNS management panel

## Option 1: Using Nameservers (Recommended for Vercel/Netlify)

### Step 1: Get nameservers from your hosting provider

**Vercel:**
1. Go to your project → Settings → Domains
2. Add your custom domain (e.g., `onecompany.com`)
3. Vercel will provide nameservers (e.g., `ns1.vercel-dns.com`, `ns2.vercel-dns.com`)

**Netlify:**
1. Go to Site settings → Domain management
2. Add custom domain
3. Use Netlify's nameservers (e.g., `dns1.p01.nsone.net`)

### Step 2: Update nameservers in GoDaddy

1. Log in to [GoDaddy Domain Manager](https://dcc.godaddy.com/manage/)
2. Click on your domain → **DNS** or **Manage DNS**
3. Scroll to **Nameservers** section
4. Click **Change** → **Enter my own nameservers (advanced)**
5. Add nameservers provided by your host:
   ```
   ns1.vercel-dns.com
   ns2.vercel-dns.com
   ```
6. Click **Save**

**Note:** DNS propagation can take 24-48 hours (usually much faster).

---

## Option 2: Using A/CNAME Records (for self-hosted or specific IPs)

### Step 1: Get target IP or CNAME from your host

**Azure App Service:**
- Get your app's IP or CNAME (e.g., `onecompany.azurewebsites.net`)

**AWS/DigitalOcean:**
- Use your server's static IP address

### Step 2: Add DNS records in GoDaddy

1. Go to GoDaddy Domain Manager → Your domain → **Manage DNS**
2. Add an **A Record** (for root domain):
   - **Type:** A
   - **Name:** `@` (represents root domain)
   - **Value:** Your server IP (e.g., `104.21.45.123`)
   - **TTL:** 600 seconds (or default)
3. Add a **CNAME Record** (for www):
   - **Type:** CNAME
   - **Name:** `www`
   - **Value:** Your host's CNAME (e.g., `onecompany.azurewebsites.net`) or `@` (to point to root)
   - **TTL:** 1 hour
4. Click **Save**

---

## Step 3: SSL Certificate (HTTPS)

Most modern hosting providers (Vercel, Netlify, Azure, AWS) auto-provision SSL certificates via Let's Encrypt.

**Verify HTTPS:**
- After DNS propagation, visit `https://onecompany.com`
- You should see a padlock icon (secure connection)

**Troubleshooting:**
- If HTTPS fails, ensure your hosting provider supports automatic SSL
- For Vercel/Netlify: SSL is automatic once domain is verified
- For self-hosted: use [Certbot](https://certbot.eff.org/) to obtain free SSL

---

## Step 4: Redirect www to non-www (or vice versa)

**GoDaddy DNS redirect:**
1. Go to **Forwarding** section in GoDaddy
2. Add domain forwarding:
   - Forward `www.onecompany.com` → `https://onecompany.com` (301 permanent redirect)

**Hosting provider redirect (recommended):**
- In Vercel/Netlify: Set primary domain and it will auto-redirect others
- In `next.config.ts`, add redirect rules if needed

---

## Verification Checklist

- [ ] Domain points to correct nameservers or A/CNAME records
- [ ] DNS propagation complete (check via [whatsmydns.net](https://www.whatsmydns.net/))
- [ ] HTTPS working (green padlock)
- [ ] www redirects to non-www (or vice versa)
- [ ] Email MX records configured (see `google-workspace-setup.md`)

---

## Common Issues

**Domain not resolving:**
- Wait 24-48h for full DNS propagation
- Clear browser cache or use incognito mode
- Verify correct nameservers/A records in GoDaddy

**SSL certificate not provisioning:**
- Ensure DNS is fully propagated first
- Check hosting provider's SSL settings/logs
- For Vercel: re-add domain in dashboard to trigger SSL issuance

**Email not working:**
- Ensure MX records are configured (see Google Workspace guide)
- Do NOT use GoDaddy email forwarding if using custom MX records

---

## Additional Resources

- [GoDaddy DNS Management](https://www.godaddy.com/help/manage-dns-680)
- [Vercel Custom Domains](https://vercel.com/docs/concepts/projects/domains)
- [Netlify Custom Domains](https://docs.netlify.com/domains-https/custom-domains/)
- [Let's Encrypt SSL](https://letsencrypt.org/)
