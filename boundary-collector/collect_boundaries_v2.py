#!/usr/bin/env python3
"""
Ontario Municipal Boundary Collector for LocalSeat (v2 - fixed)
"""

import json
import os
import sys
import time
import logging
from datetime import datetime
from pathlib import Path

try:
    import requests
except ImportError:
    print("Installing requests...")
    os.system("pip install requests")
    import requests

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "output"
MUNI_DIR = OUTPUT_DIR / "municipalities"
WARD_DIR = OUTPUT_DIR / "wards"
COMBINED_DIR = OUTPUT_DIR / "combined"

for d in [MUNI_DIR, WARD_DIR, COMBINED_DIR]:
    d.mkdir(parents=True, exist_ok=True)

RATE_LIMIT_DELAY = 1.0

# ============================================================
# SOURCE 1: Ontario GeoHub
# ============================================================

GEOHUB_URL = "https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open03/MapServer/14"

def fetch_geohub():
    log.info("=== SOURCE 1: Ontario GeoHub Municipal Boundaries ===")
    output_file = MUNI_DIR / "ontario_municipal_boundaries.geojson"
    if output_file.exists():
        log.info(f"  Already downloaded: {output_file}")
        with open(output_file) as f:
            return json.load(f)

    all_features = []
    offset = 0

    while True:
        params = {
            "where": "OFFICIAL_NAME IS NOT NULL",
            "outFields": "OFFICIAL_NAME,MUNICIPAL_TYPE,UPPER_TIER_NAME",
            "outSR": "4326",
            "f": "geojson",
            "resultOffset": offset,
            "resultRecordCount": 50,
            "returnGeometry": "true",
        }
        try:
            log.info(f"  Fetching offset={offset}...")
            resp = requests.get(f"{GEOHUB_URL}/query", params=params, timeout=120,
                                headers={"User-Agent": "LocalSeat-BoundaryCollector/1.0"})
            if resp.status_code != 200:
                log.warning(f"  GeoHub returned {resp.status_code}, trying alternate URL...")
                # Try the GeoHub direct URL
                alt_url = "https://geohub.lio.gov.on.ca/api/v3/datasets/64fb702e16204c3e88b528d9759f1174_0/downloads/data?format=geojson&spatialRefId=4326"
                resp2 = requests.get(alt_url, timeout=120, headers={"User-Agent": "LocalSeat-BoundaryCollector/1.0"})
                if resp2.status_code == 200:
                    data = resp2.json()
                    all_features = data.get("features", [])
                    log.info(f"  Got {len(all_features)} features from alternate URL")
                else:
                    log.error(f"  Alternate URL also failed: {resp2.status_code}")
                break

            data = resp.json()
            features = data.get("features", [])
            if not features:
                break
            all_features.extend(features)
            log.info(f"  Got {len(features)} features (total: {len(all_features)})")
            if len(features) < 50:
                break
            offset += 50
            time.sleep(RATE_LIMIT_DELAY)
        except Exception as e:
            log.error(f"  GeoHub error: {e}")
            break

    if all_features:
        geojson = {"type": "FeatureCollection", "features": all_features}
        with open(output_file, 'w') as f:
            json.dump(geojson, f)
        log.info(f"  Saved {len(all_features)} municipal boundaries")
    else:
        log.warning("  Could not retrieve GeoHub data - you can download manually from:")
        log.warning("  https://geohub.lio.gov.on.ca/datasets/municipal-boundary-lower-and-single-tier")
        log.warning("  Download the GeoJSON and save it as:")
        log.warning(f"  {output_file}")
        geojson = None

    return geojson


# ============================================================
# SOURCE 2: Represent API
# ============================================================

REPRESENT_BASE = "https://represent.opennorth.ca"

REPRESENT_SETS = [
    "ajax-wards", "barrie-wards", "brampton-wards", "brantford-wards",
    "burlington-wards", "cambridge-wards", "chatham-kent-wards",
    "clarington-wards", "greater-sudbury-wards", "guelph-wards",
    "haldimand-county-wards", "hamilton-wards", "kawartha-lakes-wards",
    "kingston-wards", "kitchener-wards", "london-wards", "markham-wards",
    "mississauga-wards", "newmarket-wards", "norfolk-county-wards",
    "north-bay-wards", "oakville-wards", "oshawa-wards", "ottawa-wards",
    "peterborough-wards", "pickering-wards", "prince-edward-county-wards",
    "richmond-hill-wards", "sarnia-wards", "sault-ste-marie-wards",
    "st-catharines-wards", "thunder-bay-wards", "toronto-wards-2018",
    "vaughan-wards", "waterloo-wards", "welland-wards", "whitby-wards",
    "windsor-wards",
]

def fetch_represent():
    log.info("=== SOURCE 2: Represent API Ward Boundaries ===")
    results = {}

    for ward_set in REPRESENT_SETS:
        output_file = WARD_DIR / f"represent_{ward_set}.geojson"
        if output_file.exists():
            log.info(f"  Already downloaded: {ward_set}")
            with open(output_file) as f:
                results[ward_set] = json.load(f)
            continue

        try:
            # Step 1: Get boundary set metadata
            meta_resp = requests.get(f"{REPRESENT_BASE}/boundary-sets/{ward_set}/",
                                     params={"format": "json"}, timeout=30)
            if meta_resp.status_code == 404:
                log.warning(f"  {ward_set}: not found (404), skipping")
                continue
            meta_resp.raise_for_status()
            meta = meta_resp.json()
            muni_name = meta.get("domain", "").replace(", ON", "").strip()

            time.sleep(RATE_LIMIT_DELAY)

            # Step 2: Get ward list with names
            list_resp = requests.get(f"{REPRESENT_BASE}/boundaries/{ward_set}/",
                                      params={"format": "json", "limit": 100}, timeout=30)
            list_resp.raise_for_status()
            ward_list = list_resp.json().get("objects", [])

            time.sleep(RATE_LIMIT_DELAY)

            # Step 3: Get each ward's shape individually
            features = []
            for ward_info in ward_list:
                ward_url = ward_info.get("url", "")
                ward_name = ward_info.get("name", "")
                ward_id = ward_info.get("external_id", "")

                try:
                    shape_resp = requests.get(
                        f"{REPRESENT_BASE}{ward_url}simple_shape",
                        params={"format": "json"}, timeout=30
                    )
                    shape_resp.raise_for_status()
                    shape_data = shape_resp.json()

                    # The shape endpoint returns a geometry object directly
                    geometry = shape_data
                    if "type" in geometry and geometry["type"] in ("Polygon", "MultiPolygon"):
                        features.append({
                            "type": "Feature",
                            "geometry": geometry,
                            "properties": {
                                "name": ward_name,
                                "ward_number": ward_id,
                                "municipality": muni_name,
                                "source": "represent_api",
                            }
                        })
                    elif "coordinates" in geometry:
                        features.append({
                            "type": "Feature",
                            "geometry": geometry,
                            "properties": {
                                "name": ward_name,
                                "ward_number": ward_id,
                                "municipality": muni_name,
                                "source": "represent_api",
                            }
                        })

                    time.sleep(0.3)  # gentle rate limiting per ward
                except Exception as we:
                    log.warning(f"    Could not get shape for {ward_name}: {we}")

            geojson = {
                "type": "FeatureCollection",
                "features": features,
                "metadata": {
                    "source": "Represent API",
                    "boundary_set": ward_set,
                    "municipality": muni_name,
                    "last_updated": meta.get("last_updated", ""),
                    "source_url": meta.get("source_url", ""),
                    "fetched_at": datetime.now().isoformat(),
                    "ward_count": len(features),
                }
            }

            with open(output_file, 'w') as f:
                json.dump(geojson, f)

            log.info(f"  {ward_set}: {len(features)} wards from {muni_name}")
            results[ward_set] = geojson
            time.sleep(RATE_LIMIT_DELAY)

        except Exception as e:
            log.error(f"  Error fetching {ward_set}: {e}")

    log.info(f"  Total Represent sets: {len(results)}")
    return results


# ============================================================
# SOURCE 3: ArcGIS Portals
# ============================================================

ARCGIS_TARGETS = {
    # Upper-tier portals
    "Durham Region": {"hub": "https://opendata.durham.ca", "munis": ["Brock", "Scugog", "Uxbridge"]},
    "Halton Region": {"hub": "https://www.halton.ca", "munis": ["Halton Hills"]},
    "Peel Region": {"hub": "https://opendata.peelregion.ca", "munis": ["Caledon"]},
    "York Region": {"hub": "https://open.york.ca", "munis": ["Georgina", "King", "Whitchurch-Stouffville"]},
    "Waterloo Region": {"hub": "https://open-data.regionofwaterloo.ca", "munis": ["Wellesley", "Wilmot", "Woolwich"]},
    "Niagara Region": {"hub": "https://niagaraopendata.ca", "munis": ["Fort Erie", "Lincoln", "Pelham", "Port Colborne", "Thorold", "Wainfleet", "West Lincoln"]},
    "Simcoe County": {"hub": "https://data-simcoe.opendata.arcgis.com", "munis": ["Adjala-Tosorontio", "Bradford West Gwillimbury", "Clearview", "Essa", "Innisfil", "Midland", "New Tecumseth", "Oro-Medonte", "Ramara", "Severn", "Springwater", "Tay", "Tiny"]},
    "Grey County": {"hub": "https://opendata.grey.ca", "munis": ["Blue Mountains", "Chatsworth", "Georgian Bluffs", "Grey Highlands", "Meaford", "Southgate", "West Grey"]},
    "Bruce County": {"hub": "https://opendata.brucecounty.on.ca", "munis": ["Arran-Elderslie", "Brockton", "Huron-Kinloss", "Kincardine", "South Bruce", "South Bruce Peninsula"]},
    "Huron County": {"hub": "https://data-huron.opendata.arcgis.com", "munis": ["Ashfield-Colborne-Wawanosh", "Bluewater", "Central Huron", "Howick", "Huron East", "North Huron", "South Huron"]},
    "Wellington County": {"hub": "https://www.wellington.ca", "munis": ["Centre Wellington", "Erin", "Guelph/Eramosa", "Mapleton", "Minto", "Wellington North"]},
    "Oxford County": {"hub": "https://www.oxfordcounty.ca", "munis": ["East Zorra-Tavistock", "Norwich", "Zorra"]},
    "Perth County": {"hub": "https://www.perthcounty.ca", "munis": ["North Perth", "Perth East", "West Perth"]},
    "Middlesex County": {"hub": "https://data.middlesex.ca", "munis": ["Middlesex Centre", "North Middlesex", "Thames Centre"]},
    "Lambton County": {"hub": "https://www.lambtononline.ca", "munis": ["Lambton Shores", "Plympton-Wyoming", "St. Clair", "Warwick"]},
    "Essex County": {"hub": "https://data.countyofessex.ca", "munis": ["Amherstburg", "Essex", "Lakeshore", "Tecumseh"]},
    "Elgin County": {"hub": "https://www.elgincounty.ca", "munis": ["Bayham", "Central Elgin", "Malahide"]},
    "Northumberland County": {"hub": "https://northumberland.opendata.arcgis.com", "munis": ["Alnwick/Haldimand", "Brighton", "Cramahe", "Hamilton Township", "Port Hope", "Trent Hills"]},
    "Hastings County": {"hub": "https://hastingscounty.com", "munis": ["Centre Hastings", "Hastings Highlands", "Marmora and Lake", "Stirling-Rawdon", "Tyendinaga"]},
    "Frontenac County": {"hub": "https://opendata.frontenacmaps.ca", "munis": ["Central Frontenac", "Frontenac Islands", "North Frontenac", "South Frontenac"]},
    "Renfrew County": {"hub": "https://opendata.renfrewcounty.ca", "munis": ["Bonnechere Valley", "Greater Madawaska", "Laurentian Valley", "Madawaska Valley", "McNab/Braeside", "Petawawa", "Whitewater Region"]},
    "Lanark County": {"hub": "https://opendata.lanarkcounty.ca", "munis": ["Beckwith", "Drummond/North Elmsley", "Lanark Highlands", "Mississippi Mills", "Montague", "Tay Valley"]},

    # Own portals
    "Quinte West": {"hub": "https://geodata-quintewest.opendata.arcgis.com", "munis": ["Quinte West"]},
    "Belleville": {"hub": "https://opendata-bellevillegis.hub.arcgis.com", "munis": ["Belleville"]},
    "Timmins": {"hub": "https://opendata.timmins.ca", "munis": ["Timmins"]},
    "Innisfil": {"hub": "https://data.innisfil.ca", "munis": ["Innisfil"]},
    "Milton": {"hub": "https://data.milton.ca", "munis": ["Milton"]},
    "Cobourg": {"hub": "https://opendata.cobourg.ca", "munis": ["Cobourg"]},
    "Pembroke": {"hub": "https://opendata.pembroke.ca", "munis": ["Pembroke"]},
    "LaSalle": {"hub": "https://opendata.lasalle.ca", "munis": ["LaSalle"]},
    "Saugeen Shores": {"hub": "https://data.saugeenshores.ca", "munis": ["Saugeen Shores"]},
    "Strathroy-Caradoc": {"hub": "https://data.strathroy-caradoc.ca", "munis": ["Strathroy-Caradoc"]},
}


def search_arcgis_hub(hub_url, keyword="ward"):
    """Search an ArcGIS Hub for ward boundary datasets."""
    search_endpoints = [
        f"{hub_url}/api/v3/datasets?filter%5Bkeyword%5D={keyword}&page%5Bsize%5D=10",
        f"{hub_url}/api/search/v1?q={keyword}&num=10",
    ]

    for url in search_endpoints:
        try:
            resp = requests.get(url, timeout=15,
                                headers={"Accept": "application/json", "User-Agent": "LocalSeat/1.0"})
            if resp.status_code == 200:
                data = resp.json()
                datasets = data.get("data", data.get("results", []))
                for ds in datasets:
                    attrs = ds.get("attributes", ds)
                    name = (attrs.get("name", "") or attrs.get("title", "") or "").lower()
                    if "ward" in name and "reward" not in name:
                        return {
                            "found": True,
                            "name": attrs.get("name", attrs.get("title")),
                            "url": attrs.get("url", attrs.get("landingPage", "")),
                            "id": ds.get("id", ""),
                        }
        except Exception:
            pass
    return {"found": False}


def try_download_arcgis_geojson(dataset_url):
    """Try to download GeoJSON from an ArcGIS dataset URL."""
    # ArcGIS Hub datasets often have a GeoJSON download endpoint
    # Pattern: {hub}/api/download/v1/items/{id}/geojson?layers=0
    try:
        # If it's a feature service URL, query it directly
        if "/FeatureServer/" in dataset_url or "/MapServer/" in dataset_url:
            query_url = f"{dataset_url}/query"
            params = {"where": "1=1", "outFields": "*", "outSR": "4326", "f": "geojson", "returnGeometry": "true"}
            resp = requests.get(query_url, params=params, timeout=30)
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass
    return None


def fetch_arcgis():
    log.info("=== SOURCE 3: ArcGIS Portal Ward Boundaries ===")
    results = {}

    for name, config in ARCGIS_TARGETS.items():
        hub_url = config["hub"]
        log.info(f"  Scanning {name} ({hub_url})...")

        search_result = search_arcgis_hub(hub_url)

        if search_result.get("found"):
            log.info(f"    FOUND: {search_result['name']}")

            # Try to download the actual data
            ds_url = search_result.get("url", "")
            geojson = None
            if ds_url:
                geojson = try_download_arcgis_geojson(ds_url)

            results[name] = {
                "status": "FOUND",
                "dataset_name": search_result["name"],
                "dataset_url": ds_url,
                "municipalities": config["munis"],
                "has_geojson": geojson is not None,
            }

            if geojson and geojson.get("features"):
                output_file = WARD_DIR / f"arcgis_{name.lower().replace(' ', '_')}_wards.geojson"
                with open(output_file, 'w') as f:
                    json.dump(geojson, f)
                log.info(f"    Downloaded {len(geojson['features'])} features")
        else:
            log.info(f"    No ward dataset found via API search")
            results[name] = {
                "status": "NOT_FOUND_VIA_API",
                "portal_url": hub_url,
                "municipalities": config["munis"],
                "note": "Ward data may exist - check portal manually",
            }

        time.sleep(RATE_LIMIT_DELAY)

    found = sum(1 for r in results.values() if r["status"] == "FOUND")
    log.info(f"  Found ward datasets on {found} of {len(results)} portals")
    return results


# ============================================================
# COMBINE AND OUTPUT
# ============================================================

AT_LARGE = [
    "Niagara Falls", "St. Thomas", "Stratford", "Orillia", "Woodstock",
    "Kenora", "Temiskaming Shores", "Elliot Lake", "Hawkesbury", "Dryden",
    "Aurora", "North Dumfries", "Grimsby", "Niagara-on-the-Lake",
    "Collingwood", "Penetanguishene", "Wasaga Beach",
    "Blandford-Blenheim", "Ingersoll", "South-West Oxford", "Tillsonburg",
    "Adelaide-Metcalfe", "Lucan Biddulph", "Southwest Middlesex",
    "Brooke-Alvinston", "Dawn-Euphemia", "Enniskillen", "Oil Springs",
    "Petrolia", "Point Edward", "Aylmer", "Dutton/Dunwich", "Southwold",
    "West Elgin", "Kingsville", "Leamington", "Pelee",
    "Goderich", "Morris-Turnberry", "Perth South", "Puslinch",
    "Amaranth", "East Garafraxa", "Grand Valley", "Melancthon", "Mono",
    "Orangeville", "Shelburne", "Northern Bruce Peninsula",
    "Hanover", "Owen Sound", "Bancroft", "Carlow/Mayo", "Deseronto",
    "Faraday", "Limerick", "Madoc", "Tudor and Cashel", "Tweed", "Wollaston",
    "Athens", "Front of Yonge", "Merrickville-Wolford", "Prescott", "Westport",
    "Carleton Place", "Perth", "Cobourg",
    "Admaston/Bromley", "Arnprior", "Deep River", "Renfrew",
    "Casselman", "East Hawkesbury",
]

def combine_all(geohub, represent, arcgis):
    log.info("=== COMBINING ALL DATA ===")

    combined = {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "version": "2.0",
        },
        "municipalities": [],
    }

    # Municipal boundaries lookup
    muni_geom = {}
    if geohub:
        for f in geohub.get("features", []):
            name = (f.get("properties", {}).get("OFFICIAL_NAME") or "").strip()
            if name:
                muni_geom[name] = f.get("geometry")

    # At-large municipalities
    for name in AT_LARGE:
        combined["municipalities"].append({
            "name": name,
            "election_type": "at_large",
            "boundary": muni_geom.get(name),
            "wards": [],
        })

    # Represent API municipalities
    for ward_set, data in (represent or {}).items():
        meta = data.get("metadata", {})
        muni_name = meta.get("municipality", ward_set)
        wards = []
        for f in data.get("features", []):
            p = f.get("properties", {})
            wards.append({
                "name": p.get("name", ""),
                "ward_number": p.get("ward_number", p.get("external_id", "")),
                "geometry": f.get("geometry"),
            })
        combined["municipalities"].append({
            "name": muni_name,
            "election_type": "ward",
            "boundary": muni_geom.get(muni_name),
            "wards": wards,
            "ward_source": "represent_api",
        })

    # ArcGIS portal municipalities (placeholder entries for those found)
    added_names = {m["name"] for m in combined["municipalities"]}
    for region, result in (arcgis or {}).items():
        for muni in result.get("municipalities", []):
            if muni not in added_names:
                combined["municipalities"].append({
                    "name": muni,
                    "election_type": "ward",
                    "boundary": muni_geom.get(muni),
                    "wards": [],
                    "ward_source": "arcgis_portal" if result["status"] == "FOUND" else "pending",
                    "portal_url": result.get("portal_url", result.get("dataset_url", "")),
                })
                added_names.add(muni)

    # Stats
    total = len(combined["municipalities"])
    al = sum(1 for m in combined["municipalities"] if m["election_type"] == "at_large")
    with_wards = sum(1 for m in combined["municipalities"] if len(m.get("wards", [])) > 0)
    with_boundary = sum(1 for m in combined["municipalities"] if m.get("boundary"))

    combined["metadata"]["stats"] = {
        "total": total,
        "at_large": al,
        "ward_based_with_data": with_wards,
        "with_municipal_boundary": with_boundary,
    }

    log.info(f"  Total: {total} | At-large: {al} | With ward data: {with_wards} | With boundary: {with_boundary}")
    return combined


def generate_sql(combined):
    log.info("=== GENERATING SQL SEED ===")

    lines = [
        "-- LocalSeat Boundary Seed Data",
        f"-- Generated: {datetime.now().isoformat()}",
        "",
        "CREATE EXTENSION IF NOT EXISTS postgis;",
        "",
        "CREATE TABLE IF NOT EXISTS municipalities (",
        "  id SERIAL PRIMARY KEY,",
        "  name VARCHAR(255) NOT NULL UNIQUE,",
        "  election_type VARCHAR(20) NOT NULL,",
        "  boundary GEOMETRY(MultiPolygon, 4326),",
        "  created_at TIMESTAMP DEFAULT NOW()",
        ");",
        "",
        "CREATE TABLE IF NOT EXISTS wards (",
        "  id SERIAL PRIMARY KEY,",
        "  municipality_id INTEGER REFERENCES municipalities(id),",
        "  name VARCHAR(255) NOT NULL,",
        "  ward_number VARCHAR(10),",
        "  boundary GEOMETRY(MultiPolygon, 4326),",
        "  created_at TIMESTAMP DEFAULT NOW()",
        ");",
        "",
        "CREATE INDEX IF NOT EXISTS idx_muni_name ON municipalities(name);",
        "CREATE INDEX IF NOT EXISTS idx_ward_muni ON wards(municipality_id);",
        "CREATE INDEX IF NOT EXISTS idx_muni_geo ON municipalities USING GIST(boundary);",
        "CREATE INDEX IF NOT EXISTS idx_ward_geo ON wards USING GIST(boundary);",
        "",
        "BEGIN;",
    ]

    mc = 0
    wc = 0

    for muni in combined.get("municipalities", []):
        name = muni["name"].replace("'", "''")
        etype = muni["election_type"]

        geom = muni.get("boundary")
        if geom:
            gs = f"ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON('{json.dumps(geom)}'), 4326))"
        else:
            gs = "NULL"

        lines.append(f"INSERT INTO municipalities (name, election_type, boundary) VALUES ('{name}', '{etype}', {gs}) ON CONFLICT (name) DO NOTHING;")
        mc += 1

        for ward in muni.get("wards", []):
            wn = (ward.get("name") or "").replace("'", "''")
            wnum = (ward.get("ward_number") or "").replace("'", "''")
            wg = ward.get("geometry")
            if wg:
                wgs = f"ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON('{json.dumps(wg)}'), 4326))"
            else:
                wgs = "NULL"
            lines.append(f"INSERT INTO wards (municipality_id, name, ward_number, boundary) VALUES ((SELECT id FROM municipalities WHERE name='{name}'), '{wn}', '{wnum}', {wgs});")
            wc += 1

    lines.extend(["", "COMMIT;", f"-- {mc} municipalities, {wc} wards"])

    sql_file = COMBINED_DIR / "seed_boundaries.sql"
    with open(sql_file, 'w') as f:
        f.write("\n".join(lines))

    log.info(f"  SQL seed: {mc} municipalities, {wc} wards -> {sql_file}")
    return sql_file


def main():
    log.info("=" * 60)
    log.info("LocalSeat Boundary Collector v2")
    log.info("=" * 60)

    geohub = fetch_geohub()
    represent = fetch_represent()
    arcgis = fetch_arcgis()

    combined = combine_all(geohub, represent, arcgis)

    # Save combined JSON
    cf = COMBINED_DIR / "localseat_boundaries.json"
    with open(cf, 'w') as f:
        json.dump(combined, f, indent=2, default=str)
    log.info(f"Combined data: {cf}")

    # Save ArcGIS scan
    af = COMBINED_DIR / "arcgis_scan.json"
    with open(af, 'w') as f:
        json.dump(arcgis, f, indent=2, default=str)

    # Generate SQL
    sql = generate_sql(combined)

    log.info("")
    log.info("=" * 60)
    log.info("DONE")
    log.info("=" * 60)
    log.info(f"Output folder: {COMBINED_DIR}")
    for k, v in combined["metadata"]["stats"].items():
        log.info(f"  {k}: {v}")

    # Summary of individual ward files
    ward_files = list(WARD_DIR.glob("*.geojson"))
    total_wards = 0
    for wf in ward_files:
        with open(wf) as f:
            d = json.load(f)
            count = len(d.get("features", []))
            total_wards += count
    log.info(f"  Individual ward files: {len(ward_files)}")
    log.info(f"  Total ward polygons downloaded: {total_wards}")


if __name__ == "__main__":
    main()
