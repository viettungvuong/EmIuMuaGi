"""Writes sample_history.json: made-up purchase history with ratings, shaped like
the item service's models (backend/item-service/models):

  History  {id, item_id, item, time}       one purchase ("I bought it")
  item     Item's fields plus its type's (Clothes / FoodAndDrink / Restaurant /
           Others), as the API's AnyItem returns them
  review   Review {id, history_id, score, content}, or null when not rated yet

One couple, lan (her) and minh (him), each with tastes the scores follow, so
there's something for a recommender to find. Same seed, same file.

  python3 make_sample_history.py [count]     (default 60)
"""

import json
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

SEED = 2026
VN = timezone(timedelta(hours=7))
START = datetime(2026, 5, 1, tzinfo=VN)
END = datetime(2026, 11, 25, tzinfo=VN)
OWNERS = {"lan": 0, "minh": 1}  # owner -> wanted_by (models.WantedByGirl / WantedByBoy)

rng = random.Random(SEED)


def uuid7(at: datetime) -> str:
    """A UUIDv7 for that moment, as the models' BeforeCreate makes them"""
    ms = int(at.timestamp() * 1000)
    rand = rng.getrandbits(74)
    value = (ms & ((1 << 48) - 1)) << 80 | 0x7 << 76 | (rand >> 62) << 64 | 0b10 << 62 | (rand & ((1 << 62) - 1))
    return str(uuid.UUID(int=value))


def iso(at: datetime | None) -> str | None:
    return at.isoformat(timespec="seconds") if at else None


# What can be bought: (name, type-specific fields, shop, base score for lan, for minh)
CATALOG = {
    "clothes": [
        ("Áo thun oversize", {"size": "M", "color": "Trắng", "brand": "Local Brand"}, "Shopee", 4.2, 3.6),
        ("Váy hoa nhí", {"size": "S", "color": "Xanh pastel", "brand": "Zara"}, "Zara Vincom", 4.6, 3.0),
        ("Quần jean ống rộng", {"size": "28", "color": "Xanh nhạt", "brand": "Levi's"}, "Levi's Store", 3.8, 3.9),
        ("Áo hoodie nỉ", {"size": "L", "color": "Xám", "brand": "Uniqlo"}, "Uniqlo Đồng Khởi", 3.9, 4.4),
        ("Giày Air Force 1", {"size": "42", "color": "Trắng", "brand": "Nike"}, "Nike Store", 3.4, 4.7),
        ("Túi tote canvas", {"size": None, "color": "Be", "brand": "Local Brand"}, "Shopee", 4.0, 2.8),
        ("Áo sơ mi linen", {"size": "M", "color": "Kem", "brand": "H&M"}, "H&M Aeon", 3.6, 4.0),
    ],
    "food_and_drink": [
        ("Trà sữa trân châu đường đen", {"sugar": "70%", "size": "L", "notes": "Ít đá", "toppings": ["trân châu đen"]}, "Phúc Long", 4.8, 3.2),
        ("Trà đào cam sả", {"sugar": "50%", "size": "M", "notes": None, "toppings": ["thạch đào"]}, "Highlands Coffee", 4.3, 3.8),
        ("Cà phê muối", {"sugar": "100%", "size": "M", "notes": None, "toppings": []}, "Cà Phê Muối Chú Long", 3.5, 4.7),
        ("Matcha latte", {"sugar": "50%", "size": "M", "notes": "Sữa yến mạch", "toppings": ["kem cheese"]}, "Katinat", 4.5, 3.3),
        ("Bánh tráng trộn", {"sugar": None, "size": None, "notes": "Không cay", "toppings": ["trứng cút", "bò khô"]}, "Cô Thảo", 4.1, 3.9),
        ("Bánh flan caramel", {"sugar": None, "size": None, "notes": None, "toppings": ["cà phê"]}, "Flan Hồng", 4.4, 3.7),
        ("Sinh tố bơ", {"sugar": "30%", "size": "L", "notes": "Thêm sữa đặc", "toppings": []}, "Sinh Tố 142", 3.9, 4.1),
    ],
    "restaurant": [
        ("Phở Thìn", {"main_food": "Phở bò tái", "cuisine_type": "Việt", "address": "13 Lò Đúc, Hai Bà Trưng, Hà Nội", "time_to_eat": "Sáng"}, None, 3.9, 4.6),
        ("Gogi House", {"main_food": "Ba chỉ bò nướng", "cuisine_type": "Hàn", "address": "Vincom Bà Triệu, Hà Nội", "time_to_eat": "Tối"}, None, 4.7, 4.3),
        ("Sushi Hokkaido Sachi", {"main_food": "Sashimi cá hồi", "cuisine_type": "Nhật", "address": "Lotte Center, Ba Đình, Hà Nội", "time_to_eat": "Tối"}, None, 4.5, 3.8),
        ("Lẩu Thái Tomyum", {"main_food": "Lẩu hải sản", "cuisine_type": "Thái", "address": "45 Trần Thái Tông, Cầu Giấy, Hà Nội", "time_to_eat": "Tối"}, None, 2.9, 4.5),
        ("Bún chả Hương Liên", {"main_food": "Bún chả", "cuisine_type": "Việt", "address": "24 Lê Văn Hưu, Hai Bà Trưng, Hà Nội", "time_to_eat": "Trưa"}, None, 4.0, 4.4),
        ("Pizza 4P's", {"main_food": "Pizza burrata", "cuisine_type": "Ý", "address": "43 Tràng Tiền, Hoàn Kiếm, Hà Nội", "time_to_eat": "Tối"}, None, 4.6, 4.2),
    ],
    "others": [
        ("Son kem lì", {"category": "Mỹ phẩm", "notes": "Màu đỏ đất"}, "Hasaki", 4.7, 2.5),
        ("Gấu bông Capybara", {"category": "Quà tặng", "notes": "Loại 40cm"}, "Shopee", 4.5, 3.4),
        ("Nến thơm vanilla", {"category": "Đồ trang trí", "notes": None}, "Tiki", 4.0, 3.1),
        ("Tai nghe không dây", {"category": "Điện tử", "notes": "Chống ồn"}, "CellphoneS", 3.6, 4.6),
        ("Sách 'Hiểu về trái tim'", {"category": "Sách", "notes": None}, "Fahasa", 3.9, 3.7),
        ("Ốp lưng điện thoại", {"category": "Phụ kiện", "notes": "iPhone 16"}, "Shopee", 3.3, 3.5),
    ],
}

EMPTY_FIELDS = {
    "clothes": ["size", "color", "brand"],
    "food_and_drink": ["sugar", "size", "notes", "toppings"],
    "restaurant": ["main_food", "cuisine_type", "address", "time_to_eat", "schedule"],
    "others": ["category", "notes"],
}

# What someone writes for each score
REVIEWS = {
    1: ["Không như mong đợi, hơi thất vọng 😕", "Lần sau không mua nữa", "Chất lượng kém quá"],
    2: ["Tạm được, nhưng không đáng tiền", "Hơi khác so với hình", "Không hợp lắm"],
    3: ["Bình thường, không có gì đặc biệt", "Ổn, nhưng có chỗ khác ngon hơn", "Được, giao hơi lâu"],
    4: ["Thích lắm, cảm ơn anh nha 💕", "Ngon, sẽ quay lại", "Đẹp, mặc vừa in", "Đáng tiền ghê"],
    5: ["Tuyệt vời, yêu anh nhất 🥰", "Quá đỉnh, mua lại liền!", "Đúng thứ em muốn luôn ❤️", "Hoàn hảo, không chê được gì"],
}


def make(count: int) -> list[dict]:
    span = (END - START).total_seconds()
    times = sorted(START + timedelta(seconds=rng.uniform(0, span)) for _ in range(count))
    histories = []
    for item_id, bought_at in enumerate(times, start=101):
        item_type = rng.choices(list(CATALOG), weights=[3, 4, 3, 2])[0]
        name, fields, shop, lan_score, minh_score = rng.choice(CATALOG[item_type])
        # Mostly her wish list, bought by him
        owner = "lan" if rng.random() < 0.7 else "minh"
        created_at = bought_at - timedelta(days=rng.uniform(0.5, 21))

        item = {
            "id": item_id,
            "uuid": uuid7(created_at),
            "item_name": name,
            "quantity": 2 if item_type == "food_and_drink" and rng.random() < 0.3 else 1,
            "buy_url": f"https://shopee.vn/product/{rng.randint(10**8, 10**9)}" if shop == "Shopee" else None,
            "shop_name": shop,
            "created_at": iso(created_at),
            "item_type": item_type,
            "bought": True,
            "wanted_by": OWNERS[owner],
            "item_media_folder": None,
            "owner": owner,
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
            hour = {"Sáng": 8, "Trưa": 12, "Tối": 19}[fields["time_to_eat"]]
            item["schedule"] = iso(bought_at.replace(hour=hour, minute=rng.choice([0, 15, 30]), second=0, microsecond=0))

        history_id = uuid7(bought_at)
        history = {"id": history_id, "item_id": item_id, "item": item, "time": iso(bought_at)}

        # Rated by whoever wanted it, about 4 in 5 times; the score follows their taste
        if rng.random() < 0.8:
            base = lan_score if owner == "lan" else minh_score
            score = max(1, min(5, round(rng.gauss(base, 0.6))))
            content = rng.choice(REVIEWS[score]) if rng.random() < 0.85 else ""
            history["review"] = {"id": uuid7(bought_at + timedelta(hours=rng.uniform(1, 48))), "history_id": history_id, "score": score, "content": content}
        else:
            history["review"] = None
        histories.append(history)
    return histories[::-1]  # newest first, like GET /api/history


if __name__ == "__main__":
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 60
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_history.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(make(count), f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"Wrote {count} purchases to {out}")
