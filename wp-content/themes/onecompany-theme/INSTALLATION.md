# 📦 OneCompany Premium EPIC - Installation Guide

## 🎯 What's Included

This premium WordPress theme package includes:

- ✅ **Fully responsive WordPress theme**
- ✅ **6 custom Gutenberg blocks**
- ✅ **Liquid Glass CSS Framework**
- ✅ **GSAP animations suite**
- ✅ **Custom Post Type (Brands)**
- ✅ **Theme Customizer integration**
- ✅ **Mobile-optimized**
- ✅ **Documentation**

## 📋 Requirements

### Server Requirements:
- **PHP**: 7.4 or higher (8.0+ recommended)
- **MySQL**: 5.6 or higher (8.0+ recommended)
- **WordPress**: 5.8 or higher (6.0+ recommended)
- **Memory**: Minimum 128MB (256MB recommended)
- **Upload limit**: 64MB or higher

### Recommended Plugins:
- **Contact Form 7** - Alternative contact forms
- **Yoast SEO** - SEO optimization
- **WP Super Cache** - Performance
- **Smush** - Image optimization
- **Wordfence** - Security

## 🚀 Installation Methods

### Method 1: WordPress Admin (Recommended)

1. **Download the theme package**
   - Extract `onecompany-premium-epic.zip`
   - Locate the theme folder: `onecompany-theme/`

2. **Upload via WordPress Admin**
   ```
   WordPress Admin → Appearance → Themes → Add New → Upload Theme
   ```
   - Click **"Choose File"**
   - Select `onecompany-theme.zip` (you may need to zip the folder first)
   - Click **"Install Now"**
   - Click **"Activate"**

3. **Verify Installation**
   - Go to **Appearance → Themes**
   - You should see **"OneCompany Premium EPIC v2.0.0"** as active

### Method 2: FTP/SFTP Upload

1. **Connect to your server** via FTP (FileZilla, Cyberduck, etc.)

2. **Navigate to WordPress themes folder**
   ```
   /wp-content/themes/
   ```

3. **Upload the theme folder**
   - Upload entire `onecompany-theme/` folder
   - Ensure all files are uploaded (500+ files)

4. **Set permissions** (if needed)
   ```
   Folders: 755
   Files: 644
   ```

5. **Activate via WordPress Admin**
   ```
   Appearance → Themes → OneCompany Premium EPIC → Activate
   ```

### Method 3: Local Development (Docker)

This method is already set up if you're using the included Docker configuration.

1. **Start Docker containers**
   ```bash
   docker compose up -d
   ```

2. **Access WordPress**
   ```
   URL: http://localhost:8080
   Admin: http://localhost:8080/wp-admin
   ```

3. **Theme is pre-installed**
   - Just activate: **Appearance → Themes**

## 🔧 Post-Installation Setup

### Step 1: Configure Theme Settings

1. **Go to Customizer**
   ```
   Appearance → Customize
   ```

2. **Configure 5 sections:**

   #### Hero Section
   - Title: "PREMIUM AUTOMOTIVE"
   - Subtitle: "Experience Excellence"
   - Video Background URL: Your video URL (.mp4)
   - Button Text & Link

   #### Stats Section
   - Add 3 statistics (e.g., "10+ Years", "500+ Projects", "50+ Brands")

   #### Colors
   - Primary Color: #1a1a1a (default)
   - Accent Color: #ff6b00 (default orange)

   #### Social Media
   - Add your social media links

   #### Contact Information
   - Email, Phone, Address
   - Footer copyright text

3. **Click "Publish"**

### Step 2: Create Navigation Menu

1. **Create menu**
   ```
   Appearance → Menus → Create a new menu
   ```

2. **Add menu items**
   - Home
   - Brands
   - About
   - Contact

3. **Assign to location**
   - Check **"Primary Menu"**
   - Click **"Save Menu"**

### Step 3: Setup Footer Widgets

1. **Navigate to Widgets**
   ```
   Appearance → Widgets
   ```

2. **Add widgets to Footer Columns 1-4**
   - **Column 1**: Text widget (About Us)
   - **Column 2**: Navigation Menu (Links)
   - **Column 3**: Recent Posts
   - **Column 4**: Contact Info (Text widget)

### Step 4: Create Sample Brand

1. **Add New Brand**
   ```
   Brands → Add New
   ```

2. **Fill in details**:
   - **Title**: KW Suspension
   - **Content**: Full description
   - **Featured Image**: Brand logo
   - **Brand Subtitle**: "Premium Performance Suspension"
   - **Brand Video URL**: Video showcase URL
   - **Brand Color**: #ff0000
   - **Brand Features**:
     ```
     Adjustable damping
     Lightweight design
     TÜV certified
     Premium quality
     ```
   - **Brand Category**: Create "Suspension" category

3. **Publish**

### Step 5: Create Pages with Blocks

1. **Create new page**
   ```
   Pages → Add New
   ```

2. **Add OneCompany blocks**:
   - Click **"+"** → Search "OneCompany"
   - Add:
     - Hero Block
     - Brand Grid Block
     - Gallery Block
     - Contact Form Block

3. **Configure each block** using the right sidebar

4. **Publish**

## 🎨 Customization Guide

### Changing Colors

**Method 1: Via Customizer (Easy)**
```
Customize → Colors → Set Primary & Accent colors
```

**Method 2: Via CSS (Advanced)**
Edit `style.css`:
```css
:root {
    --primary: #your-color;
    --accent: #your-color;
    --accent-rgb: r,g,b; /* RGB values */
}
```

### Adding Custom Fonts

Add to `functions.php`:
```php
function custom_fonts() {
    wp_enqueue_style('custom-font', 'https://fonts.googleapis.com/css2?family=YourFont&display=swap');
}
add_action('wp_enqueue_scripts', 'custom_fonts');
```

Update in `style.css`:
```css
body {
    font-family: 'YourFont', sans-serif;
}
```

### Modifying Animations

Edit `js/main.js`:
```javascript
// Change animation duration
gsap.to(element, {
    duration: 2, // seconds
    opacity: 1
});

// Disable specific animation
// Comment out the section
```

### Adding More Brand Categories

```
Brands → Brand Categories → Add New Term
```

## 🔌 Recommended Plugins Setup

### Contact Form 7
```bash
Plugins → Add New → Search "Contact Form 7" → Install → Activate
```

### Yoast SEO
```bash
Plugins → Add New → Search "Yoast SEO" → Install → Activate
```

Configure:
```
SEO → General → Configuration Wizard
```

### WP Super Cache
```bash
Plugins → Add New → Search "WP Super Cache" → Install → Activate
```

Enable:
```
Settings → WP Super Cache → Caching On → Update Status
```

## 🐛 Troubleshooting

### Issue: Blocks not showing in editor

**Solution:**
```bash
# Via SSH/Terminal
cd wp-content/themes/onecompany-theme
npm install
npm run build
```

Then clear browser cache.

---

### Issue: White screen after activation

**Solution:**
1. Check PHP version (must be 7.4+)
2. Increase memory limit in `wp-config.php`:
```php
define('WP_MEMORY_LIMIT', '256M');
```
3. Check error logs: `wp-content/debug.log`

---

### Issue: Animations not working

**Solution:**
1. Clear browser cache (Ctrl+Shift+R)
2. Check browser console (F12) for errors
3. Verify GSAP is loading:
   - View source → Search for "gsap"

---

### Issue: Mobile menu not opening

**Solution:**
1. Hard refresh (Ctrl+Shift+R)
2. Check that JavaScript is enabled
3. Verify `main.js` is enqueued:
   ```
   View Source → Search for "main.js"
   ```

---

### Issue: Images not uploading

**Solution:**
1. Increase upload limit in `php.ini`:
```ini
upload_max_filesize = 64M
post_max_size = 64M
```

2. Or in `.htaccess`:
```apache
php_value upload_max_filesize 64M
php_value post_max_size 64M
```

---

### Issue: Styles not applying

**Solution:**
1. Clear all caches:
   - Browser cache
   - WordPress cache (if using cache plugin)
   - CDN cache (if applicable)

2. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

3. Check Customizer settings are saved

## 🎯 Performance Optimization

### 1. Image Optimization
- Install **Smush** plugin
- Compress all images
- Use WebP format when possible
- Max width: 1920px

### 2. Lazy Loading
Theme has built-in lazy loading for images with `data-src` attribute.

Add to images:
```html
<img data-src="image.jpg" alt="Description">
```

### 3. Enable Caching
- Use **WP Super Cache** or **W3 Total Cache**
- Enable browser caching
- Enable Gzip compression

### 4. Minify Assets
Install **Autoptimize** plugin:
```
Settings → Autoptimize
✓ Optimize JavaScript Code
✓ Optimize CSS Code
✓ Optimize HTML Code
```

### 5. Use CDN
- **Cloudflare** (free tier available)
- **StackPath**
- **KeyCDN**

## 📊 Analytics Setup

### Google Analytics 4
Add to `header.php` before `</head>`:
```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

## 🔒 Security Best Practices

1. **Keep WordPress Updated**
   - Core, themes, plugins

2. **Use Strong Passwords**
   - Install **Wordfence** plugin

3. **Disable File Editing**
   Add to `wp-config.php`:
   ```php
   define('DISALLOW_FILE_EDIT', true);
   ```

4. **Regular Backups**
   - Install **UpdraftPlus** plugin
   - Daily automated backups

5. **SSL Certificate**
   - Use **Let's Encrypt** (free)
   - Force HTTPS

## 📞 Support

### Documentation
- **Quick Start Guide**: `QUICK-START.md`
- **README**: `README.md`
- **This File**: `INSTALLATION.md`

### Getting Help
- Check documentation first
- Search WordPress forums
- Contact theme author: [Your Email]

### Reporting Bugs
Please include:
- WordPress version
- PHP version
- Theme version
- Steps to reproduce
- Screenshots (if applicable)

## 📝 Changelog

### Version 2.0.0
- Initial premium release
- 6 Gutenberg blocks
- Liquid Glass CSS Framework
- GSAP animations
- Mobile optimization
- Footer widgets
- Theme Customizer
- Multi-brand architecture

---

## ✅ Post-Installation Checklist

- [ ] Theme activated successfully
- [ ] Customizer settings configured
- [ ] Navigation menu created and assigned
- [ ] Footer widgets added
- [ ] Sample brand created
- [ ] Test page with blocks created
- [ ] Mobile responsiveness tested
- [ ] All links working
- [ ] Contact form tested
- [ ] Performance optimized
- [ ] Security measures implemented
- [ ] Analytics installed
- [ ] Backup system in place

---

**Installation Complete! 🎉**

Your OneCompany Premium EPIC theme is now ready to use. For daily usage tips, see `QUICK-START.md`.
