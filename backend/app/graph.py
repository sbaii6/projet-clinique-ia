from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver  # Sauvegarde en mémoire de l'état
from app.state import MedicalState
from app.nodes.supervisor import supervisor_node
from app.nodes.diagnostic_agent import diagnostic_node
from app.nodes.physician_review import physician_review_node
from app.nodes.report_agent import report_node

# 1. Initialisation du constructeur avec le schéma d'état partagé
builder = StateGraph(MedicalState)

# 2. Enregistrement de tous les agents (nœuds) de l'architecture
builder.add_node("supervisor", supervisor_node)
builder.add_node("diagnostic_agent", diagnostic_node)
builder.add_node("physician_review", physician_review_node)
builder.add_node("report_agent", report_node)

# Le point d'entrée unique est toujours le superviseur de flux
builder.set_entry_point("supervisor")

# 3. Définition du routage dynamique (Conditional Edges) géré par le superviseur
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

# 4. Boucle de rétroaction : chaque nœud métier rend la main au superviseur après exécution
builder.add_edge("diagnostic_agent", "supervisor")
builder.add_edge("physician_review", "supervisor")
builder.add_edge("report_agent", "supervisor")

# 5. Instanciation du gestionnaire de persistence (Checkpointer)
memory = MemorySaver()

# 6. Compilation finale du graphe avec injection de la mémoire et des points d'interruption
medical_graph = builder.compile(
    checkpointer=memory,
    interrupt_before=["physician_review"] 
)