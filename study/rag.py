"""PDF processing + Retrieval-Augmented Generation with page citations.

Each student's documents and vectors are stored against their own user id - search never
crosses users. Vectors: OpenAI embeddings stored as float32, cosine similarity in NumPy
(the documents are small, so a separate FAISS server is unnecessary). If embeddings are
unavailable, a transparent keyword (TF-IDF style) retriever is used and labelled as such.
"""
from __future__ import annotations

import math
import re
from collections import Counter

import numpy as np
from django.conf import settings

from . import ai
from .models import Chunk, Document

CHUNK_CHARS = 1000
OVERLAP = 150
STOP = set("the a an and or of to in is are was were be been for on with as by at from that this it its into "
           "which what how why when where who can will may also not no than then there their these those such".split())


class PDFError(Exception):
    pass


def validate_pdf(f):
    if not f.name.lower().endswith(".pdf"):
        raise PDFError("Only PDF files are allowed.")
    if f.size > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise PDFError(f"File is larger than {settings.MAX_UPLOAD_MB} MB.")
    head = f.read(5)
    f.seek(0)
    if head != b"%PDF-":
        raise PDFError("This file is not a valid PDF.")


def extract_pages(path):
    import pymupdf as fitz  # PyMuPDF

    try:
        doc = fitz.open(path)
    except Exception as exc:  # noqa: BLE001
        raise PDFError("The PDF could not be opened (it may be corrupted or password-protected).") from exc
    if doc.needs_pass:
        raise PDFError("Password-protected PDFs are not supported.")
    if doc.page_count > settings.MAX_PDF_PAGES:
        raise PDFError(f"The PDF has {doc.page_count} pages; the limit is {settings.MAX_PDF_PAGES}.")
    pages = [(i + 1, page.get_text("text")) for i, page in enumerate(doc)]
    doc.close()
    return pages


def chunk_pages(pages):
    chunks = []
    for page_no, text in pages:
        text = re.sub(r"[ \t]+", " ", text).strip()
        if not text:
            continue
        start = 0
        while start < len(text):
            piece = text[start:start + CHUNK_CHARS]
            if len(piece.strip()) > 40:
                chunks.append((page_no, piece.strip()))
            start += CHUNK_CHARS - OVERLAP
    return chunks


def ingest(user, document: Document):
    pages = extract_pages(document.file.path)
    document.pages = len(pages)
    pieces = chunk_pages(pages)
    if not pieces:
        document.status = "no_text"
        document.save()
        return document
    vectors = None
    if ai.ai_configured():
        try:
            vectors = ai.embed(user, [p[1] for p in pieces])
        except ai.AIError:
            vectors = None
    Chunk.objects.bulk_create([
        Chunk(document=document, page=pg, text=tx,
              embedding=np.asarray(vectors[i], dtype=np.float32).tobytes() if vectors else None)
        for i, (pg, tx) in enumerate(pieces)])
    document.retrieval = "embedding" if vectors else "keyword"
    document.status = "ready"
    document.save()
    return document


def _tokens(s):
    return [w for w in re.findall(r"[a-z0-9]+", s.lower()) if w not in STOP and len(w) > 1]


def keyword_search(chunks, query, k):
    q = _tokens(query)
    if not q:
        return []
    docs = [Counter(_tokens(c.text)) for c in chunks]
    n = len(docs)
    df = Counter(w for d in docs for w in set(d))
    scored = []
    for c, d in zip(chunks, docs):
        s = sum((d[w] / (1 + sum(d.values()) ** 0.5)) * math.log(1 + n / (1 + df[w])) for w in q if d[w])
        if s > 0:
            scored.append((s, c))
    scored.sort(key=lambda x: -x[0])
    return [c for _, c in scored[:k]]


def retrieve(user, document: Document, query, k=5):
    chunks = list(document.chunks.all())  # document already verified to belong to `user`
    if not chunks:
        return [], "none"
    if document.retrieval == "embedding" and all(c.embedding for c in chunks):
        try:
            qv = np.asarray(ai.embed(user, [query])[0], dtype=np.float32)
            mat = np.stack([np.frombuffer(bytes(c.embedding), dtype=np.float32) for c in chunks])
            sims = mat @ qv / (np.linalg.norm(mat, axis=1) * np.linalg.norm(qv) + 1e-9)
            idx = np.argsort(-sims)[:k]
            return [chunks[i] for i in idx], "embedding"
        except ai.AIError:
            pass
    return keyword_search(chunks, query, k), "keyword"


def document_text(document: Document, limit=14000):
    text = "\n".join(f"[page {c.page}] {c.text}" for c in document.chunks.order_by("page", "id"))
    return text[:limit]
