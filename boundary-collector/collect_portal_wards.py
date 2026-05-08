#!/usr/bin/env python3
"""
Portal Ward Boundary Collector — 19 Ontario open data portals.
5-second timeouts, no blocking catalog walks unless Hub APIs return nothing fast.
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
    os.system("pip install requests")
    import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent
WARD_DIR = BASE_DIR / "output" / "wards"
COMBINED_DIR = BASE_DIR / "output" / "combined"
WARD_DIR.mkdir(parents=True, exist_ok=True)
COMBINED_DIR.mkdir(parents=True, exist_ok=True)
COMBINED_FILE = COMBINED_DIR / "localseat_boundaries.json"

HEADERS = {"User-Agent": "LocalSeat-BoundaryCollector/2.0", "Accept": "application/json"}
TIMEOUT = 5  # seconds — fast fail on unresponsive portals

SEARCH_TERMS = ["ward", "electoral", "election", "council district", "boundary", "voting"]

PORTALS = [
    {"name": "Halton Region",         "url": "https://www.halton.ca",                           "hub": "https://halton.opendata.arcgis.com"},
    {"name": "Peel Region",           "url": "https://opendata.peelregion.ca",                   "hub": "https://opendata.peelregion.ca"},
    {"name": "York Region",           "url": "https://open.york.ca",                             "hub": "https://open.york.ca"},
    {"name": "Waterloo Region",       "url": "https://open-data.regionofwaterloo.ca",             "hub": "https://open-data.regionofwaterloo.ca"},
    {"name": "Niagara Region",        "url": "https://niagaraopendata.ca",                       "hub": "https://niagaraopendata.ca"},
    {"name": "Simcoe County",         "url": "https://data-simcoe.opendata.arcgis.com",           "hub": "https://data-simcoe.opendata.arcgis.com"},
    {"name": "Grey County",           "url": "https://opendata.grey.ca",                          "hub": "https://opendata.grey.ca"},
    {"name": "Bruce County",          "url": "https://opendata.brucecounty.on.ca",                "hub": "https://opendata.brucecounty.on.ca"},
    {"name": "Huron County",          "url": "https://data-huron.opendata.arcgis.com",            "hub": "https://data-huron.opendata.arcgis.com"},
    {"name": "Northumberland County", "url": "https://northumberland.opendata.arcgis.com",        "hub": "https://northumberland.opendata.arcgis.com"},
    {"name": "Frontenac County",      "url": "https://opendata.frontenacmaps.ca",                 "hub": "https://opendata.frontenacmaps.ca"},
    {"name": "Renfrew County",        "url": "https://opendata.renfrewcounty.ca",                 "hub": "https://opendata.renfrewcounty.ca"},
    {"name": "Lanark County",         "url": "https://opendata.lanarkcounty.ca",                  "hub": "https://opendata.lanarkcounty.ca"},
    {"name": "Belleville",            "url": "https://opendata-bellevillegis.hub.arcgis.com",     "hub": "https://opendata-bellevillegis.hub.arcgis.com"},
    {"name": "Quinte West",           "url": "https://geodata-quintewest.opendata.arcgis.com",    "hub": "https://geodata-quintewest.opendata.arcgis.com"},
    {"name": "Innisfil",              "url": "https://data.innisfil.ca",                          "hub": "https://data.innisfil.ca"},
    {"name": "Milton",                "url": "https://data.milton.ca",                            "hub": "https://data.milton.ca"},
    {"name": "North Bay",             "url": "https://opendata.northbay.ca",                      "hub": "https://opendata.northbay.ca"},
    {"name": "Sarnia",                "url": "https://opendata.sarnia.ca",                        "hub": "https://opendata.sarnia.ca"},
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get(url, params=None):
    try:
        r = requests.get(url, params=params, headers=HEADERS, timeout=TIMEOUT)
        if r.status_code == 200:
            return r
    except Exception:
        pass
    return None


def is_ward_related(text):
    text = (text or "").lower()
    hits = ["ward", "electoral", "electora", "council district", "councillor",
            "election boundary", "voting district", "polling district"]
    false_pos = ["reward", "award", "backward", "forward", "keyword",
                 "password", "hayward", "steward", "edward", "inward"]
    for h in hits:
        if h in text:
            for fp in false_pos:
                if fp == text.strip():
                    return False
            return True
    return False


def extract_service_url(obj):
    """Pull a FeatureServer or MapServer URL out of a dataset object (various schemas)."""
    candidates = []
    # Hub v3 attributes
    if "attributes" in obj:
        a = obj["attributes"]
        candidates += [
            a.get("url", ""),
            (a.get("layer") or {}).get("url", ""),
            a.get("accessURL", ""),
        ]
        for ref in (a.get("references") or {}).values():
            candidates.append((ref or {}).get("url", ""))
    # Flat result
    candidates += [obj.get("url", ""), obj.get("landingPage", ""), obj.get("serviceUrl", "")]
    for u in candidates:
        if u and ("/FeatureServer" in u or "/MapServer" in u):
            return u.strip()
    return None


def query_layer_geojson(service_url):
    """Given a FeatureServer/MapServer URL (with or without layer id), download GeoJSON."""
    url = service_url.rstrip("/")
    # If no layer number, fetch service info to pick first layer
    if not url[-1].isdigit():
        info = get(url, {"f": "json"})
        if info:
            try:
                layers = info.json().get("layers", [])
                if layers:
                    url = f"{url}/{layers[0]['id']}"
                else:
                    url = f"{url}/0"
            except Exception:
                url = f"{url}/0"
        else:
            url = f"{url}/0"

    r = get(f"{url}/query", {
        "where": "1=1",
        "outFields": "*",
        "outSR": "4326",
        "f": "geojson",
        "returnGeometry": "true",
        "resultRecordCount": 5000,
    })
    if not r:
        return None
    try:
        data = r.json()
        if "error" in data:
            return None
        if "features" in data:
            data.setdefault("type", "FeatureCollection")
            return data
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Search strategies
# ---------------------------------------------------------------------------

def search_hub_v3(hub_url, term):
    r = get(f"{hub_url}/api/v3/datasets", {
        "q": term,
        "page[size]": 20,
        "fields[datasets]": "name,url,type,layer,references",
    })
    if not r:
        return []
    try:
        return r.json().get("data", [])
    except Exception:
        return []


def search_hub_legacy(hub_url, term):
    r = get(f"{hub_url}/api/search/v1", {"q": term, "num": 20})
    if not r:
        return []
    try:
        return r.json().get("results", [])
    except Exception:
        return []


def search_portal_rest(hub_url, term):
    for path in ["/sharing/rest/search", "/arcgis/sharing/rest/search"]:
        r = get(f"{hub_url}{path}", {
            "q": f"{term} type:Feature Service",
            "f": "json",
            "num": 20,
        })
        if r:
            try:
                results = r.json().get("results", [])
                if results:
                    return results
            except Exception:
                pass
    return []


def find_candidates(hub_url, portal_name):
    """Run all search strategies and return list of (label, service_url)."""
    candidates = []
    seen_urls = set()

    def add(label, svc_url):
        if svc_url and svc_url not in seen_urls:
            seen_urls.add(svc_url)
            candidates.append((label, svc_url))

    for term in SEARCH_TERMS:
        # Hub v3
        for ds in search_hub_v3(hub_url, term):
            name = (ds.get("attributes") or {}).get("name", "") or ""
            if is_ward_related(name):
                svc = extract_service_url(ds)
                if svc:
                    log.info(f"  [Hub v3/{term}] {name}")
                    add(name, svc)

        # Hub legacy
        for ds in search_hub_legacy(hub_url, term):
            name = ds.get("name") or ds.get("title") or ""
            if is_ward_related(name):
                svc = extract_service_url(ds)
                if svc:
                    log.info(f"  [Hub legacy/{term}] {name}")
                    add(name, svc)

        # Portal REST
        for ds in search_portal_rest(hub_url, term):
            name = ds.get("title") or ds.get("name") or ""
            if is_ward_related(name):
                svc = extract_service_url(ds)
                if svc:
                    log.info(f"  [Portal REST/{term}] {name}")
                    add(name, svc)

        if candidates:
            break  # found something on this term, no need to keep searching

    return candidates


# ---------------------------------------------------------------------------
# Per-portal logic
# ---------------------------------------------------------------------------

def process_portal(portal):
    name = portal["name"]
    hub  = portal["hub"]
    slug = name.lower().replace(" ", "_")

    log.info(f"\n{'='*60}")
    log.info(f"PORTAL: {name}  ({hub})")

    candidates = find_candidates(hub, name)

    if not candidates:
        log.info(f"  -> No ward datasets found")
        return {"status": "no_data", "name": name, "portal_url": hub}

    saved_files = []
    for label, svc_url in candidates[:3]:
        log.info(f"  Querying: {svc_url}")
        geojson = query_layer_geojson(svc_url)
        if not geojson or not geojson.get("features"):
            # one retry with /0 appended if bare URL
            if not svc_url.rstrip("/")[-1].isdigit():
                geojson = query_layer_geojson(svc_url + "/0")

        if geojson and geojson.get("features"):
            n = len(geojson["features"])
            log.info(f"  Downloaded {n} features")
            geojson["metadata"] = {
                "source": name,
                "portal_url": hub,
                "service_url": svc_url,
                "dataset_name": label,
                "fetched_at": datetime.now().isoformat(),
                "feature_count": n,
            }
            safe_label = label.lower().replace(" ", "_").replace("/", "_")[:40]
            out = WARD_DIR / f"portal_{slug}_{safe_label}.geojson"
            with open(out, "w", encoding="utf-8") as f:
                json.dump(geojson, f)
            log.info(f"  Saved: {out.name}")
            saved_files.append(str(out))
        else:
            log.info(f"  No features returned")

    if saved_files:
        return {"status": "saved", "name": name, "portal_url": hub,
                "files": saved_files, "datasets_found": len(candidates)}
    return {"status": "found_no_data", "name": name, "portal_url": hub,
            "candidates": [(l, u) for l, u in candidates]}


# ---------------------------------------------------------------------------
# Merge into combined file
# ---------------------------------------------------------------------------

def update_combined(results):
    log.info(f"\n{'='*60}")
    log.info("Updating combined boundaries file...")

    if COMBINED_FILE.exists():
        with open(COMBINED_FILE, encoding="utf-8") as f:
            combined = json.load(f)
    else:
        combined = {"metadata": {"generated_at": datetime.now().isoformat(),
                                 "version": "2.0"}, "municipalities": []}

    existing = {m["name"]: m for m in combined.get("municipalities", [])}
    updated = 0

    for res in results:
        if res["status"] != "saved":
            continue
        name = res["name"]
        for fp in res.get("files", []):
            try:
                with open(fp, encoding="utf-8") as f:
                    gj = json.load(f)
            except Exception as e:
                log.warning(f"  Cannot read {fp}: {e}")
                continue

            wards = []
            for feat in gj.get("features", []):
                p = feat.get("properties") or {}
                ward_name = (p.get("WARD_NAME") or p.get("Ward_Name") or p.get("name")
                             or p.get("NAME") or p.get("WardName")
                             or p.get("ElectoralDistrictName") or p.get("DISTRICT_NAME")
                             or str(p.get("WARD_NO", p.get("ward_number", ""))))
                ward_num  = str(p.get("WARD_NUM") or p.get("WARD_NO")
                                or p.get("ward_number") or p.get("WARD") or "")
                wards.append({"name": ward_name, "ward_number": ward_num,
                              "geometry": feat.get("geometry"), "properties": p})

            if name in existing:
                if not existing[name].get("wards"):
                    existing[name]["wards"] = wards
                    existing[name]["ward_source"] = "arcgis_portal"
                    existing[name]["portal_url"] = res["portal_url"]
                    log.info(f"  Updated {name}: {len(wards)} wards")
                    updated += 1
            else:
                entry = {"name": name, "election_type": "ward", "boundary": None,
                         "wards": wards, "ward_source": "arcgis_portal",
                         "portal_url": res["portal_url"], "geojson_file": fp}
                combined["municipalities"].append(entry)
                existing[name] = entry
                log.info(f"  Added {name}: {len(wards)} wards")
                updated += 1

    munis = combined["municipalities"]
    combined["metadata"].update({
        "generated_at": datetime.now().isoformat(),
        "stats": {
            "total": len(munis),
            "at_large": sum(1 for m in munis if m.get("election_type") == "at_large"),
            "ward_based_with_data": sum(1 for m in munis if m.get("wards")),
            "with_municipal_boundary": sum(1 for m in munis if m.get("boundary")),
        }
    })

    with open(COMBINED_FILE, "w", encoding="utf-8") as f:
        json.dump(combined, f, indent=2, default=str)

    log.info(f"  Combined file saved ({updated} new/updated entries)")
    return combined["metadata"]["stats"]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    log.info("=" * 60)
    log.info(f"LocalSeat Portal Ward Collector  ({len(PORTALS)} portals, {TIMEOUT}s timeout)")
    log.info("=" * 60)

    results = []
    for portal in PORTALS:
        try:
            res = process_portal(portal)
        except Exception as e:
            log.error(f"Unhandled error for {portal['name']}: {e}")
            res = {"status": "error", "name": portal["name"], "error": str(e)}
        results.append(res)
        time.sleep(0.5)

    stats = update_combined(results)

    # ---- Final summary ----
    saved  = [r for r in results if r["status"] == "saved"]
    nadata = [r for r in results if r["status"] == "no_data"]
    nodown = [r for r in results if r["status"] == "found_no_data"]
    errors = [r for r in results if r["status"] == "error"]

    log.info("\n" + "=" * 60)
    log.info("FINAL RESULTS")
    log.info("=" * 60)

    log.info(f"\nSuccessfully downloaded ({len(saved)}/{len(PORTALS)}):")
    for r in saved:
        log.info(f"  + {r['name']}  ({r['datasets_found']} dataset(s))")

    log.info(f"\nNo ward data found ({len(nadata)}):")
    for r in nadata:
        log.info(f"  - {r['name']}")

    if nodown:
        log.info(f"\nFound endpoints but no features ({len(nodown)}):")
        for r in nodown:
            log.info(f"  ? {r['name']}: {[l for l,_ in r.get('candidates',[])]}")

    if errors:
        log.info(f"\nErrors ({len(errors)}):")
        for r in errors:
            log.info(f"  ! {r['name']}: {r.get('error')}")

    log.info(f"\nCombined file stats:")
    for k, v in stats.items():
        log.info(f"  {k}: {v}")

    portal_files = list(WARD_DIR.glob("portal_*.geojson"))
    total_polys = sum(
        len(json.load(open(f, encoding="utf-8")).get("features", []))
        for f in portal_files
        if f.stat().st_size > 0
    )
    log.info(f"\nPortal GeoJSON files: {len(portal_files)}")
    log.info(f"Total ward polygons:  {total_polys}")


if __name__ == "__main__":
    main()
