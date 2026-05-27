#!/usr/bin/env python3
"""Embed and cluster NetSci program records.

The workflow is intentionally file-based:

1. `embed-netsci` writes NetSci vectors to JSONL.
2. `cluster-netsci` groups NetSci vectors with UMAP + HDBSCAN.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any


DEFAULT_MODEL = "gemini-embedding-2-preview"
DEFAULT_OUT_DIR = Path("data/similarity-content")
DEFAULT_DATA_DIR = Path("data")


def load_env_file(path: Path, *, override: bool = False) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and (override or key not in os.environ):
            os.environ[key] = value


def env_int(name: str) -> int | None:
    value = os.getenv(name)
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        raise SystemExit(f"{name} must be an integer, got {value!r}")


def parse_args() -> argparse.Namespace:
    argv = [arg for arg in sys.argv[1:] if arg != "--"]
    env_file = Path(".env.similarity")
    for index, arg in enumerate(argv):
        if arg == "--env-file" and index + 1 < len(argv):
            env_file = Path(argv[index + 1])
            break
        if arg.startswith("--env-file="):
            env_file = Path(arg.split("=", 1)[1])
            break
    load_env_file(env_file)
    load_env_file(Path(f"{env_file}.local"), override=True)

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command",
        choices=[
            "all",
            "embed-netsci",
            "cluster-netsci",
        ],
        nargs="?",
        default="all",
    )
    parser.add_argument("--env-file", type=Path, default=env_file)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_DIR)
    parser.add_argument("--model", default=os.getenv("ACTIVE_EMBEDDING_MODEL", DEFAULT_MODEL))
    parser.add_argument("--dimensions", type=int, default=env_int("EMBEDDING_DIMENSIONS"))
    parser.add_argument("--top-k", type=int, default=20)
    parser.add_argument("--include-breaks", action="store_true")
    parser.add_argument("--netsci-limit", type=int, default=None)
    parser.add_argument(
        "--cluster-kinds",
        default="talk,poster",
        help="Comma-separated record kinds to cluster, or 'all'. Defaults to talk,poster.",
    )
    parser.add_argument("--cluster-dedupe-title", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--umap-neighbors", type=int, default=8)
    parser.add_argument("--umap-components", type=int, default=10)
    parser.add_argument("--umap-min-dist", type=float, default=0.0)
    parser.add_argument("--hdbscan-min-cluster-size", type=int, default=6)
    parser.add_argument("--hdbscan-min-samples", type=int, default=2)
    parser.add_argument("--cluster-random-state", type=int, default=42)
    parser.add_argument("--cluster-match-k", type=int, default=3)

    parser.add_argument("--gemini-api-key", default=os.getenv("GEMINI_API_KEY"))
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--retries", type=int, default=4)
    return parser.parse_args(argv)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_jsonl(path: Path, records: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    records = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                records.append(json.loads(line))
    return records


def compact_text(parts: list[Any]) -> str:
    text = " ".join(str(part).strip() for part in parts if part is not None and str(part).strip())
    return re.sub(r"\s+", " ", text).strip()


def build_netsci_docs(data_dir: Path, include_breaks: bool) -> list[dict[str, Any]]:
    sessions = read_json(data_dir / "sessions.json")
    talks = read_json(data_dir / "talks.json")
    posters = read_json(data_dir / "posters.json")
    docs: list[dict[str, Any]] = []

    for session in sessions:
        if not include_breaks and session.get("type") == "break":
            continue
        docs.append(
            {
                "id": f"session:{session['id']}",
                "kind": "session",
                "sourceId": session["id"],
                "title": session.get("title", ""),
                "metadata": {
                    "dayKey": session.get("dayKey"),
                    "dayLabel": session.get("dayLabel"),
                    "type": session.get("type"),
                    "room": session.get("room"),
                    "time": session.get("time"),
                    "talkCount": session.get("talkCount", 0),
                },
                "text": compact_text(
                    [
                        f"NetSci 2026 session: {session.get('title', '')}",
                        f"Description: {session.get('desc')}" if session.get("desc") else None,
                        f"Talk title: {session.get('talkTitle')}" if session.get("talkTitle") else None,
                        f"Abstract: {session.get('abstract')}" if session.get("abstract") else None,
                    ]
                ),
            }
        )

    for talk in talks:
        docs.append(
            {
                "id": f"talk:{talk['id']}",
                "kind": "talk",
                "sourceId": str(talk["id"]),
                "title": talk.get("title", ""),
                "metadata": {
                    "presenter": talk.get("presenter"),
                    "authors": talk.get("authors"),
                    "dayKey": talk.get("dayKey"),
                    "dayLabel": talk.get("dayLabel"),
                    "sessionId": talk.get("sessionId"),
                    "sessionTitle": talk.get("sessionTitle"),
                    "sessionType": talk.get("sessionType"),
                    "sessionRoom": talk.get("sessionRoom"),
                    "time": talk.get("time"),
                },
                "text": compact_text(
                    [
                        f"NetSci 2026 talk: {talk.get('title', '')}",
                        f"Abstract: {talk.get('abstract')}" if talk.get("abstract") else None,
                        f"Session: {talk.get('sessionTitle')}",
                    ]
                ),
            }
        )

    for poster in posters:
        docs.append(
            {
                "id": f"poster:{poster['num']}",
                "kind": "poster",
                "sourceId": str(poster["num"]),
                "title": poster.get("title", ""),
                "metadata": {
                    "num": poster.get("num"),
                    "posterNum": poster.get("posterNum"),
                    "presenter": poster.get("presenter"),
                    "authors": poster.get("authors"),
                },
                "text": compact_text(
                    [
                        f"NetSci 2026 poster: {poster.get('title', '')}",
                        f"Abstract: {poster.get('abstract')}" if poster.get("abstract") else None,
                    ]
                ),
            }
        )

    return docs


def l2_normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in vector))
    if not math.isfinite(norm) or norm <= 0:
        return [0.0 for _ in vector]
    return [value / norm for value in vector]


def normalize_vector(vector: Any, dimensions: int | None) -> list[float]:
    if not isinstance(vector, list):
        return []
    values = []
    for value in vector[:dimensions] if dimensions else vector:
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            parsed = 0.0
        values.append(parsed if math.isfinite(parsed) else 0.0)
    if dimensions:
        values.extend([0.0] * max(0, dimensions - len(values)))
    return l2_normalize(values)


def get_gemini_api_key(args: argparse.Namespace) -> str:
    if args.gemini_api_key:
        return args.gemini_api_key.strip()
    raise SystemExit("Missing Gemini API key. Set GEMINI_API_KEY.")


def gemini_embedding(args: argparse.Namespace, text: str) -> list[float]:
    api_key = get_gemini_api_key(args)
    dimensions = args.dimensions or 3072
    body = {
        "content": {"parts": [{"text": text}]},
        "taskType": "RETRIEVAL_DOCUMENT",
        "outputDimensionality": dimensions,
    }
    request = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{args.model}:embedContent",
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "x-goog-api-key": api_key,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Gemini embedding failed HTTP {error.code}: {error_body}") from error

    values = ((payload.get("embedding") or {}).get("values"))
    if not isinstance(values, list):
        raise RuntimeError(f"Gemini response missing embedding.values: {payload}")
    return normalize_vector(values, args.dimensions)


def embed_one(args: argparse.Namespace, doc: dict[str, Any]) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(args.retries + 1):
        try:
            vector = gemini_embedding(args, doc["text"])
            output = {key: value for key, value in doc.items() if key != "text"}
            output.update(
                {
                    "text": doc["text"],
                    "model": args.model,
                    "dimensions": len(vector),
                    "vector": vector,
                }
            )
            return output
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, RuntimeError) as error:
            last_error = error
            if attempt >= args.retries:
                break
            time.sleep(min(2**attempt, 10))
    raise RuntimeError(f"Failed to embed {doc['id']}: {last_error}") from last_error


def embed_netsci(args: argparse.Namespace) -> None:
    docs = build_netsci_docs(args.data, args.include_breaks)
    if args.netsci_limit:
        docs = docs[: args.netsci_limit]
    vectors: list[dict[str, Any]] = []

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(embed_one, args, doc): doc for doc in docs}
        for index, future in enumerate(as_completed(futures), start=1):
            vectors.append(future.result())
            if index % 25 == 0 or index == len(docs):
                print(f"Embedded NetSci {index}/{len(docs)}")

    vectors.sort(key=lambda record: record["id"])
    write_jsonl(args.out / "netsci-vectors.jsonl", vectors)
    write_json(
        args.out / "netsci-meta.json",
        {
            "model": args.model,
            "dimensions": args.dimensions or (len(vectors[0]["vector"]) if vectors else None),
            "count": len(vectors),
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
    )
    print(f"Wrote {len(vectors)} NetSci vectors to {args.out / 'netsci-vectors.jsonl'}")


def dot(left: list[float], right: list[float]) -> float:
    return sum(a * b for a, b in zip(left, right))


def import_cluster_deps():
    try:
        import hdbscan  # type: ignore
        import numpy as np  # type: ignore
        import umap  # type: ignore
    except ImportError as error:
        raise SystemExit(
            "UMAP + HDBSCAN clustering requires numpy, umap-learn, and hdbscan. "
            "Run `uv sync`, then `uv run python scripts/similarity.py cluster-netsci`."
        ) from error
    return np, umap, hdbscan


def normalized_title_key(record: dict[str, Any]) -> str:
    title = re.sub(r"\s+", " ", str(record.get("title", "")).strip().lower())
    return title or str(record.get("id", ""))


def parse_cluster_kinds(value: str) -> set[str] | None:
    if value.strip().lower() == "all":
        return None
    kinds = {part.strip() for part in value.split(",") if part.strip()}
    if not kinds:
        raise SystemExit("--cluster-kinds must be a comma-separated list or 'all'")
    return kinds


def load_vector_matrix(
    path: Path,
    *,
    kinds: set[str] | None,
    dedupe_title: bool,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[int], Any, Any]:
    np, _umap, _hdbscan = import_cluster_deps()
    records = [
        record
        for record in read_jsonl(path)
        if isinstance(record.get("vector"), list)
        and record["vector"]
        and (kinds is None or str(record.get("kind")) in kinds)
    ]
    if not records:
        raise SystemExit(f"No usable vectors found in {path}")

    dimensions = len(records[0]["vector"])
    invalid = [record.get("id", "<unknown>") for record in records if len(record["vector"]) != dimensions]
    if invalid:
        preview = ", ".join(str(item_id) for item_id in invalid[:5])
        raise SystemExit(f"Found vectors with inconsistent dimensions in {path}: {preview}")

    fit_records: list[dict[str, Any]] = []
    fit_index_by_key: dict[str, int] = {}
    record_fit_indices: list[int] = []
    for record in records:
        key = normalized_title_key(record) if dedupe_title else str(record.get("id", len(fit_records)))
        fit_index = fit_index_by_key.get(key)
        if fit_index is None:
            fit_index = len(fit_records)
            fit_index_by_key[key] = fit_index
            fit_records.append(record)
        record_fit_indices.append(fit_index)

    matrix = np.asarray([record["vector"] for record in fit_records], dtype=np.float32)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    matrix = matrix / norms
    return records, fit_records, record_fit_indices, matrix, np


def summarize_cluster(
    records: list[dict[str, Any]],
    fit_records: list[dict[str, Any]],
    record_fit_indices: list[int],
    matrix: Any,
    labels: Any,
    probabilities: Any,
    cluster_label: int,
    top_k: int,
) -> dict[str, Any]:
    np, _umap, _hdbscan = import_cluster_deps()
    indices = np.flatnonzero(labels == cluster_label)
    centroid = matrix[indices].mean(axis=0)
    norm = np.linalg.norm(centroid)
    if norm > 0:
        centroid = centroid / norm
    ranked_indices = sorted(
        (int(index) for index in indices),
        key=lambda index: float(np.dot(matrix[index], centroid)),
        reverse=True,
    )
    representatives = []
    for index in ranked_indices[:top_k]:
        record = fit_records[index]
        representatives.append(
            {
                "id": record["id"],
                "kind": record.get("kind"),
                "title": record.get("title", ""),
                "metadata": record.get("metadata", {}),
                "centroidScore": float(np.dot(matrix[index], centroid)),
                "probability": float(probabilities[index]),
            }
        )
    assigned_indices = [
        index
        for index, fit_index in enumerate(record_fit_indices)
        if int(labels[fit_index]) == int(cluster_label)
    ]
    assigned_probabilities = np.asarray([probabilities[record_fit_indices[index]] for index in assigned_indices])
    label_info = infer_cluster_label(representatives)
    return {
        "clusterId": int(cluster_label),
        **label_info,
        "size": int(len(assigned_indices)),
        "fitSize": int(len(indices)),
        "meanProbability": float(assigned_probabilities.mean()) if len(assigned_probabilities) else 0.0,
        "representatives": representatives,
    }


def compact_cluster_for_json(cluster: dict[str, Any]) -> dict[str, Any]:
    return {
        "clusterId": cluster["clusterId"],
        "label": cluster["label"],
        "description": cluster["description"],
        "size": cluster["size"],
        "fitSize": cluster["fitSize"],
        "meanProbability": cluster["meanProbability"],
        "representatives": [
            {
                "id": representative["id"],
                "centroidScore": representative["centroidScore"],
                "probability": representative["probability"],
            }
            for representative in cluster.get("representatives", [])
        ],
    }


def compact_assignment_for_json(assignment: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": assignment["id"],
        "clusterId": assignment["clusterId"],
        "probability": assignment["probability"],
        "topClusters": assignment.get("topClusters", []),
    }


def cluster_centroids(matrix: Any, labels: Any) -> dict[int, Any]:
    np, _umap, _hdbscan = import_cluster_deps()
    centroids = {}
    for label in sorted(int(label) for label in set(labels.tolist()) if int(label) != -1):
        indices = np.flatnonzero(labels == label)
        centroid = matrix[indices].mean(axis=0)
        norm = np.linalg.norm(centroid)
        if norm > 0:
            centroid = centroid / norm
        centroids[int(label)] = centroid
    return centroids


def top_cluster_matches(vector: Any, centroids: dict[int, Any], limit: int) -> list[dict[str, Any]]:
    np, _umap, _hdbscan = import_cluster_deps()
    ranked = sorted(
        (
            {
                "clusterId": cluster_id,
                "score": float(np.dot(vector, centroid)),
            }
            for cluster_id, centroid in centroids.items()
        ),
        key=lambda row: row["score"],
        reverse=True,
    )
    return ranked[: max(0, limit)]


def mean_centered_matrix(matrix: Any) -> Any:
    np, _umap, _hdbscan = import_cluster_deps()
    centered = matrix - matrix.mean(axis=0, keepdims=True)
    norms = np.linalg.norm(centered, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return centered / norms


def infer_cluster_label(representatives: list[dict[str, Any]]) -> dict[str, str]:
    text = " ".join(str(rep.get("title", "")).lower() for rep in representatives)

    def has(term: str) -> bool:
        if re.fullmatch(r"[a-z0-9-]+", term):
            return re.search(rf"(?<![a-z0-9]){re.escape(term)}(?![a-z0-9])", text) is not None
        return term in text

    def has_any(keywords: tuple[str, ...]) -> bool:
        return any(has(keyword) for keyword in keywords)

    rules = [
        (
            ("sciscigpt", "science of science", "scientific disagreement", "citation networks"),
            "Science of science and collaboration",
            "Research communities, collaboration structures, interdisciplinarity, and scientific careers.",
        ),
        (
            ("food", "molecular networks to diet", "nutritional", "plant chemicals", "therapeutic discovery"),
            "Food, nutrition, and network medicine",
            "Food compounds, nutrition, molecular networks, network medicine, and therapeutic discovery.",
        ),
        (
            ("gene co-methylation", "gene co-expression", "gene regulatory", "single-cell", "epigenetic"),
            "Gene regulatory and disease networks",
            "Gene coexpression, regulatory networks, disease modules, aging, and single-cell network analysis.",
        ),
        (
            ("epidemic", "sars-cov-2", "pandemic", "infectious"),
            "Epidemics and mobility",
            "Disease spread, epidemic forecasting, metapopulation models, and mobility-driven transmission.",
        ),
        (
            ("pairwise representation", "network reconstruction from dynamics", "transfer entropy", "minimum description length"),
            "Higher-order dynamics and reconstruction",
            "Higher-order interactions, dynamical inference, reconstruction, and control of networked systems.",
        ),
        (
            ("supply chain", "firm-level", "business-to-business", "trade vulnerabilities", "corporate exports"),
            "Economic production and firm networks",
            "Supply chains, firm-level networks, production systems, trade, and systemic economic risk.",
        ),
        (
            ("lifestyle embeddings", "accessibility", "time-use", "location-based recommender", "urban heat"),
            "Urban mobility and accessibility",
            "Human mobility, accessibility, lifestyle embeddings, urban inequality, and mobility-aware policy.",
        ),
        (
            ("urban multilayer", "polycentric", "urban space", "agglomeration", "urban-rural"),
            "Urban systems and spatial structure",
            "Urban spatial networks, city structure, agglomeration, urban-rural disparities, and spatial barriers.",
        ),
        (
            ("llm", "human-ai", "conspiracy", "infodemic", "recommendations"),
            "LLMs and human-AI information dynamics",
            "Large language models, human-AI interaction, recommender effects, misinformation, and information exposure.",
        ),
        (
            ("retweets", "reddit", "hate communities", "pornography on twitter", "information ecosystem"),
            "Online communities and information ecosystems",
            "Social media, online communities, toxicity, misinformation, and digital-trace networks.",
        ),
        (
            ("nested hyperedges", "hyperdegree", "randomise real-world hypergraphs", "rumor propagation on hypergraphs"),
            "Hypergraph contagion and collective transitions",
            "Hypergraph models, group interactions, collective transitions, and higher-order contagion.",
        ),
        (
            ("higher-order contagion", "opinion polarization", "q-voter", "bounded-confidence", "pagerank"),
            "Contagion, opinion, and network mechanisms",
            "Social contagion, opinion dynamics, preferential attachment, centrality feedback, and structural mechanisms.",
        ),
        (
            ("ecological networks", "photosystem", "bootstrap percolation", "predator", "hub survival"),
            "Ecological and biological percolation",
            "Percolation and robustness in ecological, biological, neuronal, and growing network models.",
        ),
        (
            ("renormalization", "coarse-graining", "shortest-path percolation", "laplacian"),
            "Percolation and multiscale network physics",
            "Percolation, renormalization, coarse-graining, shortest paths, and multiscale physical network models.",
        ),
        (
            ("stochastic block model", "maximum entropy", "network growth", "sampling-induced", "degree organization"),
            "Statistical graph models and inference",
            "Stochastic block models, maximum-entropy models, network growth, sampling bias, and model diagnostics.",
        ),
        (
            ("graph pooling", "message passing", "self-loop", "gnn", "graph generation"),
            "Graph machine learning",
            "Graph neural networks, message passing, graph pooling, graph generation, and graph learning systems.",
        ),
        (
            ("dismantling", "localized attacks", "robustness", "criminal network disruption", "backbones"),
            "Robustness, dismantling, and disruption",
            "Network robustness, targeted attacks, dismantling, disruption, and backbone extraction.",
        ),
        (
            ("community detection", "signed networks", "temporal interaction", "modular networks"),
            "Community detection and signed networks",
            "Community detection, signed or temporal networks, link prediction, modularity, and detectability.",
        ),
        (
            ("brain", "neuronal", "eeg", "granger", "neurodegenerative"),
            "Brain and neural networks",
            "Brain activity, neural interaction structure, higher-order neural features, and disease spreading on brain networks.",
        ),
        (
            ("art", "museums", "cultural diaspora", "creative careers", "ethical visibility"),
            "Art, culture, and representation networks",
            "Art institutions, cultural visibility, creative careers, representation, and cultural network mapping.",
        ),
        (
            ("hyperbolic", "spatial networks", "hidden metric space", "pore network", "bones"),
            "Geometric and spatial network embeddings",
            "Hyperbolic embeddings, hidden metric spaces, spatial networks, and geometry-aware network models.",
        ),
        (
            ("homophily", "polarization", "social ties", "village social networks", "collective opinion"),
            "Social ties, homophily, and polarization",
            "Social ties, homophily, affective polarization, consensus, and opinion intervention.",
        ),
        (
            ("kuramoto", "synchronization", "power grid", "grid stability", "phase lag"),
            "Synchronization and power-grid dynamics",
            "Synchronization processes, Kuramoto dynamics, coupled oscillators, and power-grid stability.",
        ),
    ]
    for keywords, label, description in rules:
        if has_any(keywords):
            return {"label": label, "description": description}
    return {
        "label": "Mixed network science methods",
        "description": "A mixed methodological cluster whose representatives need manual interpretation.",
    }


def cluster_netsci(args: argparse.Namespace) -> None:
    np, umap, hdbscan = import_cluster_deps()
    vector_path = args.out / "netsci-vectors.jsonl"
    cluster_kinds = parse_cluster_kinds(args.cluster_kinds)
    records, fit_records, record_fit_indices, matrix, _np = load_vector_matrix(
        vector_path,
        kinds=cluster_kinds,
        dedupe_title=args.cluster_dedupe_title,
    )
    if len(fit_records) < 3:
        raise SystemExit(f"Need at least 3 vectors to cluster, found {len(fit_records)} in {vector_path}")

    n_neighbors = min(args.umap_neighbors, len(fit_records) - 1)
    reducer = umap.UMAP(
        n_neighbors=n_neighbors,
        n_components=args.umap_components,
        min_dist=args.umap_min_dist,
        metric="cosine",
        random_state=args.cluster_random_state,
    )
    reduced = reducer.fit_transform(matrix)

    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=args.hdbscan_min_cluster_size,
        min_samples=args.hdbscan_min_samples,
        metric="euclidean",
        cluster_selection_method="eom",
    )
    labels = clusterer.fit_predict(reduced)
    probabilities = getattr(clusterer, "probabilities_", np.zeros(len(fit_records), dtype=np.float32))
    outlier_scores = getattr(clusterer, "outlier_scores_", np.zeros(len(fit_records), dtype=np.float32))
    cluster_labels = sorted(int(label) for label in set(labels.tolist()) if int(label) != -1)

    clusters = [
        summarize_cluster(records, fit_records, record_fit_indices, matrix, labels, probabilities, label, args.top_k)
        for label in cluster_labels
    ]
    clusters.sort(key=lambda cluster: cluster["size"], reverse=True)
    match_matrix = mean_centered_matrix(matrix)
    centroids = cluster_centroids(match_matrix, labels)

    assignments = []
    for index, record in enumerate(records):
        fit_index = record_fit_indices[index]
        top_clusters = top_cluster_matches(match_matrix[fit_index], centroids, args.cluster_match_k)
        assignments.append(
            {
                "id": record["id"],
                "kind": record.get("kind"),
                "title": record.get("title", ""),
                "metadata": record.get("metadata", {}),
                "clusterId": int(labels[fit_index]),
                "probability": float(probabilities[fit_index]),
                "outlierScore": float(outlier_scores[fit_index]),
                "umap": [float(value) for value in reduced[fit_index].tolist()],
                "fitRecordId": fit_records[fit_index]["id"],
                "topClusters": top_clusters,
            }
        )

    noise_count = sum(1 for assignment in assignments if int(assignment["clusterId"]) == -1)
    write_json(
        args.out / "netsci-clusters.json",
        {
            "schemaVersion": 2,
            "model": fit_records[0].get("model", args.model),
            "dimensions": fit_records[0].get("dimensions", len(fit_records[0]["vector"])),
            "source": str(vector_path),
            "recordCount": len(records),
            "fitRecordCount": len(fit_records),
            "clusterCount": len(clusters),
            "noiseCount": int(noise_count),
            "parameters": {
                "clusterKinds": sorted(cluster_kinds) if cluster_kinds is not None else "all",
                "clusterDedupeTitle": args.cluster_dedupe_title,
                "umapNeighbors": n_neighbors,
                "umapComponents": args.umap_components,
                "umapMinDist": args.umap_min_dist,
                "hdbscanMinClusterSize": args.hdbscan_min_cluster_size,
                "hdbscanMinSamples": args.hdbscan_min_samples,
                "randomState": args.cluster_random_state,
                "clusterMatchK": args.cluster_match_k,
                "clusterMatchSpace": "mean-centered-original-embedding",
            },
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "clusters": [compact_cluster_for_json(cluster) for cluster in clusters],
            "assignments": [compact_assignment_for_json(assignment) for assignment in assignments],
        },
    )

    with (args.out / "netsci-cluster-assignments.csv").open("w", encoding="utf-8", newline="") as handle:
        fieldnames = [
            "id",
            "kind",
            "title",
            "clusterId",
            "probability",
            "outlierScore",
            "fitRecordId",
            "topClusterIds",
            "topClusterScores",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for assignment in assignments:
            writer.writerow(
                {
                    "id": assignment["id"],
                    "kind": assignment["kind"],
                    "title": assignment["title"],
                    "clusterId": assignment["clusterId"],
                    "probability": f"{assignment['probability']:.6f}",
                    "outlierScore": f"{assignment['outlierScore']:.6f}",
                    "fitRecordId": assignment["fitRecordId"],
                    "topClusterIds": ";".join(str(match["clusterId"]) for match in assignment["topClusters"]),
                    "topClusterScores": ";".join(f"{match['score']:.6f}" for match in assignment["topClusters"]),
                }
            )

    with (args.out / "netsci-cluster-summary.csv").open("w", encoding="utf-8", newline="") as handle:
        fieldnames = [
            "clusterId",
            "label",
            "description",
            "size",
            "fitSize",
            "meanProbability",
            "representativeIds",
            "representativeTitles",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for cluster in clusters:
            representatives = cluster["representatives"][: min(5, len(cluster["representatives"]))]
            writer.writerow(
                {
                    "clusterId": cluster["clusterId"],
                    "label": cluster["label"],
                    "description": cluster["description"],
                    "size": cluster["size"],
                    "fitSize": cluster["fitSize"],
                    "meanProbability": f"{cluster['meanProbability']:.6f}",
                    "representativeIds": ";".join(rep["id"] for rep in representatives),
                    "representativeTitles": "; ".join(rep["title"] for rep in representatives),
                }
            )

    print(
        f"Clustered {len(records)} NetSci vectors ({len(fit_records)} fit records) into {len(clusters)} clusters "
        f"with {noise_count} noise records"
    )
    print(
        f"Wrote {args.out / 'netsci-clusters.json'}, "
        f"{args.out / 'netsci-cluster-summary.csv'}, and {args.out / 'netsci-cluster-assignments.csv'}"
    )


def main() -> None:
    args = parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    if args.command in ("all", "embed-netsci"):
        embed_netsci(args)
    if args.command in ("all", "cluster-netsci"):
        cluster_netsci(args)


if __name__ == "__main__":
    main()
