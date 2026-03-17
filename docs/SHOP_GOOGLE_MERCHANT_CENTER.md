# Google Merchant Center — фід товарів

Щоб товари магазину з’являлись у вкладці «Shopping» та в рекламі Google, потрібно підключити **Google Merchant Center** і подати product feed.

## URL фіду

На сайті вже є endpoint, який віддає XML-фід у форматі Google:

- **Усі товари (мова EN, валюта EUR):**  
  `https://your-domain.com/api/shop/feed/products`
- **Українська мова, гривня:**  
  `https://your-domain.com/api/shop/feed/products?locale=ua&currency=UAH`
- **Долар:**  
  `https://your-domain.com/api/shop/feed/products?currency=USD`

Параметри:

| Параметр  | Значення      | За замовчуванням |
|-----------|---------------|------------------|
| `locale`  | `ua` \| `en`  | `en`             |
| `currency`| `EUR` \| `USD` \| `UAH` | `EUR`    |

## Кроки в Merchant Center

1. Зареєструйте [Google Merchant Center](https://merchants.google.com/).
2. Додайте сайт і підтвердіть права на домен (через DNS або HTML-тег).
3. **Products** → **Feeds** → **Add feed**:
   - **Country of sale** — країна продажу (наприклад, Ukraine або Germany).
   - **Destinations** — увімкніть «Free product listing» і/або «Shopping ads» за потреби.
   - **Input method** — **Scheduled fetch**.
   - **File URL** — вставте URL фіду, наприклад:  
     `https://onecompany.global/api/shop/feed/products`
   - **Fetch schedule** — щодня або раз на кілька днів.
4. Збережіть і дочекайтесь обробки. Помилки по окремих товарах дивіться в розділі **Diagnostics**.

## Що входить у фід

- Усі опубліковані товари з каталогу (БД + статичний каталог).
- Для кожного товару: id (SKU або slug), title, link, description, image_link, availability, price, condition (new), brand.
- Товари без зображення або з нульовою ціною в усіх валютах не потрапляють у фід.

## Кілька країн або мов

Можна створити кілька feeds з різними URL:

- Україна, UAH: `.../api/shop/feed/products?locale=ua&currency=UAH`
- Європа, EUR: `.../api/shop/feed/products?locale=en&currency=EUR`
- США, USD: `.../api/shop/feed/products?locale=en&currency=USD`

У Merchant Center для кожного feed оберіть відповідну **Country of sale**.
