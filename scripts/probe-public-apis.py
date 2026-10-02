#!/usr/bin/env python3
"""Read-only public upstream probes. Never loads credentials or private accounts.

Empty arrivals outside operating hours are valid data states, not fabricated passes
for real-time predictions. Every probe reports its observed content and limitations.
"""
import concurrent.futures
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

import certifi
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/api/test-results"
SSL = ssl.create_default_context(cafile=certifi.where())
ALLOWED = {"cso.hkust.edu.hk", "www.1823.gov.hk", "data.etabus.gov.hk",
           "data.etagmb.gov.hk", "rt.data.gov.hk", "data.weather.gov.hk",
           "calendar.hkust.edu.hk", "www.als.gov.hk", "itso.hkust.edu.hk",
           "public-api.luma.com"}


class AllowedRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parts = urllib.parse.urlsplit(newurl)
        if parts.scheme != "https" or parts.hostname not in ALLOWED:
            raise ValueError("redirect outside public allow-list")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch(url, records, accept="*/*"):
    parts = urllib.parse.urlsplit(url)
    if parts.scheme != "https" or parts.hostname not in ALLOWED:
        raise ValueError("not an allowed public source")
    rec = {"url": url, "checked_at": dt.datetime.now(dt.timezone.utc).isoformat()}
    records.append(rec)
    opener = urllib.request.build_opener(AllowedRedirect(), urllib.request.HTTPSHandler(context=SSL))
    req = urllib.request.Request(url, headers={"User-Agent": "HKUST-API-read-only-verification/0.1", "Accept": accept})
    try:
        with opener.open(req, timeout=20) as response:
            body = response.read(4_000_001)
            if len(body) > 4_000_000:
                raise ValueError("public response exceeds probe size bound")
            rec.update(http_status=response.status, content_type=response.headers.get("Content-Type", ""),
                       final_url=response.url, bytes=len(body), sha256=hashlib.sha256(body).hexdigest())
    except urllib.error.HTTPError as error:
        rec["http_status"] = error.code
        raise
    return body


def json_get(url, records):
    return json.loads(fetch(url, records, "application/json"))


def text_get(url, records):
    soup = BeautifulSoup(fetch(url, records), "html.parser")
    for tag in soup(["script", "style", "nav", "header", "footer"]):
        tag.decompose()
    return re.sub(r"\s+", " ", soup.get_text(" ", strip=True))


def school_login_docs(records):
    text = text_get("https://itso.hkust.edu.hk/services/cyber-security/authentication-service/sso-integration", records)
    assert "OpenID Connect" in text and "Register your application" in text
    return {"documented": "OIDC and application registration", "auth_e2e": "not_tested"}


def shuttle(records):
    text = text_get("https://cso.hkust.edu.hk/index.php/tran/stud_sh_b", records)
    assert re.search(r"From 1 Sep\s*to 18 Dec 2026", text)
    assert "Monday to Friday except public holidays" in text
    assert "Student Only" in text and "Students and Staff" in text
    fixture = json.loads((ROOT / "docs/api/fixtures/shuttle-specification-samples.json").read_text())
    # Check each reviewed block, rather than accepting a time appearing anywhere.
    blocks = [
        ("diamond-hill-to-campus", r"From: Diamond Hill\s*\(.*?\).*?-\s*\$6\.2\s*(.*?)\(8 trips\)"),
        ("hang-hau-to-campus", r"From: Hang Hau\s*\(.*?\).*?Free of charge\s*(.*?)From: Kowloon Tong"),
    ]
    for route_id, pattern in blocks:
        match = re.search(pattern, text)
        assert match, f"reviewed schedule block missing: {route_id}"
        observed = re.findall(r"\b\d{2}:\d{2}\b", match.group(1))
        expected = next(x for x in fixture["routes"] if x["id"] == route_id)["departures"]
        assert observed == expected, f"source timetable changed: {route_id}; manual review required"
    assert "22:15" in text and "Morning GPS" in text
    return {"service_period": ["2026-09-01", "2026-12-18"], "reviewed_morning_blocks": 2,
            "gps_page_link_present": True, "gps_api_authorization": "not_established",
            "coverage": "reviewed sample blocks, not all routes"}


def holidays(records):
    j = json_get("https://www.1823.gov.hk/common/ical/en.json", records)
    events = j["vcalendar"][0]["vevent"]
    dates = [dt.datetime.strptime(e["dtstart"][0], "%Y%m%d").date().isoformat() for e in events]
    assert "2026-10-01" in dates
    assert dates and all(e.get("summary") for e in events)
    return {"count": len(dates), "coverage_years": sorted({int(x[:4]) for x in dates})}


def kmb_routes(records):
    j = json_get("https://data.etabus.gov.hk/v1/transport/kmb/route/", records)
    matches = [x for x in j["data"] if x["route"] == "91M"]
    assert matches and all(x.get("bound") and x.get("service_type") for x in matches)
    return {"route_91m_variants": len(matches)}


def kmb_eta(records):
    j = json_get("https://data.etabus.gov.hk/v1/transport/kmb/route-eta/91M/1", records)
    rows = j["data"]
    assert isinstance(rows, list) and j["generated_timestamp"]
    for row in rows:
        assert row["route"] == "91M"
        if row.get("eta"):
            assert dt.datetime.fromisoformat(row["eta"]).utcoffset() is not None
    return {"records": len(rows), "with_eta": sum(bool(x.get("eta")) for x in rows),
            "remarks": sorted({x.get("rmk_en", "") for x in rows}),
            "source_generated_at": j["generated_timestamp"], "empty_is_no_data_not_prediction": True}


def gmb(records):
    routes = json_get("https://data.etagmb.gov.hk/route/NT/11M", records)["data"]
    assert routes
    route = routes[0]
    direction = route["directions"][0]["route_seq"]
    stops = json_get(f"https://data.etagmb.gov.hk/route-stop/{route['route_id']}/{direction}", records)["data"]["route_stops"]
    assert stops and any("Science and Technology" in x.get("name_en", "") for x in stops)
    eta = json_get(f"https://data.etagmb.gov.hk/eta/route-stop/{route['route_id']}/{direction}/{stops[0]['stop_seq']}", records)
    data = eta["data"]
    assert isinstance(data["enabled"], bool) and isinstance(data["eta"], list)
    for x in data["eta"]:
        assert dt.datetime.fromisoformat(x["timestamp"]).utcoffset() is not None
    return {"route_id": route["route_id"], "stop_count": len(stops), "eta_enabled": data["enabled"],
            "eta_count": len(data["eta"]), "remarks": sorted({x.get("remarks_en", "") for x in data["eta"]})}


def citybus(records):
    root = "https://rt.data.gov.hk/v2/transport/citybus"
    routes = json_get(root + "/route/CTB", records)["data"]
    assert routes
    route = routes[0]["route"]
    stops = json_get(f"{root}/route-stop/CTB/{route}/outbound", records)["data"]
    assert stops
    eta = json_get(f"{root}/eta/CTB/{stops[0]['stop']}/{route}", records)
    assert isinstance(eta["data"], list) and eta.get("generated_timestamp")
    return {"catalogue_count": len(routes), "sample_route": route, "stop_count": len(stops),
            "eta_count": len(eta["data"]), "coverage": "one route/stop sample"}


def mtr(records):
    j = json_get("https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=TKL&sta=TKO&lang=en", records)
    assert "status" in j and "message" in j
    assert j.get("data") or j["status"] == 0
    return {"service_status": j["status"], "station_present": "TKL-TKO" in j.get("data", {})}


def weather(records):
    j = json_get("https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en", records)
    assert j["updateTime"] and isinstance(j["temperature"]["data"], list)
    return {"station_count": len(j["temperature"]["data"]), "updated_at": j["updateTime"]}


def warnings(records):
    j = json_get("https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=en", records)
    assert isinstance(j, dict)
    assert all(isinstance(x, dict) and "name" in x for x in j.values())
    return {"entries": len(j), "empty_means_no_warning": True}


def academic_ics(records):
    text = fetch("https://calendar.hkust.edu.hk/events/ics?ics_mode=academic_calendar", records).decode()
    assert text.startswith("BEGIN:VCALENDAR") and "BEGIN:VEVENT" in text
    assert "Asia/Hong_Kong" in text
    return {"events": text.count("BEGIN:VEVENT"), "scope": "academic calendar, not personal enrolment"}


def public_rss(records):
    root = ET.fromstring(fetch("https://calendar.hkust.edu.hk/events/rss?ics_mode=academic_calendar", records))
    items = root.findall(".//item")
    assert items and all(x.findtext("title") and x.findtext("link") for x in items)
    return {"items": len(items), "scope": "general events observed; query name does not imply academic-only"}


def address(records):
    j = json_get("https://www.als.gov.hk/lookup?q=central%20government%20offices", records)
    assert j["SuggestedAddress"]
    return {"candidates": len(j["SuggestedAddress"])}


def luma_schema(records):
    j = json_get("https://public-api.luma.com/openapi.json", records)
    for p in ("/v1/calendars/events/list", "/v1/events/get"):
        assert "get" in j["paths"][p]
    return {"public_schema": True, "authorized_business_api_tested": False}


def run(item):
    name, probe = item
    records = []
    try:
        observation = probe(records)
        return {"name": name, "status": "pass", "requests": records, "observation": observation}
    except Exception as error:
        # Only bounded descriptions; response bodies and request headers are not logged.
        message = str(error)[:240] if isinstance(error, (AssertionError, ValueError, urllib.error.HTTPError)) else type(error).__name__
        return {"name": name, "status": "fail", "requests": records, "error": message}


if __name__ == "__main__":
    jobs = [("school_sso_documentation", school_login_docs), ("cso_shuttle_schedule", shuttle),
            ("public_holidays", holidays), ("kmb_routes", kmb_routes), ("kmb_eta", kmb_eta),
            ("gmb_11m_route_stop_eta", gmb), ("citybus_route_stop_eta", citybus), ("mtr_next_train", mtr),
            ("hko_weather", weather), ("hko_warnings", warnings), ("academic_ics", academic_ics),
            ("university_rss", public_rss), ("address_lookup", address), ("luma_public_schema", luma_schema)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(run, jobs))
    report = {"checked_at": dt.datetime.now(dt.timezone.utc).isoformat(),
              "scope": "Read-only public source probes, not product HTTP endpoint tests or authorized personal integrations.",
              "passed": sum(x["status"] == "pass" for x in results),
              "failed": sum(x["status"] == "fail" for x in results), "results": results,
              "blocked": [
                  {"area": "School OIDC/email login and session security", "reason": "New auth server not implemented; institutional client/issuer/claims approval and email provider absent."},
                  {"area": "Canvas/SIS/Graph private data", "reason": "No approved per-user integration exercised; no credentials accessed."},
                  {"area": "Shuttle GPS API", "reason": "Official external viewer link is not an approved reusable API."},
                  {"area": "Facilities/Luma/Meetup private APIs", "reason": "Institutional/organizer permission and applicable subscription not configured."}
              ]}
    OUT.mkdir(exist_ok=True)
    (OUT / "public-upstreams.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({k:report[k] for k in ("checked_at", "passed", "failed")}, ensure_ascii=False))
    for x in results:
        print(x["name"], x["status"], x.get("error", ""))
    sys.exit(1 if report["failed"] else 0)
