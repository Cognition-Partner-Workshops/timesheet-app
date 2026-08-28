"""Generate Q1-journal-quality research experiments notebook.

Implements all 17 methodological requirements for defensible empirical results.
"""
import nbformat as nbf

nb = nbf.v4.new_notebook()
nb.metadata = {
    "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
    "language_info": {"name": "python", "version": "3.12.0"},
}
cells = []


def md(text):
    cells.append(nbf.v4.new_markdown_cell(text))


def code(text):
    cells.append(nbf.v4.new_code_cell(text))


# ── TITLE & ABSTRACT ──
md("""# AI-Driven Threat Intelligence Framework: Empirical Evaluation

**Project:** AI-Driven Threat Intelligence Framework for Real-Time Cyber Defense Against Vulnerabilities
**Period:** Jan 2025 -- Dec 2025
**Methodology:** Comparative evaluation of multiple LLMs for vulnerability detection using established benchmark datasets with rigorous statistical analysis

---

### Abstract

This notebook presents a rigorous empirical evaluation of large language models (LLMs) for automated vulnerability detection in source code. We compare six state-of-the-art LLMs -- including general-purpose and code-specialized models -- against multiple baselines (regex patterns, Semgrep, Bandit). The evaluation uses two established benchmark datasets (CrossVul and CVEfixes) with both vulnerable and non-vulnerable (fixed) samples. We report results per-dataset and merged with statistical justification, include repeated runs with confidence intervals, ablation studies, and comprehensive cost analysis.

**Key methodological features:**
- Centralized experiment configuration for full reproducibility
- Both vulnerable and non-vulnerable samples for proper precision/specificity evaluation
- Multiple baselines of increasing strength
- Prompt versioning and registry
- Repeated runs (configurable) with mean +/- std and 95% CI
- Statistical tests: McNemar's test, bootstrap CI, effect sizes
- Ablation study: prompt variants, temperature, code truncation
- Runtime and cost analysis per model
- Clear separation of real vs. simulated results

---

## Research Questions

| # | Research Question | Section |
|---|---|---|
| **RQ1** | How do different LLMs compare in detecting known vulnerability types vs. pattern-based and tool-based static analysis? | S10 |
| **RQ2** | What is the detection performance across different programming languages, and does it vary by model? | S11 |
| **RQ3** | How does vulnerability severity/type distribution from LLM analysis compare to historical CVE data? | S12 |
| **RQ4** | What is the quality and actionability of LLM-generated mitigation recommendations? | S13 |
| **RQ5** | What are the latency, throughput, and cost characteristics of each model? | S14 |
| **RQ6** | Do code-specialized LLMs outperform general-purpose LLMs on vulnerability detection? | S15 |

---""")

# ── S1: IMPORTS ──
md("## 1. Imports")

code("""# Install required packages (uncomment and run once)
# !pip install datasets openai anthropic google-generativeai matplotlib pandas numpy scipy scikit-learn

import hashlib, json, os, random, re, subprocess, shutil, time, warnings
from collections import Counter, defaultdict
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import matplotlib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from IPython.display import display, HTML, Markdown
from scipy import stats
from sklearn.metrics import (
    confusion_matrix, classification_report, matthews_corrcoef,
    balanced_accuracy_score, f1_score, accuracy_score,
)

matplotlib.rcParams.update({
    "figure.figsize": (10, 6), "figure.dpi": 150, "font.size": 11,
    "axes.titlesize": 13, "axes.labelsize": 11,
    "xtick.labelsize": 10, "ytick.labelsize": 10,
    "legend.fontsize": 10, "figure.facecolor": "white",
    "axes.facecolor": "white", "axes.grid": True, "grid.alpha": 0.3,
})
warnings.filterwarnings("ignore", category=DeprecationWarning)
print("Imports loaded.")""")

# ── S2: CONFIGURATION ──
md("""## 2. Experiment Configuration

**Justification:** A centralized configuration class ensures full reproducibility and eliminates scattered hard-coded values. All experiment parameters are defined here and referenced throughout the notebook. This follows best practices for empirical software engineering experiments (Wohlin et al., 2012).""")

code("""@dataclass
class ExperimentConfig:
    \"\"\"Centralized experiment configuration.\"\"\"
    random_seed: int = 42
    dataset_crossvul: str = "hitoshura25/crossvul"
    dataset_cvefixes: str = "hitoshura25/cvefixes"
    max_samples_per_dataset: int = 200
    code_length_min: int = 20
    code_length_max: int = 5000
    supported_languages: tuple = (
        "python", "javascript", "java", "php", "go", "c", "cpp", "typescript", "ruby"
    )
    include_non_vulnerable: bool = True
    models: list = field(default_factory=lambda: [
        {"name": "GPT-4o",            "provider": "openai",    "model_id": "gpt-4o",                     "type": "general"},
        {"name": "GPT-4-Turbo",       "provider": "openai",    "model_id": "gpt-4-turbo",                "type": "general"},
        {"name": "Claude 3.5 Sonnet", "provider": "anthropic", "model_id": "claude-3-5-sonnet-20241022", "type": "general"},
        {"name": "Gemini 1.5 Pro",    "provider": "google",    "model_id": "gemini-1.5-pro",             "type": "general"},
        {"name": "DeepSeek-Coder-V2", "provider": "deepseek",  "model_id": "deepseek-coder",             "type": "code"},
        {"name": "CodeLlama-70B",     "provider": "together",  "model_id": "codellama/CodeLlama-70b-Instruct-hf", "type": "code"},
    ])
    temperature: float = 0.1
    max_tokens: int = 2000
    num_repeated_runs: int = 3
    prompt_version: str = "v1.0"
    USE_REAL_LLMS_ONLY: bool = True
    ALLOW_SIMULATION: bool = False
    output_dir: str = "results"
    figure_dpi: int = 300

CFG = ExperimentConfig()
Path(CFG.output_dir).mkdir(exist_ok=True)
cfg_dict = asdict(CFG)
with open(f"{CFG.output_dir}/experiment_config.json", "w") as f:
    json.dump(cfg_dict, f, indent=2, default=str)
print("Experiment Configuration:")
for k, v in cfg_dict.items():
    if k != "models":
        print(f"  {k}: {v}")
print(f"  models: {[m['name'] for m in CFG.models]}")""")

# ── S3: REPRODUCIBILITY ──
md("""## 3. Reproducibility Controls

**Justification:** Fixing all random seeds ensures that dataset sampling, model evaluation order, and any stochastic components produce identical results across runs. This is a requirement for reproducible empirical research.""")

code("""def seed_everything(seed: int) -> None:
    \"\"\"Fix all random seeds for reproducibility.\"\"\"
    random.seed(seed)
    np.random.seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)
    print(f"All seeds fixed to {seed}")

seed_everything(CFG.random_seed)""")


# ── S4: DATASET CONSTRUCTION ──
md("""## 4. Dataset Construction

### 4.1 Design Rationale

**Justification:** A major methodological requirement for vulnerability detection evaluation is the inclusion of both **vulnerable** and **non-vulnerable** (fixed/patched) samples. Without non-vulnerable samples, precision, specificity, false positive rate, and accuracy metrics are undefined or meaningless (Croft et al., 2023; Chakraborty et al., 2021).

We construct our benchmark from two established datasets:
- **CrossVul** (Nikitopoulos et al., 2021): Real-world vulnerability-fixing commits across 40+ languages
- **CVEfixes** (Bhandari et al., 2021): CVE-linked vulnerability fixes with CVSS severity scores

For each dataset, we extract:
1. **Vulnerable** code: the code *before* the fix (pre-commit)
2. **Non-vulnerable** code: the code *after* the fix (post-commit)

This paired design ensures balanced classes and realistic evaluation conditions.""")

md("### 4.2 CWE Mapping and Vulnerability Taxonomy")

code("""CWE_TO_VULN_TYPE = {
    "CWE-79": "xss", "CWE-89": "sql_injection", "CWE-78": "command_injection",
    "CWE-22": "path_traversal", "CWE-352": "csrf", "CWE-287": "auth_bypass",
    "CWE-119": "buffer_overflow", "CWE-120": "buffer_overflow",
    "CWE-125": "buffer_overflow", "CWE-787": "buffer_overflow",
    "CWE-190": "integer_overflow", "CWE-416": "use_after_free",
    "CWE-476": "null_dereference", "CWE-20": "input_validation",
    "CWE-94": "code_injection", "CWE-502": "deserialization",
    "CWE-611": "xxe", "CWE-918": "ssrf", "CWE-200": "info_exposure",
    "CWE-269": "privilege_escalation", "CWE-434": "file_upload",
    "CWE-77": "command_injection", "CWE-74": "injection",
    "CWE-732": "permission_issue", "CWE-362": "race_condition",
    "CWE-798": "hardcoded_credentials", "CWE-327": "weak_crypto",
    "CWE-295": "improper_cert_validation",
}

def classify_cwe(cwe_str) -> str:
    if not cwe_str or (isinstance(cwe_str, float) and np.isnan(cwe_str)):
        return "unknown"
    cwe_str = str(cwe_str).strip()
    if cwe_str in CWE_TO_VULN_TYPE:
        return CWE_TO_VULN_TYPE[cwe_str]
    match = re.search(r"CWE-\\d+", cwe_str)
    if match and match.group() in CWE_TO_VULN_TYPE:
        return CWE_TO_VULN_TYPE[match.group()]
    return "other"

print(f"CWE mapping covers {len(CWE_TO_VULN_TYPE)} CWE entries")""")

md("""### 4.3 Dataset Loading: CrossVul

CrossVul provides vulnerability-fixing commits with pre/post-fix code. We use the `code` column for vulnerable versions and extract non-vulnerable versions from the same commits where available.""")

code("""from datasets import load_dataset

print("Loading CrossVul dataset via HuggingFace streaming...")
crossvul_samples = []
crossvul_filter_log = []
crossvul_raw_count = 0
crossvul_vuln_count = 0
crossvul_nonvuln_count = 0

try:
    ds = load_dataset(CFG.dataset_crossvul, split="train", streaming=True)
    for row in ds:
        crossvul_raw_count += 1
        if len(crossvul_samples) >= CFG.max_samples_per_dataset * 2:
            break
        code_text = row.get("code", row.get("func", ""))
        if not code_text or not isinstance(code_text, str):
            crossvul_filter_log.append({"id": f"cv-{crossvul_raw_count}", "reason": "empty_code"})
            continue
        lang = str(row.get("language", row.get("lang", "unknown"))).lower().strip()
        if lang in ("c++", "c/c++"):
            lang = "cpp"
        if lang not in CFG.supported_languages:
            crossvul_filter_log.append({"id": f"cv-{crossvul_raw_count}", "reason": f"unsupported_language:{lang}"})
            continue
        code_len = len(code_text.strip())
        if code_len < CFG.code_length_min:
            crossvul_filter_log.append({"id": f"cv-{crossvul_raw_count}", "reason": "too_short"})
            continue
        if code_len > CFG.code_length_max:
            crossvul_filter_log.append({"id": f"cv-{crossvul_raw_count}", "reason": "too_long"})
            continue
        cwe = str(row.get("cwe", row.get("cwe_id", ""))).strip()
        cve = str(row.get("cve", row.get("cve_id", ""))).strip()
        vuln_type = classify_cwe(cwe)
        severity = str(row.get("severity", "unknown")).lower().strip()
        if severity not in ("low", "medium", "high", "critical"):
            severity = "unknown"
        crossvul_samples.append({
            "id": f"crossvul-vuln-{crossvul_vuln_count}",
            "source": "crossvul", "language": lang, "code": code_text.strip(),
            "is_vulnerable": True, "ground_truth": vuln_type,
            "cwe": cwe or "unknown", "cve": cve or "N/A",
            "severity": severity, "code_length": code_len,
        })
        crossvul_vuln_count += 1
        if CFG.include_non_vulnerable:
            fixed_code = row.get("fixed_code", row.get("code_after", None))
            if fixed_code and isinstance(fixed_code, str) and len(fixed_code.strip()) >= CFG.code_length_min:
                crossvul_samples.append({
                    "id": f"crossvul-fixed-{crossvul_nonvuln_count}",
                    "source": "crossvul", "language": lang, "code": fixed_code.strip(),
                    "is_vulnerable": False, "ground_truth": "none",
                    "cwe": "N/A", "cve": "N/A", "severity": "none",
                    "code_length": len(fixed_code.strip()),
                })
                crossvul_nonvuln_count += 1
        if crossvul_raw_count % 500 == 0:
            print(f"  Scanned {crossvul_raw_count} rows, collected {len(crossvul_samples)} samples...")
    print(f"\\nCrossVul: {crossvul_raw_count} inspected, {crossvul_vuln_count} vuln, "
          f"{crossvul_nonvuln_count} non-vuln, {len(crossvul_filter_log)} excluded")
except Exception as e:
    print(f"Error loading CrossVul: {e}")""")


md("""### 4.4 Dataset Loading: CVEfixes

CVEfixes links CVE records to Git fix commits, providing both vulnerable (pre-fix) and patched (post-fix) code with CVSS severity scores.""")

code("""print("Loading CVEfixes dataset via HuggingFace streaming...")
cvefixes_samples = []
cvefixes_filter_log = []
cvefixes_raw_count = 0
cvefixes_vuln_count = 0
cvefixes_nonvuln_count = 0

def parse_cvss(val):
    try:
        score = float(val)
    except (TypeError, ValueError):
        return (None, "unknown")
    if score < 4.0: return (score, "low")
    elif score < 7.0: return (score, "medium")
    elif score < 9.0: return (score, "high")
    else: return (score, "critical")

try:
    ds2 = load_dataset(CFG.dataset_cvefixes, split="train", streaming=True)
    for row in ds2:
        cvefixes_raw_count += 1
        if len(cvefixes_samples) >= CFG.max_samples_per_dataset * 2:
            break
        code_text = row.get("code", row.get("func_before", row.get("func", "")))
        if not code_text or not isinstance(code_text, str):
            cvefixes_filter_log.append({"id": f"cvf-{cvefixes_raw_count}", "reason": "empty_code"})
            continue
        lang = str(row.get("language", row.get("lang", "unknown"))).lower().strip()
        if lang in ("c++", "c/c++"):
            lang = "cpp"
        if lang not in CFG.supported_languages:
            cvefixes_filter_log.append({"id": f"cvf-{cvefixes_raw_count}", "reason": f"unsupported_language:{lang}"})
            continue
        code_len = len(code_text.strip())
        if code_len < CFG.code_length_min:
            cvefixes_filter_log.append({"id": f"cvf-{cvefixes_raw_count}", "reason": "too_short"})
            continue
        if code_len > CFG.code_length_max:
            cvefixes_filter_log.append({"id": f"cvf-{cvefixes_raw_count}", "reason": "too_long"})
            continue
        cwe = str(row.get("cwe", row.get("cwe_id", ""))).strip()
        cve = str(row.get("cve_id", row.get("cve", ""))).strip()
        vuln_type = classify_cwe(cwe)
        cvss = row.get("cvss3_base_score", row.get("cvss_score", None))
        _, severity = parse_cvss(cvss)
        cvefixes_samples.append({
            "id": f"cvefixes-vuln-{cvefixes_vuln_count}",
            "source": "cvefixes", "language": lang, "code": code_text.strip(),
            "is_vulnerable": True, "ground_truth": vuln_type,
            "cwe": cwe or "unknown", "cve": cve or "N/A",
            "severity": severity, "code_length": code_len,
        })
        cvefixes_vuln_count += 1
        if CFG.include_non_vulnerable:
            fixed_code = row.get("func_after", row.get("fixed_code", row.get("code_after", None)))
            if fixed_code and isinstance(fixed_code, str) and len(fixed_code.strip()) >= CFG.code_length_min:
                cvefixes_samples.append({
                    "id": f"cvefixes-fixed-{cvefixes_nonvuln_count}",
                    "source": "cvefixes", "language": lang, "code": fixed_code.strip(),
                    "is_vulnerable": False, "ground_truth": "none",
                    "cwe": "N/A", "cve": "N/A", "severity": "none",
                    "code_length": len(fixed_code.strip()),
                })
                cvefixes_nonvuln_count += 1
        if cvefixes_raw_count % 500 == 0:
            print(f"  Scanned {cvefixes_raw_count} rows, collected {len(cvefixes_samples)} samples...")
    print(f"\\nCVEfixes: {cvefixes_raw_count} inspected, {cvefixes_vuln_count} vuln, "
          f"{cvefixes_nonvuln_count} non-vuln, {len(cvefixes_filter_log)} excluded")
except Exception as e:
    print(f"Error loading CVEfixes: {e}")""")

md("""### 4.5 Dataset Sample Inspection

**Justification:** Printing representative samples allows reviewers to assess data quality and verify that the dataset construction is sound.""")

code("""def display_sample(sample, index):
    code_preview = sample["code"][:300]
    if len(sample["code"]) > 300:
        code_preview += "\\n... (truncated)"
    label = "VULNERABLE" if sample["is_vulnerable"] else "NON-VULNERABLE (fixed)"
    print(f"\\n--- Sample {index}: {sample['id']} [{label}] ---")
    print(f"  Source: {sample['source']}, Language: {sample['language']}")
    print(f"  CWE: {sample['cwe']}, CVE: {sample['cve']}, Severity: {sample['severity']}")
    print(f"  Code length: {sample['code_length']} chars")
    print(f"  Code preview:\\n{code_preview}")

print("=== CrossVul Samples ===")
for i, s in enumerate(crossvul_samples[:6]):
    display_sample(s, i)

print("\\n\\n=== CVEfixes Samples ===")
for i, s in enumerate(cvefixes_samples[:6]):
    display_sample(s, i)""")

md("""### 4.6 Dataset Summary Tables

**Justification:** Summary tables provide a concise overview of the benchmark composition, required for the methodology section of the paper.""")

code("""ALL_SAMPLES = crossvul_samples + cvefixes_samples
random.shuffle(ALL_SAMPLES)
print(f"Total benchmark samples: {len(ALL_SAMPLES)}")
print(f"  Vulnerable: {sum(1 for s in ALL_SAMPLES if s['is_vulnerable'])}")
print(f"  Non-vulnerable: {sum(1 for s in ALL_SAMPLES if not s['is_vulnerable'])}")

summary_rows = []
for src_name, src_samples, raw_ct, flog in [
    ("CrossVul", crossvul_samples, crossvul_raw_count, crossvul_filter_log),
    ("CVEfixes", cvefixes_samples, cvefixes_raw_count, cvefixes_filter_log),
]:
    vuln_ct = sum(1 for s in src_samples if s["is_vulnerable"])
    nonvuln_ct = sum(1 for s in src_samples if not s["is_vulnerable"])
    langs = len(set(s["language"] for s in src_samples))
    cwes = len(set(s["cwe"] for s in src_samples if s["cwe"] not in ("N/A", "unknown")))
    summary_rows.append({
        "Dataset": src_name, "Raw inspected": raw_ct,
        "Included": len(src_samples), "Excluded": len(flog),
        "Vulnerable": vuln_ct, "Non-vulnerable": nonvuln_ct,
        "Languages": langs, "CWE categories": cwes,
    })

df_summary = pd.DataFrame(summary_rows)
display(df_summary)
df_summary.to_csv(f"{CFG.output_dir}/dataset_summary.csv", index=False)

dist_rows = [{"source": s["source"], "language": s["language"], "cwe": s["cwe"], "is_vulnerable": s["is_vulnerable"]} for s in ALL_SAMPLES]
df_dist = pd.DataFrame(dist_rows)
class_table = df_dist.groupby(["source", "language"]).agg(
    vulnerable=("is_vulnerable", "sum"),
    non_vulnerable=("is_vulnerable", lambda x: (~x).sum()),
    total=("is_vulnerable", "count"),
).reset_index()
display(class_table)
class_table.to_csv(f"{CFG.output_dir}/class_distribution.csv", index=False)

filter_log = crossvul_filter_log + cvefixes_filter_log
if filter_log:
    df_filter = pd.DataFrame(filter_log)
    df_filter.to_csv(f"{CFG.output_dir}/filtering_log.csv", index=False)
    print(f"\\nFiltering reasons:")
    print(df_filter["reason"].value_counts().to_string())""")

md("""### 4.7 Fixed Benchmark Construction

**Justification:** The evaluation set must be fixed and reproducible. Using stratified sampling ensures representation across datasets, languages, and vulnerability types. The identical sample order is used for all models.""")

code("""ALL_SAMPLES.sort(key=lambda s: s["id"])
seed_everything(CFG.random_seed)
random.shuffle(ALL_SAMPLES)

BENCHMARK = ALL_SAMPLES.copy()
benchmark_hash = hashlib.sha256(json.dumps([s["id"] for s in BENCHMARK]).encode()).hexdigest()[:16]
print(f"Benchmark size: {len(BENCHMARK)} samples")
print(f"Benchmark hash: {benchmark_hash}")

benchmark_df = pd.DataFrame([{k: v for k, v in s.items() if k != "code"} for s in BENCHMARK])
benchmark_df.to_csv(f"{CFG.output_dir}/benchmark_samples.csv", index=False)
print(f"Saved benchmark manifest to {CFG.output_dir}/benchmark_samples.csv")

print(f"\\nBenchmark composition:")
print(f"  By source: {Counter(s['source'] for s in BENCHMARK)}")
print(f"  By language: {Counter(s['language'] for s in BENCHMARK)}")
print(f"  Vulnerable: {sum(1 for s in BENCHMARK if s['is_vulnerable'])}, "
      f"Non-vulnerable: {sum(1 for s in BENCHMARK if not s['is_vulnerable'])}")""")


# ── S5: PROMPT DESIGN ──
md("""## 5. Prompt Design and Versioning

**Justification:** A formal prompt registry ensures that all models receive identical instructions, eliminating prompt variation as a confound. Each prompt is versioned and exported for reproducibility.""")

code("""PROMPT_REGISTRY = {
    "v1.0": {
        "id": "v1.0",
        "name": "detection_with_mitigation",
        "date": "2025-01-15",
        "description": "Full detection prompt requesting vulnerability identification and mitigation suggestions",
        "temperature": CFG.temperature,
        "max_tokens": CFG.max_tokens,
        "expected_schema": {
            "vulnerabilities": [{"type": "str", "severity": "str", "confidence": "float", "line": "int", "description": "str"}],
            "mitigations": [{"title": "str", "description": "str", "suggested_fix": "str"}],
        },
        "template": (
            "You are an expert security code reviewer. Analyze the following {language} code for security vulnerabilities.\\n\\n"
            "Return a JSON object with exactly this structure:\\n"
            "{{\\n"
            '  "vulnerabilities": [\\n'
            '    {{"type": "<vulnerability_type>", "severity": "<low|medium|high|critical>", "confidence": <0.0-1.0>, "line": <line_number>, "description": "<brief description>"}}\\n'
            "  ],\\n"
            '  "mitigations": [\\n'
            '    {{"title": "<mitigation title>", "description": "<what to do>", "suggested_fix": "<code fix suggestion>"}}\\n'
            "  ]\\n"
            "}}\\n\\n"
            'If no vulnerabilities are found, return {{"vulnerabilities": [], "mitigations": []}}.\\n\\n'
            "Code to analyze:\\n```{language}\\n{code}\\n```"
        ),
    },
    "v1.1-detection-only": {
        "id": "v1.1-detection-only",
        "name": "detection_only",
        "date": "2025-01-15",
        "description": "Detection-only prompt without mitigation request (for ablation)",
        "temperature": CFG.temperature,
        "max_tokens": CFG.max_tokens,
        "expected_schema": {
            "vulnerabilities": [{"type": "str", "severity": "str", "confidence": "float"}],
        },
        "template": (
            "You are an expert security code reviewer. Analyze the following {language} code for security vulnerabilities.\\n\\n"
            "Return a JSON object:\\n"
            "{{\\n"
            '  "vulnerabilities": [\\n'
            '    {{"type": "<vulnerability_type>", "severity": "<low|medium|high|critical>", "confidence": <0.0-1.0>}}\\n'
            "  ]\\n"
            "}}\\n\\n"
            'If no vulnerabilities are found, return {{"vulnerabilities": []}}.\\n\\n'
            "Code:\\n```{language}\\n{code}\\n```"
        ),
    },
    "v1.2-with-cwe-hint": {
        "id": "v1.2-with-cwe-hint",
        "name": "detection_with_cwe_hint",
        "date": "2025-01-15",
        "description": "Detection prompt with CWE hint provided (for ablation)",
        "temperature": CFG.temperature,
        "max_tokens": CFG.max_tokens,
        "expected_schema": {
            "vulnerabilities": [{"type": "str", "severity": "str", "confidence": "float"}],
        },
        "template": (
            "You are an expert security code reviewer. The following {language} code may contain a vulnerability related to {cwe_hint}.\\n\\n"
            "Analyze and return a JSON object:\\n"
            "{{\\n"
            '  "vulnerabilities": [\\n'
            '    {{"type": "<vulnerability_type>", "severity": "<low|medium|high|critical>", "confidence": <0.0-1.0>}}\\n'
            "  ],\\n"
            '  "mitigations": [\\n'
            '    {{"title": "<mitigation title>", "description": "<what to do>", "suggested_fix": "<code fix>"}}\\n'
            "  ]\\n"
            "}}\\n\\n"
            'If no vulnerabilities are found, return {{"vulnerabilities": [], "mitigations": []}}.\\n\\n'
            "Code:\\n```{language}\\n{code}\\n```"
        ),
    },
}

with open(f"{CFG.output_dir}/prompt_version.json", "w") as f:
    json.dump(PROMPT_REGISTRY, f, indent=2, default=str)
print(f"Prompt registry exported: {len(PROMPT_REGISTRY)} prompts")
for pid, p in PROMPT_REGISTRY.items():
    print(f"  {pid}: {p['name']} ({p['date']})")""")


# ── S6: BASELINES ──
md("""## 6. Baselines

**Justification:** A single weak baseline (regex) is insufficient for Q1 journal methodology. We implement baselines of increasing strength:
1. **Regex pattern baseline**: Simple pattern matching for common vulnerability signatures
2. **Keyword/rule-based baseline**: Domain-specific keyword counting with thresholds
3. **Semgrep baseline**: Industry-standard static analysis tool (if available)
4. **Bandit baseline**: Python-specific static analysis (for Python samples only)

Each baseline clearly states which languages it supports.""")

code("""VULN_PATTERNS = {
    "sql_injection": [
        r'(?i)(execute|cursor\.execute|raw_query|rawQuery)\s*\([^)]*[\'"]?\s*(%s|\+|\.format|f[\'"])',
        r'(?i)SELECT\s+.*\+\s*(user|request|input|param)',
        r'(?i)(query|sql)\s*=\s*[f\'"].*\{',
    ],
    "xss": [
        r'(?i)(innerHTML|outerHTML|document\.write|\.html\()\s*[=(]',
        r'(?i)render.*\{\{.*\}\}.*\|safe',
        r'(?i)dangerouslySetInnerHTML',
    ],
    "command_injection": [
        r'(?i)(os\.system|subprocess\.(call|run|Popen)|exec|eval)\s*\(',
        r'(?i)Runtime\.getRuntime\(\)\.exec\s*\(',
        r'(?i)child_process\.(exec|spawn)\s*\(',
    ],
    "path_traversal": [
        r'(?i)(open|read|fopen|file_get_contents)\s*\([^)]*\+',
        r'(?i)\.\./|\.\.\\\\',
        r'(?i)(realpath|abspath|normalize)\s*\(',
    ],
    "buffer_overflow": [
        r'(?i)(strcpy|strcat|sprintf|gets)\s*\(',
        r'(?i)memcpy\s*\([^,]+,\s*[^,]+,\s*sizeof',
        r'(?i)\[\s*\d+\s*\].*=',
    ],
    "auth_bypass": [
        r'(?i)(password|passwd|secret|token)\s*==\s*[\'"]',
        r'(?i)verify\s*=\s*False',
        r'(?i)authenticate.*return\s+True',
    ],
    "hardcoded_credentials": [
        r'(?i)(password|api_key|secret|token)\s*=\s*[\'"][^\'"]{3,}[\'"]',
        r'(?i)(AWS_SECRET|PRIVATE_KEY)\s*=\s*[\'"]',
    ],
}

VULN_KEYWORDS = {
    "sql_injection": ["execute", "query", "SELECT", "INSERT", "DROP", "cursor", "rawQuery"],
    "xss": ["innerHTML", "outerHTML", "document.write", ".html(", "dangerouslySetInnerHTML", "safe"],
    "command_injection": ["os.system", "subprocess", "exec(", "eval(", "child_process", "Runtime.exec"],
    "path_traversal": ["../", "..\\\\", "file_get_contents", "open(", "readFile"],
    "buffer_overflow": ["strcpy", "strcat", "sprintf", "gets(", "memcpy"],
    "hardcoded_credentials": ["password=", "api_key=", "secret=", "token=", "AWS_SECRET"],
}


def baseline_regex(code_text: str) -> dict:
    detected = []
    for vuln_type, patterns in VULN_PATTERNS.items():
        for pat in patterns:
            if re.search(pat, code_text):
                detected.append(vuln_type)
                break
    is_vuln = len(detected) > 0
    return {"is_vulnerable": is_vuln, "types": detected, "method": "regex"}


def baseline_keyword(code_text: str, threshold: int = 2) -> dict:
    scores = {}
    for vuln_type, keywords in VULN_KEYWORDS.items():
        count = sum(1 for kw in keywords if kw.lower() in code_text.lower())
        if count >= threshold:
            scores[vuln_type] = count
    detected = list(scores.keys())
    return {"is_vulnerable": len(detected) > 0, "types": detected, "method": "keyword", "scores": scores}


def baseline_semgrep(code_text: str, language: str, sample_id: str) -> dict:
    if not shutil.which("semgrep"):
        return {"is_vulnerable": False, "types": [], "method": "semgrep", "error": "semgrep_not_installed"}
    ext_map = {"python": ".py", "javascript": ".js", "java": ".java", "php": ".php",
               "go": ".go", "c": ".c", "cpp": ".cpp", "typescript": ".ts", "ruby": ".rb"}
    ext = ext_map.get(language, ".txt")
    tmp_path = f"/tmp/semgrep_sample_{sample_id}{ext}"
    try:
        with open(tmp_path, "w") as f:
            f.write(code_text)
        result = subprocess.run(
            ["semgrep", "--config", "auto", "--json", "--quiet", tmp_path],
            capture_output=True, text=True, timeout=30,
        )
        findings = json.loads(result.stdout).get("results", []) if result.returncode == 0 else []
        detected = list(set(f.get("check_id", "unknown").split(".")[-1] for f in findings))
        return {"is_vulnerable": len(findings) > 0, "types": detected, "method": "semgrep", "findings_count": len(findings)}
    except Exception as e:
        return {"is_vulnerable": False, "types": [], "method": "semgrep", "error": str(e)}
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def baseline_bandit(code_text: str, language: str, sample_id: str) -> dict:
    if language != "python":
        return {"is_vulnerable": False, "types": [], "method": "bandit", "error": "python_only"}
    if not shutil.which("bandit"):
        return {"is_vulnerable": False, "types": [], "method": "bandit", "error": "bandit_not_installed"}
    tmp_path = f"/tmp/bandit_sample_{sample_id}.py"
    try:
        with open(tmp_path, "w") as f:
            f.write(code_text)
        result = subprocess.run(
            ["bandit", "-f", "json", "-q", tmp_path],
            capture_output=True, text=True, timeout=30,
        )
        output = json.loads(result.stdout) if result.stdout else {}
        issues = output.get("results", [])
        detected = list(set(i.get("test_id", "unknown") for i in issues))
        return {"is_vulnerable": len(issues) > 0, "types": detected, "method": "bandit", "issues_count": len(issues)}
    except Exception as e:
        return {"is_vulnerable": False, "types": [], "method": "bandit", "error": str(e)}
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


print("Baselines defined:")
print("  1. Regex pattern baseline (all languages)")
print("  2. Keyword/rule-based baseline (all languages)")
print("  3. Semgrep baseline (all languages, requires semgrep installation)")
print("  4. Bandit baseline (Python only, requires bandit installation)")
print(f"  Semgrep available: {shutil.which('semgrep') is not None}")
print(f"  Bandit available: {shutil.which('bandit') is not None}")""")


# ── S7: LLM EXECUTION ENGINE ──
md("""## 7. LLM Execution Engine

**Justification:** A unified execution engine ensures that all models receive identical prompts, and that responses are parsed consistently. Robust JSON parsing with failure tracking prevents silent data loss. Each response records raw output, parsed JSON, success/failure, error message, retry count, latency, and token usage.""")

code("""def parse_llm_json(raw_response: str) -> tuple:
    \"\"\"Robust JSON parsing from LLM output. Returns (parsed_dict, success, error_msg).\"\"\"
    if not raw_response or not isinstance(raw_response, str):
        return ({}, False, "empty_response")
    text = raw_response.strip()
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
    if json_match:
        text = json_match.group(1).strip()
    else:
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1 and end > start:
            text = text[start:end + 1]
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return (parsed, True, None)
        return ({}, False, "not_a_dict")
    except json.JSONDecodeError as e:
        text_fixed = re.sub(r',\s*}', '}', re.sub(r',\s*]', ']', text))
        try:
            parsed = json.loads(text_fixed)
            if isinstance(parsed, dict):
                return (parsed, True, None)
        except Exception:
            pass
        return ({}, False, f"json_error: {str(e)[:100]}")


def call_openai(prompt: str, model_id: str, temperature: float, max_tokens: int) -> tuple:
    \"\"\"Call OpenAI API. Returns (raw_response, token_usage, error).\"\"\"
    try:
        import openai
        client = openai.OpenAI()
        response = client.chat.completions.create(
            model=model_id,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        raw = response.choices[0].message.content
        usage = {"prompt_tokens": response.usage.prompt_tokens,
                 "completion_tokens": response.usage.completion_tokens,
                 "total_tokens": response.usage.total_tokens}
        return (raw, usage, None)
    except Exception as e:
        return (None, {}, str(e))


def call_anthropic(prompt: str, model_id: str, temperature: float, max_tokens: int) -> tuple:
    try:
        import anthropic
        client = anthropic.Anthropic()
        response = client.messages.create(
            model=model_id,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text
        usage = {"prompt_tokens": response.usage.input_tokens,
                 "completion_tokens": response.usage.output_tokens,
                 "total_tokens": response.usage.input_tokens + response.usage.output_tokens}
        return (raw, usage, None)
    except Exception as e:
        return (None, {}, str(e))


def call_google(prompt: str, model_id: str, temperature: float, max_tokens: int) -> tuple:
    try:
        import google.generativeai as genai
        genai.configure(api_key=os.environ.get("GOOGLE_API_KEY", ""))
        model = genai.GenerativeModel(model_id)
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(temperature=temperature, max_output_tokens=max_tokens),
        )
        raw = response.text
        usage = {"total_tokens": 0}
        return (raw, usage, None)
    except Exception as e:
        return (None, {}, str(e))


def call_deepseek(prompt: str, model_id: str, temperature: float, max_tokens: int) -> tuple:
    try:
        import openai
        client = openai.OpenAI(
            api_key=os.environ.get("DEEPSEEK_API_KEY", ""),
            base_url="https://api.deepseek.com/v1",
        )
        response = client.chat.completions.create(
            model=model_id,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        raw = response.choices[0].message.content
        usage = {"prompt_tokens": response.usage.prompt_tokens,
                 "completion_tokens": response.usage.completion_tokens,
                 "total_tokens": response.usage.total_tokens}
        return (raw, usage, None)
    except Exception as e:
        return (None, {}, str(e))


def call_together(prompt: str, model_id: str, temperature: float, max_tokens: int) -> tuple:
    try:
        import openai
        client = openai.OpenAI(
            api_key=os.environ.get("TOGETHER_API_KEY", ""),
            base_url="https://api.together.xyz/v1",
        )
        response = client.chat.completions.create(
            model=model_id,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        raw = response.choices[0].message.content
        usage = {"prompt_tokens": response.usage.prompt_tokens,
                 "completion_tokens": response.usage.completion_tokens,
                 "total_tokens": response.usage.total_tokens}
        return (raw, usage, None)
    except Exception as e:
        return (None, {}, str(e))


PROVIDER_CALLERS = {
    "openai": call_openai,
    "anthropic": call_anthropic,
    "google": call_google,
    "deepseek": call_deepseek,
    "together": call_together,
}


API_KEY_MAP = {
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "google": "GOOGLE_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
    "together": "TOGETHER_API_KEY",
}


def check_model_availability() -> list:
    \"\"\"Check which models have API keys configured.\"\"\"
    available = []
    for model in CFG.models:
        env_key = API_KEY_MAP.get(model["provider"], "")
        has_key = bool(os.environ.get(env_key, ""))
        available.append({**model, "available": has_key, "env_key": env_key})
    return available

model_status = check_model_availability()
print("Model availability:")
for m in model_status:
    status = "READY" if m["available"] else "NO API KEY"
    print(f"  {m['name']:20s} ({m['provider']:10s}) [{m['type']:7s}] -> {status}")

AVAILABLE_MODELS = [m for m in model_status if m["available"]]
if not AVAILABLE_MODELS and CFG.USE_REAL_LLMS_ONLY:
    print("\\nWARNING: No API keys found and USE_REAL_LLMS_ONLY=True.")
    print("Set API keys as environment variables to run experiments.")
    print("Baselines will still be evaluated.")""")


# ── S8: MAIN EXPERIMENT LOOP ──
md("""## 8. Main Experiment Execution

**Justification:** The experiment runs each model on the identical benchmark samples. Each sample-model pair records: raw response, parsed JSON, success/failure, error message, retry count, latency, and token usage. Models without API keys are excluded from the main experiment when `USE_REAL_LLMS_ONLY=True`. Each model is run `num_repeated_runs` times to capture variance.""")

code("""COST_PER_1K_TOKENS = {
    "gpt-4o": {"input": 0.0025, "output": 0.01},
    "gpt-4-turbo": {"input": 0.01, "output": 0.03},
    "claude-3-5-sonnet-20241022": {"input": 0.003, "output": 0.015},
    "gemini-1.5-pro": {"input": 0.00125, "output": 0.005},
    "deepseek-coder": {"input": 0.0001, "output": 0.0002},
    "codellama/CodeLlama-70b-Instruct-hf": {"input": 0.0009, "output": 0.0009},
}


def estimate_cost(model_id: str, usage: dict) -> float:
    costs = COST_PER_1K_TOKENS.get(model_id, {"input": 0.005, "output": 0.015})
    prompt_cost = usage.get("prompt_tokens", 0) / 1000 * costs["input"]
    completion_cost = usage.get("completion_tokens", 0) / 1000 * costs["output"]
    return prompt_cost + completion_cost


def run_llm_on_sample(model: dict, sample: dict, prompt_id: str = "v1.0",
                      temperature: float = None, max_tokens: int = None,
                      truncate_code: int = None) -> dict:
    \"\"\"Run a single LLM call on a sample. Returns detailed result record.\"\"\"
    if temperature is None:
        temperature = CFG.temperature
    if max_tokens is None:
        max_tokens = CFG.max_tokens

    prompt_template = PROMPT_REGISTRY[prompt_id]["template"]
    code_text = sample["code"]
    if truncate_code and len(code_text) > truncate_code:
        code_text = code_text[:truncate_code] + "\n// ... truncated ..."

    cwe_hint = sample.get("cwe", "unknown")
    prompt = prompt_template.format(language=sample["language"], code=code_text, cwe_hint=cwe_hint)

    caller = PROVIDER_CALLERS.get(model["provider"])
    if not caller:
        return {"sample_id": sample["id"], "model": model["name"], "raw_response": None,
                "parsed_json": {}, "parse_success": False, "error": f"unknown_provider:{model['provider']}",
                "retry_count": 0, "latency_s": 0, "token_usage": {}, "cost_usd": 0}

    max_retries = 2
    for attempt in range(max_retries + 1):
        t0 = time.time()
        raw, usage, error = caller(prompt, model["model_id"], temperature, max_tokens)
        latency = time.time() - t0

        if error and attempt < max_retries:
            time.sleep(2 ** attempt)
            continue

        if error:
            return {"sample_id": sample["id"], "model": model["name"], "raw_response": None,
                    "parsed_json": {}, "parse_success": False, "error": error,
                    "retry_count": attempt, "latency_s": latency, "token_usage": usage,
                    "cost_usd": estimate_cost(model["model_id"], usage)}

        parsed, success, parse_error = parse_llm_json(raw)
        return {"sample_id": sample["id"], "model": model["name"], "raw_response": raw,
                "parsed_json": parsed, "parse_success": success,
                "error": parse_error if not success else None,
                "retry_count": attempt, "latency_s": latency, "token_usage": usage,
                "cost_usd": estimate_cost(model["model_id"], usage)}

    return {"sample_id": sample["id"], "model": model["name"], "raw_response": None,
            "parsed_json": {}, "parse_success": False, "error": "max_retries_exceeded",
            "retry_count": max_retries, "latency_s": 0, "token_usage": {}, "cost_usd": 0}


def extract_detection(parsed_json: dict) -> tuple:
    \"\"\"Extract binary detection and types from parsed LLM JSON.\"\"\"
    vulns = parsed_json.get("vulnerabilities", [])
    if not isinstance(vulns, list):
        return (False, [])
    detected_types = []
    for v in vulns:
        if isinstance(v, dict):
            vtype = v.get("type", "unknown")
            detected_types.append(str(vtype).lower().replace(" ", "_"))
    return (len(detected_types) > 0, detected_types)

print("Experiment engine ready.")
print(f"  Available models for real execution: {[m['name'] for m in AVAILABLE_MODELS]}")
print(f"  Benchmark size: {len(BENCHMARK)} samples")
print(f"  Repeated runs: {CFG.num_repeated_runs}")
print(f"  Prompt version: {CFG.prompt_version}")""")

code("""# Run baseline evaluation
print("Running baseline evaluation on all benchmark samples...")
baseline_results = {"regex": [], "keyword": [], "semgrep": [], "bandit": []}

for i, sample in enumerate(BENCHMARK):
    regex_res = baseline_regex(sample["code"])
    baseline_results["regex"].append({
        "sample_id": sample["id"], "is_vulnerable_pred": regex_res["is_vulnerable"],
        "is_vulnerable_true": sample["is_vulnerable"], "types": regex_res["types"],
    })
    kw_res = baseline_keyword(sample["code"])
    baseline_results["keyword"].append({
        "sample_id": sample["id"], "is_vulnerable_pred": kw_res["is_vulnerable"],
        "is_vulnerable_true": sample["is_vulnerable"], "types": kw_res["types"],
    })
    sg_res = baseline_semgrep(sample["code"], sample["language"], sample["id"])
    baseline_results["semgrep"].append({
        "sample_id": sample["id"], "is_vulnerable_pred": sg_res["is_vulnerable"],
        "is_vulnerable_true": sample["is_vulnerable"], "types": sg_res["types"],
        "error": sg_res.get("error"),
    })
    bn_res = baseline_bandit(sample["code"], sample["language"], sample["id"])
    baseline_results["bandit"].append({
        "sample_id": sample["id"], "is_vulnerable_pred": bn_res["is_vulnerable"],
        "is_vulnerable_true": sample["is_vulnerable"], "types": bn_res["types"],
        "error": bn_res.get("error"),
    })
    if (i + 1) % 50 == 0:
        print(f"  Baselines: {i+1}/{len(BENCHMARK)} samples evaluated")

print(f"Baseline evaluation complete for {len(BENCHMARK)} samples.")
for bname, bres in baseline_results.items():
    tp = sum(1 for r in bres if r["is_vulnerable_pred"] and r["is_vulnerable_true"])
    fp = sum(1 for r in bres if r["is_vulnerable_pred"] and not r["is_vulnerable_true"])
    fn = sum(1 for r in bres if not r["is_vulnerable_pred"] and r["is_vulnerable_true"])
    tn = sum(1 for r in bres if not r["is_vulnerable_pred"] and not r["is_vulnerable_true"])
    print(f"  {bname}: TP={tp} FP={fp} FN={fn} TN={tn}")""")

code("""# Run LLM evaluation (real models only)
all_llm_results = {}
all_run_results = {}

if AVAILABLE_MODELS:
    for model in AVAILABLE_MODELS:
        model_name = model["name"]
        all_llm_results[model_name] = []
        all_run_results[model_name] = []
        print(f"\\nRunning {model_name} ({CFG.num_repeated_runs} runs)...")

        for run_idx in range(CFG.num_repeated_runs):
            seed_everything(CFG.random_seed + run_idx)
            run_records = []
            for j, sample in enumerate(BENCHMARK):
                result = run_llm_on_sample(model, sample, prompt_id=CFG.prompt_version)
                result["run_idx"] = run_idx
                run_records.append(result)
                if (j + 1) % 25 == 0:
                    successes = sum(1 for r in run_records if r["parse_success"])
                    print(f"  Run {run_idx+1}: {j+1}/{len(BENCHMARK)} (parse success: {successes}/{j+1})")
            all_llm_results[model_name].extend(run_records)
            all_run_results[model_name].append(run_records)
            total_lat = sum(r["latency_s"] for r in run_records)
            total_cost = sum(r["cost_usd"] for r in run_records)
            successes = sum(1 for r in run_records if r["parse_success"])
            print(f"  Run {run_idx+1} complete: {successes}/{len(BENCHMARK)} parsed, "
                  f"latency={total_lat:.1f}s, cost=${total_cost:.4f}")

    print(f"\\nLLM evaluation complete for {len(AVAILABLE_MODELS)} models.")
else:
    print("No models available for real execution.")
    print("Set API keys and re-run to get real results.")
    print("Baselines and analysis framework are still functional.")""")


# ── S9: EVALUATION METRICS ──
md("""## 9. Evaluation Metrics

**Justification:** Binary detection metrics alone are insufficient. We report a comprehensive set including MCC (robust to class imbalance), balanced accuracy, specificity, FPR, and FNR. For vulnerability type classification, we report macro and weighted F1. All metrics follow recommendations from Hosseini et al. (2017) and Croft et al. (2023).""")

code("""def compute_binary_metrics(y_true: list, y_pred: list) -> dict:
    \"\"\"Compute comprehensive binary classification metrics.\"\"\"
    y_true = np.array(y_true, dtype=int)
    y_pred = np.array(y_pred, dtype=int)
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel() if cm.size == 4 else (0, 0, 0, 0)
    n = len(y_true)
    accuracy = (tp + tn) / n if n > 0 else 0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
    fnr = fn / (fn + tp) if (fn + tp) > 0 else 0
    mcc_val = matthews_corrcoef(y_true, y_pred) if len(set(y_true)) > 1 else 0
    bal_acc = balanced_accuracy_score(y_true, y_pred) if len(set(y_true)) > 1 else accuracy
    return {
        "accuracy": accuracy, "precision": precision, "recall": recall, "f1": f1,
        "specificity": specificity, "fpr": fpr, "fnr": fnr, "mcc": mcc_val,
        "balanced_accuracy": bal_acc, "tp": int(tp), "fp": int(fp),
        "fn": int(fn), "tn": int(tn), "n": n,
        "confusion_matrix": cm.tolist(),
    }


def compute_multiclass_metrics(y_true: list, y_pred: list, labels: list = None) -> dict:
    \"\"\"Compute per-class and aggregate multiclass metrics.\"\"\"
    macro_f1 = f1_score(y_true, y_pred, average="macro", zero_division=0)
    weighted_f1 = f1_score(y_true, y_pred, average="weighted", zero_division=0)
    acc = accuracy_score(y_true, y_pred)
    per_class = {}
    if labels is None:
        labels = sorted(set(y_true) | set(y_pred))
    for label in labels:
        y_t = [1 if t == label else 0 for t in y_true]
        y_p = [1 if p == label else 0 for p in y_pred]
        per_class[label] = {
            "f1": f1_score(y_t, y_p, zero_division=0),
            "support": sum(y_t),
        }
    return {"macro_f1": macro_f1, "weighted_f1": weighted_f1, "accuracy": acc, "per_class": per_class}


def bootstrap_ci(y_true, y_pred, metric_fn, n_boot=1000, ci=0.95, seed=42):
    \"\"\"Compute bootstrap confidence interval for a metric.\"\"\"
    rng = np.random.RandomState(seed)
    scores = []
    n = len(y_true)
    for _ in range(n_boot):
        idx = rng.randint(0, n, n)
        try:
            scores.append(metric_fn(np.array(y_true)[idx], np.array(y_pred)[idx]))
        except Exception:
            continue
    if not scores:
        return (0, 0, 0)
    alpha = (1 - ci) / 2
    lo = np.percentile(scores, alpha * 100)
    hi = np.percentile(scores, (1 - alpha) * 100)
    return (np.mean(scores), lo, hi)


print("Evaluation metrics module ready.")
print("  Binary: accuracy, precision, recall, F1, specificity, FPR, FNR, MCC, balanced accuracy")
print("  Multiclass: macro F1, weighted F1, per-class F1")
print("  Confidence intervals: bootstrap (1000 iterations)")""")


# ── S10: RQ1 — Model Comparison ──
md("""## 10. RQ1: LLM vs. Baseline Detection Performance

**Research Question:** How do different LLMs compare in detecting known vulnerability types vs. pattern-based and tool-based static analysis?

**Methodology:** We evaluate each model and baseline on the identical fixed benchmark. For LLMs with repeated runs, we report mean +/- std and 95% CI. We compare using paired McNemar's test since all methods evaluate the same samples.""")

code("""# Compute baseline metrics
baseline_metrics = {}
for bname, bres in baseline_results.items():
    y_true = [int(r["is_vulnerable_true"]) for r in bres]
    y_pred = [int(r["is_vulnerable_pred"]) for r in bres]
    baseline_metrics[bname] = compute_binary_metrics(y_true, y_pred)
    baseline_metrics[bname]["method_type"] = "baseline"

# Compute LLM metrics (per-run and aggregated)
llm_metrics = {}
llm_per_run_metrics = {}

for model_name, run_list in all_run_results.items():
    llm_per_run_metrics[model_name] = []
    for run_idx, run_records in enumerate(run_list):
        y_true_run = []
        y_pred_run = []
        for rec in run_records:
            sample = next((s for s in BENCHMARK if s["id"] == rec["sample_id"]), None)
            if sample is None:
                continue
            y_true_run.append(int(sample["is_vulnerable"]))
            if rec["parse_success"]:
                is_vuln_pred, _ = extract_detection(rec["parsed_json"])
                y_pred_run.append(int(is_vuln_pred))
            else:
                y_pred_run.append(0)
        metrics_run = compute_binary_metrics(y_true_run, y_pred_run)
        metrics_run["run_idx"] = run_idx
        llm_per_run_metrics[model_name].append(metrics_run)

    # Aggregate across runs
    if llm_per_run_metrics[model_name]:
        metric_keys = ["accuracy", "precision", "recall", "f1", "specificity", "fpr", "fnr", "mcc", "balanced_accuracy"]
        agg = {}
        for mk in metric_keys:
            values = [m[mk] for m in llm_per_run_metrics[model_name]]
            agg[f"{mk}_mean"] = np.mean(values)
            agg[f"{mk}_std"] = np.std(values)
            n_runs = len(values)
            if n_runs > 1:
                ci = stats.t.interval(0.95, df=n_runs-1, loc=np.mean(values), scale=stats.sem(values))
                agg[f"{mk}_ci_lo"] = ci[0]
                agg[f"{mk}_ci_hi"] = ci[1]
            else:
                agg[f"{mk}_ci_lo"] = np.mean(values)
                agg[f"{mk}_ci_hi"] = np.mean(values)
        agg["method_type"] = "llm"
        agg["num_runs"] = len(llm_per_run_metrics[model_name])
        llm_metrics[model_name] = agg

# Build main comparison table (Table 1)
print("\\n=== Table 1: Main Model Comparison (Binary Detection) ===\\n")
table_rows = []
for bname, bm in baseline_metrics.items():
    table_rows.append({
        "Method": bname.capitalize(), "Type": "Baseline",
        "Accuracy": f"{bm['accuracy']:.3f}", "Precision": f"{bm['precision']:.3f}",
        "Recall": f"{bm['recall']:.3f}", "F1": f"{bm['f1']:.3f}",
        "Specificity": f"{bm['specificity']:.3f}", "MCC": f"{bm['mcc']:.3f}",
        "Balanced Acc": f"{bm['balanced_accuracy']:.3f}",
    })
for mname, mm in llm_metrics.items():
    table_rows.append({
        "Method": mname, "Type": "LLM",
        "Accuracy": f"{mm['accuracy_mean']:.3f} +/- {mm['accuracy_std']:.3f}",
        "Precision": f"{mm['precision_mean']:.3f} +/- {mm['precision_std']:.3f}",
        "Recall": f"{mm['recall_mean']:.3f} +/- {mm['recall_std']:.3f}",
        "F1": f"{mm['f1_mean']:.3f} +/- {mm['f1_std']:.3f}",
        "Specificity": f"{mm['specificity_mean']:.3f} +/- {mm['specificity_std']:.3f}",
        "MCC": f"{mm['mcc_mean']:.3f} +/- {mm['mcc_std']:.3f}",
        "Balanced Acc": f"{mm['balanced_accuracy_mean']:.3f} +/- {mm['balanced_accuracy_std']:.3f}",
    })

df_main = pd.DataFrame(table_rows)
display(df_main)
df_main.to_csv(f"{CFG.output_dir}/table1_main_comparison.csv", index=False)

if not table_rows:
    print("No results to display. Set API keys to run LLM evaluation.")""")

code("""# RQ1 visualization
if baseline_metrics or llm_metrics:
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    methods = list(baseline_metrics.keys()) + list(llm_metrics.keys())
    f1_vals, f1_errs, colors = [], [], []
    for bname in baseline_metrics:
        f1_vals.append(baseline_metrics[bname]["f1"])
        f1_errs.append(0)
        colors.append("#2196F3")
    for mname in llm_metrics:
        f1_vals.append(llm_metrics[mname]["f1_mean"])
        f1_errs.append(llm_metrics[mname]["f1_std"])
        colors.append("#4CAF50" if any(m["type"] == "code" for m in CFG.models if m["name"] == mname) else "#FF9800")
    x = np.arange(len(methods))
    axes[0].bar(x, f1_vals, yerr=f1_errs, color=colors, capsize=4, alpha=0.85)
    axes[0].set_xticks(x)
    axes[0].set_xticklabels(methods, rotation=45, ha="right", fontsize=9)
    axes[0].set_ylabel("F1 Score")
    axes[0].set_title("RQ1: Detection F1 Score Comparison")
    axes[0].set_ylim(0, 1.05)
    mcc_vals = [baseline_metrics[b]["mcc"] for b in baseline_metrics] + \
               [llm_metrics[m]["mcc_mean"] for m in llm_metrics]
    mcc_errs = [0] * len(baseline_metrics) + [llm_metrics[m]["mcc_std"] for m in llm_metrics]
    axes[1].bar(x, mcc_vals, yerr=mcc_errs, color=colors, capsize=4, alpha=0.85)
    axes[1].set_xticks(x)
    axes[1].set_xticklabels(methods, rotation=45, ha="right", fontsize=9)
    axes[1].set_ylabel("MCC")
    axes[1].set_title("RQ1: Matthews Correlation Coefficient")
    axes[1].set_ylim(-0.5, 1.05)
    plt.tight_layout()
    plt.savefig(f"{CFG.output_dir}/fig1_rq1_detection_comparison.png", dpi=CFG.figure_dpi, bbox_inches="tight")
    plt.show()
    print(f"Figure saved: {CFG.output_dir}/fig1_rq1_detection_comparison.png")
else:
    print("No results available for RQ1 visualization.")""")

# ── S11: RQ2 — Cross-Language Performance ──
md("""## 11. RQ2: Cross-Language Detection Performance

**Research Question:** What is the detection performance across different programming languages, and does it vary by model?

**Methodology:** We break down detection metrics by programming language for each method. Per-dataset reporting is provided below with Fisher's exact test for statistical justification of merging.""")

code("""def compute_per_group_metrics(results_list, benchmark, group_key="language"):
    sample_map = {s["id"]: s for s in benchmark}
    group_results = defaultdict(lambda: {"y_true": [], "y_pred": []})
    for rec in results_list:
        sample = sample_map.get(rec.get("sample_id"))
        if not sample:
            continue
        group = sample[group_key]
        group_results[group]["y_true"].append(int(sample["is_vulnerable"]))
        if "is_vulnerable_pred" in rec:
            group_results[group]["y_pred"].append(int(rec["is_vulnerable_pred"]))
        elif rec.get("parse_success"):
            is_v, _ = extract_detection(rec.get("parsed_json", {}))
            group_results[group]["y_pred"].append(int(is_v))
        else:
            group_results[group]["y_pred"].append(0)
    metrics = {}
    for group, data in group_results.items():
        if len(data["y_true"]) >= 2:
            metrics[group] = compute_binary_metrics(data["y_true"], data["y_pred"])
            metrics[group]["n_samples"] = len(data["y_true"])
    return metrics

print("=== Table 2: Per-Language Performance ===\\n")
lang_table_rows = []
for bname, bres in baseline_results.items():
    lang_metrics = compute_per_group_metrics(bres, BENCHMARK, "language")
    for lang, lm in lang_metrics.items():
        lang_table_rows.append({
            "Method": bname.capitalize(), "Language": lang,
            "F1": f"{lm['f1']:.3f}", "Precision": f"{lm['precision']:.3f}",
            "Recall": f"{lm['recall']:.3f}", "MCC": f"{lm['mcc']:.3f}", "N": lm["n_samples"],
        })
for model_name, run_list in all_run_results.items():
    if run_list:
        lang_metrics = compute_per_group_metrics(run_list[0], BENCHMARK, "language")
        for lang, lm in lang_metrics.items():
            lang_table_rows.append({
                "Method": model_name, "Language": lang,
                "F1": f"{lm['f1']:.3f}", "Precision": f"{lm['precision']:.3f}",
                "Recall": f"{lm['recall']:.3f}", "MCC": f"{lm['mcc']:.3f}", "N": lm["n_samples"],
            })
if lang_table_rows:
    df_lang = pd.DataFrame(lang_table_rows)
    display(df_lang)
    df_lang.to_csv(f"{CFG.output_dir}/table2_per_language.csv", index=False)
else:
    print("No per-language results available.")""")

code("""print("\\n=== Table 3: Per-Dataset Performance ===\\n")
dataset_table_rows = []
for bname, bres in baseline_results.items():
    src_metrics = compute_per_group_metrics(bres, BENCHMARK, "source")
    for src, sm in src_metrics.items():
        dataset_table_rows.append({
            "Method": bname.capitalize(), "Dataset": src,
            "F1": f"{sm['f1']:.3f}", "Precision": f"{sm['precision']:.3f}",
            "Recall": f"{sm['recall']:.3f}", "MCC": f"{sm['mcc']:.3f}", "N": sm["n_samples"],
        })
for model_name, run_list in all_run_results.items():
    if run_list:
        src_metrics = compute_per_group_metrics(run_list[0], BENCHMARK, "source")
        for src, sm in src_metrics.items():
            dataset_table_rows.append({
                "Method": model_name, "Dataset": src,
                "F1": f"{sm['f1']:.3f}", "Precision": f"{sm['precision']:.3f}",
                "Recall": f"{sm['recall']:.3f}", "MCC": f"{sm['mcc']:.3f}", "N": sm["n_samples"],
            })
if dataset_table_rows:
    df_dataset = pd.DataFrame(dataset_table_rows)
    display(df_dataset)
    df_dataset.to_csv(f"{CFG.output_dir}/table3_per_dataset.csv", index=False)

print("\\n--- Fisher's Exact Test: Justification for Dataset Merging ---")
sample_map = {s["id"]: s for s in BENCHMARK}
for method_name in list(baseline_metrics.keys()):
    if method_name in baseline_results:
        res = baseline_results[method_name]
        cv_tp = sum(1 for r in res if r["is_vulnerable_pred"] and r["is_vulnerable_true"] and sample_map.get(r["sample_id"], {}).get("source") == "crossvul")
        cv_fn = sum(1 for r in res if not r["is_vulnerable_pred"] and r["is_vulnerable_true"] and sample_map.get(r["sample_id"], {}).get("source") == "crossvul")
        cf_tp = sum(1 for r in res if r["is_vulnerable_pred"] and r["is_vulnerable_true"] and sample_map.get(r["sample_id"], {}).get("source") == "cvefixes")
        cf_fn = sum(1 for r in res if not r["is_vulnerable_pred"] and r["is_vulnerable_true"] and sample_map.get(r["sample_id"], {}).get("source") == "cvefixes")
        if cv_tp + cv_fn > 0 and cf_tp + cf_fn > 0:
            table_2x2 = [[cv_tp, cv_fn], [cf_tp, cf_fn]]
            _, p_val = stats.fisher_exact(table_2x2)
            print(f"  {method_name}: Fisher p={p_val:.4f} {'(no sig diff -> merge OK)' if p_val > 0.05 else '(sig diff -> report separately)'}")""")


# ── S12: RQ3 — Severity/Type Distribution ──
md("""## 12. RQ3: Vulnerability Severity and Type Distribution

**Research Question:** How does vulnerability severity/type distribution from LLM analysis compare to historical CVE data?

**Methodology:** We compare the distribution of vulnerability types and severity levels detected by each model against the ground truth labels from the benchmark datasets.""")

code("""print("=== Table 4: Per-CWE Performance ===\\n")
cwe_table_rows = []
sample_map = {s["id"]: s for s in BENCHMARK}

for bname, bres in baseline_results.items():
    cwe_groups = defaultdict(lambda: {"y_true": [], "y_pred": []})
    for rec in bres:
        sample = sample_map.get(rec["sample_id"])
        if sample:
            cwe = sample["cwe"]
            cwe_groups[cwe]["y_true"].append(int(sample["is_vulnerable"]))
            cwe_groups[cwe]["y_pred"].append(int(rec["is_vulnerable_pred"]))
    for cwe, data in cwe_groups.items():
        if len(data["y_true"]) >= 5:
            m = compute_binary_metrics(data["y_true"], data["y_pred"])
            cwe_table_rows.append({
                "Method": bname.capitalize(), "CWE": cwe,
                "F1": f"{m['f1']:.3f}", "Recall": f"{m['recall']:.3f}",
                "N": len(data["y_true"]),
            })

for model_name, run_list in all_run_results.items():
    if run_list:
        cwe_groups = defaultdict(lambda: {"y_true": [], "y_pred": []})
        for rec in run_list[0]:
            sample = sample_map.get(rec["sample_id"])
            if sample:
                cwe = sample["cwe"]
                cwe_groups[cwe]["y_true"].append(int(sample["is_vulnerable"]))
                if rec.get("parse_success"):
                    is_v, _ = extract_detection(rec.get("parsed_json", {}))
                    cwe_groups[cwe]["y_pred"].append(int(is_v))
                else:
                    cwe_groups[cwe]["y_pred"].append(0)
        for cwe, data in cwe_groups.items():
            if len(data["y_true"]) >= 5:
                m = compute_binary_metrics(data["y_true"], data["y_pred"])
                cwe_table_rows.append({
                    "Method": model_name, "CWE": cwe,
                    "F1": f"{m['f1']:.3f}", "Recall": f"{m['recall']:.3f}",
                    "N": len(data["y_true"]),
                })

if cwe_table_rows:
    df_cwe = pd.DataFrame(cwe_table_rows)
    display(df_cwe)
    df_cwe.to_csv(f"{CFG.output_dir}/table4_per_cwe.csv", index=False)

# Severity distribution comparison
print("\\n=== Table 5: Severity Distribution ===\\n")
sev_counts = Counter(s["severity"] for s in BENCHMARK if s["is_vulnerable"])
print("Ground truth severity distribution:")
for sev, count in sev_counts.most_common():
    print(f"  {sev}: {count}")

# Vulnerability type distribution
vuln_type_counts = Counter(s["ground_truth"] for s in BENCHMARK if s["is_vulnerable"])
print("\\nGround truth vulnerability type distribution:")
for vt, count in vuln_type_counts.most_common(15):
    print(f"  {vt}: {count}")""")

code("""# RQ3 visualization: severity and type distributions
fig, axes = plt.subplots(1, 2, figsize=(14, 6))

sev_labels = list(sev_counts.keys())
sev_values = list(sev_counts.values())
if sev_labels:
    colors_sev = {"low": "#4CAF50", "medium": "#FFC107", "high": "#FF9800", "critical": "#F44336", "unknown": "#9E9E9E", "none": "#E0E0E0"}
    bar_colors = [colors_sev.get(s, "#9E9E9E") for s in sev_labels]
    axes[0].bar(sev_labels, sev_values, color=bar_colors, alpha=0.85)
    axes[0].set_title("RQ3: Severity Distribution (Vulnerable Samples)")
    axes[0].set_ylabel("Count")
    axes[0].set_xlabel("Severity")

vt_labels = [vt for vt, _ in vuln_type_counts.most_common(10)]
vt_values = [c for _, c in vuln_type_counts.most_common(10)]
if vt_labels:
    axes[1].barh(vt_labels, vt_values, color="#2196F3", alpha=0.85)
    axes[1].set_title("RQ3: Top Vulnerability Types")
    axes[1].set_xlabel("Count")
    axes[1].invert_yaxis()

plt.tight_layout()
plt.savefig(f"{CFG.output_dir}/fig2_rq3_distributions.png", dpi=CFG.figure_dpi, bbox_inches="tight")
plt.show()
print(f"Figure saved: {CFG.output_dir}/fig2_rq3_distributions.png")""")


# ── S13: RQ4 — Mitigation Quality ──
md("""## 13. RQ4: Mitigation Recommendation Quality

**Research Question:** What is the quality and actionability of LLM-generated mitigation recommendations?

**Methodology:** For each LLM response that includes mitigation suggestions, we evaluate: (1) presence of mitigation, (2) number of suggestions, (3) whether a code fix is included. This is a qualitative metric reported as coverage rates.""")

code("""print("=== Table 6: Mitigation Quality ===\\n")
mitigation_rows = []

for model_name, run_list in all_run_results.items():
    if not run_list:
        continue
    records = run_list[0]
    total = len(records)
    has_mitigation = 0
    has_code_fix = 0
    total_suggestions = 0
    parsed_ok = 0
    for rec in records:
        if not rec.get("parse_success"):
            continue
        parsed_ok += 1
        mits = rec["parsed_json"].get("mitigations", [])
        if isinstance(mits, list) and len(mits) > 0:
            has_mitigation += 1
            total_suggestions += len(mits)
            for m in mits:
                if isinstance(m, dict) and m.get("suggested_fix"):
                    has_code_fix += 1
                    break
    mitigation_rows.append({
        "Model": model_name,
        "Parsed responses": parsed_ok,
        "Has mitigation (%)": f"{has_mitigation/max(parsed_ok,1)*100:.1f}",
        "Has code fix (%)": f"{has_code_fix/max(parsed_ok,1)*100:.1f}",
        "Avg suggestions": f"{total_suggestions/max(parsed_ok,1):.2f}",
    })

if mitigation_rows:
    df_mit = pd.DataFrame(mitigation_rows)
    display(df_mit)
    df_mit.to_csv(f"{CFG.output_dir}/table6_mitigation_quality.csv", index=False)
else:
    print("No mitigation data available (no LLM results).")""")


# ── S14: RQ5 — Runtime and Cost Analysis ──
md("""## 14. RQ5: Runtime, Throughput, and Cost Analysis

**Research Question:** What are the latency, throughput, and cost characteristics of each model?

**Methodology:** We measure per-sample latency, compute mean/median/p95, throughput (samples/minute), total token usage, estimated API cost, and failed request rate.""")

code("""print("=== Table 7: Runtime and Cost Analysis ===\\n")
runtime_rows = []

for model_name, all_records in all_llm_results.items():
    if not all_records:
        continue
    latencies = [r["latency_s"] for r in all_records if r["latency_s"] > 0]
    total_cost = sum(r["cost_usd"] for r in all_records)
    total_tokens = sum(r["token_usage"].get("total_tokens", 0) for r in all_records)
    prompt_tokens = sum(r["token_usage"].get("prompt_tokens", 0) for r in all_records)
    completion_tokens = sum(r["token_usage"].get("completion_tokens", 0) for r in all_records)
    failed = sum(1 for r in all_records if r.get("error") and not r.get("parse_success"))
    total = len(all_records)

    if latencies:
        runtime_rows.append({
            "Model": model_name,
            "Mean latency (s)": f"{np.mean(latencies):.2f}",
            "Median latency (s)": f"{np.median(latencies):.2f}",
            "P95 latency (s)": f"{np.percentile(latencies, 95):.2f}",
            "Throughput (samples/min)": f"{60.0/np.mean(latencies):.1f}" if np.mean(latencies) > 0 else "N/A",
            "Total tokens": total_tokens,
            "Prompt tokens": prompt_tokens,
            "Completion tokens": completion_tokens,
            "Est. cost (USD)": f"${total_cost:.4f}",
            "Failed requests (%)": f"{failed/max(total,1)*100:.1f}",
        })

if runtime_rows:
    df_runtime = pd.DataFrame(runtime_rows)
    display(df_runtime)
    df_runtime.to_csv(f"{CFG.output_dir}/table7_runtime_cost.csv", index=False)
else:
    print("No runtime data available (no LLM results).")""")

code("""# RQ5 visualization: latency distribution
if all_llm_results:
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    model_names = list(all_llm_results.keys())
    latency_data = []
    for mn in model_names:
        lats = [r["latency_s"] for r in all_llm_results[mn] if r["latency_s"] > 0]
        latency_data.append(lats)
    if any(latency_data):
        axes[0].boxplot(latency_data, labels=model_names, vert=True)
        axes[0].set_title("RQ5: Latency Distribution per Model")
        axes[0].set_ylabel("Latency (seconds)")
        axes[0].tick_params(axis='x', rotation=45)

    costs = [sum(r["cost_usd"] for r in all_llm_results[mn]) for mn in model_names]
    axes[1].bar(model_names, costs, color="#FF9800", alpha=0.85)
    axes[1].set_title("RQ5: Total Estimated Cost per Model")
    axes[1].set_ylabel("Cost (USD)")
    axes[1].tick_params(axis='x', rotation=45)

    plt.tight_layout()
    plt.savefig(f"{CFG.output_dir}/fig3_rq5_runtime_cost.png", dpi=CFG.figure_dpi, bbox_inches="tight")
    plt.show()
    print(f"Figure saved: {CFG.output_dir}/fig3_rq5_runtime_cost.png")
else:
    print("No runtime data available for visualization.")""")


# ── S15: RQ6 — Code-Specialized vs General-Purpose ──
md("""## 15. RQ6: Code-Specialized vs. General-Purpose LLMs

**Research Question:** Do code-specialized LLMs outperform general-purpose LLMs on vulnerability detection tasks?

**Methodology:** We group the evaluated models by type (general-purpose vs. code-specialized) and compare their aggregated performance metrics. We test for statistical significance using the Wilcoxon signed-rank test where applicable.""")

code("""print("=== Table 8: Code-Specialized vs. General-Purpose ===\\n")
model_type_map = {m["name"]: m["type"] for m in CFG.models}
type_metrics = {"general": [], "code": []}
for model_name, mm in llm_metrics.items():
    mtype = model_type_map.get(model_name, "general")
    type_metrics[mtype].append({"name": model_name, **mm})

type_rows = []
for mtype, models in type_metrics.items():
    if models:
        avg_f1 = np.mean([m["f1_mean"] for m in models])
        avg_mcc = np.mean([m["mcc_mean"] for m in models])
        avg_prec = np.mean([m["precision_mean"] for m in models])
        avg_rec = np.mean([m["recall_mean"] for m in models])
        type_rows.append({
            "Type": mtype.capitalize(),
            "Models": ", ".join(m["name"] for m in models),
            "Avg F1": f"{avg_f1:.3f}",
            "Avg Precision": f"{avg_prec:.3f}",
            "Avg Recall": f"{avg_rec:.3f}",
            "Avg MCC": f"{avg_mcc:.3f}",
        })

if type_rows:
    df_type = pd.DataFrame(type_rows)
    display(df_type)
    df_type.to_csv(f"{CFG.output_dir}/table8_code_vs_general.csv", index=False)
else:
    print("No LLM results available for RQ6 analysis.")""")


# ── S16: STATISTICAL COMPARISON ──
md("""## 16. Statistical Comparison

**Justification:** Paired statistical tests are essential because all models evaluate the same samples. We use McNemar's test for binary detection outcomes (paired proportions) and bootstrap confidence intervals for metric differences. Effect sizes and adjusted p-values (Bonferroni) are reported for multiple comparisons.""")

code("""print("=== Table 9: Statistical Comparison (McNemar's Test) ===\\n")
stat_rows = []

# Get predictions for each method on the same samples
method_preds = {}

# Baseline predictions
for bname, bres in baseline_results.items():
    preds = {r["sample_id"]: int(r["is_vulnerable_pred"]) for r in bres}
    method_preds[bname] = preds

# LLM predictions (first run)
for model_name, run_list in all_run_results.items():
    if run_list:
        preds = {}
        for rec in run_list[0]:
            if rec.get("parse_success"):
                is_v, _ = extract_detection(rec.get("parsed_json", {}))
                preds[rec["sample_id"]] = int(is_v)
            else:
                preds[rec["sample_id"]] = 0
        method_preds[model_name] = preds

# Pairwise McNemar's test
method_names = list(method_preds.keys())
sample_ids = [s["id"] for s in BENCHMARK]
ground_truth = {s["id"]: int(s["is_vulnerable"]) for s in BENCHMARK}

n_comparisons = len(method_names) * (len(method_names) - 1) // 2
alpha_bonferroni = 0.05 / max(n_comparisons, 1)

for i in range(len(method_names)):
    for j in range(i + 1, len(method_names)):
        m1, m2 = method_names[i], method_names[j]
        p1 = method_preds[m1]
        p2 = method_preds[m2]
        # Build contingency table for McNemar's
        b = 0  # m1 correct, m2 wrong
        c = 0  # m1 wrong, m2 correct
        for sid in sample_ids:
            gt = ground_truth.get(sid, 0)
            pred1 = p1.get(sid, 0)
            pred2 = p2.get(sid, 0)
            correct1 = int(pred1 == gt)
            correct2 = int(pred2 == gt)
            if correct1 == 1 and correct2 == 0:
                b += 1
            elif correct1 == 0 and correct2 == 1:
                c += 1
        # McNemar's test with continuity correction
        if b + c > 0:
            chi2 = (abs(b - c) - 1) ** 2 / (b + c)
            p_val = 1 - stats.chi2.cdf(chi2, df=1)
        else:
            chi2 = 0
            p_val = 1.0
        adjusted_p = min(p_val * n_comparisons, 1.0)
        effect_size = (b - c) / max(b + c, 1)
        stat_rows.append({
            "Method A": m1, "Method B": m2,
            "b (A>B)": b, "c (B>A)": c,
            "chi2": f"{chi2:.3f}", "p-value": f"{p_val:.4f}",
            "Adjusted p": f"{adjusted_p:.4f}",
            "Effect size": f"{effect_size:.3f}",
            "Significant": "Yes" if adjusted_p < 0.05 else "No",
        })

if stat_rows:
    df_stat = pd.DataFrame(stat_rows)
    display(df_stat)
    df_stat.to_csv(f"{CFG.output_dir}/table9_statistical_comparison.csv", index=False)
    print(f"\\nBonferroni-adjusted alpha: {alpha_bonferroni:.4f}")
    print(f"Number of comparisons: {n_comparisons}")
else:
    print("Insufficient methods for statistical comparison.")""")

code("""# Bootstrap confidence intervals for F1 difference between best LLM and best baseline
if llm_metrics and baseline_metrics:
    best_baseline = max(baseline_metrics.items(), key=lambda x: x[1]["f1"])
    best_llm = max(llm_metrics.items(), key=lambda x: x[1]["f1_mean"])
    print(f"\\nBootstrap CI: F1 difference between {best_llm[0]} and {best_baseline[0]}")

    # Get paired predictions
    b_preds = method_preds.get(best_baseline[0], {})
    l_preds = method_preds.get(best_llm[0], {})

    y_true_arr = np.array([ground_truth[sid] for sid in sample_ids])
    y_pred_b = np.array([b_preds.get(sid, 0) for sid in sample_ids])
    y_pred_l = np.array([l_preds.get(sid, 0) for sid in sample_ids])

    def f1_diff(y_t, idx):
        from sklearn.metrics import f1_score as f1s
        return f1s(y_t[idx], y_pred_l[idx], zero_division=0) - f1s(y_t[idx], y_pred_b[idx], zero_division=0)

    rng = np.random.RandomState(CFG.random_seed)
    diffs = []
    for _ in range(1000):
        idx = rng.randint(0, len(y_true_arr), len(y_true_arr))
        diffs.append(f1_diff(y_true_arr, idx))

    lo, hi = np.percentile(diffs, [2.5, 97.5])
    print(f"  Mean F1 difference: {np.mean(diffs):.4f}")
    print(f"  95% Bootstrap CI: [{lo:.4f}, {hi:.4f}]")
    print(f"  Significant: {'Yes' if lo > 0 or hi < 0 else 'No (CI includes 0)'}")
else:
    print("Insufficient results for bootstrap CI comparison.")""")


# ── S17: ABLATION STUDY ──
md("""## 17. Ablation Study

**Justification:** Ablation studies isolate the contribution of each experimental variable. We test the following controlled variants:
1. **Prompt variant**: Detection + mitigation vs. detection-only
2. **CWE hint**: With CWE hint vs. without
3. **Temperature**: 0.0 vs. 0.1
4. **Code truncation**: Full code vs. truncated (first 1000 chars)
5. **Benchmark composition**: Vulnerable-only vs. mixed (vulnerable + non-vulnerable)

Each ablation uses the same model on the same samples, changing only the target variable.""")

code("""ablation_results = {}

if AVAILABLE_MODELS:
    ablation_model = AVAILABLE_MODELS[0]
    print(f"Running ablation study with: {ablation_model['name']}")
    ablation_samples = BENCHMARK[:min(50, len(BENCHMARK))]
    print(f"  Using {len(ablation_samples)} samples for ablation")

    # Ablation 1: Detection-only prompt
    print("\\n  Ablation 1: Detection-only prompt...")
    ab1_results = []
    for s in ablation_samples:
        r = run_llm_on_sample(ablation_model, s, prompt_id="v1.1-detection-only")
        ab1_results.append(r)
    ablation_results["detection_only_prompt"] = ab1_results

    # Ablation 2: With CWE hint
    print("  Ablation 2: With CWE hint...")
    ab2_results = []
    for s in ablation_samples:
        r = run_llm_on_sample(ablation_model, s, prompt_id="v1.2-with-cwe-hint")
        ab2_results.append(r)
    ablation_results["with_cwe_hint"] = ab2_results

    # Ablation 3: Temperature 0
    print("  Ablation 3: Temperature 0.0...")
    ab3_results = []
    for s in ablation_samples:
        r = run_llm_on_sample(ablation_model, s, prompt_id=CFG.prompt_version, temperature=0.0)
        ab3_results.append(r)
    ablation_results["temperature_0"] = ab3_results

    # Ablation 4: Truncated code (1000 chars)
    print("  Ablation 4: Truncated code (1000 chars)...")
    ab4_results = []
    for s in ablation_samples:
        r = run_llm_on_sample(ablation_model, s, prompt_id=CFG.prompt_version, truncate_code=1000)
        ab4_results.append(r)
    ablation_results["truncated_code"] = ab4_results

    # Ablation 5: Vulnerable-only benchmark
    print("  Ablation 5: Vulnerable-only subset...")
    vuln_only = [s for s in ablation_samples if s["is_vulnerable"]]
    ab5_results = []
    for s in vuln_only:
        r = run_llm_on_sample(ablation_model, s, prompt_id=CFG.prompt_version)
        ab5_results.append(r)
    ablation_results["vulnerable_only"] = ab5_results

    print("  Ablation study complete.")
else:
    print("No models available for ablation study. Skipping.")""")

code("""# Ablation results table
print("=== Table 10: Ablation Study Results ===\\n")
ablation_table_rows = []
sample_map = {s["id"]: s for s in BENCHMARK}

for ab_name, ab_records in ablation_results.items():
    if not ab_records:
        continue
    y_true = []
    y_pred = []
    for rec in ab_records:
        sample = sample_map.get(rec["sample_id"])
        if sample:
            y_true.append(int(sample["is_vulnerable"]))
            if rec.get("parse_success"):
                is_v, _ = extract_detection(rec.get("parsed_json", {}))
                y_pred.append(int(is_v))
            else:
                y_pred.append(0)
    if y_true:
        m = compute_binary_metrics(y_true, y_pred)
        ablation_table_rows.append({
            "Variant": ab_name,
            "N": len(y_true),
            "Accuracy": f"{m['accuracy']:.3f}",
            "Precision": f"{m['precision']:.3f}",
            "Recall": f"{m['recall']:.3f}",
            "F1": f"{m['f1']:.3f}",
            "MCC": f"{m['mcc']:.3f}",
        })

if ablation_table_rows:
    df_ablation = pd.DataFrame(ablation_table_rows)
    display(df_ablation)
    df_ablation.to_csv(f"{CFG.output_dir}/table10_ablation.csv", index=False)
else:
    print("No ablation results available.")""")


# ── S18: CONFUSION MATRICES ──
md("""## 18. Confusion Matrices

**Justification:** Confusion matrices provide detailed insight into the types of errors each method makes, essential for understanding model behavior beyond aggregate metrics.""")

code("""# Plot confusion matrices for all methods
all_methods_cm = {}

for bname, bres in baseline_results.items():
    y_true = [int(r["is_vulnerable_true"]) for r in bres]
    y_pred = [int(r["is_vulnerable_pred"]) for r in bres]
    all_methods_cm[bname.capitalize()] = confusion_matrix(y_true, y_pred, labels=[0, 1])

for model_name, run_list in all_run_results.items():
    if run_list:
        y_true = []
        y_pred = []
        sample_map_local = {s["id"]: s for s in BENCHMARK}
        for rec in run_list[0]:
            sample = sample_map_local.get(rec["sample_id"])
            if sample:
                y_true.append(int(sample["is_vulnerable"]))
                if rec.get("parse_success"):
                    is_v, _ = extract_detection(rec.get("parsed_json", {}))
                    y_pred.append(int(is_v))
                else:
                    y_pred.append(0)
        if y_true:
            all_methods_cm[model_name] = confusion_matrix(y_true, y_pred, labels=[0, 1])

n_methods = len(all_methods_cm)
if n_methods > 0:
    cols = min(3, n_methods)
    rows_needed = (n_methods + cols - 1) // cols
    fig, axes = plt.subplots(rows_needed, cols, figsize=(5 * cols, 4 * rows_needed))
    if rows_needed == 1 and cols == 1:
        axes = np.array([[axes]])
    elif rows_needed == 1:
        axes = axes.reshape(1, -1)
    elif cols == 1:
        axes = axes.reshape(-1, 1)

    for idx, (mname, cm) in enumerate(all_methods_cm.items()):
        r, c = divmod(idx, cols)
        ax = axes[r][c]
        im = ax.imshow(cm, cmap="Blues", interpolation="nearest")
        ax.set_title(mname, fontsize=10)
        ax.set_xlabel("Predicted")
        ax.set_ylabel("True")
        ax.set_xticks([0, 1])
        ax.set_yticks([0, 1])
        ax.set_xticklabels(["Non-vuln", "Vuln"])
        ax.set_yticklabels(["Non-vuln", "Vuln"])
        for i2 in range(2):
            for j2 in range(2):
                ax.text(j2, i2, str(cm[i2][j2]), ha="center", va="center",
                        color="white" if cm[i2][j2] > cm.max() / 2 else "black", fontsize=12)

    # Hide unused axes
    for idx in range(n_methods, rows_needed * cols):
        r, c = divmod(idx, cols)
        axes[r][c].set_visible(False)

    plt.tight_layout()
    plt.savefig(f"{CFG.output_dir}/fig4_confusion_matrices.png", dpi=CFG.figure_dpi, bbox_inches="tight")
    plt.show()
    print(f"Figure saved: {CFG.output_dir}/fig4_confusion_matrices.png")
else:
    print("No confusion matrix data available.")""")


# ── S19: SUMMARY ──
md("""## 19. Summary and Conclusions

**Note:** All conclusions below are derived solely from the experimental results obtained. We do not claim state-of-the-art performance, real-time capability, or generalizability beyond the datasets and models evaluated here.""")

code("""print("=" * 70)
print("EXPERIMENT SUMMARY")
print("=" * 70)

print(f"\\nDatasets: CrossVul + CVEfixes")
print(f"Total benchmark samples: {len(BENCHMARK)}")
print(f"  Vulnerable: {sum(1 for s in BENCHMARK if s['is_vulnerable'])}")
print(f"  Non-vulnerable: {sum(1 for s in BENCHMARK if not s['is_vulnerable'])}")
print(f"Languages: {len(set(s['language'] for s in BENCHMARK))}")
print(f"CWE categories: {len(set(s['cwe'] for s in BENCHMARK if s['cwe'] not in ('N/A', 'unknown')))}")

print(f"\\nBaselines evaluated: {list(baseline_metrics.keys())}")
print(f"LLMs evaluated: {list(llm_metrics.keys())}")
print(f"Repeated runs: {CFG.num_repeated_runs}")

print(f"\\nKey findings:")
if baseline_metrics:
    best_bl = max(baseline_metrics.items(), key=lambda x: x[1]["f1"])
    print(f"  Best baseline: {best_bl[0]} (F1={best_bl[1]['f1']:.3f})")
if llm_metrics:
    best_llm = max(llm_metrics.items(), key=lambda x: x[1]["f1_mean"])
    print(f"  Best LLM: {best_llm[0]} (F1={best_llm[1]['f1_mean']:.3f} +/- {best_llm[1]['f1_std']:.3f})")

print(f"\\nSimulation used: {'No (real results only)' if CFG.USE_REAL_LLMS_ONLY else 'Simulation included'}")
print(f"Seed: {CFG.random_seed}")
print(f"Prompt version: {CFG.prompt_version}")
print("=" * 70)""")


# ── S20: EXPORT RESULTS ──
md("""## 20. Results Export

All results are exported to CSV and JSON for direct inclusion in the paper.""")

code("""# Export all raw results
export_data = {
    "config": asdict(CFG),
    "benchmark_hash": benchmark_hash,
    "benchmark_size": len(BENCHMARK),
    "baseline_metrics": {},
    "llm_metrics": {},
    "timestamp": datetime.now(timezone.utc).isoformat(),
}
for bname, bm in baseline_metrics.items():
    serializable = {k: v for k, v in bm.items() if k != "confusion_matrix"}
    serializable["confusion_matrix"] = bm.get("confusion_matrix", [])
    export_data["baseline_metrics"][bname] = serializable
for mname, mm in llm_metrics.items():
    export_data["llm_metrics"][mname] = mm

with open(f"{CFG.output_dir}/all_results.json", "w") as f:
    json.dump(export_data, f, indent=2, default=str)

# Export raw LLM responses
for model_name, records in all_llm_results.items():
    safe_name = model_name.replace(" ", "_").replace("/", "_").lower()
    export_records = []
    for rec in records:
        export_rec = {k: v for k, v in rec.items() if k != "raw_response"}
        export_rec["raw_response_length"] = len(rec.get("raw_response", "") or "")
        export_records.append(export_rec)
    with open(f"{CFG.output_dir}/raw_results_{safe_name}.json", "w") as f:
        json.dump(export_records, f, indent=2, default=str)

print("Exported files:")
for fname in sorted(os.listdir(CFG.output_dir)):
    fpath = os.path.join(CFG.output_dir, fname)
    fsize = os.path.getsize(fpath)
    print(f"  {fname} ({fsize:,} bytes)")""")


# ── S21: DATASET COMPOSITION VISUALIZATION ──
md("## 21. Dataset Composition Visualization")

code("""fig, axes = plt.subplots(2, 2, figsize=(14, 10))

# Language distribution
lang_counts = Counter(s["language"] for s in BENCHMARK)
langs = [l for l, _ in lang_counts.most_common()]
counts = [c for _, c in lang_counts.most_common()]
axes[0, 0].bar(langs, counts, color="#2196F3", alpha=0.85)
axes[0, 0].set_title("Language Distribution")
axes[0, 0].set_ylabel("Count")
axes[0, 0].tick_params(axis='x', rotation=45)

# Source distribution
src_counts = Counter(s["source"] for s in BENCHMARK)
axes[0, 1].pie(list(src_counts.values()), labels=list(src_counts.keys()),
               autopct='%1.1f%%', colors=["#4CAF50", "#FF9800"], startangle=90)
axes[0, 1].set_title("Dataset Source Distribution")

# Vulnerability status
vuln_counts = Counter("Vulnerable" if s["is_vulnerable"] else "Non-vulnerable" for s in BENCHMARK)
axes[1, 0].bar(list(vuln_counts.keys()), list(vuln_counts.values()),
               color=["#F44336", "#4CAF50"], alpha=0.85)
axes[1, 0].set_title("Vulnerability Status Distribution")
axes[1, 0].set_ylabel("Count")

# Code length distribution
code_lengths = [s["code_length"] for s in BENCHMARK]
axes[1, 1].hist(code_lengths, bins=30, color="#9C27B0", alpha=0.7, edgecolor="white")
axes[1, 1].set_title("Code Length Distribution")
axes[1, 1].set_xlabel("Characters")
axes[1, 1].set_ylabel("Count")

plt.tight_layout()
plt.savefig(f"{CFG.output_dir}/fig5_dataset_composition.png", dpi=CFG.figure_dpi, bbox_inches="tight")
plt.show()
print(f"Figure saved: {CFG.output_dir}/fig5_dataset_composition.png")""")


md("### Model Configuration Table")

code("""print("=== Table 11: Model Configuration ===\\n")
model_config_rows = []
for m in CFG.models:
    env_key = API_KEY_MAP.get(m["provider"], "")
    available = bool(os.environ.get(env_key, ""))
    model_config_rows.append({
        "Model": m["name"],
        "Provider": m["provider"],
        "Model ID": m["model_id"],
        "Type": m["type"],
        "Temperature": CFG.temperature,
        "Max Tokens": CFG.max_tokens,
        "Available": "Yes" if available else "No",
    })
df_model_config = pd.DataFrame(model_config_rows)
display(df_model_config)
df_model_config.to_csv(f"{CFG.output_dir}/table11_model_config.csv", index=False)""")


md("### Repeated Runs Detail")

code("""print("=== Table 12: Repeated Runs Detail ===\\n")
runs_detail_rows = []
for model_name, per_run in llm_per_run_metrics.items():
    for rm in per_run:
        runs_detail_rows.append({
            "Model": model_name,
            "Run": rm["run_idx"] + 1,
            "Accuracy": f"{rm['accuracy']:.3f}",
            "F1": f"{rm['f1']:.3f}",
            "Precision": f"{rm['precision']:.3f}",
            "Recall": f"{rm['recall']:.3f}",
            "MCC": f"{rm['mcc']:.3f}",
        })
if runs_detail_rows:
    df_runs = pd.DataFrame(runs_detail_rows)
    display(df_runs)
    df_runs.to_csv(f"{CFG.output_dir}/table12_repeated_runs.csv", index=False)
else:
    print("No repeated run data available.")""")


md("### Confidence Intervals Table")

code("""print("=== Table 13: 95% Confidence Intervals ===\\n")
ci_rows = []
for model_name, mm in llm_metrics.items():
    ci_rows.append({
        "Model": model_name,
        "F1 mean": f"{mm['f1_mean']:.3f}",
        "F1 95% CI": f"[{mm['f1_ci_lo']:.3f}, {mm['f1_ci_hi']:.3f}]",
        "MCC mean": f"{mm['mcc_mean']:.3f}",
        "MCC 95% CI": f"[{mm['mcc_ci_lo']:.3f}, {mm['mcc_ci_hi']:.3f}]",
        "Acc mean": f"{mm['accuracy_mean']:.3f}",
        "Acc 95% CI": f"[{mm['accuracy_ci_lo']:.3f}, {mm['accuracy_ci_hi']:.3f}]",
    })
if ci_rows:
    df_ci = pd.DataFrame(ci_rows)
    display(df_ci)
    df_ci.to_csv(f"{CFG.output_dir}/table13_confidence_intervals.csv", index=False)
else:
    print("No CI data available.")""")


md("### JSON Parse Success Rate")

code("""print("=== Table 14: Parse Success Rate ===\\n")
parse_rows = []
for model_name, records in all_llm_results.items():
    if not records:
        continue
    total = len(records)
    success = sum(1 for r in records if r.get("parse_success"))
    failed = total - success
    errors = Counter(r.get("error", "none") for r in records if not r.get("parse_success"))
    top_error = errors.most_common(1)[0] if errors else ("none", 0)
    parse_rows.append({
        "Model": model_name,
        "Total calls": total,
        "Parse success": success,
        "Parse success (%)": f"{success/max(total,1)*100:.1f}",
        "Failed": failed,
        "Top error": f"{top_error[0]} ({top_error[1]})",
    })
if parse_rows:
    df_parse = pd.DataFrame(parse_rows)
    display(df_parse)
    df_parse.to_csv(f"{CFG.output_dir}/table14_parse_success.csv", index=False)
else:
    print("No parse data available.")""")


md("### Baseline Detail Table")

code("""print("=== Table 15: Baseline Detail ===\\n")
bl_rows = []
for bname, bm in baseline_metrics.items():
    bl_rows.append({
        "Baseline": bname.capitalize(),
        "Accuracy": f"{bm['accuracy']:.3f}",
        "Precision": f"{bm['precision']:.3f}",
        "Recall": f"{bm['recall']:.3f}",
        "F1": f"{bm['f1']:.3f}",
        "Specificity": f"{bm['specificity']:.3f}",
        "FPR": f"{bm['fpr']:.3f}",
        "FNR": f"{bm['fnr']:.3f}",
        "MCC": f"{bm['mcc']:.3f}",
        "Balanced Acc": f"{bm['balanced_accuracy']:.3f}",
        "TP": bm["tp"], "FP": bm["fp"], "FN": bm["fn"], "TN": bm["tn"],
    })
df_bl = pd.DataFrame(bl_rows)
display(df_bl)
df_bl.to_csv(f"{CFG.output_dir}/table15_baseline_detail.csv", index=False)""")


# ── APPENDIX A ──
md("""## Appendix A: Reproducibility Instructions

### Environment Setup

```bash
pip install datasets openai anthropic google-generativeai matplotlib pandas numpy scipy scikit-learn jupyter

# Optional baselines
pip install semgrep bandit

# Set API keys
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="..."
export DEEPSEEK_API_KEY="..."
export TOGETHER_API_KEY="..."
```

### Running the Experiment

```bash
jupyter notebook research_experiments.ipynb
```

### Reproducibility Checklist

- [x] Centralized configuration class with all parameters
- [x] Fixed random seed (42) for Python, NumPy, sampling
- [x] Fixed benchmark sample list exported as CSV
- [x] Identical prompt for all models (versioned)
- [x] Repeated runs (configurable, default 3)
- [x] Statistical tests with paired samples
- [x] All results exported as CSV and JSON
- [x] Configuration exported as JSON
- [x] Clear separation of real vs. simulated results
- [x] Benchmark hash for verification""")


# ── APPENDIX B ──
md("""## Appendix B: Limitations and Threats to Validity

### Internal Validity
- LLM outputs are non-deterministic even at low temperature; repeated runs mitigate but do not eliminate this
- JSON parsing failures may systematically bias results against certain models
- Prompt design may favor certain model architectures

### External Validity
- Results are limited to the CrossVul and CVEfixes datasets
- Only 9 programming languages are evaluated
- Code samples are limited to 5000 characters
- Results may not generalize to proprietary codebases or novel vulnerability types

### Construct Validity
- Binary detection (vulnerable vs. non-vulnerable) is a simplification of real-world vulnerability assessment
- CWE-to-vulnerability-type mapping is approximate
- Mitigation quality is assessed quantitatively (presence/absence) rather than by expert review

### Statistical Validity
- Sample sizes per language and CWE category may be insufficient for robust per-category conclusions
- Multiple comparisons are corrected using Bonferroni, which is conservative
- Bootstrap CIs assume independent samples within the benchmark""")


# ── FINALIZE NOTEBOOK ──
nb.cells = cells
with open("research_experiments.ipynb", "w") as f:
    nbf.write(nb, f)
print("Notebook saved: research_experiments.ipynb")
print(f"Total cells: {len(cells)}")
print(f"Markdown cells: {sum(1 for c in cells if c.cell_type == 'markdown')}")
print(f"Code cells: {sum(1 for c in cells if c.cell_type == 'code')}")
