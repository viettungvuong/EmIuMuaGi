from typing import Annotated, Union

from pydantic import BaseModel, Field

from models.clothes import ClothesCreate, ClothesResponse
from models.food_and_drink import FoodAndDrinkCreate, FoodAndDrinkResponse
from models.others import OthersCreate, OthersResponse


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class AuthRequest(BaseModel):
    password: str


class AuthResponse(BaseModel):
    success: bool
    message: str


# ---------------------------------------------------------------------------
# Discriminated unions — FastAPI uses item_type to pick the right schema
# ---------------------------------------------------------------------------

AnyItemCreate = Annotated[
    Union[ClothesCreate, FoodAndDrinkCreate, OthersCreate],
    Field(discriminator="item_type"),
]

AnyItemResponse = Annotated[
    Union[ClothesResponse, FoodAndDrinkResponse, OthersResponse],
    Field(discriminator="item_type"),
]
