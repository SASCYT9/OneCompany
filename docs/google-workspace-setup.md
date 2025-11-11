# Google Workspace Email Setup Guide

This guide walks you through setting up professional email addresses (e.g., `auto@onecompany.com`, `moto@onecompany.com`) using Google Workspace and routing them to contact form submissions.

## Prerequisites

- Custom domain registered (e.g., `onecompany.com`)
- GoDaddy account with DNS management access
- Google Workspace subscription (starts at ~$6/user/month)

---

## Step 1: Sign Up for Google Workspace

1. Go to [Google Workspace](https://workspace.google.com/)
2. Click **Get Started** → Choose a plan (Business Starter is sufficient)
3. Enter your business details and existing domain name (`onecompany.com`)
4. Create your first admin account (e.g., `admin@onecompany.com`)
5. Complete payment setup

---

## Step 2: Verify Domain Ownership

Google will ask you to verify domain ownership via DNS TXT record.

1. In Google Workspace Admin Console → **Domains** → **Manage domains**
2. Click **Verify** next to your domain
3. Google provides a TXT record (e.g., `google-site-verification=abc123xyz...`)

**Add TXT record in GoDaddy:**
1. Log in to [GoDaddy Domain Manager](https://dcc.godaddy.com/manage/)
2. Select your domain → **Manage DNS**
3. Add a new **TXT Record**:
   - **Type:** TXT
   - **Name:** `@` (or leave blank)
   - **Value:** Paste verification code from Google
   - **TTL:** 1 hour (default)
4. Click **Save**
5. Return to Google Workspace Admin → Click **Verify**

**Note:** Verification can take up to 48 hours, but usually completes within minutes.

---

## Step 3: Configure MX Records for Email Routing

MX (Mail Exchange) records tell email servers where to deliver mail for your domain.

### Google Workspace MX Records (add these in GoDaddy DNS):

1. Go to GoDaddy → Your domain → **Manage DNS**
2. **Delete any existing MX records** (important!)
3. Add the following MX records:

| Priority | Mail Server               |
|----------|---------------------------|
| 1        | `ASPMX.L.GOOGLE.COM`      |
| 5        | `ALT1.ASPMX.L.GOOGLE.COM` |
| 5        | `ALT2.ASPMX.L.GOOGLE.COM` |
| 10       | `ALT3.ASPMX.L.GOOGLE.COM` |
| 10       | `ALT4.ASPMX.L.GOOGLE.COM` |

**How to add in GoDaddy:**
- Click **Add** → Select **MX**
- **Name:** `@` (represents root domain)
- **Priority:** (as per table)
- **Value:** (mail server from table)
- **TTL:** 1 hour
- Repeat for all 5 records

4. Click **Save All**

---

## Step 4: Add SPF Record (Prevent Spoofing)

SPF (Sender Policy Framework) authorizes Google to send email on behalf of your domain.

1. In GoDaddy DNS → Add a **TXT Record**:
   - **Type:** TXT
   - **Name:** `@`
   - **Value:** `v=spf1 include:_spf.google.com ~all`
   - **TTL:** 1 hour
2. Click **Save**

---

## Step 5: Enable DKIM (Email Authentication)

DKIM (DomainKeys Identified Mail) signs outgoing emails to prove authenticity.

1. In Google Workspace Admin → **Apps** → **Google Workspace** → **Gmail** → **Authenticate email**
2. Click **Generate new record** for DKIM
3. Google provides a TXT record:
   - **Name:** `google._domainkey` (or similar)
   - **Value:** Long string starting with `v=DKIM1; k=rsa; p=...`

**Add in GoDaddy:**
1. Go to GoDaddy DNS → Add **TXT Record**
2. Copy the **Name** and **Value** from Google
3. Click **Save**
4. Return to Google Admin → Click **Start authentication**

---

## Step 6: Configure DMARC (Email Policy)

DMARC (Domain-based Message Authentication) tells receiving servers what to do with unauthenticated emails.

1. In GoDaddy DNS → Add a **TXT Record**:
   - **Type:** TXT
   - **Name:** `_dmarc`
   - **Value:** `v=DMARC1; p=quarantine; rua=mailto:admin@onecompany.com`
   - **TTL:** 1 hour
2. Click **Save**

**Explanation:**
- `p=quarantine`: Put suspicious emails in spam (can also use `p=reject`)
- `rua=mailto:...`: Send aggregate reports to this email

---

## Step 7: Create Email Accounts for Auto & Moto Teams

1. In Google Workspace Admin → **Users** → **Add new user**
2. Create accounts:
   - `auto@onecompany.com` (for auto inquiries)
   - `moto@onecompany.com` (for moto inquiries)
3. Assign passwords and notify users

**Optional: Use Google Groups (aliases):**
- Instead of separate accounts, create groups:
  - `auto@onecompany.com` → forwards to team (e.g., john@onecompany.com, jane@onecompany.com)
  - `moto@onecompany.com` → forwards to moto team

---

## Step 8: Test Email Delivery

1. Send a test email to `auto@onecompany.com` from your personal email
2. Verify it arrives in the Google Workspace inbox
3. Repeat for `moto@onecompany.com`

**Check MX records propagation:**
- Use [MXToolbox](https://mxtoolbox.com/) to verify MX records are correct

---

## Step 9: Integrate with Contact Form (Resend API)

To send emails programmatically from your contact form, use [Resend](https://resend.com/) (or SMTP).

### Option A: Resend API (Recommended)

1. Sign up at [resend.com](https://resend.com/)
2. **Verify your domain**:
   - Add domain in Resend dashboard
   - Add DNS records provided by Resend (TXT, CNAME for DKIM)
3. Get your **API key** from Resend
4. Add to `.env.local`:
   ```env
   RESEND_API_KEY=re_abc123xyz...
   EMAIL_FROM=contact@onecompany.com
   EMAIL_AUTO=auto@onecompany.com
   EMAIL_MOTO=moto@onecompany.com
   ```

**Why Resend over SMTP?**
- Simpler API
- Better deliverability
- No need to manage SMTP credentials

### Option B: SMTP with Google Workspace (if preferred)

1. Enable "Less secure apps" or use App Passwords
2. Use `nodemailer` in your API route:
   ```typescript
   import nodemailer from 'nodemailer';
   const transporter = nodemailer.createTransport({
     host: 'smtp.gmail.com',
     port: 587,
     secure: false,
     auth: {
       user: 'contact@onecompany.com',
       pass: process.env.SMTP_PASSWORD
     }
   });
   ```

---

## Verification Checklist

- [ ] Google Workspace domain verified
- [ ] MX records configured and propagated (check [MXToolbox](https://mxtoolbox.com/))
- [ ] SPF record added (`v=spf1 include:_spf.google.com ~all`)
- [ ] DKIM enabled and authenticated in Google Admin
- [ ] DMARC policy configured
- [ ] Test email sent and received successfully
- [ ] Email accounts created for auto/moto teams
- [ ] Resend or SMTP configured in `.env.local`
- [ ] Contact form successfully sends emails to correct recipients

---

## Common Issues

**Emails not arriving:**
- Wait 24-48h for DNS propagation
- Verify MX records in [MXToolbox](https://mxtoolbox.com/)
- Check Google Workspace Admin → **Reports** → **Email log search**

**SPF/DKIM failures:**
- Use [Mail Tester](https://www.mail-tester.com/) to diagnose
- Ensure SPF includes `_spf.google.com`
- Verify DKIM record matches Google's provided value

**Emails going to spam:**
- Enable DKIM and DMARC (critical for deliverability)
- Start with `p=quarantine`, then move to `p=reject` after testing
- Use a professional sender address (avoid `noreply@`)

---

## Additional Resources

- [Google Workspace Setup Guide](https://support.google.com/a/answer/6365252)
- [MX Record Configuration](https://support.google.com/a/answer/140034)
- [SPF Record Setup](https://support.google.com/a/answer/33786)
- [DKIM Configuration](https://support.google.com/a/answer/174124)
- [Resend Documentation](https://resend.com/docs/introduction)
- [Nodemailer Guide](https://nodemailer.com/about/)
