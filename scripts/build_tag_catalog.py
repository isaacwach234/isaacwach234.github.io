#!/usr/bin/env python3
"""Build a catalog of Danbooru tags enriched with metadata for categorization.

This script downloads tag information from Danbooru's public API and stores a
compact catalog in ``generated/tag_catalog.json``.  The catalog includes each
retrieved tag's type, post count, canonical category hints and the most
frequently co-occurring tags (as reported by Danbooru).  ``EnhancedTagCategorizer``
consumes this file to infer reasonable default categories for tags that do not
exist in ``tag_map.json``.

Example usage
-------------

    python scripts/build_tag_catalog.py --limit 25000

For authenticated requests (recommended to avoid strict rate limits), supply
your Danbooru username and API key:

    python scripts/build_tag_catalog.py --user YOUR_NAME --api-key YOUR_KEY

"""

from __future__ import annotations

import argparse
import base64
import json
import sys
import time
from collections import Counter
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional
from urllib import error, parse, request

API_BASE_URL = "https://danbooru.donmai.us"
DEFAULT_OUTPUT = "generated/tag_catalog.json"
CATEGORY_ID_MAP = {
    0: "general",
    1: "artist",
    3: "copyright",
    4: "character",
    5: "meta",
}
CANONICAL_CATEGORY_MAP = {
    "danbooru:artist": "Artists",
    "danbooru:character": "Characters",
    "danbooru:meta": "Style & Meta",
    "danbooru:copyright": "Subject & Creatures",
    "danbooru:general": None,
}


@dataclass
class CatalogEntry:
    """Container for the curated metadata we persist in the catalog."""

    name: str
    post_count: int
    tag_type: Optional[str]
    category_id: Optional[int]
    category_name: Optional[str]
    is_deprecated: bool
    is_locked: bool
    related_tags: List[Dict[str, object]]
    category_hints: List[str]
    canonical_categories: List[str]
    cooccurrence_hints: List[Dict[str, object]]

    def to_json(self) -> Dict[str, object]:
        return {
            "tag_type": self.tag_type,
            "category_id": self.category_id,
            "category_name": self.category_name,
            "post_count": self.post_count,
            "is_deprecated": self.is_deprecated,
            "is_locked": self.is_locked,
            "category_hints": self.category_hints,
            "canonical_categories": [c for c in self.canonical_categories if c],
            "related_tags": self.related_tags,
            "cooccurrence_hints": self.cooccurrence_hints,
        }


def parse_args(argv: Optional[Iterable[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download Danbooru tag metadata and build generated/tag_catalog.json",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=25000,
        help="Maximum number of tags to include (ordered by Danbooru's count order).",
    )
    parser.add_argument(
        "--page-size",
        type=int,
        default=1000,
        help="Number of tags to request per API call (max 1000).",
    )
    parser.add_argument(
        "--order",
        default="count",
        help="Danbooru tag ordering (e.g. count, name, date).",
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT,
        help="Destination JSON file for the generated catalog.",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=1.0,
        help="Seconds to wait between API calls to respect rate limits.",
    )
    parser.add_argument(
        "--retries",
        type=int,
        default=4,
        help="Number of retry attempts for transient HTTP errors.",
    )
    parser.add_argument(
        "--user",
        help="Danbooru username for authenticated requests (optional).",
    )
    parser.add_argument(
        "--api-key",
        dest="api_key",
        help="Danbooru API key for authenticated requests (optional).",
    )
    parser.add_argument(
        "--base-url",
        default=API_BASE_URL,
        help="Override the Danbooru API base URL (useful for mirrors/testing).",
    )
    parser.add_argument(
        "--min-post-count",
        type=int,
        default=0,
        help="Skip tags with a post_count lower than this threshold.",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Print verbose progress information to stderr.",
    )
    return parser.parse_args(list(argv) if argv is not None else None)


def build_auth_header(username: Optional[str], api_key: Optional[str]) -> Optional[str]:
    if not username or not api_key:
        return None
    token = base64.b64encode(f"{username}:{api_key}".encode("utf-8")).decode("utf-8")
    return f"Basic {token}"


def request_json(url: str, headers: Dict[str, str], retries: int, sleep_seconds: float) -> List[Dict[str, object]]:
    attempt = 0
    while True:
        try:
            req = request.Request(url, headers=headers)
            with request.urlopen(req, timeout=45) as resp:
                return json.load(resp)
        except error.HTTPError as exc:
            if exc.code in {429, 503} and attempt < retries:
                wait = sleep_seconds * (2 ** attempt)
                time.sleep(wait)
                attempt += 1
                continue
            message = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"HTTP {exc.code} when requesting {url}: {message}") from exc
        except error.URLError as exc:  # Network hiccup
            if attempt < retries:
                wait = sleep_seconds * (2 ** attempt)
                time.sleep(wait)
                attempt += 1
                continue
            raise RuntimeError(f"Network error contacting Danbooru: {exc}") from exc


def fetch_tag_page(
    base_url: str,
    order: str,
    page_size: int,
    page_number: int,
    auth_header: Optional[str],
    retries: int,
    sleep_seconds: float,
    debug: bool,
) -> List[Dict[str, object]]:
    params = {
        "limit": min(1000, max(1, page_size)),
        "page": page_number,
        "search[order]": order,
    }
    url = f"{base_url.rstrip('/')}/tags.json?{parse.urlencode(params)}"
    headers = {
        "User-Agent": "tag-catalog-builder/1.0 (+https://github.com/isaacwach234)"
    }
    if auth_header:
        headers["Authorization"] = auth_header
    if debug:
        print(f"Requesting {url}", file=sys.stderr)
    data = request_json(url, headers, retries=retries, sleep_seconds=sleep_seconds)
    if sleep_seconds:
        time.sleep(sleep_seconds)
    return data


def parse_related_tags(raw: Optional[str]) -> List[Dict[str, object]]:
    if not raw:
        return []
    tokens = raw.strip().split()
    related = []
    for idx in range(0, len(tokens) - 1, 2):
        name = tokens[idx]
        try:
            score = float(tokens[idx + 1])
        except (ValueError, TypeError):
            continue
        related.append({"name": name, "score": score})
    return related


def normalize_hint(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = str(value).strip().lower()
    if not normalized:
        return None
    if not normalized.startswith("danbooru:"):
        normalized = f"danbooru:{normalized}"
    return normalized


def extract_category_hints(tag: Dict[str, object]) -> List[str]:
    hints = set()
    for key in ("category_name", "tag_type", "type", "category"):
        value = tag.get(key)
        if value is None:
            continue
        if isinstance(value, int):
            mapped = CATEGORY_ID_MAP.get(value)
            if mapped is not None:
                hints.add(normalize_hint(mapped))
        else:
            hints.add(normalize_hint(value))
    extra_hints = tag.get("category_hints")
    if isinstance(extra_hints, list):
        for hint in extra_hints:
            normalized = normalize_hint(hint)
            if normalized:
                hints.add(normalized)
    return sorted(hints)


def map_canonical_categories(hints: Iterable[str]) -> List[str]:
    categories = []
    for hint in hints:
        mapped = CANONICAL_CATEGORY_MAP.get(hint)
        if mapped is None:
            continue
        categories.append(mapped)
    return sorted(set(categories))


def compute_cooccurrence_hints(catalog: Dict[str, CatalogEntry], top_related: int = 10) -> None:
    # Build a quick lookup for canonical categories.
    canonical_lookup = {name: entry.canonical_categories for name, entry in catalog.items()}
    for name, entry in catalog.items():
        if entry.canonical_categories:
            # Direct metadata is strong enough; still compute hints for reference.
            pass
        counts: Counter[str] = Counter()
        for related in entry.related_tags[:top_related]:
            related_name = related.get("name")
            if not related_name:
                continue
            related_categories = canonical_lookup.get(related_name, [])
            if not related_categories:
                continue
            weight = float(related.get("score", 1.0))
            for category in related_categories:
                counts[category] += weight
        if counts:
            entry.cooccurrence_hints = [
                {"category": category, "score": round(score, 3)}
                for category, score in counts.most_common(5)
            ]
        else:
            entry.cooccurrence_hints = []


def build_catalog(args: argparse.Namespace) -> Dict[str, CatalogEntry]:
    catalog: Dict[str, CatalogEntry] = {}
    auth_header = build_auth_header(args.user, args.api_key)
    total_downloaded = 0
    page_number = 1

    while args.limit is None or total_downloaded < args.limit:
        page = fetch_tag_page(
            base_url=args.base_url,
            order=args.order,
            page_size=args.page_size,
            page_number=page_number,
            auth_header=auth_header,
            retries=args.retries,
            sleep_seconds=args.sleep,
            debug=args.debug,
        )
        if not page:
            break
        for tag in page:
            name = tag.get("name")
            if not name:
                continue
            post_count = int(tag.get("post_count", 0))
            if post_count < args.min_post_count:
                continue
            related_tags = parse_related_tags(tag.get("related_tags"))
            hints = extract_category_hints(tag)
            canonical_categories = map_canonical_categories(hints)
            tag_type_raw = tag.get("tag_type")
            if tag_type_raw is None:
                tag_type_raw = tag.get("type")
            tag_type = None
            if tag_type_raw not in (None, ""):
                tag_type = str(tag_type_raw)

            category_name = tag.get("category_name")
            if category_name is not None:
                category_name = str(category_name)

            entry = CatalogEntry(
                name=name,
                post_count=post_count,
                tag_type=tag_type,
                category_id=tag.get("category"),
                category_name=category_name,
                is_deprecated=bool(tag.get("is_deprecated", False)),
                is_locked=bool(tag.get("is_locked", False)),
                related_tags=related_tags,
                category_hints=hints,
                canonical_categories=canonical_categories,
                cooccurrence_hints=[],
            )
            catalog[name] = entry
            total_downloaded += 1
            if args.limit and total_downloaded >= args.limit:
                break
        if args.limit and total_downloaded >= args.limit:
            break
        page_number += 1
        if args.debug:
            print(f"Downloaded {total_downloaded} tags so far...", file=sys.stderr)
    compute_cooccurrence_hints(catalog)
    return catalog


def main(argv: Optional[Iterable[str]] = None) -> None:
    args = parse_args(argv)
    try:
        catalog = build_catalog(args)
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    if not catalog:
        print("Warning: catalog is empty; no data written.", file=sys.stderr)
        sys.exit(2)

    output_path = args.output
    with open(output_path, "w", encoding="utf-8") as fh:
        json.dump({name: entry.to_json() for name, entry in sorted(catalog.items())}, fh, indent=2)
        fh.write("\n")
    if args.debug:
        print(f"Wrote {len(catalog)} tags to {output_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
