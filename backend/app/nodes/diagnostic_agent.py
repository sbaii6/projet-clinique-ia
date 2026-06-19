from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.types import interrupt
from app.state import MedicalState
from dotenv import load_dotenv

load_dotenv()

llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)

QUESTION_PROMPT = """Tu es un agent médical d'orientation clinique.
Pose UNE SEULE question courte et précise au patient pour affiner le diagnostic.
Ne répète pas les questions déjà posées. Parle en français.
C'est la question {count}/5."""

SUMMARY_PROMPT = """Tu es un agent médical d'orientation clinique.
Basé sur l'historique, produis :
1. Une synthèse clinique préliminaire structurée
2. Une recommandation intermédiaire prudente (repos, hydratation, surveillance)
IMPORTANT : Rappelle que cette synthèse ne remplace pas un avis médical."""


def diagnostic_node(state: MedicalState) -> MedicalState:
    count = state.get("question_count", 0)
    messages = state.get("messages", [])

    if count < 5:
        # 1. Préparer le prompt avec le numéro exact de la question en cours
        current_question_number = count + 1
        system_msg = SystemMessage(content=QUESTION_PROMPT.format(count=current_question_number))
        
        # 2. L'IA génère sa question en lisant l'historique
        ai_response = llm.invoke([system_msg] + messages)

        # 3. PAUSE DYNAMIQUE : On met en attente et on envoie la question au frontend
        human_response = interrupt(ai_response.content)

        # 4. REPRISE : Quand le frontend répond, on sauvegarde l'échange complet et on incrémente
        return {
            "messages": [ai_response, HumanMessage(content=str(human_response))],
            "question_count": current_question_number,
        }

    else:
        # Synthèse après les 5 questions
        system_msg = SystemMessage(content=SUMMARY_PROMPT)
        summary = llm.invoke([system_msg] + messages)

        return {
            "messages": [summary],
            "diagnostic_summary": summary.content,
            "interim_care": "Repos, hydratation suffisante, surveillance des symptômes. Consulter en cas d'aggravation.",
        }