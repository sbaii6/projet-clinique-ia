from langgraph.graph import StateGraph, END
from app.state import MedicalState
from app.nodes.supervisor import supervisor_node
from app.nodes.diagnostic_agent import diagnostic_node
from app.nodes.physician_review import physician_review_node
from app.nodes.report_agent import report_node

# Initialisation du constructeur
builder = StateGraph(MedicalState)

# Ajout des nœuds obligatoires
builder.add_node("supervisor", supervisor_node)
builder.add_node("diagnostic_agent", diagnostic_node)
builder.add_node("physician_review", physician_review_node)
builder.add_node("report_agent", report_node)

builder.set_entry_point("supervisor")

# Routage conditionnel piloté par le Supervisor
builder.add_conditional_edges(
    "supervisor",
    lambda x: x["next"],
    {
        "diagnostic_agent": "diagnostic_agent",
        "physician_review": "physician_review",
        "report_agent": "report_agent",
        "FINISH": END
    }
)

# Après chaque action d'agent, on revient toujours au Supervisor pour décider de la suite
builder.add_edge("diagnostic_agent", "supervisor")
builder.add_edge("physician_review", "supervisor")
builder.add_edge("report_agent", "supervisor")

# Compilation du graphe avec l'interruption pour le médecin
# (La mémoire est gérée automatiquement par LangGraph Studio/Platform)
medical_graph = builder.compile(
    interrupt_before=["physician_review"] 
)