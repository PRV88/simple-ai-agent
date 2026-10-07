#!/usr/bin/env python3
"""
Ragas Evaluation CLI Runner for Simple AI RAG Applications.

Evaluates:
1. Faithfulness: Factual consistency of generated response against retrieved knowledge.
2. Answer Relevancy: How directly and specifically the answer addresses the query.
3. Context Precision: Signal-to-noise ratio in retrieved context vectors.
4. Context Recall: Whether all relevant ground-truth facts were successfully retrieved.

Usage:
    uv run python scripts/evaluate_ragas.py
    uv run python scripts/evaluate_ragas.py --dataset path/to/dataset.json --output reports/eval.json
"""

import argparse
import asyncio
import json
import logging
import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from simple_ai.database import close_db_pool, init_db
from simple_ai.services.ragas_service import ragas_service
from simple_ai.repositories.document_repository import document_repository

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("evaluate_ragas")

DEFAULT_BENCHMARK = [
    {
        "question": "What core services make up the simple-ai backend architecture?",
        "ground_truth": "The architecture comprises ETService for ingestion, RAGService for retrieval and agent reasoning, and AuthService for multitenancy.",
    },
    {
        "question": "How are document embeddings stored and queried?",
        "ground_truth": "Document chunks and embeddings are stored in PostgreSQL using the pgvector extension with cosine distance indexes.",
    },
    {
        "question": "What security controls and transport policies are enforced?",
        "ground_truth": "The application enforces RFC 6797 HTTP Strict Transport Security (HSTS), TLS enforcement, secure cookie headers, and JWT authentication.",
    },
]


def print_banner():
    print("=" * 70)
    print("               SIMPLE AI - RAGAS EVALUATION RUNNER")
    print("   Evaluating Faithfulness, Relevancy, Context Precision & Recall")
    print("=" * 70)


def print_results_table(summary_scores: dict, total_samples: int):
    print("\n" + "-" * 70)
    print(f" EVALUATION SUMMARY ({total_samples} test samples)")
    print("-" * 70)
    print(f" {'Metric':<25} | {'Score':<10} | {'Status'}")
    print("-" * 70)

    for metric, score in summary_scores.items():
        name_display = metric.replace("_", " ").title()
        if score >= 0.85:
            status = "EXCELLENT"
        elif score >= 0.70:
            status = "GOOD"
        elif score >= 0.50:
            status = "FAIR"
        else:
            status = "NEEDS IMPROVEMENT"
        print(f" {name_display:<25} | {score:<10.4f} | {status}")
    print("-" * 70 + "\n")


async def main():
    parser = argparse.ArgumentParser(description="Evaluate RAG pipeline using Ragas")
    parser.add_argument("--dataset", type=str, help="Path to custom JSON dataset file")
    parser.add_argument(
        "--output",
        type=str,
        default="reports/ragas_evaluation_report.json",
        help="Path to save evaluation report",
    )
    parser.add_argument(
        "--user-id", type=int, default=None, help="Admin user ID to scope document retrieval"
    )
    args = parser.parse_args()

    print_banner()

    await init_db()

    try:
        if args.dataset:
            with open(args.dataset, "r", encoding="utf-8") as f:
                test_cases = json.load(f)
            logger.info(f"Loaded {len(test_cases)} test cases from {args.dataset}")
        else:
            logger.info("Using default enterprise RAG benchmark suite.")
            test_cases = DEFAULT_BENCHMARK

        logger.info("Executing live RAG pipeline queries and grading with Ragas...")
        results = await ragas_service.evaluate_live_pipeline(
            test_cases=test_cases,
            user_id=args.user_id,
            system_prompt="You are a helpful, professional enterprise AI assistant. Ground your answers strictly in the knowledge documents.",
            guardrails="Maintain factual accuracy and cite relevant knowledge sources.",
        )

        print_results_table(results.get("summary_scores", {}), results.get("total_samples", 0))

        # Save output report
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        logger.info(f"Evaluation report successfully saved to {out_path.resolve()}")

    finally:
        await close_db_pool()


if __name__ == "__main__":
    asyncio.run(main())
