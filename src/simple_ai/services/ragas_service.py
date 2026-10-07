import logging
from typing import Any, Dict, List, Optional
from openai import OpenAI

from simple_ai.config import API_KEY, BASE_URL, EMBEDDING_MODEL, MODEL
from simple_ai.services.rag_service import rag_service

logger = logging.getLogger("simple_ai.services.ragas")

try:
    from datasets import Dataset
    from ragas import evaluate
    from ragas.embeddings.base import BaseRagasEmbeddings
    from ragas.llms import llm_factory
    from ragas.metrics import (
        answer_relevancy,
        context_precision,
        context_recall,
        faithfulness,
    )
    RAGAS_AVAILABLE = True
except Exception as e:
    logger.warning(f"Ragas evaluation libraries not loaded in serverless runtime: {e}")
    RAGAS_AVAILABLE = False
    BaseRagasEmbeddings = object
    Dataset = object


class GeminiRagasEmbeddings(BaseRagasEmbeddings):
    """Custom Ragas Embeddings adapter for Gemini via OpenAI-compatible API."""

    def __init__(self):
        super().__init__()
        self.client = OpenAI(
            api_key=API_KEY or "dummy-api-key-for-test-environments",
            base_url=BASE_URL,
        )
        self.model = EMBEDDING_MODEL

    def embed_query(self, text: str) -> List[float]:
        res = self.client.embeddings.create(model=self.model, input=[text])
        return res.data[0].embedding

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        res = self.client.embeddings.create(model=self.model, input=texts)
        return [d.embedding for d in res.data]

    def embed_text(self, text: str) -> List[float]:
        return self.embed_query(text)

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        return self.embed_documents(texts)

    async def aembed_query(self, text: str) -> List[float]:
        return self.embed_query(text)

    async def aembed_documents(self, texts: List[str]) -> List[List[float]]:
        return self.embed_documents(texts)

    async def aembed_text(self, text: str) -> List[float]:
        return self.embed_query(text)

    async def aembed_texts(self, texts: List[str]) -> List[List[float]]:
        return self.embed_documents(texts)


class RagasService:
    """Service for running Ragas evaluations on RAG responses and pipelines."""

    def __init__(self):
        self._llm = None
        self._embeddings = None

    def _get_evaluator_llm(self):
        if self._llm is None:
            client = OpenAI(
                api_key=API_KEY or "dummy-api-key-for-test-environments",
                base_url=BASE_URL,
            )
            self._llm = llm_factory(MODEL, client=client)
            if hasattr(self._llm, "model_args") and isinstance(self._llm.model_args, dict):
                self._llm.model_args["max_tokens"] = 4096
        return self._llm

    def _get_evaluator_embeddings(self):
        if self._embeddings is None:
            self._embeddings = GeminiRagasEmbeddings()
        return self._embeddings

    def evaluate_dataset(
        self,
        questions: List[str],
        answers: List[str],
        contexts: List[List[str]],
        ground_truths: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Runs Ragas evaluation on provided RAG inputs.
        
        Metrics:
        - faithfulness: Factual consistency of answer against retrieved context
        - answer_relevancy: Relevance of answer to question
        - context_precision: Signal-to-noise ratio in retrieved context (if ground_truth provided)
        - context_recall: Completeness of retrieved context (if ground_truth provided)
        """
        if not RAGAS_AVAILABLE:
            raise RuntimeError("Ragas framework is not installed or available.")

        if not questions or not answers or not contexts:
            return {
                "error": "Questions, answers, and contexts must not be empty.",
                "scores": {},
                "breakdown": [],
            }

        eval_llm = self._get_evaluator_llm()
        eval_emb = self._get_evaluator_embeddings()

        metrics = [faithfulness, answer_relevancy]
        faithfulness.llm = eval_llm
        answer_relevancy.llm = eval_llm
        answer_relevancy.embeddings = eval_emb

        data_dict = {
            "question": questions,
            "answer": answers,
            "contexts": contexts,
        }

        if ground_truths and len(ground_truths) == len(questions):
            data_dict["ground_truth"] = ground_truths
            context_precision.llm = eval_llm
            context_recall.llm = eval_llm
            metrics.extend([context_precision, context_recall])

        hf_dataset = Dataset.from_dict(data_dict)

        logger.info(f"Running Ragas evaluation across {len(questions)} test items...")
        raw_results = evaluate(
            dataset=hf_dataset,
            metrics=metrics,
            llm=eval_llm,
            embeddings=eval_emb,
            show_progress=False,
        )

        import pandas as pd
        df = raw_results.to_pandas()
        breakdown = df.to_dict(orient="records")

        # Clean NaN values in breakdown records for JSON serialization
        for item in breakdown:
            for k, v in item.items():
                if isinstance(v, float) and (v != v):  # NaN check
                    item[k] = 0.0

        # Compute summary scores using DataFrame columns
        summary_scores: Dict[str, float] = {}
        for metric_name in ["faithfulness", "answer_relevancy", "context_precision", "context_recall"]:
            if metric_name in df.columns:
                mean_val = df[metric_name].mean()
                summary_scores[metric_name] = round(float(mean_val), 4) if pd.notna(mean_val) else 0.0

        return {
            "total_samples": len(questions),
            "summary_scores": summary_scores,
            "breakdown": breakdown,
        }

    async def evaluate_live_pipeline(
        self,
        test_cases: List[Dict[str, str]],
        user_id: Optional[int] = None,
        agent_id: Optional[str] = None,
        system_prompt: Optional[str] = None,
        guardrails: Optional[str] = None,
        model_name: str = MODEL,
    ) -> Dict[str, Any]:
        """
        Runs live queries through the actual application RAG pipeline
        (retrieval -> grounding -> agent generation), captures actual contexts
        and generated answers, then grades with Ragas.

        test_cases format:
        [
            {"question": "...", "ground_truth": "..."},
            ...
        ]
        """
        questions: List[str] = []
        answers: List[str] = []
        contexts: List[List[str]] = []
        ground_truths: List[str] = []

        for tc in test_cases:
            q = tc["question"]
            gt = tc.get("ground_truth", "")

            # Execute real pipeline
            rag_res = await rag_service.answer_with_rag(
                query=q,
                use_knowledge_base=True,
                user_id=user_id,
                agent_id=agent_id,
                system_prompt=system_prompt,
                guardrails=guardrails,
                model_name=model_name,
                source="ragas_eval",
            )

            generated_answer = rag_res.get("answer", "")
            citations = rag_res.get("citations", [])
            retrieved_chunk_texts = [
                c.get("content_preview", "") for c in citations if c.get("content_preview")
            ]
            if not retrieved_chunk_texts:
                retrieved_chunk_texts = ["No relevant document context found."]

            questions.append(q)
            answers.append(generated_answer)
            contexts.append(retrieved_chunk_texts)
            if gt:
                ground_truths.append(gt)

        has_ground_truth = len(ground_truths) == len(questions)
        return self.evaluate_dataset(
            questions=questions,
            answers=answers,
            contexts=contexts,
            ground_truths=ground_truths if has_ground_truth else None,
        )


ragas_service = RagasService()
