"""Writes two bigger made-up datasets as CSV, one row a purchase: the History, its
Item and its Review (empty when not rated), with the same fields as
sample_history.json, flattened as recommend.ipynb does; plus the tastes they were
made from:

  bert_food_history.csv
                        food, drinks and restaurants only, with many more names:
                        Vietnamese (bún bò Huế), English (Cappuccino, Matcha latte)
                        and both at once (Trà sữa matcha, Latte hạnh nhân, Croissant
                        trứng muối): for the BERT embeddings. About 4 in 5 rated.
  summarization_rating_history.csv
                        every item type, every purchase rated, and the review says
                        why: what the person likes or doesn't, too sweet, slow
                        delivery, the service... For summarising what someone likes.
  profiles.csv          each person's tastes, which both datasets follow: what a
                        summary of their ratings should find.

Lists (toppings, likes...) are joined with "; ".

50 couples (lan and minh among them) in Hà Nội, TP.HCM and Đà Nẵng. Same seed,
same files.

  python3 make_datasets.py [rows]     (default 10000 per dataset)
"""

import csv
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

SEED = 2026
VN = timezone(timedelta(hours=7))
START = datetime(2025, 6, 1, tzinfo=VN)
END = datetime(2026, 11, 25, tzinfo=VN)
COUPLES = 50
MAX_REVIEW_BYTES = 256  # models.MAX_LENGTH_CONTENT, which counts bytes

rng = random.Random(SEED)


def uuid7(at: datetime) -> str:
    """A UUIDv7 for that moment, as the models' BeforeCreate makes them"""
    ms = int(at.timestamp() * 1000)
    rand = rng.getrandbits(74)
    value = (ms & ((1 << 48) - 1)) << 80 | 0x7 << 76 | (rand >> 62) << 64 | 0b10 << 62 | (rand & ((1 << 62) - 1))
    return str(uuid.UUID(int=value))


def iso(at: datetime | None) -> str | None:
    return at.isoformat(timespec="seconds") if at else None


def capitalize(text: str) -> str:
    text = " ".join(text.split())
    return text[:1].upper() + text[1:]


# ---------------------------------------------------------------- food and drink
# kind -> (shops, toppings, [(name template, tags, variants)]). Each variant fills {v}
# in, so one line is several items: "Trà sữa {v}" x "matcha" = "Trà sữa matcha".
DRINKS = {"milktea", "coffee", "matcha", "tea", "juice", "blended"}

FOOD = {
    "milktea": (
        ["Phúc Long", "Gong Cha", "Tocotoco", "Koi Thé", "Mixue", "Bobapop", "Ding Tea", "Chagee", "Tiger Sugar", "The Alley"],
        ["trân châu đen", "trân châu trắng", "thạch dừa", "pudding trứng", "kem cheese", "thạch cà phê", "nha đam", "trân châu hoàng kim", "kem muối", "thạch củ năng"],
        [
            ("Trà sữa {v}", ["trà sữa"], ["trân châu đường đen", "truyền thống", "matcha", "khoai môn", "oolong", "socola", "Thái xanh", "Thái đỏ", "Hokkaido", "Okinawa", "dâu tây", "nướng", "kem cheese", "hoàng kim", "bạc hà", "ô long nhài", "lài"]),
            ("{v} milk tea", ["trà sữa"], ["Brown sugar", "Oolong", "Jasmine", "Taro", "Matcha", "Classic", "Thai", "Hokkaido", "Earl Grey"]),
            ("Sữa tươi trân châu {v}", ["trà sữa", "đồ ngọt"], ["đường đen", "hoàng kim", "matcha"]),
            ("Hồng trà sữa {v}", ["trà sữa"], ["", "kem cheese", "trân châu"]),
            ("Oolong {v}", ["trà sữa"], ["sữa", "kem cheese", "nướng sữa", "macchiato"]),
            ("Trà {v} kem cheese", ["trà sữa", "phô mai"], ["ô long", "lài", "đen", "xanh"]),
        ],
    ),
    "coffee": (
        ["Highlands Coffee", "The Coffee House", "Starbucks", "Cộng Cà Phê", "Trung Nguyên E-Coffee", "Katinat", "Phê La", "Cheese Coffee", "Cà Phê Muối Chú Long", "Laha Coffee", "Aha Café", "% Arabica"],
        ["thêm shot espresso", "kem muối", "sốt caramel", "kem tươi", "bột cacao", "thạch cà phê"],
        [
            ("Cà phê {v}", ["cà phê"], ["sữa đá", "đen đá", "muối", "trứng", "cốt dừa", "phin sữa nóng", "sữa tươi", "bọt biển", "kem muối", "dừa đá xay", "đen nóng", "sữa hạt"]),
            ("Bạc xỉu {v}", ["cà phê", "đồ ngọt"], ["", "đá", "nóng", "kem muối", "cốt dừa"]),
            ("Cappuccino {v}", ["cà phê"], ["", "đá", "nóng", "quế", "hạnh nhân", "oat milk", "dừa", "caramel"]),
            ("Latte {v}", ["cà phê"], ["", "đá", "nóng", "vanilla", "hạnh nhân", "yến mạch", "caramel", "hazelnut", "dừa", "muối", "mật ong"]),
            ("{v} latte", ["cà phê"], ["Iced", "Vanilla", "Caramel", "Hazelnut", "Spanish", "Oat", "Honey", "Coconut"]),
            ("Americano {v}", ["cà phê"], ["", "đá", "nóng", "cam", "chanh dây", "honey", "sả"]),
            ("Espresso {v}", ["cà phê"], ["", "tonic", "double", "con panna", "đá"]),
            ("Flat white {v}", ["cà phê"], ["", "đá", "yến mạch"]),
            ("Mocha {v}", ["cà phê", "socola"], ["", "đá", "bạc hà", "trắng"]),
            ("Caramel macchiato {v}", ["cà phê", "đồ ngọt"], ["", "đá", "nóng", "ít ngọt"]),
            ("Cold brew {v}", ["cà phê"], ["", "cam sả", "sữa yến mạch", "kem muối", "vải", "đào", "phúc bồn tử"]),
            ("Phin {v}", ["cà phê"], ["sữa đá", "đen đá", "sữa tươi", "kem muối"]),
            ("{v} coffee", ["cà phê"], ["Iced", "Coconut", "Salted cream", "Egg", "Black"]),
        ],
    ),
    "matcha": (
        ["Katinat", "Phúc Long", "Starbucks", "The Coffee House", "Cộng Cà Phê", "Hoshi Matcha", "Maison Matcha", "Kyo Tea House"],
        ["kem muối", "trân châu trắng", "kem cheese", "đậu đỏ", "thạch matcha", "sữa yến mạch"],
        [
            ("Matcha latte {v}", ["matcha"], ["", "đá", "nóng", "kem muối", "yến mạch", "dừa", "dâu", "xoài", "hạnh nhân", "kem cheese", "ít ngọt"]),
            ("Matcha {v}", ["matcha"], ["đá xay", "sữa tươi", "cốt dừa", "espresso", "kem muối", "trân châu", "sữa yến mạch", "chuối"]),
            ("{v} matcha latte", ["matcha"], ["Strawberry", "Coconut", "Iced", "Honey", "Oat", "Mango", "Vanilla"]),
            ("Trà xanh {v}", ["matcha"], ["sữa", "đá xay", "kem cheese", "đậu đỏ", "latte"]),
            ("Hojicha {v}", ["matcha"], ["latte", "latte đá", "kem muối", "sữa yến mạch"]),
            ("Genmaicha {v}", ["matcha"], ["latte", "sữa"]),
        ],
    ),
    "tea": (
        ["Highlands Coffee", "Phúc Long", "Katinat", "The Coffee House", "Passio", "Tocotoco", "Trà Chanh 1989", "Gong Cha", "Mixue"],
        ["thạch đào", "thạch vải", "trân châu trắng", "nha đam", "hạt é", "thạch dừa", "hạt sen"],
        [
            ("Trà {v}", ["trà trái cây"], ["đào cam sả", "vải", "chanh giã tay", "ổi hồng", "mãng cầu", "xoài chanh dây", "dâu tằm", "tắc", "sen vàng", "bưởi hồng", "dứa hồng", "nhãn sen", "chanh dây", "lựu đỏ", "táo xanh", "mận muối"]),
            ("{v} tea", ["trà trái cây"], ["Peach", "Lemon", "Lychee", "Passion fruit", "Mango", "Jasmine green", "Hibiscus", "Peach oolong"]),
            ("Trà {v} macchiato", ["trà trái cây", "phô mai"], ["xanh", "đào", "vải", "đen"]),
            ("Hồng trà {v}", ["trà trái cây"], ["chanh", "đào", "vải"]),
            ("Lục trà {v}", ["trà trái cây"], ["chanh", "nhài", "xoài", "mật ong"]),
            ("Kombucha {v}", ["trà trái cây", "healthy"], ["", "đào", "gừng", "dâu", "việt quất"]),
            ("Soda {v}", ["trà trái cây"], ["việt quất", "chanh dây", "blue curacao", "dâu", "bạc hà", "đào"]),
            ("Mojito {v}", ["trà trái cây"], ["chanh bạc hà", "dâu", "đào", "dưa hấu"]),
            ("Yakult {v}", ["trà trái cây"], ["đào", "dâu", "chanh dây"]),
        ],
    ),
    "juice": (
        ["Sinh Tố 142", "Juicy", "Passio", "Ép Tươi", "Sinh Tố Cô Hiền", "Green Juice Bar"],
        ["hạt chia", "granola", "dừa khô", "sữa chua", "thạch dừa"],
        [
            ("Sinh tố {v}", ["healthy"], ["bơ", "xoài", "dâu", "mãng cầu", "sapoche", "chuối yến mạch", "việt quất", "dưa hấu", "bơ dừa", "mít"]),
            ("{v} smoothie", ["healthy"], ["Mango", "Strawberry banana", "Avocado", "Mixed berry", "Green", "Blueberry yogurt", "Peanut butter banana"]),
            ("Nước ép {v}", ["healthy"], ["cam", "dưa hấu", "táo", "cà rốt", "ổi", "thơm", "cần tây", "dưa hấu bạc hà", "lựu"]),
            ("Detox {v}", ["healthy"], ["cần tây táo", "chanh dưa leo", "cam cà rốt gừng"]),
            ("Sữa chua {v}", ["healthy", "đồ ngọt"], ["nếp cẩm", "trân châu", "dâu", "xoài", "việt quất", "đánh đá", "mít"]),
            ("Yogurt {v}", ["healthy"], ["việt quất", "dâu", "granola", "xoài", "Hy Lạp"]),
            ("Nước mía {v}", ["món Việt"], ["", "tắc", "sầu riêng", "dứa"]),
            ("Nước dừa {v}", ["healthy"], ["tươi", "xiêm", "đá"]),
            ("Fresh {v} juice", ["healthy"], ["orange", "watermelon", "apple", "pineapple"]),
        ],
    ),
    "blended": (
        ["Highlands Coffee", "The Coffee House", "Starbucks", "Katinat", "Phúc Long", "Cộng Cà Phê"],
        ["kem tươi", "sốt socola", "bánh Oreo", "trân châu", "thạch cà phê", "sốt caramel"],
        [
            ("{v} frappe", ["đồ ngọt"], ["Cookies & cream", "Matcha", "Caramel", "Mocha", "Chocolate chip", "Coffee", "Strawberry", "Java chip"]),
            ("{v} đá xay", ["đồ ngọt"], ["Cà phê", "Socola", "Matcha", "Cookies", "Chanh tuyết", "Caramel", "Dâu", "Việt quất", "Khoai môn"]),
            ("Chocolate {v}", ["socola", "đồ ngọt"], ["nóng", "đá", "muối", "bạc hà"]),
            ("Cacao {v}", ["socola"], ["sữa đá", "nóng", "kem muối"]),
            ("Frappuccino {v}", ["đồ ngọt", "cà phê"], ["caramel", "mocha", "trà xanh"]),
        ],
    ),
    "dessert": (
        ["Flan Hồng", "Bingsu Sulbing", "Chè Thái Ý Phương", "Kem Tràng Tiền", "Swensen's", "Baskin Robbins", "Mochi Sweets", "Chè Bà Thìn", "Haagen-Dazs", "Tiệm Chè Cô Út"],
        ["trân châu", "thạch dừa", "kem vani", "sốt socola", "trái cây tươi", "sốt caramel", "hạnh nhân", "đậu đỏ", "bột cacao", "dừa nạo"],
        [
            ("Bánh flan {v}", ["đồ ngọt"], ["caramel", "cà phê", "trân châu", "matcha", "dừa", "lá dứa"]),
            ("Tiramisu {v}", ["đồ ngọt", "bánh ngọt"], ["", "matcha", "dâu", "cà phê", "trà xanh"]),
            ("Cheesecake {v}", ["bánh ngọt"], ["chanh dây", "việt quất", "dâu", "Basque", "matcha", "Oreo", "xoài"]),
            ("Bingsu {v}", ["đồ ngọt", "đồ Hàn"], ["xoài", "matcha", "dâu", "đậu đỏ", "socola", "Oreo", "dưa lưới", "cà phê"]),
            ("Kem {v}", ["đồ ngọt"], ["dừa", "matcha", "socola", "vani", "xôi", "bơ", "sầu riêng", "ốc quế", "que Tràng Tiền", "chuối"]),
            ("Chè {v}", ["đồ ngọt", "món Việt"], ["Thái", "khúc bạch", "bưởi", "đậu đỏ", "sương sa hạt lựu", "khoai dẻo", "bắp", "thập cẩm", "dưỡng nhan", "đậu xanh", "trôi nước"]),
            ("Tàu hũ {v}", ["đồ ngọt", "món Việt"], ["trân châu", "nước đường gừng", "Singapore", "matcha", "nước cốt dừa"]),
            ("Mochi {v}", ["đồ ngọt", "đồ Nhật"], ["kem matcha", "dâu", "xoài", "socola", "đậu đỏ"]),
            ("{v} ice cream", ["đồ ngọt"], ["Vanilla", "Chocolate", "Strawberry", "Cookies & cream", "Mint chocolate chip", "Salted caramel"]),
            ("Pudding {v}", ["đồ ngọt"], ["xoài", "trứng", "socola", "matcha", "khoai môn"]),
            ("Panna cotta {v}", ["đồ ngọt", "đồ Tây"], ["", "dâu", "chanh dây", "xoài"]),
            ("Sundae {v}", ["đồ ngọt"], ["socola", "dâu", "caramel"]),
            ("Rau câu {v}", ["đồ ngọt", "món Việt"], ["dừa", "flan", "cà phê"]),
        ],
    ),
    "bakery": (
        ["ABC Bakery", "Tous les Jours", "Paris Baguette", "Givral", "BreadTalk", "Bakes Saigon", "Tiệm Bánh Mây", "Maison Croissant"],
        ["phô mai", "kem tươi", "sốt socola", "hạnh nhân lát", "chà bông"],
        [
            ("Croissant {v}", ["bánh ngọt", "đồ Tây"], ["bơ", "hạnh nhân", "socola", "bơ tỏi", "phô mai", "matcha", "trứng muối", "dăm bông"]),
            ("Bánh su kem {v}", ["bánh ngọt"], ["", "vani", "matcha", "socola"]),
            ("Tart {v}", ["bánh ngọt"], ["trứng", "trứng Bồ Đào Nha", "chanh", "dâu", "phô mai", "xoài"]),
            ("Bánh bông lan {v}", ["bánh ngọt"], ["trứng muối", "phô mai", "cuộn", "Đài Loan", "chà bông", "lá dứa"]),
            ("Donut {v}", ["bánh ngọt", "đồ ngọt"], ["matcha", "socola", "dâu", "đường", "caramel", "Boston cream"]),
            ("Bánh {v}", ["bánh ngọt"], ["mì bơ đường", "bao xá xíu", "pía", "trung thu thập cẩm", "mì hoa cúc", "cuộn quế", "mì nho"]),
            ("Cinnamon roll {v}", ["bánh ngọt", "đồ Tây"], ["", "kem phô mai"]),
            ("Pancake {v}", ["bánh ngọt", "đồ Tây"], ["mật ong", "việt quất", "chuối", "socola", "Nhật", "souffle"]),
            ("Waffle {v}", ["bánh ngọt", "đồ Tây"], ["socola", "kem", "dâu", "trà xanh", "lá dứa"]),
            ("Muffin {v}", ["bánh ngọt", "đồ Tây"], ["việt quất", "socola", "chuối"]),
            ("Bánh kem {v}", ["bánh ngọt", "đồ ngọt"], ["sinh nhật", "dâu", "bắp", "mousse chanh dây", "red velvet", "bento"]),
            ("Macaron {v}", ["bánh ngọt", "đồ Tây"], ["", "mix vị", "dâu", "pistachio"]),
            ("{v} cake", ["bánh ngọt", "đồ Tây"], ["Carrot", "Red velvet", "Chocolate lava", "Banana", "Mousse"]),
        ],
    ),
    "snack": (
        ["Cô Thảo", "Chú Viên", "Bà Sáu", "Cô Ba", "Dì Hai", "Anh Tèo", "Ăn Vặt Mai", "Hẻm 76", "Tiệm Nhà Bơ"],
        ["trứng cút", "bò khô", "xoài xanh", "hành phi", "phô mai", "xúc xích", "ruốc", "sốt me", "chà bông", "mỡ hành"],
        [
            ("Bánh tráng {v}", ["đồ ăn vặt", "món Việt"], ["trộn", "nướng", "cuốn", "chấm", "bơ", "me", "phơi sương", "nướng phô mai", "cuốn bơ"]),
            ("Xiên {v}", ["đồ ăn vặt", "đồ chiên"], ["que chiên", "bẩn", "cá viên", "xúc xích", "nướng"]),
            ("Cá viên {v}", ["đồ ăn vặt", "đồ chiên"], ["chiên", "sốt cay", "chiên mắm", "lẩu"]),
            ("Tokbokki {v}", ["đồ ăn vặt", "đồ Hàn"], ["phô mai", "chả cá", "sốt cay", "sốt kem", "chiên"]),
            ("Kimbap {v}", ["đồ Hàn"], ["chiên", "truyền thống", "cá ngừ", "bò", "tam giác"]),
            ("Takoyaki {v}", ["đồ ăn vặt", "đồ Nhật"], ["", "bạch tuộc", "phô mai"]),
            ("Ốc {v}", ["đồ ăn vặt", "hải sản"], ["len xào dừa", "hương nướng mỡ hành", "móng tay xào me", "bươu hấp sả", "mỡ xào bơ tỏi"]),
            ("Bắp {v}", ["đồ ăn vặt"], ["xào", "nướng mỡ hành", "luộc"]),
            ("Khoai {v}", ["đồ ăn vặt"], ["lang nướng", "tây chiên", "môn chiên", "lắc phô mai", "lang kén"]),
            ("French fries {v}", ["đồ ăn vặt", "đồ chiên"], ["", "phô mai", "rong biển", "truffle"]),
            ("Hột vịt lộn {v}", ["món Việt"], ["xào me", "nướng", "luộc"]),
            ("Bánh {v}", ["đồ ăn vặt", "món Việt"], ["tráng nướng Đà Lạt", "bột chiên", "flan nướng", "gối", "rán", "căn", "khọt", "giò", "tiêu", "bèo", "nậm"]),
            ("Gỏi cuốn {v}", ["món Việt", "healthy"], ["tôm thịt", "chay", "bò bía"]),
            ("Nem {v}", ["món Việt", "đồ chiên"], ["rán", "chua rán", "nướng", "lụi"]),
            ("Popcorn {v}", ["đồ ăn vặt"], ["caramel", "phô mai", "bơ"]),
            ("Corndog {v}", ["đồ ăn vặt", "đồ Hàn", "đồ chiên"], ["phô mai", "xúc xích", "khoai tây"]),
            ("Gỏi {v}", ["món Việt"], ["xoài khô cá", "đu đủ bò khô", "gà xé phay"]),
        ],
    ),
    "meal": (
        ["Quán Cô Ba", "Quán Bà Bảy", "Bếp Nhà Mây", "Quán Ngon Phố", "Hẻm 76", "Cơm Nhà Lá", "Quán Chú Tư", "Bếp Mẹ Nấu", "Quán Gánh"],
        ["trứng ốp la", "chả lụa", "thêm rau", "thêm thịt", "quẩy", "pate", "trứng chần", "mỡ hành"],
        [
            ("Bánh mì {v}", ["món Việt"], ["thịt nướng", "pate trứng", "chả cá", "xíu mại", "heo quay", "gà xé", "chảo", "que", "ốp la", "bơ sữa", "đặc biệt", "chả lụa", "bò kho"]),
            ("Bánh mì sandwich {v}", ["món Việt", "đồ Tây"], ["phô mai", "gà nướng", "cá ngừ", "trứng"]),
            ("Sandwich {v}", ["đồ Tây"], ["gà nướng", "cá ngừ", "club", "trứng bacon", "bò"]),
            ("Phở {v}", ["món Việt"], ["bò tái", "bò chín", "gà", "cuốn", "trộn", "xào", "bò sốt vang", "tái lăn", "gà trộn"]),
            ("Bún {v}", ["món Việt"], ["bò Huế", "chả", "riêu cua", "đậu mắm tôm", "thịt nướng", "cá", "mọc", "ốc", "mắm", "bò Nam Bộ", "chả cá", "ngan", "thang"]),
            ("Cơm {v}", ["món Việt"], ["tấm sườn bì chả", "gà xối mỡ", "rang dưa bò", "chiên Dương Châu", "gà Hải Nam", "sườn chua ngọt", "niêu", "cháy", "văn phòng", "bò lúc lắc", "tấm sườn trứng", "gà luộc"]),
            ("Mì {v}", ["món Việt"], ["Quảng", "vịt tiềm", "xào hải sản", "trộn", "vằn thắn", "xào bò"]),
            ("Hủ tiếu {v}", ["món Việt"], ["Nam Vang", "gõ", "xào", "bò viên", "mực"]),
            ("Bánh cuốn {v}", ["món Việt"], ["nóng", "Thanh Trì", "trứng"]),
            ("Xôi {v}", ["món Việt"], ["xéo", "gà", "mặn", "lạc", "ngô", "trứng muối", "cốm", "chả"]),
            ("Cháo {v}", ["món Việt"], ["sườn", "lòng", "gà", "hàu", "ếch Singapore", "trai"]),
            ("Bò kho {v}", ["món Việt"], ["bánh mì", "hủ tiếu"]),
            ("Miến {v}", ["món Việt"], ["lươn", "gà", "trộn"]),
            ("Bánh canh {v}", ["món Việt"], ["cua", "ghẹ", "chả cá", "giò heo"]),
            ("Bún bò {v}", ["món Việt"], ["xào", "trộn"]),
        ],
    ),
    "fastfood": (
        ["KFC", "Lotteria", "Jollibee", "McDonald's", "Popeyes", "Texas Chicken", "Burger King", "Domino's Pizza", "The Pizza Company", "Pizza Hut", "Subway", "Otoké Chicken"],
        ["thêm phô mai", "sốt mayonnaise", "tương ớt", "khoai tây chiên", "nước ngọt", "coleslaw", "sốt BBQ"],
        [
            ("Gà rán {v}", ["đồ chiên", "đồ Tây"], ["", "giòn cay", "sốt mật ong", "sốt cay Hàn Quốc", "phô mai", "không xương", "sốt bơ tỏi", "sốt mắm tỏi"]),
            ("Fried chicken {v}", ["đồ chiên", "đồ Tây"], ["", "combo", "wings", "popcorn", "tenders"]),
            ("Burger {v}", ["đồ Tây", "đồ chiên"], ["bò phô mai", "gà giòn", "tôm", "bò bacon", "double cheese", "cá", "bò Mỹ"]),
            ("{v} burger", ["đồ Tây"], ["Cheese", "Chicken", "Bacon", "Mushroom", "Spicy chicken", "Beef"]),
            ("Pizza {v}", ["đồ Tây"], ["hải sản", "pepperoni", "margherita", "Hawaii", "phô mai", "gà BBQ", "bò băm", "4 cheese", "nấm truffle", "xúc xích"]),
            ("Spaghetti {v}", ["đồ Tây"], ["carbonara", "bolognese", "sốt kem nấm", "hải sản", "aglio olio"]),
            ("Mì Ý {v}", ["đồ Tây"], ["sốt bò bằm", "sốt kem", "hải sản", "sốt cà chua", "sốt pesto"]),
            ("Hotdog {v}", ["đồ Tây", "đồ ăn vặt"], ["", "phô mai", "xúc xích Đức"]),
            ("Combo {v}", ["đồ chiên"], ["gà rán 2 miếng", "burger khoai", "gia đình", "cặp đôi"]),
            ("Gà nướng {v}", ["đồ nướng"], ["mật ong", "muối ớt", "lu", "BBQ"]),
            ("Salad {v}", ["healthy", "đồ Tây"], ["ức gà", "cá hồi", "Caesar", "rau mầm trứng", "bơ", "Hy Lạp"]),
            ("Poke bowl {v}", ["healthy"], ["cá hồi", "cá ngừ", "tôm", "gà"]),
            ("Taco {v}", ["đồ Tây"], ["bò", "gà", "tôm"]),
        ],
    ),
    "asian": (
        ["Tokyo Deli", "Sushi Kei", "Marukame Udon", "Dookki", "Seoul Garden", "Thai Express", "Mì Cay Sasin", "Dimsum Kowloon", "Bếp Thái Koh Yam", "Tasaki BBQ"],
        ["thêm trứng", "kim chi", "rong biển", "thêm phô mai", "gừng hồng"],
        [
            ("Sushi {v}", ["đồ Nhật"], ["cá hồi", "lươn", "tôm", "trứng cá", "combo", "cuộn California", "bơ"]),
            ("Sashimi {v}", ["đồ Nhật", "hải sản"], ["cá hồi", "cá ngừ", "mix"]),
            ("Ramen {v}", ["đồ Nhật"], ["tonkotsu", "miso", "shoyu", "cay"]),
            ("Udon {v}", ["đồ Nhật"], ["bò", "tempura", "kem cà ri", "Kitsune"]),
            ("Cơm {v}", ["đồ Nhật"], ["cà ri Nhật", "gà teriyaki", "lươn Nhật", "bò Gyudon", "gà katsu"]),
            ("Mì cay {v}", ["đồ Hàn", "đồ cay"], ["hải sản", "bò", "kim chi", "7 cấp độ", "xúc xích"]),
            ("Cơm trộn {v}", ["đồ Hàn"], ["Hàn Quốc", "bò bulgogi", "gà cay"]),
            ("Canh {v}", ["đồ Hàn"], ["kim chi", "rong biển", "đậu tương"]),
            ("Lẩu {v}", ["lẩu"], ["Thái", "mini", "tokbokki", "kim chi", "nấm", "gà lá é", "bò", "riêu cua", "cá kèo", "Tứ Xuyên"]),
            ("Pad Thai {v}", ["đồ Thái"], ["tôm", "gà", ""]),
            ("Tom yum {v}", ["đồ Thái", "đồ cay"], ["", "hải sản", "goong"]),
            ("Cà ri {v}", ["đồ Thái"], ["xanh Thái", "gà", "đỏ"]),
            ("Dimsum {v}", ["đồ Trung"], ["há cảo", "xíu mại", "bánh bao kim sa", "sủi cảo", "mix"]),
            ("Há cảo {v}", ["đồ Trung"], ["tôm", "hấp", "chiên"]),
            ("Vịt quay {v}", ["đồ Trung"], ["Bắc Kinh", "Lạng Sơn"]),
            ("Cơm chiên {v}", ["đồ Trung"], ["Dương Châu", "hải sản", "trứng", "kim chi"]),
            ("Bánh bao {v}", ["đồ Trung"], ["kim sa", "xá xíu", "trứng muối"]),
            ("Mala {v}", ["đồ Trung", "đồ cay"], ["xiên que", "tang", "lẩu"]),
        ],
    ),
}

# Words in a name that bring a tag of their own: "Bingsu matcha" is matcha too
KEYWORD_TAGS = [
    (("matcha", "trà xanh", "hojicha", "genmaicha"), "matcha"),
    (("socola", "chocolate", "cacao", "mocha", "oreo", "java chip"), "socola"),
    (("phô mai", "cheese", "burrata"), "phô mai"),
    (("cay", "mala", "tứ xuyên", "tom yum"), "đồ cay"),
    (("hải sản", "tôm", "mực", "cua", "ghẹ", "cá hồi", "cá ngừ", "hàu", "bạch tuộc", "sashimi", "ốc", "goong", "trai"), "hải sản"),
    (("nướng", "bbq"), "đồ nướng"),
]


def keyword_tags(name: str) -> set[str]:
    lower = name.lower()
    return {tag for words, tag in KEYWORD_TAGS if any(w in lower for w in words)}


FOOD_MENU = [  # every name there is: {name, kind, tags}
    {"name": capitalize(template.replace("{v}", variant)), "kind": kind, "tags": set(tags) | keyword_tags(template.replace("{v}", variant))}
    for kind, (_, _, entries) in FOOD.items()
    for template, tags, variants in entries
    for variant in variants
]

DRINK_NOTES = ["Ít đá", "Không đá", "Nhiều đá", "Đá riêng", "Sữa yến mạch", "Ít sữa", "Nóng", "Size L cho anh"]
FOOD_NOTES = ["Không hành", "Không cay", "Cay nhiều", "Thêm rau", "Ít nước mắm", "Không rau mùi", "Nước chấm để riêng", "Thêm ớt"]

# ---------------------------------------------------------------- restaurants
CITIES = {
    "Hà Nội": [("Lò Đúc", "Hai Bà Trưng"), ("Bà Triệu", "Hai Bà Trưng"), ("Hàng Bông", "Hoàn Kiếm"), ("Tràng Tiền", "Hoàn Kiếm"), ("Trần Duy Hưng", "Cầu Giấy"), ("Xuân Thủy", "Cầu Giấy"), ("Kim Mã", "Ba Đình"), ("Đội Cấn", "Ba Đình"), ("Thái Hà", "Đống Đa"), ("Tây Sơn", "Đống Đa"), ("Nguyễn Trãi", "Thanh Xuân"), ("Xuân Diệu", "Tây Hồ")],
    "TP.HCM": [("Nguyễn Huệ", "Quận 1"), ("Lê Lợi", "Quận 1"), ("Pasteur", "Quận 1"), ("Võ Văn Tần", "Quận 3"), ("Nguyễn Đình Chiểu", "Quận 3"), ("Phan Xích Long", "Phú Nhuận"), ("Nguyễn Trãi", "Quận 5"), ("Sư Vạn Hạnh", "Quận 10"), ("Phạm Văn Đồng", "Thủ Đức"), ("Quang Trung", "Gò Vấp"), ("Nguyễn Thị Thập", "Quận 7"), ("Điện Biên Phủ", "Bình Thạnh")],
    "Đà Nẵng": [("Bạch Đằng", "Hải Châu"), ("Nguyễn Văn Linh", "Hải Châu"), ("Lê Duẩn", "Hải Châu"), ("Võ Nguyên Giáp", "Sơn Trà"), ("Hoàng Sa", "Sơn Trà"), ("Nguyễn Tất Thành", "Thanh Khê")],
}

# (name, cuisine_type, tags, main dishes), in every city
RESTAURANT_CHAINS = [
    ("Gogi House", "Hàn", ["đồ Hàn", "đồ nướng"], ["Ba chỉ bò Mỹ nướng", "Sườn bò Galbi", "Combo nướng 2 người"]),
    ("King BBQ", "Hàn", ["đồ Hàn", "đồ nướng"], ["Buffet nướng", "Ba chỉ heo nướng"]),
    ("Dookki", "Hàn", ["đồ Hàn", "đồ ăn vặt"], ["Buffet tokbokki", "Lẩu tokbokki phô mai"]),
    ("Seoul Garden", "Hàn", ["đồ Hàn", "đồ nướng", "lẩu"], ["Buffet lẩu nướng"]),
    ("Haidilao", "Trung", ["lẩu", "đồ Trung", "đồ cay"], ["Lẩu Tứ Xuyên", "Lẩu nấm", "Bò Mỹ nhúng lẩu"]),
    ("Manwah", "Trung", ["lẩu", "đồ Trung"], ["Lẩu Đài Loan", "Lẩu uyên ương"]),
    ("Kichi-Kichi", "Nhật", ["lẩu"], ["Lẩu băng chuyền"]),
    ("Sushi Hokkaido Sachi", "Nhật", ["đồ Nhật", "hải sản"], ["Sashimi cá hồi", "Sushi combo", "Cơm lươn Nhật"]),
    ("Tokyo Deli", "Nhật", ["đồ Nhật"], ["Sushi cuộn", "Ramen tonkotsu"]),
    ("Marukame Udon", "Nhật", ["đồ Nhật"], ["Udon bò", "Tempura tôm"]),
    ("Pizza 4P's", "Ý", ["đồ Tây", "phô mai"], ["Pizza burrata", "Pizza 4 cheese", "Mì Ý cua sốt kem"]),
    ("Al Fresco's", "Mỹ", ["đồ Tây", "đồ nướng"], ["Sườn nướng BBQ", "Bò bít tết"]),
    ("El Gaucho", "Argentina", ["đồ Tây", "đồ nướng"], ["Bò bít tết", "Sườn bò nướng"]),
    ("Ciao Bella", "Ý", ["đồ Tây"], ["Spaghetti carbonara", "Risotto nấm"]),
    ("Thai Express", "Thái", ["đồ Thái", "đồ cay"], ["Pad Thai tôm", "Lẩu Tomyum", "Cà ri xanh"]),
    ("Lẩu Thái Tomyum", "Thái", ["lẩu", "đồ Thái", "đồ cay"], ["Lẩu hải sản"]),
    ("Ashima", "Việt", ["lẩu", "healthy"], ["Lẩu nấm"]),
    ("Wrap & Roll", "Việt", ["món Việt", "healthy"], ["Gỏi cuốn tôm thịt", "Bún chả Hà Nội"]),
    ("Quán Ăn Ngon", "Việt", ["món Việt"], ["Bánh xèo", "Bún chả", "Chả giò"]),
    ("Cục Gạch Quán", "Việt", ["món Việt"], ["Cơm nhà", "Cá kho tộ"]),
    ("Phở Thìn", "Việt", ["món Việt"], ["Phở bò tái lăn"]),
    ("Hải Sản Bé Mặn", "Việt", ["hải sản", "món Việt"], ["Ghẹ hấp", "Tôm nướng", "Ốc hương"]),
    ("Bò Tơ Quán Mộc", "Việt", ["món Việt", "đồ nướng"], ["Bò tơ nướng tảng", "Bò tơ hấp"]),
    ("Lẩu Phan", "Việt", ["lẩu", "đồ nướng"], ["Buffet lẩu bò"]),
    ("Hotpot Story", "Châu Á", ["lẩu"], ["Lẩu Thái", "Lẩu kim chi"]),
    ("Pizza Hut", "Mỹ", ["đồ Tây"], ["Pizza hải sản", "Pizza pepperoni"]),
    ("San Fu Lou", "Trung", ["đồ Trung"], ["Há cảo tôm", "Dimsum", "Vịt quay Bắc Kinh"]),
    ("Chops", "Mỹ", ["đồ Tây"], ["Burger bò", "Khoai tây chiên"]),
    ("Moo Beef Steak", "Âu", ["đồ Tây", "đồ nướng"], ["Bò bít tết Úc"]),
    ("The Pizza Company", "Mỹ", ["đồ Tây", "phô mai"], ["Pizza phô mai", "Mì Ý bò bằm"]),
]

# Neighbourhood places, named after what they serve and who runs them: "Bún bò Huế O Xuân"
LOCAL_DISHES = [
    ("Bún bò Huế", "Việt", ["món Việt"], ["Bún bò giò heo", "Bún bò đặc biệt"]),
    ("Phở bò", "Việt", ["món Việt"], ["Phở tái nạm", "Phở bò đặc biệt"]),
    ("Cơm tấm", "Việt", ["món Việt"], ["Cơm tấm sườn bì chả"]),
    ("Bún đậu mắm tôm", "Việt", ["món Việt"], ["Mẹt bún đậu đầy đủ"]),
    ("Bún chả", "Việt", ["món Việt", "đồ nướng"], ["Bún chả nem"]),
    ("Lẩu dê", "Việt", ["lẩu"], ["Lẩu dê thuốc bắc"]),
    ("Lẩu cua đồng", "Việt", ["lẩu", "hải sản"], ["Lẩu cua đồng bắp bò"]),
    ("Nướng ngói", "Việt", ["đồ nướng"], ["Ba chỉ nướng ngói", "Bò cuộn nấm"]),
    ("Ốc", "Việt", ["hải sản", "đồ ăn vặt"], ["Ốc hương xào bơ", "Sò điệp nướng"]),
    ("Gà nướng", "Việt", ["đồ nướng"], ["Gà nướng mật ong", "Gà nướng lu"]),
    ("Lẩu nướng Hàn Quốc", "Hàn", ["đồ Hàn", "đồ nướng", "lẩu"], ["Combo lẩu nướng"]),
    ("Mì cay", "Hàn", ["đồ Hàn", "đồ cay"], ["Mì cay hải sản cấp 3"]),
    ("Bít tết", "Âu", ["đồ Tây"], ["Bò bít tết trứng ốp la"]),
    ("Sushi", "Nhật", ["đồ Nhật"], ["Sushi set", "Sashimi mix"]),
    ("Hải sản", "Việt", ["hải sản"], ["Tôm hùm nướng", "Cua rang me"]),
    ("Dimsum", "Trung", ["đồ Trung"], ["Há cảo", "Xíu mại"]),
    ("Vịt quay", "Trung", ["đồ Trung"], ["Vịt quay Bắc Kinh"]),
    ("Buffet chay", "Việt", ["healthy"], ["Buffet chay"]),
    ("Bánh xèo", "Việt", ["món Việt"], ["Bánh xèo tôm nhảy"]),
    ("Lẩu Thái", "Thái", ["lẩu", "đồ Thái", "đồ cay"], ["Lẩu Thái hải sản"]),
]
NICKNAMES = ["Cô Ba", "Bà Bảy", "Chú Tư", "O Xuân", "Mợ Hai", "Anh Béo", "Cô Lan", "Ông Mập", "Hẻm 76", "Số 9", "Phố Cổ", "1989", "Gánh", "Bờ Hồ", "Chợ Đêm", "Ngõ Huế", "Dì Út", "Cây Bàng", "Góc Phố", "Anh Ba Sài Gòn"]

# ---------------------------------------------------------------- clothes and others
# (name, tags, size kind, brands or None, for girls only)
CLOTHES = [
    ("Áo thun oversize", ["streetwear", "đồ basic"], "top", None, False),
    ("Áo thun basic", ["đồ basic"], "top", None, False),
    ("Áo polo", ["đồ basic", "đồ công sở"], "top", None, False),
    ("Áo sơ mi linen", ["đồ công sở", "đồ basic"], "top", None, False),
    ("Áo sơ mi trắng công sở", ["đồ công sở"], "top", None, False),
    ("Áo len cardigan", ["đồ basic"], "top", None, False),
    ("Áo khoác bomber", ["streetwear"], "top", None, False),
    ("Áo hoodie nỉ", ["streetwear"], "top", None, False),
    ("Áo blazer", ["đồ công sở"], "top", None, False),
    ("Áo khoác jean", ["streetwear"], "top", None, False),
    ("Áo croptop", ["streetwear"], "top", None, True),
    ("Áo baby tee", ["streetwear"], "top", None, True),
    ("Quần jean ống rộng", ["streetwear", "đồ basic"], "pants", None, False),
    ("Quần jean skinny", ["đồ basic"], "pants", None, False),
    ("Quần short kaki", ["đồ basic"], "pants", None, False),
    ("Quần tây ống suông", ["đồ công sở"], "pants", None, False),
    ("Quần jogger", ["streetwear"], "pants", None, False),
    ("Quần cargo túi hộp", ["streetwear"], "pants", None, False),
    ("Chân váy tennis", ["váy"], "pants", None, True),
    ("Chân váy chữ A", ["váy", "đồ công sở"], "pants", None, True),
    ("Váy hoa nhí", ["váy"], "top", None, True),
    ("Đầm maxi đi biển", ["váy"], "top", None, True),
    ("Váy babydoll", ["váy"], "top", None, True),
    ("Đầm body dự tiệc", ["váy"], "top", None, True),
    ("Váy slip lụa", ["váy"], "top", None, True),
    ("Set đồ ngủ lụa", ["đồ basic"], "top", None, True),
    ("Giày Air Force 1", ["giày sneaker", "streetwear"], "shoes", ["Nike"], False),
    ("Giày Converse Chuck 70", ["giày sneaker"], "shoes", ["Converse"], False),
    ("Giày New Balance 530", ["giày sneaker"], "shoes", ["New Balance"], False),
    ("Giày Adidas Samba", ["giày sneaker", "streetwear"], "shoes", ["Adidas"], False),
    ("Sandal quai ngang", ["đồ basic"], "shoes", ["Vento", "Crocs", "Local Brand"], False),
    ("Giày cao gót mũi nhọn", ["đồ công sở"], "shoes", ["Vascara", "Charles & Keith"], True),
    ("Giày lười da", ["đồ công sở"], "shoes", ["Pedro", "Clarks"], False),
    ("Túi tote canvas", ["túi xách", "đồ basic"], None, ["Local Brand", "Muji"], False),
    ("Túi kẹp nách", ["túi xách"], None, ["Charles & Keith", "Pedro", "MLB"], True),
    ("Túi đeo chéo mini", ["túi xách"], None, ["Charles & Keith", "MLB", "Local Brand"], False),
    ("Balo laptop", ["túi xách"], None, ["Mikkor", "Herschel", "Local Brand"], False),
    ("Mũ bucket", ["streetwear"], None, ["MLB", "Local Brand"], False),
    ("Mũ lưỡi trai", ["streetwear", "đồ basic"], None, ["MLB", "Nike", "Local Brand"], False),
]
CLOTHES_BRANDS = {
    "đồ basic": ["Uniqlo", "Muji", "Canifa", "Coolmate", "H&M"],
    "streetwear": ["Degrey", "SWE", "Bad Habits", "Dirty Coins", "Local Brand"],
    "đồ công sở": ["Ivy moda", "Routine", "Owen", "Mango", "Zara"],
    "váy": ["Zara", "Mango", "Ivy moda", "Lep'", "Local Brand"],
}
SIZES = {"top": ["XS", "S", "M", "L", "XL"], "pants": ["26", "27", "28", "29", "30", "31", "32", "S", "M", "L"], "shoes": [str(n) for n in range(36, 45)]}
PASTEL = ["Hồng pastel", "Xanh mint", "Tím lavender", "Vàng bơ", "Kem"]
DARK = ["Đen", "Xám", "Xanh navy", "Nâu", "Đỏ đô", "Xanh rêu"]
COLORS = PASTEL + DARK + ["Trắng", "Be"]
ONLINE_SHOPS = ["Shopee", "Lazada", "TikTok Shop", "Tiki"]

# (name, tags, category, notes, for girls only)
OTHERS = [
    ("Son kem lì", ["mỹ phẩm"], "Mỹ phẩm", ["Màu đỏ đất", "Màu cam cháy", "Màu hồng đất", None], True),
    ("Son dưỡng có màu", ["mỹ phẩm"], "Mỹ phẩm", ["Màu hồng nude", None], True),
    ("Kem chống nắng", ["mỹ phẩm"], "Mỹ phẩm", ["Loại cho da dầu", "SPF 50+", None], False),
    ("Serum vitamin C", ["mỹ phẩm"], "Mỹ phẩm", [None], False),
    ("Mặt nạ giấy", ["mỹ phẩm"], "Mỹ phẩm", ["Hộp 10 miếng", None], False),
    ("Cushion", ["mỹ phẩm"], "Mỹ phẩm", ["Tone 21", "Tone 23"], True),
    ("Sữa rửa mặt", ["mỹ phẩm"], "Mỹ phẩm", ["Cho da nhạy cảm", None], False),
    ("Nước hoa", ["nước hoa"], "Mỹ phẩm", ["Mùi gỗ", "Mùi hoa nhài", "Mùi vanilla", "Chai 50ml"], False),
    ("Body mist", ["nước hoa"], "Mỹ phẩm", ["Mùi đào", "Mùi hoa hồng"], True),
    ("Gấu bông Capybara", ["gấu bông"], "Quà tặng", ["Loại 40cm", "Loại 1m"], False),
    ("Gấu bông Stitch", ["gấu bông"], "Quà tặng", ["Loại 60cm", None], False),
    ("Móc khóa Labubu", ["gấu bông", "phụ kiện"], "Quà tặng", [None], False),
    ("Hoa hồng sáp", ["đồ decor"], "Quà tặng", ["Hộp 11 bông", None], True),
    ("Bó hoa tulip", ["đồ decor"], "Quà tặng", ["Màu hồng", "Màu trắng"], True),
    ("Nến thơm vanilla", ["đồ decor"], "Đồ trang trí", [None], False),
    ("Đèn ngủ mặt trăng", ["đồ decor"], "Đồ trang trí", [None], False),
    ("Tranh ghép hình 1000 mảnh", ["đồ decor"], "Đồ chơi", [None], False),
    ("Lego bó hoa", ["đồ decor"], "Đồ chơi", [None], False),
    ("Tai nghe không dây", ["đồ công nghệ"], "Điện tử", ["Chống ồn", None], False),
    ("Sạc dự phòng", ["đồ công nghệ"], "Điện tử", ["20000mAh", None], False),
    ("Bàn phím cơ", ["đồ công nghệ"], "Điện tử", ["Switch brown", "Switch red"], False),
    ("Chuột không dây", ["đồ công nghệ"], "Điện tử", [None], False),
    ("Loa bluetooth mini", ["đồ công nghệ"], "Điện tử", [None], False),
    ("Đồng hồ thông minh", ["đồ công nghệ", "phụ kiện"], "Điện tử", ["Dây silicon", None], False),
    ("Ốp lưng điện thoại", ["phụ kiện"], "Phụ kiện", ["iPhone 16", "Samsung S25"], False),
    ("Vòng tay bạc", ["phụ kiện"], "Trang sức", ["Khắc tên", None], False),
    ("Kẹp tóc càng cua", ["phụ kiện"], "Phụ kiện", [None], True),
    ("Bình giữ nhiệt", ["phụ kiện"], "Đồ dùng", ["500ml", None], False),
    ("Sổ planner 2026", ["phụ kiện"], "Văn phòng phẩm", [None], False),
    ("Sách 'Hiểu về trái tim'", ["sách"], "Sách", [None], False),
    ("Sách 'Nhà giả kim'", ["sách"], "Sách", [None], False),
    ("Sách 'Atomic Habits'", ["sách"], "Sách", [None], False),
    ("Sách 'Cây cam ngọt của tôi'", ["sách"], "Sách", [None], False),
    ("Truyện tranh 'Doraemon'", ["sách"], "Sách", ["Trọn bộ", None], False),
]
OTHER_SHOPS = {
    "Mỹ phẩm": ["Hasaki", "Guardian", "Watsons", "Shopee"],
    "Quà tặng": ["Miniso", "Shopee", "Tiki", "Daiso"],
    "Đồ trang trí": ["Miniso", "Shopee", "Daiso"],
    "Đồ chơi": ["Mykingdom", "Shopee", "Tiki"],
    "Điện tử": ["CellphoneS", "Thế Giới Di Động", "FPT Shop", "Shopee"],
    "Phụ kiện": ["Miniso", "Shopee", "Lazada"],
    "Trang sức": ["PNJ", "Shopee"],
    "Đồ dùng": ["Lock&Lock", "Shopee", "Tiki"],
    "Văn phòng phẩm": ["Fahasa", "Shopee"],
    "Sách": ["Fahasa", "Tiki", "Nhã Nam"],
}

# ---------------------------------------------------------------- people
FOOD_TAGS = ["trà sữa", "cà phê", "matcha", "trà trái cây", "đồ ngọt", "bánh ngọt", "đồ cay", "đồ Hàn", "đồ Nhật", "đồ Tây", "đồ Thái", "đồ Trung", "đồ ăn vặt", "món Việt", "đồ chiên", "healthy", "hải sản", "lẩu", "đồ nướng", "phô mai", "socola"]
CLOTHES_TAGS = ["đồ basic", "váy", "streetwear", "giày sneaker", "túi xách", "đồ công sở", "màu pastel", "đồ màu tối"]
OTHER_TAGS = ["mỹ phẩm", "nước hoa", "gấu bông", "đồ công nghệ", "sách", "đồ decor", "phụ kiện"]
GIRL_ONLY_TAGS = {"váy"}
CARES = ["giá", "phục vụ", "giao hàng", "không gian", "lượng", "form", "chất vải", "chất lượng"]

GIRLS = ["lan", "hoa", "mai", "thu", "ngoc", "linh", "trang", "huong", "vy", "anh", "nhi", "my", "thao", "quynh", "ha", "yen", "phuong", "chi", "giang", "hanh", "khanh", "nga", "oanh", "tam", "uyen", "xuan", "diep", "hien", "loan", "thuy"]
BOYS = ["minh", "nam", "hung", "tuan", "duc", "khoa", "long", "phuc", "quan", "bao", "dat", "hieu", "huy", "khang", "kien", "lam", "nghia", "phong", "quang", "son", "tai", "thang", "thinh", "trung", "viet", "vinh", "an", "binh", "cuong", "hai"]
SURNAMES = ["nguyen", "tran", "le", "pham", "hoang", "vu", "vo", "dang", "bui", "do", "ngo", "duong"]


def usernames(names: list[str], count: int, taken: set[str]) -> list[str]:
    out = []
    for i in range(count):
        name = names[i % len(names)]
        candidate = name if i < len(names) else None
        while candidate is None or candidate in taken:
            style = rng.random()
            if style < 0.4:
                candidate = f"{name}.{rng.choice(SURNAMES)}"
            elif style < 0.7:
                candidate = f"{name}{rng.randint(95, 2005)}"
            else:
                candidate = f"{name}_{rng.choice(SURNAMES)}{rng.randint(1, 99)}"
        taken.add(candidate)
        out.append(candidate)
    return out


def make_person(username: str, girl: bool, partner: str, city: str) -> dict:
    clothes_pool = CLOTHES_TAGS if girl else [t for t in CLOTHES_TAGS if t not in GIRL_ONLY_TAGS | {"màu pastel"}]
    likes = rng.sample(FOOD_TAGS, 3) + rng.sample(clothes_pool, 1) + rng.sample(OTHER_TAGS, 1)
    dislikes = rng.sample([t for t in FOOD_TAGS if t not in likes], rng.choice([1, 2]))
    if rng.random() < 0.5:
        dislikes += rng.sample([t for t in clothes_pool + OTHER_TAGS if t not in likes], 1)
    return {
        "owner": username,
        "partner": partner,
        "wanted_by": 0 if girl else 1,
        "city": city,
        # About 1 in 10 write their reviews in English; lan and minh, as in sample_history.json, in Vietnamese
        "review_language": "en" if username not in ("lan", "minh") and rng.random() < 0.1 else "vi",
        "likes": likes,
        "dislikes": dislikes,
        "sweetness": rng.choices(["ít ngọt", "ngọt", None], weights=[45, 25, 30])[0],
        "cares_about": rng.sample(CARES, rng.choice([1, 2])),
    }


def describe(p: dict) -> str:
    """The person's tastes in a sentence: what a summary of their ratings should say"""
    parts = [f"Thích {', '.join(p['likes'])}", f"không thích {', '.join(p['dislikes'])}"]
    if p["sweetness"] == "ít ngọt":
        parts.append("uống ít ngọt")
    elif p["sweetness"] == "ngọt":
        parts.append("thích uống ngọt")
    parts.append(f"để ý {' và '.join(p['cares_about'])}")
    return "; ".join(parts) + "."


def make_people() -> tuple[list[dict], list[tuple[dict, dict]]]:
    taken: set[str] = set()
    girls = usernames(GIRLS, COUPLES, taken)
    boys = usernames(BOYS, COUPLES, taken)
    people, couples = [], []
    for girl, boy in zip(girls, boys):
        city = rng.choices(list(CITIES), weights=[5, 4, 1])[0]
        her, him = make_person(girl, True, boy, city), make_person(boy, False, girl, city)
        her["summary"], him["summary"] = describe(her), describe(him)
        people += [her, him]
        couples.append((her, him))
    return people, couples


# ---------------------------------------------------------------- reviews
# What someone writes. {me}: the one who wanted it ("em" / "anh"); {you}: their partner,
# who bought it. Each list is for a score, or for an aspect going well or badly.
VI = {
    "open": {
        5: ["Quá đỉnh!", "Mê luôn 😍", "10/10 không có nhưng", "Xuất sắc!", "Hoàn hảo luôn", "Đỉnh của chóp", "Best luôn ❤️", "Yêu ghê 🥰", "Ưng cái bụng"],
        4: ["Khá ổn nha", "Thích lắm", "Ổn áp", "Được nè 👍", "Ưng", "Good", "Ok phết"],
        3: ["Bình thường", "Tạm ổn", "Cũng được", "Không có gì đặc biệt", "Ok thôi", "Tàm tạm"],
        2: ["Hơi thất vọng", "Không ổn lắm", "Chưa ưng", "Hơi chán", "Không như kỳ vọng"],
        1: ["Tệ quá 😕", "Thất vọng thật sự", "Phí tiền", "Chán hẳn", "Không bao giờ quay lại"],
    },
    "open_food": {5: ["Ngon xỉu 😋", "Ngon hết nấc"], 4: ["Ngon nha", "Ăn được đó"], 2: ["Không ngon lắm"], 1: ["Dở tệ"]},
    "open_clothes": {5: ["Đẹp xỉu", "Xinh hết nấc"], 4: ["Đẹp nha", "Mặc ổn"], 2: ["Không đẹp như hình"], 1: ["Xấu quá"]},
    "like": ["đúng gu {tag} của {me}", "{me} mê {tag} mà", "fan {tag} như {me} thì khỏi chê", "{tag} là chân ái của {me}", "{me} vốn thích {tag} sẵn rồi"],
    "dislike": ["{tag} không phải gu của {me}", "{me} không hợp {tag} lắm", "{me} vốn không mê {tag}", "{me} dị ứng với {tag} 😅"],
    "too_sweet": ["ngọt quá, {me} uống không nổi", "hơi ngọt gắt", "đường nhiều quá", "ngọt khé cổ"],
    "too_bland": ["hơi nhạt", "không đủ ngọt", "uống hơi nhạt nhẽo"],
    "sweet_ok": ["độ ngọt vừa miệng", "ngọt vừa phải, dễ uống", "đúng độ ngọt {me} thích"],
    "aspects": {
        "vị": (["vị đậm đà", "thơm ngon", "vị chuẩn", "vị rất ok"], ["vị hơi lạ", "nhạt nhẽo", "không đậm đà", "vị không như quảng cáo"]),
        "lượng": (["phần nhiều", "size to, đáng tiền", "lượng đầy đặn"], ["phần hơi ít", "ít quá, không đã", "bé xíu à"]),
        "giá": (["giá hợp lý", "giá mềm", "rẻ mà chất lượng", "đáng đồng tiền", "giá sinh viên"], ["hơi đắt", "giá chát", "đắt so với chất lượng", "không đáng tiền lắm"]),
        "giao hàng": (["giao nhanh", "ship siêu nhanh", "giao đúng giờ", "shipper thân thiện"], ["giao chậm quá", "ship lâu", "giao trễ", "shipper giao nhầm địa chỉ"]),
        "món ăn": (["món nào cũng ngon", "đồ ăn tươi", "nêm nếm vừa ăn", "{main} ngon tuyệt"], ["đồ ăn hơi nguội", "{main} không ngon như lời đồn", "nêm hơi mặn"]),
        "phục vụ": (["phục vụ nhiệt tình", "nhân viên dễ thương", "staff thân thiện", "phục vụ nhanh"], ["phục vụ chậm", "nhân viên hơi thờ ơ", "gọi mãi không ai ra"]),
        "không gian": (["không gian đẹp, chill", "quán sạch sẽ", "view đẹp, sống ảo được", "không gian ấm cúng"], ["quán ồn quá", "không gian chật chội", "hơi nóng, không có điều hòa"]),
        "chờ": (["lên món nhanh", "không phải chờ lâu"], ["chờ bàn gần tiếng", "lên món chậm"]),
        "form": (["form chuẩn, mặc vừa in", "form đẹp", "size chuẩn"], ["form rộng quá", "hơi chật", "size lệch so với bảng"]),
        "chất vải": (["vải mát", "chất vải xịn", "vải dày dặn", "chất mềm mịn"], ["vải mỏng", "vải bí, mặc nóng", "giặt lần đầu đã xù"]),
        "màu": (["màu giống hình", "màu {color} xinh", "lên màu đẹp"], ["màu khác hình", "màu {color} hơi lố", "màu nhạt hơn ảnh"]),
        "chất lượng": (["chất lượng tốt", "xịn hơn mong đợi", "đúng như mô tả", "ưng lắm"], ["chất lượng kém", "hàng bị lỗi", "không như mô tả"]),
        "đóng gói": (["đóng gói cẩn thận", "hộp xinh, làm quà rất hợp"], ["hộp móp méo", "đóng gói sơ sài"]),
    },
    "close": {
        5: ["Cảm ơn {you} nha 💕", "Mua lại liền!", "Lần sau mua tiếp nha {you}", "Yêu {you} nhất 🥰", "Recommend mạnh"],
        4: ["Cảm ơn {you} nha", "Sẽ quay lại", "Lần sau thử vị khác", "Cảm ơn {you} 😘"],
        3: ["Lần sau thử chỗ khác", "Chắc không mua lại"],
        2: ["Lần sau thôi nha {you}", "Không mua lại đâu"],
        1: ["Đừng mua nữa nha {you} 😕", "Né gấp"],
    },
}
EN_TAGS = {
    "trà sữa": "milk tea", "cà phê": "coffee", "matcha": "matcha", "trà trái cây": "fruit tea", "đồ ngọt": "sweets", "bánh ngọt": "pastries",
    "đồ cay": "spicy food", "đồ Hàn": "Korean food", "đồ Nhật": "Japanese food", "đồ Tây": "Western food", "đồ Thái": "Thai food",
    "đồ Trung": "Chinese food", "đồ ăn vặt": "street snacks", "món Việt": "Vietnamese food", "đồ chiên": "fried food", "healthy": "healthy food",
    "hải sản": "seafood", "lẩu": "hotpot", "đồ nướng": "grilled food", "phô mai": "cheese", "socola": "chocolate", "đồ basic": "basics",
    "váy": "dresses", "streetwear": "streetwear", "giày sneaker": "sneakers", "túi xách": "bags", "đồ công sở": "office wear",
    "màu pastel": "pastel colours", "đồ màu tối": "dark colours", "mỹ phẩm": "makeup", "nước hoa": "perfume", "gấu bông": "plushies",
    "đồ công nghệ": "gadgets", "sách": "books", "đồ decor": "decor", "phụ kiện": "accessories",
}
EN = {
    "open": {
        5: ["Amazing!", "Loved it 😍", "10/10", "Perfect", "So good ❤️", "Obsessed 🥰"],
        4: ["Pretty good", "Really liked it", "Nice 👍", "Good one", "Solid"],
        3: ["It's ok", "Just average", "Nothing special", "Fine I guess"],
        2: ["A bit disappointing", "Not great", "Meh", "Not what I expected"],
        1: ["Terrible 😕", "Really disappointed", "Waste of money", "Never again"],
    },
    "open_food": {5: ["Soooo yummy 😋"], 4: ["Tasty"], 2: ["Not tasty"], 1: ["Awful"]},
    "open_clothes": {5: ["Gorgeous"], 4: ["Looks nice"], 2: ["Doesn't look like the photos"], 1: ["Ugly"]},
    "like": ["I love {tag}", "exactly my kind of {tag}", "{tag} is my thing", "big {tag} fan here"],
    "dislike": ["{tag} isn't really my thing", "never been into {tag}", "I don't like {tag} much"],
    "too_sweet": ["way too sweet", "too much sugar", "so sweet I couldn't finish it"],
    "too_bland": ["a bit bland", "not sweet enough"],
    "sweet_ok": ["sweetness just right", "not too sweet, perfect"],
    "aspects": {
        "vị": (["great flavour", "tastes really good", "rich and tasty"], ["tastes weird", "bland", "not like the ads"]),
        "lượng": (["big portion", "huge size, worth it"], ["tiny portion", "too small"]),
        "giá": (["good price", "cheap and good", "worth the money"], ["a bit pricey", "overpriced", "not worth the price"]),
        "giao hàng": (["fast delivery", "arrived on time", "nice delivery guy"], ["delivery took forever", "late delivery", "delivered to the wrong place"]),
        "món ăn": (["everything was delicious", "fresh food", "the {main} was amazing"], ["food came out cold", "the {main} was overrated", "too salty"]),
        "phục vụ": (["friendly staff", "great service", "quick service"], ["slow service", "staff didn't care", "had to wave forever to order"]),
        "không gian": (["lovely place, very chill", "clean and cosy", "great view for photos"], ["too noisy", "cramped", "hot, no aircon"]),
        "chờ": (["food came fast", "no wait"], ["waited almost an hour", "food took ages"]),
        "form": (["fits perfectly", "great cut", "true to size"], ["way too loose", "too tight", "sizing is off"]),
        "chất vải": (["breathable fabric", "quality fabric", "soft material"], ["thin fabric", "fabric gets hot", "pilled after one wash"]),
        "màu": (["colour matches the photos", "love the {color}"], ["colour is off", "paler than the photos"]),
        "chất lượng": (["great quality", "just as described", "better than expected"], ["poor quality", "arrived faulty", "not as described"]),
        "đóng gói": (["carefully packed", "cute box, great as a gift"], ["box was dented", "sloppy packaging"]),
    },
    "close": {
        5: ["Thank you babe 💕", "Buying again!", "Highly recommend"],
        4: ["Thanks babe", "Would go again", "Will try another flavour"],
        3: ["Might try somewhere else", "Probably won't rebuy"],
        2: ["Let's not get this again", "Won't buy again"],
        1: ["Please don't buy this again 😕", "Avoid"],
    },
}
ASPECTS = {
    "food_and_drink": ["vị", "lượng", "giá"],
    "restaurant": ["món ăn", "phục vụ", "không gian", "giá", "chờ"],
    "clothes": ["form", "chất vải", "màu", "giá"],
    "shoes_bags": ["form", "chất lượng", "màu", "giá"],  # no fabric to speak of
    "others": ["chất lượng", "giá", "đóng gói"],
}
CARE_ALIASES = {"chất lượng": {"chất lượng", "vị", "món ăn"}, "form": {"form"}, "chất vải": {"chất vải"}}


def cares(person: dict, aspect: str) -> bool:
    return any(aspect == c or aspect in CARE_ALIASES.get(c, ()) for c in person["cares_about"])


def rate(person: dict, item: dict, tags: set[str], delivered: bool) -> tuple[int, str]:
    """A score that follows the person's tastes and how it went, and a review that says why"""
    me, you = ("em", "anh") if person["wanted_by"] == 0 else ("anh", "em")
    bank = EN if person["review_language"] == "en" else VI
    item_type = item["item_type"]
    liked = [t for t in person["likes"] if t in tags]
    disliked = [t for t in person["dislikes"] if t in tags]

    score = 3.5 + 0.7 * min(len(liked), 2) - 1.2 * len(disliked) + rng.gauss(0, 0.35)
    reasons = []  # (weight, clause): the strongest make it into the review
    for tag in liked:
        reasons.append((1.5 + rng.random(), rng.choice(bank["like"]).format(tag=EN_TAGS[tag] if bank is EN else tag, me=me)))
    for tag in disliked:
        reasons.append((2.5 + rng.random(), rng.choice(bank["dislike"]).format(tag=EN_TAGS[tag] if bank is EN else tag, me=me)))

    # Too sweet, or not sweet enough, against how they like it
    if item.get("sugar"):
        sugar = int(item["sugar"].rstrip("%"))
        if person["sweetness"] == "ít ngọt" and sugar >= 70 or person["sweetness"] == "ngọt" and sugar <= 30:
            score -= 1.0
            key = "too_sweet" if person["sweetness"] == "ít ngọt" else "too_bland"
            reasons.append((3 + rng.random(), rng.choice(bank[key]).format(me=me)))
        elif person["sweetness"] and rng.random() < 0.5:
            score += 0.2
            reasons.append((0.5 + rng.random(), rng.choice(bank["sweet_ok"]).format(me=me)))

    worn = "shoes_bags" if item["item_name"].startswith(("Giày", "Sandal", "Túi", "Balo", "Mũ")) else item_type
    aspects = ASPECTS[worn] + (["giao hàng"] if delivered else []) + (["đóng gói"] if delivered and item_type == "clothes" else [])
    for aspect in aspects:
        caring = cares(person, aspect)
        outcome = rng.choices(["good", "bad", None], weights=[55, 20, 25] if not caring else [60, 40, 0])[0]
        if outcome is None:
            continue
        good, bad = bank["aspects"][aspect]
        if outcome == "good":
            score += 0.45 if caring else 0.2
            weight = (2 if caring else 0.3) + rng.random()
            clause = rng.choice(good)
        else:
            score -= 0.9 if caring else 0.35
            weight = (3 if caring else 1) + rng.random()
            clause = rng.choice(bad)
        main = (item.get("main_food") or "").lower() or ("the food" if bank is EN else "món chính")
        color = (item.get("color") or "").lower() or ("colour" if bank is EN else "này")
        reasons.append((weight, clause.format(main=main, color=color)))

    score = max(1, min(5, round(score)))
    opener = rng.choice(bank["open"][score])
    typed = bank["open_food"] if item_type in ("food_and_drink", "restaurant") else bank["open_clothes"] if item_type == "clothes" else {}
    if score in typed and rng.random() < 0.4:
        opener = rng.choice(typed[score])
    clauses = [c for _, c in sorted(reasons, reverse=True)[: rng.choice([1, 2, 2, 3])]]
    closer = rng.choice(bank["close"][score]).format(you=you) if rng.random() < 0.5 else ""

    # Shorten until it fits the server's limit
    while True:
        body = ", ".join(clauses)
        if not body:
            content = opener
        elif opener[-1].isalnum():  # "Khá ổn nha, giá hợp lý."
            content = f"{opener}, {body}."
        else:  # after "!" or an emoji, a new sentence: "Mê luôn 😍 Giá hợp lý."
            content = f"{opener} {body[:1].upper()}{body[1:]}."
        if closer:
            content += f" {closer}"
        if len(content.encode("utf-8")) <= MAX_REVIEW_BYTES:
            return score, content
        if closer:
            closer = ""
        else:
            clauses.pop()


# ---------------------------------------------------------------- purchases
def taste_weight(person: dict, tags: set[str]) -> float:
    weight = 1 + 2.5 * sum(t in tags for t in person["likes"])
    return weight * (0.35 if any(t in tags for t in person["dislikes"]) else 1)


def pick(person: dict, options: list, tags_of) -> object:
    return rng.choices(options, weights=[taste_weight(person, tags_of(o)) for o in options])[0]


def address(city: str) -> str:
    street, district = rng.choice(CITIES[city])
    return f"{rng.randint(1, 250)} {street}, {district}, {city}"


def restaurants_for(city: str) -> list[dict]:
    """The places to eat in a city: the chains, plus neighbourhood places named after their dish"""
    places = [{"name": n, "cuisine": c, "tags": set(t), "mains": m, "address": address(city)} for n, c, t, m in RESTAURANT_CHAINS]
    for dish, cuisine, tags, mains in LOCAL_DISHES:
        for nickname in rng.sample(NICKNAMES, 3):
            places.append({"name": f"{dish} {nickname}", "cuisine": cuisine, "tags": set(tags), "mains": mains, "address": address(city)})
    return places


def food_item(person: dict) -> tuple[dict, set[str], bool]:
    entry = pick(person, FOOD_MENU, lambda e: e["tags"])
    shops, toppings, _ = FOOD[entry["kind"]]
    drink = entry["kind"] in DRINKS
    delivered = rng.random() < 0.45
    if drink:
        sweetness = person["sweetness"]
        levels = {"ít ngọt": [0, 30, 50], "ngọt": [70, 100], None: [30, 50, 70, 100]}[sweetness]
        sugar = rng.choice(levels if rng.random() < 0.8 else [0, 30, 50, 70, 100])  # the shop's default, sometimes
        fields = {"sugar": f"{sugar}%", "size": rng.choice(["S", "M", "M", "L"]), "notes": rng.choice(DRINK_NOTES + [None] * 4)}
    else:
        fields = {"sugar": None, "size": None, "notes": rng.choice(FOOD_NOTES + [None] * 5)}
    fields["toppings"] = rng.sample(toppings, rng.choice([0, 0, 1, 1, 2]))
    shop = rng.choice(shops)
    url = None
    if delivered:
        url = rng.choice([f"https://shopeefood.vn/{rng.randint(10**6, 10**7)}", f"https://food.grab.com/vn/vi/restaurant/{rng.randint(10**6, 10**7)}"])
    return {"item_name": entry["name"], "shop_name": shop, "buy_url": url, **fields}, entry["tags"], delivered


def restaurant_item(person: dict, places: list[dict]) -> tuple[dict, set[str], bool]:
    place = pick(person, places, lambda p: p["tags"])
    evening = bool(place["tags"] & {"lẩu", "đồ nướng"})
    when = rng.choices(["Sáng", "Trưa", "Chiều", "Tối", "Khuya"], weights=[1, 2, 1, 8, 2] if evening else [3, 4, 2, 5, 1])[0]
    main = rng.choice(place["mains"])
    fields = {"main_food": main, "cuisine_type": place["cuisine"], "address": place["address"], "time_to_eat": when}
    return {"item_name": place["name"], "shop_name": None, "buy_url": None, **fields}, place["tags"] | keyword_tags(main), False


def clothes_item(person: dict) -> tuple[dict, set[str], bool]:
    options = [c for c in CLOTHES if person["wanted_by"] == 0 or not c[4]]
    name, tag_list, size_kind, brands, _ = pick(person, options, lambda c: set(c[1]))
    tags = set(tag_list)
    brand = rng.choice(brands or CLOTHES_BRANDS[next(t for t in tag_list if t in CLOTHES_BRANDS)])
    color = rng.choice(PASTEL if "màu pastel" in person["likes"] and rng.random() < 0.5 else DARK if "đồ màu tối" in person["likes"] and rng.random() < 0.5 else COLORS)
    tags |= {"màu pastel"} if color in PASTEL else {"đồ màu tối"} if color in DARK else set()
    online = rng.random() < 0.5
    shop = rng.choice(ONLINE_SHOPS) if online else f"{brand} Store" if brand != "Local Brand" else rng.choice(["Local Brand Store", "The New Playground", "Saigon Square"])
    fields = {"size": rng.choice(SIZES[size_kind]) if size_kind else None, "color": color, "brand": brand}
    return {"item_name": name, "shop_name": shop, "buy_url": product_url(shop) if online else None, **fields}, tags, online


def others_item(person: dict) -> tuple[dict, set[str], bool]:
    options = [o for o in OTHERS if person["wanted_by"] == 0 or not o[4]]
    name, tags, category, notes, _ = pick(person, options, lambda o: set(o[1]))
    shop = rng.choice(OTHER_SHOPS[category])
    online = shop in ONLINE_SHOPS or rng.random() < 0.3
    fields = {"category": category, "notes": rng.choice(notes)}
    return {"item_name": name, "shop_name": shop, "buy_url": product_url(shop) if online else None, **fields}, set(tags), online


def product_url(shop: str) -> str:
    if shop == "Shopee":
        return f"https://shopee.vn/product/{rng.randint(10**8, 10**9)}/{rng.randint(10**9, 10**10)}"
    if shop == "Lazada":
        return f"https://www.lazada.vn/products/i{rng.randint(10**9, 10**10)}.html"
    if shop == "TikTok Shop":
        return f"https://shop.tiktok.com/view/product/{rng.randint(10**17, 10**18)}"
    if shop == "Tiki":
        return f"https://tiki.vn/p{rng.randint(10**7, 10**8)}.html"
    return f"https://example.com/{shop.lower().replace(' ', '-')}/{rng.randint(1000, 99999)}"


EMPTY_FIELDS = {
    "clothes": ["size", "color", "brand"],
    "food_and_drink": ["sugar", "size", "notes", "toppings"],
    "restaurant": ["main_food", "cuisine_type", "address", "time_to_eat", "schedule"],
    "others": ["category", "notes"],
}
HOURS = {"Sáng": 8, "Trưa": 12, "Chiều": 15, "Tối": 19, "Khuya": 22}


def make_dataset(couples: list[tuple[dict, dict]], count: int, type_weights: dict[str, int], rated: float) -> list[dict]:
    places = {city: restaurants_for(city) for city in CITIES}
    # Some couples use the app far more than others
    activity = [rng.uniform(0.3, 1.7) for _ in couples]
    girl_share = [rng.uniform(0.5, 0.75) for _ in couples]
    started = [START + timedelta(days=rng.uniform(0, 200)) for _ in couples]

    purchases = []
    for _ in range(count):
        c = rng.choices(range(len(couples)), weights=activity)[0]
        span = (END - started[c]).total_seconds()
        purchases.append((started[c] + timedelta(seconds=rng.uniform(0, span)), c))
    purchases.sort()

    histories = []
    for item_id, (bought_at, c) in enumerate(purchases, start=101):
        person = couples[c][0] if rng.random() < girl_share[c] else couples[c][1]
        item_type = rng.choices(list(type_weights), weights=list(type_weights.values()))[0]
        if item_type == "food_and_drink":
            fields, tags, delivered = food_item(person)
        elif item_type == "restaurant":
            fields, tags, delivered = restaurant_item(person, places[person["city"]])
        elif item_type == "clothes":
            fields, tags, delivered = clothes_item(person)
        else:
            fields, tags, delivered = others_item(person)

        created_at = bought_at - timedelta(days=rng.uniform(0.02, 3) if item_type == "food_and_drink" else rng.uniform(0.5, 21))
        item = {
            "id": item_id,
            "uuid": uuid7(created_at),
            "item_name": fields.pop("item_name"),
            "quantity": 2 if item_type == "food_and_drink" and rng.random() < 0.3 else 1,
            "buy_url": fields.pop("buy_url"),
            "shop_name": fields.pop("shop_name"),
            "created_at": iso(created_at),
            "item_type": item_type,
            "bought": True,
            "wanted_by": person["wanted_by"],
            "item_media_folder": None,
            "owner": person["owner"],
            "deadline_at": None,
            "buy_at": None,
        }
        if item_type != "restaurant" and rng.random() < 0.25:
            item["deadline_at"] = iso((bought_at + timedelta(days=rng.uniform(0, 3))).replace(hour=21, minute=0, second=0, microsecond=0))
        if item_type == "food_and_drink" and rng.random() < 0.3:
            item["buy_at"] = iso(bought_at - timedelta(minutes=rng.randint(5, 40)))
        item.update({key: None for key in EMPTY_FIELDS[item_type]})
        item.update(fields)
        if item_type == "restaurant":
            hour = HOURS[fields["time_to_eat"]]
            item["schedule"] = iso(bought_at.replace(hour=hour, minute=rng.choice([0, 15, 30, 45]), second=0, microsecond=0))

        history_id = uuid7(bought_at)
        history = {"id": history_id, "item_id": item_id, "item": item, "time": iso(bought_at), "review": None}
        if rng.random() < rated:
            score, content = rate(person, item, tags, delivered)
            if rated < 1 and rng.random() < 0.15:
                content = ""  # just the stars
            history["review"] = {"id": uuid7(bought_at + timedelta(hours=rng.uniform(1, 48))), "history_id": history_id, "score": score, "content": content}
        histories.append(history)
    return histories[::-1]  # newest first, like GET /api/history


HISTORY_COLUMNS = [
    "history_id", "time", "item_id", "uuid", "item_name", "quantity", "buy_url", "shop_name", "created_at", "item_type",
    "bought", "wanted_by", "item_media_folder", "owner", "deadline_at", "buy_at",
    "size", "color", "brand", "sugar", "notes", "toppings", "category", "main_food", "cuisine_type", "address", "time_to_eat", "schedule",
    "review_id", "score", "content",
]
PROFILE_COLUMNS = ["owner", "partner", "wanted_by", "city", "review_language", "likes", "dislikes", "sweetness", "cares_about", "summary"]


def cell(value):
    return "; ".join(value) if isinstance(value, list) else value  # None is written as an empty cell


def flatten(history: dict) -> dict:
    """One purchase as one row: the History, its Item's fields and its Review's"""
    item = {k: v for k, v in history["item"].items() if k != "id"}
    review = history["review"] or {}
    return {"history_id": history["id"], "time": history["time"], "item_id": history["item_id"], **item,
            "review_id": review.get("id"), "score": review.get("score"), "content": review.get("content")}


def write(path: str, rows: list[dict], columns: list[str]) -> None:
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        writer.writerows({k: cell(v) for k, v in row.items()} for row in rows)


if __name__ == "__main__":
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 10000
    here = os.path.dirname(os.path.abspath(__file__))
    people, couples = make_people()
    food = make_dataset(couples, count, {"food_and_drink": 7, "restaurant": 3}, rated=0.8)
    ratings = make_dataset(couples, count, {"food_and_drink": 4, "restaurant": 3, "clothes": 2, "others": 2}, rated=1.0)
    write(os.path.join(here, "bert_food_history.csv"), [flatten(h) for h in food], HISTORY_COLUMNS)
    write(os.path.join(here, "summarization_rating_history.csv"), [flatten(h) for h in ratings], HISTORY_COLUMNS)
    write(os.path.join(here, "profiles.csv"), people, PROFILE_COLUMNS)
    names = {h["item"]["item_name"] for h in food}
    print(f"bert_food_history.csv: {len(food)} purchases, {len(names)} different names")
    print(f"summarization_rating_history.csv: {len(ratings)} purchases, all rated")
    print(f"profiles.csv: {len(people)} people in {len(couples)} couples")
