#!/usr/bin/env python3
"""Validate the proposed contract and an independent timetable specification model.

This script is NOT an implementation of the product API or its authentication.
No HTTP, email, account creation, real OAuth, or credential access takes place.
"""
import copy
import datetime as dt
import io
import json
from pathlib import Path
import re
import sys
import unittest
from zoneinfo import ZoneInfo

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
API = ROOT / "docs/api"
SPEC = json.loads((API / "super-app.openapi.json").read_text())
SCHEMAS = SPEC["components"]["schemas"]
FIXTURE = json.loads((API / "fixtures/shuttle-specification-samples.json").read_text())
HK = ZoneInfo("Asia/Hong_Kong")


def valid(name, value):
    schema = {"$ref": f"#/components/schemas/{name}", "components": SPEC["components"]}
    return Draft202012Validator(schema, format_checker=FormatChecker()).is_valid(value)


def example(name):
    return copy.deepcopy(SCHEMAS[name]["examples"][0])


def specification_departures(route, instant, *, fresh=True, cancelled=False,
                             conflict=False, holidays=None, years=None):
    """Executable example of the written rules, deliberately separate from src/.

    It covers a reviewed subset of single-stop sample schedules only. It does not
    implement source ingestion, multi-stop trips, replacement service or a server.
    """
    moment = dt.datetime.fromisoformat(instant)
    if moment.utcoffset() is None:
        raise ValueError("timezone required")
    moment = moment.astimezone(HK)
    day = moment.date()
    start, end = (dt.date.fromisoformat(route[k]) for k in ("valid_from", "valid_to"))
    dates = set(FIXTURE["holidays"] if holidays is None else holidays)
    coverage = set(FIXTURE["holiday_coverage_years"] if years is None else years)

    def response(status, times=(), next_day=None):
        return {"status": status, "service_date": day.isoformat(),
                "departures": list(times), "next_service_date": next_day}

    if conflict:
        return response("unknown")
    if cancelled:  # synthetic, verified and effective cancellation in the test
        return response("suspended")
    if not fresh:
        return response("stale")
    if day < start:
        return response("not_started")
    if day > end:
        return response("expired")
    if route["exclude_public_holidays"] and day.year not in coverage:
        return response("unknown")

    def operates(date):
        return (date.isoweekday() in route["weekdays"] and
                (not route["exclude_public_holidays"] or date.isoformat() not in dates))

    def next_day():
        date = day + dt.timedelta(days=1)
        while date <= end:
            if route["exclude_public_holidays"] and date.year not in coverage:
                return None
            if operates(date):
                return date.isoformat()
            date += dt.timedelta(days=1)
        return None

    if not operates(day):
        return response("no_service", next_day=next_day())
    departures = [dt.datetime.combine(day, dt.time.fromisoformat(t), HK)
                  for t in route["departures"]]
    future = [x.isoformat() for x in departures if x > moment]
    return response("scheduled", future, day.isoformat()) if future else response(
        "ended_for_day", next_day=next_day())


class ContractTests(unittest.TestCase):
    def test_contract_is_explicitly_planned(self):
        self.assertEqual(SPEC["openapi"], "3.1.0")
        self.assertEqual(SPEC["servers"][0]["url"], "/api/v1")
        for operations in SPEC["paths"].values():
            for operation in operations.values():
                self.assertEqual(operation["x-implementation-status"], "planned")

    def test_all_local_references_resolve(self):
        def visit(value):
            if isinstance(value, dict):
                if "$ref" in value:
                    self.assertTrue(value["$ref"].startswith("#/"))
                    target = SPEC
                    for key in value["$ref"][2:].split("/"):
                        target = target[key.replace("~1", "/").replace("~0", "~")]
                for child in value.values():
                    visit(child)
            elif isinstance(value, list):
                for child in value:
                    visit(child)
        visit(SPEC)

    def test_schema_definitions_and_examples(self):
        for name, schema in SCHEMAS.items():
            with self.subTest(schema=name):
                Draft202012Validator.check_schema(schema)
                for value in schema.get("examples", []):
                    self.assertTrue(valid(name, value))

    def test_operation_ids_and_path_parameters(self):
        ids = []
        for path, operations in SPEC["paths"].items():
            for operation in operations.values():
                ids.append(operation["operationId"])
                parameters = operation.get("parameters", [])
                actual = {p["name"] for p in parameters if p["in"] == "path"}
                self.assertEqual(set(re.findall(r"{([^}]+)}", path)), actual)
                self.assertEqual(len(parameters), len({(p["in"], p["name"]) for p in parameters}))
                self.assertIn("default", operation["responses"])
        self.assertEqual(len(ids), len(set(ids)))

    def test_private_operations_require_session_in_contract(self):
        for path, operations in SPEC["paths"].items():
            if path.startswith(("/me", "/tasks", "/demand-intents")):
                for operation in operations.values():
                    self.assertNotEqual(operation.get("security", SPEC["security"]), [])
                    self.assertIn("401", operation["responses"])

    def test_writes_document_csrf_and_creates_idempotency(self):
        for operations in SPEC["paths"].values():
            for method, operation in operations.items():
                names = {p["name"] for p in operation.get("parameters", []) if p["required"]}
                if method in ("post", "patch", "delete"):
                    self.assertIn("X-CSRF-Token", names)
                if operation["operationId"] in ("createTask", "createActivity", "joinActivity", "createIntent", "confirmCalendarImport"):
                    self.assertIn("Idempotency-Key", names)

    def test_no_password_field_in_login_request(self):
        value = example("OidcStartRequest")
        value["password"] = "NOT_A_REAL_PASSWORD"
        self.assertFalse(valid("OidcStartRequest", value))

    def test_return_path_rejects_external_and_protocol_relative_urls(self):
        for path in ("https://example.com", "//example.com", "/%2fexample.com", "/\\example.com"):
            self.assertFalse(valid("OidcStartRequest", {"institution_id": "hkust-cwb", "return_path": path}))

    def test_email_control_cannot_be_active_membership(self):
        value = example("Membership")
        value.update(status="active", role="student", expires_at="2026-12-18T23:59:59+08:00")
        self.assertFalse(valid("Membership", value))
        value["verification"] = "approved_membership"
        self.assertTrue(valid("Membership", value))

    def test_anonymous_session_cannot_contain_a_profile(self):
        value = example("Session")
        value["profile"] = {"account_id": "example", "display_name": "Example", "email_verified": True, "memberships": []}
        self.assertFalse(valid("Session", value))

    def test_task_cannot_have_two_conflicting_deadline_representations(self):
        value = example("TaskCreate")
        value["due_at"] = "2026-10-06T12:00:00+08:00"
        self.assertFalse(valid("TaskCreate", value))

    def test_invalid_calendar_date_rejected(self):
        value = example("TaskCreate")
        value["due_date"] = "2026-02-30"
        self.assertFalse(valid("TaskCreate", value))

    def test_plan_does_not_allow_live_prediction(self):
        value = example("Departures")
        value["departures"][0]["prediction_at"] = "2026-10-02T08:21:00+08:00"
        self.assertFalse(valid("Departures", value))

    def test_no_service_cannot_return_departures(self):
        value = example("Departures")
        value["status"] = "no_service"
        self.assertFalse(valid("Departures", value))

    def test_stale_source_cannot_claim_scheduled(self):
        value = example("Departures")
        value["source"]["status"] = "stale"
        self.assertFalse(valid("Departures", value))

    def test_official_handoff_cannot_claim_booking_success(self):
        value = example("Handoff")
        value["booking_status"] = "confirmed"
        self.assertFalse(valid("Handoff", value))

    def test_external_activity_requires_url(self):
        value = example("ActivityCreate")
        value["registration_system"] = "external"
        self.assertFalse(valid("ActivityCreate", value))

    def test_school_activity_requires_institution(self):
        value = example("ActivityCreate")
        value["audience"] = "school_members"
        self.assertFalse(valid("ActivityCreate", value))

    def test_school_password_not_accepted_in_connection_request(self):
        value = {"capability": "calendar_basic", "return_path": "/today", "password": "NOT_A_REAL_PASSWORD"}
        self.assertFalse(valid("AuthorizeConnectionRequest", value))

    def test_upstream_revocation_not_assumed(self):
        value = example("DisconnectResult")
        self.assertTrue(valid("DisconnectResult", value))
        value["upstream_grant_revoked"] = True
        self.assertFalse(valid("DisconnectResult", value))


class ShuttleSpecificationTests(unittest.TestCase):
    def setUp(self):
        self.route = copy.deepcopy(FIXTURE["routes"][0])

    def check(self, instant, status, first=None, **kwargs):
        result = specification_departures(self.route, instant, **kwargs)
        self.assertEqual(result["status"], status)
        if first is not None:
            self.assertEqual(result["departures"][0], first)
        return result

    def test_weekday_before_first_bus(self):
        self.check("2026-10-02T08:00:00+08:00", "scheduled", "2026-10-02T08:15:00+08:00")

    def test_between_departures(self):
        self.check("2026-10-02T08:19:00+08:00", "scheduled", "2026-10-02T08:20:00+08:00")

    def test_exact_departure_is_not_promised_catchable(self):
        self.check("2026-10-02T08:20:00+08:00", "scheduled", "2026-10-02T08:25:00+08:00")

    def test_end_of_day_does_not_relabel_tomorrow(self):
        result = self.check("2026-10-02T09:00:00+08:00", "ended_for_day")
        self.assertEqual(result["departures"], [])
        self.assertEqual(result["next_service_date"], "2026-10-05")

    def test_weekend(self):
        self.check("2026-10-03T08:00:00+08:00", "no_service")

    def test_official_holiday(self):
        self.assertIn("2026-10-01", FIXTURE["holidays"])
        self.check("2026-10-01T08:00:00+08:00", "no_service")

    def test_before_term(self):
        self.check("2026-08-31T08:00:00+08:00", "not_started")

    def test_after_term(self):
        self.check("2026-12-21T08:00:00+08:00", "expired")

    def test_last_service_date_remains_valid(self):
        self.check("2026-12-18T08:19:00+08:00", "scheduled", "2026-12-18T08:20:00+08:00")

    def test_no_future_service_after_last_bus_of_term(self):
        result = self.check("2026-12-18T09:00:00+08:00", "ended_for_day")
        self.assertIsNone(result["next_service_date"])

    def test_utc_is_converted_to_hong_kong_day(self):
        self.check("2026-10-01T23:00:00+00:00", "scheduled", "2026-10-02T08:15:00+08:00")

    def test_naive_timestamp_rejected(self):
        with self.assertRaises(ValueError):
            specification_departures(self.route, "2026-10-02T08:19:00")

    def test_missing_holiday_coverage_is_unknown(self):
        self.check("2026-10-02T08:19:00+08:00", "unknown", years=[])

    def test_stale_source(self):
        self.check("2026-10-02T08:19:00+08:00", "stale", fresh=False)

    def test_synthetic_verified_cancellation(self):
        self.check("2026-10-02T08:19:00+08:00", "suspended", cancelled=True)

    def test_synthetic_conflicting_notices(self):
        self.check("2026-10-02T08:19:00+08:00", "unknown", conflict=True)

    def test_evening_service_is_not_lost(self):
        self.route = copy.deepcopy(FIXTURE["routes"][2])
        self.check("2026-10-02T20:00:00+08:00", "scheduled", "2026-10-02T22:15:00+08:00")

    def test_sample_eligibility_and_zero_fare_are_distinct(self):
        free = FIXTURE["routes"][1]
        self.assertEqual(free["fare_minor"], 0)
        self.assertEqual(free["eligibility"], "student_only")
        self.assertEqual(self.route["eligibility"], "student_or_staff")


if __name__ == "__main__":
    stream = io.StringIO()
    suite = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    result = unittest.TextTestRunner(stream=stream, verbosity=2).run(suite)
    folder = API / "test-results"
    folder.mkdir(exist_ok=True)
    (folder / "contract-and-rules.txt").write_text(stream.getvalue())
    report = {"checked_at": dt.datetime.now(dt.timezone.utc).isoformat(),
              "scope": "Proposed schema contract and independent specification examples only. No implemented product HTTP or authentication tested.",
              "tests": result.testsRun, "failures": len(result.failures), "errors": len(result.errors),
              "skipped": len(result.skipped), "passed": result.testsRun - len(result.failures) - len(result.errors) - len(result.skipped),
              "product_auth_e2e": "blocked_not_implemented_and_no_approved_institutional_config"}
    (folder / "contract-and-rules.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))
    if not result.wasSuccessful():
        print(stream.getvalue())
    sys.exit(0 if result.wasSuccessful() else 1)
