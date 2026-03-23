# Повний навчальний документ з Kivy українською

## Executive summary

Підготовлено структурований навчальний документ українською мовою у форматі Markdown, орієнтований на викладання Kivy “від базового до просунутого”: встановлення, архітектура (App/Widget/Layout, main loop, події, властивості), UI віджети й layouts, Canvas/графіка, KV language, ScreenManager, анімації, робота з файлами/ресурсами/мультимедіа, деплой (Android через Buildozer/python-for-android, desktop через PyInstaller, iOS коротко), тестування/налагодження, типові помилки та міні-проєкти з повними кодами. citeturn4search1turn11view2turn11view3turn16view3turn15view1turn12search3turn9search5turn10search0

Як “базову версію для курсу” документ прив’язано до Kivy 2.3.1 (останній реліз, доступний на GitHub Releases і PyPI станом на 2026-03-17). citeturn5search0turn5search1turn5search4

## Що саме зроблено і як документ покриває ваш силлабус

У файлі викладено теми, які ви перелічили, з навчальними підблоками (теорія → приклад коду → пояснення → best practices → типові помилки → практика). Тематичний зміст відповідає офіційній структурі Programming Guide Kivy (архітектура, події/властивості, widgets/layouts, graphics/canvas, KV language, packaging). citeturn4search2turn15view2

Документ спеціально підсвічує й пояснює “вузлові” речі, на яких найчастіше ламаються новачки, з опорою на офіційну документацію:
- чому `Label` за замовчуванням не масштабується під текст і як правильно керувати розміром через `text_size`/`texture_size`; citeturn6search1  
- що `ScrollView` приймає лише одну дитину і як робити правильний прокручуваний контент через layout + `minimum_height`; citeturn16view2  
- чому для великих списків потрібен `RecycleView`, які в нього ризики зі “станом віджета” і чому стан має бути повністю описаний у `data`; citeturn16view3  
- як KV language вантажиться за конвенцією імені, що таке `root/app/self`, і як KV допомагає відділяти UI від логіки (separation of concerns); citeturn11view0turn15view0turn15view1  
- як правильно робити “фон”/графіку через `canvas.before` і чому треба прив’язувати графіку до `pos/size`; citeturn14search0turn14search2turn14search14  

## Актуальні нотатки для встановлення та деплою

Документ містить команди для Windows/macOS/Linux, рекомендуючи ізоляцію через venv, і пояснює, що Kivy 2.3.1 офіційно підтримує Python 3.8–3.13, а `pip` встановлює або готові wheels, або збирає з джерел (що змінює вимоги до системних залежностей). citeturn11view2turn13view0

Для Android деплою зафіксовано навчальний “мінімальний pipeline”: Buildozer → python-for-android → APK/AAB, із ключовими командами `buildozer init`, `buildozer android debug deploy run`, а для діагностики — `buildozer android logcat`. Також зазначено обмеження по ОС: Buildozer/python-for-android нормально запускаються на Linux/macOS; на Windows типово потрібен WSL/емульоване Linux-середовище. citeturn11view3turn9search5turn9search10turn12search1

Для desktop-пакування під Windows включено практичну частину про PyInstaller та проблематику ресурсів (пошук файлів після “freezing”), з опорою на офіційні рекомендації Kivy щодо packaging і hooks. citeturn7search23turn12search3turn12search23

Для iOS подано “brief” (короткий огляд), оскільки реальний ланцюжок залежить від macOS/Xcode і toolchain `kivy-ios`, а процес може бути помилковим через системні залежності. citeturn12search2turn5search12turn9search5

## Як документ підтримує навчання: методичні акценти й типові “провали”

Матеріал побудовано так, щоб формувати в студентів правильні ментальні моделі:
- “UI — це дерево віджетів”, події проходять через дерево, і віджет може «поглинути» подію; citeturn4search6turn10search29  
- “Canvas — це інструкції малювання”, а не властивість “background”; фон/layout-графіка додаються через canvas і мають бути прив’язані до геометрії віджета; citeturn14search0turn14search1turn14search14  
- “Properties — це реактивність”: `bind()` на властивості та події, а періодичні задачі робляться через Clock/main loop, а не блокуванням потоку; citeturn2search0turn1search16turn11view1  

Окремо включено блоки для налагодження:
- Kivy Logging як стандартний підхід до логів; citeturn9search0turn9search17  
- конфігурація Kivy (де лежить `config.ini`, роль `KIVY_HOME`); citeturn9search1  
- інструменти Inspector/Console/Monitor, включно з hotkeys та способом запуску через модулі. citeturn10search5turn10search2turn10search36  

## Deliverable: файл, розмір, структура

Готовий Markdown-документ можна завантажити тут: [Download kivy_guide_uk.md](sandbox:/mnt/data/kivy_guide_uk.md)

Орієнтовний обсяг: ~5 800 слів, 17 тематичних розділів (від вступу до міні-проєктів і ресурсів). Документ містить таблиці порівнянь (встановлення/Layouts), Mermaid-діаграми для архітектури та workflow деплою, а також приклади як у “чистому Python”, так і з KV language (включно з правилами, ids, events). citeturn17search0turn15view1turn14search0turn11view3

## Джерельна база і пріоритети джерел

Основний пріоритет — офіційна документація Kivy (Kivy framework overview, Programming Guide, Installation, Widgets/Layout/Graphics/KV, Packaging), а також офіційні інструменти деплою (Buildozer, python-for-android) і довідка з debug/logcat. citeturn4search1turn4search2turn11view2turn16view2turn16view3turn14search2turn15view1turn11view3turn5search5turn12search1turn12search0turn9search10