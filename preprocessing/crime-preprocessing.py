import geopandas as gpd
import pandas as pd


def add_state_county(df):
    states = gpd.read_file(
        "https://www2.census.gov/geo/tiger/TIGER2023/STATE/tl_2023_us_state.zip"
    )
    counties = gpd.read_file(
        "https://www2.census.gov/geo/tiger/TIGER2023/COUNTY/tl_2023_us_county.zip"
    )

    gdf = gpd.GeoDataFrame(
        df, geometry=gpd.points_from_xy(df["LON"], df["LAT"]), crs="EPSG:4326"
    )

    states = states[["NAME", "STUSPS", "geometry"]].rename(
        columns={"NAME": "state", "STUSPS": "state_abbr"}
    )
    gdf = gpd.sjoin(gdf, states, how="left", predicate="within").drop(
        columns="index_right"
    )

    counties = counties[["NAME", "NAMELSAD", "geometry"]].rename(
        columns={"NAME": "county", "NAMELSAD": "county_full"}
    )
    gdf = gpd.sjoin(gdf, counties, how="left", predicate="within").drop(
        columns="index_right"
    )

    return df.join(gdf[["state", "state_abbr", "county", "county_full"]], how="left")


df = pd.read_csv("Crime_Data_from_2020_to_Present.csv")

# --- Inspect zero-coordinate rows ---
total_rows = len(df)
zero_coord_rows = ((df["LAT"] == -1) | (df["LON"] == 0)).sum()
print(f"Total rows: {total_rows}")
print(
    f"Rows with -1 latitude or longitude: {zero_coord_rows} ({zero_coord_rows / total_rows:.2%})"
)

# --- Remove zero-coordinate rows ---
df = df[(df["LAT"] != -1) & (df["LON"] != 0)].copy()

# --- Add state & county to dataset
df = add_state_county(df)

print(df[["LAT", "LON", "state", "state_abbr", "county", "county_full"]].head(10))

df.to_csv("Crime_Data_from_2020_to_Present_processed.csv", index=False)
