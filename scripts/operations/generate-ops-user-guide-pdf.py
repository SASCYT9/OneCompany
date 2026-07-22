from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "one-company-operations-user-guide-ru.pdf"
TASKS_SCREENSHOT = ROOT / "docs" / "operations" / "tasks-guide.png"
INBOX_SCREENSHOT = ROOT / "docs" / "operations" / "inbox-guide.png"

PAGE_W, PAGE_H = A4
MARGIN = 38

NAVY = HexColor("#07152F")
BLUE = HexColor("#1769FF")
BLUE_DARK = HexColor("#0B4FD6")
BLUE_LIGHT = HexColor("#EAF2FF")
CYAN_LIGHT = HexColor("#EAF8FF")
TEXT = HexColor("#0A1730")
MUTED = HexColor("#64748B")
BORDER = HexColor("#DCE5F2")
SURFACE = HexColor("#F5F8FC")
GREEN = HexColor("#079669")
GREEN_LIGHT = HexColor("#E8F8F2")
ORANGE = HexColor("#D97706")
ORANGE_LIGHT = HexColor("#FFF4DE")
RED = HexColor("#DC2626")
RED_LIGHT = HexColor("#FEECEC")
TELEGRAM_BG = HexColor("#E6EFF7")
TELEGRAM_BUBBLE = HexColor("#D9FDD3")
TELEGRAM_BOT = HexColor("#FFFFFF")


pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))


def wrap_lines(text: str, width: float, font: str, size: float) -> list[str]:
    result: list[str] = []
    for paragraph in text.split("\n"):
        if not paragraph:
            result.append("")
            continue
        words = paragraph.split()
        line = ""
        for word in words:
            candidate = word if not line else f"{line} {word}"
            if pdfmetrics.stringWidth(candidate, font, size) <= width:
                line = candidate
            else:
                if line:
                    result.append(line)
                line = word
        if line:
            result.append(line)
    return result


def draw_text(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    width: float,
    font: str = "Arial",
    size: float = 10,
    color: Color = TEXT,
    leading: float | None = None,
) -> float:
    leading = leading or size * 1.35
    c.setFont(font, size)
    c.setFillColor(color)
    for line in wrap_lines(text, width, font, size):
        if line:
            c.drawString(x, y, line)
        y -= leading
    return y


def draw_bullets(
    c: canvas.Canvas,
    items: Iterable[str],
    x: float,
    y: float,
    width: float,
    size: float = 9.2,
    gap: float = 5,
    color: Color = TEXT,
) -> float:
    for item in items:
        lines = wrap_lines(item, width - 18, "Arial", size)
        c.setFillColor(BLUE)
        c.circle(x + 4, y - 3, 2.2, fill=1, stroke=0)
        c.setFont("Arial", size)
        c.setFillColor(color)
        for line in lines:
            c.drawString(x + 14, y, line)
            y -= size * 1.35
        y -= gap
    return y


def rounded_box(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    fill: Color = white,
    stroke: Color = BORDER,
    radius: float = 10,
    line_width: float = 1,
) -> None:
    c.setLineWidth(line_width)
    c.setStrokeColor(stroke)
    c.setFillColor(fill)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def button(
    c: canvas.Canvas,
    label: str,
    x: float,
    y: float,
    w: float,
    h: float = 28,
    fill: Color = BLUE,
    text_color: Color = white,
    stroke: Color | None = None,
    size: float = 9,
) -> None:
    rounded_box(c, x, y, w, h, fill=fill, stroke=stroke or fill, radius=7)
    c.setFillColor(text_color)
    c.setFont("Arial-Bold", size)
    c.drawCentredString(x + w / 2, y + h / 2 - size / 3, label)


def header(c: canvas.Canvas, title: str, kicker: str, page: int) -> None:
    c.setFillColor(NAVY)
    c.rect(0, PAGE_H - 70, PAGE_W, 70, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Arial-Bold", 18)
    c.drawString(MARGIN, PAGE_H - 36, title)
    c.setFillColor(HexColor("#9EC5FF"))
    c.setFont("Arial-Bold", 7.5)
    c.drawString(MARGIN, PAGE_H - 54, kicker.upper())
    c.setFillColor(HexColor("#B6C3D7"))
    c.setFont("Arial", 8)
    c.drawRightString(PAGE_W - MARGIN, 22, f"ONE COMPANY OPERATIONS  |  {page}")


def section_title(c: canvas.Canvas, title: str, subtitle: str, y: float = PAGE_H - 105) -> float:
    c.setFillColor(TEXT)
    c.setFont("Arial-Bold", 23)
    c.drawString(MARGIN, y, title)
    y -= 24
    return draw_text(c, subtitle, MARGIN, y, PAGE_W - 2 * MARGIN, size=10.5, color=MUTED)


def label_chip(c: canvas.Canvas, number: int, x: float, y: float, color: Color = BLUE) -> None:
    c.setFillColor(color)
    c.circle(x, y, 10, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Arial-Bold", 8)
    c.drawCentredString(x, y - 3, str(number))


def numbered_item(
    c: canvas.Canvas,
    number: int,
    title: str,
    body: str,
    x: float,
    y: float,
    width: float,
) -> float:
    label_chip(c, number, x + 10, y - 8)
    c.setFillColor(TEXT)
    c.setFont("Arial-Bold", 9.2)
    c.drawString(x + 28, y - 4, title)
    return draw_text(c, body, x + 28, y - 18, width - 28, size=7.8, color=MUTED, leading=10) - 5


def screenshot_with_markers(
    c: canvas.Canvas,
    path: Path,
    x: float,
    y: float,
    w: float,
    h: float,
    markers: list[tuple[int, float, float]],
) -> None:
    c.setFillColor(HexColor("#D8E0EC"))
    c.roundRect(x - 2, y - 2, w + 4, h + 4, 8, fill=1, stroke=0)
    c.drawImage(str(path), x, y, width=w, height=h, preserveAspectRatio=False, mask="auto")
    for number, nx, ny in markers:
        label_chip(c, number, x + w * nx, y + h * (1 - ny))


def phone_frame(c: canvas.Canvas, x: float, y: float, w: float, h: float, title: str) -> None:
    rounded_box(c, x, y, w, h, fill=TELEGRAM_BG, stroke=NAVY, radius=18, line_width=2)
    c.setFillColor(NAVY)
    c.roundRect(x, y + h - 42, w, 42, 16, fill=1, stroke=0)
    c.rect(x, y + h - 42, w, 18, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Arial-Bold", 10)
    c.drawString(x + 16, y + h - 27, title)
    c.setFillColor(HexColor("#7BE495"))
    c.circle(x + w - 18, y + h - 22, 4, fill=1, stroke=0)


def chat_bubble(
    c: canvas.Canvas,
    text: str,
    x: float,
    y_top: float,
    w: float,
    incoming: bool = False,
    accent: Color | None = None,
) -> float:
    lines = wrap_lines(text, w - 20, "Arial", 8.4)
    h = max(34, 18 + len(lines) * 11)
    y = y_top - h
    fill = TELEGRAM_BOT if incoming else TELEGRAM_BUBBLE
    rounded_box(c, x, y, w, h, fill=fill, stroke=accent or fill, radius=9)
    c.setFillColor(TEXT)
    c.setFont("Arial", 8.4)
    line_y = y + h - 15
    for line in lines:
        c.drawString(x + 10, line_y, line)
        line_y -= 11
    return y - 8


def page_cover(c: canvas.Canvas) -> None:
    c.setFillColor(NAVY)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(BLUE)
    c.circle(PAGE_W - 40, PAGE_H - 70, 150, fill=1, stroke=0)
    c.setFillColor(HexColor("#0E47B9"))
    c.circle(PAGE_W - 10, 40, 210, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Arial-Bold", 13)
    c.drawString(MARGIN, PAGE_H - 90, "ONE COMPANY")
    c.setFillColor(HexColor("#AFCBFF"))
    c.setFont("Arial-Bold", 9)
    c.drawString(MARGIN, PAGE_H - 111, "INTERNAL OPERATIONS GUIDE")
    c.setFillColor(white)
    c.setFont("Arial-Bold", 35)
    c.drawString(MARGIN, PAGE_H - 205, "Telegram Manager")
    c.drawString(MARGIN, PAGE_H - 250, "и система задач")
    c.setFillColor(HexColor("#BDD2F4"))
    c.setFont("Arial", 15)
    draw_text(
        c,
        "Графическое руководство: что нажимать, что писать, как назначать людей, проверять входящие и редактировать задачи.",
        MARGIN,
        PAGE_H - 292,
        430,
        size=13,
        color=HexColor("#D5E4FF"),
        leading=19,
    )
    rounded_box(c, MARGIN, 105, 370, 120, fill=HexColor("#0E244C"), stroke=HexColor("#2A4D83"), radius=14)
    c.setFillColor(white)
    c.setFont("Arial-Bold", 12)
    c.drawString(MARGIN + 18, 197, "Внутри")
    draw_bullets(
        c,
        [
            "Личные сообщения, группы и ответы на голосовые",
            "Подборки из многих сообщений и файлов",
            "Входящие, задачи, статусы, БАЗА и уведомления",
        ],
        MARGIN + 16,
        174,
        330,
        size=9,
        color=white,
        gap=4,
    )
    c.setFillColor(HexColor("#8FB7F7"))
    c.setFont("Arial", 8)
    c.drawString(MARGIN, 55, "Версия для команды  |  July 2026")


def page_map(c: canvas.Canvas, page: int) -> None:
    header(c, "Как устроена система", "Сначала поймите общий маршрут", page)
    y = section_title(c, "Один рабочий маршрут", "Telegram помогает принять информацию. Админка хранит итог и историю.")
    nodes = [
        ("1", "Telegram", "Сообщение, голосовое, фото, документ"),
        ("2", "Входящие", "Проверка того, что понял бот"),
        ("3", "Задача", "Исполнитель, срок, статус и материалы"),
        ("4", "Уведомление", "Исполнитель получает ссылку в Telegram"),
    ]
    box_w = 118
    gap = 12
    x = MARGIN
    y_box = y - 140
    for index, (num, title, body) in enumerate(nodes):
        rounded_box(c, x, y_box, box_w, 106, fill=white, stroke=BORDER, radius=12)
        c.setFillColor(BLUE)
        c.circle(x + 18, y_box + 83, 11, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("Arial-Bold", 9)
        c.drawCentredString(x + 18, y_box + 80, num)
        c.setFillColor(TEXT)
        c.setFont("Arial-Bold", 11)
        c.drawString(x + 12, y_box + 57, title)
        draw_text(c, body, x + 12, y_box + 40, box_w - 24, size=7.5, color=MUTED, leading=10)
        if index < len(nodes) - 1:
            c.setStrokeColor(BLUE)
            c.setLineWidth(2)
            c.line(x + box_w + 2, y_box + 53, x + box_w + gap - 2, y_box + 53)
        x += box_w + gap

    rounded_box(c, MARGIN, 330, PAGE_W - 2 * MARGIN, 145, fill=BLUE_LIGHT, stroke=HexColor("#B9D2FF"), radius=12)
    c.setFillColor(TEXT)
    c.setFont("Arial-Bold", 14)
    c.drawString(MARGIN + 18, 448, "Главное правило")
    draw_text(
        c,
        "Если информация важна для выполнения, она должна быть в задаче: исходный Telegram-контекст, вложения, исполнитель, комментарий и результат. Переписка в Telegram сама по себе не является рабочей карточкой.",
        MARGIN + 18,
        423,
        PAGE_W - 2 * MARGIN - 36,
        size=10,
        leading=14,
    )
    c.setFillColor(RED)
    c.setFont("Arial-Bold", 10)
    c.drawString(MARGIN, 282, "БОТ НЕ ПОКУПАЕТ И НЕ ОПЛАЧИВАЕТ")
    draw_bullets(
        c,
        [
            "AI не рассчитывает цены и не завершает checkout.",
            "Оплата, покупка и внешнее сообщение требуют человека и согласования.",
            "Сайт, а не Telegram, является главным источником данных.",
        ],
        MARGIN,
        257,
        PAGE_W - 2 * MARGIN,
        size=9.5,
    )


def page_first_start(c: canvas.Canvas, page: int) -> None:
    header(c, "Первый запуск", "Свяжите Telegram и аккаунт админки", page)
    section_title(c, "Что должен сделать новый сотрудник", "Без подтверждённого Telegram ID бот не принимает рабочие команды.")
    steps = [
        ("1", "Открыть Telegram Manager", "Руководитель присылает ссылку на правильного бота."),
        ("2", "Нажать Start", "Можно также отправить команду /start."),
        ("3", "Подтвердить Telegram ID", "Руководитель связывает Telegram с вашим пользователем админки."),
        ("4", "Войти в админку", "Откройте раздел Работа -> Задачи и проверьте вкладку Мои."),
    ]
    y = 625
    for num, title, body in steps:
        rounded_box(c, MARGIN, y, PAGE_W - 2 * MARGIN, 82, fill=white, stroke=BORDER, radius=10)
        c.setFillColor(BLUE)
        c.circle(MARGIN + 28, y + 41, 17, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("Arial-Bold", 12)
        c.drawCentredString(MARGIN + 28, y + 37, num)
        c.setFillColor(TEXT)
        c.setFont("Arial-Bold", 12)
        c.drawString(MARGIN + 60, y + 51, title)
        draw_text(c, body, MARGIN + 60, y + 31, PAGE_W - 2 * MARGIN - 78, size=9, color=MUTED)
        y -= 96
    rounded_box(c, MARGIN, 135, PAGE_W - 2 * MARGIN, 95, fill=ORANGE_LIGHT, stroke=HexColor("#F1C36D"), radius=10)
    c.setFillColor(ORANGE)
    c.setFont("Arial-Bold", 11)
    c.drawString(MARGIN + 16, 204, "Если уведомления не приходят")
    draw_bullets(
        c,
        [
            "Проверьте, что вы хотя бы один раз нажали Start.",
            "Попросите руководителя проверить Telegram ID и разрешение на задачи.",
            "Назначение задачи самому себе не отправляет отдельное уведомление.",
        ],
        MARGIN + 14,
        183,
        PAGE_W - 2 * MARGIN - 28,
        size=8.5,
        gap=2,
    )


def page_private_message(c: canvas.Canvas, page: int) -> None:
    header(c, "Одна задача в личном чате", "Пишите поручение конкретно", page)
    section_title(c, "Хорошее сообщение содержит 4 вещи", "Действие, исполнитель, контекст и срок. Бот не должен угадывать отсутствующие факты.")
    phone_frame(c, 56, 215, 305, 475, "Telegram Manager")
    y = 635
    y = chat_bubble(
        c,
        "Игорь, проверь совместимость do88 ICM-170 с Volvo V60 до завтра и добавь результат в задачу.",
        110,
        y,
        226,
        incoming=False,
    )
    y = chat_bubble(c, "Принял. Обрабатываю сообщение.", 75, y, 190, incoming=True)
    y = chat_bubble(
        c,
        "Подготовил 1 задачу для проверки. Исполнитель: Игорь. Открыть в админке",
        75,
        y,
        248,
        incoming=True,
        accent=HexColor("#B6C7D8"),
    )
    button(c, "Открыть", 90, y - 24, 105, 26, fill=BLUE)
    button(c, "Исправить", 203, y - 24, 105, 26, fill=white, text_color=BLUE, stroke=BLUE)

    c.setFillColor(TEXT)
    c.setFont("Arial-Bold", 13)
    c.drawString(392, 648, "Что писать")
    draw_bullets(
        c,
        [
            "Действие: проверить совместимость.",
            "Исполнитель: Игорь.",
            "Контекст: do88 ICM-170 и Volvo V60.",
            "Срок: до завтра.",
        ],
        392,
        620,
        160,
        size=8.5,
    )
    c.setFillColor(TEXT)
    c.setFont("Arial-Bold", 13)
    c.drawString(392, 425, "Кнопки")
    y2 = 397
    y2 = numbered_item(c, 1, "Открыть", "Перейти к Входящим или готовой задаче.", 390, y2, 165)
    y2 = numbered_item(c, 2, "Исправить", "Открыть ручную проверку перед созданием.", 390, y2, 165)
    y2 = numbered_item(c, 3, "Отменить создание", "Отменяет созданную задачу в течение окна undo. Запись не удаляется.", 390, y2, 165)

    rounded_box(c, MARGIN, 95, PAGE_W - 2 * MARGIN, 75, fill=RED_LIGHT, stroke=HexColor("#F5B8B8"), radius=10)
    c.setFillColor(RED)
    c.setFont("Arial-Bold", 10)
    c.drawString(MARGIN + 15, 145, "Не пишите так")
    draw_text(c, "Сделай это. Посмотри. Надо решить. Кто-нибудь пусть займётся.", MARGIN + 15, 125, PAGE_W - 2 * MARGIN - 30, size=9, color=TEXT)


def page_group_reply(c: canvas.Canvas, page: int) -> None:
    header(c, "Группа, reply и mention", "Бот реагирует только на явный вызов", page)
    section_title(c, "Как создать задачу из чужого сообщения", "В группе упомяните бота и ответьте на нужное сообщение или голосовое.")
    phone_frame(c, 58, 220, 320, 470, "Рабочий чат One Company")
    y = 635
    y = chat_bubble(c, "В комплекте Power Division RSQ8 нет инструкции. Нужно запросить у поставщика.", 80, y, 248, incoming=True)
    rounded_box(c, 112, y - 82, 235, 72, fill=TELEGRAM_BUBBLE, stroke=TELEGRAM_BUBBLE, radius=9)
    c.setFillColor(BLUE_DARK)
    c.setFont("Arial-Bold", 7.5)
    c.drawString(123, y - 28, "Ответ на сообщение Игоря")
    draw_text(c, "@имя_бота создай Ване задачу запросить инструкцию", 123, y - 43, 210, size=8.2, leading=10)
    y -= 92
    y = chat_bubble(c, "Принял. Источник: сообщение Игоря. Исполнитель: Ваня.", 80, y, 245, incoming=True)
    button(c, "Открыть", 96, y - 24, 108, 26)
    button(c, "Исправить", 212, y - 24, 108, 26, fill=white, text_color=BLUE, stroke=BLUE)

    c.setFillColor(TEXT)
    c.setFont("Arial-Bold", 13)
    c.drawString(405, 650, "Бот реагирует")
    draw_bullets(
        c,
        [
            "Когда его явно упомянули.",
            "Когда mention добавлен в reply к сообщению или голосовому.",
        ],
        405,
        622,
        145,
        size=8.4,
    )
    c.setFillColor(TEXT)
    c.setFont("Arial-Bold", 13)
    c.drawString(405, 505, "Три разные роли")
    y2 = 477
    y2 = numbered_item(c, 1, "Поставил", "Кто вызвал бота и дал команду.", 402, y2, 153)
    y2 = numbered_item(c, 2, "Источник", "Чьё сообщение или голосовое приложено.", 402, y2, 153)
    y2 = numbered_item(c, 3, "Исполнитель", "Кому явно поручено выполнить работу.", 402, y2, 153)
    rounded_box(c, 400, 212, 157, 86, fill=ORANGE_LIGHT, stroke=HexColor("#F0C36A"), radius=10)
    draw_text(c, "Переслано от Игоря не означает, что исполнитель автоматически Игорь.", 412, 273, 132, size=8.5, color=ORANGE, leading=11)


def page_batch(c: canvas.Canvas, page: int) -> None:
    header(c, "Много сообщений и голосовых", "Сначала собрать, затем выбрать режим", page)
    section_title(c, "Одна подборка может содержать весь диалог", "Авторы могут быть разными. Количество сообщений не должно создавать столько же задач.")
    phone_frame(c, 52, 205, 330, 485, "Telegram Manager")
    c.setFillColor(TELEGRAM_BOT)
    rounded_box(c, 75, 488, 284, 145, fill=TELEGRAM_BOT, stroke=HexColor("#CAD8E5"), radius=9)
    c.setFillColor(TEXT)
    c.setFont("Arial-Bold", 10)
    c.drawString(90, 607, "Собрано сообщений: 31")
    c.setFont("Arial", 8.3)
    c.drawString(90, 586, "Задачи ещё не созданы.")
    draw_text(c, "Перешлите ещё сообщения или выберите способ обработки.", 90, 568, 245, size=8.3, color=MUTED)
    button(c, "Одна задача", 89, 520, 120, 28, fill=HexColor("#253A50"))
    button(c, "Разобрать", 217, 520, 120, 28, fill=HexColor("#253A50"))
    button(c, "Очистить", 89, 483, 248, 28, fill=HexColor("#253A50"))
    y = chat_bubble(c, "Формирую одну задачу из всей подборки.", 75, 458, 255, incoming=True)
    y = chat_bubble(c, "Подготовил 1 задачу для проверки. Все голосовые и файлы прикреплены.", 75, y, 270, incoming=True)

    c.setFillColor(TEXT)
    c.setFont("Arial-Bold", 13)
    c.drawString(405, 650, "Что нажимать")
    y2 = 620
    y2 = numbered_item(c, 1, "Одна задача", "Все сообщения описывают один заказ, клиента, проблему или итог.", 402, y2, 155)
    y2 = numbered_item(c, 2, "Разобрать", "В подборке действительно есть независимые поручения разным людям.", 402, y2, 155)
    y2 = numbered_item(c, 3, "Очистить", "Сбросить подборку до создания задач.", 402, y2, 155)
    rounded_box(c, 400, 255, 157, 142, fill=BLUE_LIGHT, stroke=HexColor("#B6D1FF"), radius=10)
    c.setFillColor(BLUE_DARK)
    c.setFont("Arial-Bold", 10)
    c.drawString(412, 373, "Правильный выбор")
    draw_text(c, "10 уточнений одной проблемы = одна задача. Два разных результата = Разобрать.", 412, 350, 132, size=8.5, color=TEXT, leading=12)
    rounded_box(c, MARGIN, 92, PAGE_W - 2 * MARGIN, 68, fill=GREEN_LIGHT, stroke=HexColor("#9ADAC4"), radius=10)
    draw_text(c, "Можно пересылать несколько голосовых подряд. Оригиналы и транскрипции должны остаться внутри одной подборки.", MARGIN + 15, 133, PAGE_W - 2 * MARGIN - 30, size=9, color=GREEN, leading=13)


def page_media(c: canvas.Canvas, page: int) -> None:
    header(c, "Голосовые, фото и документы", "Оригинал всегда остаётся при задаче", page)
    section_title(c, "Что хранится", "AI помогает разобрать контент, но сотрудник видит исходный файл и может проверить результат.")
    cards = [
        ("Голосовое", "Оригинальное аудио + транскрипция. Обычный текст не называется транскрипцией.", BLUE_LIGHT, BLUE, "▶"),
        ("Фото", "Изображение показывается в задаче. Добавляйте подпись: что именно нужно сделать.", CYAN_LIGHT, BLUE_DARK, "▣"),
        ("Документ", "PDF и безопасные текстовые файлы прикрепляются. Архивы и исполняемые файлы блокируются.", GREEN_LIGHT, GREEN, "PDF"),
    ]
    y = 585
    for title, body, fill, accent, icon in cards:
        rounded_box(c, MARGIN, y, PAGE_W - 2 * MARGIN, 112, fill=fill, stroke=accent, radius=12)
        c.setFillColor(accent)
        c.circle(MARGIN + 40, y + 56, 22, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("Arial-Bold", 10)
        c.drawCentredString(MARGIN + 40, y + 52, icon)
        c.setFillColor(TEXT)
        c.setFont("Arial-Bold", 13)
        c.drawString(MARGIN + 78, y + 76, title)
        draw_text(c, body, MARGIN + 78, y + 52, PAGE_W - 2 * MARGIN - 98, size=9, color=MUTED, leading=13)
        y -= 130
    rounded_box(c, MARGIN, 112, PAGE_W - 2 * MARGIN, 76, fill=ORANGE_LIGHT, stroke=HexColor("#F2C36D"), radius=10)
    c.setFillColor(ORANGE)
    c.setFont("Arial-Bold", 10)
    c.drawString(MARGIN + 15, 162, "Ограничения")
    draw_text(c, "До 20 МБ на файл. Голосовые сначала проходят preview. Не отправляйте пароли, токены, платёжные данные и приватные адреса.", MARGIN + 15, 141, PAGE_W - 2 * MARGIN - 30, size=8.8, color=TEXT, leading=12)


def page_inbox(c: canvas.Canvas, page: int) -> None:
    header(c, "Входящие", "Проверка до создания задачи", page)
    section_title(c, "Что здесь нажимать", "Оригинал остаётся видимым. Предложение AI можно применить, исправить или проигнорировать.")
    screenshot_with_markers(
        c,
        INBOX_SCREENSHOT,
        MARGIN,
        270,
        PAGE_W - 2 * MARGIN,
        410,
        [
            (1, 0.43, 0.15),
            (2, 0.72, 0.49),
            (3, 0.75, 0.70),
            (4, 0.60, 0.83),
            (5, 0.75, 0.83),
            (6, 0.91, 0.83),
            (7, 0.75, 0.36),
        ],
    )
    cols = [MARGIN, 302]
    items = [
        (1, "Поиск", "Найти входящее по тексту."),
        (2, "Оригинал", "То, что реально пришло из Telegram."),
        (3, "Предложение", "Название и исполнитель, найденные AI."),
        (4, "Создать задачу", "Применить корректное предложение."),
        (5, "Создать вручную", "Заполнить карточку самостоятельно."),
        (6, "Игнорировать", "Закрыть сообщение без задачи."),
        (7, "Предупреждение", "Пересланный текст нужно проверить."),
    ]
    ys = [245, 245]
    for index, item in enumerate(items):
        col = index % 2
        ys[col] = numbered_item(c, *item, cols[col], ys[col], 245)


def page_tasks(c: canvas.Canvas, page: int) -> None:
    header(c, "Доска и карточка задачи", "Основная ежедневная работа", page)
    section_title(c, "Нажмите на задачу - детали откроются справа", "На мобильном карточка открывается отдельной страницей.")
    screenshot_with_markers(
        c,
        TASKS_SCREENSHOT,
        MARGIN,
        265,
        PAGE_W - 2 * MARGIN,
        415,
        [
            (1, 0.49, 0.10),
            (2, 0.82, 0.10),
            (3, 0.56, 0.17),
            (4, 0.34, 0.44),
            (5, 0.89, 0.23),
            (6, 0.76, 0.46),
            (7, 0.79, 0.59),
            (8, 0.77, 0.72),
            (9, 0.76, 0.91),
        ],
    )
    items = [
        (1, "Создать задачу", "Ручное создание."),
        (2, "Список / Доска / Календарь", "Смена вида."),
        (3, "Фильтры", "Мои, Все, Сегодня, Просрочено."),
        (4, "Список", "Клик открывает детали."),
        (5, "Редактировать", "Название и описание."),
        (6, "Поля", "Статус, приоритет, исполнитель, срок."),
        (7, "Действия", "Завершить, заблокировать, отменить."),
        (8, "Telegram", "Открыть исходное сообщение."),
        (9, "Вложения", "Фото, голосовые и документы."),
    ]
    cols = [MARGIN, 213, 388]
    ys = [250, 250, 250]
    for index, item in enumerate(items):
        col = index % 3
        ys[col] = numbered_item(c, *item, cols[col], ys[col], 165)


def page_edit(c: canvas.Canvas, page: int) -> None:
    header(c, "Как редактировать задачу", "Все основные поля доступны в карточке", page)
    section_title(c, "Проверяйте задачу перед началом работы", "Правильная карточка должна быть понятна другому сотруднику без дополнительного звонка.")
    fields = [
        ("Название", "Коротко описывает результат, а не весь чат."),
        ("Описание", "Контекст: клиент, товар, автомобиль, ссылка, важные условия."),
        ("Статус", "Реальное состояние работы."),
        ("Приоритет", "Низкий, обычный, высокий или срочный."),
        ("Исполнитель", "Один подтверждённый администратор или не назначен."),
        ("Срок", "Ставьте только реальный срок."),
    ]
    y = 620
    for index, (name, body) in enumerate(fields, start=1):
        col = 0 if index <= 3 else 1
        row = (index - 1) % 3
        x = MARGIN + col * 260
        yy = y - row * 115
        rounded_box(c, x, yy, 240, 92, fill=white, stroke=BORDER, radius=10)
        label_chip(c, index, x + 18, yy + 67)
        c.setFillColor(TEXT)
        c.setFont("Arial-Bold", 11)
        c.drawString(x + 38, yy + 65, name)
        draw_text(c, body, x + 14, yy + 43, 212, size=8.5, color=MUTED, leading=11)

    rounded_box(c, MARGIN, 165, PAGE_W - 2 * MARGIN, 105, fill=BLUE_LIGHT, stroke=HexColor("#B7D2FF"), radius=11)
    c.setFillColor(BLUE_DARK)
    c.setFont("Arial-Bold", 11)
    c.drawString(MARGIN + 15, 244, "Кнопки результата")
    button(c, "Завершить", MARGIN + 15, 196, 115, 30, fill=GREEN)
    button(c, "Заблокировать", MARGIN + 142, 196, 135, 30, fill=ORANGE_LIGHT, text_color=ORANGE, stroke=ORANGE)
    button(c, "Отменить", MARGIN + 289, 196, 110, 30, fill=RED_LIGHT, text_color=RED, stroke=RED)
    draw_text(c, "Завершить - работа готова. Заблокировать - обязательно объяснить причину. Отменить - задача больше не нужна, но история сохраняется.", MARGIN + 15, 181, PAGE_W - 2 * MARGIN - 30, size=8.3, color=TEXT, leading=11)


def page_statuses(c: canvas.Canvas, page: int) -> None:
    header(c, "Статусы", "Выбирайте по фактическому состоянию", page)
    section_title(c, "Как двигать задачу", "Не используйте статус как цветовую метку. Он должен объяснять, что происходит сейчас.")
    statuses = [
        ("Входящие", "Зафиксировано, но ещё не запланировано.", BLUE_LIGHT, BLUE_DARK),
        ("Запланировано", "Принято в план работы.", CYAN_LIGHT, BLUE_DARK),
        ("В работе", "Исполнитель начал действие.", GREEN_LIGHT, GREEN),
        ("Ожидание", "Нужна информация или действие другого человека.", ORANGE_LIGHT, ORANGE),
        ("Проверка", "Результат готов и ждёт проверки.", HexColor("#F0EAFE"), HexColor("#7C3AED")),
        ("Заблокировано", "Работа невозможна. Укажите причину.", RED_LIGHT, RED),
        ("Готово", "Результат завершён.", GREEN_LIGHT, GREEN),
        ("Отменено", "Не нужно выполнять. История остаётся.", SURFACE, MUTED),
    ]
    y = 650
    for index, (title, body, fill, accent) in enumerate(statuses):
        col = index % 2
        row = index // 2
        x = MARGIN + col * 260
        yy = y - row * 118
        rounded_box(c, x, yy, 240, 92, fill=fill, stroke=accent, radius=11)
        c.setFillColor(accent)
        c.circle(x + 20, yy + 65, 6, fill=1, stroke=0)
        c.setFillColor(TEXT)
        c.setFont("Arial-Bold", 11)
        c.drawString(x + 36, yy + 62, title)
        draw_text(c, body, x + 14, yy + 40, 212, size=8.5, color=MUTED, leading=11)
    rounded_box(c, MARGIN, 105, PAGE_W - 2 * MARGIN, 72, fill=ORANGE_LIGHT, stroke=HexColor("#F0C36E"), radius=10)
    draw_text(c, "Если задача остановилась, не оставляйте её просто В работе. Выберите Ожидание или Заблокировано и напишите понятный комментарий.", MARGIN + 15, 148, PAGE_W - 2 * MARGIN - 30, size=9, color=ORANGE, leading=13)


def page_knowledge(c: canvas.Canvas, page: int) -> None:
    header(c, "БАЗА и Справочник", "Инструкции и правила брендов", page)
    section_title(c, "Два разных раздела", "БАЗА объясняет процесс. Справочник помогает найти бренд, правило цены и доставку.")
    rounded_box(c, MARGIN, 420, 245, 260, fill=BLUE_LIGHT, stroke=HexColor("#B6D1FF"), radius=14)
    c.setFillColor(BLUE)
    c.setFont("Arial-Bold", 25)
    c.drawString(MARGIN + 18, 642, "БАЗА")
    draw_text(c, "Для обучения и ежедневных инструкций.", MARGIN + 18, 613, 205, size=10, color=TEXT)
    draw_bullets(
        c,
        [
            "Что такое One Company",
            "Как проходит рабочий день",
            "Полный гайд Telegram Manager",
            "Доставка и оформление заказов",
            "Поставщики и общие процессы",
        ],
        MARGIN + 15,
        575,
        210,
        size=8.6,
    )
    button(c, "Искать статью", MARGIN + 18, 445, 140, 30)

    rounded_box(c, 312, 420, 245, 260, fill=GREEN_LIGHT, stroke=HexColor("#9ADAC4"), radius=14)
    c.setFillColor(GREEN)
    c.setFont("Arial-Bold", 20)
    c.drawString(330, 642, "СПРАВОЧНИК")
    draw_text(c, "Для конкретного товара или бренда.", 330, 613, 205, size=10, color=TEXT)
    draw_bullets(
        c,
        [
            "Поиск по названию и alias",
            "Статус правила",
            "Рабочая формула",
            "VAT, tax и скидка",
            "Ориентиры доставки",
            "Связанные файлы и статьи",
        ],
        327,
        575,
        210,
        size=8.6,
    )
    button(c, "Найти бренд", 330, 445, 140, 30, fill=GREEN)

    rounded_box(c, MARGIN, 245, PAGE_W - 2 * MARGIN, 125, fill=white, stroke=BORDER, radius=11)
    c.setFillColor(TEXT)
    c.setFont("Arial-Bold", 12)
    c.drawString(MARGIN + 16, 340, "В задаче")
    draw_text(c, "Если бот распознал Eventuri, Maxton, do88 или другой бренд, карточка может получить ссылку на формулу бренда и ориентиры доставки. Нажмите на название материала, чтобы открыть его.", MARGIN + 16, 315, PAGE_W - 2 * MARGIN - 32, size=9, color=MUTED, leading=13)
    rounded_box(c, MARGIN, 118, PAGE_W - 2 * MARGIN, 82, fill=RED_LIGHT, stroke=HexColor("#F3B5B5"), radius=10)
    draw_text(c, "Правило в Справочнике - рабочая подсказка, а не автоматический калькулятор. Перед ответом проверьте актуальность источника, скидку, VAT/tax, валюту и shipping.", MARGIN + 15, 168, PAGE_W - 2 * MARGIN - 30, size=9, color=RED, leading=13)


def page_notifications(c: canvas.Canvas, page: int) -> None:
    header(c, "Уведомления исполнителю", "Telegram сообщает о назначении", page)
    section_title(c, "Что получает сотрудник", "Уведомление отправляется связанному пользователю, когда другой сотрудник назначил ему задачу.")
    phone_frame(c, 58, 220, 320, 470, "Telegram Manager")
    rounded_box(c, 82, 410, 270, 215, fill=TELEGRAM_BOT, stroke=HexColor("#C7D6E4"), radius=10)
    c.setFillColor(TEXT)
    c.setFont("Arial-Bold", 11)
    c.drawString(98, 600, "Вам назначена задача")
    c.setFont("Arial-Bold", 9)
    draw_text(c, "OPS-1042 - Проверить совместимость do88 ICM-170", 98, 578, 235, size=9, font="Arial-Bold", leading=12)
    c.setFont("Arial", 8.5)
    c.drawString(98, 530, "Поставил: Саша Цомпель")
    c.drawString(98, 512, "Срок: завтра, 18:00")
    button(c, "Открыть", 98, 466, 220, 28)
    button(c, "Начать", 98, 430, 105, 28, fill=GREEN)
    button(c, "Не моя", 213, 430, 105, 28, fill=white, text_color=RED, stroke=RED)

    c.setFillColor(TEXT)
    c.setFont("Arial-Bold", 13)
    c.drawString(405, 650, "Кнопки")
    y2 = 620
    y2 = numbered_item(c, 1, "Открыть", "Перейти прямо в карточку задачи.", 402, y2, 155)
    y2 = numbered_item(c, 2, "Начать", "Перевести задачу в работу.", 402, y2, 155)
    y2 = numbered_item(c, 3, "Не моя", "Сообщить, что назначение нужно проверить.", 402, y2, 155)
    c.setFillColor(TEXT)
    c.setFont("Arial-Bold", 13)
    c.drawString(405, 380, "Утренний отчёт")
    draw_text(c, "После production-запуска: активные, на сегодня, просроченные и без срока.", 405, 355, 145, size=8.5, color=MUTED, leading=12)
    rounded_box(c, 400, 230, 157, 82, fill=ORANGE_LIGHT, stroke=HexColor("#F0C36A"), radius=10)
    draw_text(c, "Web Push сайта пока не является основным каналом. Рабочие уведомления идут через Telegram.", 412, 286, 132, size=8.3, color=ORANGE, leading=11)


def page_safety(c: canvas.Canvas, page: int) -> None:
    header(c, "Безопасность и типовые ошибки", "Что бот не делает", page)
    section_title(c, "AI помогает разобрать информацию", "Он не получает право выполнять финансовые или внешние действия.")
    left = [
        "Транскрибировать голосовые",
        "Выделять задачи и исполнителей",
        "Прикреплять материалы",
        "Готовить preview для проверки",
        "Создавать внутреннюю задачу после подтверждения",
    ]
    right = [
        "Покупать товары",
        "Проводить оплату",
        "Вводить платёжные данные",
        "Завершать checkout",
        "Самостоятельно писать клиентам и поставщикам",
        "Придумывать цену, наличие или доставку",
    ]
    rounded_box(c, MARGIN, 400, 245, 285, fill=GREEN_LIGHT, stroke=HexColor("#92D8BE"), radius=13)
    c.setFillColor(GREEN)
    c.setFont("Arial-Bold", 15)
    c.drawString(MARGIN + 18, 650, "МОЖЕТ")
    draw_bullets(c, left, MARGIN + 16, 618, 210, size=9, color=TEXT)
    rounded_box(c, 312, 400, 245, 285, fill=RED_LIGHT, stroke=HexColor("#F0AFAF"), radius=13)
    c.setFillColor(RED)
    c.setFont("Arial-Bold", 15)
    c.drawString(330, 650, "НЕ МОЖЕТ")
    draw_bullets(c, right, 328, 618, 210, size=9, color=TEXT)

    c.setFillColor(TEXT)
    c.setFont("Arial-Bold", 13)
    c.drawString(MARGIN, 350, "Если бот понял неправильно")
    steps = [
        "Откройте Входящие по ссылке из Telegram.",
        "Исправьте предложение или нажмите Создать вручную.",
        "Проверьте исполнителя, срок и вложения.",
        "Если задача уже создана, отредактируйте её справа.",
        "Лишнюю задачу отмените, а не удаляйте.",
    ]
    y = 318
    for idx, item in enumerate(steps, 1):
        y = numbered_item(c, idx, item, "", MARGIN, y, PAGE_W - 2 * MARGIN)


def page_cheatsheet(c: canvas.Canvas, page: int) -> None:
    header(c, "Быстрая памятка", "Одна страница для ежедневной работы", page)
    section_title(c, "Типовые ситуации", "Сохраните эту страницу или отправьте новому сотруднику.")
    rows = [
        ("Одно поручение", "Написать боту одним сообщением и назвать исполнителя."),
        ("Длинный диалог об одной проблеме", "Переслать всё -> Одна задача."),
        ("Несколько независимых поручений", "Переслать всё -> Разобрать."),
        ("Несколько голосовых одной темы", "Отправить подряд в одну подборку."),
        ("Исполнитель не определён", "Назначить вручную во Входящих или в задаче."),
        ("Нужно изменить задачу", "Открыть карточку и изменить поля справа."),
        ("Работа остановилась", "Заблокировать или Ожидание + комментарий."),
        ("Нужна формула бренда", "Открыть связанный Справочник и проверить актуальность."),
        ("Нужно купить или оплатить", "Только человек после согласования. Бот не выполняет."),
    ]
    y = 665
    for idx, (situation, action) in enumerate(rows, 1):
        fill = white if idx % 2 else SURFACE
        rounded_box(c, MARGIN, y - 55, PAGE_W - 2 * MARGIN, 55, fill=fill, stroke=BORDER, radius=7)
        label_chip(c, idx, MARGIN + 18, y - 27)
        c.setFillColor(TEXT)
        c.setFont("Arial-Bold", 8.8)
        c.drawString(MARGIN + 38, y - 20, situation)
        draw_text(c, action, MARGIN + 238, y - 18, PAGE_W - MARGIN - (MARGIN + 250), size=8.2, color=MUTED, leading=10)
        y -= 62
    rounded_box(c, MARGIN, 50, PAGE_W - 2 * MARGIN, 56, fill=BLUE, stroke=BLUE, radius=9)
    c.setFillColor(white)
    c.setFont("Arial-Bold", 10)
    c.drawCentredString(PAGE_W / 2, 81, "Главное: Telegram принимает. Админка хранит. Человек проверяет.")


def build_pdf() -> Path:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
    c.setTitle("One Company Operations - руководство Telegram Manager и задач")
    c.setAuthor("One Company")
    c.setSubject("Внутреннее руководство для команды")

    pages = [
        ("Обложка", page_cover),
        ("Как устроена система", page_map),
        ("Первый запуск", page_first_start),
        ("Одна задача", page_private_message),
        ("Группа и reply", page_group_reply),
        ("Подборка сообщений", page_batch),
        ("Медиа", page_media),
        ("Входящие", page_inbox),
        ("Задачи", page_tasks),
        ("Редактирование", page_edit),
        ("Статусы", page_statuses),
        ("БАЗА и Справочник", page_knowledge),
        ("Уведомления", page_notifications),
        ("Безопасность", page_safety),
        ("Памятка", page_cheatsheet),
    ]
    for index, (bookmark, render) in enumerate(pages, start=1):
        key = f"page-{index}"
        c.bookmarkPage(key)
        c.addOutlineEntry(bookmark, key, level=0, closed=False)
        if index == 1:
            render(c)
        else:
            render(c, index)
        c.showPage()
    c.save()
    return OUTPUT


if __name__ == "__main__":
    print(build_pdf())
