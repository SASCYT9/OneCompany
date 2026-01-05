# Domain Migration Checklist (onecompany.global)

We have updated the codebase to fully support `onecompany.global`. However, some settings depend on your environment variables and external services. Please verify the following:

## 1. Environment Variables (Vercel / .env)
Ensure your production environment variables are updated:

*   **`NEXT_PUBLIC_SITE_URL`**: Should be set to `https://onecompany.global`.
    *   *Note: The code defaults to this if not set, but it's best practice to set it explicitly.*
*   **`EMAIL_FROM`**: If you use Resend, ensure this is set to a verified address on the new domain, e.g., `contact@onecompany.global`.
    *   *Current code uses this variable to send emails.*
*   **`EMAIL_AUTO` / `EMAIL_MOTO`**: Update these if you want to receive inquiries at the new domain (e.g., `auto@onecompany.global`).

## 2. External Services
*   **Resend**: Verify the domain `onecompany.global` in your Resend dashboard and update DNS records (DKIM/SPF).
*   **Google Search Console**: Add `https://onecompany.global` as a property. Submit the new sitemap: `https://onecompany.global/sitemap.xml`.
*   **Google Analytics / Meta Pixel**: Check if you need to update the allowed domains in your analytics settings.

## 3. Content & SEO
*   **Structured Data**: We verified `src/components/seo/StructuredData.tsx` uses `https://onecompany.global`.
    *   **Action Required**: Please update the placeholder phone number `+380-XX-XXX-XXXX` in `src/components/seo/StructuredData.tsx` to your actual business number for better local SEO.
*   **Social Links**: We updated the Instagram link in the Footer to `https://instagram.com/onecompany.global`. Please verify if the Facebook link (`facebook.com/onecompany`) is correct.

## 4. Redirects
*   Ensure your domain registrar (GoDaddy, Namecheap, etc.) or Vercel is configured to redirect `onecompany.com` (if you owned it) to `onecompany.global` to preserve any existing traffic.
