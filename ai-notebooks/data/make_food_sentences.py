"""Writes food_sentences.csv: made-up Vietnamese sentences about what people eat and
drink, and where ("Tôi hay đi quán cà phê và uống matcha latte"), for fine-tuning
PhoBERT (finetune_bert.ipynb). Each food and drink is said in the places and with
the words that fit it, so the model learns what it is: a drink you order at a café,
a bowl of noodles at a street stall, a restaurant you book for the weekend.

The foods, drinks, shops and restaurants are make_datasets.py's, mixed-language
names included (Cappuccino quế, Trà sữa matcha). Columns: sentence, and the items
in it with their kind, for looking things up.

  python3 make_food_sentences.py [rows]     (default 10000)
"""

import csv
import os
import random
import sys

from make_datasets import DRINKS, FOOD, FOOD_MENU, LOCAL_DISHES, NICKNAMES, RESTAURANT_CHAINS

rng = random.Random(2027)

SUBJECTS = ["tôi", "mình", "em", "anh", "người yêu tôi", "bạn gái em", "bạn trai mình", "vợ tôi", "chồng tôi", "cả nhà mình",
            "đứa bạn thân của tôi", "mẹ tôi", "hai đứa mình", "nhóm bạn của tôi", "đồng nghiệp của mình", "chị gái tôi"]
OFTEN = ["hay", "thường", "thỉnh thoảng", "ngày nào cũng", "lúc nào cũng", "cứ rảnh là", "hôm nào mệt là", "tuần nào cũng"]
TIMES = ["buổi sáng", "buổi trưa", "chiều nay", "tối qua", "cuối tuần", "hôm qua", "giờ nghỉ trưa", "sau giờ làm", "sáng chủ nhật", "tối thứ sáu"]
WITH = ["bạn thân", "người yêu", "đồng nghiệp", "cả nhà", "mấy đứa bạn cùng lớp", "chị gái", "bạn cùng phòng"]
APPS = ["ShopeeFood", "GrabFood", "Be"]
DRINK_WAYS = ["ít đá", "ít ngọt", "không đá", "size L", "thêm trân châu", "đá riêng", "50% đường", "nóng", "thêm kem muối"]
FOOD_WAYS = ["không hành", "thêm rau", "cay nhiều", "không cay", "thêm trứng", "ít nước mắm", "mang về"]
SWEET_WAYS = ["ít ngọt", "mang về", "thêm topping", "size lớn"]
SWEETS = {"dessert", "bakery"}

PLACES = {
    "milktea": ["tiệm trà sữa", "quán trà sữa"],
    "coffee": ["quán cà phê", "quán cafe", "tiệm cà phê gần công ty"],
    "matcha": ["quán cà phê", "tiệm matcha", "quán cafe"],
    "tea": ["quán trà", "quán cà phê", "quán trà chanh"],
    "juice": ["quán sinh tố", "tiệm nước ép", "quán nước đầu ngõ"],
    "blended": ["quán cà phê", "quán cafe"],
    "dessert": ["tiệm chè", "tiệm kem", "quán tráng miệng"],
    "bakery": ["tiệm bánh", "tiệm bánh ngọt", "lò bánh gần nhà"],
    "snack": ["quán ăn vặt", "chợ đêm", "xe đồ ăn vặt đầu ngõ"],
    "meal": ["quán ăn đầu ngõ", "quán cơm gần công ty", "hàng quen", "quán ven đường"],
}
CUISINE_PLACES = {
    "đồ Nhật": ["quán Nhật", "nhà hàng Nhật"], "đồ Hàn": ["quán Hàn", "nhà hàng Hàn Quốc"], "đồ Thái": ["quán Thái"],
    "đồ Trung": ["quán người Hoa", "tiệm dimsum"], "lẩu": ["quán lẩu"], "đồ Tây": ["nhà hàng Âu"], "món Việt": ["quán Việt"],
}


def lower_first(name: str) -> str:
    return name[:1].lower() + name[1:]


def place_for(entry: dict) -> str:
    """Where it's had, in words: a kind of place"""
    if entry["kind"] in PLACES:
        return rng.choice(PLACES[entry["kind"]])
    name = entry["name"].lower()
    if entry["kind"] == "fastfood":
        if "pizza" in name:
            return "quán pizza"
        if "burger" in name:
            return "tiệm burger"
        return rng.choice(["tiệm gà rán", "quán đồ ăn nhanh"])
    for tag, places in CUISINE_PLACES.items():
        if tag in entry["tags"]:
            return rng.choice(places)
    return "quán ăn"


def unit_for(entry: dict) -> str:
    """How much of it: a cup of coffee, a bowl of phở, a plate of rice"""
    name = entry["name"].lower()
    if entry["kind"] in DRINKS:
        return rng.choice(["một ly", "một cốc"])
    if name.startswith(("phở", "bún", "hủ tiếu", "mì", "miến", "bánh canh", "cháo", "bò kho", "ramen", "udon")):
        return rng.choice(["một tô", "một bát"])
    if name.startswith(("cơm", "spaghetti", "mì ý")):
        return "một đĩa"
    if name.startswith("bánh mì"):
        return "một ổ"
    if name.startswith("xôi"):
        return "một gói"
    if name.startswith("lẩu"):
        return "một nồi"
    if name.startswith(("pizza", "burger", "bánh", "croissant", "donut", "tart", "muffin", "sandwich", "hotdog")):
        return "một cái"
    if name.startswith(("chè", "kem", "sữa chua")):
        return rng.choice(["một ly", "một cốc"])
    return "một phần"


# Templates and what they're for. {subj} is lowercase; a sentence's first letter is capitalised after.
ANY = [
    "{subj} {often} đi {place} và {verb} {item}.",
    "{time}, {subj} {verb} {unit} {item} ở {shop}.",
    "{subj} rất thích {item}, tuần nào cũng {verb} ít nhất một lần.",
    "mỗi lần đi {place}, {subj} đều gọi {item}.",
    "{subj} hay gọi {item} {way}.",
    "{time} {subj} rủ {with_} đi {place} {verb} {item}.",
    "món {subj} {verb} nhiều nhất ở {shop} là {item}.",
    "hôm nay {subj} đặt {item} trên {app} về nhà.",
    "ở {shop}, {subj} thích nhất là {item}.",
    "lâu lắm rồi {subj} chưa được {verb} {item}, thèm quá.",
    "{item} ở {shop} là món {subj} {verb} hoài không chán.",
    "{subj} {often} mua {item} mang về cho {with_}.",
    "nếu phải chọn một món ở {place}, {subj} sẽ chọn {item}.",
    "{subj} hay order {item} ở {shop}.",
    "{subj} vừa thử {item} ở {shop} lần đầu.",
]
DRINK_ONLY = [
    "trời nóng thì {subj} hay uống {item} cho mát.",
    "sáng nào {subj} cũng phải có {unit} {item} mới tỉnh.",
    "đi làm về mệt, {subj} ghé {shop} mua {unit} {item}.",
    "ở {place}, {subj} luôn gọi {item} {way}.",
]
FOOD_ONLY = [  # a meal or a snack
    "đói bụng lúc nửa đêm, {subj} thường ăn {item}.",
    "bữa trưa của {subj} hôm nay là {unit} {item}.",
    "{subj} hay ăn {item} {way}.",
]
SWEET_ONLY = [  # desserts and cakes
    "mỗi lần thèm ngọt, {subj} lại ăn {item}.",
    "{subj} hay mua {item} {way} ở {shop}.",
    "ăn xong bữa tối, {subj} hay gọi thêm {unit} {item} tráng miệng.",
]
PAIRS = [  # {item}: something to eat, {item2}: something to drink
    "{subj} {often} ăn {item} rồi uống {item2}.",
    "ăn {item} xong, {subj} hay gọi thêm {unit2} {item2}.",
    "bữa sáng của {subj} thường là {item} với {item2}.",
    "{time}, {subj} ăn {unit} {item} và uống {unit2} {item2}.",
]
RESTAURANT = [
    "{subj} {often} đi {restaurant} ăn {main} với {with_}.",
    "cuối tuần {subj} hay rủ {with_} đi {restaurant}.",
    "ở {restaurant}, {subj} thích nhất món {main}.",
    "{time} {subj} đi ăn {cuisine_place}, gọi {main}.",
    "{subj} hay đặt bàn ở {restaurant} vào {time}.",
    "món {main} ở {restaurant} là lý do {subj} quay lại hoài.",
]

RESTAURANTS = [{"name": n, "tags": set(t), "mains": m} for n, _, t, m in RESTAURANT_CHAINS] + [
    {"name": f"{dish} {nickname}", "tags": set(t), "mains": m} for dish, _, t, m in LOCAL_DISHES for nickname in NICKNAMES
]
EATS = [e for e in FOOD_MENU if e["kind"] not in DRINKS]
DRINKS_MENU = [e for e in FOOD_MENU if e["kind"] in DRINKS]


def common() -> dict:
    return {"subj": rng.choice(SUBJECTS), "often": rng.choice(OFTEN), "time": rng.choice(TIMES), "with_": rng.choice(WITH), "app": rng.choice(APPS)}


def about(entry: dict, suffix: str = "") -> dict:
    drink = entry["kind"] in DRINKS
    return {
        f"item{suffix}": lower_first(entry["name"]),
        f"unit{suffix}": unit_for(entry),
        f"verb{suffix}": "uống" if drink else rng.choice(["ăn", "ăn", "ăn", "gọi"]),
        f"place{suffix}": place_for(entry),
        f"shop{suffix}": rng.choice(FOOD[entry["kind"]][0]),
        f"way{suffix}": rng.choice(DRINK_WAYS if drink else SWEET_WAYS if entry["kind"] in SWEETS else FOOD_WAYS),
    }


def sentence() -> tuple[str, list[str], list[str]]:
    """A sentence, the items in it and their kinds"""
    kind = rng.choices(["one", "only", "pair", "restaurant"], weights=[55, 15, 15, 15])[0]
    fields = common()
    if kind == "restaurant":
        place = rng.choice(RESTAURANTS)
        cuisine = next((rng.choice(p) for tag, p in CUISINE_PLACES.items() if tag in place["tags"]), "quán quen")
        fields |= {"restaurant": place["name"], "main": lower_first(rng.choice(place["mains"])), "cuisine_place": cuisine}
        text, items, kinds = rng.choice(RESTAURANT), [place["name"]], ["restaurant"]
    elif kind == "pair":
        eat, drink = rng.choice(EATS), rng.choice(DRINKS_MENU)
        fields |= about(eat) | about(drink, "2")
        text, items, kinds = rng.choice(PAIRS), [eat["name"], drink["name"]], [eat["kind"], drink["kind"]]
    else:
        entry = rng.choice(FOOD_MENU)
        fields |= about(entry)
        templates = ANY if kind == "one" else DRINK_ONLY if entry["kind"] in DRINKS else SWEET_ONLY if entry["kind"] in SWEETS else FOOD_ONLY
        text, items, kinds = rng.choice(templates), [entry["name"]], [entry["kind"]]
    text = text.format(**fields)
    return text[:1].upper() + text[1:], items, kinds


if __name__ == "__main__":
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 10000
    seen, rows = set(), []
    while len(rows) < count:
        text, items, kinds = sentence()
        if text not in seen:
            seen.add(text)
            rows.append({"sentence": text, "items": "; ".join(items), "kinds": "; ".join(kinds)})
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "food_sentences.csv")
    with open(out, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["sentence", "items", "kinds"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} sentences, about {len({i for r in rows for i in r['items'].split('; ')})} different foods, drinks and places, to {out}")
