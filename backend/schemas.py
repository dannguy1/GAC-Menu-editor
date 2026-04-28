"""Pydantic schemas for all request/response models.

Implements FR-M04, FR-F04, FR-L01-L10 - validation of all data structures.
"""
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------

class TokenRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    password_is_default: bool


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


# ---------------------------------------------------------------------------
# Location schemas
# ---------------------------------------------------------------------------

class LocationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    address: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be blank")
        return v.strip()


class LocationUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    address: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("name must not be blank")
        return v.strip() if v else v


class LocationResponse(BaseModel):
    location_id: str
    name: str
    address: Optional[str] = None
    created_at: str
    last_deployed_at: Optional[str] = None
    item_count: Optional[int] = None
    fact_count: Optional[int] = None


class LocationSlim(BaseModel):
    location_id: str
    name: str


# ---------------------------------------------------------------------------
# Menu item schemas
# ---------------------------------------------------------------------------

class MenuItemCreate(BaseModel):
    item_name: str = Field(min_length=1, max_length=200)
    item_viet: Optional[str] = None
    pronunciation: Optional[str] = None
    description: str = Field(min_length=1)
    description_viet: Optional[str] = None
    price: float = Field(ge=0)
    category: str = Field(min_length=1, max_length=100)
    popular: bool = False
    available: bool = True
    image_path: Optional[str] = None

    @field_validator("item_name", "category")
    @classmethod
    def strip_strings(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v


class MenuItemUpdate(BaseModel):
    item_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    item_viet: Optional[str] = None
    pronunciation: Optional[str] = None
    description: Optional[str] = Field(default=None, min_length=1)
    description_viet: Optional[str] = None
    price: Optional[float] = Field(default=None, ge=0)
    category: Optional[str] = Field(default=None, min_length=1, max_length=100)
    popular: Optional[bool] = None
    available: Optional[bool] = None
    image_path: Optional[str] = None

    @field_validator("item_name", "category")
    @classmethod
    def strip_strings(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("must not be blank")
        return v


class MenuItemResponse(BaseModel):
    item_id: str
    item_name: str
    item_viet: Optional[str] = None
    pronunciation: Optional[str] = None
    description: str
    description_viet: Optional[str] = None
    price: float
    category: str
    popular: bool = False
    available: bool = True
    image_path: Optional[str] = None


# ---------------------------------------------------------------------------
# Facts schemas
# ---------------------------------------------------------------------------

VALID_FACT_TYPES = {"general_info", "promotion", "announcement", "hours", "policy"}


class FactCreate(BaseModel):
    topic: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    type: str = "general_info"

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in VALID_FACT_TYPES:
            raise ValueError(f"type must be one of {VALID_FACT_TYPES}")
        return v

    @field_validator("topic")
    @classmethod
    def strip_topic(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("topic must not be blank")
        return v


class FactUpdate(BaseModel):
    topic: Optional[str] = Field(default=None, min_length=1, max_length=200)
    content: Optional[str] = Field(default=None, min_length=1)
    type: Optional[str] = None

    @field_validator("topic")
    @classmethod
    def strip_topic(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("topic must not be blank")
        return v

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_FACT_TYPES:
            raise ValueError(f"type must be one of {VALID_FACT_TYPES}")
        return v


class FactResponse(BaseModel):
    fact_id: str
    topic: str
    content: str
    type: str = "general_info"


# ---------------------------------------------------------------------------
# Deploy / export schemas
# ---------------------------------------------------------------------------

class DeployRequest(BaseModel):
    targets: Optional[List[str]] = None  # None or ["all"] means all configured targets


class DeployTargetResult(BaseModel):
    target: str
    status: str  # "success" or "failed"
    error: Optional[str] = None


class DeployResult(BaseModel):
    results: List[DeployTargetResult]


# ---------------------------------------------------------------------------
# Error schemas
# ---------------------------------------------------------------------------

class ErrorResponse(BaseModel):
    detail: str
    code: str
