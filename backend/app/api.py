import os
import traceback
from dotenv import load_dotenv

# 1. FORCER LE CHARGEMENT DE LA CLÉ API (GROQ) AVANT TOUT LE RESTE
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_core.messages import HumanMessage
from langgraph.types import Command
from app.graph import medical_graph

app = FastAPI(title="Système d'Orientation Clinique EMSI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SessionInput(BaseModel):
    thread_id: str

class ConsultInput(BaseModel):
    thread_id: str
    message: str


@app.get("/")
async def home():
    return {"message": "API Medical Multi-Agent OK"}


@app.post("/sessions/start")
async def start_session(data: SessionInput):
    return {"status": "session_created", "thread_id": data.thread_id}


@app.post("/consultation/start")
async def start_consult(data: ConsultInput):
    config = {"configurable": {"thread_id": data.thread_id}}
    initial_input = {
        "messages": [HumanMessage(content=data.message)],
        "question_count": 0,
        "diagnostic_summary": "",
        "interim_care": "",
        "physician_treatment": "",
        "final_report": ""
    }
    try:
        medical_graph.invoke(initial_input, config=config)
        # Lire la question depuis l'interrupt actif
        current_question = _get_interrupt_value(config)
        return {
            "status": "consultation_started",
            "result": {
                "last_message": current_question or "Démarrage de la consultation...",
                "question_count": 1,
                "messages": [{"role": "ai", "content": current_question}] if current_question else []
            }
        }
    except Exception as e:
        # AFFICHE L'ERREUR EXACTE DANS LE TERMINAL POUR DÉBOGUER
        print("\n--- 🚨 ERREUR LORS DU DÉMARRAGE DE LA CONSULTATION ---")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/consultation/resume")
async def resume_consult(data: ConsultInput):
    config = {"configurable": {"thread_id": data.thread_id}}

    current_state = medical_graph.get_state(config)
    if not current_state:
        raise HTTPException(status_code=404, detail="Session introuvable")

    try:
        medical_graph.invoke(
            Command(resume=data.message),
            config=config
        )

        # Lire l'état après reprise
        new_state = medical_graph.get_state(config)
        new_values = new_state.values if new_state else {}

        # Chercher la prochaine question ou la synthèse
        next_question = _get_interrupt_value(config)
        question_count = new_values.get("question_count", 0)
        diagnostic_summary = new_values.get("diagnostic_summary", "")
        interim_care = new_values.get("interim_care", "")
        physician_treatment = new_values.get("physician_treatment", "")
        final_report = new_values.get("final_report", "")

        # Déterminer le message à afficher (Logique corrigée pour l'Écran 3)
        if final_report:
            last_message = final_report
        elif diagnostic_summary and not physician_treatment:
            last_message = diagnostic_summary
        elif next_question:
            last_message = next_question
        else:
            last_message = "Consultation en cours..."

        return {
            "status": "consultation_resumed",
            "result": {
                "last_message": last_message,
                "question_count": question_count,
                "diagnostic_summary": diagnostic_summary,
                "interim_care": interim_care,
                "physician_treatment": physician_treatment,
                "final_report": final_report,
                "messages": [{"role": "ai", "content": last_message}] if last_message else []
            }
        }
    except Exception as e:
        # AFFICHE L'ERREUR EXACTE DANS LE TERMINAL POUR DÉBOGUER
        print("\n--- 🚨 ERREUR LORS DE LA POURSUITE DE LA CONSULTATION ---")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/consultation/{thread_id}/report")
async def get_report(thread_id: str):
    config = {"configurable": {"thread_id": thread_id}}
    try:
        state = medical_graph.get_state(config)
        if not state:
            raise HTTPException(status_code=404, detail="Consultation introuvable")
        final_report = state.values.get("final_report")
        if not final_report:
            raise HTTPException(status_code=404, detail="Rapport non encore généré")
        return {"thread_id": thread_id, "report": final_report}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ─── HELPER ───────────────────────────────────────────────────────────────────

def _get_interrupt_value(config: dict) -> str | None:
    """
    Lit la valeur passée à interrupt() depuis les tâches en attente du graphe.
    C'est ici que se trouve la question générée par le Diagnostic Agent.
    """
    try:
        state = medical_graph.get_state(config)
        if not state or not state.tasks:
            return None
        for task in state.tasks:
            interrupts = getattr(task, "interrupts", [])
            if interrupts:
                # La valeur de interrupt() = la question générée par le LLM
                return str(interrupts[0].value)
        return None
    except Exception:
        return None