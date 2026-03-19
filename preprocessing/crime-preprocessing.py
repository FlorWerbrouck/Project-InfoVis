import json

import geopandas as gpd
import pandas as pd

df = pd.read_csv("Crime_Data_from_2020_to_Present.csv")

# --- Inspect empty rows ---
total_rows = len(df)
zero_coord_rows = ((df["LAT"] == -1) | (df["LON"] == 0)).sum()
no_mocode_rows = df["Mocodes"].isna().sum()
print(f"Total rows: {total_rows}")
print(
    f"Rows with -1 latitude or longitude: {zero_coord_rows} ({zero_coord_rows / total_rows:.2%})"
)
print(f"Rows with no MO code: {no_mocode_rows} ({no_mocode_rows / total_rows:.2%})")

# --- Remove zero-coordinate rows ---
df = df[(df["LAT"] != -1) & (df["LON"] != 0)].copy()

# --- Remove rows with no MO code ---
df = df[df["Mocodes"].notna()].copy()

# --- Translate MO codes to descriptions ---
with open("mo_codes.json") as f:
    mo_map = json.load(f)


def translate_mocodes(codes_str):
    if pd.isna(codes_str):
        return None
    codes = str(codes_str).split()
    return "; ".join(mo_map.get(c, c) for c in codes)


df["MO_descriptions"] = df["Mocodes"].apply(translate_mocodes)

df.to_csv("Crime_Data_from_2020_to_Present_processed.csv", index=False)
