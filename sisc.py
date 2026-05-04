from __future__ import annotations

from dataclasses import dataclass, field
import json
import logging
import os
import re
import time
import unicodedata
from typing import Any, Dict, Iterable, List, Optional
from urllib import error, request as urllib_request

from flask import Flask, Response, g, jsonify, request


app = Flask(__name__)

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("sisc-api")


DEFAULT_RULE_KEYS = {
    "CONTA_RECEBIMENTO_CLIENTE": "",
    "CONTA_FORNECEDOR": "",
    "CONTA_SALARIO": "",
    "CONTA_DESPESA_PF": "",
    "CONTA_IMPOSTOS": "",
    "CONTA_TRANSFERENCIA": "",
}
DEFAULT_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


@dataclass
class Account:
    code: str
    description: str
    group: str = ""
    type: str = ""

    @property
    def label(self) -> str:
        return f"{self.code}/{self.description}"


@dataclass
class ClassificationInput:
    descricao: str = ""
    valor: float = 0.0
    regras_usuario: List[Dict[str, Any]] = field(default_factory=list)
    plano_contas: List[Dict[str, Any]] = field(default_factory=list)
    historico: str = ""
    documento: str = ""
    conta_bancaria: str = ""
    contas_prioritarias: Dict[str, str] = field(default_factory=dict)

    @property
    def transaction_text(self) -> str:
        return f"{self.descricao} {self.historico} {self.documento}".strip()


def normalize_text(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    text = text.lower()
    replacements = {
        "pgto": "pagamento",
        "func": "funcionario",
        "trib": "tributo",
        "nf": "nota fiscal",
    }
    for old, new in replacements.items():
        text = re.sub(rf"\b{re.escape(old)}\b", new, text)
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def tokenize(value: Any) -> List[str]:
    return [token for token in normalize_text(value).split(" ") if len(token) > 2]


def account_from_mapping(data: Dict[str, Any]) -> Account:
    return Account(
        code=str(data.get("code", "")).strip(),
        description=str(data.get("description", "")).strip(),
        group=str(data.get("group", "")).strip(),
        type=str(data.get("type", "")).strip(),
    )


def build_chart(payload_chart: Iterable[Dict[str, Any]]) -> List[Account]:
    return [account_from_mapping(item) for item in payload_chart if item.get("code")]


def find_by_code(chart: Iterable[Account], code: str) -> Optional[Account]:
    wanted = str(code or "").strip()
    if not wanted:
        return None
    for account in chart:
        if account.code == wanted:
            return account
    return None


def find_by_keywords(
    chart: Iterable[Account],
    keywords: Iterable[str],
    *,
    group: str = "",
    type_name: str = "",
) -> Optional[Account]:
    keyword_list = [normalize_text(item) for item in keywords if normalize_text(item)]
    best: Optional[Account] = None
    best_score = 0.0
    norm_group = normalize_text(group)
    norm_type = normalize_text(type_name)
    for account in chart:
        haystack = normalize_text(f"{account.code} {account.description} {account.group} {account.type}")
        if norm_group and normalize_text(account.group) != norm_group:
            continue
        if norm_type and normalize_text(account.type) != norm_type:
            continue
        score = 0.0
        for keyword in keyword_list:
            if keyword in haystack:
                score += max(1.0, len(keyword) / 5.0)
        if score > best_score:
            best = account
            best_score = score
    return best


def semantic_fallback(chart: Iterable[Account], description: str, desired_type: str = "") -> Optional[Account]:
    tokens = tokenize(description)
    norm_desired = normalize_text(desired_type)
    best: Optional[Account] = None
    best_score = 0.0
    for account in chart:
        haystack = normalize_text(f"{account.description} {account.group} {account.type}")
        score = 0.0
        for token in tokens:
            if token in haystack:
                score += 1.25 if len(token) >= 6 else 0.7
        if norm_desired and norm_desired in normalize_text(account.type):
            score += 0.85
        if score > best_score:
            best = account
            best_score = score
    return best


def resolve_account_reference(chart: Iterable[Account], value: Any) -> Optional[Account]:
    raw = str(value or "").strip()
    if not raw:
        return None
    chart_list = list(chart)
    by_code = find_by_code(chart_list, raw)
    if by_code:
        return by_code
    label_match = re.match(r"^([^\s/-]+(?:\.[^\s/-]+)*)\s*[-/]", raw)
    if label_match:
        by_label_code = find_by_code(chart_list, label_match.group(1).strip())
        if by_label_code:
            return by_label_code
    normalized_value = normalize_text(raw)
    for account in chart_list:
        if normalize_text(account.description) == normalized_value:
            return account
    for account in chart_list:
        haystack = normalize_text(f"{account.code} {account.description}")
        if normalized_value and normalized_value in haystack:
            return account
    return None


def build_result(
    debit: Optional[Account],
    credit: Optional[Account],
    tipo: str,
    confianca: float,
    regra: str,
    origem: str,
    justificativa: str,
) -> Dict[str, Any]:
    return {
        "debito": debit.label if debit else "",
        "credito": credit.label if credit else "",
        "tipo_lancamento": tipo,
        "confianca": round(max(0.0, min(1.0, confianca)), 2),
        "regra_aplicada": regra,
        "origem_decisao": origem,
        "justificativa": justificativa,
        "_debitCode": debit.code if debit else "",
        "_creditCode": credit.code if credit else "",
    }


def parse_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def normalize_request_payload(payload: Dict[str, Any]) -> ClassificationInput:
    tx = payload.get("lancamento") if isinstance(payload.get("lancamento"), dict) else {}
    return ClassificationInput(
        descricao=str(payload.get("descricao") or tx.get("description") or "").strip(),
        valor=parse_float(payload.get("valor", tx.get("amount", 0.0)), 0.0),
        regras_usuario=list(payload.get("regras_usuario") or []),
        plano_contas=list(payload.get("plano_contas") or []),
        historico=str(payload.get("historico") or tx.get("history") or "").strip(),
        documento=str(payload.get("documento") or tx.get("document") or "").strip(),
        conta_bancaria=str(payload.get("conta_bancaria") or "").strip(),
        contas_prioritarias=dict(payload.get("contas_prioritarias") or {}),
    )


def validate_payload(payload: Dict[str, Any]) -> Optional[str]:
    if not isinstance(payload, dict):
        return "JSON inválido: o corpo precisa ser um objeto"
    plano_contas = payload.get("plano_contas")
    if plano_contas is None:
        return "Campo plano_contas é obrigatório"
    if not isinstance(plano_contas, list):
        return "Campo plano_contas deve ser uma lista"
    regras_usuario = payload.get("regras_usuario", [])
    if regras_usuario is not None and not isinstance(regras_usuario, list):
        return "Campo regras_usuario deve ser uma lista"
    return None


def extract_rule_keywords(rule: Dict[str, Any]) -> List[str]:
    if isinstance(rule.get("keywords"), list):
        return [str(item).strip() for item in rule.get("keywords", []) if str(item).strip()]
    if rule.get("keywords"):
        return [item.strip() for item in str(rule.get("keywords")).split(",") if item.strip()]
    if rule.get("keyword"):
        return [str(rule.get("keyword")).strip()]
    return []


def classify_by_user_rules(data: ClassificationInput, chart: List[Account], bank_account: Optional[Account]) -> Optional[Dict[str, Any]]:
    if not data.regras_usuario:
        return None
    searchable_text = normalize_text(data.transaction_text)
    if not searchable_text:
        return None

    best_match: Optional[Dict[str, Any]] = None
    best_score = 0
    for index, rule in enumerate(data.regras_usuario):
        if not isinstance(rule, dict):
            continue
        keywords = [normalize_text(keyword) for keyword in extract_rule_keywords(rule) if normalize_text(keyword)]
        if not keywords:
            continue
        score = sum(1 for keyword in keywords if keyword in searchable_text)
        if score == 0:
            continue

        direction = normalize_text(rule.get("tipo_movimento") or rule.get("direction") or rule.get("tipo") or "")
        if direction in {"entrada", "credit", "credito"} and data.valor < 0:
            continue
        if direction in {"saida", "debit", "debito"} and data.valor >= 0:
            continue

        debit_account = resolve_account_reference(chart, rule.get("debito") or rule.get("debit"))
        credit_account = resolve_account_reference(chart, rule.get("credito") or rule.get("credit"))

        if not debit_account or not credit_account:
            target_account = resolve_account_reference(chart, rule.get("conta") or rule.get("account") or rule.get("codigo_conta"))
            if target_account and bank_account:
                if data.valor >= 0:
                    debit_account = bank_account
                    credit_account = target_account
                else:
                    debit_account = target_account
                    credit_account = bank_account

        if not debit_account or not credit_account:
            continue

        if score > best_score:
            best_score = score
            best_match = build_result(
                debit_account,
                credit_account,
                "receita" if data.valor >= 0 else "despesa",
                1.0,
                str(rule.get("nome") or f"regra_usuario_{index + 1}"),
                "regra_usuario",
                "Classificação aplicada por regra definida pelo usuário.",
            )

    return best_match


def classify_by_plan_and_priorities(data: ClassificationInput, chart: List[Account], bank_account: Optional[Account]) -> Dict[str, Any]:
    if not chart:
        raise ValueError("plano_contas vazio")
    if not bank_account:
        raise ValueError("conta bancaria nao encontrada no plano")

    description = normalize_text(data.transaction_text)
    amount = float(data.valor or 0.0)
    rules = {**DEFAULT_RULE_KEYS, **dict(data.contas_prioritarias or {})}

    conta_recebimento = resolve_account_reference(chart, rules["CONTA_RECEBIMENTO_CLIENTE"])
    conta_fornecedor = resolve_account_reference(chart, rules["CONTA_FORNECEDOR"])
    conta_salario = resolve_account_reference(chart, rules["CONTA_SALARIO"])
    conta_despesa_pf = resolve_account_reference(chart, rules["CONTA_DESPESA_PF"])
    conta_impostos = resolve_account_reference(chart, rules["CONTA_IMPOSTOS"])
    conta_transferencia = resolve_account_reference(chart, rules["CONTA_TRANSFERENCIA"])
    patrimonio_socio = find_by_keywords(chart, ["patrimonio liquido", "capital social", "socio"])
    passivo_emprestimo = find_by_keywords(chart, ["emprestimo", "financiamentos", "mutuo"], group="Passivo") or find_by_keywords(chart, ["emprestimo", "passivo"])
    passivo_fornecedor = find_by_keywords(chart, ["fornecedores", "passivo fornecedores"], group="Passivo") or conta_fornecedor

    if re.search(r"transferencia|transf interna|pix entre contas|ted entre contas", description) and conta_transferencia:
        return build_result(
            conta_transferencia,
            bank_account,
            "transferencia",
            1.0,
            "transferencia_interna",
            "plano_contas",
            "Movimentação interna identificada; a conta de transferência foi priorizada.",
        )

    if amount > 0:
        if re.search(r"socio|capital social|aporte", description) and patrimonio_socio:
            return build_result(
                bank_account,
                patrimonio_socio,
                "patrimonio",
                1.0,
                "aporte_socio",
                "plano_contas",
                "Recebimento identificado como aporte de sócio.",
            )
        if re.search(r"emprestimo|mutuo|financiamento", description) and passivo_emprestimo:
            return build_result(
                bank_account,
                passivo_emprestimo,
                "passivo",
                1.0,
                "emprestimo_recebido",
                "plano_contas",
                "Recebimento identificado como empréstimo.",
            )
        if conta_recebimento:
            return build_result(
                bank_account,
                conta_recebimento,
                "receita",
                1.0,
                "recebimento_padrao",
                "plano_contas",
                "Valor positivo classificado pela conta prioritária de recebimento.",
            )

    if re.search(r"salario|folha|funcionario|pro labore|holerite", description) and conta_salario:
        return build_result(
            conta_salario,
            bank_account,
            "despesa",
            1.0,
            "salarios",
            "plano_contas",
            "Pagamento de salários identificado.",
        )

    if re.search(r"darf|imposto|tributo|pis|cofins|iss|icms|irpj|csll|simples nacional|inss|fgts", description) and conta_impostos:
        return build_result(
            conta_impostos,
            bank_account,
            "despesa",
            1.0,
            "impostos",
            "plano_contas",
            "Tributo identificado no histórico.",
        )

    if amount < 0 and re.search(r"cpf|pessoa fisica|autonomo|diarista|freelancer|prestador", description) and conta_despesa_pf:
        return build_result(
            conta_despesa_pf,
            bank_account,
            "despesa",
            1.0,
            "pagamento_pessoa_fisica",
            "plano_contas",
            "Pagamento para pessoa física identificado.",
        )

    if amount < 0 and re.search(r"cnpj|ltda|me|eireli|sa|empresa|nota fiscal|fornecedor", description) and conta_fornecedor:
        if re.search(r"prazo|boleto|duplicata|vencimento|parcela|a pagar", description) and passivo_fornecedor:
            return build_result(
                conta_fornecedor,
                passivo_fornecedor,
                "passivo",
                1.0,
                "pagamento_pj_prazo",
                "plano_contas",
                "Pagamento para pessoa jurídica com indício de prazo.",
            )
        return build_result(
            conta_fornecedor,
            bank_account,
            "despesa",
            1.0,
            "pagamento_pj_imediato",
            "plano_contas",
            "Pagamento para pessoa jurídica identificado.",
        )

    fallback = semantic_fallback(chart, description, "Receita" if amount > 0 else "Despesa")
    if fallback:
        if amount > 0:
            return build_result(
                bank_account,
                fallback,
                "receita",
                0.85,
                "fallback_plano_contas",
                "plano_contas",
                "Classificação definida por similaridade com o plano de contas.",
            )
        return build_result(
            fallback,
            bank_account,
            "despesa",
            0.85,
            "fallback_plano_contas",
            "plano_contas",
            "Classificação definida por similaridade com o plano de contas.",
        )

    return build_result(
        None,
        None,
        "receita" if amount >= 0 else "despesa",
        0.0,
        "sem_classificacao",
        "plano_contas",
        "Nenhuma regra local ou correspondência forte no plano de contas foi encontrada.",
    )


def get_gemini_api_key() -> str:
    return os.getenv("GEMINI_API_KEY") or os.getenv("SISC_GEMINI_API_KEY", "")


def build_gemini_prompt(data: ClassificationInput) -> str:
    compact = {
        "descricao": data.descricao,
        "valor": data.valor,
        "historico": data.historico,
        "documento": data.documento,
        "regras_usuario": data.regras_usuario,
        "plano_contas": data.plano_contas,
        "conta_bancaria": data.conta_bancaria,
        "contas_prioritarias": data.contas_prioritarias,
    }
    return (
        "Você é uma IA contábil auxiliar. As regras principais já foram tentadas e ainda não fecharam a classificação. "
        "Escolha contas APENAS do plano de contas informado. Nunca invente códigos fora da lista. "
        "Se não houver segurança suficiente, devolva débito e crédito vazios. "
        "Responda somente JSON válido no formato: "
        '{"debito":"codigo ou vazio","credito":"codigo ou vazio","tipo_lancamento":"receita|despesa|transferencia|passivo|patrimonio","confianca":0.0,"regra_aplicada":"gemini_fallback","origem_decisao":"ia","justificativa":"texto curto"}.\n\n'
        f"Dados:\n{json.dumps(compact, ensure_ascii=False)}"
    )


def extract_json_blob(text: str) -> Dict[str, Any]:
    source = str(text or "").strip()
    if not source:
        raise ValueError("resposta vazia da IA")
    fenced = re.search(r"```json\s*([\s\S]*?)```", source, re.I) or re.search(r"```\s*([\s\S]*?)```", source, re.I)
    candidate = fenced.group(1) if fenced else source
    first_brace = candidate.find("{")
    last_brace = candidate.rfind("}")
    if first_brace < 0 or last_brace <= first_brace:
        raise ValueError("IA não retornou JSON válido")
    return json.loads(candidate[first_brace : last_brace + 1])


def call_gemini_api(data: ClassificationInput, chart: List[Account], api_key: str, model: str) -> Dict[str, Any]:
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    body = json.dumps(
        {
            "contents": [{"role": "user", "parts": [{"text": build_gemini_prompt(data)}]}],
            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
        }
    ).encode("utf-8")
    req = urllib_request.Request(endpoint, data=body, method="POST", headers={"Content-Type": "application/json"})
    try:
        with urllib_request.urlopen(req, timeout=45) as response:
            raw = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:  # pragma: no cover
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Gemini HTTP {exc.code}: {detail[:240]}") from exc
    except error.URLError as exc:  # pragma: no cover
        raise RuntimeError(f"Falha de rede ao acessar a IA: {exc.reason}") from exc

    parts = raw.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    text = "\n".join(part.get("text", "") for part in parts)
    parsed = extract_json_blob(text)
    debit = resolve_account_reference(chart, parsed.get("debito"))
    credit = resolve_account_reference(chart, parsed.get("credito"))
    return build_result(
        debit,
        credit,
        str(parsed.get("tipo_lancamento") or ("receita" if data.valor >= 0 else "despesa")),
        parse_float(parsed.get("confianca"), 0.0),
        str(parsed.get("regra_aplicada") or "gemini_fallback"),
        str(parsed.get("origem_decisao") or "ia"),
        str(parsed.get("justificativa") or "Classificação sugerida pela IA."),
    )


def classify_by_ai(data: ClassificationInput, chart: List[Account]) -> Dict[str, Any]:
    api_key = get_gemini_api_key()
    if not api_key:
        return build_result(
            None,
            None,
            "receita" if data.valor >= 0 else "despesa",
            0.0,
            "ia_indisponivel",
            "ia",
            "A variável de ambiente GEMINI_API_KEY não está configurada no servidor.",
        )
    result = call_gemini_api(data, chart, api_key, DEFAULT_GEMINI_MODEL)
    if result.get("_debitCode") and result.get("_creditCode"):
        return result
    return build_result(
        None,
        None,
        "receita" if data.valor >= 0 else "despesa",
        0.0,
        "ia_sem_correspondencia",
        "ia",
        "A IA não encontrou conta válida dentro do plano informado.",
    )


def classify_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    data = normalize_request_payload(payload)
    chart = build_chart(data.plano_contas)
    if not chart:
        raise ValueError("plano_contas vazio")

    bank_account = find_by_code(chart, data.conta_bancaria) or find_by_keywords(chart, ["banco conta corrente", "banco", "caixa"])
    by_rule = classify_by_user_rules(data, chart, bank_account)
    if by_rule and by_rule.get("_debitCode") and by_rule.get("_creditCode"):
        return by_rule

    by_plan = classify_by_plan_and_priorities(data, chart, bank_account)
    if by_plan.get("_debitCode") and by_plan.get("_creditCode") and parse_float(by_plan.get("confianca"), 0.0) >= 0.6:
        return by_plan

    return classify_by_ai(data, chart)


@app.before_request
def before_request_logging() -> None:
    g.request_start = time.perf_counter()
    logger.info("request_started method=%s path=%s", request.method, request.path)


@app.after_request
def after_request_logging(response: Response) -> Response:
    duration_ms = (time.perf_counter() - getattr(g, "request_start", time.perf_counter())) * 1000
    logger.info(
        "request_finished method=%s path=%s status=%s duration_ms=%.2f",
        request.method,
        request.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.get("/health")
def health() -> Response:
    return jsonify({"status": "ok"})


@app.post("/classify")
def classify_route() -> Response:
    try:
        payload = request.get_json(silent=True)
        error_message = validate_payload(payload)
        if error_message:
            return jsonify({"status": "error", "message": error_message}), 400

        result = classify_payload(payload)
        return jsonify({"status": "ok", "classification": result})
    except ValueError as exc:
        logger.warning("classification_validation_error error=%s", exc)
        return jsonify({"status": "error", "message": str(exc)}), 400
    except Exception as exc:  # pragma: no cover
        logger.exception("classification_failure")
        return jsonify({"status": "error", "message": f"Erro interno: {exc}"}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)