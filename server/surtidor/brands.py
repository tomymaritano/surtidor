"""Brand flags published by Secretaría de Energía, normalized for the map."""

from __future__ import annotations

import re

BRANDS: dict[str, tuple[str, str, str]] = {
    # key -> (label, monogram, color)
    "YPF": ("YPF", "YP", "#005CAB"),
    "SHELL": ("Shell", "SH", "#E30613"),
    "AXION": ("Axion", "AX", "#1F7A45"),
    "PUMA": ("Puma", "PU", "#F15A22"),
    "GULF": ("Gulf", "GU", "#F07A00"),
    "REFINOR": ("Refinor", "RE", "#B42318"),
    "DAPSA": ("Dapsa", "DA", "#1D4E89"),
    "VOY": ("Voy", "VO", "#6941C6"),
    "WICO": ("Wico", "WI", "#475467"),
    "BLANCA": ("Blanca", "BL", "#98A2B3"),
}

_SMALL = {"de", "del", "la", "las", "los", "y", "e"}


def brand_key(raw: str) -> str:
    text = (raw or "").upper()
    for key in ("YPF", "SHELL", "AXION", "PUMA", "GULF", "REFINOR", "DAPSA", "VOY", "WICO"):
        if key in text:
            return key
    return "BLANCA"


def brand_view(key: str) -> dict[str, str]:
    label, code, color = BRANDS.get(key, ("Estación", "ES", "#475467"))
    return {"brand": label, "brand_code": code, "brand_color": color}


def pretty(value: str) -> str:
    words: list[str] = []
    for index, word in enumerate(value.split()):
        lower = word.lower()
        if index and lower in _SMALL:
            words.append(lower)
        else:
            words.append(lower.capitalize())
    return " ".join(words)


def street_label(address: str) -> str:
    cleaned = pretty(address)
    cleaned = re.sub(
        r"^(Av\.|Avda\.|Avenida|Calle|Diagonal|Diag\.|Ruta)\s+",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"\s+\d[\d\s/]*$", "", cleaned).strip(" ,")
    return cleaned or pretty(address)
