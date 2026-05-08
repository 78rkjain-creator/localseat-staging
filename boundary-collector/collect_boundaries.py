#!/usr/bin/env python3
"""
Ontario Municipal Boundary Collector for LocalSeat
===================================================
Downloads ward and municipal boundary data from:
1. Ontario GeoHub - municipal outer boundaries (all 444 municipalities)
2. Represent API - ward boundaries (~40 Ontario municipalities)
3. ArcGIS Hub/REST portals - ward boundaries (~113 municipalities via upper-tier + own portals)
4. Normalizes everything into a consistent schema
5. Outputs combined seed JSON + SQL seed file for PostgreSQL

Usage: python3 collect_boundaries.py
Output: output/combined/localseat_boundaries.json
        output/combined/seed_boundaries.sql
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
    os.system("pip install requests --break-system-packages -q")
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

RATE_LIMIT_DELAY = 0.5  # seconds between API calls

# ============================================================
# MUNICIPALITY REFERENCE DATA
# ============================================================

# Election type for all municipalities we're tracking
# Format: { "Municipality Name": {"election_type": "ward"|"at_large"|"both", "upper_tier": "", "council_size": N} }
# This would ideally come from the AMO spreadsheet, but we're embedding the known data

AT_LARGE_MUNICIPALITIES = [
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
    "Carleton Place", "Perth",
    "Admaston/Bromley", "Arnprior", "Brudenell, Lyndoch and Raglan",
    "Deep River", "Head, Clara and Maria", "Horton",
    "Killaloe, Hagarty and Richards", "Laurentian Hills",
    "North Algona Wilberforce", "Renfrew",
    "Cobourg",
    "Casselman", "East Hawkesbury",
    # Many small northern municipalities...
    "Archipelago", "Armour", "Burk's Falls", "Callander", "Carling",
    "Kearney", "Machar", "Magnetawan", "McDougall", "McKellar",
    "McMurrich/Monteith", "Perry", "Ryerson", "South River", "Strong",
    "Sundridge", "Whitestone", "Bonfield", "Calvin", "Chisholm",
    "Mattawa", "Mattawan", "Papineau-Cameron", "South Algonquin",
    "Temagami", "Armstrong", "Brethour", "Casey", "Chamberlain",
    "Charlton and Dack", "Cobalt", "Coleman", "Englehart", "Evanturel",
    "Gauthier", "Harley", "Harris", "Hilliard", "Hudson", "James",
    "Kerns", "Kirkland Lake", "Larder Lake", "Latchford", "Matachewan",
    "McGarry", "Thornloe", "Fauquier-Strickland", "Hearst", "Hornepayne",
    "Iroquois Falls", "Kapuskasing", "Mattice-Val Côté", "Moosonee",
    "Moonbeam", "Opasatika", "Smooth Rock Falls", "Val Rita-Harty",
    "Baldwin", "Chapleau", "Espanola", "French River", "Markstay-Warren",
    "Nairn and Hyman", "Sables-Spanish Rivers", "St.-Charles",
    "Assiginack", "Billings", "Burpee and Mills", "Cockburn Island",
    "Gordon/Barrie Island", "Gore Bay", "Tehkummah",
    "Blind River", "Bruce Mines", "Dubreuilville", "Hilton", "Hilton Beach",
    "Huron Shores", "Johnson", "Jocelyn", "Laird",
    "Macdonald, Meredith and Aberdeen Additional", "Plummer Additional",
    "Prince", "Spanish", "St. Joseph", "Tarbutt and Tarbutt Additional",
    "Thessalon", "The North Shore", "Wawa", "White River",
    "Conmee", "Dorion", "Gillies", "Manitouwadge", "Marathon",
    "Neebing", "Nipigon", "O'Connor", "Oliver Paipoonge", "Red Rock",
    "Schreiber", "Shuniah", "Terrace Bay",
    "Alberton", "Atikokan", "Chapple", "Dawson", "Emo", "La Vallee",
    "Lake of the Woods", "Morley", "Rainy River",
    "Ear Falls", "Ignace", "Machin", "Pickle Lake", "Red Lake",
    "Sioux Lookout", "Sioux Narrows-Nestor Falls",
]


# ============================================================
# SOURCE 1: Ontario GeoHub - Municipal Boundaries
# ============================================================

GEOHUB_REST_URL = "https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open03/MapServer/14"

def fetch_geohub_municipalities():
    """Download municipal boundaries from Ontario GeoHub ArcGIS REST service."""
    log.info("=== SOURCE 1: Ontario GeoHub Municipal Boundaries ===")
    
    output_file = MUNI_DIR / "ontario_municipal_boundaries.geojson"
    if output_file.exists():
        log.info(f"Already downloaded: {output_file}")
        with open(output_file) as f:
            return json.load(f)
    
    # Query the ArcGIS REST service for all features as GeoJSON
    # We need to paginate because ArcGIS limits results
    all_features = []
    offset = 0
    batch_size = 100
    
    while True:
        params = {
            "where": "1=1",
            "outFields": "OFFICIAL_NAME,MUNICIPA_1,MUNICIPAL_TYPE",
            "outSR": "4326",
            "f": "geojson",
            "resultOffset": offset,
            "resultRecordCount": batch_size,
            "returnGeometry": "true",
        }
        
        try:
            log.info(f"  Fetching municipalities offset={offset}...")
            resp = requests.get(f"{GEOHUB_REST_URL}/query", params=params, timeout=60)
            resp.raise_for_status()
            data = resp.json()
            
            features = data.get("features", [])
            if not features:
                break
            
            all_features.extend(features)
            log.info(f"  Got {len(features)} features (total: {len(all_features)})")
            
            if len(features) < batch_size:
                break
            
            offset += batch_size
            time.sleep(RATE_LIMIT_DELAY)
            
        except Exception as e:
            log.error(f"  Error fetching GeoHub data: {e}")
            break
    
    if all_features:
        geojson = {
            "type": "FeatureCollection",
            "features": all_features,
            "metadata": {
                "source": "Ontario GeoHub - Municipal Boundary Lower and Single Tier",
                "url": GEOHUB_REST_URL,
                "fetched_at": datetime.now().isoformat(),
                "count": len(all_features),
            }
        }
        with open(output_file, 'w') as f:
            json.dump(geojson, f)
        log.info(f"  Saved {len(all_features)} municipal boundaries to {output_file}")
        return geojson
    else:
        log.warning("  No features retrieved from GeoHub")
        return None


# ============================================================
# SOURCE 2: Represent API - Ward Boundaries
# ============================================================

REPRESENT_BASE = "https://represent.opennorth.ca"

# Known Ontario ward boundary sets in Represent API
REPRESENT_ONTARIO_SETS = [
    "ajax-wards", "barrie-wards", "brampton-wards", "brantford-wards",
    "burlington-wards", "cambridge-wards", "chatham-kent-wards",
    "clarington-wards", "cornwall-wards", "east-gwillimbury-wards",
    "greater-sudbury-wards", "guelph-wards", "haldimand-county-wards",
    "hamilton-wards", "kawartha-lakes-wards", "kingston-wards",
    "kitchener-wards", "london-wards", "markham-wards",
    "mississauga-wards", "newmarket-wards", "niagara-falls-wards",
    "norfolk-county-wards", "north-bay-wards", "oakville-wards",
    "oshawa-wards", "ottawa-wards", "peterborough-wards",
    "pickering-wards", "prince-edward-county-wards",
    "richmond-hill-wards", "sarnia-wards", "sault-ste-marie-wards",
    "st-catharines-wards", "thunder-bay-wards",
    "toronto-wards-2018", "vaughan-wards", "waterloo-wards",
    "welland-wards", "whitby-wards", "windsor-wards",
]

def fetch_represent_wards():
    """Download ward boundaries from the Represent API for all known Ontario sets."""
    log.info("=== SOURCE 2: Represent API Ward Boundaries ===")
    
    results = {}
    
    for ward_set in REPRESENT_ONTARIO_SETS:
        output_file = WARD_DIR / f"represent_{ward_set}.geojson"
        
        if output_file.exists():
            log.info(f"  Already downloaded: {ward_set}")
            with open(output_file) as f:
                results[ward_set] = json.load(f)
            continue
        
        try:
            # Get the boundary set metadata first
            meta_url = f"{REPRESENT_BASE}/boundary-sets/{ward_set}/"
            meta_resp = requests.get(meta_url, params={"format": "json"}, timeout=30)
            meta_resp.raise_for_status()
            meta = meta_resp.json()
            
            municipality_name = meta.get("domain", ward_set).replace(", ON", "").strip()
            
            # Get all ward boundaries with simplified shapes
            boundaries_url = f"{REPRESENT_BASE}/boundaries/{ward_set}/simple_shape"
            bound_resp = requests.get(boundaries_url, params={"format": "json"}, timeout=30)
            bound_resp.raise_for_status()
            shape_data = bound_resp.json()
            
            # Also get the ward names/metadata
            list_url = f"{REPRESENT_BASE}/boundaries/{ward_set}/"
            list_resp = requests.get(list_url, params={"format": "json", "limit": 100}, timeout=30)
            list_resp.raise_for_status()
            list_data = list_resp.json()
            
            ward_names = {}
            for obj in list_data.get("objects", []):
                url_slug = obj["url"].rstrip("/").split("/")[-1]
                ward_names[url_slug] = {
                    "name": obj.get("name", ""),
                    "external_id": obj.get("external_id", ""),
                }
            
            # Build GeoJSON with metadata
            if "features" in shape_data:
                for feature in shape_data["features"]:
                    props = feature.get("properties", {})
                    slug = props.get("name", "").lower().replace(" ", "-")
                    if slug in ward_names:
                        props.update(ward_names[slug])
                    props["municipality"] = municipality_name
                    props["source"] = "represent_api"
            
                geojson = {
                    "type": "FeatureCollection",
                    "features": shape_data["features"],
                    "metadata": {
                        "source": "Represent API (represent.opennorth.ca)",
                        "boundary_set": ward_set,
                        "municipality": municipality_name,
                        "last_updated": meta.get("last_updated", ""),
                        "source_url": meta.get("source_url", ""),
                        "fetched_at": datetime.now().isoformat(),
                        "ward_count": len(shape_data["features"]),
                    }
                }
            else:
                # shape_data might be a single geometry collection
                geojson = {
                    "type": "FeatureCollection",
                    "features": [],
                    "metadata": {
                        "source": "Represent API",
                        "boundary_set": ward_set,
                        "municipality": municipality_name,
                        "raw_type": shape_data.get("type", "unknown"),
                        "fetched_at": datetime.now().isoformat(),
                    }
                }
                # If it's a geometry collection, convert to features
                if shape_data.get("type") == "GeometryCollection":
                    for i, geom in enumerate(shape_data.get("geometries", [])):
                        ward_list = list(ward_names.values())
                        props = ward_list[i] if i < len(ward_list) else {"name": f"Ward {i+1}"}
                        props["municipality"] = municipality_name
                        props["source"] = "represent_api"
                        geojson["features"].append({
                            "type": "Feature",
                            "geometry": geom,
                            "properties": props,
                        })
                    geojson["metadata"]["ward_count"] = len(geojson["features"])
            
            with open(output_file, 'w') as f:
                json.dump(geojson, f)
            
            ward_count = geojson["metadata"].get("ward_count", 0)
            log.info(f"  {ward_set}: {ward_count} wards from {municipality_name}")
            results[ward_set] = geojson
            
            time.sleep(RATE_LIMIT_DELAY)
            
        except Exception as e:
            log.error(f"  Error fetching {ward_set}: {e}")
            continue
    
    log.info(f"  Total Represent API sets downloaded: {len(results)}")
    return results


# ============================================================
# SOURCE 3: ArcGIS Hub/REST Portals
# ============================================================

# Upper-tier portals that may contain ward boundary layers for their lower-tier municipalities
# Format: { "region_name": {"url": "...", "municipalities": ["...", ...]} }

ARCGIS_PORTAL_TARGETS = {
    "Durham Region": {
        "search_url": "https://opendata.durham.ca",
        "municipalities": ["Brock", "Scugog", "Uxbridge"],
    },
    "Halton Region": {
        "search_url": "https://www.halton.ca/The-Region/Open-Data",
        "municipalities": ["Halton Hills"],
    },
    "Peel Region": {
        "search_url": "https://opendata.peelregion.ca",
        "municipalities": ["Caledon"],
    },
    "York Region": {
        "search_url": "https://open.york.ca",
        "municipalities": ["Georgina", "King", "Whitchurch-Stouffville"],
    },
    "Waterloo Region": {
        "search_url": "https://open-data.regionofwaterloo.ca",
        "municipalities": ["Wellesley", "Wilmot", "Woolwich"],
    },
    "Niagara Region": {
        "search_url": "https://niagaraopendata.ca",
        "municipalities": ["Fort Erie", "Lincoln", "Pelham", "Port Colborne", "Thorold", "Wainfleet", "West Lincoln"],
    },
    "Simcoe County": {
        "search_url": "https://data-simcoe.opendata.arcgis.com",
        "hub_api": "https://data-simcoe.opendata.arcgis.com/api/v3/datasets",
        "municipalities": ["Adjala-Tosorontio", "Bradford West Gwillimbury", "Clearview", "Essa", "Innisfil", "Midland", "New Tecumseth", "Oro-Medonte", "Ramara", "Severn", "Springwater", "Tay", "Tiny"],
    },
    "Grey County": {
        "search_url": "https://opendata.grey.ca",
        "municipalities": ["Blue Mountains", "Chatsworth", "Georgian Bluffs", "Grey Highlands", "Meaford", "Southgate", "West Grey"],
    },
    "Bruce County": {
        "search_url": "https://opendata.brucecounty.on.ca",
        "municipalities": ["Arran-Elderslie", "Brockton", "Huron-Kinloss", "Kincardine", "South Bruce", "South Bruce Peninsula"],
    },
    "Huron County": {
        "search_url": "https://data-huron.opendata.arcgis.com",
        "municipalities": ["Ashfield-Colborne-Wawanosh", "Bluewater", "Central Huron", "Howick", "Huron East", "North Huron", "South Huron"],
    },
    "Wellington County": {
        "search_url": "https://www.wellington.ca/en/resident-services/opendata.aspx",
        "municipalities": ["Centre Wellington", "Erin", "Guelph/Eramosa", "Mapleton", "Minto", "Wellington North"],
    },
    "Oxford County": {
        "search_url": "https://www.oxfordcounty.ca/open-data",
        "municipalities": ["East Zorra-Tavistock", "Norwich", "Zorra"],
    },
    "Perth County": {
        "search_url": "https://www.perthcounty.ca/en/county-government/open-data.aspx",
        "municipalities": ["North Perth", "Perth East", "West Perth"],
    },
    "Middlesex County": {
        "search_url": "https://data.middlesex.ca",
        "municipalities": ["Middlesex Centre", "North Middlesex", "Thames Centre"],
    },
    "Lambton County": {
        "search_url": "https://www.lambtononline.ca/en/open-data/open-data.aspx",
        "municipalities": ["Lambton Shores", "Plympton-Wyoming", "St. Clair", "Warwick"],
    },
    "Essex County": {
        "search_url": "https://data.countyofessex.ca",
        "municipalities": ["Amherstburg", "Essex", "Lakeshore", "Tecumseh"],
    },
    "Elgin County": {
        "search_url": "https://www.elgincounty.ca/open-data/",
        "municipalities": ["Bayham", "Central Elgin", "Malahide"],
    },
    "Northumberland County": {
        "search_url": "https://northumberland.opendata.arcgis.com",
        "municipalities": ["Alnwick/Haldimand", "Brighton", "Cramahe", "Hamilton Township", "Port Hope", "Trent Hills"],
    },
    "Hastings County": {
        "search_url": "https://hastingscounty.com/open-data/",
        "municipalities": ["Centre Hastings", "Hastings Highlands", "Marmora and Lake", "Stirling-Rawdon", "Tyendinaga"],
    },
    "Frontenac County": {
        "search_url": "https://opendata.frontenacmaps.ca",
        "municipalities": ["Central Frontenac", "Frontenac Islands", "North Frontenac", "South Frontenac"],
    },
    "Renfrew County": {
        "search_url": "https://opendata.renfrewcounty.ca",
        "municipalities": ["Bonnechere Valley", "Greater Madawaska", "Laurentian Valley", "Madawaska Valley", "McNab/Braeside", "Petawawa", "Whitewater Region"],
    },
    "Lanark County": {
        "search_url": "https://opendata.lanarkcounty.ca",
        "municipalities": ["Beckwith", "Drummond/North Elmsley", "Lanark Highlands", "Mississippi Mills", "Montague", "Tay Valley"],
    },
}

# Municipalities with their own ArcGIS portals
OWN_PORTAL_TARGETS = {
    "Quinte West": "https://geodata-quintewest.opendata.arcgis.com",
    "Belleville": "https://opendata-bellevillegis.hub.arcgis.com",
    "Timmins": "https://opendata.timmins.ca",
    "Innisfil": "https://data.innisfil.ca",
    "Milton": "https://data.milton.ca",
    "Strathroy-Caradoc": "https://data.strathroy-caradoc.ca",
    "LaSalle": "https://opendata.lasalle.ca",
    "Saugeen Shores": "https://data.saugeenshores.ca",
    "Pembroke": "https://opendata.pembroke.ca",
    "Cobourg": "https://opendata.cobourg.ca",
}


def try_arcgis_hub_search(hub_url, search_term="ward"):
    """Try to find a ward boundary dataset on an ArcGIS Hub site."""
    # ArcGIS Hub v3 API search
    search_urls = [
        f"{hub_url}/api/v3/datasets?filter[keyword]={search_term}&page[size]=10",
        f"{hub_url}/api/search/v1?q={search_term}&num=10",
    ]
    
    for url in search_urls:
        try:
            resp = requests.get(url, timeout=15, headers={"Accept": "application/json"})
            if resp.status_code == 200:
                data = resp.json()
                # Look for ward-related datasets
                datasets = data.get("data", data.get("results", []))
                for ds in datasets:
                    attrs = ds.get("attributes", ds)
                    name = attrs.get("name", attrs.get("title", "")).lower()
                    if "ward" in name:
                        return {
                            "found": True,
                            "name": attrs.get("name", attrs.get("title")),
                            "url": attrs.get("url", attrs.get("landingPage", "")),
                            "type": attrs.get("type", ""),
                        }
        except Exception:
            continue
    
    return {"found": False}


def try_arcgis_rest_query(service_url, layer_id=0):
    """Try to query an ArcGIS REST service for ward boundary features."""
    query_url = f"{service_url}/{layer_id}/query"
    params = {
        "where": "1=1",
        "outFields": "*",
        "outSR": "4326",
        "f": "geojson",
        "returnGeometry": "true",
    }
    
    try:
        resp = requests.get(query_url, params=params, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            features = data.get("features", [])
            if features:
                return {
                    "type": "FeatureCollection",
                    "features": features,
                }
    except Exception:
        pass
    
    return None


def fetch_arcgis_portals():
    """Attempt to find and download ward boundaries from ArcGIS portals."""
    log.info("=== SOURCE 3: ArcGIS Hub/REST Portals ===")
    
    results = {}
    
    # Check upper-tier portals
    for region, config in ARCGIS_PORTAL_TARGETS.items():
        log.info(f"  Checking {region}...")
        search_result = try_arcgis_hub_search(config["search_url"])
        
        if search_result.get("found"):
            log.info(f"    Found ward dataset: {search_result['name']}")
            results[region] = {
                "status": "DATASET_FOUND",
                "dataset_name": search_result["name"],
                "dataset_url": search_result.get("url", ""),
                "municipalities": config["municipalities"],
            }
        else:
            log.info(f"    No ward dataset found via Hub API search")
            results[region] = {
                "status": "NEEDS_MANUAL_CHECK",
                "portal_url": config["search_url"],
                "municipalities": config["municipalities"],
            }
        
        time.sleep(RATE_LIMIT_DELAY)
    
    # Check own portals
    for muni, portal_url in OWN_PORTAL_TARGETS.items():
        log.info(f"  Checking {muni} own portal...")
        search_result = try_arcgis_hub_search(portal_url)
        
        if search_result.get("found"):
            log.info(f"    Found: {search_result['name']}")
            results[muni] = {
                "status": "DATASET_FOUND",
                "dataset_name": search_result["name"],
                "dataset_url": search_result.get("url", ""),
            }
        else:
            results[muni] = {
                "status": "PORTAL_EXISTS_NEEDS_MANUAL",
                "portal_url": portal_url,
            }
        
        time.sleep(RATE_LIMIT_DELAY)
    
    return results


# ============================================================
# SOURCE 4: Combine and Normalize
# ============================================================

def normalize_and_combine(geohub_data, represent_data, arcgis_results):
    """Combine all sources into a normalized structure for LocalSeat."""
    log.info("=== COMBINING AND NORMALIZING ===")
    
    combined = {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "sources": [
                "Ontario GeoHub (municipal boundaries)",
                "Represent API (ward boundaries)",
                "ArcGIS Hub portals (ward boundaries)",
            ],
            "version": "1.0",
        },
        "municipalities": [],
    }
    
    # Process municipal boundaries from GeoHub
    muni_boundaries = {}
    if geohub_data and "features" in geohub_data:
        for feature in geohub_data["features"]:
            props = feature.get("properties", {})
            name = props.get("OFFICIAL_NAME", props.get("MUNICIPA_1", ""))
            if name:
                muni_boundaries[name] = feature.get("geometry")
    
    # Process ward data from Represent API
    represent_wards = {}
    for ward_set, geojson in (represent_data or {}).items():
        municipality = geojson.get("metadata", {}).get("municipality", ward_set)
        wards = []
        for feature in geojson.get("features", []):
            props = feature.get("properties", {})
            wards.append({
                "name": props.get("name", ""),
                "external_id": props.get("external_id", ""),
                "geometry": feature.get("geometry"),
            })
        if wards:
            represent_wards[municipality] = wards
    
    # Build the combined structure
    # First: at-large municipalities
    for muni_name in AT_LARGE_MUNICIPALITIES:
        entry = {
            "name": muni_name,
            "election_type": "at_large",
            "boundary_source": "geohub",
            "boundary": muni_boundaries.get(muni_name),
            "wards": [],
            "ward_source": None,
        }
        combined["municipalities"].append(entry)
    
    # Second: ward-based municipalities with Represent API data
    for muni_name, wards in represent_wards.items():
        entry = {
            "name": muni_name,
            "election_type": "ward",
            "boundary_source": "geohub",
            "boundary": muni_boundaries.get(muni_name),
            "wards": wards,
            "ward_source": "represent_api",
        }
        combined["municipalities"].append(entry)
    
    # Third: ward-based municipalities with ArcGIS portal data
    for region_or_muni, result in (arcgis_results or {}).items():
        if result.get("status") == "DATASET_FOUND":
            munis = result.get("municipalities", [region_or_muni])
            if isinstance(munis, str):
                munis = [munis]
            for muni_name in munis:
                # Skip if already covered by Represent API
                if muni_name in represent_wards:
                    continue
                entry = {
                    "name": muni_name,
                    "election_type": "ward",
                    "boundary_source": "geohub",
                    "boundary": muni_boundaries.get(muni_name),
                    "wards": [],  # Would be populated after manual download
                    "ward_source": "arcgis_portal",
                    "ward_data_url": result.get("dataset_url", ""),
                    "ward_data_status": "needs_download",
                }
                combined["municipalities"].append(entry)
    
    # Count stats
    total = len(combined["municipalities"])
    at_large = sum(1 for m in combined["municipalities"] if m["election_type"] == "at_large")
    with_wards = sum(1 for m in combined["municipalities"] if m.get("wards"))
    with_boundary = sum(1 for m in combined["municipalities"] if m.get("boundary"))
    
    combined["metadata"]["stats"] = {
        "total_municipalities": total,
        "at_large": at_large,
        "ward_based_with_data": with_wards,
        "with_municipal_boundary": with_boundary,
    }
    
    log.info(f"  Total municipalities: {total}")
    log.info(f"  At-large: {at_large}")
    log.info(f"  Ward-based with ward data: {with_wards}")
    log.info(f"  With municipal boundary: {with_boundary}")
    
    return combined


# ============================================================
# SOURCE 5: Output SQL Seed File
# ============================================================

def generate_sql_seed(combined):
    """Generate PostgreSQL seed SQL for the LocalSeat database."""
    log.info("=== GENERATING SQL SEED FILE ===")
    
    sql_lines = [
        "-- LocalSeat Municipal Boundary Seed Data",
        f"-- Generated: {datetime.now().isoformat()}",
        "-- Sources: Ontario GeoHub, Represent API, ArcGIS Portals",
        "",
        "-- Ensure PostGIS extension",
        "CREATE EXTENSION IF NOT EXISTS postgis;",
        "",
        "-- Create tables if they don't exist",
        "CREATE TABLE IF NOT EXISTS municipalities (",
        "  id SERIAL PRIMARY KEY,",
        "  name VARCHAR(255) NOT NULL,",
        "  election_type VARCHAR(20) NOT NULL CHECK (election_type IN ('at_large', 'ward', 'both')),",
        "  boundary_source VARCHAR(50),",
        "  boundary GEOMETRY(MultiPolygon, 4326),",
        "  created_at TIMESTAMP DEFAULT NOW(),",
        "  updated_at TIMESTAMP DEFAULT NOW()",
        ");",
        "",
        "CREATE TABLE IF NOT EXISTS wards (",
        "  id SERIAL PRIMARY KEY,",
        "  municipality_id INTEGER REFERENCES municipalities(id),",
        "  name VARCHAR(255) NOT NULL,",
        "  ward_number VARCHAR(10),",
        "  boundary_source VARCHAR(50),",
        "  boundary GEOMETRY(MultiPolygon, 4326),",
        "  created_at TIMESTAMP DEFAULT NOW(),",
        "  updated_at TIMESTAMP DEFAULT NOW()",
        ");",
        "",
        "CREATE INDEX IF NOT EXISTS idx_municipalities_name ON municipalities(name);",
        "CREATE INDEX IF NOT EXISTS idx_wards_municipality ON wards(municipality_id);",
        "CREATE INDEX IF NOT EXISTS idx_municipalities_boundary ON municipalities USING GIST(boundary);",
        "CREATE INDEX IF NOT EXISTS idx_wards_boundary ON wards USING GIST(boundary);",
        "",
        "-- Insert municipalities",
        "BEGIN;",
        "",
    ]
    
    muni_count = 0
    ward_count = 0
    
    for muni in combined.get("municipalities", []):
        name = muni["name"].replace("'", "''")
        etype = muni["election_type"]
        bsource = (muni.get("boundary_source") or "none").replace("'", "''")
        
        geom = muni.get("boundary")
        if geom:
            geom_sql = f"ST_SetSRID(ST_GeomFromGeoJSON('{json.dumps(geom)}'), 4326)"
            # Ensure MultiPolygon
            geom_sql = f"ST_Multi({geom_sql})"
        else:
            geom_sql = "NULL"
        
        sql_lines.append(
            f"INSERT INTO municipalities (name, election_type, boundary_source, boundary) "
            f"VALUES ('{name}', '{etype}', '{bsource}', {geom_sql});"
        )
        muni_count += 1
        
        # Insert wards
        for ward in muni.get("wards", []):
            ward_name = (ward.get("name") or "").replace("'", "''")
            ward_num = (ward.get("external_id") or "").replace("'", "''")
            wsource = (muni.get("ward_source") or "none").replace("'", "''")
            
            wgeom = ward.get("geometry")
            if wgeom:
                wgeom_sql = f"ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON('{json.dumps(wgeom)}'), 4326))"
            else:
                wgeom_sql = "NULL"
            
            sql_lines.append(
                f"INSERT INTO wards (municipality_id, name, ward_number, boundary_source, boundary) "
                f"VALUES (currval('municipalities_id_seq'), '{ward_name}', '{ward_num}', '{wsource}', {wgeom_sql});"
            )
            ward_count += 1
    
    sql_lines.extend([
        "",
        "COMMIT;",
        "",
        f"-- Inserted {muni_count} municipalities and {ward_count} wards",
    ])
    
    output_file = COMBINED_DIR / "seed_boundaries.sql"
    with open(output_file, 'w') as f:
        f.write("\n".join(sql_lines))
    
    log.info(f"  Generated SQL seed: {muni_count} municipalities, {ward_count} wards")
    log.info(f"  Saved to: {output_file}")
    
    return output_file


# ============================================================
# MAIN
# ============================================================

def main():
    log.info("=" * 60)
    log.info("LocalSeat Municipal Boundary Collector")
    log.info("=" * 60)
    
    # Step 1: Ontario GeoHub municipal boundaries
    geohub_data = fetch_geohub_municipalities()
    
    # Step 2: Represent API ward boundaries
    represent_data = fetch_represent_wards()
    
    # Step 3: ArcGIS portal ward boundaries
    arcgis_results = fetch_arcgis_portals()
    
    # Step 4: Combine and normalize
    combined = normalize_and_combine(geohub_data, represent_data, arcgis_results)
    
    # Save combined JSON
    combined_file = COMBINED_DIR / "localseat_boundaries.json"
    with open(combined_file, 'w') as f:
        json.dump(combined, f, indent=2, default=str)
    log.info(f"Saved combined data to: {combined_file}")
    
    # Save ArcGIS portal scan results
    arcgis_file = COMBINED_DIR / "arcgis_portal_scan.json"
    with open(arcgis_file, 'w') as f:
        json.dump(arcgis_results, f, indent=2, default=str)
    log.info(f"Saved ArcGIS scan results to: {arcgis_file}")
    
    # Step 5: Generate SQL seed
    sql_file = generate_sql_seed(combined)
    
    # Summary
    log.info("")
    log.info("=" * 60)
    log.info("COLLECTION COMPLETE")
    log.info("=" * 60)
    log.info(f"Municipal boundaries: {MUNI_DIR}")
    log.info(f"Ward boundaries: {WARD_DIR}")
    log.info(f"Combined output: {COMBINED_DIR}")
    log.info(f"SQL seed file: {sql_file}")
    
    stats = combined.get("metadata", {}).get("stats", {})
    log.info(f"")
    log.info(f"Stats:")
    for k, v in stats.items():
        log.info(f"  {k}: {v}")


if __name__ == "__main__":
    main()
